import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { RULE_VERSION } from "../jobs/online_daily_v4_rules.mjs";
import { inspectDailyReport } from "../../scripts/daily-report-watchdog.mjs";

const thresholds = {
  minCandidates: 18,
  minReviewCandidates: 18,
  minRadarItems: 8,
  minSteamTrendItems: 8,
  minSteamMarketInsights: 3,
  minSteamGenreSignals: 3
};

test("watchdog treats low volume as degraded after artifacts and sync succeed", () => {
  const rootDir = fixtureRoot("2026-07-10", { push: 8, watch: 5, drop: 12 });
  const state = inspectDailyReport("2026-07-10", thresholds, {
    rootDir,
    ruleVersion: "sourcing-rules-v6.7-non-game-animation-gate"
  });

  assert.equal(state.ok, true);
  assert.equal(state.degraded, true);
  assert.equal(state.needs_run, false);
  assert.deepEqual(state.reasons, []);
  assert.match(state.warnings.join("\n"), /review candidate count 13 below target 18/);
});

test("watchdog treats an empty quarantine Lead pool as healthy after artifacts and sync succeed", () => {
  const rootDir = fixtureRoot("2026-07-15", { push: 0, watch: 0, drop: 0 });
  const state = inspectDailyReport("2026-07-15", thresholds, { rootDir, ruleVersion: RULE_VERSION });

  assert.equal(state.ok, true);
  assert.equal(state.degraded, false);
  assert.equal(state.needs_run, false);
  assert.equal(state.rule_version, RULE_VERSION);
  assert.deepEqual(state.reasons, []);
  assert.deepEqual(state.warnings, []);
});

test("watchdog still requests recovery when artifacts or synced receipt are missing", () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), "crm-watchdog-missing-"));
  const state = inspectDailyReport("2026-07-10", thresholds, { rootDir });

  assert.equal(state.ok, false);
  assert.equal(state.needs_run, true);
  assert.match(state.reasons.join("\n"), /missing files/);
  assert.match(state.reasons.join("\n"), /no successful sync receipt/);
});

function fixtureRoot(date, counts) {
  const rootDir = mkdtempSync(path.join(tmpdir(), "crm-watchdog-degraded-"));
  for (const directory of ["data/reports", "data/radar", "data/steam_trends", "data/sourcing_candidates", "data/automation_runs"]) {
    mkdirSync(path.join(rootDir, directory), { recursive: true });
  }

  writeJson(rootDir, `data/reports/${date}.json`, {
    report_date: date,
    push_pool: items(counts.push),
    watch_pool: items(counts.watch),
    drop_pool: items(counts.drop)
  });
  writeJson(rootDir, `data/radar/${date}.json`, { report_date: date, items: items(14) });
  writeJson(rootDir, `data/steam_trends/${date}.json`, {
    report_date: date,
    items: items(8),
    market_insights: items(3),
    genre_signals: items(3)
  });
  writeJson(rootDir, `data/sourcing_candidates/${date}.json`, {
    report_date: date,
    scan_summary: {
      formal: counts.push + counts.watch,
      candidate: 0,
      excluded: counts.drop
    },
    candidates: items(counts.push + counts.watch + counts.drop)
  });
  writeJson(rootDir, `data/automation_runs/${date}-incident-recovery.json`, {
    report_date: date,
    slot: "incident-recovery",
    status: "success",
    sync_response: JSON.stringify({ synced: true })
  });
  return rootDir;
}

function items(length) {
  return Array.from({ length }, (_, index) => ({ id: index }));
}

function writeJson(rootDir, relativePath, payload) {
  writeFileSync(path.join(rootDir, relativePath), `${JSON.stringify(payload)}\n`, "utf8");
}
