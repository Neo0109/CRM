import {
  inspectEvidenceSnapshot,
  steamCandidateKey
} from "./online_daily_v4_candidate_state.mjs";

export const FAIR_ENRICHMENT_WEIGHTS = Object.freeze({
  new: 4,
  backlog: 3,
  retry_refresh: 2
});

const LANE_ORDER = Object.freeze(["new", "backlog", "retry_refresh"]);

export function scheduleSteamCandidateEnrichment({
  candidates,
  states,
  reportDate,
  maxCandidates,
  reviewScore = defaultReviewScore
} = {}) {
  if (!Array.isArray(candidates)) {
    throw new Error("Fair enrichment scheduling requires a candidates array.");
  }
  if (!(states instanceof Map)) {
    throw new Error("Fair enrichment scheduling requires a candidate state Map.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(reportDate ?? ""))) {
    throw new Error("Fair enrichment scheduling requires a YYYY-MM-DD reportDate.");
  }
  const budget = requireNonnegativeInteger(maxCandidates, "maxCandidates");
  const reused = [];
  const cooldownDeferred = [];
  const snapshotRejections = [];
  const queues = { new: [], backlog: [], retry_refresh: [] };
  const seen = new Set();

  for (const candidate of candidates) {
    const key = steamCandidateKey(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const state = states.get(key);
    if (!state) throw new Error("Missing candidate state for " + key + ".");

    const snapshot = inspectEvidenceSnapshot(state.evidence_snapshot, {
      dedupeKey: key,
      reportDate
    });
    if (snapshot.status === "reusable") {
      reused.push({
        key,
        candidate,
        state,
        schedulerLane: "reuse",
        enrichedCandidate: snapshot.evidence
      });
      continue;
    }
    if (snapshot.status === "rejected") {
      snapshotRejections.push({ key, reason: snapshot.reason });
    }

    const schedulerLane = classifyLane(state, reportDate);
    const entry = {
      key,
      candidate,
      state,
      schedulerLane,
      staticScore: finiteNumber(reviewScore(candidate, state), 0)
    };
    if (state.next_retry_date && reportDate < state.next_retry_date) {
      cooldownDeferred.push({ ...entry, deferReason: "retry_cooldown" });
      continue;
    }
    queues[schedulerLane].push(entry);
  }

  queues.new.sort(compareNew);
  queues.backlog.sort(compareBacklog);
  queues.retry_refresh.sort(compareRetryRefresh);

  const cycle = [
    ...Array(FAIR_ENRICHMENT_WEIGHTS.new).fill("new"),
    ...Array(FAIR_ENRICHMENT_WEIGHTS.backlog).fill("backlog"),
    ...Array(FAIR_ENRICHMENT_WEIGHTS.retry_refresh).fill("retry_refresh")
  ];
  const scheduled = [];
  while (scheduled.length < budget) {
    let progressed = false;
    for (const lane of cycle) {
      if (scheduled.length >= budget) break;
      const next = queues[lane].shift();
      if (!next) continue;
      scheduled.push(next);
      progressed = true;
    }
    if (!progressed) break;
  }

  const deferred = [
    ...cooldownDeferred,
    ...LANE_ORDER.flatMap((lane) => queues[lane].map((entry) => ({
      ...entry,
      deferReason: "budget_exhausted"
    })))
  ].sort((left, right) => left.key.localeCompare(right.key));
  const laneCounts = { new: 0, backlog: 0, retry_refresh: 0 };
  for (const item of scheduled) laneCounts[item.schedulerLane] += 1;

  return {
    scheduled,
    reused: reused.sort((left, right) => left.key.localeCompare(right.key)),
    deferred,
    lane_counts: laneCounts,
    snapshot_rejections: snapshotRejections.sort((left, right) => left.key.localeCompare(right.key))
  };
}

function classifyLane(state, reportDate) {
  if (
    state.enrichment_status === "failed"
    || state.enrichment_attempts > 0
    || state.last_enriched_at
    || state.evidence_snapshot
  ) {
    return "retry_refresh";
  }
  return state.first_seen < reportDate ? "backlog" : "new";
}

function compareNew(left, right) {
  return compareStaticThenKey(left, right);
}

function compareBacklog(left, right) {
  return compareNullableTimestamp(left.state.last_attempted_at, right.state.last_attempted_at)
    || String(left.state.first_seen).localeCompare(String(right.state.first_seen))
    || compareStaticThenKey(left, right);
}

function compareRetryRefresh(left, right) {
  return compareNullableDate(left.state.next_retry_date, right.state.next_retry_date)
    || compareNullableTimestamp(left.state.last_attempted_at, right.state.last_attempted_at)
    || compareStaticThenKey(left, right);
}

function compareStaticThenKey(left, right) {
  return right.staticScore - left.staticScore || left.key.localeCompare(right.key);
}

function compareNullableTimestamp(left, right) {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return String(left).localeCompare(String(right));
}

function compareNullableDate(left, right) {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return String(left).localeCompare(String(right));
}

function defaultReviewScore(candidate) {
  return finiteNumber(candidate?.reviewScore ?? candidate?.review_score, 0);
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function requireNonnegativeInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(label + " must be a nonnegative integer.");
  }
  return number;
}
