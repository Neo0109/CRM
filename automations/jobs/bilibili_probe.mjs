import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeMediaLinks, steamAppIdFromLinks } from "./sourcing_v6_3_quality.mjs";

const defaultHeaders = {
  "User-Agent": "Mozilla/5.0 SourcingCRM/1.0 (+https://github.com/Neo0109/CRM)",
  Accept: "application/json,text/plain,*/*",
  Referer: "https://search.bilibili.com/"
};

export function defaultBilibiliProbeDiagnostics() {
  return {
    raw_candidates: 0,
    keyword_candidates: 0,
    up_candidates: 0,
    detail_success: 0,
    detail_failed: 0,
    source_failures: 0,
    official_source_hits: 0,
    developer_source_hits: 0,
    publisher_source_hits: 0,
    media_source_hits: 0,
    trusted_creator_hits: 0,
    links_extracted: 0,
    steam_links_extracted: 0,
    blacklist_filtered: 0,
    old_video_filtered: 0,
    generic_collection_filtered: 0,
    required_keyword_filtered: 0,
    duplicate_filtered: 0,
    final_candidates: 0
  };
}

export async function loadBilibiliProbeConfig(rootDir = process.cwd(), configPath = null) {
  const filePath = configPath ?? path.join(rootDir, "automations/rules/bilibili-probe.json");
  const value = JSON.parse(await readFile(filePath, "utf8"));
  return normalizeProbeConfig(value);
}

export async function collectBilibiliProbeSignals({
  rootDir = process.cwd(),
  reportDate = todayIsoDate(),
  configPath = null,
  config = null,
  fetchImpl = globalThis.fetch,
  maxVideoAgeDays = null,
  maxDetailFetches = null
} = {}) {
  const probeConfig = normalizeProbeConfig(config ?? await loadBilibiliProbeConfig(rootDir, configPath));
  if (typeof maxVideoAgeDays === "number") probeConfig.max_video_age_days = maxVideoAgeDays;
  if (typeof maxDetailFetches === "number") probeConfig.max_detail_fetches = maxDetailFetches;

  const diagnostics = defaultBilibiliProbeDiagnostics();
  const candidates = [];

  const uidTasks = uidSourceDescriptors(probeConfig).map((source) => async () => {
    try {
      const items = await fetchBilibiliUpVideos(source, fetchImpl);
      diagnostics.up_candidates += items.length;
      candidates.push(...items);
    } catch (error) {
      diagnostics.source_failures += 1;
      diagnostics.last_error = `UP ${source.uid}: ${error.message}`;
    }
  });

  const keywordTasks = probeConfig.keywords.map((keyword) => async () => {
    try {
      const items = await searchBilibiliKeyword(keyword, fetchImpl);
      diagnostics.keyword_candidates += items.length;
      candidates.push(...items.map((item) => ({ ...item, matched_keywords: uniqueValues([...(item.matched_keywords ?? []), keyword]) })));
    } catch (error) {
      diagnostics.source_failures += 1;
      diagnostics.last_error = `keyword ${keyword}: ${error.message}`;
    }
  });

  await runLimited([...uidTasks, ...keywordTasks], 3);
  diagnostics.raw_candidates = candidates.length;

  const prefiltered = [];
  for (const item of candidates) {
    if (isBlacklisted(item, probeConfig)) {
      diagnostics.blacklist_filtered += 1;
      continue;
    }
    if (isGenericCollection(item, probeConfig) && !isOfficialishSource(item)) {
      diagnostics.generic_collection_filtered += 1;
      continue;
    }
    prefiltered.push(item);
  }

  const deduped = dedupeCandidates(prefiltered, diagnostics);
  const detailLimit = Math.max(0, probeConfig.max_detail_fetches);
  const detailTargets = deduped.slice(0, detailLimit);
  const enriched = [];
  for (let index = 0; index < detailTargets.length; index += 4) {
    const chunk = detailTargets.slice(index, index + 4);
    const settled = await Promise.all(chunk.map((item) => enrichProbeCandidate(item, fetchImpl, diagnostics)));
    enriched.push(...settled);
    if (index + 4 < detailTargets.length) await sleep(250);
  }

  const signals = [];
  for (const item of enriched) {
    const text = probeText(item);
    if (isBlacklisted(item, probeConfig)) {
      diagnostics.blacklist_filtered += 1;
      continue;
    }
    if (isOldVideo(item, reportDate, probeConfig.max_video_age_days)) {
      diagnostics.old_video_filtered += 1;
      continue;
    }
    if (!passesRequiredKeywords(item, probeConfig) && !isOfficialishSource(item)) {
      diagnostics.required_keyword_filtered += 1;
      continue;
    }
    if (isGenericCollection(item, probeConfig) && !isOfficialishSource(item)) {
      diagnostics.generic_collection_filtered += 1;
      continue;
    }

    const links = normalizeMediaLinks([item.link, text]);
    const steamAppId = steamAppIdFromLinks(links);
    diagnostics.links_extracted += links.length;
    if (steamAppId) diagnostics.steam_links_extracted += 1;

    const sourceKind = classifySourceKind(item, probeConfig);
    bumpSourceKindDiagnostics(sourceKind, diagnostics);
    signals.push(toMediaSignal(item, sourceKind, links, steamAppId));
  }

  signals.sort((a, b) => (b.source_quality ?? 0) - (a.source_quality ?? 0));
  diagnostics.final_candidates = signals.length;

  return { signals, diagnostics, config: probeConfig };
}

function uidSourceDescriptors(config) {
  return [
    ...config.official_uids.map((uid) => ({ uid, source_kind: "official" })),
    ...config.developer_uids.map((uid) => ({ uid, source_kind: "developer" })),
    ...config.publisher_uids.map((uid) => ({ uid, source_kind: "publisher" })),
    ...config.media_uids.map((uid) => ({ uid, source_kind: "media" })),
    ...config.trusted_creator_uids.map((uid) => ({ uid, source_kind: "trusted_creator" }))
  ];
}

async function searchBilibiliKeyword(keyword, fetchImpl) {
  const url = new URL("https://api.bilibili.com/x/web-interface/search/type");
  url.searchParams.set("search_type", "video");
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "20");
  url.searchParams.set("order", "pubdate");
  const payload = await fetchJson(url.toString(), fetchImpl);
  const result = Array.isArray(payload?.data?.result) ? payload.data.result : [];
  return result.slice(0, 20).map((item) => normalizeSearchItem(item, keyword)).filter(Boolean);
}

async function fetchBilibiliUpVideos(source, fetchImpl) {
  const url = new URL("https://api.bilibili.com/x/space/arc/search");
  url.searchParams.set("mid", source.uid);
  url.searchParams.set("ps", "20");
  url.searchParams.set("pn", "1");
  url.searchParams.set("order", "pubdate");
  const payload = await fetchJson(url.toString(), fetchImpl);
  const list = payload?.data?.list?.vlist;
  if (!Array.isArray(list)) return [];
  return list.slice(0, 20).map((item) => normalizeUpItem(item, source)).filter(Boolean);
}

function normalizeSearchItem(item, keyword) {
  const bvid = cleanText(item?.bvid ?? "");
  const title = cleanText(item?.title ?? "");
  if (!bvid || !title) return null;
  return {
    bvid,
    aid: String(item?.aid ?? ""),
    title,
    link: `https://www.bilibili.com/video/${bvid}/`,
    summary: cleanText(item?.description ?? ""),
    published_at: item?.pubdate ? toIsoFromSeconds(item.pubdate) : "",
    owner_mid: String(item?.mid ?? ""),
    owner_name: cleanText(item?.author ?? ""),
    source_kind: "keyword",
    matched_keywords: [keyword],
    stats: normalizeStats(item)
  };
}

function normalizeUpItem(item, source) {
  const bvid = cleanText(item?.bvid ?? "");
  const title = cleanText(item?.title ?? "");
  if (!bvid || !title) return null;
  return {
    bvid,
    aid: String(item?.aid ?? ""),
    title,
    link: `https://www.bilibili.com/video/${bvid}/`,
    summary: cleanText(item?.description ?? ""),
    published_at: item?.created ? toIsoFromSeconds(item.created) : "",
    owner_mid: String(item?.mid ?? source.uid),
    owner_name: cleanText(item?.author ?? ""),
    source_kind: source.source_kind,
    matched_keywords: [],
    stats: normalizeStats(item)
  };
}

async function enrichProbeCandidate(item, fetchImpl, diagnostics) {
  try {
    const detail = await fetchBilibiliDetail(item.bvid, fetchImpl);
    diagnostics.detail_success += 1;
    return {
      ...item,
      ...detail,
      summary: [item.summary, detail.description, detail.dynamic, detail.tags?.length ? `B站标签：${detail.tags.join(" / ")}` : ""]
        .filter(Boolean)
        .join(" "),
      owner_mid: detail.owner_mid || item.owner_mid,
      owner_name: detail.owner_name || item.owner_name,
      published_at: detail.published_at || item.published_at,
      stats: { ...(item.stats ?? {}), ...(detail.stats ?? {}) }
    };
  } catch (error) {
    diagnostics.detail_failed += 1;
    return item;
  }
}

async function fetchBilibiliDetail(bvid, fetchImpl) {
  const payload = await fetchJson(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, fetchImpl);
  const data = payload?.data;
  if (!data) throw new Error(`missing detail for ${bvid}`);
  const tags = Array.isArray(data.tag) ? data.tag.map((item) => cleanText(item?.tag_name ?? item?.name ?? item)).filter(Boolean) : [];
  return {
    title: cleanText(data.title ?? ""),
    description: cleanText(data.desc ?? ""),
    dynamic: cleanText(data.dynamic ?? ""),
    owner_mid: String(data.owner?.mid ?? ""),
    owner_name: cleanText(data.owner?.name ?? ""),
    published_at: data.pubdate ? toIsoFromSeconds(data.pubdate) : "",
    tags,
    stats: normalizeStats(data.stat ?? {})
  };
}

function toMediaSignal(item, sourceKind, links, steamAppId) {
  const sourceLabel = sourceLabelForKind(sourceKind);
  const linkSummary = links.length ? `结构化链接：${links.join(" ")}` : "";
  const steamSummary = steamAppId ? `已提取 Steam AppID：${steamAppId}` : "";
  const ownerSummary = item.owner_name ? `UP主：${item.owner_name}` : "";
  const statsSummary = formatStats(item.stats);
  return {
    title: item.title,
    link: item.link,
    summary: [item.summary, ownerSummary, statsSummary, linkSummary, steamSummary].filter(Boolean).join(" "),
    published_at: item.published_at,
    bvid: item.bvid,
    source: sourceLabel,
    source_focus: ["china", "bilibili", "creator", "domestic_sourcing"],
    source_quality: qualityForKind(sourceKind, item),
    bilibili_probe: {
      bvid: item.bvid,
      aid: item.aid,
      owner_mid: item.owner_mid,
      owner_name: item.owner_name,
      source_kind: sourceKind,
      matched_keywords: item.matched_keywords ?? [],
      extracted_links: links,
      steam_app_id: steamAppId,
      stats: item.stats ?? {}
    }
  };
}

function classifySourceKind(item, config) {
  const uid = String(item.owner_mid ?? "");
  const text = probeText(item);
  if (config.official_uids.includes(uid) || /官方|官方号|官方PV|官方\s*PV/i.test(text)) return "official";
  if (config.developer_uids.includes(uid) || /开发者|制作组|工作室|studio|games|开发日志/i.test(text)) return "developer";
  if (config.publisher_uids.includes(uid) || /发行商|publisher/i.test(text)) return "publisher";
  if (config.media_uids.includes(uid)) return "media";
  if (config.trusted_creator_uids.includes(uid)) return "trusted_creator";
  return item.source_kind ?? "keyword";
}

function bumpSourceKindDiagnostics(kind, diagnostics) {
  if (kind === "official") diagnostics.official_source_hits += 1;
  if (kind === "developer") diagnostics.developer_source_hits += 1;
  if (kind === "publisher") diagnostics.publisher_source_hits += 1;
  if (kind === "media") diagnostics.media_source_hits += 1;
  if (kind === "trusted_creator") diagnostics.trusted_creator_hits += 1;
}

function sourceLabelForKind(kind) {
  if (kind === "official") return "B站探头-官方源";
  if (kind === "developer") return "B站探头-开发者源";
  if (kind === "publisher") return "B站探头-发行商源";
  if (kind === "media") return "B站探头-媒体源";
  if (kind === "trusted_creator") return "B站探头-可信UP";
  return "B站探头-关键词";
}

function qualityForKind(kind, item) {
  const base = {
    official: 20,
    developer: 19,
    publisher: 18,
    media: 15,
    trusted_creator: 14,
    keyword: 13
  }[kind] ?? 12;
  const text = probeText(item);
  let bonus = 0;
  if (/store\.steampowered\.com\/app\/\d+|steam商店页|愿望单/i.test(text)) bonus += 4;
  if (/demo|试玩|测试|实机|pv|开发日志|首曝|公布/i.test(text)) bonus += 3;
  return base + bonus;
}

function dedupeCandidates(items, diagnostics) {
  const slots = new Map();
  for (const item of items) {
    const key = candidatePrimaryKey(item);
    if (!key) continue;
    const existing = slots.get(key);
    if (!existing || sourcePriority(item) > sourcePriority(existing)) {
      if (existing) diagnostics.duplicate_filtered += 1;
      slots.set(key, item);
    } else {
      diagnostics.duplicate_filtered += 1;
    }
  }
  return [...slots.values()];
}

function candidatePrimaryKey(item) {
  const text = probeText(item);
  const links = normalizeMediaLinks([item.link, text]);
  const appId = steamAppIdFromLinks(links);
  if (appId) return `steam:${appId}`;
  if (item.bvid) return `bvid:${normalizeText(item.bvid)}`;
  const urlKey = normalizeUrl(item.link);
  if (urlKey) return `url:${urlKey}`;
  return `title:${normalizeText(item.title).slice(0, 80)}`;
}

function sourcePriority(item) {
  if (item.source_kind === "keyword" && isOfficialishSource(item)) return 95;
  const explicitPriority = {
    official: 100,
    developer: 90,
    publisher: 85,
    media: 70,
    trusted_creator: 60,
    keyword: 40
  }[item.source_kind];
  if (typeof explicitPriority === "number") return explicitPriority;
  if (isOfficialishSource(item)) return 95;
  return 40;
}

function isBlacklisted(item, config) {
  const text = probeText(item);
  const uid = String(item.owner_mid ?? "");
  if (config.blacklist_uids.includes(uid)) return true;
  if (config.blacklist_bvids.includes(String(item.bvid ?? ""))) return true;
  return config.blacklist_keywords.some((keyword) => textIncludes(text, keyword));
}

function passesRequiredKeywords(item, config) {
  if (!config.required_keywords.length) return true;
  const text = probeText(item);
  return config.required_keywords.some((keyword) => textIncludes(text, keyword));
}

function isGenericCollection(item, config) {
  const text = `${item.title ?? ""} ${item.summary ?? ""}`;
  if (config.generic_collection_patterns.some((keyword) => textIncludes(text, keyword))) return true;
  return /(?:\d+\s*款|十款|几款).{0,12}(?:国产|独立|Steam|游戏)/i.test(text);
}

function isOfficialishSource(item) {
  return ["official", "developer", "publisher"].includes(item.source_kind)
    || /官方|开发者|制作组|工作室|发行商|studio|games/i.test(probeText(item));
}

function isOldVideo(item, reportDate, maxAgeDays) {
  const timestamp = Date.parse(item.published_at ?? "");
  if (!Number.isFinite(timestamp)) return false;
  const reportTimestamp = Date.parse(`${reportDate}T00:00:00+08:00`);
  if (!Number.isFinite(reportTimestamp)) return false;
  return (reportTimestamp - timestamp) / 86400000 > maxAgeDays;
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: defaultHeaders });
  if (!response?.ok) throw new Error(`${response?.status ?? "fetch"} ${response?.statusText ?? "failed"}`);
  return await response.json();
}

async function runLimited(tasks, concurrency) {
  const executing = new Set();
  for (const task of tasks) {
    const promise = Promise.resolve().then(task).finally(() => executing.delete(promise));
    executing.add(promise);
    if (executing.size >= concurrency) await Promise.race(executing);
  }
  await Promise.all(executing);
}

function normalizeProbeConfig(value) {
  const config = value && typeof value === "object" ? value : {};
  return {
    schema_version: Number(config.schema_version ?? 1),
    rule_version: String(config.rule_version ?? "sourcing-rules-v6.4-bili-probe"),
    max_video_age_days: numberInRange(config.max_video_age_days, 120, 14, 365),
    max_detail_fetches: numberInRange(config.max_detail_fetches, 80, 0, 200),
    official_uids: normalizeStringArray(config.official_uids),
    developer_uids: normalizeStringArray(config.developer_uids),
    publisher_uids: normalizeStringArray(config.publisher_uids),
    media_uids: normalizeStringArray(config.media_uids),
    trusted_creator_uids: normalizeStringArray(config.trusted_creator_uids),
    keywords: normalizeStringArray(config.keywords),
    required_keywords: normalizeStringArray(config.required_keywords),
    blacklist_uids: normalizeStringArray(config.blacklist_uids),
    blacklist_bvids: normalizeStringArray(config.blacklist_bvids),
    blacklist_keywords: normalizeStringArray(config.blacklist_keywords),
    generic_collection_patterns: normalizeStringArray(config.generic_collection_patterns)
  };
}

function numberInRange(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function normalizeStringArray(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean))];
}

function normalizeStats(value) {
  return {
    view: Number(value?.view ?? value?.play ?? value?.play_count ?? 0) || 0,
    danmaku: Number(value?.danmaku ?? value?.video_review ?? 0) || 0,
    reply: Number(value?.reply ?? value?.review ?? 0) || 0,
    favorite: Number(value?.favorite ?? 0) || 0,
    coin: Number(value?.coin ?? 0) || 0,
    share: Number(value?.share ?? 0) || 0,
    like: Number(value?.like ?? 0) || 0
  };
}

function formatStats(stats) {
  if (!stats) return "";
  const parts = [];
  if (stats.view) parts.push(`播放 ${stats.view}`);
  if (stats.like) parts.push(`点赞 ${stats.like}`);
  if (stats.favorite) parts.push(`收藏 ${stats.favorite}`);
  return parts.length ? `B站数据：${parts.join(" / ")}` : "";
}

function probeText(item) {
  return `${item.title ?? ""} ${item.summary ?? ""} ${item.owner_name ?? ""} ${(item.matched_keywords ?? []).join(" ")}`;
}

function textIncludes(text, keyword) {
  return normalizeText(text).includes(normalizeText(keyword));
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replace(/\s+/g, " ")
    .trim();
}

function toIsoFromSeconds(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Date(number * 1000).toISOString() : "";
}

function normalizeText(value) {
  return String(value ?? "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return String(value ?? "").trim().replace(/\/$/, "").toLowerCase();
  }
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
