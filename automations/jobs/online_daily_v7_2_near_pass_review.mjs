import {
  evaluateMediaIndiePrelaunchAdmission,
  evaluateSteamIndiePrelaunchAdmission
} from "./online_daily_v7_indie_admission.mjs";
import {
  evaluateMediaChinaJointAdmission,
  evaluateSteamChinaJointAdmission
} from "./online_daily_v7_2_china_joint_admission.mjs";

export const NEAR_PASS_REVIEW_LIMIT = 3;

export const NEAR_PASS_GAP_LABELS = Object.freeze({
  independent_quality_proof: "独立质量证明",
  overseas_china_demand: "海外项目中国需求证明",
  traction_or_proven_team_event: "市场牵引或成熟团队事件"
});

const GAP_RANK = Object.freeze({
  independent_quality_proof: 0,
  overseas_china_demand: 1,
  traction_or_proven_team_event: 2
});

export function evaluateSteamNearPassReview(candidate = {}) {
  return evaluateNearPassReview({
    indieAdmission: evaluateSteamIndiePrelaunchAdmission(candidate),
    chinaJointAdmission: evaluateSteamChinaJointAdmission(candidate),
    sourceRegion: candidate.region ?? candidate.country,
    discoveryScore: candidate.discovery_score ?? candidate.score,
    sourceType: "steam"
  });
}

export function evaluateMediaNearPassReview(lead = {}) {
  return evaluateNearPassReview({
    indieAdmission: evaluateMediaIndiePrelaunchAdmission(lead),
    chinaJointAdmission: evaluateMediaChinaJointAdmission(lead),
    sourceRegion: lead.region ?? lead.country,
    discoveryScore: lead.discovery_score ?? lead.media_score ?? lead.score,
    sourceType: "media"
  });
}

export function evaluateNearPassReview({
  indieAdmission,
  chinaJointAdmission,
  sourceRegion = null,
  discoveryScore = 0,
  sourceType = null
} = {}) {
  const indie = evaluateIndieReviewEligibility(indieAdmission, {
    sourceRegion,
    discoveryScore,
    sourceType,
    chinaJointAdmission
  });
  const chinaJoint = evaluateChinaJointReviewEligibility(chinaJointAdmission, indieAdmission, {
    sourceRegion,
    discoveryScore,
    sourceType
  });
  const eligible = [indie, chinaJoint].filter((result) => result.eligible).sort(compareNearPassReviews);
  if (eligible.length) return eligible[0];

  return {
    eligible: false,
    gap_id: null,
    sourcing_lane: null,
    dedupe_key: stableSteamDedupeKey(indieAdmission?.evidence) ?? stableSteamDedupeKey(chinaJointAdmission?.evidence),
    region: normalizedRegion(indieAdmission?.evidence?.region ?? sourceRegion),
    current_official_event: hasCurrentOfficialEvent(chinaJointAdmission),
    discovery_score: finiteScore(discoveryScore),
    source_type: sourceType,
    rejection_reasons: uniqueStrings([...indie.rejection_reasons, ...chinaJoint.rejection_reasons])
  };
}

export function compareNearPassReviews(left, right) {
  const gapDifference = (GAP_RANK[left?.gap_id] ?? Number.MAX_SAFE_INTEGER)
    - (GAP_RANK[right?.gap_id] ?? Number.MAX_SAFE_INTEGER);
  if (gapDifference) return gapDifference;

  const regionDifference = regionRank(left?.region) - regionRank(right?.region);
  if (regionDifference) return regionDifference;

  const eventDifference = Number(Boolean(right?.current_official_event)) - Number(Boolean(left?.current_official_event));
  if (eventDifference) return eventDifference;

  const scoreDifference = finiteScore(right?.discovery_score) - finiteScore(left?.discovery_score);
  if (scoreDifference) return scoreDifference;

  return String(left?.dedupe_key ?? "").localeCompare(String(right?.dedupe_key ?? ""));
}

export function nearPassReviewCopy(gapId) {
  const label = NEAR_PASS_GAP_LABELS[gapId];
  if (!label) throw new Error(`Unsupported near-pass gap: ${gapId}`);
  return {
    rule_fit: `Near-pass 人工复核：唯一缺失 gate=${gapId}（${label}）；其余硬性条件已通过。`,
    risks: `Near-pass 唯一缺口：${gapId}（${label}）；需在首轮试玩/筛选中核验。`,
    verdict: "仅供首轮试玩/筛选，不代表正式商务推进，试玩不成立直接淘汰。"
  };
}

function evaluateIndieReviewEligibility(admission, context) {
  const evidence = admission?.evidence ?? {};
  const rejectionReasons = [];
  const stableKey = stableSteamDedupeKey(evidence);
  if (!numericSteamAppId(evidence.steam_app_id)) rejectionReasons.push("steam_identity");
  if (!stableKey) rejectionReasons.push("stable_dedupe");
  if (evidence.release_state !== "prelaunch" || !["over_60", "tba"].includes(evidence.release_window)) {
    rejectionReasons.push("prelaunch_window");
  }
  if (evidence.early_access_state !== "no") rejectionReasons.push("non_early_access");
  if (evidence.publisher_occupancy !== "clear") rejectionReasons.push("publisher_china_capacity_clear");
  if (evidence.narrative_state !== "no") rejectionReasons.push("non_narrative_product");
  if (evidence.india_team_state !== "no") rejectionReasons.push("non_india_team");
  if (!hasEvidence(evidence.official_demo_evidence) && !hasEvidence(evidence.official_gameplay_evidence)) {
    rejectionReasons.push("official_demo_or_playtest_or_gameplay");
  }
  if (!hasNonSteamBusinessEntry(evidence.business_entrypoints)) rejectionReasons.push("non_steam_business_entry");
  if (!nonemptyText(evidence.china_bilibili_value)) rejectionReasons.push("concrete_china_bilibili_value");

  const region = normalizedRegion(evidence.region ?? context.sourceRegion);
  const softGaps = [];
  if (!hasEvidence(evidence.quality_proofs)) softGaps.push("independent_quality_proof");
  if (region === "overseas" && !nonemptyText(evidence.china_demand)) softGaps.push("overseas_china_demand");
  if (softGaps.length !== 1) rejectionReasons.push("soft_gap_count");

  return reviewResult({
    eligible: rejectionReasons.length === 0 && admission?.qualified !== true,
    gapId: softGaps.length === 1 ? softGaps[0] : null,
    lane: "indie_prelaunch",
    dedupeKey: stableKey,
    region,
    currentOfficialEvent: hasCurrentOfficialEvent(context.chinaJointAdmission),
    discoveryScore: context.discoveryScore,
    sourceType: context.sourceType,
    rejectionReasons
  });
}

function evaluateChinaJointReviewEligibility(admission, indieAdmission, context) {
  const evidence = admission?.evidence ?? {};
  const indieEvidence = indieAdmission?.evidence ?? {};
  const rejectionReasons = [];
  const stableKey = stableSteamDedupeKey(evidence);
  if (!numericSteamAppId(evidence.steam_app_id)) rejectionReasons.push("steam_identity");
  if (!stableKey) rejectionReasons.push("stable_dedupe");
  if (evidence.china_opportunity_state !== "present" || !hasEvidence(evidence.china_opportunities)) {
    rejectionReasons.push("current_china_opportunity");
  }
  if (evidence.china_partner_occupancy !== "clear") rejectionReasons.push("mature_china_partner_clear");
  if (!hasCurrentOfficialEvent(admission)) rejectionReasons.push("current_official_product_event");
  if (!hasEvidence(indieEvidence.official_demo_evidence) && !hasEvidence(indieEvidence.official_gameplay_evidence)) {
    rejectionReasons.push("official_demo_or_playtest_or_gameplay");
  }
  if (!hasNonSteamBusinessEntry(indieEvidence.business_entrypoints)) rejectionReasons.push("non_steam_business_entry");

  const failedGates = Array.isArray(admission?.failed_gates) ? admission.failed_gates : [];
  if (failedGates.length !== 1 || failedGates[0] !== "traction_or_proven_team_event") {
    rejectionReasons.push("soft_gap_count");
  }

  return reviewResult({
    eligible: rejectionReasons.length === 0 && admission?.qualified !== true,
    gapId: failedGates.length === 1 ? failedGates[0] : null,
    lane: "china_joint",
    dedupeKey: stableKey,
    region: normalizedRegion(indieEvidence.region ?? context.sourceRegion),
    currentOfficialEvent: hasCurrentOfficialEvent(admission),
    discoveryScore: context.discoveryScore,
    sourceType: context.sourceType,
    rejectionReasons
  });
}

function reviewResult({
  eligible,
  gapId,
  lane,
  dedupeKey,
  region,
  currentOfficialEvent,
  discoveryScore,
  sourceType,
  rejectionReasons
}) {
  return {
    eligible,
    gap_id: eligible ? gapId : null,
    sourcing_lane: eligible ? lane : null,
    dedupe_key: dedupeKey,
    region,
    current_official_event: currentOfficialEvent,
    discovery_score: finiteScore(discoveryScore),
    source_type: sourceType,
    rejection_reasons: uniqueStrings(rejectionReasons)
  };
}

function stableSteamDedupeKey(evidence) {
  const appId = numericSteamAppId(evidence?.steam_app_id);
  if (!appId) return null;
  return evidence?.dedupe_key === `steam:${appId}` ? `steam:${appId}` : null;
}

function numericSteamAppId(value) {
  const text = String(value ?? "").trim();
  return /^\d+$/.test(text) && Number(text) > 0 ? text : null;
}

function normalizedRegion(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "domestic" || /中国|china/.test(text)) return "domestic";
  if (text === "overseas" || /海外|global|international/.test(text)) return "overseas";
  return "unknown";
}

function regionRank(value) {
  if (value === "domestic") return 0;
  if (value === "overseas") return 1;
  return 2;
}

function hasCurrentOfficialEvent(admission) {
  return hasEvidence(admission?.evidence?.current_official_product_events);
}

function hasEvidence(value) {
  return Array.isArray(value) && value.length > 0;
}

function hasNonSteamBusinessEntry(value) {
  if (!Array.isArray(value)) return false;
  return value.some((entry) => {
    const text = typeof entry === "string"
      ? entry
      : `${entry?.type ?? ""} ${entry?.value ?? ""} ${entry?.url ?? ""}`;
    return text.trim().length > 0 && !/(?:^|\s)steam(?:\s|$)|steamcommunity\.com|steampowered\.com/i.test(text);
  });
}

function nonemptyText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function finiteScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}