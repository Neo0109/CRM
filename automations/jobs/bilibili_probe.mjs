import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractBilibiliEvidence } from "./bilibili_evidence.mjs";
import {
  classifyHttpResponse,
  classifySourceError,
  httpStatusError,
  parseMismatchError
} from "./online_daily_v4_network.mjs";

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
    steam_links_detected: 0,
    blacklist_filtered: 0,
    old_video_filtered: 0,
    generic_collection_filtered: 0,
    required_keyword_filtered: 0,
    duplicate_filtered: 0,
    final_candidates: 0,
    request_retries: 0,
    rate_limit_retries: 0,
    fallback_queries: 0,
    source_health: {},
    incidents: []
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
  maxDetailFetches = null,
  sleepImpl = sleep
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Bilibili probe requires a fetch implementation.");

  const probeConfig = normalizeProbeConfig(config ?? await loadBilibiliProbeConfig(rootDir, configPath));
  if (typeof maxVideoAgeDays === "number") probeConfig.max_video_age_days = maxVideoAgeDays;
  if (typeof maxDetailFetches === "number") probeConfig.max_detail_fetches = maxDetailFetches;

  const diagnostics = defaultBilibiliProbeDiagnostics();
  const candidates = [];
  const requestOptions = {
    diagnostics,
    retryDelaysMs: probeConfig.retry_delays_ms,
    sleepImpl
  };

  const tasks = [
    ...uidSourceDescriptors(probeConfig).map((source) => async () => {
      const sourceKey = `up:${source.uid}`;
      try {
        const items = await fetchBilibiliUpVideos(source, fetchImpl, requestOptions);
        diagnostics.up_candidates += items.length;
        candidates.push(...items);
        recordProbeSourceResult(diagnostics, sourceKey, { ok: true, candidates: items.length });
      } catch (error) {
        diagnostics.source_failures += 1;
        diagnostics.last_error = `UP ${source.uid}: ${error.message}`;
        recordProbeSourceResult(diagnostics, sourceKey, { ok: false, error });
      }
    }),
    ...probeConfig.keywords.map((keyword) => async () => {
      const sourceKey = `keyword:${keyword}`;
      try {
        let items;
        let fallbackUsed = false;
        try {
          items = await searchBilibiliKeyword(keyword, fetchImpl, requestOptions);
        } catch (primaryError) {
          const fallbackKeyword = probeConfig.keyword_fallbacks[keyword];
          if (!fallbackKeyword) throw primaryError;
          diagnostics.fallback_queries += 1;
          fallbackUsed = true;
          items = await searchBilibiliKeyword(fallbackKeyword, fetchImpl, requestOptions);
        }
        diagnostics.keyword_candidates += items.length;
        candidates.push(...items.map((item) => ({
          ...item,
          matched_keywords: uniqueValues([...(item.matched_keywords ?? []), keyword])
        })));
        recordProbeSourceResult(diagnostics, sourceKey, { ok: true, candidates: items.length, fallbackUsed });
      } catch (error) {
        diagnostics.source_failures += 1;
        diagnostics.last_error = `keyword ${keyword}: ${error.message}`;
        recordProbeSourceResult(diagnostics, sourceKey, { ok: false, error });
      }
    })
  ];

  await runLimited(tasks, probeConfig.request_concurrency, probeConfig.request_batch_delay_ms, sleepImpl);
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

  const detailTargets = dedupeCandidates(prefiltered, diagnostics)
    .slice(0, Math.max(0, probeConfig.max_detail_fetches));
  const enriched = [];
  for (let index = 0; index < detailTargets.length; index += probeConfig.request_concurrency) {
    const chunk = detailTargets.slice(index, index + probeConfig.request_concurrency);
    enriched.push(...await Promise.all(chunk.map((item) => enrichProbeCandidate(item, fetchImpl, diagnostics, requestOptions))));
    if (index + probeConfig.request_concurrency < detailTargets.length) await sleepImpl(probeConfig.request_batch_delay_ms);
  }

  const signals = [];
  for (const item of enriched) {
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

    const evidence = extractBilibiliEvidence(item);
    const links = evidence.urls;
    const steamAppId = evidence.steam_app_id;
    diagnostics.links_extracted += links.length;
    if (steamAppId) {
      diagnostics.steam_links_extracted += 1;
      diagnostics.steam_links_detected += 1;
    }

    const sourceKind = classifySourceKind(item, probeConfig);
    bumpSourceKindDiagnostics(sourceKind, diagnostics);
    signals.push(toMediaSignal({ ...item, bilibili_evidence: evidence }, sourceKind, links, steamAppId));
  }

  signals.sort((a, b) => (b.source_quality ?? 0) - (a.source_quality ?? 0));
  diagnostics.final_candidates = signals.length;

  return { signals, diagnostics, config: probeConfig };
}

function normalizeProbeConfig(value) {
  const config = value && typeof value === "object" ? value : {};
  return {
    schema_version: Number(config.schema_version ?? 1),
    rule_version: String(config.rule_version ?? "sourcing-rules-v6.6-evidence-integrity"),
    max_video_age_days: Number(config.max_video_age_days ?? 120),
    max_detail_fetches: Number(config.max_detail_fetches ?? 80),
    request_concurrency: boundedInteger(config.request_concurrency, 2, 1, 4),
    request_batch_delay_ms: boundedInteger(config.request_batch_delay_ms, 350, 0, 5000),
    retry_delays_ms: normalizeNumberArray(config.retry_delays_ms, [400, 1000]),
    official_uids: normalizeStringArray(config.official_uids),
    developer_uids: normalizeStringArray(config.developer_uids),
    publisher_uids: normalizeStringArray(config.publisher_uids),
    media_uids: normalizeStringArray(config.media_uids),
    trusted_creator_uids: normalizeStringArray(config.trusted_creator_uids),
    keywords: normalizeStringArray(config.keywords),
    keyword_fallbacks: normalizeStringMap(config.keyword_fallbacks),
    required_keywords: normalizeStringArray(config.required_keywords),
    blacklist_uids: normalizeStringArray(config.blacklist_uids),
    blacklist_bvids: normalizeStringArray(config.blacklist_bvids).map((item) => item.toLowerCase()),
    blacklist_keywords: normalizeStringArray(config.blacklist_keywords),
    generic_collection_patterns: normalizeStringArray(config.generic_collection_patterns)
  };
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

async function searchBilibiliKeyword(keyword, fetchImpl, requestOptions) {
  const url = new URL("https://api.bilibili.com/x/web-interface/search/type");
  url.searchParams.set("search_type", "video");
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "20");
  url.searchParams.set("order", "pubdate");
  const payload = await fetchJson(url.toString(), fetchImpl, requestOptions);
  const result = Array.isArray(payload?.data?.result) ? payload.data.result : [];
  return result.slice(0, 20).map((item) => normalizeSearchItem(item, keyword)).filter(Boolean);
}

async function fetchBilibiliUpVideos(source, fetchImpl, requestOptions) {
  const url = new URL("https://api.bilibili.com/x/space/arc/search");
  url.searchParams.set("mid", source.uid);
  url.searchParams.set("ps", "20");
  url.searchParams.set("pn", "1");
  url.searchParams.set("order", "pubdate");
  const payload = await fetchJson(url.toString(), fetchImpl, requestOptions);
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

async function enrichProbeCandidate(item, fetchImpl, diagnostics, requestOptions) {
  try {
    const detail = await fetchBilibiliDetail(item.bvid, fetchImpl, requestOptions);
    diagnostics.detail_success += 1;
    return {
      ...item,
      ...detail,
      title: detail.title || item.title,
      summary: [item.summary, detail.summary, detail.owner_name ? `UP主：${detail.owner_name}` : ""]
        .filter(Boolean)
        .join(" "),
      published_at: detail.published_at || item.published_at,
      owner_mid: detail.owner_mid || item.owner_mid,
      owner_name: detail.owner_name || item.owner_name,
      tags: uniqueValues([...(item.tags ?? []), ...(detail.tags ?? [])])
    };
  } catch (error) {
    diagnostics.detail_failed += 1;
    diagnostics.last_error = `detail ${item.bvid}: ${error.message}`;
    return item;
  }
}

async function fetchBilibiliDetail(bvid, fetchImpl, requestOptions) {
  const payload = await fetchJson(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, fetchImpl, requestOptions);
  const data = payload?.data;
  if (!data) return {};
  return {
    bvid: cleanText(data.bvid ?? bvid),
    title: cleanText(data.title ?? ""),
    summary: cleanText([data.desc, data.dynamic].filter(Boolean).join(" ")),
    owner_mid: String(data.owner?.mid ?? ""),
    owner_name: cleanText(data.owner?.name ?? ""),
    published_at: data.pubdate ? toIsoFromSeconds(data.pubdate) : "",
    stats: normalizeStats(data.stat ?? {}),
    tags: Array.isArray(data.tag) ? data.tag.map((item) => cleanText(item?.tag_name ?? "")).filter(Boolean) : []
  };
}

function dedupeCandidates(items, diagnostics) {
  const sorted = [...items].sort((a, b) => sourcePriority(b) - sourcePriority(a));
  const seen = new Set();
  const out = [];
  for (const item of sorted) {
    const keys = dedupeKeys(item);
    if (keys.some((key) => seen.has(key))) {
      diagnostics.duplicate_filtered += 1;
      continue;
    }
    for (const key of keys) seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupeKeys(item) {
  const text = probeText(item);
  const evidence = extractBilibiliEvidence(item);
  const steamAppId = evidence.steam_app_id;
  return uniqueValues([
    item.bvid ? `bvid:${normalizeText(item.bvid)}` : "",
    item.link ? `link:${normalizeUrl(item.link)}` : "",
    steamAppId ? `steam:${steamAppId}` : "",
    item.title ? `title:${normalizeText(item.title).slice(0, 80)}` : ""
  ].filter(Boolean));
}

function sourcePriority(item) {
  const kind = item.source_kind;
  if (kind === "official") return 1000;
  if (kind === "developer") return 900;
  if (kind === "publisher") return 850;
  if (kind === "media") return 650;
  if (kind === "trusted_creator") return 500;
  return 100;
}

function isBlacklisted(item, config) {
  const bvid = normalizeText(item.bvid);
  if (bvid && config.blacklist_bvids.includes(bvid)) return true;
  if (config.blacklist_uids.includes(String(item.owner_mid ?? ""))) return true;
  const text = probeText(item);
  return config.blacklist_keywords.some((keyword) => keyword && text.includes(keyword));
}

function isGenericCollection(item, config) {
  const text = [item.title, item.summary].filter(Boolean).join(" ");
  return config.generic_collection_patterns.some((pattern) => pattern && text.includes(pattern));
}

function passesRequiredKeywords(item, config) {
  if (!config.required_keywords.length) return true;
  const text = probeText(item);
  return config.required_keywords.some((keyword) => keyword && text.includes(keyword));
}

function isOldVideo(item, reportDate, maxAgeDays) {
  const publishedAt = String(item.published_at ?? "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(publishedAt)) return false;
  const published = Date.parse(`${publishedAt.slice(0, 10)}T00:00:00+08:00`);
  const report = Date.parse(`${reportDate}T00:00:00+08:00`);
  if (Number.isNaN(published) || Number.isNaN(report)) return false;
  return Math.floor((report - published) / 86400000) > maxAgeDays;
}

function classifySourceKind(item, config) {
  if (config.official_uids.includes(String(item.owner_mid ?? "")) || item.source_kind === "official") return "official";
  if (config.developer_uids.includes(String(item.owner_mid ?? "")) || item.source_kind === "developer") return "developer";
  if (config.publisher_uids.includes(String(item.owner_mid ?? "")) || item.source_kind === "publisher") return "publisher";
  if (config.media_uids.includes(String(item.owner_mid ?? "")) || item.source_kind === "media") return "media";
  if (config.trusted_creator_uids.includes(String(item.owner_mid ?? "")) || item.source_kind === "trusted_creator") return "trusted_creator";
  return "keyword";
}

function isOfficialishSource(item) {
  return ["official", "developer", "publisher"].includes(item.source_kind);
}

function bumpSourceKindDiagnostics(sourceKind, diagnostics) {
  if (sourceKind === "official") diagnostics.official_source_hits += 1;
  if (sourceKind === "developer") diagnostics.developer_source_hits += 1;
  if (sourceKind === "publisher") diagnostics.publisher_source_hits += 1;
  if (sourceKind === "media") diagnostics.media_source_hits += 1;
  if (sourceKind === "trusted_creator") diagnostics.trusted_creator_hits += 1;
}

function toMediaSignal(item, sourceKind, links, steamAppId) {
  const sourceLabel = {
    official: "B站探头-官方源",
    developer: "B站探头-开发者源",
    publisher: "B站探头-发行商源",
    media: "B站探头-媒体源",
    trusted_creator: "B站探头-可信UP",
    keyword: "B站探头-关键词"
  }[sourceKind] ?? "B站探头";
  return {
    title: item.title,
    summary: item.summary,
    source: sourceLabel,
    link: item.link,
    bvid: item.bvid,
    published_at: item.published_at,
    source_focus: ["china", "domestic_sourcing", "bilibili"],
    source_quality: sourcePriority({ source_kind: sourceKind }),
    bilibili_evidence: item.bilibili_evidence ?? extractBilibiliEvidence(item),
    bilibili_probe: {
      source_kind: sourceKind,
      owner_mid: item.owner_mid,
      owner_name: item.owner_name,
      matched_keywords: item.matched_keywords ?? [],
      extracted_links: links,
      steam_app_id: steamAppId,
      stats: item.stats ?? {}
    }
  };
}

async function fetchJson(url, fetchImpl, options = {}) {
  const retryDelaysMs = Array.isArray(options.retryDelaysMs) ? options.retryDelaysMs : [];
  const sleepImpl = options.sleepImpl ?? sleep;
  for (let attempt = 0; ; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, { headers: defaultHeaders });
    } catch (error) {
      if (attempt >= retryDelaysMs.length) throw error;
      bumpDiagnostic(options.diagnostics, "request_retries");
      await sleepImpl(retryDelaysMs[attempt]);
      continue;
    }
    if (response?.ok) {
      if (typeof response.text === "function") {
        const text = await response.text();
        const classification = classifyHttpResponse(response, text);
        if (classification.outcome !== "ok") {
          const error = new Error("Bilibili Cloudflare challenge response");
          error.sourceOutcome = classification.outcome;
          error.provider = classification.provider;
          error.status = Number(response.status) || 200;
          throw error;
        }
        try {
          return JSON.parse(text);
        } catch (error) {
          throw parseMismatchError(`Bilibili JSON response structure mismatch: ${error.message}`);
        }
      }
      try {
        return await response.json();
      } catch (error) {
        throw parseMismatchError(`Bilibili JSON response structure mismatch: ${error.message}`);
      }
    }
    const status = Number(response?.status ?? 0);
    const retryable = status === 412 || status === 429 || status >= 500;
    if (retryable && attempt < retryDelaysMs.length) {
      bumpDiagnostic(options.diagnostics, "request_retries");
      if (status === 412 || status === 429) bumpDiagnostic(options.diagnostics, "rate_limit_retries");
      await sleepImpl(retryDelaysMs[attempt]);
      continue;
    }
    throw httpStatusError(response);
  }
}

function recordProbeSourceResult(diagnostics, source, result) {
  diagnostics.source_health ??= {};
  diagnostics.source_health[source] ??= {
    attempts: 0,
    successes: 0,
    failures: 0,
    candidates: 0,
    fallback_uses: 0,
    last_error: null,
    last_outcome: null,
    outcome_counts: {}
  };
  const entry = diagnostics.source_health[source];
  entry.attempts += 1;
  entry.candidates += Math.max(0, Number(result.candidates ?? 0) || 0);
  const outcome = result.ok ? "ok" : classifySourceError(result.error);
  entry.last_outcome = outcome;
  entry.outcome_counts[outcome] = (entry.outcome_counts[outcome] ?? 0) + 1;
  if (result.ok) {
    entry.successes += 1;
    entry.last_error = null;
  } else {
    entry.failures += 1;
    entry.last_error = String(result.error?.message ?? result.error ?? "unknown source failure");
    diagnostics.incidents ??= [];
    diagnostics.incidents.push({
      source_id: `bilibili:${source.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 120)}`,
      family: "bilibili",
      outcome,
      http_status: Number.isFinite(Number(result.error?.status)) ? Number(result.error.status) : null,
      provider: result.error?.provider === "cloudflare" ? "cloudflare" : null,
      fallback_used: Boolean(result.fallbackUsed)
    });
    if (diagnostics.incidents.length > 100) diagnostics.incidents.splice(0, diagnostics.incidents.length - 100);
  }
  if (result.fallbackUsed) entry.fallback_uses += 1;
}

function bumpDiagnostic(diagnostics, key) {
  if (!diagnostics) return;
  diagnostics[key] = (diagnostics[key] ?? 0) + 1;
}

function normalizeStats(item) {
  return {
    view: Number(item?.view ?? item?.play ?? 0) || 0,
    like: Number(item?.like ?? 0) || 0,
    favorite: Number(item?.favorite ?? 0) || 0,
    coin: Number(item?.coin ?? 0) || 0,
    share: Number(item?.share ?? 0) || 0,
    danmaku: Number(item?.danmaku ?? 0) || 0
  };
}

async function runLimited(tasks, limit, delayMs = 0, sleepImpl = sleep) {
  const out = [];
  for (let index = 0; index < tasks.length; index += limit) {
    out.push(...await Promise.all(tasks.slice(index, index + limit).map((task) => task())));
    if (index + limit < tasks.length && delayMs > 0) await sleepImpl(delayMs);
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function probeText(item) {
  return [item.title, item.summary, item.owner_name, ...(item.tags ?? []), ...(item.matched_keywords ?? [])]
    .filter(Boolean)
    .join(" ");
}

function cleanText(value) {
  return decodeHtml(String(value ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ");
}

function toIsoFromSeconds(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : "";
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? uniqueValues(value.map((item) => String(item ?? "").trim()).filter(Boolean)) : [];
}

function normalizeStringMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [String(key).trim(), String(item ?? "").trim()])
    .filter(([key, item]) => key && item));
}

function normalizeNumberArray(value, fallback) {
  const values = Array.isArray(value) ? value : fallback;
  return values
    .map((item) => Math.round(Number(item)))
    .filter((item) => Number.isFinite(item) && item >= 0 && item <= 5000)
    .slice(0, 4);
}

function boundedInteger(value, fallback, min, max) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeUrl(value) {
  return String(value ?? "").trim().replace(/\/$/, "").toLowerCase();
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
