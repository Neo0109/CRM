import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  STEAM_REVIEW_RULE_VERSION,
  buildSteamReviewImportReport,
  buildSteamReviewOpportunityReceipt,
  prepareSteamReviewOpportunityDelivery,
  resolveSteamReviewRunMode,
  selectSteamReviewDeliveryCandidates,
  validateSteamReviewOpportunityReceipt
} from "../jobs/steam_review_opportunity_delivery.mjs";

const reportDate = "2026-07-16";
const generatedAt = "2026-07-16T02:00:00+08:00";

describe("Steam review opportunity V7.1 delivery", () => {
  it("keeps auto mode in backfill until a strict successful backfill receipt exists", () => {
    const initialArtifact = artifact([
      opportunity("9001", { decision: "qualified", matchedRules: ["china_heat_ops"] })
    ], { reportDate: "2026-07-01" });
    const successfulBackfill = successfulReceipt(initialArtifact, { mode: "backfill" });
    assert.equal(resolveSteamReviewRunMode("auto", []), "backfill");
    assert.equal(resolveSteamReviewRunMode("backfill", []), "backfill");
    assert.equal(resolveSteamReviewRunMode("scheduled", []), "scheduled");
    assert.equal(resolveSteamReviewRunMode("auto", [{
      ...successfulBackfill,
      status: "sync_failed",
      sync_response: { synced: false },
      created_count: 0,
      failure_reason: "fixture failure"
    }]), "backfill");
    assert.equal(resolveSteamReviewRunMode("auto", [successfulBackfill]), "scheduled");
  });

  it("delivers only new discoveries and first threshold crossings on scheduled rescans", () => {
    const current = artifact([
      opportunity("1001", { decision: "qualified", matchedRules: ["ea_mobile_high_traction"] }),
      opportunity("1002", { decision: "qualified", matchedRules: ["china_heat_ops"] }),
      opportunity("1003", { decision: "qualified", matchedRules: ["china_heat_ops"] })
    ]);
    const prior = artifact([
      opportunity("1001", { decision: "qualified", matchedRules: ["ea_mobile_high_traction"] }),
      opportunity("1002", { decision: "not_qualified", matchedRules: [] })
    ], { reportDate: "2026-07-09" });

    const scheduled = selectSteamReviewDeliveryCandidates({
      artifact: current,
      priorArtifacts: [prior],
      priorReceipts: [successfulReceipt(prior)],
      mode: "scheduled"
    });
    assert.deepEqual(scheduled.candidates.map((item) => item.steam_app_id), ["1002", "1003"]);
    assert.equal(scheduled.qualifiedCount, 3);
    assert.equal(scheduled.previouslyQualifiedCount, 1);
    assert.equal(scheduled.importCandidateCount, 2);

    const backfill = selectSteamReviewDeliveryCandidates({
      artifact: current,
      priorArtifacts: [prior],
      priorReceipts: [],
      mode: "backfill"
    });
    assert.deepEqual(backfill.candidates.map((item) => item.steam_app_id), ["1001", "1002", "1003"]);
    assert.equal(backfill.previouslyQualifiedCount, 0);
  });

  it("does not advance scheduled suppression history until delivery has a strict success receipt", () => {
    const current = artifact([
      opportunity("1501", { decision: "qualified", matchedRules: ["china_heat_ops"] })
    ]);
    const prior = artifact([
      opportunity("1501", { decision: "qualified", matchedRules: ["china_heat_ops"] })
    ], { reportDate: "2026-07-09" });
    const failedReceipt = {
      ...successfulReceipt(prior),
      status: "sync_failed",
      sync_response: { synced: false },
      created_count: 0
    };

    const retry = selectSteamReviewDeliveryCandidates({
      artifact: current,
      priorArtifacts: [prior],
      priorReceipts: [failedReceipt],
      mode: "scheduled"
    });
    assert.deepEqual(retry.candidates.map((item) => item.steam_app_id), ["1501"]);

    const delivered = selectSteamReviewDeliveryCandidates({
      artifact: current,
      priorArtifacts: [prior],
      priorReceipts: [successfulReceipt(prior)],
      mode: "scheduled"
    });
    assert.deepEqual(delivered.candidates, []);
    assert.equal(delivered.previouslyQualifiedCount, 1);

    const replacementAtSamePath = artifact([
      opportunity("1502", { decision: "qualified", matchedRules: ["china_heat_ops"] })
    ], { reportDate: prior.report_date });
    const retryReplacement = selectSteamReviewDeliveryCandidates({
      artifact: replacementAtSamePath,
      priorArtifacts: [replacementAtSamePath],
      priorReceipts: [successfulReceipt(prior)],
      mode: "scheduled"
    });
    assert.deepEqual(retryReplacement.candidates.map((item) => item.steam_app_id), ["1502"]);
  });

  it("never truncates qualified candidates and maps dual matches to one primary Lead", () => {
    const opportunities = Array.from({ length: 12 }, (_, index) => opportunity(String(2000 + index), {
      decision: "qualified",
      matchedRules: index === 11
        ? ["ea_mobile_high_traction", "china_heat_ops"]
        : ["ea_mobile_high_traction"]
    }));
    const current = artifact(opportunities);
    const report = buildSteamReviewImportReport({ artifact: current, mode: "backfill" });

    assert.equal(report.push_pool.length, 12);
    assert.equal(new Set(report.push_pool.map((lead) => lead.steam_app_id)).size, 12);
    const dual = report.push_pool.at(-1);
    assert.equal(dual.sourcing_lane, "china_heat_ops");
    assert.equal(dual.priority, null);
    assert.equal(dual.sourcing_rule_version, STEAM_REVIEW_RULE_VERSION);
    assert.equal(dual.sourcing_run_type, "initial_backfill");
    assert.match(dual.rule_fit, /matched_rules=ea_mobile_high_traction,china_heat_ops/);
    assert.deepEqual(dual.links, [dual.contact_methods[0].value]);
    assertValidDailyReport(report);
  });

  it("hard-blocks every CRM payload when the full scan is incomplete", () => {
    const incomplete = artifact([
      opportunity("3001", { decision: "qualified", matchedRules: ["china_heat_ops"] })
    ], { scanComplete: false, sourceFailures: [{ stage: "catalog", steam_app_id: null, message: "timeout" }] });

    assert.throws(
      () => selectSteamReviewDeliveryCandidates({ artifact: incomplete, mode: "backfill" }),
      /scan_complete=true/
    );
    assert.throws(
      () => buildSteamReviewImportReport({ artifact: incomplete, mode: "backfill" }),
      /scan_complete=true/
    );
  });

  it("prepares an unbounded backfill payload only after a complete audit", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "crm-steam-review-delivery-"));
    const current = artifact([
      opportunity("4001", { decision: "qualified", matchedRules: ["ea_mobile_high_traction"] }),
      opportunity("4002", { decision: "qualified", matchedRules: ["china_heat_ops"] })
    ]);
    const result = await prepareSteamReviewOpportunityDelivery({
      rootDir,
      reportDate,
      runSlot: "initial",
      requestedMode: "auto",
      generatedAt,
      auditImpl: fakeAudit(current)
    });

    assert.equal(result.preparation.mode, "backfill");
    assert.equal(result.preparation.sourcing_run_type, "initial_backfill");
    assert.equal(result.preparation.scan_complete, true);
    assert.equal(result.preparation.ready_for_sync, true);
    assert.equal(result.preparation.catalog_scan_count, 2);
    assert.equal(result.preparation.qualified_count, 2);
    assert.equal(result.preparation.import_candidate_count, 2);
    assert.equal(result.preparation.artifact_sha256, artifactSha256(current));
    assert.equal(result.preparation.collect_options.maxPages, undefined);
    assert.deepEqual(
      JSON.parse(readFileSync(result.importPayloadPath, "utf8")).push_pool.map((lead) => lead.steam_app_id),
      ["4001", "4002"]
    );
    assert.equal(JSON.parse(readFileSync(result.preparationPath, "utf8")).ready_for_sync, true);
  });

  it("writes no import payload for an incomplete prepared scan", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "crm-steam-review-incomplete-"));
    const incomplete = artifact([], {
      scanComplete: false,
      sourceFailures: [{ stage: "catalog", steam_app_id: null, message: "fixture failure" }]
    });
    const result = await prepareSteamReviewOpportunityDelivery({
      rootDir,
      reportDate,
      runSlot: "incomplete",
      requestedMode: "backfill",
      generatedAt,
      auditImpl: fakeAudit(incomplete)
    });

    assert.equal(result.preparation.ready_for_sync, false);
    assert.equal(result.preparation.failure_reason, "scan_incomplete");
    assert.equal(result.importPayloadPath, null);
  });

  it("records strict success metrics and rejects false-success or updating receipts", () => {
    const preparation = {
      schema_version: 1,
      report_date: reportDate,
      run_slot: "initial",
      requested_mode: "backfill",
      mode: "backfill",
      sourcing_run_type: "initial_backfill",
      generated_at: generatedAt,
      scan_complete: true,
      ready_for_sync: true,
      artifact_path: `data/steam_review_opportunities/${reportDate}.json`,
      artifact_sha256: artifactSha256(artifact([])),
      import_payload_path: "data/runtime/import.json",
      catalog_scan_count: 20,
      catalog_entries_seen: 21,
      qualified_count: 7,
      previously_qualified_count: 0,
      import_candidate_count: 7,
      failure_reason: null,
      collect_options: { pageSize: 100, concurrency: 2, requestDelayMs: 250 }
    };
    const receipt = buildSteamReviewOpportunityReceipt({
      preparation,
      syncResponse: { synced: true, created: 5, skipped_existing: 2, updated: 0, total: 100 },
      runId: "123",
      runNumber: "8",
      repository: "Neo0109/CRM",
      headSha: "abc123",
      capturedAt: "2026-07-16T00:00:00.000Z"
    });

    assert.equal(receipt.status, "success");
    assert.equal(receipt.scan_complete, true);
    assert.equal(receipt.catalog_scan_count, 20);
    assert.equal(receipt.qualified_count, 7);
    assert.equal(receipt.deduplicated_count, 2);
    assert.equal(receipt.created_count, 5);
    assert.equal(receipt.updated_count, 0);
    assert.equal(receipt.sync_response.synced, true);
    assert.equal(receipt.artifact_sha256, preparation.artifact_sha256);
    assert.doesNotThrow(() => validateSteamReviewOpportunityReceipt(receipt));
    assertValidSteamReceiptSchema(receipt);

    const falseSuccess = structuredClone(receipt);
    falseSuccess.sync_response.synced = false;
    assert.throws(() => validateSteamReviewOpportunityReceipt(falseSuccess), /sync_response\.synced=true/);

    const updated = structuredClone(receipt);
    updated.updated_count = 1;
    updated.sync_response.updated = 1;
    assert.throws(() => validateSteamReviewOpportunityReceipt(updated), /updated_count=0/);
  });
});

function artifact(opportunities, options = {}) {
  const scanComplete = options.scanComplete ?? true;
  const sourceFailures = options.sourceFailures ?? [];
  const qualified = opportunities.filter((item) => item.decision === "qualified").length;
  const needsEvidence = opportunities.filter((item) => item.decision === "needs_evidence").length;
  return {
    schema_version: 1,
    report_date: options.reportDate ?? reportDate,
    generated_at: generatedAt,
    source_contract: "steam-schinese-reviews-v1",
    scan_summary: {
      scan_complete: scanComplete,
      pages_scanned: 1,
      catalog_entries_seen: opportunities.length,
      unique_apps_seen: opportunities.length,
      reported_total: opportunities.length,
      prefilter_matches: opportunities.length,
      records_total: opportunities.length,
      official_reviews_confirmed: opportunities.length,
      store_details_confirmed: opportunities.length,
      qualified,
      not_qualified: opportunities.length - qualified - needsEvidence,
      needs_evidence: needsEvidence,
      source_failures: sourceFailures
    },
    opportunities
  };
}

function opportunity(appId, options = {}) {
  const matchedRules = options.matchedRules ?? [];
  const heat = matchedRules.includes("china_heat_ops");
  const ea = matchedRules.includes("ea_mobile_high_traction");
  const totalReviews = heat ? 12000 : 1500;
  const positiveReviews = Math.round(totalReviews * 0.84);
  return {
    steam_app_id: appId,
    project: `Fixture ${appId}`,
    store_url: `https://store.steampowered.com/app/${appId}/`,
    catalog_review_summary: {
      status: "available",
      text: `${totalReviews} reviews`,
      total_reviews: totalReviews,
      usage: "prefilter_only"
    },
    steam_review_summary: {
      status: "available",
      text: "Very Positive",
      positive_reviews: positiveReviews,
      negative_reviews: totalReviews - positiveReviews,
      total_reviews: totalReviews,
      positive_rate: Number(((positiveReviews / totalReviews) * 100).toFixed(4)),
      language: "schinese",
      purchase_type: "all",
      source_status: "steam_appreviews"
    },
    early_access: {
      catalog_tag: ea ? "yes" : "no",
      store_state: ea ? "yes" : "no",
      confirmed_current: ea
    },
    decision: options.decision ?? "not_qualified",
    matched_rules: matchedRules,
    primary_lane: heat ? "china_heat_ops" : ea ? "ea_mobile_high_traction" : null,
    missing_evidence: [],
    exclusion_reasons: matchedRules.length ? [] : ["fixture_not_qualified"]
  };
}

function fakeAudit(current) {
  return async ({ rootDir, reportDate: date }) => {
    const outputPath = path.join(rootDir, `data/steam_review_opportunities/${date}.json`);
    writeFileSync(outputPath, `${JSON.stringify(current, null, 2)}\n`, { encoding: "utf8", flag: "w" });
    return { artifact: current, outputPath };
  };
}

function successfulReceipt(sourceArtifact, options = {}) {
  const date = sourceArtifact.report_date;
  const mode = options.mode ?? "scheduled";
  return {
    schema_version: 1,
    report_date: date,
    run_slot: "fixture",
    requested_mode: mode,
    mode,
    sourcing_run_type: mode === "backfill" ? "initial_backfill" : "scheduled",
    status: "success",
    scan_complete: true,
    artifact_path: `data/steam_review_opportunities/${date}.json`,
    artifact_sha256: artifactSha256(sourceArtifact),
    catalog_scan_count: 1,
    catalog_entries_seen: 1,
    qualified_count: 1,
    previously_qualified_count: 0,
    import_candidate_count: 1,
    deduplicated_count: 0,
    created_count: 1,
    updated_count: 0,
    failure_reason: null,
    run_id: "1",
    run_number: "1",
    run_url: "https://github.com/Neo0109/CRM/actions/runs/1",
    head_sha: "fixture",
    captured_at: "2026-07-16T00:00:00.000Z",
    sync_response: { synced: true, created: 1, skipped_existing: 0, updated: 0 }
  };
}

function artifactSha256(value) {
  return createHash("sha256").update(`${JSON.stringify(value, null, 2)}\n`).digest("hex");
}

function assertValidDailyReport(report) {
  const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
  const schema = JSON.parse(readFileSync(path.join(repoRoot, "schemas/daily_report.schema.json"), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(report), true, ajv.errorsText(validate.errors));
}

function assertValidSteamReceiptSchema(receipt) {
  const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
  const schema = JSON.parse(readFileSync(path.join(repoRoot, "schemas/steam_review_opportunity_run.schema.json"), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(receipt), true, ajv.errorsText(validate.errors));
}
