import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const DAILY_LEADS_LIVENESS_VERSION = 1;
export const DAILY_LEADS_LIVENESS_TARGETS = Object.freeze({
  rolling_days: 7,
  minimum_nonzero_days: 5,
  minimum_new_leads: 7,
  degraded_zero_days: 2,
  unhealthy_zero_days: 3
});

export function analyzeDailyLeadsLiveness(dailyArtifacts, options = {}) {
  if (!Array.isArray(dailyArtifacts) || dailyArtifacts.length === 0) {
    throw new Error("Daily Leads liveness replay requires at least one calendar day.");
  }

  const targets = { ...DAILY_LEADS_LIVENESS_TARGETS, ...(options.targets ?? {}) };
  const days = [...dailyArtifacts]
    .map(normalizeReplayDay)
    .sort((left, right) => left.date.localeCompare(right.date));
  assertUniqueDates(days);

  const history = days.map(summarizeReplayDay);
  const currentDay = history.at(-1);
  if (!currentDay.report_present) {
    throw new Error(`Daily Leads liveness current report is missing for ${currentDay.date}.`);
  }

  const rollingDays = history.slice(-targets.rolling_days);
  const observedRollingDays = rollingDays.filter((day) => day.report_present);
  const rollingNonzeroDays = observedRollingDays.filter((day) => day.new_lead_count > 0).length;
  const rollingNewLeadCount = observedRollingDays.reduce((sum, day) => sum + day.new_lead_count, 0);
  const rollingWindowComplete = observedRollingDays.length === targets.rolling_days;
  const rollingTargetsMet = rollingWindowComplete
    && rollingNonzeroDays >= targets.minimum_nonzero_days
    && rollingNewLeadCount >= targets.minimum_new_leads;
  const consecutiveZeroDays = countConsecutiveZeroDays(history);
  const topBlockingGates = blockingGateDistribution(days);
  const businessLivenessStatus = classifyBusinessLiveness({
    consecutiveZeroDays,
    rollingWindowComplete,
    rollingTargetsMet,
    targets
  });

  return {
    schema_version: DAILY_LEADS_LIVENESS_VERSION,
    window: {
      start_date: days[0].date,
      end_date: days.at(-1).date,
      requested_days: days.length,
      report_days: history.filter((day) => day.report_present).length,
      candidate_artifact_days: history.filter((day) => day.candidate_artifact_present).length,
      missing_report_days: history.filter((day) => !day.report_present).length,
      missing_candidate_artifact_days: history.filter((day) => !day.candidate_artifact_present).length
    },
    targets,
    current_day: currentDay,
    rolling_7: {
      days_observed: observedRollingDays.length,
      nonzero_days: rollingNonzeroDays,
      new_lead_count: rollingNewLeadCount,
      targets_met: rollingTargetsMet
    },
    consecutive_zero_days: consecutiveZeroDays,
    business_liveness_status: businessLivenessStatus,
    top_blocking_gates: topBlockingGates,
    history
  };
}

export function analyzeDailyLeadsLivenessFromRepository({
  rootDir,
  startDate,
  endDate,
  days = 15,
  targets
} = {}) {
  const resolvedRoot = path.resolve(rootDir ?? process.cwd());
  const resolvedEndDate = endDate ?? latestDatedFile(path.join(resolvedRoot, "data/reports"));
  const resolvedStartDate = startDate ?? addDays(resolvedEndDate, -(positiveInteger(days, "days") - 1));
  if (resolvedStartDate > resolvedEndDate) {
    throw new Error(`Daily Leads liveness start date ${resolvedStartDate} is after end date ${resolvedEndDate}.`);
  }

  const replayDays = dateRange(resolvedStartDate, resolvedEndDate).map((date) => ({
    date,
    report: readJsonIfPresent(path.join(resolvedRoot, `data/reports/${date}.json`)),
    candidateArtifact: readJsonIfPresent(path.join(resolvedRoot, `data/sourcing_candidates/${date}.json`))
  }));

  return analyzeDailyLeadsLiveness(replayDays, { targets });
}

function normalizeReplayDay(value) {
  const date = requireDate(value?.date ?? value?.report?.report_date ?? value?.candidateArtifact?.report_date);
  const report = value?.report ?? null;
  const candidateArtifact = value?.candidateArtifact ?? null;
  if (report && report.report_date !== date) {
    throw new Error(`Daily Leads liveness report_date mismatch for ${date}: ${report.report_date}.`);
  }
  if (candidateArtifact && candidateArtifact.report_date !== date) {
    throw new Error(`Daily Leads liveness candidate report_date mismatch for ${date}: ${candidateArtifact.report_date}.`);
  }
  return { date, report, candidateArtifact };
}

function summarizeReplayDay({ date, report, candidateArtifact }) {
  const reportPresent = Boolean(report);
  const newLeadCount = reportPresent
    ? listLength(report.push_pool) + listLength(report.watch_pool)
    : 0;
  const candidates = Array.isArray(candidateArtifact?.candidates) ? candidateArtifact.candidates : [];
  const decisionCounts = {
    formal: candidates.filter((candidate) => candidate?.decision === "formal").length,
    candidate: candidates.filter((candidate) => candidate?.decision === "candidate").length,
    excluded: candidates.filter((candidate) => candidate?.decision === "excluded").length
  };

  if (candidateArtifact) {
    const recordedTotal = candidateArtifact.scan_summary?.records_total;
    if (recordedTotal !== candidates.length) {
      throw new Error(`Daily Leads liveness ${date} records_total=${recordedTotal}, actual=${candidates.length}.`);
    }
    for (const [decision, actual] of Object.entries(decisionCounts)) {
      const recorded = candidateArtifact.scan_summary?.[decision];
      if (recorded !== actual) {
        throw new Error(`Daily Leads liveness ${date} ${decision}=${recorded}, actual=${actual}.`);
      }
    }
    if (reportPresent && decisionCounts.formal !== newLeadCount) {
      throw new Error(
        `Daily Leads liveness ${date} formal/report mismatch: formal=${decisionCounts.formal}, new_lead_count=${newLeadCount}.`
      );
    }
  }

  return {
    date,
    report_present: reportPresent,
    candidate_artifact_present: Boolean(candidateArtifact),
    new_lead_count: newLeadCount,
    candidate_records: candidates.length,
    formal: decisionCounts.formal,
    candidate: decisionCounts.candidate,
    excluded: decisionCounts.excluded
  };
}

function classifyBusinessLiveness({
  consecutiveZeroDays,
  rollingWindowComplete,
  rollingTargetsMet,
  targets
}) {
  if (consecutiveZeroDays >= targets.unhealthy_zero_days) {
    return "unhealthy-business-liveness";
  }
  if (
    consecutiveZeroDays >= targets.degraded_zero_days
    || (rollingWindowComplete && !rollingTargetsMet)
  ) {
    return "degraded";
  }
  return "healthy";
}

function countConsecutiveZeroDays(history) {
  let count = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const day = history[index];
    if (!day.report_present || day.new_lead_count > 0) break;
    count += 1;
  }
  return count;
}

function blockingGateDistribution(days) {
  const distribution = new Map();
  for (const day of days) {
    const dayGates = new Set();
    for (const candidate of day.candidateArtifact?.candidates ?? []) {
      if (candidate?.decision !== "candidate") continue;
      for (const gate of new Set(candidate?.missing_evidence ?? [])) {
        if (typeof gate !== "string" || !gate.trim()) continue;
        const normalizedGate = gate.trim();
        const current = distribution.get(normalizedGate) ?? {
          gate: normalizedGate,
          candidate_occurrences: 0,
          day_occurrences: 0
        };
        current.candidate_occurrences += 1;
        distribution.set(normalizedGate, current);
        dayGates.add(normalizedGate);
      }
    }
    for (const gate of dayGates) {
      distribution.get(gate).day_occurrences += 1;
    }
  }

  return [...distribution.values()]
    .sort((left, right) => (
      right.candidate_occurrences - left.candidate_occurrences
      || right.day_occurrences - left.day_occurrences
      || left.gate.localeCompare(right.gate)
    ))
    .slice(0, 10);
}

function assertUniqueDates(days) {
  const seen = new Set();
  for (const day of days) {
    if (seen.has(day.date)) {
      throw new Error(`Daily Leads liveness replay contains duplicate date ${day.date}.`);
    }
    seen.add(day.date);
  }
}

function readJsonIfPresent(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function latestDatedFile(directory) {
  if (!existsSync(directory)) {
    throw new Error(`Daily Leads liveness report directory is missing: ${directory}.`);
  }
  const latest = readdirSync(directory)
    .map((name) => name.match(/^(\d{4}-\d{2}-\d{2})\.json$/)?.[1])
    .filter(Boolean)
    .sort()
    .at(-1);
  if (!latest) {
    throw new Error(`Daily Leads liveness found no dated reports in ${directory}.`);
  }
  return latest;
}

function dateRange(startDate, endDate) {
  const dates = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function addDays(date, offset) {
  const parsed = new Date(`${requireDate(date)}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + offset);
  return parsed.toISOString().slice(0, 10);
}

function requireDate(value) {
  const date = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error(`Daily Leads liveness requires YYYY-MM-DD dates; received ${date || "(empty)"}.`);
  }
  return date;
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`Daily Leads liveness ${label} must be a positive integer.`);
  }
  return number;
}

function listLength(value) {
  return Array.isArray(value) ? value.length : 0;
}
