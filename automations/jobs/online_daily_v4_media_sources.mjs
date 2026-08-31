import { collectBilibiliProbeSignals, defaultBilibiliProbeDiagnostics } from "./bilibili_probe.mjs";
import { attachBilibiliEvidence } from "./bilibili_evidence.mjs";
import {
  dedupeMediaSignals,
  isBilibiliSignal,
  normalizeDisplayText,
  sourceTaggedItem,
  topicScore
} from "./online_daily_v4_dedupe.mjs";
import { classifySourceError, fetchJson, fetchText, parseMismatchError } from "./online_daily_v4_network.mjs";
import {
  hasAlreadyReleasedMediaText,
  isBannedMediaLeadText,
  isNonLeadMediaTopicText,
  isOfficialOrDeveloperBilibiliSignal
} from "./online_daily_v4_media_rules.mjs";
import {
  absolutizeUrl,
  cleanExtractedText,
  decodeHtml,
  hasGameOrBdContext,
  sleep,
  stripTags
} from "./online_daily_v4_source_utils.mjs";
import { defaultDailyRuleConfig } from "./online_daily_v4_rules.mjs";
import {
  mediaSourceFamily,
  recordMediaSourceFetch,
  recordMediaSourceRetained,
  recordSourceIncident
} from "./online_daily_v4_source_health.mjs";

export async function fetchMediaSignals(context = {}) {
  const diagnostics = context.diagnostics ?? {};
  const reportDate = context.reportDate ?? new Date().toISOString().slice(0, 10);
  const sourceList = context.mediaSourcesImpl?.(reportDate) ?? mediaSources(reportDate, context.ruleConfig);
  const fetchMediaSourceImpl = context.fetchMediaSourceImpl ?? ((source) => fetchMediaSource(source, context));
  const lowScoreThreshold = context.ruleConfig?.mediaQualityGates?.lowScoreThreshold ?? context.mediaLowScoreThreshold ?? 12;
  const baseResults = (await Promise.all(sourceList.map(fetchMediaSourceImpl))).flat();
  const probeResults = await fetchBilibiliProbeMediaSignals(context);
  const results = [...baseResults, ...probeResults];
  diagnostics.media_signals_raw = (diagnostics.media_signals_raw ?? 0) + results.length;
  const enrichedResults = await enrichBilibiliVideoSignals(results, context);
  const scored = [];
  for (const item of enrichedResults) {
    if (isStaleMediaSignal(item, context)) {
      diagnostics.media_stale_filtered = (diagnostics.media_stale_filtered ?? 0) + 1;
      continue;
    }
    if (isBilibiliSignal(item) && isBannedMediaLeadText(`${item.title} ${item.summary} ${item.source}`.toLowerCase()) && !isOfficialOrDeveloperBilibiliSignal(item)) {
      diagnostics.media_banned_filtered = (diagnostics.media_banned_filtered ?? 0) + 1;
      continue;
    }
    const next = { ...item, score: scoreMediaSignal(item) };
    if (next.score < lowScoreThreshold) {
      diagnostics.media_low_score_filtered = (diagnostics.media_low_score_filtered ?? 0) + 1;
      continue;
    }
    scored.push(next);
  }
  scored.sort((a, b) => b.score - a.score);

  const retained = dedupeMediaSignals(scored);
  recordMediaSourceRetained(diagnostics, retained);
  return retained;
}

export async function fetchBilibiliProbeMediaSignals(context = {}) {
  const diagnostics = context.diagnostics ?? {};
  const logger = context.logger ?? console;
  const qualityGates = context.ruleConfig?.mediaQualityGates ?? {};
  try {
    const result = await (context.collectBilibiliProbeSignalsImpl ?? collectBilibiliProbeSignals)({
      rootDir: context.rootDir ?? process.cwd(),
      reportDate: context.reportDate,
      configPath: context.args?.bilibiliProbeConfig ?? context.bilibiliProbeConfig ?? qualityGates.probeConfig,
      maxVideoAgeDays: context.maxBilibiliLeadAgeDays ?? qualityGates.maxBilibiliLeadAgeDays
    });
    diagnostics.bilibili_probe = result.diagnostics;
    diagnostics.source_failures = (diagnostics.source_failures ?? 0) + (result.diagnostics.source_failures ?? 0);
    diagnostics.bilibili_official_source_hits = (diagnostics.bilibili_official_source_hits ?? 0) + (result.diagnostics.official_source_hits ?? 0);
    return result.signals;
  } catch (error) {
    diagnostics.source_failures = (diagnostics.source_failures ?? 0) + 1;
    diagnostics.bilibili_probe = {
      ...defaultBilibiliProbeDiagnostics(),
      source_failures: 1,
      last_error: error.message
    };
    if (Array.isArray(diagnostics.low_volume_warnings)) diagnostics.low_volume_warnings.push(`B站探头失败：${error.message}`);
    logger.warn?.(`Bilibili probe failed: ${error.message}`);
    return [];
  }
}

export async function enrichBilibiliVideoSignals(items, context = {}) {
  const out = [];
  const chunkSize = context.bilibiliVideoDetailChunkSize ?? 4;
  const sleepImpl = context.sleepImpl ?? sleep;
  for (let index = 0; index < items.length; index += chunkSize) {
    const chunk = items.slice(index, index + chunkSize);
    out.push(...await Promise.all(chunk.map((item) => enrichBilibiliVideoSignal(item, context))));
    if (index + chunkSize < items.length) await sleepImpl(350);
  }
  return out;
}

export async function enrichBilibiliVideoSignal(item, context = {}) {
  const fetchJsonImpl = context.fetchJsonImpl ?? fetchJson;
  const bvid = item.bvid ?? bvidFromUrl(item.link);
  if (!bvid) return isBilibiliSignal(item) ? attachBilibiliEvidence(item) : item;
  try {
    const payload = await fetchJsonImpl(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`);
    const data = payload?.data;
    if (!data) return attachBilibiliEvidence(item);
    const desc = cleanExtractedText(data.desc ?? "");
    const owner = cleanExtractedText(data.owner?.name ?? "");
    const title = cleanExtractedText(data.title ?? item.title);
    const publishedAt = data.pubdate ? new Date(Number(data.pubdate) * 1000).toISOString() : item.published_at;
    return attachBilibiliEvidence({
      ...item,
      bvid,
      title: title || item.title,
      summary: [item.summary, desc, owner ? "UP主：" + owner : ""].filter(Boolean).join(" "),
      published_at: publishedAt || item.published_at
    });
  } catch {
    return attachBilibiliEvidence(item);
  }
}

export function mediaSources(reportDate, config) {
  const configuredSources = Array.isArray(config) ? config : config?.mediaSources;
  const sources = configuredSources ?? defaultDailyRuleConfig().mediaSources;
  return sources.filter((source) => source.active !== false && (!source.activeUntil || reportDate <= source.activeUntil));
}

export async function fetchMediaSource(source, context = {}) {
  const diagnostics = context.diagnostics ?? {};
  const fetchTextImpl = context.fetchTextImpl ?? fetchText;
  const logger = context.logger ?? console;
  try {
    const text = await fetchTextImpl(source.url, { timeoutMs: 12000, accept: "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8" });
    let items;
    if (source.type === "feed") items = parseFeedItems(text, source);
    else if (source.type === "bilibili_video_search") items = parseBilibiliVideoSearch(text, source);
    else if (source.type === "bilibili_page_search") items = parseBilibiliSearchPage(text, source);
    else if (source.type === "article") items = [parseArticleItem(text, source)].filter(Boolean);
    else items = parsePageItems(text, source);
    assertMediaSourceContract(text, source);
    recordMediaSourceFetch(diagnostics, source, { ok: true, rawCount: items.length });
    return items;
  } catch (error) {
    if (source.type === "bilibili_video_search" && source.fallbackUrl) {
      recordSourceIncident(diagnostics, source, {
        error,
        outcome: classifySourceError(error),
        family: mediaSourceFamily(source),
        fallbackUsed: true
      });
      try {
        const fallbackText = await fetchTextImpl(source.fallbackUrl, { timeoutMs: 12000, accept: "text/html,*/*;q=0.8" });
        assertMediaSourceContract(fallbackText, { ...source, type: "bilibili_page_search" });
        const items = parsePageItems(fallbackText, source);
        recordMediaSourceFetch(diagnostics, source, { ok: true, rawCount: items.length, fallbackUsed: true });
        return items;
      } catch (fallbackError) {
        diagnostics.source_failures = (diagnostics.source_failures ?? 0) + 1;
        recordMediaSourceFetch(diagnostics, source, {
          ok: false,
          error: fallbackError,
          outcome: classifySourceError(fallbackError),
          fallbackUsed: true
        });
        logger.warn?.(`Media source failed for ${source.name}: ${error.message}; fallback failed: ${fallbackError.message}`);
        return [];
      }
    }
    diagnostics.source_failures = (diagnostics.source_failures ?? 0) + 1;
    recordMediaSourceFetch(diagnostics, source, { ok: false, error, outcome: classifySourceError(error) });
    logger.warn?.(`Media source failed for ${source.name}: ${error.message}`);
    return [];
  }
}

export function assertMediaSourceContract(text, source = {}) {
  const value = String(text ?? "");
  if (source.type === "feed" && !/<(?:rss|feed)\b/i.test(value)) {
    throw parseMismatchError(`Feed response structure mismatch for ${source.name ?? "unknown"}`);
  }
  if (source.type === "bilibili_video_search") {
    let payload;
    try {
      payload = JSON.parse(value);
    } catch {
      throw parseMismatchError(`Bilibili search response is not JSON for ${source.name ?? "unknown"}`);
    }
    if (!Array.isArray(payload?.data?.result)) {
      throw parseMismatchError(`Bilibili search response structure mismatch for ${source.name ?? "unknown"}`);
    }
  }
  if (["page", "bilibili_page_search"].includes(source.type) && !/<(?:html|a)\b/i.test(value)) {
    throw parseMismatchError(`HTML page response structure mismatch for ${source.name ?? "unknown"}`);
  }
  if (source.type === "article" && !/<(?:title|meta)\b/i.test(value)) {
    throw parseMismatchError(`Article response structure mismatch for ${source.name ?? "unknown"}`);
  }
}

export function bilibiliSearchApi(keyword) {
  const url = new URL("https://api.bilibili.com/x/web-interface/search/type");
  url.searchParams.set("search_type", "video");
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "20");
  url.searchParams.set("order", "pubdate");
  return url.toString();
}

export function bilibiliSearchPage(keyword) {
  const url = new URL("https://search.bilibili.com/all");
  url.searchParams.set("keyword", keyword);
  return url.toString();
}

export function parseBilibiliVideoSearch(text, source) {
  try {
    const payload = JSON.parse(text);
    const result = Array.isArray(payload?.data?.result) ? payload.data.result : [];
    return result.slice(0, 20).map((item) => {
      const bvid = item.bvid ?? "";
      const title = cleanExtractedText(item.title ?? "");
      const description = cleanExtractedText(item.description ?? "");
      const author = cleanExtractedText(item.author ?? item.mid ?? "");
      return sourceTaggedItem({
        title,
        link: bvid ? `https://www.bilibili.com/video/${bvid}/` : absolutizeUrl(item.arcurl ?? "", "https://www.bilibili.com/"),
        summary: [description, author ? `UP主：${author}` : ""].filter(Boolean).join(" "),
        published_at: item.pubdate ? new Date(Number(item.pubdate) * 1000).toISOString() : "",
        bvid
      }, source);
    }).filter((item) => item.title && item.link);
  } catch {
    return [];
  }
}

export function parseBilibiliSearchPage(html, source) {
  const items = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']*\/video\/BV[0-9A-Za-z]+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html).matchAll(anchorPattern)) {
    const title = cleanExtractedText(match[2]);
    const link = absolutizeUrl(match[1], "https://www.bilibili.com/");
    if (title.length < 8 || title.length > 120) continue;
    items.push(sourceTaggedItem({
      title,
      link,
      summary: title,
      published_at: "",
      bvid: bvidFromUrl(link)
    }, source));
    if (items.length >= 20) break;
  }
  return items;
}

export function bvidFromUrl(value) {
  return String(value ?? "").match(/\/video\/(BV[0-9A-Za-z]+)/i)?.[1] ?? "";
}

export function parseFeedItems(xml, source) {
  const items = [];
  const blocks = String(xml).split(/<item\b|<entry\b/i).slice(1);
  for (const block of blocks.slice(0, 20)) {
    const title = cleanExtractedText(readXmlTag(block, "title"));
    const rawLink = readXmlTag(block, "link") || block.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || "";
    const link = absolutizeUrl(decodeHtml(stripTags(rawLink)).trim(), source.url);
    const summary = cleanExtractedText(readXmlTag(block, "description") || readXmlTag(block, "summary") || "");
    const publishedAt = cleanExtractedText(readXmlTag(block, "pubDate") || readXmlTag(block, "published") || "");
    if (title && link) items.push(sourceTaggedItem({ title, link, summary, published_at: publishedAt }, source));
  }
  return items;
}

export function parsePageItems(html, source) {
  const items = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html).matchAll(anchorPattern)) {
    const title = cleanExtractedText(match[2]);
    if (title.length < 8 || title.length > 100) continue;
    const link = absolutizeUrl(match[1], source.url);
    items.push(sourceTaggedItem({
      title,
      link,
      summary: title,
      published_at: "",
      bvid: bvidFromUrl(link)
    }, source));
    if (items.length >= 30) break;
  }
  return items;
}

export function parseArticleItem(html, source) {
  const title = cleanExtractedText(
    String(html).match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
    ?? String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?? ""
  );
  const summary = cleanExtractedText(
    String(html).match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)?.[1]
    ?? String(html).match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1]
    ?? title
  );
  return title ? sourceTaggedItem({ title, link: source.url, summary, published_at: "" }, source) : null;
}

export function readXmlTag(block, tagName) {
  const match = String(block).match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match?.[1]?.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "") ?? "";
}

export function scoreMediaSignal(item) {
  const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  let topicPoints = 0;
  topicPoints += topicScore(text, /\b(publisher|publishing|acquisition|investment|funding|layoffs?|union|lawsuit|court|rights?|licen[cs]e|ip|studio closure|executive|leadership)\b|出版|收购|投资|融资|裁员|诉讼|法院|判决|死刑|执行死刑|版权|授权|股权|高管|创始人|工作室|关停|监管|版号|财报/, 18);
  topicPoints += topicScore(text, /\b(expansion|dlc|major update|announced|showcase|release date|delay|remaster|remake|sequel|cross[- ]?media|adaptation|restarted from scratch)\b|资料片|大型更新|公布|发布会|延期|重制|续作|新作|改编|影视化|动画|联动|周年|上线|定档|发售|手游|端游/, 14);
  topicPoints += topicScore(text, /\b(steam|steam deck|epic games store|game pass|playstation|xbox|switch|nintendo|mobile|wishlist|demo|next fest|early access|store policy|platform|hardware|pricing|price|showcase|direct|state of play|summer game fest)\b|平台|商店|愿望单|试玩|新品节|抢先体验|主机|掌机|硬件|涨价|降价|定价|移动端|渠道|发布会|直面会/, 12);
  topicPoints += topicScore(text, /\b(streamer|creator|ugc|youtube|twitch|community|mod|viral|meme|esports)\b|主播|创作者|up主|视频|直播|社区|二创|模组|爆火|梗|赛事|传播/, 10);
  topicPoints += topicScore(text, /\b(artificial intelligence|generative ai|genai|machine learning|deepmind|large language model|llm)\b|人工智能|生成式|aigc/i, 12);
  topicPoints += topicScore(text, /\b(china|chinese|bilibili|asia|netease|tencent)\b|中国|国产|出海|B站|哔哩哔哩|腾讯|网易|米哈游|莉莉丝|心动|鹰角/, 12);
  topicPoints += topicScore(text, /\b(report|analysis|interview|confirmed|official|financial results)\b|报告|分析|专访|确认|官方|公告|财报/, 4);

  let score = (item.source_quality ?? 0) + topicPoints;
  const sourceFocus = new Set(item.source_focus ?? []);
  if (sourceFocus.has("domestic_sourcing")) score += 10;
  if (sourceFocus.has("bilibili") && /国产|独立游戏|试玩|demo|制作人|开发者|steam|实机|首曝|PV|视频/i.test(text)) score += 10;
  if (isOfficialOrDeveloperBilibiliSignal(item)) score += 16;
  if (sourceFocus.has("mobile") && /手游|移动端|买量|发行|渠道|小游戏|版号|出海/i.test(text)) score += 6;
  if (topicPoints < 8) score -= 12;
  if (isLowInformationMediaTitle(item.title)) score -= 60;
  if (!hasGameOrBdContext(text, item)) score -= 30;

  if (/\b(review|guide|walkthrough|tips|best settings|deal|sale|discount|cosplay|quiz)\b|攻略|评测|折扣|促销|史低|壁纸|图赏|盘点/.test(text)) score -= 10;
  if (/手游推荐|游戏推荐|必玩|好玩到爆|合集|几款|十款|\d+\s*款/.test(text) && !isOfficialOrDeveloperBilibiliSignal(item)) score -= 22;
  if (/rumor|leak|传闻|曝/.test(text) && !/\b(confirmed|official)\b|确认|官方|公告/.test(text)) score -= 4;
  return score;
}

export function isLowInformationMediaTitle(title) {
  const text = normalizeDisplayText(title);
  if (text.length < 6) return true;
  if (/^[\d\s:：.,，]+$/.test(text)) return true;
  if (/^\d+\s+\d+\s+\d{1,2}:\d{2}/.test(text)) return true;
  if (/^(观看|播放|评论|弹幕|收藏|分享|赞|投币)\s*\d+/i.test(text)) return true;
  if (/^[\u4e00-\u9fffA-Za-z0-9 _-]{2,30}\s*·\s*20\d{2}-\d{2}-\d{2}$/.test(text)) return true;
  if (/^.{2,40}\s*·\s*(昨天|前天|\d+\s*(小时前|分钟前|天前|周前|月前))$/.test(text)) return true;
  return false;
}

export function isStaleMediaSignal(item, context = {}) {
  if (!isBilibiliSignal(item)) return false;
  const ageDays = mediaSignalAgeDays(item, context.reportDate);
  if (typeof ageDays !== "number") return false;
  const maxAgeDays = context.maxBilibiliLeadAgeDays ?? context.ruleConfig?.mediaQualityGates?.maxBilibiliLeadAgeDays ?? 120;
  return ageDays > maxAgeDays;
}

export function mediaSignalAgeDays(item, reportDate = new Date().toISOString().slice(0, 10)) {
  const timestamp = Date.parse(item.published_at ?? "");
  if (!Number.isFinite(timestamp)) return null;
  const reportTimestamp = Date.parse(`${reportDate}T00:00:00+08:00`);
  if (!Number.isFinite(reportTimestamp)) return null;
  return (reportTimestamp - timestamp) / 86400000;
}

export async function fetchOfficialBilibiliCandidates(project, context = {}) {
  const fetchTextImpl = context.fetchTextImpl ?? fetchText;
  const logger = context.logger ?? console;
  const sleepImpl = context.sleepImpl ?? sleep;
  const queries = [
    `${project} 官方`,
    `${project} Steam`,
    `${project} PV 实机`,
    `${project} 开发日志`
  ];
  const results = [];
  for (const query of queries) {
    const source = {
      name: "B站官方复核",
      url: bilibiliSearchApi(query),
      fallbackUrl: bilibiliSearchPage(query),
      type: "bilibili_video_search",
      quality: 14,
      focus: ["china", "bilibili", "creator", "domestic_sourcing"]
    };
    try {
      const text = await fetchTextImpl(source.url, { timeoutMs: 10000, accept: "application/json,text/html;q=0.9,*/*;q=0.8" });
      results.push(...parseBilibiliVideoSearch(text, source));
    } catch (error) {
      try {
        results.push(...parsePageItems(await fetchTextImpl(source.fallbackUrl, { timeoutMs: 10000, accept: "text/html,*/*;q=0.8" }), source));
      } catch (fallbackError) {
        logger.warn?.(`Bilibili official lookup failed for ${project}: ${error.message}; fallback failed: ${fallbackError.message}`);
      }
    }
    if (results.length >= 12) break;
    await sleepImpl(250);
  }
  return enrichBilibiliVideoSignals(dedupeMediaSignals(results).slice(0, 12), context);
}

export { hasAlreadyReleasedMediaText };
