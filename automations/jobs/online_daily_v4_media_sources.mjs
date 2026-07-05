import { collectBilibiliProbeSignals, defaultBilibiliProbeDiagnostics } from "./bilibili_probe.mjs";
import {
  dedupeMediaSignals,
  isBilibiliSignal,
  normalizeDisplayText,
  sourceTaggedItem,
  topicScore
} from "./online_daily_v4_dedupe.mjs";
import { fetchJson, fetchText } from "./online_daily_v4_network.mjs";
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

export async function fetchMediaSignals(context = {}) {
  const diagnostics = context.diagnostics ?? {};
  const reportDate = context.reportDate ?? new Date().toISOString().slice(0, 10);
  const sourceList = context.mediaSourcesImpl?.(reportDate) ?? mediaSources(reportDate);
  const fetchMediaSourceImpl = context.fetchMediaSourceImpl ?? ((source) => fetchMediaSource(source, context));
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
    if (next.score < 12) {
      diagnostics.media_low_score_filtered = (diagnostics.media_low_score_filtered ?? 0) + 1;
      continue;
    }
    scored.push(next);
  }
  scored.sort((a, b) => b.score - a.score);

  return dedupeMediaSignals(scored);
}

export async function fetchBilibiliProbeMediaSignals(context = {}) {
  const diagnostics = context.diagnostics ?? {};
  const logger = context.logger ?? console;
  try {
    const result = await (context.collectBilibiliProbeSignalsImpl ?? collectBilibiliProbeSignals)({
      rootDir: context.rootDir ?? process.cwd(),
      reportDate: context.reportDate,
      configPath: context.args?.bilibiliProbeConfig ?? context.bilibiliProbeConfig,
      maxVideoAgeDays: context.maxBilibiliLeadAgeDays
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
  if (!bvid) return item;
  try {
    const payload = await fetchJsonImpl(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`);
    const data = payload?.data;
    if (!data) return item;
    const desc = cleanExtractedText(data.desc ?? "");
    const owner = cleanExtractedText(data.owner?.name ?? "");
    const title = cleanExtractedText(data.title ?? item.title);
    const publishedAt = data.pubdate ? new Date(Number(data.pubdate) * 1000).toISOString() : item.published_at;
    return {
      ...item,
      bvid,
      title: title || item.title,
      summary: [item.summary, desc, owner ? `UP主：${owner}` : ""].filter(Boolean).join(" "),
      published_at: publishedAt || item.published_at
    };
  } catch {
    return item;
  }
}

export function mediaSources(reportDate) {
  return [
    { name: "GameLook", url: "http://www.gamelook.com.cn/feed", type: "feed", quality: 16, focus: ["china", "business", "domestic_sourcing"] },
    { name: "游戏葡萄", url: "https://youxiputao.com/", type: "page", quality: 14, focus: ["china", "business", "domestic_sourcing"] },
    { name: "GameRes游资网", url: "https://www.gameres.com/", type: "page", quality: 13, focus: ["china", "development", "domestic_sourcing"] },
    { name: "游戏陀螺", url: "https://www.youxituoluo.com/", type: "page", quality: 13, focus: ["china", "business", "mobile", "domestic_sourcing"] },
    { name: "手游那点事", url: "https://www.nadianshi.com/", type: "page", quality: 12, focus: ["china", "mobile", "domestic_sourcing"] },
    { name: "游戏茶馆", url: "https://www.youxichaguan.com/news", type: "page", quality: 12, focus: ["china", "business", "domestic_sourcing"] },
    { name: "indienova", url: "https://indienova.com/groups", type: "page", quality: 12, focus: ["china", "indie", "domestic_sourcing"] },
    { name: "游研社", url: "https://www.yystv.cn/", type: "page", quality: 12, focus: ["china", "product", "creator", "domestic_sourcing"] },
    { name: "机核", url: "https://www.gcores.com/", type: "page", quality: 11, focus: ["china", "product", "creator", "domestic_sourcing"] },
    { name: "TapTap发现", url: "https://www.taptap.cn/discover", type: "page", quality: 10, focus: ["china", "mobile", "product", "domestic_sourcing"] },
    { name: "B站视频-国产独立游戏", url: bilibiliSearchApi("国产独立游戏 Demo Steam"), fallbackUrl: bilibiliSearchPage("国产独立游戏 Demo Steam"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产游戏试玩", url: bilibiliSearchApi("国产游戏 试玩 Demo"), fallbackUrl: bilibiliSearchPage("国产游戏 试玩 Demo"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产游戏实机", url: bilibiliSearchApi("国产游戏 实机 PV"), fallbackUrl: bilibiliSearchPage("国产游戏 实机 PV"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产肉鸽卡牌", url: bilibiliSearchApi("国产 肉鸽 卡牌 Steam"), fallbackUrl: bilibiliSearchPage("国产 肉鸽 卡牌 Steam"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-独立游戏开发日志", url: bilibiliSearchApi("独立游戏 开发日志 试玩"), fallbackUrl: bilibiliSearchPage("独立游戏 开发日志 试玩"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产游戏公开测试", url: bilibiliSearchApi("国产游戏 公开测试 试玩"), fallbackUrl: bilibiliSearchPage("国产游戏 公开测试 试玩"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产独立游戏PV", url: bilibiliSearchApi("国产独立游戏 PV 实机"), fallbackUrl: bilibiliSearchPage("国产独立游戏 PV 实机"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产策略模拟", url: bilibiliSearchApi("国产 策略 模拟经营 Steam"), fallbackUrl: bilibiliSearchPage("国产 策略 模拟经营 Steam"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国风修仙游戏", url: bilibiliSearchApi("国风 修仙 游戏 试玩"), fallbackUrl: bilibiliSearchPage("国风 修仙 游戏 试玩"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产二游新作", url: bilibiliSearchApi("国产 二游 新作 PV"), fallbackUrl: bilibiliSearchPage("国产 二游 新作 PV"), type: "bilibili_video_search", quality: 12, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产官方PV", url: bilibiliSearchApi("国产独立游戏 官方 PV"), fallbackUrl: bilibiliSearchPage("国产独立游戏 官方 PV"), type: "bilibili_video_search", quality: 15, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产开发者Demo", url: bilibiliSearchApi("国产游戏 开发者 Demo Steam"), fallbackUrl: bilibiliSearchPage("国产游戏 开发者 Demo Steam"), type: "bilibili_video_search", quality: 15, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产商店页愿望单", url: bilibiliSearchApi("国产游戏 Steam 商店页 愿望单"), fallbackUrl: bilibiliSearchPage("国产游戏 Steam 商店页 愿望单"), type: "bilibili_video_search", quality: 15, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产Playtest", url: bilibiliSearchApi("国产游戏 Playtest 试玩"), fallbackUrl: bilibiliSearchPage("国产游戏 Playtest 试玩"), type: "bilibili_video_search", quality: 14, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国人独立游戏Steam", url: bilibiliSearchApi("国人独立游戏 Steam 商店页"), fallbackUrl: bilibiliSearchPage("国人独立游戏 Steam 商店页"), type: "bilibili_video_search", quality: 14, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产TapTap预约", url: bilibiliSearchApi("国产游戏 TapTap 预约 PV"), fallbackUrl: bilibiliSearchPage("国产游戏 TapTap 预约 PV"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站搜索-国产独立游戏", url: "https://search.bilibili.com/all?keyword=%E5%9B%BD%E4%BA%A7%E7%8B%AC%E7%AB%8B%E6%B8%B8%E6%88%8F%20Demo%20Steam", type: "bilibili_page_search", quality: 11, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站搜索-国产游戏试玩", url: "https://search.bilibili.com/all?keyword=%E5%9B%BD%E4%BA%A7%E6%B8%B8%E6%88%8F%20%E8%AF%95%E7%8E%A9%20Demo", type: "bilibili_page_search", quality: 11, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站搜索-国产游戏实机", url: "https://search.bilibili.com/all?keyword=%E5%9B%BD%E4%BA%A7%E6%B8%B8%E6%88%8F%20%E5%AE%9E%E6%9C%BA%20PV", type: "bilibili_page_search", quality: 11, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站搜索-国产肉鸽卡牌", url: "https://search.bilibili.com/all?keyword=%E5%9B%BD%E4%BA%A7%20%E8%82%89%E9%B8%BD%20%E5%8D%A1%E7%89%8C%20Steam", type: "bilibili_page_search", quality: 11, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站搜索-独立游戏制作人", url: "https://search.bilibili.com/all?keyword=%E7%8B%AC%E7%AB%8B%E6%B8%B8%E6%88%8F%20%E5%88%B6%E4%BD%9C%E4%BA%BA%20%E5%BC%80%E5%8F%91%E6%97%A5%E5%BF%97", type: "bilibili_page_search", quality: 11, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "GamesIndustry.biz", url: "https://www.gamesindustry.biz/feed", type: "feed", quality: 14, focus: ["business", "publishing"] },
    { name: "GameDeveloper", url: "https://www.gamedeveloper.com/rss.xml", type: "feed", quality: 13, focus: ["development", "business"] },
    { name: "VGC", url: "https://www.videogameschronicle.com/feed/", type: "feed", quality: 12, focus: ["industry", "platform"] },
    { name: "Eurogamer", url: "https://www.eurogamer.net/feed/news", type: "feed", quality: 11, focus: ["industry", "product"] },
    { name: "PC Gamer", url: "https://www.pcgamer.com/rss/", type: "feed", quality: 10, focus: ["pc", "community"] },
    { name: "IGN", url: "https://www.ign.com/rss/articles/feed?tags=games", type: "feed", quality: 10, focus: ["product", "mainstream"] },
    { name: "Gematsu", url: "https://www.gematsu.com/feed", type: "feed", quality: 9, focus: ["product", "asia"] },
    { name: "The Verge Gaming", url: "https://www.theverge.com/rss/games/index.xml", type: "feed", quality: 9, focus: ["platform", "technology"] },
    { name: "GameSpot", url: "https://www.gamespot.com/feeds/news/", type: "feed", quality: 8, focus: ["mainstream", "product"] },
    { name: "Polygon", url: "https://www.polygon.com/rss/index.xml", type: "feed", quality: 10, focus: ["mainstream", "product", "culture"] },
    { name: "Rock Paper Shotgun", url: "https://www.rockpapershotgun.com/feed", type: "feed", quality: 9, focus: ["pc", "product", "culture"] },
    { name: "PocketGamer.biz", url: "https://www.pocketgamer.biz/rss/", type: "feed", quality: 10, focus: ["business", "mobile"] },
    { name: "GamesBeat", url: "https://venturebeat.com/category/games/feed/", type: "feed", quality: 9, focus: ["business", "technology"] },
    { name: "Siliconera", url: "https://www.siliconera.com/feed/", type: "feed", quality: 8, focus: ["product", "asia"] },
    { name: "触乐", url: "https://www.chuapp.com/?feed=rss2", type: "feed", quality: 11, focus: ["china", "culture"] },
    { name: "IT之家", url: "https://www.ithome.com/rss/", type: "feed", quality: 7, focus: ["china", "technology"] },
    { name: "3DM", url: "https://www.3dmgame.com/news/", type: "page", quality: 6, focus: ["china", "product"] },
    { name: "游民星空", url: "https://www.gamersky.com/news/", type: "page", quality: 6, focus: ["china", "product"] },
    { name: "证券时报", url: "https://www.stcn.com/", type: "page", quality: 10, focus: ["china", "capital", "legal"] },
    { name: "澎湃新闻", url: "https://m.thepaper.cn/", type: "page", quality: 9, focus: ["china", "legal", "society"] }
  ].filter((source) => !source.activeUntil || reportDate <= source.activeUntil);
}

export async function fetchMediaSource(source, context = {}) {
  const diagnostics = context.diagnostics ?? {};
  const fetchTextImpl = context.fetchTextImpl ?? fetchText;
  const logger = context.logger ?? console;
  try {
    const text = await fetchTextImpl(source.url, { timeoutMs: 12000, accept: "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8" });
    if (source.type === "feed") return parseFeedItems(text, source);
    if (source.type === "bilibili_video_search") return parseBilibiliVideoSearch(text, source);
    if (source.type === "bilibili_page_search") return parseBilibiliSearchPage(text, source);
    if (source.type === "article") return [parseArticleItem(text, source)].filter(Boolean);
    return parsePageItems(text, source);
  } catch (error) {
    if (source.type === "bilibili_video_search" && source.fallbackUrl) {
      try {
        return parsePageItems(await fetchTextImpl(source.fallbackUrl, { timeoutMs: 12000, accept: "text/html,*/*;q=0.8" }), source);
      } catch (fallbackError) {
        diagnostics.source_failures = (diagnostics.source_failures ?? 0) + 1;
        logger.warn?.(`Media source failed for ${source.name}: ${error.message}; fallback failed: ${fallbackError.message}`);
        return [];
      }
    }
    diagnostics.source_failures = (diagnostics.source_failures ?? 0) + 1;
    logger.warn?.(`Media source failed for ${source.name}: ${error.message}`);
    return [];
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
  return ageDays > (context.maxBilibiliLeadAgeDays ?? 120);
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
