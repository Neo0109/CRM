import {
  deriveMediaDecisionFields,
  formatMediaGameplay,
  formatMediaProgress,
  normalizeMediaLinks as normalizeMediaLinksV63,
  steamAppIdFromLinks as steamAppIdFromLinksV63
} from "./sourcing_v6_3_quality.mjs";
import { extractBilibiliEvidence } from "./bilibili_evidence.mjs";
import { isBilibiliSignal, normalizeDisplayText, normalizeText } from "./online_daily_v4_dedupe.mjs";
import { isLowInformationMediaTitle } from "./online_daily_v4_media_sources.mjs";
import {
  classifyMediaDisposition,
  hasAlreadyReleasedMediaText,
  hasConcreteMediaProductMarker,
  isBannedMediaLeadText,
  isNonLeadMediaTopicText,
  isOfficialOrDeveloperBilibiliSignal,
  isSteamStoreOperationsTopic,
  looksLikeCommentaryVideoTitle
} from "./online_daily_v4_media_rules.mjs";
import { extractEmails, hashText, mergeContactMethods, mergeLinks } from "./online_daily_v4_source_utils.mjs";

export function isGenericMediaProjectName(value) {
  const text = normalizeDisplayText(value);
  const key = normalizeText(text);
  if (!key) return true;
  if (/^[0-9A-Za-z]{1,4}$/.test(text)) return true;
  if (/^(媒体|b站|今日亮点|行业新闻|国产游戏|独立游戏|游戏|steam|demo|pv|实机|试玩|新作|上线|公布|预告|推荐|盘点)$/i.test(key)) return true;
  return false;
}

export function isUnusableMediaProjectName(value) {
  const text = normalizeDisplayText(value);
  const key = normalizeText(text);
  if (/^(undefined|null|untitled|unknown)$/i.test(text)) return true;
  if (/开发日志|playtest|试玩彩蛋|加入了试玩|更新了试玩|更新了测试|主线|版本更新|资料片|黑神话|诡秘之主|人间地狱/i.test(text)) return true;
  if (/^(国产游戏|国人游戏|独立游戏)\s*(demo|试玩|实机|pv|公开测试|开发日志)/i.test(text)) return true;
  if (/^(国产|国人|独立游戏|游戏)\s*(demo|试玩|实机|pv|公开测试|开发日志)/i.test(text)) return true;
  if (/^(demo|试玩|实机|pv|公开测试|测试)\s*(上线|更新|发布|开放)/i.test(text)) return true;
  if (key.length <= 1) return true;
  return false;
}

export function hasStrongMediaLeadEvidence(lead) {
  const text = `${lead.public_signals ?? ""} ${(lead.links ?? []).join(" ")} ${(lead.contact_methods ?? []).map((item) => item?.value).join(" ")}`;
  if (/store\.steampowered\.com\/app\/\d+|taptap|indienova|好游快爆|游戏官网|官网/i.test(text)) return true;
  return Boolean(lead._officialSourceMatched);
}

export function isProductSourcingSignal(item) {
  const focus = new Set(item.source_focus ?? []);
  const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  const title = normalizeDisplayText(item.title);
  const isBilibili = isBilibiliSignal(item);
  if (classifyMediaDisposition(item).kind !== "lead_candidate") return false;
  const hasUsefulSource = focus.has("domestic_sourcing") || focus.has("bilibili") || (focus.has("china") && (focus.has("product") || focus.has("indie") || focus.has("mobile")));
  if (!hasUsefulSource) return false;
  if (isSteamStoreOperationsTopic(item)) return false;
  if (/招聘|岗位|财报|收入|销量榜|折扣|促销|史低|攻略|教程|如何报名|报名steam新品节|愿望单经验|曝光量|经验分享|开发经验|开发教程|cosplay|壁纸|周边|赛事战报|补丁说明|停服|维护|安卓|android|pixel|iphone|手机也能升|主机情报|次世代|硬件|显卡|处理器|大会|峰会|获奖名单|招聘|财报|流水|营收/i.test(text)) return false;
  if (isNonLeadMediaTopicText(text)) return false;
  if (/视觉小说|galgame|恋爱模拟|纯剧情|互动小说/i.test(text)) return false;

  const hasQuotedName = /《[^》]{2,48}》/.test(item.title);
  const hasConcreteMarker = hasConcreteMediaProductMarker(item);
  const hasBilibiliProjectShape = isBilibili
    && !hasQuotedName
    && hasConcreteMarker
    && title.length >= 2
    && title.length <= 34
    && /^[A-Za-z0-9\u4e00-\u9fff][A-Za-z0-9\u4e00-\u9fff:'’&.\-\s]+$/.test(title)
    && !/steam|demo|新品节|愿望单|曝光|免费|分享|数据|教程|报名|开发日志|制作人|开发者|自学|课程|指南|经验/i.test(title);
  const evidenceProject = extractMediaProjectName(item.title);
  const hasStructuredSteamProject = Boolean(extractBilibiliEvidence(item).steam_app_id)
    && !isGenericMediaProjectName(evidenceProject)
    && !isUnusableMediaProjectName(evidenceProject);
  const hasProductName = hasQuotedName || hasStructuredSteamProject || hasBilibiliProjectShape;
  const domesticCompanySignal = /网易|腾讯|字节|朝夕光年|巨人|西山居|莉莉丝|心动|鹰角|米哈游|散爆|库洛|叠纸|沐瞳|灵犀|祖龙|完美世界|中手游|B站游戏|哔哩哔哩游戏/i.test(text);
  const domesticTextSignal = /国产|国人|华人|中国团队|国内团队|国内开发|版号|过审|获批|独立游戏|开发日志|taptap|好游快爆|indienova|国风|武侠|修仙|山海|二次元|小游戏|手游/.test(text);
  const domesticSourceSignal = focus.has("domestic_sourcing") && /版号|过审|获批|首曝|国产|国内|中国|中式|国风|武侠|修仙|山海|二次元|小游戏|手游/.test(text);
  const hasDomesticLeadContext = isBilibili || domesticTextSignal || domesticCompanySignal || domesticSourceSignal;
  const hasDiscoverySignal = /新作|首曝|公布|发布|上线|定档|测试|试玩|demo|实机|pv|预告|steam|taptap|好游快爆|开发者|制作人|愿望单|商店页|b站|bilibili|版号|过审|获批|预约|肉鸽|卡牌|策略|模拟|经营|二次元|国风|武侠|修仙/i.test(text);
  const hasActionableFormat = /demo|试玩|测试|实机|pv|预告|商店页|愿望单|开发者|制作人|上线steam|开启预约|首曝|公布|版号|过审|获批|预约/i.test(text);
  return hasProductName && hasDomesticLeadContext && hasDiscoverySignal && hasActionableFormat;
}

export function isExpandedDomesticProductSignal(item) {
  const focus = new Set(item.source_focus ?? []);
  const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  const title = normalizeDisplayText(item.title);
  const domesticSource = focus.has("domestic_sourcing") || focus.has("bilibili") || focus.has("china");
  if (classifyMediaDisposition(item).kind !== "lead_candidate") return false;
  if (!domesticSource) return false;
  if (isSteamStoreOperationsTopic(item)) return false;
  if (isLowInformationMediaTitle(item.title)) return false;
  if (isBannedMediaLeadText(text)) return false;
  if (isNonLeadMediaTopicText(text)) return false;
  if (/视觉小说|galgame|恋爱模拟|纯剧情|互动小说/i.test(text)) return false;

  const quoted = /《[^》]{2,48}》/.test(item.title);
  const concreteMarker = hasConcreteMediaProductMarker(item);
  const hasDomesticContext = /国产|国人|华人|中国团队|国内团队|国内开发|版号|过审|获批|独立游戏|开发日志|taptap|好游快爆|indienova|国风|武侠|修仙|山海|二次元|小游戏|手游|b站|bilibili|哔哩哔哩/.test(text) || isBilibiliSignal(item);
  const hasActionableProductMoment = /新作|首曝|公布|发布|上线|定档|测试|试玩|demo|实机|pv|预告|steam|taptap|好游快爆|开发者|制作人|愿望单|商店页|b站|bilibili|版号|过审|获批|预约|肉鸽|卡牌|策略|模拟|经营|二次元|国风|武侠|修仙/i.test(text);
  const titleLooksLikeConcreteProject = title.length >= 4
    && title.length <= 80
    && !/^(更多|首页|新闻|资讯|专题|视频|搜索|登录|注册|投稿|广告|榜单|盘点|合集|周报|月报)$/i.test(title)
    && !/教程|经验|报名|指南|课程|盘点|榜单|数据分享|开发经验|愿望单增长|steam新品节报名/i.test(title)
    && !looksLikeCommentaryVideoTitle(title);

  return hasDomesticContext && hasActionableProductMoment && (quoted || (concreteMarker && titleLooksLikeConcreteProject));
}

export function isDomesticMediaRescueSignal(item) {
  const focus = new Set(item.source_focus ?? []);
  const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  const title = normalizeDisplayText(item.title);
  const domesticSource = focus.has("domestic_sourcing") || focus.has("bilibili") || focus.has("china");
  if (classifyMediaDisposition(item).kind !== "lead_candidate") return false;
  if (!domesticSource) return false;
  if (isSteamStoreOperationsTopic(item)) return false;
  if (isLowInformationMediaTitle(item.title)) return false;
  if (isBannedMediaLeadText(text) && !isOfficialOrDeveloperBilibiliSignal(item)) return false;
  if (isNonLeadMediaTopicText(text)) return false;
  if (/视觉小说|galgame|恋爱模拟|纯剧情|互动小说/i.test(text)) return false;
  if (hasAlreadyReleasedMediaText(text)) return false;

  const hasProjectShape = /《[^》]{2,48}》/.test(text) || hasConcreteMediaProductMarker(item);
  const hasActionableSignal = /demo|试玩|测试|实机|pv|预告|商店页|愿望单|steam|taptap|好游快爆|indienova|官网|开发日志|开发者|制作人|预约|版号|过审|获批/i.test(text);
  const hasDomesticProductContext = /国产|国人|华人|中国团队|国内团队|国内开发|独立游戏|国风|武侠|修仙|山海|二次元|小游戏|手游|肉鸽|卡牌|策略|模拟|经营|塔防|战棋/i.test(text);
  const titleIsUsable = title.length >= 4 && title.length <= 96 && !looksLikeCommentaryVideoTitle(title);
  return hasProjectShape && hasActionableSignal && titleIsUsable && (hasDomesticProductContext || isOfficialOrDeveloperBilibiliSignal(item));
}

export function mediaSignalToLead(item, confidence = "strict", context = {}) {
  const diagnostics = context.diagnostics ?? {};
  const reportDate = context.reportDate ?? new Date().toISOString().slice(0, 10);
  const project = extractMediaProjectName(item.title);
  const score = mediaLeadScore(item);
  const confidencePenalty = confidence === "expanded" ? 6 : confidence === "rescue" ? 10 : 0;
  const isBilibili = isBilibiliSignal(item);
  const mediaText = `${item.title} ${item.summary} ${item.source} ${item.link}`;
  const bilibiliEvidence = isBilibili ? extractBilibiliEvidence(item) : null;
  const extractedLinks = bilibiliEvidence?.urls ?? normalizeMediaLinksV63([item.link, mediaText]);
  const steamAppId = bilibiliEvidence?.steam_app_id ?? steamAppIdFromLinksV63(extractedLinks);
  if (steamAppId) {
    diagnostics.media_steam_appids_extracted = (diagnostics.media_steam_appids_extracted ?? 0) + 1;
    if (bilibiliEvidence) {
      const evidenceCount = Math.max(1, bilibiliEvidence.source_urls?.length ?? 0);
      diagnostics.steam_links_detected = (diagnostics.steam_links_detected ?? 0) + evidenceCount;
      diagnostics.steam_evidence_duplicate_merged = (diagnostics.steam_evidence_duplicate_merged ?? 0) + Math.max(0, evidenceCount - 1);
    }
  }
  const releasedByText = hasAlreadyReleasedMediaText(mediaText);
  const isPush = !releasedByText && confidence === "strict" && score >= 52 && /国产|国人|华人|国内团队|中国团队|b站|bilibili|taptap|好游快爆|indienova|开发日志/i.test(mediaText);
  const className = releasedByText ? "drop" : isPush ? "push" : "watch";
  const sourceLink = item.link;
  const contactMethods = collectMediaContactMethods(item, sourceLink, extractedLinks);
  const verificationLinks = collectMediaVerificationLinks(sourceLink, extractedLinks, steamAppId);
  const gameplay = formatMediaGameplay({ title: project, summary: mediaText, genre: inferMediaGenre(item) });
  const progress = formatMediaProgress({ sourceText: mediaText, reportDate });
  const decisionFields = deriveMediaDecisionFields({
    title: project,
    source: item.source,
    confidence,
    score,
    steamAppId,
    progress,
    gameplay,
    alreadyReleased: releasedByText,
    officialSourceMatched: false
  });
  const dropReason = releasedByText ? `B站/媒体原文显示已上线或已发售，不符合前置BD窗口` : null;
  if (releasedByText) diagnostics.media_released_routed_to_drop = (diagnostics.media_released_routed_to_drop ?? 0) + 1;

  return {
    _class: className,
    _mediaItem: item,
    _confidence: confidence,
    _officialSourceMatched: false,
    _bilibiliEvidence: bilibiliEvidence,
    _steamEvidencePrimary: bilibiliEvidence?.steam_app_id ? 1 : 0,
    _mediaDisposition: classifyMediaDisposition(item).kind,
    media_score: score - confidencePenalty,
    id: `lead_media_${reportDate.replaceAll("-", "")}_${hashText(`${item.source}:${sourceLink}:${project}`)}`,
    project,
    steam_app_id: steamAppId,
    team: null,
    team_size: null,
    country: "中国（媒体/B站信号待确认）",
    region: "中国",
    city: null,
    region_priority: "国内优先",
    bucket: className === "drop" ? "淘汰池" : "未处理",
    stage: className === "drop" ? "rejected" : "new",
    priority: className === "push" ? "P1" : className === "drop" ? "P3" : "P2",
    priority_reason: null,
    rule_fit: dropReason
      ? `国内媒体/B站产品发现源；${dropReason}；只做淘汰/市场背景，不进入未处理首轮 review。`
      : decisionFields.rule_fit,
    genre: inferMediaGenre(item),
    gameplay,
    progress,
    release_window: null,
    early_access: false,
    narrative_heavy: false,
    india_team: false,
    publisher_status: "媒体/B站信号，发行结构待确认",
    publisher_name: null,
    china_capability_occupied: false,
    traction_summary: `${item.source} 分数 ${score}；${isBilibili ? "B站视频/搜索语境" : "国内媒体/社区语境"}；${steamAppId ? `已从文本补 Steam AppID ${steamAppId}` : "需要人工确认是否有可测版本、商店页或官方账号"}。`,
    public_signals: `${item.source} / ${sourceLink}`,
    contact: contactMethods.map((method) => `${method.type}: ${method.value}`).join("；") || null,
    contact_methods: contactMethods,
    links: verificationLinks,
    exposure_trail: `自动从${item.source}捕捉到媒体/B站线索（${reportDate}）。这类线索用于扩大国内产品发现，不要求先具备 Steam AppID。`,
    bilibili_fit: decisionFields.bilibili_fit,
    amplification: decisionFields.amplification,
    risks: dropReason ?? decisionFields.risks,
    verdict: dropReason ? `${dropReason}，不占用未处理 review 名额。` : decisionFields.verdict,
    next_action: null,
    owner: null,
    due_date: null,
    first_seen: reportDate,
    notes: null
  };
}

export function mediaLeadScore(item) {
  const focus = new Set(item.source_focus ?? []);
  const text = `${item.title} ${item.summary}`.toLowerCase();
  let score = item.score ?? 0;
  if (focus.has("bilibili")) score += 12;
  if (focus.has("domestic_sourcing")) score += 10;
  if (/demo|试玩|测试|实机|pv|预告|商店页|愿望单/i.test(text)) score += 10;
  if (/国产|中国|独立游戏|开发者|制作人|国风|武侠|修仙|二次元|版号|过审|首曝|获批/i.test(text)) score += 8;
  if (/steam|taptap|好游快爆|indienova|b站|bilibili/i.test(text)) score += 6;
  if (/肉鸽|rogue|卡牌|deck|策略|strategy|模拟|经营|simulation|management|塔防|战棋|合作|多人/i.test(text)) score += 6;
  return score;
}

export function collectMediaVerificationLinks(sourceLink, extractedLinks, steamAppId) {
  const links = [sourceLink, ...extractedLinks];
  if (steamAppId) {
    links.push(`https://store.steampowered.com/app/${steamAppId}/`);
    links.push(`https://steamdb.info/app/${steamAppId}/`);
  }
  return mergeLinks(links);
}

export function collectMediaContactMethods(item, sourceLink, extractedLinks) {
  const methods = [];
  if (isBilibiliSignal(item)) addMediaContact(methods, "B站", sourceLink, `${item.source} 原始视频/搜索入口`);
  for (const email of extractEmails(`${item.title} ${item.summary}`)) {
    addMediaContact(methods, "Email", email, "B站/媒体简介中提取");
  }
  for (const link of extractedLinks) {
    const type = inferContactTypeFromLink(link);
    if (!type) continue;
    addMediaContact(methods, type, link, "B站/媒体简介中提取");
  }
  if (!methods.length) {
    addMediaContact(methods, "其他", sourceLink, `${item.source} 原始线索入口；首轮只做产品判断，通过后再补商务触点`);
  }
  return methods.slice(0, 6);
}

function addMediaContact(methods, type, value, note) {
  if (/store\.steampowered\.com|steamdb\.info|steamcommunity\.com\/app\//i.test(String(value))) return;
  const current = [...methods, { type, value, note }];
  methods.splice(0, methods.length, ...mergeContactMethods(current));
}

export function inferContactTypeFromLink(value) {
  const text = String(value);
  if (/bilibili\.com/i.test(text)) return "B站";
  if (/(?:discord\.gg|discord\.com\/invite)/i.test(text)) return "Discord";
  if (/(?:x\.com|twitter\.com)/i.test(text)) return "X/Twitter";
  if (/store\.steampowered\.com|steamdb\.info|steamcommunity\.com\/app\//i.test(text)) return null;
  if (/^https?:\/\//i.test(text)) return "官网";
  return null;
}

export function extractMediaProjectName(title) {
  const quoted = String(title).match(/《([^》]{2,48})》/)?.[1];
  if (quoted) return quoted.trim();
  const bracketed = String(title).match(/【([^】]{2,64})】/)?.[1]
    ?.replace(/\s*(?:开发日志|制作日志|devlog|development log)\s*\d*.*$/i, "")
    .trim();
  if (bracketed && bracketed.length >= 2 && bracketed.length <= 48) return bracketed;
  const cleaned = normalizeDisplayText(title)
    .replace(/^【[^】]{1,20}】/g, "")
    .replace(/^(国产|独立游戏|游戏|试玩|实机|PV|Demo|开发者|制作人)[：:\s-]+/i, "")
    .replace(/[丨｜].*$/, "")
    .replace(/\s*[-_]\s*(bilibili|哔哩哔哩|游戏葡萄|GameLook|indienova).*$/i, "")
    .trim();
  return cleaned.slice(0, 48) || "媒体/B站发现线索";
}

export function inferMediaGenre(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const genres = [];
  if (/肉鸽|rogue/i.test(text)) genres.push("Roguelike");
  if (/卡牌|构筑|deck/i.test(text)) genres.push("Card/Deckbuilder");
  if (/策略|战棋|strategy|tactical/i.test(text)) genres.push("Strategy");
  if (/模拟|经营|simulation|management|tycoon/i.test(text)) genres.push("Simulation/Management");
  if (/塔防|tower defense/i.test(text)) genres.push("Tower Defense");
  if (/合作|多人|co-op|multiplayer/i.test(text)) genres.push("Co-op/Multiplayer");
  if (/国风|武侠|修仙|山海/i.test(text)) genres.push("国风题材");
  return genres.length ? [...new Set(genres)].slice(0, 4).join(" / ") : "媒体/B站待确认";
}
