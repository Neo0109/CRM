import { readFile } from "node:fs/promises";
import path from "node:path";
import { isBilibiliSignal, mediaRegion, normalizeDisplayText, selectDiverseMediaSignals } from "./online_daily_v4_dedupe.mjs";
import { assertMediaSourceContract, parseFeedItems, readXmlTag, scoreMediaSignal } from "./online_daily_v4_media_sources.mjs";
import { classifySourceError, fetchText } from "./online_daily_v4_network.mjs";
import { cleanExtractedText } from "./online_daily_v4_source_utils.mjs";

const HOUR = 3600000;
export const RADAR_NETWORK_BUDGET_MS = 90000;

export function radarUrlKey(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return "";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (/^(localhost|.*\.localhost|.*\.local|.*\.internal|\[.*\]|[\d.]+)$/.test(host)) return "";
    const bvid = host === "bilibili.com" && url.pathname.match(/^\/video\/(BV[a-z0-9]+)/i)?.[1];
    if (bvid) return "bilibili.com/video/" + bvid;
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|spm.*|from|ref|referrer|source)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return host + url.pathname.replace(/\/+$/, "") + url.search;
  } catch { return ""; }
}

function titleKey(value) {
  return normalizeDisplayText(value ?? "").normalize("NFKC").toLowerCase().replace(/[\p{P}\p{Z}\s]+/gu, "");
}

export function isRadarArticleUrl(value) {
  if (!radarUrlKey(value)) return false;
  const url = new URL(value);
  if (url.pathname === "/" || !url.pathname) return false;
  if (/\.(?:jpg|jpeg|png|gif|svg|webp|mp4|pdf|zip)$/i.test(url.pathname)) return false;
  if (/^\/(?:column|category|categories|tag|tags|author|search|discover|groups?|topics?|feed|rss)(?:\/|$)/i.test(url.pathname)) return false;
  return !/^\/(?:news|articles?|games|business)\/?$/i.test(url.pathname);
}

function publicationTimestamp(value) {
  const text = String(value ?? "").trim();
  if (!text) return NaN;
  // Date-only claims have a calendar-day granularity, never the collection time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return Date.parse(text + "T00:00:00+08:00");
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(text)) return Date.parse(text.replace(" ", "T") + "+08:00");
  return Date.parse(text);
}

function videoEventKey(item) {
  if (!isBilibiliSignal(item)) return "";
  const title = normalizeDisplayText(item.title ?? "");
  const product = title.match(/[《「『]([^》」』]+)[》」』]/)?.[1];
  if (!product) return "";
  const event = /公开测试|封闭测试|公测|内测|playtest/i.test(title) ? "test"
    : /试玩|demo/i.test(title) ? "demo"
    : /实机|gameplay/i.test(title) ? "gameplay"
    : /首曝|预告|\bpv\b|trailer/i.test(title) ? "trailer"
    : /发售|上线|release/i.test(title) ? "release" : "";
  if (!event) return "";
  const venue = title.match(/科隆|gamescom|东京电玩展|\btgs\b|夏日游戏节|summer game fest|新品节|next fest/i)?.[0]?.toLowerCase()
    .replace("gamescom", "科隆").replace("tgs", "东京电玩展").replace("summer game fest", "夏日游戏节").replace("next fest", "新品节") ?? "";
  const year = title.match(/\b20\d{2}\b/)?.[0] ?? "";
  const part = title.match(/第[一二三四五六七八九十\d]+[章节部弹]|(?:版本|version|ver\.?|v)\s*\d+(?:\.\d+)*/i)?.[0] ?? "";
  const timestamp = publicationTimestamp(item.published_at ?? item.captured_at);
  const day = Number.isFinite(timestamp) ? new Date(timestamp + 8 * HOUR).toISOString().slice(0, 10) : "";
  // Explicit venue + year identifies an event across upload dates. Otherwise only
  // combine the same kind of update on the same publication day, preserving parts.
  return [titleKey(product), event, venue, venue && year ? year : day, titleKey(part)].join("|");
}

function previousHistory(history, reportDate) {
  const today = Date.parse(reportDate + "T00:00:00+08:00");
  return history.filter(report => {
    const day = Date.parse(String(report.report_date) + "T00:00:00+08:00");
    const age = (today - day) / (24 * HOUR);
    return age >= 1 && age <= 7;
  }).flatMap(report => Array.isArray(report.items) ? report.items : []);
}

export function curateRadarSignals(items, { reportDate, capturedAt, history = [], diversity, diagnostics = {} }) {
  const result = { raw: items.length, unknown_date: 0, stale: 0, future_date: 0, non_article: 0,
    low_quality: 0, duplicate_history: 0, duplicate_current: 0, duplicate_event: 0, ...diagnostics };
  const historyItems = previousHistory(history, reportDate);
  const priorUrls = new Set(historyItems.map(x => radarUrlKey(x.link)).filter(Boolean));
  const priorTitles = new Set(historyItems.map(x => titleKey(x.title)).filter(Boolean));
  const priorEvents = new Set(historyItems.map(videoEventKey).filter(Boolean));
  const now = Date.parse(capturedAt);
  if (!Number.isFinite(now)) throw new Error("Radar requires a valid capturedAt timestamp");
  const eligible = [];
  for (const original of items) {
    const item = { ...original };
    if (!isRadarArticleUrl(item.link)) { result.non_article++; continue; }
    const published = publicationTimestamp(item.published_at);
    if (!Number.isFinite(published)) { result.unknown_date++; continue; }
    const age = now - published;
    if (age < 0) { result.future_date++; continue; }
    if (age > 72 * HOUR) { result.stale++; continue; }
    const text = String(item.title ?? "");
    if (/\b(?:walkthrough|best settings|discount|deals|cosplay|quiz)\b|攻略|折扣|促销|史低|壁纸|图赏|周末游戏视频集锦/i.test(text)) {
      result.low_quality++; continue;
    }
    item.score = Number.isFinite(item.score) ? item.score : scoreMediaSignal(item);
    if (item.score < 12 || !titleKey(item.title)) { result.low_quality++; continue; }
    if (priorUrls.has(radarUrlKey(item.link)) || priorTitles.has(titleKey(item.title)) ||
        (videoEventKey(item) && priorEvents.has(videoEventKey(item)))) {
      result.duplicate_history++; continue;
    }
    eligible.push({ item, recent: age <= 24 * HOUR, published });
  }
  eligible.sort((a, b) => Number(b.recent) - Number(a.recent) || b.item.score - a.item.score ||
    b.published - a.published || radarUrlKey(a.item.link).localeCompare(radarUrlKey(b.item.link)));
  const urls = new Set(); const titles = new Set(); const events = new Set(); const unique = [];
  for (const { item } of eligible) {
    const url = radarUrlKey(item.link); const title = titleKey(item.title); const event = videoEventKey(item);
    if (urls.has(url) || titles.has(title)) { result.duplicate_current++; continue; }
    if (event && events.has(event)) { result.duplicate_event++; continue; }
    urls.add(url); titles.add(title); if (event) events.add(event); unique.push(item);
  }
  const selected = new Set(selectDiverseMediaSignals(unique, diversity?.limit, diversity));
  const signals = unique.filter(item => selected.has(item));
  result.eligible = unique.length;
  result.selected = signals.length;
  result.regions = { china: signals.filter(x => mediaRegion(x) === "china").length, global: signals.filter(x => mediaRegion(x) === "global").length };
  result.sources = Object.fromEntries([...new Set(signals.map(x => x.source))].map(source => [source, signals.filter(x => x.source === source).length]));
  return { signals, diagnostics: result };
}

function attributes(tag) {
  return Object.fromEntries([...String(tag).matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map(match => [match[1].toLowerCase(), cleanExtractedText(match[2] ?? match[3])]));
}

export function readRadarArticleMetadata(html) {
  const metadata = new Map();
  for (const tag of String(html).matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(tag[0]);
    metadata.set(String(attrs.property ?? attrs.name ?? attrs.itemprop ?? "").toLowerCase(), attrs.content ?? "");
  }
  let article = {};
  const visit = value => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    const types = [].concat(value["@type"] ?? []);
    if (types.some(type => /^(NewsArticle|Article|BlogPosting|ReportageNewsArticle|TechArticle)$/.test(type)) && !article.datePublished) article = value;
    if (value["@graph"]) visit(value["@graph"]);
    if (value.mainEntity) visit(value.mainEntity);
  };
  for (const script of String(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attributes(script[1]).type !== "application/ld+json") continue;
    try { visit(JSON.parse(script[2])); } catch { /* Broken structured data is not a date. */ }
  }
  const chuappTime = [...String(html).matchAll(/<span\b[^>]*>/gi)].map(x => attributes(x[0]))
    .find(attrs => /\bfriendly_time\b/.test(attrs.class ?? "") && /^\d{10}$/.test(attrs["data-time"] ?? ""));
  const publisherTime = chuappTime ? new Date(Number(chuappTime["data-time"]) * 1000).toISOString() : "";
  const date = article.datePublished || metadata.get("article:published_time") || metadata.get("datepublished") ||
    metadata.get("pubdate") || metadata.get("publishdate") || metadata.get("publish_time") ||
    metadata.get("date") || metadata.get("dc.date") ||
    [...String(html).matchAll(/<time\b[^>]*>/gi)].map(x => attributes(x[0]).datetime).find(Boolean) || publisherTime || "";
  const title = article.headline || metadata.get("og:title") || "";
  const summary = metadata.get("og:description") || metadata.get("description") || article.description || "";
  return { title: cleanExtractedText(title), summary: cleanExtractedText(summary), published_at: String(date) };
}

export function parseChuappRadarItems(html, source = { name: "触乐", quality: 11, focus: ["china", "culture"] }) {
  const items = []; const seen = new Set();
  for (const match of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url; try { url = new URL(match[1], "https://www.chuapp.com/"); } catch { continue; }
    if (url.hostname !== "www.chuapp.com" && url.hostname !== "chuapp.com") continue;
    if (!/^\/article\/\d+\.html$/.test(url.pathname)) continue;
    const title = cleanExtractedText(match[2]);
    if (title.length < 6 || title.length > 180 || seen.has(url.pathname)) continue;
    seen.add(url.pathname);
    items.push({ title, link: url.href, summary: "", published_at: "", source: source.name, source_quality: source.quality, source_focus: source.focus });
    if (items.length === 40) break;
  }
  return items;
}

export function parseRadarFeedItems(xml, source) {
  assertMediaSourceContract(xml, { ...source, type: "feed" });
  // The shared Lead parser remains capped at 20; Radar can read 60 feed entries.
  return String(xml).split(/<(item|entry)\b/i).slice(1).reduce((items, block, i, blocks) => {
    if (i % 2 === 0 && items.length < 60) {
      for (const item of parseFeedItems("<" + block + blocks[i + 1], source)) {
        item.published_at ||= cleanExtractedText(readXmlTag(blocks[i + 1], "dc:date"));
        items.push(item);
      }
    }
    return items;
  }, []);
}

export async function loadRadarHistory({ rootDir, reportDate, readFileImpl = readFile }) {
  const reports = []; const warnings = [];
  const today = Date.parse(reportDate + "T00:00:00+08:00");
  for (let offset = 1; offset <= 7; offset++) {
    const date = new Date(today + 8 * HOUR - offset * 24 * HOUR).toISOString().slice(0, 10);
    try {
      const report = JSON.parse(await readFileImpl(path.join(rootDir, "data/radar", date + ".json"), "utf8"));
      if (report.report_date !== date || !Array.isArray(report.items)) throw new Error("invalid_history");
      reports.push(report);
    } catch (error) { if (error.code !== "ENOENT") warnings.push(date); }
  }
  return { reports, warnings };
}

export async function collectRadarEdition({ mediaSignals, history = [], reportDate, capturedAt, ruleConfig = {},
  fetchTextImpl = fetchText, budgetMs = RADAR_NETWORK_BUDGET_MS, requestTimeoutMs = 8000, concurrency = 4 }) {
  const started = Date.now();
  const deadline = started + Math.max(1, Math.min(budgetMs, RADAR_NETWORK_BUDGET_MS));
  const controller = new AbortController();
  const budgetTimer = setTimeout(() => controller.abort(), deadline - started);
  const diagnostics = { request_failures: 0, requests: 0, source_results: [], metadata_requests: 0 };
  const request = async url => {
    if (controller.signal.aborted || Date.now() >= deadline) throw new Error("Radar deadline exceeded");
    diagnostics.requests++;
    const child = new AbortController();
    const timeoutMs = Math.max(1, Math.min(requestTimeoutMs, deadline - Date.now()));
    const timer = setTimeout(() => child.abort(), timeoutMs);
    const signal = AbortSignal.any([controller.signal, child.signal]);
    let onAbort;
    try {
      const aborted = new Promise((_, reject) => {
        onAbort = () => reject(new Error("Radar request aborted at deadline"));
        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) onAbort();
      });
      return await Promise.race([fetchTextImpl(url, { timeoutMs, signal,
        accept: "text/html,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.8",
        fetchImpl: (target, options) => globalThis.fetch(target, { ...options, signal: AbortSignal.any([signal, options.signal]) })
      }), aborted]);
    } catch (error) { diagnostics.request_failures++; throw error; }
    finally { clearTimeout(timer); signal.removeEventListener("abort", onAbort); }
  };
  const pool = async (input, fn) => {
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(Math.max(1, Math.floor(concurrency)), 4, input.length) }, async () => {
      while (cursor < input.length && Date.now() < deadline && !controller.signal.aborted) {
        const index = cursor++;
        await fn(input[index], index);
      }
    }));
  };
  const additions = [];
  try {
    const sources = (ruleConfig.radarSources ?? []).filter(x => x.active !== false);
    await pool(sources, async source => {
      try {
        const body = await request(source.url);
        const items = source.type === "chuapp_page" ? parseChuappRadarItems(body, source) : parseRadarFeedItems(body, source);
        additions.push(...items);
        diagnostics.source_results.push({ source: source.name, status: items.length ? "ok" : "empty", raw: items.length });
      } catch (error) {
        diagnostics.source_results.push({ source: source.name, status: classifySourceError(error), raw: 0 });
      }
    });
    const combined = [...mediaSignals, ...additions].map(item => ({ ...item }));
    // Metadata requests only concern undated external article copies; the original
    // shared media array and every sourcing diagnostic remain untouched.
    const seen = new Set();
    const needsDate = combined.filter(item => {
      const key = radarUrlKey(item.link);
      if (Number.isFinite(publicationTimestamp(item.published_at)) || isBilibiliSignal(item) || !isRadarArticleUrl(item.link) || seen.has(key)) return false;
      seen.add(key); return true;
    }).sort((a, b) => (b.score ?? scoreMediaSignal(b)) - (a.score ?? scoreMediaSignal(a))).slice(0, 60);
    const metadata = new Map();
    await pool(needsDate, async item => {
      diagnostics.metadata_requests++;
      try { metadata.set(radarUrlKey(item.link), readRadarArticleMetadata(await request(item.link))); }
      catch { /* The undated item is rejected below; the run continues. */ }
    });
    for (const item of combined) {
      const detail = metadata.get(radarUrlKey(item.link));
      if (!detail) continue;
      if (!Number.isFinite(publicationTimestamp(item.published_at))) item.published_at = detail.published_at;
      if (detail.summary) item.summary = detail.summary;
    }
    diagnostics.budget_exhausted = controller.signal.aborted || Date.now() >= deadline;
    diagnostics.elapsed_ms = Date.now() - started;
    return curateRadarSignals(combined, { reportDate, capturedAt, history, diversity: ruleConfig.radarDiversity, diagnostics });
  } finally { clearTimeout(budgetTimer); controller.abort(); }
}
