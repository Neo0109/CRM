import { isBilibiliSignal, normalizeDisplayText } from "./online_daily_v4_dedupe.mjs";

export function bilibiliAuthor(item) {
  return String(item.summary ?? "").match(/UP主：([^\s]+)/)?.[1] ?? "";
}

export function isOfficialOrDeveloperBilibiliSignal(item) {
  if (!isBilibiliSignal(item)) return false;
  const text = `${item.title ?? ""} ${item.summary ?? ""} ${item.source ?? ""}`;
  const author = bilibiliAuthor(item);
  if (/官方|开发者|制作组|工作室|studio|games|发行商|开发日志/i.test(author)) return true;
  if (/官方号|官方PV|官方\s*PV|开发者|制作组|工作室|studio|games|发行商|开发日志/i.test(text)) return true;
  if (/store\.steampowered\.com\/app\/\d+|steam商店页|官网|taptap|好游快爆|indienova/i.test(text)) return true;
  return false;
}

function semanticMediaContentText(item) {
  const tags = Array.isArray(item?.tags)
    ? item.tags.map((tag) => typeof tag === "string" ? tag : tag?.tag_name ?? tag?.name ?? "").join(" ")
    : String(item?.tags ?? "");
  return [
    item?.title,
    item?.summary,
    item?.description,
    item?.desc,
    item?.dynamic,
    item?.owner_name,
    tags
  ].filter(Boolean).join(" ");
}

function hasStandaloneAnimationSeriesMarker(item) {
  const text = semanticMediaContentText(item);
  return /动画|动漫|国漫|番剧|漫画|剧集|第\s*(?:[一二三四五六七八九十百]+|\d+)\s*季|开播|播出|粤语版|配音|声优/i.test(text);
}

function hasIndependentGameProductEvidence(item) {
  const text = semanticMediaContentText(item);
  const evidence = item?.bilibili_evidence ?? {};
  const structuredUrls = [
    ...(Array.isArray(item?.links) ? item.links : []),
    ...(Array.isArray(evidence?.urls) ? evidence.urls : []),
    ...(Array.isArray(evidence?.website_urls) ? evidence.website_urls : [])
  ].join(" ");
  const hasStructuredSteamId = Boolean(
    item?.steam_app_id
    || evidence?.steam_app_id
    || (Array.isArray(evidence?.steam_app_ids) && evidence.steam_app_ids.length)
  );

  if (hasStructuredSteamId) return true;
  if (/store\.steampowered\.com\/app\/\d+|steamdb\.info\/app\/\d+|\bapp\s*id\s*[:：#]?\s*\d+|taptap|indienova|好游快爆/i.test(`${text} ${structuredUrls}`)) return true;
  if (/独立游戏|手游|端游|主机游戏|网络游戏/i.test(text)) return true;
  return /游戏/i.test(text) && /\bdemo\b|试玩|实机|测试|商店页|愿望单|版号|\bplaytest\b/i.test(text);
}

export function isGameProductCandidateDomainSource(item) {
  return String(item?.candidate_domain_gate ?? item?.candidateDomainGate ?? "").trim() === "game_product";
}

export function hasGameProductDomainEvidence(item) {
  const text = semanticMediaContentText(item);
  const evidence = item?.bilibili_evidence ?? {};
  const structuredUrls = [
    item?.link,
    ...(Array.isArray(item?.links) ? item.links : []),
    evidence?.source_url,
    ...(Array.isArray(evidence?.source_urls) ? evidence.source_urls : []),
    ...(Array.isArray(evidence?.urls) ? evidence.urls : []),
    ...(Array.isArray(evidence?.website_urls) ? evidence.website_urls : [])
  ].join(" ");
  const structuredIds = [
    item?.steam_app_id,
    item?.steamAppId,
    item?.game_id,
    item?.gameId,
    item?.taptap_app_id,
    item?.taptapAppId,
    evidence?.steam_app_id,
    ...(Array.isArray(evidence?.steam_app_ids) ? evidence.steam_app_ids : [])
  ];
  if (structuredIds.some(isStructuredGameId)) return true;

  const identityText = `${text} ${structuredUrls}`;
  if (hasNormalizedGameProductLink(identityText)) return true;

  return hasExtractableConcreteGameProject(item, text)
    && hasExplicitGameProductCategory(text)
    && hasConcreteGameProductEvent(text);
}

function isStructuredGameId(value) {
  if (typeof value !== "string" && typeof value !== "number") return false;
  const text = String(value ?? "").trim();
  if (/^(?:true|false|null|undefined|unknown)$/i.test(text)) return false;
  return /^[1-9]\d*$/.test(text)
    || /^[a-z0-9][a-z0-9:_-]{2,63}$/i.test(text);
}

function hasNormalizedGameProductLink(value) {
  const text = String(value ?? "");
  return /https?:\/\/(?:store\.steampowered\.com|steamdb\.info)\/app\/[1-9]\d*(?=[/?#\s]|$)/i.test(text)
    || /https?:\/\/(?:www\.)?taptap\.(?:cn|com)\/(?:app|game)\/[a-z0-9_-]+(?=[/?#\s]|$)/i.test(text)
    || /https?:\/\/(?:www\.)?indienova\.com\/(?:games?|game|g)\/[a-z0-9_-]+(?=[/?#\s]|$)/i.test(text)
    || /https?:\/\/(?:[^/]+\.)?(?:3839\.com|haoyoukuaibao\.com)\/[a-z0-9/_-]+/i.test(text);
}

function hasExtractableConcreteGameProject(item, text) {
  const structuredProject = [
    item?.project_name,
    item?.projectName,
    item?.game_name,
    item?.gameName
  ].map((value) => normalizeDisplayText(value)).find(isConcreteProjectName);
  if (structuredProject) return true;

  return /(?:独立游戏|国产游戏|网络游戏|电子游戏|手机游戏|主机游戏|电脑游戏|手游|端游|单机游戏|mobile\s+game|pc\s+game|console\s+game)\s*[：:]?\s*《[^》]{2,48}》/i.test(text)
    || /《[^》]{2,48}》[^。；.!?]{0,24}(?:独立游戏|国产游戏|网络游戏|电子游戏|手机游戏|主机游戏|电脑游戏|手游|端游|单机游戏|mobile\s+game|pc\s+game|console\s+game)/i.test(text);
}

function isConcreteProjectName(value) {
  const text = normalizeDisplayText(value);
  if (text.length < 2 || text.length > 64) return false;
  return !/^(?:游戏|项目|新作|新品|手游|端游|主机游戏|独立游戏|网络游戏|未命名|unknown|untitled)$/i.test(text);
}

function hasExplicitGameProductCategory(value) {
  return /独立游戏|国产游戏|网络游戏|电子游戏|手机游戏|主机游戏|电脑游戏|单机游戏|手游|端游|mobile\s+game|pc\s+game|console\s+game/i.test(String(value ?? ""));
}

function hasConcreteGameProductEvent(value) {
  return /\bdemo\b|试玩|实机|\bplaytest\b|测试|商店页|愿望单|版号|首曝|开发日志/i.test(String(value ?? ""));
}

function hasUnresolvedSteamStoreClaim(item) {
  const evidence = item?.bilibili_evidence ?? {};
  const text = [
    semanticMediaContentText(item),
    item?.source,
    item?.link,
    ...(Array.isArray(item?.links) ? item.links : []),
    evidence?.source_url,
    ...(Array.isArray(evidence?.source_urls) ? evidence.source_urls : []),
    ...(Array.isArray(evidence?.urls) ? evidence.urls : []),
    ...(Array.isArray(evidence?.website_urls) ? evidence.website_urls : [])
  ].filter(Boolean).join(" ");
  const claimsSteamStorePage = /steam\s*(?:商店页(?:面)?|页面)|steam\s+store\s+page/i.test(text);
  if (!claimsSteamStorePage) return false;

  const hasNormalizedSteamUrl = /(?:store\.steampowered\.com|steamdb\.info)\/app\/[1-9]\d*(?:[/?#]|$)/i.test(text);
  if (hasNormalizedSteamUrl) return false;

  const appIds = [
    item?.steam_app_id,
    evidence?.steam_app_id,
    ...(Array.isArray(evidence?.steam_app_ids) ? evidence.steam_app_ids : [])
  ];
  const hasStructuredSteamAppId = appIds.some((value) => /^[1-9]\d*$/.test(String(value ?? "").trim()));
  const hasInlineSteamAppId = /\bapp\s*id\s*[:：#]?\s*[1-9]\d*\b/i.test(text);
  return !hasStructuredSteamAppId && !hasInlineSteamAppId;
}

export function classifyMediaDisposition(item) {
  const text = String(item?.title ?? "") + " " + String(item?.summary ?? "") + " " + String(item?.source ?? "");
  if (hasUnresolvedSteamStoreClaim(item)) {
    return { kind: "reject", reason: "steam_store_claim_without_normalized_evidence" };
  }
  if (/电影|影片|剧本|编剧|演员|导演|制片人|选角|影视改编|影视化|动画改编|真人改编|adaptation|screenplay|film\b|movie\b/i.test(text)) {
    return { kind: "radar_only", reason: "cross_media_or_film" };
  }
  if (hasStandaloneAnimationSeriesMarker(item) && !hasIndependentGameProductEvidence(item)) {
    return { kind: "radar_only", reason: "non_game_animation_series" };
  }
  if (/版本更新|大版本|赛季|联动|周年|资料片|\bdlc\b|补丁|更新公告|促销|折扣|史低|攻略|评测|测评|教程|指南|walkthrough|review\b|sale\b|discount/i.test(text)) {
    return { kind: "radar_only", reason: "released_product_content" };
  }
  if (/过审/.test(text) && !hasQualifiedGameApprovalSignal(text)) {
    return { kind: "radar_only", reason: "non_game_approval_context" };
  }
  if (isGameProductCandidateDomainSource(item) && !hasGameProductDomainEvidence(item)) {
    return { kind: "radar_only", reason: "non_game_broad_media" };
  }
  if (isBannedMediaLeadText(text.toLowerCase())) {
    return { kind: "reject", reason: "non_actionable_or_banned" };
  }
  return { kind: "lead_candidate", reason: null };
}

export function hasQualifiedGameApprovalSignal(value) {
  const text = String(value ?? "");
  return /版号|新闻出版署|国家新闻出版署|网络游戏审批|国产网络游戏审批|进口网络游戏审批/i.test(text);
}

export function isNonLeadMediaTopicText(text) {
  return /gdc|趋势报告|行业报告|市场报告|白皮书|财报|主线|版本更新|大版本|赛季|联动|周年|资料片|dlc|第二章|第三章|黑神话|游科|诡秘之主|人间地狱|锐评|逐帧|reaction|反应/i.test(text);
}

export function isSteamStoreOperationsTopic(item) {
  const text = `${item.title ?? ""} ${item.summary ?? ""} ${item.source ?? ""}`;
  const hasConcreteProject = /《[^》]{2,48}》/.test(text);
  const hasNormalizedAppLink = /(?:store\.steampowered\.com|steamdb\.info)\/app\/\d+/i.test(text);
  if (hasConcreteProject || hasNormalizedAppLink) return false;
  return /(?:steam\s*)?(?:商店页|商店页面|steam页面)/i.test(text)
    && /装修|装饰|过审|审核|优化|制作|运营|入门|指南|教程|经验|愿望单增长|终于上线/i.test(text);
}

export function isBannedMediaLeadText(text) {
  const bannedPatterns = [
    /招聘|岗位|财报|收入|销量榜|折扣|促销|史低|攻略|教程|如何报名|报名steam新品节|愿望单经验|曝光量|经验分享|开发经验|开发教程/i,
    /cosplay|壁纸|周边|赛事战报|补丁说明|停服|维护|android|pixel|iphone|手机也能升|主机情报|次世代|硬件|显卡|处理器|大会|峰会|获奖名单|流水|营收/i,
    /手游推荐|游戏推荐|必玩|好玩到爆|盘点|合集|几款|十款|\d+\s*款|锐评|吐槽/i,
    /黑神话：悟空|黑神话钟馗|诡秘之主|蔚蓝档案|galgame|国gal|恋爱模拟|致郁系|情书|我在b站做|占比百分之/i
  ];
  return bannedPatterns.some((pattern) => pattern.test(text));
}

export function hasConcreteMediaProductMarker(item) {
  const text = `${item.title ?? ""} ${item.summary ?? ""} ${item.source ?? ""}`;
  const author = bilibiliAuthor(item);
  if (/《[^》]{2,48}》/.test(text)) return true;
  if (/store\.steampowered\.com\/app\/\d+|steam商店页|steam页面|愿望单|taptap|好游快爆|indienova|官网|qq群|qq\s*群|discord/i.test(text)) return true;
  if (/官方|开发者|制作组|工作室|studio|games|发行商|开发日志/i.test(`${author} ${text}`)) return true;
  return false;
}

export function looksLikeCommentaryVideoTitle(title) {
  const text = normalizeDisplayText(title);
  if (/看完|看了|感觉|值不值得|到底|如何评价|锐评|吐槽|试玩了一下|实况|片段|少量实机|最新pv|新pv|pv片段|预告片反应|reaction/i.test(text)) return true;
  if (/^[^《》]{8,80}[，,！!？?][^《》]{4,80}$/.test(text)) return true;
  return false;
}

export function hasAlreadyReleasedMediaText(value) {
  const text = String(value ?? "");
  if (/商店页已上线|商店页面已上线|页面已上线|store page is live|(?:demo|试玩|测试)[^。；.!?]{0,12}(?:已上线|上线)|(?:已上线|上线)[^。；.!?]{0,12}(?:demo|试玩|测试)/i.test(text)) return false;
  return /现已上线|已经上线|现已发售|已经发售|已发售|正式发售|首发优惠|国区首发|发售\s*PV|available now|out now|released now/i.test(text);
}
