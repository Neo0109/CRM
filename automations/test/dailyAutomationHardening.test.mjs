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

  it("keeps machine-readable sourcing rules aligned with both V7.2 regular lanes", () => {
    const rules = JSON.parse(readRepoFile("automations/rules/daily-report.json"));

    assert.equal(rules.rule_version, "sourcing-rules-v7.2.1-media-product-domain");
    assert.equal("quality_quarantine" in rules, false);
    assert.deepEqual(rules.indie_prelaunch_admission, {
      active: true,
      sourcing_lane: "indie_prelaunch",
      required_gate_ids: [
        "identity_and_dedupe",
        "prelaunch_window",
        "publisher_china_capacity_clear",
        "non_narrative_product",
        "non_india_team",
        "official_demo_or_playtest",
        "official_gameplay",
        "independent_quality_proof",
        "non_steam_business_entry",
        "concrete_china_bilibili_value",
        "overseas_china_demand"
      ],
      all_gates_required: true,
      qualified_route: "push_pool",
      unqualified_route: "sourcing_candidates",
      automatic_priority: null,
      formal_lead_minimum: null,
      formal_lead_maximum: null,
      watch_pool_enabled: false,
      drop_pool_enabled: false,
      invariant: "new_qualified_count === push_pool_count"
    });
    assert.deepEqual(rules.china_joint_admission.required_gate_ids, [
      "identity_and_dedupe",
      "traction_or_proven_team_event",
      "current_china_opportunity",
      "mature_china_partner_clear"
    ]);
    assert.equal(rules.china_joint_admission.data_paths[0].minimum_recommendations, 5000);
    assert.equal(rules.china_joint_admission.data_paths[1].minimum_recommendations, 1500);
    assert.deepEqual(rules.china_joint_admission.data_paths[1].accepted_ratings, ["very_positive", "overwhelmingly_positive"]);
    assert.equal(rules.china_joint_admission.formal_lead_minimum, null);
    assert.equal(rules.china_joint_admission.formal_lead_maximum, null);
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
