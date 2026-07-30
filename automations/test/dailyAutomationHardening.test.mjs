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
  it("removes formal Lead quantity targets while contract and sync failures stay blocking", () => {
    const syncWorkflow = readRepoFile(".github/workflows/sync-daily-report.yml");
    const watchdogWorkflow = readRepoFile(".github/workflows/daily-report-watchdog.yml");
    const runner = readRepoFile("automations/jobs/online_daily_runner.mjs");
    const workflowText = `${syncWorkflow}\n${watchdogWorkflow}`;

    assert.match(syncWorkflow, /--allowLowVolume=true/);
    assert.match(watchdogWorkflow, /--allowLowVolume=true/);
    assert.match(syncWorkflow, /--requireSourcingCandidates=true/);
    assert.match(watchdogWorkflow, /--requireSourcingCandidates=true/);
    assert.match(runner, /allowLowVolume/);
    assert.doesNotMatch(workflowText, /--minReviewCandidates|--minCandidates|--minReviewLeads|--minMediaLeads|--minReviewBackfillScore/);
  });

  it("allows the daily report schema to carry the canonical drop reason field", () => {
    const schema = JSON.parse(readRepoFile("schemas/daily_report.schema.json"));
    assert.deepEqual(schema.$defs.reportLead.properties.drop_reason, { type: ["string", "null"] });
  });

  it("keeps machine-readable sourcing lanes quota-free and blocks second-pass bypasses", () => {
    const rules = JSON.parse(readRepoFile("automations/rules/daily-report.json"));
    const lanes = [
      rules.indie_prelaunch_admission,
      rules.china_joint_admission
    ];

    assert.equal("quality_quarantine" in rules, false);
    for (const lane of lanes) {
      assert.equal(lane.automatic_priority, null);
      assert.equal(lane.formal_lead_minimum, null);
      assert.equal(lane.formal_lead_maximum, null);
      assert.equal(lane.watch_pool_enabled, false);
      assert.equal(lane.drop_pool_enabled, false);
      assert.equal(lane.invariant, "new_qualified_count === push_pool_count");
    }

    const secondPass = rules.indie_prelaunch_admission.targeted_second_pass;
    assert.equal(secondPass.same_decision_function_required, true);
    assert.equal(secondPass.hard_exclusion_bypass, false);
    assert.equal(secondPass.formal_lead_backfill, false);
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

  it("records Steam evidence loss as a structured receipt field", () => {
    const syncWorkflow = readRepoFile(".github/workflows/sync-daily-report.yml");
    const watchdogWorkflow = readRepoFile(".github/workflows/daily-report-watchdog.yml");

    for (const workflow of [syncWorkflow, watchdogWorkflow]) {
      assert.match(workflow, /const reportPayloadPath = `data\/reports\/\$\{reportDate\}\.json`;/);
      assert.match(workflow, /generationStatus === 'success'/);
      assert.match(workflow, /reportPayload\?\.diagnostics\?\.steam_evidence_lost/);
      assert.match(workflow, /failurePayload\?\.diagnostics\?\.steam_evidence_lost/);
      assert.match(workflow, /steam_evidence_lost: steamEvidenceLost/);
    }
  });

  it("requires strict synced receipts for watchdog health", () => {
    const watchdogScript = readRepoFile("scripts/daily-report-watchdog.mjs");

    assert.match(watchdogScript, /receipt\.status === "success" && syncPayload\?\.synced === true/);
    assert.doesNotMatch(watchdogScript, /receipt\.status === "success" \|\|/);
  });
});
