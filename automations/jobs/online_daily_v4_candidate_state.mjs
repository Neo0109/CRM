import { readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

export const CANDIDATE_ARTIFACT_SCHEMA_VERSION = 2;
export const CANDIDATE_HISTORY_DAYS = 7;
export const EVIDENCE_SNAPSHOT_CONTRACT_VERSION = 1;
export const EVIDENCE_SNAPSHOT_TTL_DAYS = 7;

const ENRICHMENT_STATUSES = new Set(["pending", "success", "failed"]);
const SCHEDULER_LANES = new Set(["new", "backlog", "retry_refresh", "reuse", null]);
const REQUIRED_EVIDENCE_KEYS = Object.freeze([
  "appId",
  "title",
  "source",
  "storeUrl",
  "steamDbUrl",
  "developers",
  "publishers",
  "country",
  "region",
  "genres",
  "categories",
  "shortDescription",
  "releaseDate",
  "daysToRelease",
  "alreadyReleased",
  "comingSoon",
  "hasDemoSignal",
  "earlyAccess",
  "narrativeHeavy",
  "indiaTeam",
  "strongGameplay",
  "highVisual",
  "strongData",
  "validatedPcHit",
  "mobileAdaptationPotential",
  "publisherOccupied",
  "chinaPartnerOccupied",
  "contactMethods",
  "website",
  "hasDetails",
  "recommendationCount",
  "screenshotCount",
  "movieCount",
  "officialDemoEvidence",
  "officialGameplayEvidence",
  "qualityProofs",
  "chinaBilibiliValue",
  "chinaDemandEvidence",
  "reviewText",
  "domesticQuery",
  "releaseTooSoon",
  "score"
]);

export async function loadSourcingCandidateHistory({
  rootDir = process.cwd(),
  reportDate,
  days = CANDIDATE_HISTORY_DAYS
} = {}) {
  const date = requireDate(reportDate, "reportDate");
  const lookbackDays = requireNonnegativeInteger(days, "days");
  const artifacts = [];
  for (let offset = lookbackDays; offset >= 0; offset -= 1) {
    const artifactDate = addDays(date, -offset);
    const filePath = path.join(path.resolve(rootDir), "data/sourcing_candidates", artifactDate + ".json");
    try {
      const artifact = JSON.parse(await readFile(filePath, "utf8"));
      if (artifact?.report_date !== artifactDate) {
        throw new Error("Candidate history report_date mismatch for " + artifactDate + ".");
      }
      artifacts.push(artifact);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw new Error("Failed to load candidate history " + artifactDate + ": " + error.message);
    }
  }
  return artifacts;
}

export function reconstructSteamCandidateStates({
  candidates,
  historicalArtifacts = [],
  reportDate
} = {}) {
  if (!Array.isArray(candidates)) {
    throw new Error("Candidate state reconstruction requires a candidates array.");
  }
  const date = requireDate(reportDate, "reportDate");
  const earliestDate = addDays(date, -CANDIDATE_HISTORY_DAYS);
  const currentKeys = new Set(candidates.map(steamCandidateKey).filter(Boolean));
  const historicalStates = new Map();
  const artifacts = [...historicalArtifacts]
    .filter((artifact) => artifact && typeof artifact === "object")
    .filter((artifact) => isDate(artifact.report_date))
    .filter((artifact) => artifact.report_date >= earliestDate && artifact.report_date <= date)
    .sort((left, right) => left.report_date.localeCompare(right.report_date));

  for (const artifact of artifacts) {
    for (const record of artifact.candidates ?? []) {
      const key = auditCandidateKey(record);
      if (!key || !currentKeys.has(key)) continue;
      const previous = historicalStates.get(key) ?? initialState(artifact.report_date);
      const next = artifact.schema_version === CANDIDATE_ARTIFACT_SCHEMA_VERSION
        ? stateFromV2Record(previous, record, artifact)
        : stateFromLegacyRecord(previous, record, artifact);
      historicalStates.set(key, next);
    }
  }

  const states = new Map();
  for (const candidate of candidates) {
    const key = steamCandidateKey(candidate);
    if (!key || states.has(key)) continue;
    const previous = historicalStates.get(key) ?? initialState(date);
    states.set(key, {
      ...cloneState(previous),
      first_seen: previous.first_seen ?? date,
      last_seen: date,
      scheduler_lane: null
    });
  }
  return states;
}

export function createEvidenceSnapshot(evidence, {
  capturedAt,
  ttlDays = EVIDENCE_SNAPSHOT_TTL_DAYS
} = {}) {
  const timestamp = requireTimestamp(capturedAt, "capturedAt");
  const lifespan = requirePositiveInteger(ttlDays, "ttlDays");
  const validation = validateEvidence(evidence);
  if (!validation.valid) {
    throw new Error("Cannot snapshot enriched Steam evidence: " + validation.reason);
  }
  const normalizedEvidence = canonicalJsonClone(evidence);
  if (!isDeepStrictEqual(evidence, normalizedEvidence)) {
    throw new Error("Cannot snapshot enriched Steam evidence without loss.");
  }
  const capturedDate = timestamp.slice(0, 10);
  return {
    contract_version: EVIDENCE_SNAPSHOT_CONTRACT_VERSION,
    captured_at: timestamp,
    expires_on: addDays(capturedDate, lifespan),
    dedupe_key: "steam:" + String(evidence.appId),
    evidence: normalizedEvidence
  };
}

export function inspectEvidenceSnapshot(snapshot, { dedupeKey, reportDate } = {}) {
  const date = requireDate(reportDate, "reportDate");
  if (snapshot === null || snapshot === undefined) {
    return { status: "missing", reason: null, evidence: null };
  }
  if (!isPlainObject(snapshot)) {
    return { status: "rejected", reason: "invalid_snapshot", evidence: null };
  }
  if (snapshot.contract_version !== EVIDENCE_SNAPSHOT_CONTRACT_VERSION) {
    return { status: "rejected", reason: "contract_version_mismatch", evidence: null };
  }
  if (String(snapshot.dedupe_key ?? "") !== String(dedupeKey ?? "")) {
    return { status: "rejected", reason: "dedupe_key_mismatch", evidence: null };
  }
  if (!isTimestamp(snapshot.captured_at) || !isDate(snapshot.expires_on)) {
    return { status: "rejected", reason: "invalid_snapshot_dates", evidence: null };
  }
  const capturedDate = snapshot.captured_at.slice(0, 10);
  if (date < capturedDate) {
    return { status: "rejected", reason: "captured_in_future", evidence: null };
  }
  if (date >= snapshot.expires_on) {
    return { status: "rejected", reason: "expired", evidence: null };
  }
  const validation = validateEvidence(snapshot.evidence);
  if (!validation.valid) {
    return { status: "rejected", reason: "invalid_evidence", evidence: null };
  }
  if ("steam:" + String(snapshot.evidence.appId) !== String(dedupeKey ?? "")) {
    return { status: "rejected", reason: "evidence_identity_mismatch", evidence: null };
  }
  return {
    status: "reusable",
    reason: null,
    evidence: canonicalJsonClone(snapshot.evidence)
  };
}

export function applySteamEnrichmentOutcomes({
  states,
  scheduled = [],
  reused = [],
  deferred = [],
  snapshotRejections = [],
  enrichedCandidates = [],
  reportDate,
  capturedAt
} = {}) {
  if (!(states instanceof Map)) {
    throw new Error("Steam enrichment outcomes require a state Map.");
  }
  if (scheduled.length !== enrichedCandidates.length) {
    throw new Error("Scheduled Steam candidates and enrichment results must have equal lengths.");
  }
  const date = requireDate(reportDate, "reportDate");
  const timestamp = requireTimestamp(capturedAt, "capturedAt");
  const nextStates = new Map([...states.entries()].map(([key, state]) => [key, cloneState(state)]));
  const rejectedKeys = new Set(snapshotRejections.map((item) => item.key ?? item.dedupe_key).filter(Boolean));
  for (const key of rejectedKeys) {
    const state = nextStates.get(key);
    if (state) state.evidence_snapshot = null;
  }

  for (const item of deferred) {
    const state = nextStates.get(item.key);
    if (!state) continue;
    state.scheduler_lane = item.schedulerLane;
  }

  for (const item of reused) {
    const state = nextStates.get(item.key);
    if (!state) continue;
    state.enrichment_status = "success";
    state.scheduler_lane = "reuse";
    state.next_retry_date = null;
  }

  let freshSuccess = 0;
  let failed = 0;
  for (let index = 0; index < scheduled.length; index += 1) {
    const item = scheduled[index];
    const result = enrichedCandidates[index];
    const state = nextStates.get(item.key);
    if (!state) continue;
    state.enrichment_attempts += 1;
    state.last_attempted_at = timestamp;
    state.scheduler_lane = item.schedulerLane;
    if (result?.hasDetails === true) {
      freshSuccess += 1;
      state.enrichment_status = "success";
      state.last_enriched_at = timestamp;
      state.next_retry_date = null;
      state.evidence_snapshot = createEvidenceSnapshot(result, { capturedAt: timestamp });
    } else {
      failed += 1;
      state.enrichment_status = "failed";
      state.next_retry_date = addDays(date, 1);
      state.evidence_snapshot = null;
    }
  }

  const laneCounts = { new: 0, backlog: 0, retry_refresh: 0 };
  for (const item of scheduled) {
    if (item.schedulerLane in laneCounts) laneCounts[item.schedulerLane] += 1;
  }
  const metrics = {
    steam_candidates_enriched: scheduled.length,
    steam_candidates_scheduled: scheduled.length,
    steam_candidates_reused: reused.length,
    steam_candidates_fresh_success: freshSuccess,
    steam_candidates_failed: failed,
    steam_candidates_deferred: deferred.length,
    steam_candidates_evaluated: scheduled.length + reused.length,
    backlog_unenriched_count: [...nextStates.values()].filter((state) => !state.last_enriched_at).length,
    scheduler_lane_counts: laneCounts,
    evidence_snapshot_rejections: snapshotRejections.length
  };

  return {
    states: nextStates,
    evaluatedCandidates: [
      ...reused.map((item) => canonicalJsonClone(item.enrichedCandidate)),
      ...enrichedCandidates
    ],
    metrics,
    snapshot_rejections: snapshotRejections.map((item) => ({
      dedupe_key: item.key ?? item.dedupe_key,
      reason: item.reason
    }))
  };
}

export function candidateStateForAudit(state) {
  const candidateState = state ?? {};
  return {
    first_seen: candidateState.first_seen,
    last_seen: candidateState.last_seen,
    enrichment_status: candidateState.enrichment_status,
    enrichment_attempts: candidateState.enrichment_attempts,
    last_attempted_at: candidateState.last_attempted_at ?? null,
    last_enriched_at: candidateState.last_enriched_at ?? null,
    next_retry_date: candidateState.next_retry_date ?? null,
    scheduler_lane: SCHEDULER_LANES.has(candidateState.scheduler_lane) ? candidateState.scheduler_lane : null,
    evidence_snapshot: candidateState.evidence_snapshot ? canonicalJsonClone(candidateState.evidence_snapshot) : null
  };
}

export function steamCandidateKey(candidate) {
  const appId = String(candidate?.appId ?? candidate?.steam_app_id ?? "").trim();
  return appId ? "steam:" + appId : null;
}

function auditCandidateKey(record) {
  const key = String(record?.dedupe_key ?? "").trim();
  if (key.startsWith("steam:")) return key;
  return steamCandidateKey(record);
}

function stateFromV2Record(previous, record, artifact) {
  const generatedAt = isTimestamp(artifact.generated_at) ? artifact.generated_at : null;
  const firstSeen = isDate(record.first_seen) ? record.first_seen : previous.first_seen ?? artifact.report_date;
  const lastSeen = isDate(record.last_seen) ? record.last_seen : artifact.report_date;
  return {
    first_seen: earliest(previous.first_seen, firstSeen),
    last_seen: latest(previous.last_seen, lastSeen),
    enrichment_status: ENRICHMENT_STATUSES.has(record.enrichment_status)
      ? record.enrichment_status
      : previous.enrichment_status,
    enrichment_attempts: Number.isInteger(record.enrichment_attempts) && record.enrichment_attempts >= 0
      ? Math.max(previous.enrichment_attempts, record.enrichment_attempts)
      : previous.enrichment_attempts,
    last_attempted_at: timestampOrNull(record.last_attempted_at) ?? previous.last_attempted_at ?? generatedAt,
    last_enriched_at: timestampOrNull(record.last_enriched_at) ?? previous.last_enriched_at,
    next_retry_date: dateOrNull(record.next_retry_date),
    scheduler_lane: SCHEDULER_LANES.has(record.scheduler_lane) ? record.scheduler_lane : null,
    evidence_snapshot: record.evidence_snapshot === null || record.evidence_snapshot === undefined
      ? previous.evidence_snapshot
      : canonicalLooseClone(record.evidence_snapshot)
  };
}

function stateFromLegacyRecord(previous, record, artifact) {
  const generatedAt = isTimestamp(artifact.generated_at)
    ? artifact.generated_at
    : artifact.report_date + "T00:00:00+08:00";
  const enriched = Array.isArray(record.matched_rules) && record.matched_rules.includes("steam_enriched");
  if (!enriched) {
    return {
      ...cloneState(previous),
      first_seen: earliest(previous.first_seen, artifact.report_date),
      last_seen: latest(previous.last_seen, artifact.report_date),
      scheduler_lane: null
    };
  }
  const failed = Array.isArray(record.missing_evidence) && record.missing_evidence.includes("steam_app_details");
  return {
    ...cloneState(previous),
    first_seen: earliest(previous.first_seen, artifact.report_date),
    last_seen: latest(previous.last_seen, artifact.report_date),
    enrichment_status: failed ? "failed" : "success",
    enrichment_attempts: previous.enrichment_attempts + 1,
    last_attempted_at: generatedAt,
    last_enriched_at: failed ? previous.last_enriched_at : generatedAt,
    next_retry_date: failed ? addDays(artifact.report_date, 1) : null,
    scheduler_lane: null,
    evidence_snapshot: previous.evidence_snapshot
  };
}

function initialState(date) {
  return {
    first_seen: date,
    last_seen: date,
    enrichment_status: "pending",
    enrichment_attempts: 0,
    last_attempted_at: null,
    last_enriched_at: null,
    next_retry_date: null,
    scheduler_lane: null,
    evidence_snapshot: null
  };
}

function cloneState(state) {
  return {
    ...state,
    evidence_snapshot: state?.evidence_snapshot ? canonicalLooseClone(state.evidence_snapshot) : null
  };
}

function validateEvidence(value) {
  if (!isPlainObject(value)) return { valid: false, reason: "evidence must be an object" };
  for (const key of REQUIRED_EVIDENCE_KEYS) {
    if (!Object.hasOwn(value, key)) return { valid: false, reason: "missing " + key };
  }
  if (!String(value.appId ?? "").trim()) return { valid: false, reason: "appId is required" };
  if (!String(value.title ?? "").trim()) return { valid: false, reason: "title is required" };
  if (value.hasDetails !== true) return { valid: false, reason: "hasDetails must be true" };
  try {
    const normalized = canonicalJsonClone(value);
    if (!isDeepStrictEqual(value, normalized)) return { valid: false, reason: "evidence is not lossless JSON" };
  } catch {
    return { valid: false, reason: "evidence is not JSON serializable" };
  }
  return { valid: true, reason: null };
}

function canonicalJsonClone(value) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Value is not JSON serializable.");
  return canonicalize(JSON.parse(serialized));
}

function canonicalLooseClone(value) {
  try {
    return canonicalJsonClone(value);
  } catch {
    return value;
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function earliest(left, right) {
  if (!left) return right;
  if (!right) return left;
  return left < right ? left : right;
}

function latest(left, right) {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
}

function timestampOrNull(value) {
  return value === null || value === undefined ? null : isTimestamp(value) ? value : null;
}

function dateOrNull(value) {
  return value === null || value === undefined ? null : isDate(value) ? value : null;
}

function requireDate(value, label) {
  if (!isDate(value)) throw new Error(label + " must be YYYY-MM-DD.");
  return value;
}

function requireTimestamp(value, label) {
  if (!isTimestamp(value)) throw new Error(label + " must be an ISO date-time.");
  return value;
}

function requirePositiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(label + " must be a positive integer.");
  return number;
}

function requireNonnegativeInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(label + " must be a nonnegative integer.");
  return number;
}

function isDate(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value + "T00:00:00Z"));
}

function isTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function addDays(date, offset) {
  const parsed = new Date(requireDate(date, "date") + "T00:00:00Z");
  parsed.setUTCDate(parsed.getUTCDate() + offset);
  return parsed.toISOString().slice(0, 10);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
