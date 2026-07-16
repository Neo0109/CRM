import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

describe("visual AI manual workflow contract", () => {
  it("has workflow_dispatch as its only trigger", () => {
    const workflow = readRepoFile(".github/workflows/visual-ai-manual-audit.yml");
    const triggerBlock = workflow.slice(workflow.indexOf("on:"), workflow.indexOf("permissions:"));

    assert.match(triggerBlock, /workflow_dispatch:/);
    assert.doesNotMatch(triggerBlock, /schedule:/);
    assert.doesNotMatch(triggerBlock, /\bpush:/);
    assert.doesNotMatch(triggerBlock, /pull_request:/);
    assert.doesNotMatch(triggerBlock, /workflow_run:/);
    assert.doesNotMatch(triggerBlock, /repository_dispatch:/);
  });

  it("defaults to disabled and requires separate approval, key, model, and budgets for future real calls", () => {
    const workflow = readRepoFile(".github/workflows/visual-ai-manual-audit.yml");

    assert.match(workflow, /provider:[\s\S]*default: disabled/);
    assert.match(workflow, /model:[\s\S]*default: ""/);
    assert.match(workflow, /max_requests:[\s\S]*default: 0/);
    assert.match(workflow, /max_images:[\s\S]*default: 0/);
    assert.match(workflow, /max_output_tokens:[\s\S]*default: 0/);
    assert.match(workflow, /VISUAL_AI_PRODUCTION_APPROVED: \$\{\{ vars\.VISUAL_AI_PRODUCTION_APPROVED \|\| 'false' \}\}/);
    assert.match(workflow, /VISUAL_AI_API_KEY: \$\{\{ secrets\.VISUAL_AI_API_KEY \}\}/);
    assert.doesNotMatch(workflow, /secrets\.OPENAI_API_KEY/);
  });

  it("is read-only, uploads an audit artifact, and has no CRM import or repository write path", () => {
    const workflow = readRepoFile(".github/workflows/visual-ai-manual-audit.yml");

    assert.match(workflow, /permissions:\s+contents: read/);
    assert.match(workflow, /persist-credentials: false/);
    assert.match(workflow, /visual_ai_manual_audit_cli\.mjs/);
    assert.match(workflow, /actions\/upload-artifact@v4/);
    assert.match(workflow, /visual-ai-manual-audit-/);
    assert.doesNotMatch(workflow, /git (add|commit|push)/);
    assert.doesNotMatch(workflow, /curl|CRM_AUTOMATION_TOKEN|CRM_ACCESS_TOKEN|import-daily-report|api\/reports\/sync|import_to_crm/);
  });

  it("does not connect visual audit to Daily, Radar, Steam Trends, or CRM import", () => {
    for (const protectedPath of [
      ".github/workflows/sync-daily-report.yml",
      ".github/workflows/daily-report-watchdog.yml",
      ".github/workflows/steam-review-opportunities.yml",
      "automations/jobs/online_daily_runner.mjs",
      "automations/jobs/import_to_crm.ts"
    ]) {
      assert.doesNotMatch(readRepoFile(protectedPath), /visual_ai_manual|visual-ai-manual/i, protectedPath);
    }

    for (const auditPath of [
      ".github/workflows/visual-ai-manual-audit.yml",
      "automations/jobs/visual_ai_manual_audit.mjs",
      "automations/jobs/visual_ai_manual_audit_cli.mjs",
      "automations/jobs/visual_ai_fake_provider.mjs",
      "automations/jobs/visual_ai_openai_provider.mjs"
    ]) {
      const source = readRepoFile(auditPath);
      assert.doesNotMatch(source, /import-daily-report|api\/leads|api\/reports\/sync|import_to_crm|CRM_AUTOMATION_TOKEN|CRM_ACCESS_TOKEN/, auditPath);
    }
  });

  it("runs the focused fake-provider suite in Build CI", () => {
    const buildWorkflow = readRepoFile(".github/workflows/build.yml");

    assert.match(buildWorkflow, /Test visual AI manual audit/);
    assert.match(buildWorkflow, /node --test automations\/test\/visualAi\*\.test\.mjs/);
    assert.doesNotMatch(buildWorkflow, /VISUAL_AI_API_KEY|visual_ai_openai_provider/);
  });

  it("defines an advisory-only schema without recommendation action fields", () => {
    const schema = JSON.parse(readRepoFile("schemas/visual_ai_manual_audit.schema.json"));
    const resultProperties = schema.$defs.auditResult.properties;

    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.$defs.auditResult.additionalProperties, false);
    assert.equal(resultProperties.recommendation_impact.const, "none");
    for (const field of ["priority", "bucket", "decision", "withdraw_lead", "sourcing_pool"]) {
      assert.equal(field in resultProperties, false, field);
    }
  });

  it("documents the disabled default and separate future approval boundary", () => {
    const documentation = readRepoFile("docs/VISUAL_AI_MANUAL_AUDIT.md");

    assert.match(documentation, /only be started with `workflow_dispatch`/);
    assert.match(documentation, /Provider: `disabled`/);
    assert.match(documentation, /Real AI requests: `0`/);
    assert.match(documentation, /VISUAL_AI_PRODUCTION_APPROVED/);
    assert.match(documentation, /VISUAL_AI_API_KEY/);
    assert.match(documentation, /separate explicit user approval/);
    assert.match(documentation, /recommendation_impact: \"none\"/);
  });
});

function readRepoFile(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}
