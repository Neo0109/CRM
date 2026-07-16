import { normalizeDisplayText, normalizeText, normalizeUrl } from "./online_daily_v4_dedupe.mjs";

export function hasMaturePublisher(publishers) {
  const text = publishers.join(" ").toLowerCase();
  return ["devolver", "raw fury", "annapurna", "team17", "hooded horse", "tinybuild", "kasedo", "kepler", "11 bit", "chucklefish", "humble", "paradox", "focus", "playstack", "fireshine", "nacon", "secret mode", "thunderful", "netea", "tencent", "bilibili", "xd", "gamera", " indienova"].some((name) => text.includes(name.trim()));
}

export function hasMatureChinaPartner(publishers) {
  const text = publishers.join(" ").toLowerCase();
  return [
    "netease",
    "netea",
    "网易",
    "tencent",
    "腾讯",
    "bilibili",
    "哔哩哔哩",
    "xd network",
    "x.d. network",
    "心动",
    "gamera",
    "indienova"
  ].some((name) => text.includes(name));
}

export function looksDomestic(text) {
  return /[\u4e00-\u9fff]/.test(text) || /china|beijing|shanghai|shenzhen|guangzhou|chengdu|hangzhou|wuhan|xiamen|nanjing|suzhou|chongqing/i.test(text);
}

export function isDomesticDiscoveryQuery(query) {
  return /国产|中国|国风|武侠|修仙|仙侠|山海|三国|水墨|国潮|中式|古风/i.test(String(query));
}

export function normalizeReleaseDate(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const chinese = cleaned.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (chinese) return `${chinese[1]}-${chinese[2].padStart(2, "0")}-${chinese[3].padStart(2, "0")}`;
  const parsed = Date.parse(cleaned);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return cleaned || null;
}

export function daysUntil(value, reportDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
  const target = new Date(`${value}T00:00:00+08:00`).getTime();
  const now = new Date(`${reportDate}T00:00:00+08:00`).getTime();
  return Math.round((target - now) / 86400000);
}

export function stripTags(value) {
  return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

export function decodeHtml(value) {
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

export function cleanExtractedText(value) {
  return stripTags(decodeHtml(value)).replace(/\s+/g, " ").trim();
}

export function hasGameOrBdContext(text, item) {
  const broadSources = new Set(["IT之家", "证券时报", "澎湃新闻"]);
  if (!broadSources.has(item.source)) return true;
  return /game|gaming|steam|xbox|playstation|nintendo|switch|publisher|developer|studio|bilibili|acg|ip|游戏|手游|端游|主机|电竞|动画|动漫|发行|发售|上线|资料片|腾讯游戏|网易游戏|米哈游|莉莉丝|心动|鹰角|游族|三体|版权|授权|版号|B站|哔哩哔哩/i.test(text);
}

export function absolutizeUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function trimUrlPunctuation(value) {
  return String(value ?? "")
    .trim()
    .replace(/[),，。；;、】\]]+$/g, "")
    .replace(/&amp;/g, "&");
}

export function extractUrls(value) {
  const text = String(value ?? "");
  const urls = [...text.matchAll(/https?:\/\/[^\s"'<>，。；、）)】\]]+/gi)]
    .map((match) => trimUrlPunctuation(decodeHtml(match[0])));
  const bareSteamUrls = [...text.matchAll(/(?:^|[\s（(【])((?:store\.steampowered\.com|steamcommunity\.com|steamdb\.info)\/app\/\d+[^\s"'<>，。；、）)】\]]*)/gi)]
    .map((match) => `https://${trimUrlPunctuation(decodeHtml(match[1]))}`);
  return mergeLinks([...urls, ...bareSteamUrls]);
}

export function extractEmails(value) {
  return [...String(value ?? "").matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)]
    .map((match) => match[0])
    .filter(Boolean);
}

export function steamAppIdFromLinks(links) {
  for (const link of links) {
    const appId = String(link).match(/(?:store\.steampowered\.com|steamcommunity\.com|steamdb\.info)\/app\/(\d+)/i)?.[1];
    if (appId) return appId;
  }
  return null;
}

export function isSteamStoreLike(value) {
  return /(?:store\.steampowered\.com|steamdb\.info)\/app\/\d+/i.test(String(value));
}

export function firstRealWebsite(...values) {
  return values.find((value) => value && /^https?:\/\//i.test(value) && !isSteamStoreLike(value)) ?? null;
}

export function addContact(methods, type, value, note) {
  const cleanValue = typeof value === "string" ? value.trim() : "";
  if (!cleanValue || isSteamStoreLike(cleanValue)) return;
  const key = normalizeUrl(cleanValue);
  if (methods.some((method) => normalizeUrl(method.value) === key)) return;
  methods.push({ type, value: cleanValue, note });
}

export function mergeLinks(values) {
  const out = new Map();
  for (const value of values) {
    if (!value || typeof value !== "string") continue;
    const cleanValue = trimUrlPunctuation(value);
    if (!/^https?:\/\//i.test(cleanValue)) continue;
    if (!isUsableVerificationUrl(cleanValue)) continue;
    out.set(normalizeUrl(cleanValue), cleanValue);
  }
  return [...out.values()];
}

export function isUsableVerificationUrl(value) {
  try {
    const url = new URL(value);
    if (!url.hostname.includes(".")) return false;
    if (/^https?:\/\/(?:https?|www)$/i.test(value)) return false;
    return true;
  } catch {
    return false;
  }
}

export function mergeContactMethods(values) {
  const out = new Map();
  for (const method of values) {
    if (!method?.value || !method.type) continue;
    const value = trimUrlPunctuation(method.value);
    if (!value || isSteamStoreLike(value)) continue;
    const key = `${method.type}:${normalizeUrl(value)}`;
    if (!out.has(key)) out.set(key, { ...method, value });
  }
  return [...out.values()].slice(0, 6);
}

export function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function looseChineseProjectKey(value) {
  const text = normalizeDisplayText(value)
    .replace(/《|》/g, "")
    .replace(/[\s:：\-_|｜"'“”‘’.,，。!！?？/\\()\[\]【】]+/g, "")
    .toLowerCase();
  const chinese = text.match(/[\u4e00-\u9fff]{2,}/g)?.join("") ?? "";
  if (chinese.length >= 2) return chinese;
  const normalized = normalizeText(text);
  return normalized.length >= 4 ? normalized : "";
}
