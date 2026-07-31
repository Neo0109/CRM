import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { INDIE_PRELAUNCH_RULE_VERSION } from "./online_daily_v7_indie_admission.mjs";
import { REGULAR_SOURCING_RULE_VERSION } from "./online_daily_v7_2_regular_admission.mjs";

const GENERATOR_REPO_PATH = "automations/jobs/online_daily_v4.mjs";
export const QUALITY_QUARANTINE_RULE_VERSION = "sourcing-rules-v6.8-quality-quarantine";
export const RULE_VERSION = "sourcing-rules-v7.3-obtainable-evidence";
const ACTIVE_RULES_DOC = "docs/SOURCING_RULES_CURRENT.md";

export function isQualityQuarantineRule(ruleVersion) {
  return ruleVersion === QUALITY_QUARANTINE_RULE_VERSION;
}

export function isLeadCountHealthEnabled(ruleVersion) {
  return !isQualityQuarantineRule(ruleVersion)
    && ruleVersion !== INDIE_PRELAUNCH_RULE_VERSION
    && ruleVersion !== REGULAR_SOURCING_RULE_VERSION
    && ruleVersion !== RULE_VERSION;
}

export function quarantineDailyLeadPools(pools, ruleVersion) {
  if (!isQualityQuarantineRule(ruleVersion)) return pools;
  return { push: [], watch: [], drop: [] };
}

const DEFAULT_MEDIA_SOURCES = [
  { name: "GameLook", url: "http://www.gamelook.com.cn/feed", type: "feed", quality: 16, focus: ["china", "business", "domestic_sourcing"] },
  { name: "游戏葡萄", url: "https://youxiputao.com/", type: "page", quality: 14, focus: ["china", "business", "domestic_sourcing"] },
  { name: "GameRes游资网", url: "https://www.gameres.com/", type: "page", quality: 13, focus: ["china", "development", "domestic_sourcing"] },
  { name: "游戏陀螺", url: "https://www.youxituoluo.com/", type: "page", quality: 13, focus: ["china", "business", "mobile", "domestic_sourcing"] },
  { name: "手游那点事", url: "https://www.nadianshi.com/", type: "page", quality: 12, focus: ["china", "mobile", "domestic_sourcing"], active: false, disabled_reason: "repeated fetch failures in cloud runs" },
  { name: "游戏茶馆", url: "https://www.youxichaguan.com/", type: "page", quality: 12, focus: ["china", "business", "domestic_sourcing"] },
  { name: "indienova", url: "https://indienova.com/groups", type: "page", quality: 12, focus: ["china", "indie", "domestic_sourcing"] },
  { name: "游研社", url: "https://www.yystv.cn/", type: "page", quality: 12, focus: ["china", "product", "creator", "domestic_sourcing"] },
  { name: "机核", url: "https://www.gcores.com/", type: "page", quality: 11, focus: ["china", "product", "creator", "domestic_sourcing"] },
  { name: "TapTap发现", url: "https://www.taptap.cn/discover", type: "page", quality: 10, focus: ["china", "mobile", "product", "domestic_sourcing"] },
  { name: "B站视频-国产独立游戏", type: "bilibili_video_search", query: "国产独立游戏 Demo Steam", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
  { name: "B站视频-国产游戏试玩", type: "bilibili_video_search", query: "国产游戏 试玩 Demo", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
  { name: "B站视频-国产游戏实机", type: "bilibili_video_search", query: "国产游戏 实机 PV", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
  { name: "B站视频-国产肉鸽卡牌", type: "bilibili_video_search", query: "国产 肉鸽 卡牌 Steam", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
  { name: "B站视频-独立游戏开发日志", type: "bilibili_video_search", query: "独立游戏 开发日志 试玩", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
  { name: "B站视频-国产游戏公开测试", type: "bilibili_video_search", query: "国产游戏 公开测试 试玩", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
  { name: "B站视频-国产独立游戏PV", type: "bilibili_video_search", query: "国产独立游戏 PV 实机", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
  { name: "B站视频-国产策略模拟", type: "bilibili_video_search", query: "国产 策略 模拟经营 Steam", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
  { name: "B站视频-国风修仙游戏", type: "bilibili_video_search", query: "国风 修仙 游戏 试玩", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
  { name: "B站视频-国产二游新作", type: "bilibili_video_search", query: "国产 二游 新作 PV", quality: 12, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
  { name: "B站视频-国产官方PV", type: "bilibili_video_search", query: "国产独立游戏 官方 PV", quality: 15, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
  { name: "B站视频-国产开发者Demo", type: "bilibili_video_search", query: "国产游戏 开发者 Demo Steam", quality: 15, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
  { name: "B站视频-国产商店页愿望单", type: "bilibili_video_search", query: "国产游戏 Steam 商店页 愿望单", quality: 15, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
  { name: "B站视频-国产Playtest", type: "bilibili_video_search", query: "国产游戏 Playtest 试玩", quality: 14, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
  { name: "B站视频-国人独立游戏Steam", type: "bilibili_video_search", query: "国人独立游戏 Steam 商店页", quality: 14, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
  { name: "B站视频-国产TapTap预约", type: "bilibili_video_search", query: "国产游戏 TapTap 预约 PV", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
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
  { name: "GamesBeat", url: "https://venturebeat.com/category/games/feed/", type: "feed", quality: 9, focus: ["business", "technology"], active: false, disabled_reason: "legacy feed returns persistent 403/429 in cloud runs" },
  { name: "Siliconera", url: "https://www.siliconera.com/feed/", type: "feed", quality: 8, focus: ["product", "asia"] },
  { name: "触乐", url: "https://www.chuapp.com/?feed=rss2", type: "feed", quality: 11, focus: ["china", "culture"] },
  { name: "IT之家", url: "https://www.ithome.com/rss/", type: "feed", quality: 7, focus: ["china", "technology"] },
  { name: "3DM", url: "https://www.3dmgame.com/news/", type: "page", quality: 6, focus: ["china", "product"] },
  { name: "游民星空", url: "https://www.gamersky.com/news/", type: "page", quality: 6, focus: ["china", "product"] },
  { name: "证券时报", url: "https://www.stcn.com/", type: "page", quality: 10, focus: ["china", "capital", "legal"] },
  { name: "澎湃新闻", url: "https://m.thepaper.cn/", type: "page", quality: 9, focus: ["china", "legal", "society"], active: false, disabled_reason: "persistent 403 from GitHub Actions egress" }
];

const DEFAULT_QUALITY_GATES = {
  maxBilibiliLeadAgeDays: 120,
  lowScoreThreshold: 12,
  probeConfig: "automations/rules/bilibili-probe.json"
};

const DEFAULT_RADAR_DIVERSITY = {
  limit: 14,
  sourceCap: 2,
  familyCap: 4,
  regionCap: 8,
  targets: [
    { category: "行业新闻", region: "china", count: 2 },
    { category: "行业新闻", region: "global", count: 3 },
    { category: "今日亮点", region: "china", count: 4 },
    { category: "今日亮点", region: "global", count: 2 },
    { category: "AI 游戏", count: 2 },
    { categories: ["B站趋势", "新梗热点"], count: 1 }
  ]
};

export async function loadDailyRules({ rootDir = process.cwd(), rulesPath } = {}) {
  const rootPath = filesystemPath(rootDir);
  const filePath = rulesPath
    ? path.resolve(rootPath, rulesPath)
    : path.join(rootPath, "automations/rules/daily-report.json");
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to load daily report rules from ${filePath}: ${error.message}`);
  }
}

export function validateDailyRules(value) {
  if (!value || typeof value !== "object") throw new Error("Daily report rules must be a JSON object.");
  if (value.schema_version !== 1) throw new Error(`Unsupported daily report rule schema: ${value.schema_version}`);
  if (value.rule_version !== RULE_VERSION) throw new Error(`Unsupported daily report rule version: ${value.rule_version}`);
  if (!Array.isArray(value.compatible_generators) || !value.compatible_generators.includes(GENERATOR_REPO_PATH)) {
    throw new Error(`Daily report rules are not marked compatible with ${GENERATOR_REPO_PATH}.`);
  }
  if (value.active_rules_doc !== ACTIVE_RULES_DOC) {
    throw new Error(`Unexpected active rules doc: ${value.active_rules_doc}`);
  }
}

export function buildDailyRuleConfig(rules = {}) {
  return {
    mediaSources: mediaSourceConfigFromRules(rules),
    mediaQualityGates: qualityGateConfigFromRules(rules),
    radarDiversity: radarDiversityConfigFromRules(rules)
  };
}

export function defaultDailyRuleConfig() {
  return {
    mediaSources: normalizeMediaSources(DEFAULT_MEDIA_SOURCES),
    mediaQualityGates: { ...DEFAULT_QUALITY_GATES },
    radarDiversity: cloneRadarDiversity(DEFAULT_RADAR_DIVERSITY)
  };
}

export function mediaSourceConfigFromRules(rules = {}) {
  const sources = Array.isArray(rules.media_sources) && rules.media_sources.length
    ? rules.media_sources
    : DEFAULT_MEDIA_SOURCES;
  return normalizeMediaSources(sources);
}

export function qualityGateConfigFromRules(rules = {}) {
  const legacyGates = objectValue(rules.bilibili_media_quality_gates);
  const gates = { ...legacyGates, ...objectValue(rules.media_quality_gates) };
  return {
    maxBilibiliLeadAgeDays: boundedNumber(
      gates.max_bilibili_lead_age_days ?? gates.maxBilibiliLeadAgeDays,
      DEFAULT_QUALITY_GATES.maxBilibiliLeadAgeDays,
      1,
      3650
    ),
    lowScoreThreshold: boundedNumber(
      gates.media_low_score_threshold ?? gates.low_score_threshold ?? gates.lowScoreThreshold,
      DEFAULT_QUALITY_GATES.lowScoreThreshold,
      -100,
      100
    ),
    probeConfig: String(gates.probe_config ?? gates.probeConfig ?? DEFAULT_QUALITY_GATES.probeConfig)
  };
}

export function radarDiversityConfigFromRules(rules = {}) {
  const raw = objectValue(rules.radar_diversity);
  const fallback = DEFAULT_RADAR_DIVERSITY;
  return {
    limit: boundedNumber(raw.limit, fallback.limit, 1, 100),
    sourceCap: boundedNumber(raw.source_cap ?? raw.sourceCap, fallback.sourceCap, 1, 100),
    familyCap: boundedNumber(raw.family_cap ?? raw.familyCap, fallback.familyCap, 1, 100),
    regionCap: boundedNumber(raw.region_cap ?? raw.regionCap, fallback.regionCap, 1, 100),
    targets: normalizeRadarTargets(raw.targets ?? fallback.targets)
  };
}

function normalizeMediaSources(sources) {
  return sources.map(normalizeMediaSource).filter((source) => source.name && source.type && source.url);
}

function normalizeMediaSource(source) {
  const type = String(source.type ?? "page");
  const query = source.query ?? source.keyword;
  const fallbackQuery = source.fallback_query ?? source.fallbackQuery ?? query;
  const normalized = {
    name: String(source.name ?? ""),
    url: String(source.url ?? ""),
    type,
    quality: boundedNumber(source.quality, 0, 0, 100),
    focus: Array.isArray(source.focus) ? source.focus.map(String) : []
  };
  if (source.active === false) normalized.active = false;
  const disabledReason = source.disabledReason ?? source.disabled_reason;
  if (disabledReason) normalized.disabledReason = String(disabledReason);
  if (!normalized.url && type === "bilibili_video_search" && query) {
    normalized.url = bilibiliSearchApi(query);
  }
  const fallbackUrl = source.fallbackUrl ?? source.fallback_url ?? (type === "bilibili_video_search" && fallbackQuery ? bilibiliSearchPage(fallbackQuery) : "");
  if (fallbackUrl) normalized.fallbackUrl = String(fallbackUrl);
  const activeUntil = source.activeUntil ?? source.active_until;
  if (activeUntil) normalized.activeUntil = String(activeUntil);
  return normalized;
}

function normalizeRadarTargets(targets) {
  return (Array.isArray(targets) && targets.length ? targets : DEFAULT_RADAR_DIVERSITY.targets)
    .map((target) => {
      const normalized = {
        count: boundedNumber(target.count, 1, 1, 100)
      };
      if (target.category) normalized.category = String(target.category);
      if (Array.isArray(target.categories)) normalized.categories = target.categories.map(String);
      if (target.region) normalized.region = String(target.region);
      return normalized;
    })
    .filter((target) => target.category || target.categories?.length);
}

function bilibiliSearchApi(keyword) {
  const url = new URL("https://api.bilibili.com/x/web-interface/search/type");
  url.searchParams.set("search_type", "video");
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "20");
  url.searchParams.set("order", "pubdate");
  return url.toString();
}

function bilibiliSearchPage(keyword) {
  const url = new URL("https://search.bilibili.com/all");
  url.searchParams.set("keyword", keyword);
  return url.toString();
}

function cloneRadarDiversity(value) {
  return {
    ...value,
    targets: value.targets.map((target) => {
      const cloned = { ...target };
      if (target.categories) cloned.categories = [...target.categories];
      return cloned;
    })
  };
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function filesystemPath(value) {
  return value instanceof URL ? fileURLToPath(value) : String(value);
}
