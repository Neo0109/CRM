import { normalizeMediaLinks } from "./sourcing_v6_3_quality.mjs";
import { extractEmails, mergeLinks } from "./online_daily_v4_source_utils.mjs";

const steamAppPattern = /(?:store\.steampowered\.com|steamcommunity\.com|steamdb\.info)\/app\/(\d+)/i;

export function extractBilibiliEvidence(item = {}, extraValues = []) {
  const inherited = item.bilibili_evidence && typeof item.bilibili_evidence === "object"
    ? item.bilibili_evidence
    : {};
  const probe = item.bilibili_probe && typeof item.bilibili_probe === "object"
    ? item.bilibili_probe
    : {};
  const rawValues = flattenEvidenceValues([
    item.link,
    item.title,
    item.summary,
    item.description,
    item.desc,
    item.dynamic,
    inherited.urls,
    inherited.source_urls,
    probe.extracted_links,
    extraValues
  ]);
  const normalizedUrls = normalizeMediaLinks(rawValues);
  const inheritedIds = Array.isArray(inherited.steam_app_ids)
    ? inherited.steam_app_ids
    : [inherited.steam_app_id, probe.steam_app_id];
  const steamAppIds = uniqueValues([
    ...inheritedIds.map(normalizeAppId),
    ...normalizedUrls.map(steamAppIdFromUrl)
  ]);
  const canonicalSteamUrls = steamAppIds.flatMap((appId) => [
    "https://store.steampowered.com/app/" + appId + "/",
    "https://steamdb.info/app/" + appId + "/"
  ]);
  const urls = mergeLinks([...normalizedUrls, ...canonicalSteamUrls]);
  const sourceUrls = mergeLinks([
    ...flattenEvidenceValues(inherited.source_urls),
    item.link
  ]).filter(isBilibiliUrl);
  const websiteUrls = urls.filter((url) => !isPlatformOrContactUrl(url));
  const contactUrls = urls.filter((url) => isContactUrl(url));
  const emails = uniqueValues([
    ...flattenEvidenceValues(inherited.emails),
    ...extractEmails(rawValues.join(" "))
  ]);

  return {
    source_url: sourceUrls[0] ?? (isBilibiliUrl(item.link) ? item.link : null),
    source_urls: sourceUrls,
    urls,
    steam_app_id: steamAppIds[0] ?? null,
    steam_app_ids: steamAppIds,
    website_urls: websiteUrls,
    emails,
    contact_urls: contactUrls
  };
}

export function attachBilibiliEvidence(item = {}, extraValues = []) {
  return {
    ...item,
    bilibili_evidence: extractBilibiliEvidence(item, extraValues)
  };
}

export function enforceLeadSteamEvidence(lead, diagnostics = {}) {
  const evidence = lead?._bilibiliEvidence
    ?? lead?._mediaItem?.bilibili_evidence
    ?? lead?.bilibili_evidence
    ?? null;
  if (!evidence) return { lead, valid: true, reason: null };

  const evidenceIds = uniqueValues([
    ...(Array.isArray(evidence.steam_app_ids) ? evidence.steam_app_ids : []),
    evidence.steam_app_id,
    ...flattenEvidenceValues(evidence.urls).map(steamAppIdFromUrl)
  ].map(normalizeAppId));
  if (!evidenceIds.length) return { lead, valid: true, reason: null };

  const resolution = lead?._steamEntityResolution ?? null;
  const canonicalAppId = normalizeAppId(
    resolution?.canonical_app_id
    ?? evidence.steam_app_id
    ?? lead?.steam_app_id
  );
  const allowedIds = new Set([
    normalizeAppId(resolution?.evidence_app_id),
    normalizeAppId(resolution?.canonical_app_id)
  ].filter(Boolean));
  const ambiguous = evidenceIds.length > 1
    && (!allowedIds.size || evidenceIds.some((appId) => !allowedIds.has(appId)));

  if (!canonicalAppId || ambiguous) {
    return integrityFailure(
      lead,
      diagnostics,
      ambiguous ? "ambiguous_steam_evidence" : "missing_canonical_steam_app_id"
    );
  }

  const links = mergeLinks([
    ...(lead?.links ?? []),
    ...(evidence.source_urls ?? []),
    ...(evidence.urls ?? []),
    "https://store.steampowered.com/app/" + canonicalAppId + "/",
    "https://steamdb.info/app/" + canonicalAppId + "/"
  ]);
  const nextLead = {
    ...lead,
    steam_app_id: canonicalAppId,
    links,
    _bilibiliEvidence: evidence
  };
  const hasStore = links.some((link) => new RegExp("store\\.steampowered\\.com/app/" + canonicalAppId + "(?:/|$)", "i").test(link));
  const hasSteamDb = links.some((link) => new RegExp("steamdb\\.info/app/" + canonicalAppId + "(?:/|$)", "i").test(link));

  if (!hasStore || !hasSteamDb) {
    return integrityFailure(nextLead, diagnostics, "canonical_steam_links_missing");
  }
  return { lead: nextLead, valid: true, reason: null };
}

function integrityFailure(lead, diagnostics, reason) {
  if (lead?._steamEvidenceOutcome !== "lost") {
    diagnostics.steam_evidence_lost = (diagnostics.steam_evidence_lost ?? 0) + 1;
  }
  return {
    lead: {
      ...lead,
      _steamEvidenceOutcome: "lost",
      _steamEvidenceIntegrityFailure: reason
    },
    valid: false,
    reason
  };
}

function steamAppIdFromUrl(value) {
  return String(value ?? "").match(steamAppPattern)?.[1] ?? null;
}

function normalizeAppId(value) {
  const appId = String(value ?? "").trim();
  return /^\d+$/.test(appId) ? appId : null;
}

function isBilibiliUrl(value) {
  return /(?:^|\.)bilibili\.com\//i.test(String(value ?? ""));
}

function isContactUrl(value) {
  return /(?:discord\.gg|discord\.com\/invite|x\.com\/|twitter\.com\/|weibo\.com\/|qm\.qq\.com\/|bilibili\.com\/)/i.test(String(value ?? ""));
}

function isPlatformOrContactUrl(value) {
  return /(?:store\.steampowered\.com|steamcommunity\.com|steamdb\.info|bilibili\.com|discord\.gg|discord\.com\/invite|x\.com\/|twitter\.com\/|weibo\.com\/|qm\.qq\.com\/)/i.test(String(value ?? ""));
}

function flattenEvidenceValues(values) {
  const out = [];
  for (const value of Array.isArray(values) ? values : [values]) {
    if (Array.isArray(value)) out.push(...flattenEvidenceValues(value));
    else if (value !== null && value !== undefined && String(value).trim()) out.push(String(value));
  }
  return out;
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}
