import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

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
  const state = inspectDailyReport("2026-07-10", thresholds, { rootDir });

  assert.equal(state.ok, true);
  assert.equal(state.degraded, true);
  assert.equal(state.needs_run, false);
  assert.deepEqual(state.reasons, []);
  assert.match(state.warnings.join("\n"), /review candidate count 13 below target 18/);
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
  for (const directory of ["data/reports", "data/radar", "data/steam_trends", "data/automation_runs"]) {
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
