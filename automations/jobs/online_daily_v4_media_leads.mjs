import { enforceLeadSteamEvidence } from "./bilibili_evidence.mjs";
import { dedupeMediaSignals, normalizeText, normalizeUrl } from "./online_daily_v4_dedupe.mjs";
import {
  hasStrongMediaLeadEvidence,
  isDomesticMediaRescueSignal,
  isExpandedDomesticProductSignal,
  isGenericMediaProjectName,
  isChinaJointMediaSourcingSignal,
  isProductSourcingSignal,
  isUnusableMediaProjectName,
  mediaSignalToLead
} from "./online_daily_v4_media_entities.mjs";
import { enrichMediaLeadsWithSteamContext } from "./online_daily_v4_media_enrichment.mjs";
import { looseChineseProjectKey } from "./online_daily_v4_source_utils.mjs";
import { recordMediaLeadCandidates } from "./online_daily_v4_source_health.mjs";
import { classifyMediaDisposition } from "./online_daily_v4_media_rules.mjs";

export async function buildMediaLeadCandidates(items, existingIndex, context = {}) {
  const diagnostics = context.diagnostics ?? {};
  const dedupedItems = dedupeMediaSignals(items);
  for (const item of dedupedItems) {
    const disposition = classifyMediaDisposition(item).kind;
    if (disposition === "radar_only") diagnostics.media_radar_only = (diagnostics.media_radar_only ?? 0) + 1;
    if (disposition === "reject") diagnostics.media_rejected = (diagnostics.media_rejected ?? 0) + 1;
  }

  const {
    strict: strictSourceItems,
    expanded: expandedSourceItems,
    rescue: rescueSourceItems
  } = partitionMediaLeadSourceItems(dedupedItems);
  const strictLeadCandidates = strictSourceItems
    .map((item) => mediaSignalToLead(item, "strict", context))
    .sort((a, b) => (b.media_score ?? 0) - (a.media_score ?? 0));
  const strictLeads = filterNewMediaCandidates(strictLeadCandidates, existingIndex, diagnostics, { beforeSteamEnrichment: true });

  diagnostics.media_expanded_product_candidates = (diagnostics.media_expanded_product_candidates ?? 0) + expandedSourceItems.length;
  const expandedLeadCandidates = expandedSourceItems
    .map((item) => mediaSignalToLead(item, "expanded", context))
    .sort((a, b) => (b.media_score ?? 0) - (a.media_score ?? 0));
  const expandedLeads = filterNewMediaCandidates(expandedLeadCandidates, existingIndex, diagnostics, { beforeSteamEnrichment: true });

  diagnostics.media_rescue_product_candidates = (diagnostics.media_rescue_product_candidates ?? 0) + rescueSourceItems.length;
  const rescueLeadCandidates = rescueSourceItems
    .map((item) => mediaSignalToLead(item, "rescue", context))
    .sort((a, b) => (b.media_score ?? 0) - (a.media_score ?? 0));
  const rescueLeads = filterNewMediaCandidates(rescueLeadCandidates, existingIndex, diagnostics, { beforeSteamEnrichment: true });

  const sourceCandidateItems = new Set([...strictSourceItems, ...expandedSourceItems, ...rescueSourceItems]);
  diagnostics.media_non_product_filtered = (diagnostics.media_non_product_filtered ?? 0) + dedupedItems.length - sourceCandidateItems.size;

  const preEnrichmentCandidates = [...strictLeads, ...expandedLeads, ...rescueLeads];
  const enrichMediaLeads = context.enrichMediaLeadsWithSteamContextImpl ?? enrichMediaLeadsWithSteamContext;
  const verifiedCandidates = preEnrichmentCandidates.length
    ? await enrichMediaLeads(preEnrichmentCandidates, context)
    : [];
  const verifiedLeads = [];
  for (const candidate of verifiedCandidates) {
    const integrity = enforceLeadSteamEvidence(candidate, diagnostics);
    const lead = integrity.lead;
    if (!integrity.valid) continue;

    if (lead._mediaDisposition === "radar_only" || lead._mediaDisposition === "reject") {
      recordSteamEvidenceOutcome(lead, diagnostics, "steam_evidence_released_filtered");
      continue;
    }
    if (!isNewMediaLead(lead, existingIndex)) {
      diagnostics.media_duplicate_filtered = (diagnostics.media_duplicate_filtered ?? 0) + 1;
      recordSteamEvidenceOutcome(lead, diagnostics, "steam_evidence_duplicate_merged");
      continue;
    }
    recordSteamEvidenceOutcome(
      lead,
      diagnostics,
      lead._steamEntityResolution?.relation === "demo_of"
        ? "steam_demo_parent_converted"
        : "steam_evidence_materialized"
    );
    verifiedLeads.push(lead);
  }

  finalizeSteamEvidenceAccounting(diagnostics);
  const selected = [...verifiedLeads];
  recordMediaLeadCandidates(diagnostics, selected);
  return selected;
}

export function partitionMediaLeadSourceItems(items) {
  const lanes = { strict: [], expanded: [], rescue: [] };
  for (const item of items) {
    if (isProductSourcingSignal(item) || isChinaJointMediaSourcingSignal(item)) {
      lanes.strict.push(item);
      continue;
    }
    if (lanes.expanded.length < 48 && isExpandedDomesticProductSignal(item)) {
      lanes.expanded.push(item);
      continue;
    }
    if (lanes.rescue.length < 64 && isDomesticMediaRescueSignal(item)) {
      lanes.rescue.push(item);
    }
  }
  return lanes;
}

function filterNewMediaCandidates(leads, existingIndex, diagnostics, options) {
  const kept = [];
  for (const lead of leads) {
    if (isNewMediaLead(lead, existingIndex, options)) {
      kept.push(lead);
      continue;
    }
    diagnostics.media_duplicate_filtered = (diagnostics.media_duplicate_filtered ?? 0) + 1;
    recordSteamEvidenceOutcome(lead, diagnostics, "steam_evidence_duplicate_merged");
  }
  return kept;
}

function recordSteamEvidenceOutcome(lead, diagnostics, key) {
  if (!lead?._steamEvidencePrimary || lead._steamEvidenceOutcome) return;
  diagnostics[key] = (diagnostics[key] ?? 0) + 1;
  lead._steamEvidenceOutcome = key;
}

function finalizeSteamEvidenceAccounting(diagnostics) {
  const detected = diagnostics.steam_links_detected ?? 0;
  let accounted = [
    "steam_evidence_materialized",
    "steam_demo_parent_converted",
    "steam_evidence_released_filtered",
    "steam_evidence_duplicate_merged",
    "steam_evidence_lost"
  ].reduce((sum, key) => sum + (diagnostics[key] ?? 0), 0);
  if (accounted < detected) {
    diagnostics.steam_evidence_lost = (diagnostics.steam_evidence_lost ?? 0) + detected - accounted;
    accounted = detected;
  }
  diagnostics.steam_evidence_accounted = accounted;
  diagnostics.steam_evidence_accounting_ok = accounted === detected;
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
