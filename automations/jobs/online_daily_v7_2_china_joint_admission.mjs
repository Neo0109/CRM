import { normalizeDisplayText, normalizeText, normalizeUrl } from "./online_daily_v4_dedupe.mjs";
import { hasMatureChinaPartner } from "./online_daily_v4_source_utils.mjs";
import { candidateDedupeKey } from "./online_daily_v7_indie_admission.mjs";

export const CHINA_JOINT_RULE_VERSION = "sourcing-rules-v7.2.3-official-gameplay-value";

export const CHINA_JOINT_GATE_IDS = [
  "identity_and_dedupe",
  "traction_or_proven_team_event",
  "current_china_opportunity",
  "mature_china_partner_clear"
];

const CHINA_OPPORTUNITY_TYPES = new Set([
  "china_publishing",
  "china_license",
  "china_localization",
  "china_marketing",
  "china_mobile",
  "china_joint_operations"
]);

export function evaluateChinaJointAdmission(input = {}) {
  const evidence = normalizeChinaJointEvidence(input);
  const gateResults = [
    identityGate(evidence),
    tractionGate(evidence),
    chinaOpportunityGate(evidence),
    chinaPartnerGate(evidence)
  ];
  const failed = gateResults.filter((gate) => gate.status === "fail" || gate.status === "unknown");
  const qualified = failed.length === 0;
  const hardFailure = failed.some((gate) => gate.status === "fail");

  return {
    qualified,
    disposition: qualified ? "formal" : hardFailure ? "excluded" : "candidate",
    sourcing_lane: "china_joint",
    sourcing_rule_version: CHINA_JOINT_RULE_VERSION,
    evidence,
    gate_results: gateResults,
    failed_gates: failed.map((gate) => gate.id),
    matched_rules: [
      ...gateResults
        .filter((gate) => gate.status === "pass")
        .map((gate) => `v7_2_china_joint/${gate.matched_rule ?? gate.id}`),
      qualified ? "v7_2_china_joint/qualified" : null
    ].filter(Boolean),
    missing_evidence: failed.filter((gate) => gate.status === "unknown").map((gate) => gate.id),
    exclusion_reasons: failed.filter((gate) => gate.status === "fail").map((gate) => gate.reason)
  };
}

export function evaluateSteamChinaJointAdmission(candidate = {}) {
  return evaluateChinaJointAdmission(steamChinaJointEvidence(candidate));
}

export function evaluateMediaChinaJointAdmission(lead = {}) {
  return evaluateChinaJointAdmission(mediaChinaJointEvidence(lead));
}

export function steamChinaJointEvidence(candidate = {}) {
  const project = normalizeDisplayText(candidate.title ?? candidate.project);
  const steamAppId = numericString(candidate.appId ?? candidate.steam_app_id);
  const hasDetails = candidate.hasDetails === true;
  const publishers = Array.isArray(candidate.publishers) ? candidate.publishers : [];
  const chinaOpportunities = normalizeChinaOpportunities(
    candidate.chinaOpportunityEvidence
      ?? candidate.china_opportunities
      ?? deriveChinaOpportunityEvidence(candidate.chinaDemandEvidence ?? candidate.china_demand, candidate.storeUrl, true)
  );
  const derived = {
    project,
    steam_app_id: steamAppId,
    dedupe_key: candidateDedupeKey({ project, steam_app_id: steamAppId }),
    recommendation_count: hasDetails ? numberOrNull(candidate.recommendationCount) ?? 0 : null,
    review_rating: normalizeReviewRating(candidate.reviewRating ?? candidate.review_rating ?? candidate.reviewText),
    verified_major_title_records: candidate.verifiedMajorTitleRecords ?? candidate.verified_major_title_records,
    current_official_product_events: candidate.currentOfficialProductEvents
      ?? candidate.current_official_product_events
      ?? steamCurrentOfficialProductEvents(candidate),
    china_opportunities: chinaOpportunities,
    china_opportunity_state: normalizeOpportunityState(
      candidate.chinaOpportunityState ?? candidate.china_opportunity_state,
      chinaOpportunities,
      candidate.chinaDemandAbsent === true
    ),
    china_partner_occupancy: normalizePartnerOccupancy(
      candidate.chinaPartnerOccupancy ?? candidate.china_partner_occupancy,
      candidate.chinaPartnerOccupied ?? candidate.china_partner_occupied,
      hasDetails,
      publishers
    )
  };
  return mergeExplicitEvidence(derived, candidate._chinaJointAdmissionEvidence);
}

export function mediaChinaJointEvidence(lead = {}) {
  const details = lead?._steamEntityResolution?.details ?? null;
  const project = normalizeDisplayText(lead.project ?? lead.title ?? details?.name);
  const steamAppId = numericString(lead.steam_app_id ?? lead.appId);
  const publishers = Array.isArray(details?.publishers) ? details.publishers : [];
  const sourceText = [
    lead.chinaDemandEvidence,
    lead.china_demand,
    lead?._mediaItem?.title,
    lead?._mediaItem?.summary,
    lead.progress,
    lead.public_signals
  ].filter(Boolean).join(" ");
  const sourceUrl = lead?._mediaItem?.link ?? (lead.links ?? []).find(Boolean) ?? null;
  const chinaOpportunities = normalizeChinaOpportunities(
    lead.chinaOpportunityEvidence
      ?? lead.china_opportunities
      ?? deriveChinaOpportunityEvidence(sourceText, sourceUrl, lead._officialSourceMatched === true)
  );
  const derived = {
    project,
    steam_app_id: steamAppId,
    dedupe_key: candidateDedupeKey({ project, steam_app_id: steamAppId }),
    recommendation_count: details ? numberOrNull(details?.recommendations?.total) ?? 0 : null,
    review_rating: normalizeReviewRating(lead.reviewRating ?? lead.review_rating ?? lead.reviewText),
    verified_major_title_records: lead.verifiedMajorTitleRecords ?? lead.verified_major_title_records,
    current_official_product_events: lead.currentOfficialProductEvents
      ?? lead.current_official_product_events
      ?? mediaCurrentOfficialProductEvents(lead),
    china_opportunities: chinaOpportunities,
    china_opportunity_state: normalizeOpportunityState(
      lead.chinaOpportunityState ?? lead.china_opportunity_state,
      chinaOpportunities,
      lead.chinaDemandAbsent === true
    ),
    china_partner_occupancy: normalizePartnerOccupancy(
      lead.chinaPartnerOccupancy ?? lead.china_partner_occupancy,
      lead.chinaPartnerOccupied ?? lead.china_partner_occupied,
      Boolean(details),
      publishers
    )
  };
  return mergeExplicitEvidence(derived, lead._chinaJointAdmissionEvidence);
}

export function normalizeReviewRating(value) {
  const text = normalizeText(value).replaceAll("-", "_").replaceAll(" ", "_");
  if (/overwhelmingly_positive|好评如潮/.test(text)) return "overwhelmingly_positive";
  if (/very_positive|特别好评/.test(text)) return "very_positive";
  if (/mostly_positive|多半好评/.test(text)) return "mostly_positive";
  if (/mixed|褒贬不一/.test(text)) return "mixed";
  if (/positive|好评/.test(text)) return "positive";
  return "unknown";
}

export function deriveChinaOpportunityEvidence(value, url = null, official = false) {
  const text = normalizeDisplayText(value);
  if (!text || !/(?:china|chinese|中国|中国区|大陆|中文|简中)/i.test(text)) return [];
  if (!/(?:currently|current|seeking|looking for|needs?|partner|opportunity|计划|正在|当前|寻求|寻找|需要|需求|合作|招募)/i.test(text)) return [];

  const types = [];
  if (/(?:publisher|publishing|发行)/i.test(text)) types.push("china_publishing");
  if (/(?:license|licensing|isbn|版号|授权)/i.test(text)) types.push("china_license");
  if (/(?:locali[sz]ation|translation|本地化|中文化|翻译)/i.test(text)) types.push("china_localization");
  if (/(?:marketing|promotion|creator|营销|推广|宣发|达人)/i.test(text)) types.push("china_marketing");
  if (/(?:mobile|android|ios|手游|移动端)/i.test(text)) types.push("china_mobile");
  if (/(?:joint operation|co-operation|cooperation|live ops|运营|联运|联合运营)/i.test(text)) types.push("china_joint_operations");

  return [...new Set(types)].map((type) => ({
    type,
    value: text,
    url,
    current: true,
    official
  }));
}

function normalizeChinaJointEvidence(input) {
  const opportunities = normalizeChinaOpportunities(input.china_opportunities);
  return {
    project: normalizeDisplayText(input.project ?? input.title),
    steam_app_id: numericString(input.steam_app_id ?? input.appId),
    dedupe_key: cleanEvidenceText(input.dedupe_key) ?? candidateDedupeKey(input),
    recommendation_count: numberOrNull(input.recommendation_count),
    review_rating: normalizeReviewRating(input.review_rating),
    verified_major_title_records: normalizeVerifiedMajorTitleRecords(input.verified_major_title_records),
    current_official_product_events: normalizeCurrentOfficialEvents(input.current_official_product_events),
    china_opportunities: opportunities,
    china_opportunity_state: normalizeOpportunityState(input.china_opportunity_state, opportunities, false),
    china_partner_occupancy: enumState(input.china_partner_occupancy, ["clear", "occupied", "unknown"])
  };
}

function mergeExplicitEvidence(derived, explicit) {
  if (!explicit || typeof explicit !== "object" || Array.isArray(explicit)) return normalizeChinaJointEvidence(derived);
  return normalizeChinaJointEvidence({ ...derived, ...explicit });
}

function identityGate(evidence) {
  return normalizeText(evidence.project) && cleanEvidenceText(evidence.dedupe_key)
    ? passGate("identity_and_dedupe")
    : unknownGate("identity_and_dedupe", "normalized project identity and dedupe key are required");
}

function tractionGate(evidence) {
  if (evidence.recommendation_count !== null && evidence.recommendation_count >= 5000) {
    return passGate("traction_or_proven_team_event", "steam_recommendations_5000");
  }
  if (
    evidence.recommendation_count !== null
    && evidence.recommendation_count >= 1500
    && ["very_positive", "overwhelmingly_positive"].includes(evidence.review_rating)
  ) {
    return passGate("traction_or_proven_team_event", "steam_recommendations_1500_very_positive");
  }
  if (evidence.verified_major_title_records.length && evidence.current_official_product_events.length) {
    return passGate("traction_or_proven_team_event", "verified_major_title_and_current_official_event");
  }
  if (evidence.recommendation_count === null) {
    return unknownGate(
      "traction_or_proven_team_event",
      "Steam recommendations or verified major-title record plus current official product event are required"
    );
  }
  return failGate(
    "traction_or_proven_team_event",
    "project does not meet the locked Steam recommendation/rating threshold or verified-team current-event path"
  );
}

function chinaOpportunityGate(evidence) {
  if (evidence.china_opportunity_state === "absent") {
    return failGate("current_china_opportunity", "no current China publishing, license, localization, marketing, mobile, or joint-operation need exists");
  }
  if (evidence.china_opportunity_state === "present" && evidence.china_opportunities.length) {
    return passGate("current_china_opportunity");
  }
  return unknownGate("current_china_opportunity", "current China business-need evidence is required");
}

function chinaPartnerGate(evidence) {
  if (evidence.china_partner_occupancy === "clear") return passGate("mature_china_partner_clear");
  if (evidence.china_partner_occupancy === "occupied") {
    return failGate("mature_china_partner_clear", "a mature China partner already occupies the opportunity");
  }
  return unknownGate("mature_china_partner_clear", "mature China-partner occupancy must be confirmed clear");
}

function passGate(id, matchedRule = null) {
  return { id, status: "pass", reason: null, matched_rule: matchedRule };
}

function failGate(id, reason) {
  return { id, status: "fail", reason, matched_rule: null };
}

function unknownGate(id, reason) {
  return { id, status: "unknown", reason, matched_rule: null };
}

function steamCurrentOfficialProductEvents(candidate) {
  if (candidate.hasDetails !== true) return [];
  if (!/(?:featured|upcoming|demo|next fest|top sellers|new releases|current product event)/i.test(String(candidate.source ?? ""))) return [];
  return [{
    type: "official_steam_product_event",
    value: normalizeDisplayText(candidate.source),
    url: candidate.storeUrl ?? (candidate.appId ? `https://store.steampowered.com/app/${candidate.appId}/` : null),
    official: true,
    current: true
  }];
}

function mediaCurrentOfficialProductEvents(lead) {
  if (lead._officialSourceMatched !== true || !lead?._mediaItem?.link) return [];
  return [{
    type: "official_media_product_event",
    value: normalizeDisplayText(lead._mediaItem.title ?? lead._mediaItem.summary) || "current official product event",
    url: lead._mediaItem.link,
    official: true,
    current: true
  }];
}

function normalizeVerifiedMajorTitleRecords(values) {
  return normalizeEvidenceList(values).filter((entry) => entry.verified === true && cleanEvidenceText(entry.title ?? entry.value) && cleanEvidenceText(entry.url));
}

function normalizeCurrentOfficialEvents(values) {
  return normalizeEvidenceList(values).filter((entry) => entry.official === true && entry.current === true && cleanEvidenceText(entry.value ?? entry.title) && cleanEvidenceText(entry.url));
}

function normalizeChinaOpportunities(values) {
  return normalizeEvidenceList(values).filter((entry) => CHINA_OPPORTUNITY_TYPES.has(entry.type) && entry.current === true && cleanEvidenceText(entry.value ?? entry.url));
}

function normalizeOpportunityState(value, opportunities, explicitlyAbsent) {
  if (explicitlyAbsent || value === "absent") return "absent";
  if (opportunities.length || value === "present") return "present";
  return "unknown";
}

function normalizePartnerOccupancy(value, occupied, hasDetails, publishers) {
  if (["clear", "occupied", "unknown"].includes(value)) return value;
  if (occupied === true) return "occupied";
  if (occupied === false) return "clear";
  if (hasDetails) return hasMatureChinaPartner(publishers) ? "occupied" : "clear";
  return "unknown";
}

function normalizeEvidenceList(values) {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  const seen = new Set();
  const normalized = [];
  for (const value of list) {
    const entry = value && typeof value === "object" && !Array.isArray(value)
      ? { ...value }
      : { value: String(value ?? "") };
    const content = String(entry.url ?? entry.value ?? entry.title ?? "").trim();
    const key = normalizeUrl(content) || normalizeText(`${entry.type ?? ""} ${content}`);
    if (!content || !key || seen.has(key)) continue;
    normalized.push(entry);
    seen.add(key);
  }
  return normalized;
}

function enumState(value, allowed) {
  return allowed.includes(value) ? value : "unknown";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function numericString(value) {
  const text = String(value ?? "").trim();
  return /^\d+$/.test(text) ? text : null;
}

function cleanEvidenceText(value) {
  const text = normalizeDisplayText(value);
  return text && !/^(?:null|undefined)$/i.test(text) ? text : null;
}
