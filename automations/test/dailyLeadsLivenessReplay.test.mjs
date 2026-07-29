import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  analyzeDailyLeadsLiveness,
  analyzeDailyLeadsLivenessFromRepository
} from "../jobs/online_daily_leads_liveness.mjs";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

describe("Daily Leads business liveness replay", () => {
  it("classifies healthy, degraded, and unhealthy streaks without changing admission decisions", () => {
    const healthy = analyzeDailyLeadsLiveness([
      replayDay("2026-07-01", 1),
      replayDay("2026-07-02", 1),
      replayDay("2026-07-03", 1),
      replayDay("2026-07-04", 1),
      replayDay("2026-07-05", 3),
      replayDay("2026-07-06", 0, ["official_gameplay"]),
      replayDay("2026-07-07", 1)
    ]);
    const degraded = analyzeDailyLeadsLiveness([
      ...healthy.history.slice(0, 5).map(replayDayFromHistory),
      replayDay("2026-07-06", 0, ["official_gameplay"]),
      replayDay("2026-07-07", 0, ["official_demo_or_playtest"])
    ]);
    const unhealthy = analyzeDailyLeadsLiveness([
      ...healthy.history.slice(0, 4).map(replayDayFromHistory),
      replayDay("2026-07-05", 0, ["independent_quality_proof"]),
      replayDay("2026-07-06", 0, ["official_gameplay"]),
      replayDay("2026-07-07", 0, ["official_demo_or_playtest"])
    ]);

    assert.equal(healthy.business_liveness_status, "healthy");
    assert.equal(healthy.rolling_7.nonzero_days, 6);
    assert.equal(healthy.rolling_7.new_lead_count, 8);
    assert.equal(degraded.business_liveness_status, "degraded");
    assert.equal(degraded.consecutive_zero_days, 2);
    assert.equal(unhealthy.business_liveness_status, "unhealthy-business-liveness");
    assert.equal(unhealthy.consecutive_zero_days, 3);
    assert.deepEqual(unhealthy.top_blocking_gates.slice(0, 3), [
      { gate: "independent_quality_proof", candidate_occurrences: 1, day_occurrences: 1 },
      { gate: "official_demo_or_playtest", candidate_occurrences: 1, day_occurrences: 1 },
      { gate: "official_gameplay", candidate_occurrences: 1, day_occurrences: 1 }
    ]);
    assert.deepEqual(
      unhealthy.history.map(({ date, new_lead_count }) => ({ date, new_lead_count })),
      [
        { date: "2026-07-01", new_lead_count: 1 },
        { date: "2026-07-02", new_lead_count: 1 },
        { date: "2026-07-03", new_lead_count: 1 },
        { date: "2026-07-04", new_lead_count: 1 },
        { date: "2026-07-05", new_lead_count: 0 },
        { date: "2026-07-06", new_lead_count: 0 },
        { date: "2026-07-07", new_lead_count: 0 }
      ]
    );
  });

  it("replays the fixed 2026-07-15 through 2026-07-29 production artifacts", () => {
    const replay = analyzeDailyLeadsLivenessFromRepository({
      rootDir: repoRoot,
      startDate: "2026-07-15",
      endDate: "2026-07-29"
    });

    assert.equal(replay.window.report_days, 15);
    assert.equal(replay.window.candidate_artifact_days, 14);
    assert.equal(replay.window.missing_candidate_artifact_days, 1);
    assert.equal(replay.current_day.new_lead_count, 0);
    assert.equal(replay.consecutive_zero_days, 15);
    assert.equal(replay.business_liveness_status, "unhealthy-business-liveness");
    assert.equal(replay.rolling_7.nonzero_days, 0);
    assert.equal(replay.rolling_7.new_lead_count, 0);
    assert.deepEqual(replay.top_blocking_gates.slice(0, 3), [
      { gate: "independent_quality_proof", candidate_occurrences: 3017, day_occurrences: 14 },
      { gate: "steam_review_summary", candidate_occurrences: 3017, day_occurrences: 14 },
      { gate: "official_gameplay", candidate_occurrences: 2943, day_occurrences: 14 }
    ]);
    assert.ok(replay.history.every((day) => day.new_lead_count === 0));
  });

  it("exposes the real replay through a deterministic CLI", () => {
    const result = spawnSync(process.execPath, [
      "scripts/replay-daily-leads-liveness.mjs",
      "--from=2026-07-15",
      "--to=2026-07-29"
    ], {
      cwd: repoRoot,
      encoding: "utf8"
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const replay = JSON.parse(result.stdout);
    assert.equal(replay.business_liveness_status, "unhealthy-business-liveness");
    assert.equal(replay.window.report_days, 15);
  });

  it("keeps workflow triggers unchanged and writes liveness observability into receipts", () => {
    const syncWorkflow = readFileSync(new URL("../../.github/workflows/sync-daily-report.yml", import.meta.url), "utf8");
    const watchdogWorkflow = readFileSync(new URL("../../.github/workflows/daily-report-watchdog.yml", import.meta.url), "utf8");

    for (const workflow of [syncWorkflow, watchdogWorkflow]) {
      assert.match(workflow, /workflow_dispatch:/);
      assert.match(workflow, /schedule:/);
      assert.doesNotMatch(workflow, /^\s+push:/m);
      assert.doesNotMatch(workflow, /^\s+pull_request:/m);
      assert.match(workflow, /analyzeDailyLeadsLivenessFromRepository/);
      assert.match(workflow, /business_liveness_status:/);
      assert.match(workflow, /top_blocking_gates:/);
      assert.match(workflow, /consecutive_zero_days:/);
    }
  });
});

function replayDay(date, newLeadCount, missingEvidence = []) {
  const formalCandidates = Array.from({ length: newLeadCount }, (_, index) => ({
    decision: "formal",
    dedupe_key: `steam:${date}-${index}`,
    missing_evidence: []
  }));
  const candidate = missingEvidence.length
    ? [{
        decision: "candidate",
        dedupe_key: `candidate:${date}`,
        missing_evidence: missingEvidence
      }]
    : [];
  return {
    date,
    report: {
      report_date: date,
      push_pool: formalCandidates.map(({ dedupe_key }) => ({ project: dedupe_key })),
      watch_pool: [],
      drop_pool: []
    },
    candidateArtifact: {
      report_date: date,
      scan_summary: {
        records_total: formalCandidates.length + candidate.length,
        formal: formalCandidates.length,
        candidate: candidate.length,
        excluded: 0
      },
      candidates: [...formalCandidates, ...candidate]
    }
  };
}

function replayDayFromHistory(day) {
  return replayDay(day.date, day.new_lead_count);
}
