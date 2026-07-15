import { hardDropReason } from "./online_daily_v4_decision.mjs";
import { normalizeText, normalizeUrl } from "./online_daily_v4_dedupe.mjs";
import { isQualityQuarantineRule } from "./online_daily_v4_rules.mjs";

const DECISION_RANK = { excluded: 1, candidate: 2, formal: 3 };

export function buildSourcingCandidateArtifact({
  reportDate,
  capturedAt,
  ruleVersion,
  rawSteamCandidates = [],
  enrichedSteamCandidates = [],
  mediaSignalsSeen = 0,
  mediaCandidates = [],
  candidatePools = emptyPools(),
  publishedPools = emptyPools()
}) {
  const poolIndex = buildPoolIndex(candidatePools, publishedPools);
  const rawSteamByKey = uniqueByDedupeKey(rawSteamCandidates, steamCandidateDedupeKey);
  const enrichedSteamByKey = uniqueByDedupeKey(enrichedSteamCandidates, steamCandidateDedupeKey);
  const records = new Map();

  for (const key of new Set([...rawSteamByKey.keys(), ...enrichedSteamByKey.keys()])) {
    const raw = rawSteamByKey.get(key) ?? null;
    const enriched = enrichedSteamByKey.get(key) ?? null;
    addOrMergeRecord(records, buildSteamAuditRecord({
      key,
      raw,
      enriched,
      ruleVersion,
      poolDecision: poolIndex.get(key)
    }));
  }

  for (const mediaCandidate of mediaCandidates) {
    const key = leadDedupeKey(mediaCandidate);
    if (!key) continue;
    addOrMergeRecord(records, buildMediaAuditRecord({
      key,
      lead: mediaCandidate,
      ruleVersion,
      poolDecision: poolIndex.get(key)
    }));
  }

  const candidates = [...records.values()].sort((left, right) => left.dedupe_key.localeCompare(right.dedupe_key));
  const decisionCount = (decision) => candidates.filter((candidate) => candidate.decision === decision).length;

  return {
    schema_version: 1,
    report_date: reportDate,
    generated_at: capturedAt,
    sourcing_rule_version: ruleVersion,
    scan_summary: {
      steam_candidates_seen: rawSteamCandidates.length,
      steam_candidates_enriched: enrichedSteamCandidates.length,
      media_signals_seen: Number(mediaSignalsSeen) || 0,
      media_candidates_seen: mediaCandidates.length,
      records_total: candidates.length,
      formal: decisionCount("formal"),
      candidate: decisionCount("candidate"),
      excluded: decisionCount("excluded")
    },
    candidates
  };
}

function buildSteamAuditRecord({ key, raw, enriched, ruleVersion, poolDecision }) {
  const candidate = enriched ?? raw ?? {};
  const hasDetails = enriched?.hasDetails === true;
  const reviewSummary = steamReviewSummary({
    hasDetails,
    reviewText: enriched?.reviewText ?? raw?.reviewText,
    recommendationCount: enriched?.recommendationCount
  });
  const visualState = steamVisualState({
    hasDetails,
    screenshotCount: enriched?.screenshotCount,
    movieCount: enriched?.movieCount
  });
  const eaState = hasDetails ? booleanState(Boolean(enriched?.earlyAccess)) : "unknown";
  const fallbackExclusion = enriched ? hardDropReason(enriched) : null;
  const decision = poolDecision?.decision ?? (fallbackExclusion ? "excluded" : "candidate");
  const matchedRules = [
    "steam_discovery",
    enriched ? "steam_enriched" : null,
    poolDecision?.matchedRule,
    isQualityQuarantineRule(ruleVersion) ? "quality_quarantine" : null
  ].filter(Boolean);
  const missingEvidence = [];
  if (!hasDetails) missingEvidence.push("steam_app_details", "ea_status", "visual_assets");
  if (reviewSummary.status === "unknown") missingEvidence.push("steam_review_summary");

  return {
    decision,
    source_type: "steam",
    project: String(candidate.title ?? "").trim(),
    steam_app_id: stringOrNull(candidate.appId),
    dedupe_key: key,
    sourcing_lane: candidate.sourcing_lane ?? null,
    sourcing_rule_version: ruleVersion,
    matched_rules: uniqueStrings(matchedRules),
    missing_evidence: uniqueStrings(missingEvidence),
    exclusion_reasons: uniqueStrings([
      poolDecision?.decision === "excluded" ? poolDecision.reason : null,
      fallbackExclusion
    ]),
    source_links: normalizedLinks([
      candidate.storeUrl,
      candidate.steamDbUrl,
      candidate.website,
      raw?.href,
      candidate.appId ? `https://store.steampowered.com/app/${candidate.appId}/` : null,
      candidate.appId ? `https://steamdb.info/app/${candidate.appId}/` : null
    ]),
    steam_review_summary: reviewSummary,
    ea_state: eaState,
    visual_state: visualState
  };
}

function buildMediaAuditRecord({ key, lead, ruleVersion, poolDecision }) {
  const details = lead?._steamEntityResolution?.details ?? null;
  const hasDetails = Boolean(details);
  const recommendationCount = Number(details?.recommendations?.total ?? 0);
  const reviewSummary = steamReviewSummary({
    hasDetails,
    reviewText: null,
    recommendationCount: recommendationCount > 0 ? recommendationCount : null
  });
  const visualState = steamVisualState({
    hasDetails,
    screenshotCount: details?.screenshots?.length,
    movieCount: details?.movies?.length
  });
  const eaState = hasDetails ? booleanState(mediaDetailsShowEarlyAccess(lead, details)) : "unknown";
  const fallbackExcluded = lead?._class === "drop";
  const decision = poolDecision?.decision ?? (fallbackExcluded ? "excluded" : "candidate");
  const missingEvidence = [];
  if (!lead?.steam_app_id) missingEvidence.push("steam_app_id");
  if (!hasDetails) missingEvidence.push("steam_app_details", "ea_status", "visual_assets");
  if (reviewSummary.status === "unknown") missingEvidence.push("steam_review_summary");
  const sourceLink = lead?._mediaItem?.link ?? null;

  return {
    decision,
    source_type: "media",
    project: String(lead?.project ?? "").trim(),
    steam_app_id: stringOrNull(lead?.steam_app_id),
    dedupe_key: key,
    sourcing_lane: lead?.sourcing_lane ?? null,
    sourcing_rule_version: ruleVersion,
    matched_rules: uniqueStrings([
      "media_discovery",
      lead?._confidence ? `media_${lead._confidence}` : null,
      lead?._officialSourceMatched ? "official_source_matched" : null,
      lead?.steam_app_id ? "steam_entity_matched" : null,
      poolDecision?.matchedRule,
      isQualityQuarantineRule(ruleVersion) ? "quality_quarantine" : null
    ]),
    missing_evidence: uniqueStrings(missingEvidence),
    exclusion_reasons: uniqueStrings([
      poolDecision?.decision === "excluded" ? poolDecision.reason : null,
      fallbackExcluded ? lead?.risks ?? lead?.drop_reason ?? lead?.verdict : null
    ]),
    source_links: normalizedLinks([sourceLink, ...(lead?.links ?? [])]),
    steam_review_summary: reviewSummary,
    ea_state: eaState,
    visual_state: visualState
  };
}

function buildPoolIndex(candidatePools, publishedPools) {
  const index = new Map();
  for (const pool of ["push", "watch", "drop"]) {
    for (const lead of candidatePools?.[pool] ?? []) {
      const key = leadDedupeKey(lead);
      if (!key || index.has(key)) continue;
      index.set(key, {
        decision: pool === "drop" ? "excluded" : "candidate",
        matchedRule: `pre_quarantine_${pool}`,
        reason: exclusionReasonFromLead(lead)
      });
    }
  }
  for (const pool of ["push", "watch", "drop"]) {
    for (const lead of publishedPools?.[pool] ?? []) {
      const key = leadDedupeKey(lead);
      if (!key) continue;
      const previous = index.get(key);
      index.set(key, {
        decision: pool === "drop" ? "excluded" : "formal",
        matchedRule: previous?.matchedRule ?? `published_${pool}`,
        reason: exclusionReasonFromLead(lead) ?? previous?.reason ?? null
      });
    }
  }
  return index;
}

function addOrMergeRecord(records, incoming) {
  if (!incoming?.dedupe_key || !incoming.project) return;
  const current = records.get(incoming.dedupe_key);
  if (!current) {
    records.set(incoming.dedupe_key, incoming);
    return;
  }

  const incomingDecisionWins = DECISION_RANK[incoming.decision] > DECISION_RANK[current.decision];
  records.set(incoming.dedupe_key, {
    ...current,
    decision: incomingDecisionWins ? incoming.decision : current.decision,
    source_type: current.source_type === incoming.source_type ? current.source_type : "multi_source",
    project: current.source_type === "steam" ? current.project : incoming.project || current.project,
    steam_app_id: current.steam_app_id ?? incoming.steam_app_id,
    sourcing_lane: current.sourcing_lane ?? incoming.sourcing_lane,
    matched_rules: uniqueStrings([...current.matched_rules, ...incoming.matched_rules]),
    missing_evidence: current.missing_evidence.filter((item) => incoming.missing_evidence.includes(item)),
    exclusion_reasons: uniqueStrings([...current.exclusion_reasons, ...incoming.exclusion_reasons]),
    source_links: normalizedLinks([...current.source_links, ...incoming.source_links]),
    steam_review_summary: preferReviewSummary(current.steam_review_summary, incoming.steam_review_summary),
    ea_state: preferKnownState(current.ea_state, incoming.ea_state),
    visual_state: preferVisualState(current.visual_state, incoming.visual_state)
  });
}

function uniqueByDedupeKey(items, keyForItem) {
  const map = new Map();
  for (const item of items) {
    const key = keyForItem(item);
    if (key && !map.has(key)) map.set(key, item);
  }
  return map;
}

function steamCandidateDedupeKey(candidate) {
  const appId = stringOrNull(candidate?.appId);
  if (appId) return `steam:${appId}`;
  return projectDedupeKey(candidate?.title);
}

function leadDedupeKey(lead) {
  const appId = stringOrNull(lead?.steam_app_id ?? lead?.appId);
  if (appId) return `steam:${appId}`;
  return projectDedupeKey(lead?.project ?? lead?.title);
}

function projectDedupeKey(project) {
  const normalized = normalizeText(project);
  return normalized ? `project:${normalized}` : null;
}

function steamReviewSummary({ hasDetails, reviewText, recommendationCount }) {
  const text = String(reviewText ?? "").trim() || null;
  const recommendations = Number(recommendationCount ?? 0);
  const hasSummary = Boolean(text) || recommendations > 0;
  return {
    status: hasSummary ? "available" : "unknown",
    text,
    recommendation_count: recommendations > 0 ? recommendations : null,
    positive_reviews: null,
    negative_reviews: null,
    total_reviews: null,
    positive_rate: null,
    language: null,
    purchase_type: null,
    source_status: hasDetails ? "steam_appdetails" : "not_fetched"
  };
}

function steamVisualState({ hasDetails, screenshotCount, movieCount }) {
  if (!hasDetails) {
    return { status: "unknown", screenshot_count: null, movie_count: null };
  }
  const screenshots = Number(screenshotCount ?? 0);
  const movies = Number(movieCount ?? 0);
  return {
    status: screenshots > 0 || movies > 0 ? "available" : "missing",
    screenshot_count: screenshots,
    movie_count: movies
  };
}

function mediaDetailsShowEarlyAccess(lead, details) {
  if (lead?.early_access === true) return true;
  const text = [
    details?.name,
    details?.short_description,
    ...(details?.genres ?? []).map((item) => item?.description),
    ...(details?.categories ?? []).map((item) => item?.description)
  ].join(" ");
  return /early access|抢先体验/i.test(text);
}

function exclusionReasonFromLead(lead) {
  return lead?.risks ?? lead?.drop_reason ?? lead?.verdict ?? null;
}

function preferReviewSummary(left, right) {
  if (left.status === "available") return left;
  return right.status === "available" ? right : left;
}

function preferKnownState(left, right) {
  return left === "unknown" && right !== "unknown" ? right : left;
}

function preferVisualState(left, right) {
  return left.status === "unknown" && right.status !== "unknown" ? right : left;
}

function booleanState(value) {
  return value ? "yes" : "no";
}

function normalizedLinks(values) {
  const links = [];
  const seen = new Set();
  for (const value of values) {
    const link = String(value ?? "").trim();
    const key = normalizeUrl(link);
    if (!link || !key || seen.has(key)) continue;
    links.push(link);
    seen.add(key);
  }
  return links;
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined).map((value) => String(value).trim()).filter(Boolean))];
}

function stringOrNull(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function emptyPools() {
  return { push: [], watch: [], drop: [] };
}
