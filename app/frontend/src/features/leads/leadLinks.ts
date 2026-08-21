import type { ContactMethod, Lead } from "../../types";
import { collectLeadEvidenceLinks, resolveLeadSteamTarget } from "../../leadEvidence";
import { linkLabel, normalizedLinkHref } from "../../linkPresentation";

export { linkLabel, normalizedLinkHref } from "../../linkPresentation";

export type NormalizedSteamLink = {
  appId: string;
  storeUrl: string;
  steamDbUrl: string;
};

export type LeadLinkShortcut = {
  href: string;
  label: string;
  title: string;
};

export function normalizeSteamLinkInput(value: string): NormalizedSteamLink | null {
  const appId = steamAppIdFromText(value);
  if (!appId) return null;
  return {
    appId,
    storeUrl: `https://store.steampowered.com/app/${appId}/`,
    steamDbUrl: `https://steamdb.info/app/${appId}/`
  };
}

export function applySteamLinkToLead(lead: Lead, steam: NormalizedSteamLink): Lead {
  return {
    ...lead,
    steam_app_id: lead.steam_app_id || steam.appId,
    links: mergeLinks([steam.storeUrl, steam.steamDbUrl, ...lead.links])
  };
}

export function visibleContacts(contacts: ContactMethod[]) {
  return contacts.filter((method) => !isGameLink(method.value));
}

export function gameLinks(links: string[]) {
  return links.filter(isGameLink).slice(0, 2);
}

export function buildLeadLinkShortcuts(lead: Lead): LeadLinkShortcut[] {
  const steamTarget = resolveLeadSteamTarget(lead);
  const eligibleLinks = collectLeadEvidenceLinks(lead).filter(isGameLink);
  const nonSteamLinks = eligibleLinks.filter((link) => !isSteamAppLink(link));
  const bilibiliLinks = nonSteamLinks.filter(isBilibiliLink);
  const otherLinks = nonSteamLinks.filter((link) => !isBilibiliLink(link));
  const orderedLinks = [
    ...(steamTarget ? [steamTarget.storeUrl] : []),
    ...(steamTarget ? [...bilibiliLinks, ...otherLinks] : eligibleLinks)
  ];
  const shortcuts: LeadLinkShortcut[] = [];
  const seenHrefs = new Set<string>();
  const seenPlatforms = new Set<string>();

  for (const link of orderedLinks) {
    const href = normalizedLinkHref(link);
    const label = linkLabel(link);
    const hrefKey = href.toLowerCase().replace(/\/$/, "");
    const platformKey = label.toLowerCase();
    if (seenHrefs.has(hrefKey) || seenPlatforms.has(platformKey)) continue;
    seenHrefs.add(hrefKey);
    seenPlatforms.add(platformKey);
    shortcuts.push({ href, label, title: link });
  }

  return shortcuts.slice(0, 2);
}

export function needsGameLinkTriage(lead: Lead) {
  const isDropped = lead.bucket === "淘汰池" || lead.review_status === "已淘汰" || lead.stage === "rejected";
  return !isDropped && !gameLinks(lead.links).length;
}

export function contactLabel(method: ContactMethod) {
  const value = method.value.trim();
  if (!isHttpUrl(value)) {
    if (method.type === "Email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Email";
    if (method.type === "电话") return "电话";
    if (method.type === "微信/QQ") return "微信/QQ";
    return `${method.type}: ${value}`;
  }
  if (/steamdb/i.test(value)) return "SteamDB";
  if (/steam(?:powered|community)/i.test(value) || method.type === "Steam") return "Steam";
  if (/discord/i.test(value) || method.type === "Discord") return "Discord";
  if (/instagram/i.test(value)) return "Instagram";
  if (/(?:twitter|x\.com)/i.test(value) || method.type === "X/Twitter") return "X";
  if (/bilibili/i.test(value) || method.type === "B站") return "B站";
  if (method.type === "官网") return "官网";
  return linkLabel(value);
}

function steamAppIdFromText(value: string) {
  const trimmed = value.trim();
  if (/^\d{3,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:store\.steampowered\.com|steamcommunity\.com|steamdb\.info)\/app\/(\d+)/i);
  return match?.[1] ?? null;
}

function mergeLinks(links: string[]) {
  const deduped = new Map<string, string>();
  for (const link of links) {
    const trimmed = link.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase().replace(/\/$/, "");
    if (!deduped.has(key)) deduped.set(key, trimmed);
  }
  return Array.from(deduped.values());
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isGameLink(link: string) {
  return /(?:store\.steampowered\.com|steamdb\.info|steamcommunity\.com)\/app\/\d+|bilibili\.com|b23\.tv|taptap\.cn|indienova\.com|gcores\.com|yystv\.cn|gamelook\.com\.cn|youxiputao\.com|gameres\.com|youxituoluo\.com|nadianshi\.com|youxichaguan\.com|chuapp\.com|gamersky\.com|3dmgame\.com/i.test(link);
}

function isSteamAppLink(link: string) {
  return /(?:store\.steampowered\.com|steamdb\.info|steamcommunity\.com)\/app\/\d+/i.test(link);
}

function isBilibiliLink(link: string) {
  return /bilibili\.com|b23\.tv/i.test(link);
}
