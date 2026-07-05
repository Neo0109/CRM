import { dedupeMediaSignals, normalizeText, normalizeUrl } from "./online_daily_v4_dedupe.mjs";
import {
  hasStrongMediaLeadEvidence,
  isDomesticMediaRescueSignal,
  isExpandedDomesticProductSignal,
  isGenericMediaProjectName,
  isProductSourcingSignal,
  isUnusableMediaProjectName,
  mediaSignalToLead
} from "./online_daily_v4_media_entities.mjs";
import { enrichMediaLeadsWithSteamContext } from "./online_daily_v4_media_enrichment.mjs";
import { looseChineseProjectKey } from "./online_daily_v4_source_utils.mjs";

export async function buildMediaLeadCandidates(items, existingIndex, context = {}) {
  const diagnostics = context.diagnostics ?? {};
  const sourceCount = new Map();
  const dedupedItems = dedupeMediaSignals(items);
  const strictSourceItems = dedupedItems.filter(isProductSourcingSignal);
  const strictLeadCandidates = strictSourceItems
    .filter(isProductSourcingSignal)
    .map((item) => mediaSignalToLead(item, "strict", context))
    .sort((a, b) => (b.media_score ?? 0) - (a.media_score ?? 0));
  const strictLeads = strictLeadCandidates.filter((lead) => isNewMediaLead(lead, existingIndex, { beforeSteamEnrichment: true }));
  diagnostics.media_duplicate_filtered = (diagnostics.media_duplicate_filtered ?? 0) + strictLeadCandidates.length - strictLeads.length;

  const expandedSourceItems = dedupedItems
    .filter((item) => !isProductSourcingSignal(item) && isExpandedDomesticProductSignal(item))
    .slice(0, 48);
  diagnostics.media_expanded_product_candidates = (diagnostics.media_expanded_product_candidates ?? 0) + expandedSourceItems.length;
  const expandedLeadCandidates = expandedSourceItems
    .map((item) => mediaSignalToLead(item, "expanded", context))
    .sort((a, b) => (b.media_score ?? 0) - (a.media_score ?? 0));
  const expandedLeads = expandedLeadCandidates.filter((lead) => isNewMediaLead(lead, existingIndex, { beforeSteamEnrichment: true }));
  diagnostics.media_duplicate_filtered = (diagnostics.media_duplicate_filtered ?? 0) + expandedLeadCandidates.length - expandedLeads.length;

  const rescueSourceItems = dedupedItems
    .filter((item) => !strictSourceItems.includes(item) && !expandedSourceItems.includes(item) && isDomesticMediaRescueSignal(item))
    .slice(0, 64);
  diagnostics.media_rescue_product_candidates = (diagnostics.media_rescue_product_candidates ?? 0) + rescueSourceItems.length;
  const rescueLeadCandidates = rescueSourceItems
    .map((item) => mediaSignalToLead(item, "rescue", context))
    .sort((a, b) => (b.media_score ?? 0) - (a.media_score ?? 0));
  const rescueLeads = rescueLeadCandidates.filter((lead) => isNewMediaLead(lead, existingIndex, { beforeSteamEnrichment: true }));
  diagnostics.media_duplicate_filtered = (diagnostics.media_duplicate_filtered ?? 0) + rescueLeadCandidates.length - rescueLeads.length;

  const sourceCandidateItems = new Set([...strictSourceItems, ...expandedSourceItems, ...rescueSourceItems]);
  diagnostics.media_non_product_filtered = (diagnostics.media_non_product_filtered ?? 0) + dedupedItems.length - sourceCandidateItems.size;

  const verifiedCandidates = await enrichMediaLeadsWithSteamContext([...strictLeads, ...expandedLeads, ...rescueLeads], context);
  const verifiedLeads = verifiedCandidates.filter((lead) => isNewMediaLead(lead, existingIndex));
  diagnostics.media_duplicate_filtered = (diagnostics.media_duplicate_filtered ?? 0) + verifiedCandidates.length - verifiedLeads.length;
  return selectBalancedMediaLeadCandidates(verifiedLeads, sourceCount, 30);
}

export function selectBalancedMediaLeadCandidates(leads, sourceCount, limit) {
  const selected = [];
  for (const lead of leads) {
    const source = lead.public_signals?.split(" / ")[0] ?? "unknown";
    if ((sourceCount.get(source) ?? 0) >= 5) continue;
    selected.push(lead);
    sourceCount.set(source, (sourceCount.get(source) ?? 0) + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}

export function isNewMediaLead(lead, existingIndex, options = {}) {
  if (!lead.project) return false;
  const projectKey = normalizeText(lead.project);
  if (!projectKey || existingIndex.projects.has(projectKey)) return false;
  const looseKey = looseChineseProjectKey(lead.project);
  if (looseKey && existingIndex.projectLooseKeys.has(looseKey)) return false;
  if (isUnusableMediaProjectName(lead.project) && !(options.beforeSteamEnrichment && lead.steam_app_id)) return false;
  if (isGenericMediaProjectName(lead.project) && !hasStrongMediaLeadEvidence(lead) && !(options.beforeSteamEnrichment && lead.steam_app_id)) return false;
  if (lead.steam_app_id && existingIndex.steamAppIds.has(normalizeText(lead.steam_app_id))) return false;
  for (const link of lead.links ?? []) {
    const normalizedLink = normalizeUrl(link);
    if (existingIndex.links.has(normalizedLink)) return false;
    if (existingIndex.keys.has(`link:${normalizedLink}`)) return false;
  }
  for (const key of automationLeadKeys(lead)) {
    if (existingIndex.keys.has(key)) return false;
  }
  if (/^(媒体|b站|今日亮点|行业新闻|国产游戏|独立游戏|游戏|steam|demo|pv|实机|试玩|新作|上线|公布|预告)$/i.test(projectKey)) return false;
  return true;
}

function automationLeadKeys(lead) {
  const keys = [];
  if (lead.project) keys.push(`project:${normalizeText(lead.project)}`);
  if (lead.steam_app_id) keys.push(`steam:${normalizeText(lead.steam_app_id)}`);
  for (const link of lead.links ?? []) keys.push(`link:${normalizeUrl(link)}`);
  return keys;
}

export {
  collectMediaContactMethods,
  collectMediaVerificationLinks,
  extractMediaProjectName,
  hasStrongMediaLeadEvidence,
  inferContactTypeFromLink,
  inferMediaGenre,
  isDomesticMediaRescueSignal,
  isExpandedDomesticProductSignal,
  isGenericMediaProjectName,
  isProductSourcingSignal,
  isUnusableMediaProjectName,
  mediaLeadScore,
  mediaSignalToLead
} from "./online_daily_v4_media_entities.mjs";

export {
  enrichMediaLeadWithOfficialBilibiliContext,
  enrichMediaLeadWithSteamContext,
  enrichMediaLeadsWithSteamContext,
  finalizeMediaLeadDecisionFields,
  mediaLeadToDrop,
  shouldPreferSteamName
} from "./online_daily_v4_media_enrichment.mjs";

export {
  bilibiliAuthor,
  hasAlreadyReleasedMediaText,
  isOfficialOrDeveloperBilibiliSignal
} from "./online_daily_v4_media_rules.mjs";
