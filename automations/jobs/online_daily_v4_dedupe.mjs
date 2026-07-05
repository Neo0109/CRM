import { defaultDailyRuleConfig } from "./online_daily_v4_rules.mjs";

export function dedupeByAppId(items) {
  const byAppId = new Map();
  for (const item of items) {
    if (!item?.appId) continue;
    const appId = String(item.appId);
    const normalized = { ...item, appId };
    const current = byAppId.get(appId);
    if (!current || sourcePriority(normalized) > sourcePriority(current)) byAppId.set(appId, normalized);
  }
  return [...byAppId.values()];
}

function sourcePriority(item) {
  let priority = 0;
  if (item.domesticQuery) priority += 100;
  if (item.domesticLens) priority += 25;
  if (/Demo|Next Fest|试玩|新品节/i.test(item.source)) priority += 20;
  if (/Keyword|国产|中国|国风|修仙|武侠|肉鸽|卡牌|模拟经营/i.test(`${item.source} ${item.title}`)) priority += 15;
  if (/CN/.test(item.source)) priority += 5;
  return priority;
}

export function dedupeMediaSignals(items) {
  const seen = new Set();
  const out = [];
  const ranked = [...items].sort((a, b) => mediaSignalDedupeRank(b) - mediaSignalDedupeRank(a));
  for (const item of ranked) {
    const keys = mediaSignalDedupeKeys(item);
    if (!keys.length || keys.some((key) => seen.has(key))) continue;
    for (const key of keys) seen.add(key);
    out.push(item);
  }
  return out;
}

function mediaSignalDedupeRank(item) {
  if (!item?.bilibili_probe) return 0;
  let rank = Number(item.source_quality ?? 0);
  const sourceKind = item.bilibili_probe.source_kind;
  if (sourceKind === "official") rank += 1000;
  if (sourceKind === "developer") rank += 900;
  if (sourceKind === "publisher") rank += 850;
  if (sourceKind === "media") rank += 650;
  if (sourceKind === "trusted_creator") rank += 500;
  return rank;
}

function mediaSignalDedupeKeys(item) {
  const keys = [];
  const bvid = item.bvid ?? bvidFromUrl(item.link);
  if (bvid) keys.push(`bvid:${normalizeText(bvid)}`);
  const link = normalizeUrl(item.link ?? "");
  if (link) keys.push(`link:${link}`);
  const steamAppId = item.bilibili_probe?.steam_app_id ?? steamAppIdFromText(`${item.title ?? ""} ${item.summary ?? ""} ${item.link ?? ""}`);
  if (steamAppId) keys.push(`steam:${steamAppId}`);
  const titleKey = normalizeText(item.title).slice(0, 80);
  if (titleKey) keys.push(`title:${titleKey}`);
  return [...new Set(keys)];
}

function bvidFromUrl(value) {
  return String(value ?? "").match(/bilibili\.com\/video\/([^/?#]+)/i)?.[1] ?? "";
}

function steamAppIdFromText(value) {
  return String(value ?? "").match(/(?:store\.steampowered\.com|steamcommunity\.com|steamdb\.info)\/app\/(\d+)/i)?.[1] ?? null;
}

export function selectDiverseMediaSignals(items, limit, config) {
  const diversity = normalizeRadarDiversityConfig(limit, config);
  const selected = [];
  const sourceCount = new Map();
  const familyCount = new Map();
  const regionCount = new Map();

  for (const target of diversity.targets) {
    takeRadarSignals(
      items,
      selected,
      sourceCount,
      familyCount,
      regionCount,
      diversity,
      (item) => radarTargetMatches(item, target),
      target.count
    );
  }

  for (const item of items) {
    if (selected.includes(item)) continue;
    if (!canSelectRadarSignal(item, sourceCount, familyCount, regionCount, diversity)) continue;
    selected.push(item);
    bumpRadarCounts(item, sourceCount, familyCount, regionCount);
    if (selected.length >= diversity.limit) return selected;
  }

  for (const item of items) {
    if (selected.includes(item)) continue;
    selected.push(item);
    if (selected.length >= diversity.limit) break;
  }

  return selected;
}

function takeRadarSignals(items, selected, sourceCount, familyCount, regionCount, diversity, predicate, target) {
  let taken = 0;
  for (const item of items) {
    if (selected.includes(item)) continue;
    if (!predicate(item)) continue;
    if (!canSelectRadarSignal(item, sourceCount, familyCount, regionCount, diversity)) continue;
    selected.push(item);
    bumpRadarCounts(item, sourceCount, familyCount, regionCount);
    taken += 1;
    if (selected.length >= diversity.limit || taken >= target) break;
  }
}

function canSelectRadarSignal(item, sourceCount, familyCount, regionCount, diversity) {
  const family = mediaTopicFamily(item);
  const region = mediaRegion(item);
  if ((sourceCount.get(item.source) ?? 0) >= diversity.sourceCap) return false;
  if ((familyCount.get(family) ?? 0) >= diversity.familyCap) return false;
  if ((regionCount.get(region) ?? 0) >= diversity.regionCap) return false;
  return true;
}

function bumpRadarCounts(item, sourceCount, familyCount, regionCount) {
  const family = mediaTopicFamily(item);
  const region = mediaRegion(item);
  sourceCount.set(item.source, (sourceCount.get(item.source) ?? 0) + 1);
  familyCount.set(family, (familyCount.get(family) ?? 0) + 1);
  regionCount.set(region, (regionCount.get(region) ?? 0) + 1);
}

function radarTargetMatches(item, target) {
  const category = categoryForMediaSignal(item);
  if (target.category && category !== target.category) return false;
  if (target.categories && !target.categories.includes(category)) return false;
  if (target.region && mediaRegion(item) !== target.region) return false;
  return true;
}

function normalizeRadarDiversityConfig(limit, config) {
  const defaults = defaultDailyRuleConfig().radarDiversity;
  const configuredLimit = Number(limit ?? config?.limit ?? defaults.limit);
  return {
    limit: Number.isFinite(configuredLimit) ? configuredLimit : defaults.limit,
    sourceCap: boundedNumber(config?.sourceCap, defaults.sourceCap),
    familyCap: boundedNumber(config?.familyCap, defaults.familyCap),
    regionCap: boundedNumber(config?.regionCap, defaults.regionCap),
    targets: Array.isArray(config?.targets) && config.targets.length ? config.targets : defaults.targets
  };
}

function boundedNumber(value, fallback) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? number : fallback;
}

export function mediaRegion(item) {
  const focus = new Set(item.source_focus ?? []);
  const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  if (focus.has("china") || focus.has("domestic_sourcing") || /中国|国产|国内|出海|腾讯|网易|米哈游|莉莉丝|心动|鹰角|b站|哔哩哔哩|taptap|indienova/i.test(text)) return "china";
  return "global";
}

export function categoryForMediaSignal(item) {
  const family = mediaTopicFamily(item);
  if (family === "ai_production") return "AI 游戏";
  if (isBilibiliSignal(item)) return isMetaBilibiliTrend(item) ? "B站趋势" : "今日亮点";
  if (family === "creator_community") return isBilibiliSignal(item) ? "B站趋势" : "新梗热点";
  if (family === "business_legal" && isMacroBusinessSignal(item)) return "行业新闻";
  if (family === "product_ip" || family === "business_legal") return "今日亮点";
  if (family === "platform_market" || family === "industry_context") return "行业新闻";
  return "行业新闻";
}

export function mediaTopicFamily(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (/\b(artificial intelligence|generative ai|genai|machine learning|deepmind|large language model|llm)\b|人工智能|生成式|aigc/i.test(text)) return "ai_production";
  if (/\b(steam|steam deck|epic games store|game pass|playstation|xbox|switch|nintendo|mobile|wishlist|demo|next fest|early access|store policy|platform|hardware|pricing|price|showcase|direct|state of play|summer game fest)\b|平台|商店|愿望单|试玩|新品节|抢先体验|主机|掌机|硬件|涨价|降价|定价|移动端|渠道|发布会|直面会/.test(text)) return "platform_market";
  if (/\b(publisher|publishing|acquisition|investment|funding|layoffs?|lawsuit|court|rights?|licen[cs]e|studio closure|executive|leadership)\b|出版|收购|投资|融资|裁员|诉讼|法院|判决|死刑|执行死刑|版权|授权|股权|高管|创始人|工作室|关停|监管|版号|财报/.test(text)) return "business_legal";
  if (/\b(expansion|dlc|major update|announced|showcase|release date|delay|remaster|remake|sequel|cross[- ]?media|adaptation|restarted from scratch)\b|资料片|大型更新|公布|发布会|延期|重制|续作|新作|改编|影视化|动画|联动|周年|上线|定档|发售|手游|端游/.test(text)) return "product_ip";
  if (/\b(streamer|creator|ugc|youtube|twitch|community|mod|viral|meme|esports)\b|主播|创作者|up主|视频|直播|社区|二创|模组|爆火|梗|赛事|传播/.test(text)) return "creator_community";
  return "industry_context";
}

function isMacroBusinessSignal(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  return /\b(acquisition|investment|funding|layoffs?|union|financial results|earnings|regulation|regulator|antitrust|publisher|publishing)\b|收购|投资|融资|裁员|工会|监管|版号|财报|资本|头部厂商|平台方|发行商/.test(text);
}

export function isMetaBilibiliTrend(item) {
  if (!isBilibiliSignal(item)) return false;
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (/《[^》]+》|\bpv\b|\bdemo\b|实机|试玩|首曝|新作|上线|发售|公布|预告/.test(text)) return false;
  return /\b(trend|ranking|weekly|monthly|creator|streamer|community)\b|趋势|榜单|周榜|月榜|盘点|生态|up主|创作者|直播|热搜|话题|弹幕|播放|内容风向/.test(text);
}

export function isBilibiliSignal(item) {
  return /bilibili|b站|哔哩哔哩/i.test(`${item.source} ${item.link}`);
}

export function sourceTaggedItem(item, source) {
  return {
    ...item,
    source: source.name,
    source_focus: source.focus ?? [],
    source_quality: source.quality ?? 0
  };
}

export function topicScore(text, pattern, points) {
  return pattern.test(text) ? points : 0;
}

export function normalizeDisplayText(value) {
  return cleanExtractedText(value);
}

export function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeUrl(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\/$/, "");
}

function cleanExtractedText(value) {
  return stripTags(decodeHtml(value)).replace(/\s+/g, " ").trim();
}

function stripTags(value) {
  return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
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
