import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);

describe("Steam review opportunity workflow contract", () => {
  it("uses a dedicated schedule/dispatch workflow and leaves both Daily workflows disconnected", () => {
    const workflow = readRepoFile(".github/workflows/steam-review-opportunities.yml");
    const triggerBlock = workflow.slice(workflow.indexOf("on:"), workflow.indexOf("permissions:"));

    assert.match(triggerBlock, /workflow_dispatch:/);
    assert.match(triggerBlock, /schedule:/);
    assert.doesNotMatch(triggerBlock, /\bpush:/);
    assert.doesNotMatch(triggerBlock, /pull_request:/);
    assert.doesNotMatch(triggerBlock, /workflow_run:/);

    for (const dailyWorkflow of [
      ".github/workflows/sync-daily-report.yml",
      ".github/workflows/daily-report-watchdog.yml"
    ]) {
      assert.doesNotMatch(readRepoFile(dailyWorkflow), /steam_review_opportunity|steam-review-opportunit/i);
    }
  });

  it("runs a full unbounded scan and hard-gates create-only import on scan completeness", () => {
    const workflow = readRepoFile(".github/workflows/steam-review-opportunities.yml");

    assert.match(workflow, /steam_review_opportunity_delivery\.mjs prepare/);
    assert.match(workflow, /--mode="\$REQUESTED_MODE"/);
    assert.doesNotMatch(workflow, /--maxPages|--max-pages|max_pages/);
    assert.match(workflow, /ready_for_sync/);
    assert.match(workflow, /scan_complete/);
    assert.match(workflow, /import-daily-report\?mode=create-only/);
    assert.match(workflow, /Authorization: Bearer \$CRM_AUTOMATION_TOKEN/);
    assert.doesNotMatch(workflow, /api\/reports\/sync/);
  });

  it("commits separate audit/receipt paths and enforces the strict success receipt", () => {
    const workflow = readRepoFile(".github/workflows/steam-review-opportunities.yml");

    assert.match(workflow, /data\/steam_review_opportunities\/\$REPORT_DATE\.json/);
    assert.match(workflow, /data\/steam_review_opportunity_runs\/\$REPORT_DATE-\$RUN_SLOT\.json/);
    assert.match(workflow, /receipt_args=\(/);
    assert.match(workflow, /steam_review_opportunity_delivery\.mjs "\$\{receipt_args\[@\]\}"/);
    assert.match(workflow, /validate:steam-review-opportunity-run/);
    assert.match(workflow, /receipt\.status !== "success"/);
    assert.match(workflow, /receipt\.scan_complete !== true/);
    assert.match(workflow, /receipt\.sync_response\?\.synced !== true/);
    assert.match(workflow, /receipt\.updated_count !== 0/);
  });

  it("keeps the current rule entrypoint traceable to the machine rule, workflow, and delivery contract", () => {
    const currentRules = readRepoFile("docs/SOURCING_RULES_CURRENT.md");
    const deliveryDoc = readRepoFile("docs/STEAM_REVIEW_OPPORTUNITY_DELIVERY.md");
    const machineRule = JSON.parse(readRepoFile("automations/rules/steam-review-opportunities.json"));

    assert.equal(machineRule.rule_version, "sourcing-rules-v7.1");
    assert.equal(machineRule.workflow, ".github/workflows/steam-review-opportunities.yml");
    assert.equal(machineRule.admission.formal_lead_maximum, null);
    assert.equal(machineRule.delivery_guardrails.crm_import_mode, "create-only");
    assert.match(currentRules, /STEAM_REVIEW_OPPORTUNITY_DELIVERY\.md/);
    assert.match(currentRules, /automations\/rules\/steam-review-opportunities\.json/);
    assert.match(deliveryDoc, /scan_complete=true/);
    assert.match(deliveryDoc, /sync_response\.synced=true/);
  });
});

function readRepoFile(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}
