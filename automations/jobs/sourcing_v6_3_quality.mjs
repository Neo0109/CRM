export function choosePreferredBilibiliSignal(primary, candidates, projectName) {
  const project = normalizeText(projectName);
  if (!project) return primary;

  const scored = candidates
    .map((candidate) => ({ candidate, score: officialBilibiliScore(candidate, project) }))
    .filter(({ score }) => score >= 80)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return primary;
  const primaryScore = officialBilibiliScore(primary, project);
  return best.score > primaryScore ? best.candidate : primary;
}

export function normalizeMediaLinks(values) {
  const links = [];
  for (const value of flattenValues(values)) links.push(...extractUrls(value));
  const appId = steamAppIdFromLinks(links);
  if (appId) {
    links.push(`https://store.steampowered.com/app/${appId}/`);
    links.push(`https://steamdb.info/app/${appId}/`);
  }
  return uniqueLinks(links);
}

export function steamAppIdFromLinks(links) {
  for (const link of flattenValues(links)) {
    const appId = String(link).match(/(?:store\.steampowered\.com|steamcommunity\.com|steamdb\.info)\/app\/(\d+)/i)?.[1];
    if (appId) return appId;
  }
  return null;
}

export function formatMediaGameplay({ title = "", summary = "", genre = "", details = null } = {}) {
  const tags = [];
  addTags(tags, splitGenreTags(genre));
  addTags(tags, (details?.genres ?? []).map((item) => item.description));

  const text = `${title} ${summary} ${genre} ${(details?.genres ?? []).map((item) => item.description).join(" ")} ${(details?.categories ?? []).map((item) => item.description).join(" ")}`
    .replace(/https?:\/\/\S+/gi, " ");
  const keywordTags = [
    [/卡牌|构筑|deck|card/i, "Card/Deckbuilder"],
    [/肉鸽|rogue/i, "Roguelike"],
    [/角色扮演|rpg/i, "RPG"],
    [/策略|战棋|strategy|tactical/i, "Strategy"],
    [/模拟|经营|simulation|management|tycoon/i, "Simulation/Management"],
    [/塔防|tower defense/i, "Tower Defense"],
    [/动作|act\b|action/i, "ACT"],
    [/射击|fps|tps|shooter/i, "Shooter"],
    [/合作|多人|co-op|multiplayer/i, "Co-op/Multiplayer"],
    [/修仙|国风|武侠|山海/i, "国风题材"]
  ];
  for (const [pattern, tag] of keywordTags) {
    if (pattern.test(text)) addTags(tags, [tag]);
  }

  return tags.slice(0, 5).join(" / ") || "玩法待确认";
}

export function formatMediaProgress({ details = null, sourceText = "", reportDate = todayIsoDate(), demoAvailable = false, demoParentResolved = false } = {}) {
  const text = String(sourceText ?? "");
  const comingSoon = Boolean(details?.release_date?.coming_soon);
  const releaseDate = normalizeReleaseDate(details?.release_date?.date);
  const days = daysUntil(releaseDate, reportDate);
  if (details?.type === "demo") return "试玩 Demo";
  if (demoParentResolved && (comingSoon || /coming soon|即将发售|愿望单|商店页/i.test(text))) return "Demo 可玩、正式版未发售";
  if (details?.release_date && !comingSoon && (typeof days !== "number" || days < 0)) return "正式上线";
  if (/early access|抢先体验|EA\b/i.test(text)) return "EA";
  if (demoAvailable || (details?.demos?.length ?? 0) > 0 || /demo|试玩|测试|playtest|试玩版/i.test(text)) return "试玩 Demo";
  if (comingSoon || /coming soon|即将发售|愿望单|商店页/i.test(text)) return "即将发售";
  if (/商店页已上线|商店页面已上线|页面已上线|store page is live/i.test(text)) return "商店页已上线";
  return "待确认";
}

export function deriveMediaDecisionFields({
  title = "",
  source = "媒体/B站",
  confidence = "strict",
  score = 0,
  steamAppId = null,
  progress = "待确认",
  gameplay = "玩法待确认",
  alreadyReleased = false,
  officialSourceMatched = false
} = {}) {
  const sourceSignal = officialSourceMatched ? "官方源已确认" : /b站|bilibili/i.test(source) ? "B站来源待复核" : "媒体来源待复核";
  if (alreadyReleased || progress === "正式上线") {
    return {
      priority_reason: null,
      rule_fit: "正式上线；不进入新线索队列，保留为市场复盘或竞品观察。",
      bilibili_fit: "可看上线后内容热度和用户反馈，但不作为新签约优先线索。",
      amplification: "",
      risks: "已正式上线，合作窗口和权益空间大概率不足。",
      verdict: "",
      next_action: null,
      notes: null
    };
  }

  return {
    priority_reason: null,
    rule_fit: `${progress}；${steamAppId ? "Steam 交叉验证已建立" : sourceSignal}；适合由 BD 先判断产品质量、B站适配和签约概率。`,
    bilibili_fit: "重点看实机/PV可剪辑点、弹幕评论反馈和UP主表达，判断是否能转化为试玩、直播或发行前种草。",
    amplification: "",
    risks: steamAppId ? "仍需确认团队、发行占位和中国区权益空间。" : "缺少Steam交叉验证时，先确认项目真实性、可测版本和官方来源。",
    verdict: "",
    next_action: null,
    notes: null
  };
}

function officialBilibiliScore(item, project) {
  const structuredEvidence = [item.bilibili_evidence?.source_url, ...(item.bilibili_evidence?.urls ?? [])].filter(Boolean).join(" ");
  const rawText = `${item.title ?? ""} ${item.summary ?? ""} ${item.source ?? ""} ${structuredEvidence}`;
  const text = normalizeText(rawText);
  if (!text.includes(project)) return 0;
  const author = bilibiliAuthor(item);
  let score = 20;
  if (normalizeText(item.title).includes(project)) score += 25;
  if (author && (normalizeText(author) === project || normalizeText(author).includes(project) || project.includes(normalizeText(author)))) score += 80;
  if (/官方|开发者|制作组|工作室|发行|开发日志|首曝|pv|实机/i.test(rawText)) score += 24;
  if (/store\.steampowered\.com\/app\/\d+|steam商店页|愿望单|qq群|qq\s*群|discord|官网/i.test(rawText)) score += 38;
  if (/推荐|盘点|合集|几款|必玩|试玩/i.test(`${item.title ?? ""} ${item.source ?? ""}`) && !author.includes(project)) score -= 24;
  return score;
}

function bilibiliAuthor(item) {
  return String(item.summary ?? "").match(/UP主：([^\s]+)/)?.[1] ?? "";
}

function extractUrls(value) {
  const text = String(value ?? "");
  const urls = [...text.matchAll(/https?:\/\/[^\s"'<>，。；、）)】\]]+/gi)]
    .map((match) => trimUrlPunctuation(match[0]));
  const bareSteamUrls = [...text.matchAll(/(?:^|[\s（(【])((?:store\.steampowered\.com|steamcommunity\.com|steamdb\.info)\/app\/\d+[^\s"'<>，。；、）)】\]]*)/gi)]
    .map((match) => `https://${trimUrlPunctuation(match[1])}`);
  return [...urls, ...bareSteamUrls];
}

function uniqueLinks(values) {
  const out = new Map();
  for (const value of values) {
    const clean = trimUrlPunctuation(value);
    if (!/^https?:\/\//i.test(clean)) continue;
    out.set(normalizeUrl(clean), clean);
  }
  return [...out.values()];
}

function splitGenreTags(value) {
  return String(value ?? "")
    .split(/\s*\/\s*|,|，|、/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function addTags(target, values) {
  for (const value of values ?? []) {
    const tag = normalizeGenreTag(value);
    if (tag && !target.includes(tag)) target.push(tag);
  }
}

function normalizeGenreTag(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/card|deck|卡牌|构筑/i.test(text)) return "Card/Deckbuilder";
  if (/role-playing|rpg|角色扮演/i.test(text)) return "RPG";
  if (/strategy|策略/i.test(text)) return "Strategy";
  if (/simulation|模拟/i.test(text)) return "Simulation";
  if (/management|经营|管理/i.test(text)) return "Management";
  if (/indie|独立/i.test(text)) return "Indie";
  if (/casual|休闲/i.test(text)) return "Casual";
  if (/adventure|冒险/i.test(text)) return "Adventure";
  if (/action|动作/i.test(text)) return "ACT";
  return text.replace(/https?:\/\/\S+/g, "").trim();
}

function normalizeReleaseDate(value) {
  const text = String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const chinese = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (chinese) return `${chinese[1]}-${chinese[2].padStart(2, "0")}-${chinese[3].padStart(2, "0")}`;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10);
}

function daysUntil(value, reportDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
  const target = new Date(`${value}T00:00:00+08:00`).getTime();
  const now = new Date(`${reportDate}T00:00:00+08:00`).getTime();
  return Math.round((target - now) / 86400000);
}

function trimUrlPunctuation(value) {
  return String(value ?? "").trim().replace(/[),，。；;、】\]]+$/g, "").replace(/&amp;/g, "&");
}

function flattenValues(values) {
  return Array.isArray(values) ? values.flatMap(flattenValues) : [values];
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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
