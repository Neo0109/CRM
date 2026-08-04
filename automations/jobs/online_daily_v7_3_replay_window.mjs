import {
  computeReplayWindowPayloadSha256,
  measureReplayWindowPayload,
  validateReplayWindow
} from "./online_daily_v7_3_replay_corpus_contract.mjs";
import {
  C5C_REPLAY_ENGINE_CONTRACT_VERSION,
  replayOfflineCorpus
} from "./online_daily_v7_3_offline_replay.mjs";

const SLOT_PRIORITY = new Map([["afternoon", 0], ["watchdog", 1]]);
const HARD_FAILURE_REASON_BY_REJECTION = new Map([
  ["artifact_mismatch", "artifact_mismatch"],
  ["delivery_unhealthy", "receipt_unhealthy"],
  ["replay_mismatch", "replay_mismatch"],
  ["contract_drift", "contract_drift"],
  ["behavior_drift", "behavior_drift"]
]);

export function selectCanonicalReplayRun({
  reportDate,
  attempts = [],
  expectedBehaviorContractSha256
} = {}) {
  assertDate(reportDate);
  if (!Array.isArray(attempts)) throw new TypeError("attempts must be an array");
  const eligible = [];
  const rejected = [];
  for (const attempt of attempts) {
    const snapshot = attemptSnapshot(attempt, reportDate);
    if (snapshot.report_date !== reportDate) {
      rejected.push(rejectedAttempt(snapshot, "artifact_mismatch"));
      continue;
    }
    const exclusion = staticExclusion(snapshot);
    if (exclusion) {
      rejected.push(rejectedAttempt(snapshot, exclusion));
      continue;
    }
    try {
      const replay = replayOfflineCorpus({
        ...attempt,
        expectedBehaviorContractSha256
      });
      eligible.push({ snapshot, replay, attempt });
    } catch (error) {
      rejected.push(rejectedAttempt(snapshot, replayErrorReason(error?.code)));
    }
  }

  eligible.sort(compareEligibleAttempts);
  const selected = eligible[0] ?? null;
  for (const item of eligible.slice(1)) {
    rejected.push(rejectedAttempt(item.snapshot, "superseded_automatic_attempt"));
  }
  const rejectedAttempts = rejected.sort(compareRejectedAttempts);
  if (!selected) {
    const hardReasons = uniqueStrings(
      rejectedAttempts
        .map((item) => HARD_FAILURE_REASON_BY_REJECTION.get(item.reason_code))
        .filter(Boolean)
    );
    return {
      status: "failed",
      canonical_entry: null,
      rejected_attempts: rejectedAttempts,
      failure_reasons: hardReasons.length ? hardReasons : ["no_canonical"]
    };
  }
  return {
    status: "selected",
    canonical_entry: canonicalEntry(selected),
    rejected_attempts: rejectedAttempts,
    failure_reasons: []
  };
}

export function advanceReplayWindow({
  window,
  reportDate,
  attempts = [],
  expectedBehaviorContractSha256
} = {}) {
  assertDate(reportDate);
  assertPersistedWindowValid(window);
  if (window?.status === "complete") {
    return {
      window: clone(window),
      sealed_window: null,
      transition: "complete_unchanged"
    };
  }
  if (window?.status === "failed") {
    if (compareDates(reportDate, window.failure_date) <= 0) {
      return {
        window: clone(window),
        sealed_window: null,
        transition: "same_day_reopen_blocked"
      };
    }
    const restarted = advanceReplayWindow({
      window: null,
      reportDate,
      attempts,
      expectedBehaviorContractSha256
    });
    return {
      ...restarted,
      sealed_window: clone(window),
      transition: "restarted_after_failure"
    };
  }

  if (window?.status === "active") {
    const lastDate = window.dates.at(-1)?.report_date ?? window.start_date;
    const expectedDate = nextDate(lastDate);
    if (compareDates(reportDate, lastDate) <= 0) {
      return {
        window: clone(window),
        sealed_window: null,
        transition: "same_day_reopen_blocked"
      };
    }
    if (reportDate !== expectedDate) {
      const failed = failWindow(window, expectedDate, ["missing_date"], []);
      const restarted = advanceReplayWindow({
        window: null,
        reportDate,
        attempts,
        expectedBehaviorContractSha256
      });
      return {
        ...restarted,
        sealed_window: failed,
        transition: "restarted_after_gap"
      };
    }
  }

  const selection = selectCanonicalReplayRun({
    reportDate,
    attempts,
    expectedBehaviorContractSha256
  });
  if (selection.status !== "selected") {
    const failed = failWindow(
      window,
      reportDate,
      selection.failure_reasons,
      selection.rejected_attempts,
      expectedBehaviorContractSha256
    );
    return {
      window: failed,
      sealed_window: null,
      transition: "failed"
    };
  }
  const nextWindow = appendCanonicalDate(
    window,
    selection.canonical_entry,
    selection.rejected_attempts,
    expectedBehaviorContractSha256
  );
  return {
    window: nextWindow,
    sealed_window: null,
    transition: nextWindow.status === "complete" ? "completed" : window ? "advanced" : "started"
  };
}

function assertPersistedWindowValid(window) {
  if (window == null) return;
  const validation = validateReplayWindow(window);
  if (!validation.valid) {
    const first = validation.errors[0];
    throw new Error(
      `C5-C invalid persisted replay window: ${first?.code ?? "unknown"} at ${first?.path ?? "/"}`
    );
  }
}

export function buildReplayWindowSequence({
  days = [],
  expectedBehaviorContractSha256
} = {}) {
  if (!Array.isArray(days)) throw new TypeError("days must be an array");
  let currentWindow = null;
  const sealedWindows = [];
  const transitions = [];
  for (const day of days) {
    const result = advanceReplayWindow({
      window: currentWindow,
      reportDate: day?.report_date,
      attempts: day?.attempts ?? [],
      expectedBehaviorContractSha256
    });
    if (result.sealed_window) sealedWindows.push(result.sealed_window);
    currentWindow = result.window;
    transitions.push({
      report_date: day?.report_date,
      transition: result.transition
    });
  }
  return {
    current_window: currentWindow,
    sealed_windows: sealedWindows,
    transitions
  };
}

function canonicalEntry({ snapshot, replay, attempt }) {
  const corpus = replay.corpus;
  const corpusMetadata = attempt.artifactMetadata.replay_corpus;
  const receiptMetadata = attempt.artifactMetadata.receipt;
  return {
    report_date: corpus.report_date,
    corpus_id: corpus.corpus_id,
    event_name: corpus.event_name,
    run_slot: corpus.run_slot,
    canonical: true,
    manual_only: false,
    capture_status: corpus.capture_status,
    corpus_contract_version: corpus.contract_version,
    behavior_contract_sha256: corpus.behavior_contract_sha256,
    corpus_path: corpusMetadata.path,
    git_blob_sha: corpusMetadata.git_blob_sha,
    payload_sha256: replay.input_corpus_payload_sha256,
    receipt_binding: {
      path: receiptMetadata.path,
      git_blob_sha: receiptMetadata.git_blob_sha,
      payload_sha256: receiptMetadata.payload_sha256,
      generation_status: corpus.delivery_health.generation_status,
      validation_status: corpus.delivery_health.validation_status,
      receipt_status: corpus.delivery_health.receipt_status,
      synced: corpus.delivery_health.sync_response.synced === true
    },
    replay_binding: {
      engine_contract_version: C5C_REPLAY_ENGINE_CONTRACT_VERSION,
      input_corpus_payload_sha256: replay.input_corpus_payload_sha256,
      expected_decision_sha256: replay.expected_decision_sha256,
      replayed_decision_sha256: replay.replayed_decision_sha256,
      deterministic: replay.deterministic,
      status: replay.status
    }
  };
}

function appendCanonicalDate(window, entry, rejectedAttempts, behaviorHash) {
  const dates = [...(window?.dates ?? []), entry];
  const status = dates.length === 15 ? "complete" : "active";
  const next = {
    contract_version: 1,
    window_id: window?.window_id ?? windowId(entry.report_date, behaviorHash),
    timezone: "Asia/Shanghai",
    start_date: window?.start_date ?? entry.report_date,
    end_date: entry.report_date,
    status,
    corpus_contract_version: 1,
    behavior_contract_sha256: behaviorHash,
    dates,
    failure_date: null,
    failure_reasons: [],
    rejected_attempts: [
      ...(window?.rejected_attempts ?? []),
      ...rejectedAttempts
    ],
    integrity: {
      canonical_json_version: 1,
      payload_sha256: "0".repeat(64),
      byte_size: 0,
      inline_text_characters: 0,
      status: status === "complete" ? "complete" : "incomplete",
      reason_codes: []
    }
  };
  return sealAndValidateWindow(next);
}

function failWindow(
  window,
  failureDate,
  failureReasons,
  rejectedAttempts,
  fallbackBehaviorHash = null
) {
  const dates = clone(window?.dates ?? []);
  const behaviorHash = window?.behavior_contract_sha256 ?? fallbackBehaviorHash;
  const startDate = window?.start_date ?? failureDate;
  const next = {
    contract_version: 1,
    window_id: window?.window_id ?? windowId(startDate, behaviorHash),
    timezone: "Asia/Shanghai",
    start_date: startDate,
    end_date: failureDate,
    status: "failed",
    corpus_contract_version: 1,
    behavior_contract_sha256: behaviorHash,
    dates,
    failure_date: failureDate,
    failure_reasons: uniqueStrings(failureReasons),
    rejected_attempts: [
      ...(window?.rejected_attempts ?? []),
      ...rejectedAttempts
    ],
    integrity: {
      canonical_json_version: 1,
      payload_sha256: "0".repeat(64),
      byte_size: 0,
      inline_text_characters: 0,
      status: "incomplete",
      reason_codes: uniqueStrings(failureReasons)
    }
  };
  return sealAndValidateWindow(next);
}

function sealAndValidateWindow(window) {
  window.integrity.payload_sha256 = "0".repeat(64);
  for (let index = 0; index < 8; index += 1) {
    const metrics = measureReplayWindowPayload(window);
    if (
      window.integrity.byte_size === metrics.byte_size
      && window.integrity.inline_text_characters === metrics.inline_text_characters
    ) break;
    window.integrity.byte_size = metrics.byte_size;
    window.integrity.inline_text_characters = metrics.inline_text_characters;
  }
  window.integrity.payload_sha256 = computeReplayWindowPayloadSha256(window);
  const validation = validateReplayWindow(window);
  if (!validation.valid) {
    const first = validation.errors[0];
    throw new Error(
      `C5-C generated invalid replay window: ${first?.code ?? "unknown"} at ${first?.path ?? "/"}`
    );
  }
  return window;
}

function attemptSnapshot(attempt, reportDate) {
  let corpus = null;
  try {
    corpus = JSON.parse(bytesText(attempt?.corpusBytes));
  } catch {}
  return {
    report_date: corpus?.report_date ?? reportDate,
    corpus_id: String(corpus?.corpus_id ?? `invalid:${reportDate}`),
    event_name: normalizedEventName(corpus?.event_name),
    run_slot: normalizedRunSlot(corpus?.run_slot),
    workflow_run_id: positiveInteger(corpus?.workflow_run_id),
    run_attempt: positiveInteger(corpus?.run_attempt),
    capture_status: String(corpus?.capture_status ?? "corrupt")
  };
}

function staticExclusion(snapshot) {
  if (snapshot.event_name === "workflow_dispatch" || snapshot.run_slot === "manual") {
    return "manual_only";
  }
  if (snapshot.event_name !== "schedule") return "manual_only";
  if (snapshot.run_attempt !== 1) return "rerun";
  if (snapshot.run_slot === "morning") return "morning_only";
  if (!SLOT_PRIORITY.has(snapshot.run_slot)) return "manual_only";
  if (snapshot.capture_status !== "complete") {
    return ["incomplete", "corrupt", "unreplayable"].includes(snapshot.capture_status)
      ? snapshot.capture_status
      : "corrupt";
  }
  return null;
}

function rejectedAttempt(snapshot, reasonCode) {
  return {
    report_date: snapshot.report_date,
    corpus_id: snapshot.corpus_id,
    event_name: snapshot.event_name,
    run_slot: snapshot.run_slot,
    reason_code: reasonCode
  };
}

function replayErrorReason(code) {
  if (code === "RECEIPT_UNHEALTHY") return "delivery_unhealthy";
  if (code === "BEHAVIOR_DRIFT") return "behavior_drift";
  if (
    code === "REPLAY_MISMATCH"
    || code === "REPLAY_INPUT_MISMATCH"
    || code === "NON_DETERMINISTIC_REPLAY"
  ) {
    return "replay_mismatch";
  }
  if (code === "CORPUS_CONTRACT_INVALID") return "contract_drift";
  return "artifact_mismatch";
}

function compareEligibleAttempts(left, right) {
  return (
    SLOT_PRIORITY.get(left.snapshot.run_slot) - SLOT_PRIORITY.get(right.snapshot.run_slot)
    || left.snapshot.workflow_run_id - right.snapshot.workflow_run_id
    || left.snapshot.corpus_id.localeCompare(right.snapshot.corpus_id)
  );
}

function compareRejectedAttempts(left, right) {
  return (
    left.report_date.localeCompare(right.report_date)
    || left.corpus_id.localeCompare(right.corpus_id)
    || left.reason_code.localeCompare(right.reason_code)
  );
}

function normalizedEventName(value) {
  const text = String(value ?? "");
  return ["schedule", "watchdog", "workflow_dispatch"].includes(text)
    ? text
    : "workflow_dispatch";
}

function normalizedRunSlot(value) {
  const text = String(value ?? "");
  return ["morning", "afternoon", "watchdog", "manual"].includes(text)
    ? text
    : "manual";
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : Number.MAX_SAFE_INTEGER;
}

function bytesText(value) {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return Buffer.from(value).toString("utf8");
  }
  throw new TypeError("attempt corpus bytes are required");
}

function windowId(startDate, behaviorHash) {
  return `c5c/${startDate}/${String(behaviorHash ?? "").slice(0, 16)}`;
}

function nextDate(value) {
  assertDate(value);
  const [yearText, monthText, dayText] = value.split("-");
  let year = Number(yearText);
  let month = Number(monthText);
  let day = Number(dayText) + 1;
  if (day > daysInMonth(year, month)) {
    day = 1;
    month += 1;
  }
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year, month) {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function assertDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) {
    throw new TypeError("reportDate must be YYYY-MM-DD");
  }
  const [year, month, day] = String(value).split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new TypeError("reportDate must be a valid natural date");
  }
}

function compareDates(left, right) {
  return String(left).localeCompare(String(right));
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}

function clone(value) {
  return structuredClone(value);
}
