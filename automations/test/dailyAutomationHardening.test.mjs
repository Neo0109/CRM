import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("../..", import.meta.url)));

function readRepoFile(repoPath) {
  return readFileSync(resolve(rootDir, repoPath), "utf8");
}

describe("daily automation hardening contract", () => {
  it("keeps production workflows off low-volume soft-fail mode", () => {
    const syncWorkflow = readRepoFile(".github/workflows/sync-daily-report.yml");
    const watchdogWorkflow = readRepoFile(".github/workflows/daily-report-watchdog.yml");
    const runner = readRepoFile("automations/jobs/online_daily_runner.mjs");
    const workflowText = `${syncWorkflow}\n${watchdogWorkflow}`;

    assert.doesNotMatch(workflowText, /--allowLowVolume=true/);
    assert.doesNotMatch(runner, /allowLowVolume/);
    assert.doesNotMatch(workflowText, /--minReviewCandidates=3/);
    assert.match(syncWorkflow, /--minReviewLeads=18/);
    assert.match(syncWorkflow, /--minMediaLeads=10/);
    assert.match(watchdogWorkflow, /--minCandidates=18 --minReviewCandidates=18/);
  });

  it("records generation failures without treating them as successful receipts", () => {
    const workflowText = [
      readRepoFile(".github/workflows/sync-daily-report.yml"),
      readRepoFile(".github/workflows/daily-report-watchdog.yml"),
    ].join("\n");

    assert.match(workflowText, /status = 'generation_failed'/);
    assert.match(workflowText, /failure_stage/);
    assert.match(workflowText, /failure_reason/);
    assert.match(workflowText, /volume_diagnostics/);
    assert.match(workflowText, /generation_log_tail/);
    assert.match(workflowText, /validation_log_tail/);
    assert.match(workflowText, /generation\+validation\+sync success/);
  });

  it("requires strict synced receipts for watchdog health", () => {
    const watchdogScript = readRepoFile("scripts/daily-report-watchdog.mjs");

    assert.match(watchdogScript, /receipt\.status === "success" && syncPayload\?\.synced === true/);
    assert.doesNotMatch(watchdogScript, /receipt\.status === "success" \|\|/);
  });
});
