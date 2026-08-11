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
  const numericPlatformIds = [
    item?.steam_app_id,
    item?.steamAppId,
    item?.taptap_app_id,
    item?.taptapAppId,
    evidence?.steam_app_id,
    ...(Array.isArray(evidence?.steam_app_ids) ? evidence.steam_app_ids : [])
  ];
  if (numericPlatformIds.some(isPositiveNumericGameId)) return true;
  if ([item?.game_id, item?.gameId].some(isRecognizedGenericGameId)) return true;

  const identityText = `${text} ${structuredUrls}`;
  if (hasNormalizedGameProductLink(identityText)) return true;

  return Boolean(extractGameProductDomainProjectName(item))
    && hasExplicitGameProductCategory(text)
    && hasConcreteGameProductEvent(text);
}

function isPositiveNumericGameId(value) {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0;
  if (typeof value !== "string") return false;
  return /^[1-9]\d*$/.test(value.trim());
}

function isRecognizedGenericGameId(value) {
  if (isPositiveNumericGameId(value)) return true;
  if (typeof value !== "string") return false;
  const match = value.trim().match(/^(steam|taptap|indienova|kuaibao|3839):(.+)$/i);
  if (!match) return false;
  return match[1].toLowerCase() === "indienova"
    ? isConcreteIndienovaProductId(match[2])
    : isPositiveNumericGameId(match[2]);
}

function hasNormalizedGameProductLink(value) {
  const urls = String(value ?? "").match(/https?:\/\/[^\s<>"'，。；]+/gi) ?? [];
  return urls.some(isNormalizedGameProductUrl);
}

function isNormalizedGameProductUrl(rawValue) {
  try {
    const url = new URL(stripTrailingUrlProseDelimiters(rawValue));
    const host = url.hostname.toLowerCase().replace(/^(?:www|m)\./, "");
    const segments = url.pathname.split("/").filter(Boolean).map(decodeUrlPathSegment);
    if (segments.includes(null)) return false;

    if (["store.steampowered.com", "steamdb.info"].includes(host)) {
      return segments[0]?.toLowerCase() === "app" && isPositiveNumericGameId(segments[1]);
    }
    if (["taptap.cn", "taptap.com"].includes(host)) {
      return ["app", "game"].includes(segments[0]?.toLowerCase())
        && isPositiveNumericGameId(segments[1]);
    }
    if (host === "indienova.com") {
      return ["g", "game", "games"].includes(segments[0]?.toLowerCase())
        && isConcreteIndienovaProductId(segments[1]);
    }
    if (["3839.com", "haoyoukuaibao.com"].includes(host)) {
      return isCanonicalKuaibaoProductPath(segments);
    }
    return false;
  } catch {
    return false;
  }
}

function stripTrailingUrlProseDelimiters(value) {
  return String(value ?? "")
    .trim()
    .replace(/[)\]}>）】》」』、,.;:!?！？。，；：“”‘’]+$/gu, "");
}

function decodeUrlPathSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function isConcreteIndienovaProductId(value) {
  const text = String(value ?? "").trim();
  if (text.length < 2 || text.length > 128) return false;
  if (/^(?:news|article|articles|group|groups|search|tag|tags|index|games?|apps?|products?)$/i.test(text)) return false;
  return /^[\p{L}\p{N}][\p{L}\p{N} ._'’&-]+$/u.test(text) && /[\p{L}\p{N}]/u.test(text);
}

function isCanonicalKuaibaoProductPath(segments) {
  if (segments.length !== 2) return false;
  if (!/^(?:a|shouyou|games?|apps?|products?)$/i.test(String(segments[0] ?? ""))) return false;
  const id = String(segments[1] ?? "").replace(/\.html?$/i, "");
  return isPositiveNumericGameId(id);
}

export function extractGameProductDomainProjectName(item) {
  const structuredProject = [
    item?.project_name,
    item?.projectName,
    item?.game_name,
    item?.gameName
  ].filter((value) => typeof value === "string")
    .map((value) => normalizeDisplayText(value))
    .find(isConcreteProjectName);
  if (structuredProject) return structuredProject;

  const quotedProject = extractQuotedGameProjectName(item);
  if (quotedProject) return quotedProject;

  return extractExplicitUnquotedGameProjectName(item?.title);
}

const EXPLICIT_CHINESE_GAME_CATEGORY_TOKENS = Object.freeze([
  "模拟经营游戏", "客户端游戏", "移动端游戏", "二次元游戏", "独立游戏", "网络游戏",
  "电子游戏", "手机游戏", "主机游戏", "电脑游戏", "单机游戏", "国产游戏", "移动游戏",
  "小游戏", "网页游戏", "策略游戏", "卡牌游戏", "武侠游戏", "肉鸽游戏", "steam游戏",
  "掌机游戏", "arpg游戏", "pc游戏", "vr游戏", "手游", "端游"
].sort((left, right) => right.length - left.length));

export const DOMESTIC_GAME_COMPANY_NAMES = Object.freeze([
  "网易", "腾讯", "字节", "字节跳动", "朝夕光年", "巨人", "西山居", "莉莉丝", "心动", "鹰角",
  "米哈游", "散爆", "库洛", "叠纸", "沐瞳", "灵犀", "祖龙", "完美世界", "中手游",
  "B站游戏", "哔哩哔哩游戏"
]);

const DOMESTIC_GAME_COMPANY_PATTERN = new RegExp(
  DOMESTIC_GAME_COMPANY_NAMES
    .map(escapeRegexToken)
    .sort((left, right) => right.length - left.length)
    .join("|"),
  "i"
);

export function hasDomesticGameCompanySignal(value) {
  return DOMESTIC_GAME_COMPANY_PATTERN.test(String(value ?? ""));
}

const CATEGORY_PREFIX_MODIFIER_TOKENS = Object.freeze([
  "模拟经营", "二次元", "国产", "中国", "国人", "国内", "海外", "进口", "全球", "亚洲", "本土",
  "首款", "热门", "精品", "重磅", "年度", "多款", "移动", "武侠", "卡牌", "策略", "肉鸽", "pc"
].sort((left, right) => right.length - left.length));

const REGION_CATEGORY_PREFIX_TOKENS = Object.freeze([
  ...CATEGORY_PREFIX_MODIFIER_TOKENS,
  ...EXPLICIT_CHINESE_GAME_CATEGORY_TOKENS,
  "新游", "游戏", "独立", "网络", "电子", "手机", "主机", "电脑", "单机"
].sort((left, right) => right.length - left.length));

const DOMESTIC_GAME_COMPANY_NAME_KEYS = new Set(
  DOMESTIC_GAME_COMPANY_NAMES.map((name) => name.normalize("NFKC").toLowerCase())
);
const ORGANIZATION_AFFILIATION_TOKENS = Object.freeze([
  "旗下", "互娱", "娱乐", "互动", "数字", "文化", "信息", "软件", "传媒", "网络", "游戏", "科技",
  "股份", "控股", "事业群", "事业部", "部门", "中心"
]);

const ORGANIZATION_TERMINAL_ROLE_SUFFIXES = Object.freeze([
  "研发中心", "工作室群", "事业群", "事业部", "业务部", "实验室", "研究院", "项目组", "工作室",
  "制作组", "部门", "中心", "团队", "公司", "集团", "企业", "厂商", "股份", "控股"
].sort((left, right) => right.length - left.length));

const KNOWN_ORGANIZATION_ONLY_KEYS = new Set([
  ...DOMESTIC_GAME_COMPANY_NAME_KEYS,
  "腾讯", "网易", "米哈游", "字节跳动", "雪佛兰", "哔哩哔哩", "bilibili", "b站",
  "证券时报", "it之家", "澎湃新闻", "gamelook", "游戏葡萄", "游戏陀螺", "游戏日报", "触乐"
]);

const KNOWN_MEDIA_SOURCE_KEYS = new Set([
  "央视新闻", "新华社", "证券时报", "it之家", "澎湃新闻", "gamelook", "游戏葡萄", "游戏陀螺",
  "游戏日报", "触乐", "第一财经", "中国证券报", "南方周末", "经济观察报"
]);

const MEDIA_SOURCE_ROLE_SUFFIXES = Object.freeze([
  "新闻网", "电视台", "通讯社", "证券报", "观察报", "新闻", "日报", "时报", "周报", "晚报",
  "广播", "媒体", "资讯", "财经", "周末"
].sort((left, right) => right.length - left.length));

const MEDIA_REPORT_ROLE_PREFIX_TOKENS = Object.freeze([
  "中国", "全国", "北京", "上海", "南方", "财经", "经济", "证券", "科技", "游戏", "产业", "观察", "新闻"
].sort((left, right) => right.length - left.length));

const DOCUMENT_ROLE_SUFFIXES = Object.freeze([
  "办法", "条例", "规范", "白皮书", "报告", "备忘录", "协议", "通知", "指南", "政策", "规定",
  "细则", "标准", "方案", "公约", "声明", "通报", "意见", "倡议", "要点", "决定", "规划", "纲要"
].sort((left, right) => right.length - left.length));

const DOCUMENT_ROLE_QUALIFIER_TOKENS = Object.freeze([
  "投资", "战略", "隐私", "安全", "技术", "管理", "征求", "保密", "补充", "框架", "联合", "整改",
  "用户", "数据", "信息", "网络", "内容", "平台", "开发", "运营", "推广", "营销", "合规", "治理",
  "保护", "指导", "实施", "试行", "暂行", "自律", "服务", "使用", "授权", "发行", "合作", "许可",
  "采购", "和解", "联运", "商务", "退款", "审核", "处理", "反馈"
].sort((left, right) => right.length - left.length));

const ATTRIBUTION_ROLE_SUFFIXES = Object.freeze([
  "消息", "报道", "显示", "称", "宣布", "透露", "指出", "表示"
].sort((left, right) => right.length - left.length));

const GENERIC_GAME_PROJECT_TOKENS = Object.freeze([
  // Qualifiers and quantifiers.
  "最新", "全新", "某款", "某个", "多款", "一款", "多个", "一个", "多项", "一项",
  "数款", "若干", "一批", "一系列", "若干批", "这款", "一家", "旗下", "一部", "多部", "首款",
  "热门", "精品", "重磅", "年度", "神秘", "未命名", "尚未命名", "代号", "备受期待",
  "原创", "自研", "知名", "头部", "某", "本", "该", "新",
  // Region, genre, and platform modifiers.
  "模拟经营", "二次元", "国产", "中国", "国人", "国内", "海外", "进口", "全球", "亚洲", "本土",
  "移动", "武侠", "卡牌", "策略", "肉鸽", "pc",
  // Organizations, teams, and attribution labels.
  "公司", "企业", "行业", "品牌", "官方", "开发者", "开发", "研发", "制作", "发行",
  "团队", "工作室", "制作组", "厂商", "机构", "集团", "上市", "旗下", "网络", "科技",
  "互娱", "娱乐", "互动", "数字", "文化", "信息", "软件", "传媒", "股份", "控股",
  "事业群", "事业部", "部门", "中心",
  ...DOMESTIC_GAME_COMPANY_NAMES,
  "雪佛兰", "哔哩哔哩", "bilibili", "b站", "游戏日报",
  // Game/product/project nouns.
  ...EXPLICIT_CHINESE_GAME_CATEGORY_TOKENS,
  "新游", "游戏", "项目", "作品", "产品", "新作", "新品", "力作", "作",
  // Generic market and ecosystem roles.
  "市场", "平台", "产业", "生态", "赛道", "板块", "领域", "品类",
  // News, update, and message labels.
  "新闻", "消息", "资讯", "动态", "公告", "更新", "报道", "称", "通告", "说明",
  // Business, licensing, and publishing labels.
  "业务", "商业", "合作", "需求", "授权", "版号", "许可", "审批", "出版", "上线",
  "运营", "推广", "营销", "代理", "签约", "计划", "指导", ...DOCUMENT_ROLE_SUFFIXES,
  // English equivalents; normalization removes whitespace and punctuation before segmentation.
  "latest", "allnew", "new", "multiple", "many", "several", "some", "one", "this", "our", "a", "an",
  "company", "corporate", "industry", "brand", "official", "developer", "development", "production",
  "studio", "team", "publisher", "publishing",
  "consolegame", "mobilegame", "pcgame", "indiegame", "game", "games", "title", "titles",
  "project", "projects", "product", "products", "release", "releases",
  "news", "update", "updates", "message", "messages", "announcement", "announcements",
  "information", "info", "report", "reports",
  "market", "platform", "industry", "ecosystem", "sector", "category", "field", "segment",
  "business", "license", "licence", "licensing", "approval", "publish", "distribution",
  "partnership", "cooperation", "authorization", "authorisation", "launch", "operation", "operations",
  "marketing"
].sort((left, right) => right.length - left.length));

function normalizeProjectDescriptorKey(value) {
  return normalizeDisplayText(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

const GENERIC_COUNT_PREFIX_TOKEN_PATTERN_SOURCE = "(?:不少于|大约|超过|至少|至多|最多|合计|累计|不下|约|近|超|逾|上|数|第|共)";
const GENERIC_COUNT_PREFIX_SEQUENCE_PATTERN_SOURCE = `(?:${GENERIC_COUNT_PREFIX_TOKEN_PATTERN_SOURCE}){0,2}`;
const GENERIC_NUMERAL_PATTERN_SOURCE = "(?:(?:\\d+)|(?:[零〇一二两三四五六七八九十百千万亿几]+)|(?:若干))";
const GENERIC_COUNT_PRE_CLASSIFIER_SUFFIX_PATTERN_SOURCE = "(?:余|多|来)?";
const GENERIC_COUNT_CLASSIFIER_PATTERN_SOURCE = "(?:款|个|部|项|批)";
const GENERIC_COUNT_POST_CLASSIFIER_SUFFIX_PATTERN_SOURCE = "(?:以上|以下|以内|左右|上下|起|余)?";
const GENERIC_COUNT_MAGNITUDE_QUANTIFIER_PATTERN_SOURCE = "(?:成百上千)";
const GENERIC_COUNT_WITH_CLASSIFIER_PATTERN_SOURCE = `(?:${GENERIC_COUNT_PREFIX_SEQUENCE_PATTERN_SOURCE}${GENERIC_NUMERAL_PATTERN_SOURCE}${GENERIC_COUNT_PRE_CLASSIFIER_SUFFIX_PATTERN_SOURCE}${GENERIC_COUNT_CLASSIFIER_PATTERN_SOURCE}${GENERIC_COUNT_POST_CLASSIFIER_SUFFIX_PATTERN_SOURCE}|${GENERIC_COUNT_MAGNITUDE_QUANTIFIER_PATTERN_SOURCE}${GENERIC_COUNT_CLASSIFIER_PATTERN_SOURCE})`;
const GENERIC_COUNT_AT_START_PATTERN = new RegExp(`^${GENERIC_COUNT_WITH_CLASSIFIER_PATTERN_SOURCE}`, "u");
const GENERIC_BATCH_QUANTIFIER_PATTERN_SOURCE = "(?:一批|一系列|若干批|成百上千款)";

function isEntirelySegmentableProjectDescriptor(
  key,
  tokens,
  { allowGenericCount = false, allowCalendarYear = false } = {}
) {
  const reachable = new Uint8Array(key.length + 1);
  reachable[0] = 1;
  for (let index = 0; index < key.length; index += 1) {
    if (!reachable[index]) continue;
    if (allowGenericCount) {
      const count = key.slice(index).match(GENERIC_COUNT_AT_START_PATTERN)?.[0];
      if (count) reachable[index + count.length] = 1;
    }
    if (allowCalendarYear) {
      const year = key.slice(index).match(/^(?:19|20)\d{2}/)?.[0];
      if (year) reachable[index + year.length] = 1;
    }
    for (const token of tokens) {
      if (!key.startsWith(token, index)) continue;
      reachable[index + token.length] = 1;
    }
  }
  return reachable[key.length] === 1;
}

function isGenericGameProjectDescriptor(value) {
  const key = normalizeProjectDescriptorKey(value);
  if (!key) return true;
  return isEntirelySegmentableProjectDescriptor(
    key,
    GENERIC_GAME_PROJECT_TOKENS,
    { allowGenericCount: true }
  );
}

function isOnlyRegionOrCategoryModifiers(value) {
  const key = normalizeProjectDescriptorKey(value);
  if (!key) return false;
  return isEntirelySegmentableProjectDescriptor(
    key,
    REGION_CATEGORY_PREFIX_TOKENS,
    { allowGenericCount: true }
  );
}

function isOrganizationOnlyProjectDescriptor(value) {
  const key = normalizeProjectDescriptorKey(value);
  if (!key) return false;
  if (KNOWN_ORGANIZATION_ONLY_KEYS.has(key)) return true;
  for (const companyKey of DOMESTIC_GAME_COMPANY_NAME_KEYS) {
    if (!key.startsWith(companyKey)) continue;
    const affiliation = key.slice(companyKey.length);
    if (affiliation && isEntirelySegmentableProjectDescriptor(
      affiliation,
      ORGANIZATION_AFFILIATION_TOKENS
    )) return true;
    if (affiliation && ORGANIZATION_TERMINAL_ROLE_SUFFIXES.some(
      (suffix) => affiliation.endsWith(suffix)
    )) return true;
  }
  return /^(?=.{2,48}$)[\p{L}\p{N}]+(?:公司|集团|工作室|团队|企业|厂商|制作组)$/u.test(key);
}

export function isMediaSourceEntity(value) {
  const key = normalizeProjectDescriptorKey(value);
  if (key.length < 2 || key.length > 48) return false;
  if (KNOWN_MEDIA_SOURCE_KEYS.has(key)) return true;
  if (MEDIA_SOURCE_ROLE_SUFFIXES.some((suffix) => key.endsWith(suffix))) return true;
  if (!key.endsWith("报")) return false;
  return isEntirelySegmentableProjectDescriptor(
    key.slice(0, -1),
    MEDIA_REPORT_ROLE_PREFIX_TOKENS
  );
}

function isNonProjectDocumentEntity(value) {
  const key = normalizeProjectDescriptorKey(value);
  if (key.length < 2 || key.length > 64) return false;
  const suffix = DOCUMENT_ROLE_SUFFIXES.find((candidate) => key.endsWith(candidate));
  if (!suffix) return false;
  if (key === suffix || key.length >= 5) return true;
  return isEntirelySegmentableProjectDescriptor(
    key.slice(0, -suffix.length),
    DOCUMENT_ROLE_QUALIFIER_TOKENS
  );
}

function isAttributionRoleEntity(value) {
  const key = normalizeProjectDescriptorKey(value);
  if (key.length < 2 || key.length > 48) return false;
  return ATTRIBUTION_ROLE_SUFFIXES.some((suffix) => key.length > suffix.length && key.endsWith(suffix));
}

function hasDisallowedProjectAttributionPrefix(value) {
  return /^(?:消息称|报道称|官方|开发者|开发团队|制作组|团队)(?:[\s:：—–|｜-]+|$)/i.test(
    normalizeDisplayText(value)
  );
}

function isConcreteProjectName(value) {
  if (typeof value !== "string") return false;
  const text = normalizeDisplayText(value);
  if (text.length < 2 || text.length > 64) return false;
  if (/^(?:undefined|null|unknown|untitled|未命名)$/i.test(text)) return false;
  if (isNonProjectDocumentEntity(text)) return false;
  if (isMediaSourceEntity(text)) return false;
  if (isAttributionRoleEntity(text)) return false;
  if (hasDisallowedProjectAttributionPrefix(text)) return false;
  if (isOrganizationOnlyProjectDescriptor(text)) return false;
  if (isGenericGameProjectDescriptor(text)) return false;
  const residue = text
    .replace(/(?:国产|中国|国人)?(?:独立游戏|网络游戏|电子游戏|手机游戏|主机游戏|电脑游戏|单机游戏)|国产游戏|手游|端游|游戏项目|游戏|项目|新作|新品/gi, " ")
    .replace(/\b(?:demo|playtest)\b/gi, " ")
    .replace(/公开|公布|开放|开启|获批|通过|过审|发布|推出|上线|试玩|实机|测试|商店页|愿望单|版号|首曝|开发日志/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  return residue.length >= 2 && /\p{L}/u.test(residue);
}

function escapeRegexToken(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CATEGORY_PREFIX_PATTERN_SOURCE = [
  ...CATEGORY_PREFIX_MODIFIER_TOKENS.map(escapeRegexToken),
  GENERIC_COUNT_WITH_CLASSIFIER_PATTERN_SOURCE,
  GENERIC_BATCH_QUANTIFIER_PATTERN_SOURCE
].join("|");
const CATEGORY_PREFIX_SEPARATOR_PATTERN_SOURCE = "[\\s·・:：—–|｜-]*";
const CHINESE_GAME_CATEGORY_PATTERN_SOURCE = `(?:${EXPLICIT_CHINESE_GAME_CATEGORY_TOKENS.map(escapeRegexToken).join("|")})`;
const CHINESE_GAME_CATEGORY_AT_START_PATTERN = new RegExp(
  `^(?:(?:${CATEGORY_PREFIX_PATTERN_SOURCE})${CATEGORY_PREFIX_SEPARATOR_PATTERN_SOURCE})*${CHINESE_GAME_CATEGORY_PATTERN_SOURCE}`,
  "i"
);
const ENGLISH_GAME_CATEGORY_AT_START_PATTERN = /^(?:mobile\s+game|pc\s+game|console\s+game)/i;

function matchExplicitGameProductCategory(value) {
  const text = String(value ?? "");
  for (let index = 0; index < text.length;) {
    const currentCodePoint = String.fromCodePoint(text.codePointAt(index));
    if (isCategoryLexicalStart(text, index)) {
      const tail = text.slice(index);
      const chinese = CHINESE_GAME_CATEGORY_AT_START_PATTERN.exec(tail)?.[0] ?? "";
      if (chinese) return categoryMatch(chinese, index);

      const english = ENGLISH_GAME_CATEGORY_AT_START_PATTERN.exec(tail)?.[0] ?? "";
      if (english && isCategoryLexicalEnd(text, index + english.length)) {
        return categoryMatch(english, index);
      }
    }
    index += currentCodePoint.length;
  }
  return null;
}

function isCategoryLexicalStart(text, index) {
  if (index === 0) return true;
  const previousCodePoint = [...text.slice(0, index)].at(-1) ?? "";
  return /[\s\p{P}\p{S}]/u.test(previousCodePoint);
}

function isCategoryLexicalEnd(text, index) {
  const nextCodePoint = [...text.slice(index)].at(0) ?? "";
  return !nextCodePoint || !/[\p{L}\p{N}_]/u.test(nextCodePoint);
}

function categoryMatch(text, index) {
  return { 0: text, index };
}

function extractQuotedGameProjectName(item) {
  const text = semanticMediaContentText(item);
  if (!matchExplicitGameProductCategory(text) || !hasConcreteGameProductEvent(text)) return null;

  const candidates = [...text.matchAll(/《([^》]{2,48})》/g)]
    .map((match) => {
      const project = normalizeDisplayText(match[1]);
      const end = Number(match.index ?? 0) + match[0].length;
      const eventDistance = text.slice(end).search(/\bdemo\b|试玩|实机|\bplaytest\b|测试|商店页|愿望单|版号|首曝|开发日志/i);
      return { project, eventDistance };
    })
    .filter(({ project, eventDistance }) => isConcreteProjectName(project) && eventDistance >= 0);
  return candidates[0]?.project ?? null;
}

function extractExplicitUnquotedGameProjectName(value) {
  const title = normalizeDisplayText(value);
  if (!title || /[《》【】]/.test(title)) return null;
  const category = matchExplicitGameProductCategory(title);
  if (!category) return null;
  const afterCategory = title.slice(category.index + category[0].length);
  const event = /(?:公开|公布|开放|开启|获批|通过|过审|发布|推出)?\s*(?:\bdemo\b|试玩|实机|\bplaytest\b|测试|商店页|愿望单|版号|首曝|开发日志)/i.exec(afterCategory);
  if (!event) return null;

  const between = stripUnquotedProjectSlotFraming(afterCategory.slice(0, event.index));
  if (isConcreteProjectName(between)) return between;

  const before = cleanUnquotedProjectCandidate(title.slice(0, category.index));
  if (isOnlyRegionOrCategoryModifiers(before)) return null;
  return isConcreteProjectName(before) ? before : null;
}

function cleanUnquotedProjectCandidate(value) {
  const text = normalizeDisplayText(value)
    .replace(/^[\s:：—–|｜-]+|[\s:：—–|｜-]+$/g, "")
    .trim();
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ·・:：'’&._-]{1,47}$/u.test(text)) return "";
  if (hasDisallowedProjectAttributionPrefix(text)) return "";
  return text;
}

function stripUnquotedProjectSlotFraming(value) {
  let text = cleanUnquotedProjectCandidate(value);
  if (!text) return "";

  text = text.replace(
    /^(?:新作(?:[\s:：—–|｜-]*|(?=[\p{L}\p{N}]))|(?:项目|作品|游戏)(?:[\s:：—–|｜-]+)|代号\s+)+/iu,
    ""
  ).trim();
  const trailingConnector = /(?:[\s:：—–|｜-]*)(?:计划将在|宣布将在|宣布计划|宣布将|今日将|即将于|有望于|计划于|计划在|拟于|拟在|将会|plans?\s+on\s+(?:launching|announcing|revealing)|(?:is\s+)?scheduled\s+to\s+(?:launch|announce|reveal)|will\s+be\s+(?:launching|announcing|revealing)|is\s+expected\s+to(?:\s+(?:announce|reveal|launch))?|is\s+going\s+to(?:\s+(?:announce|reveal|launch))?|is\s+set\s+to|expected\s+to|plans?\s+to|正式|即将|预计|有望|日前|现已|将于|宣布|首度|今日|将|officially|will|shall|announce(?:s|d|ing)?|reveal(?:s|ed|ing)?|launch(?:es|ed|ing)?|now)(?:[\s:：—–|｜-]*)$/i;
  let previous;
  do {
    previous = text;
    text = text.replace(trailingConnector, "").trim();
  } while (text !== previous);

  return cleanUnquotedProjectCandidate(text);
}

function hasExplicitGameProductCategory(value) {
  return Boolean(matchExplicitGameProductCategory(value));
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
  if (isGameProductCandidateDomainSource(item) && !hasGameProductDomainEvidence(item)) {
    return { kind: "radar_only", reason: "non_game_broad_media" };
  }
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
