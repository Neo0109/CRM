import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import {
  buildSteamReviewOpportunityArtifact,
  validateSteamReviewOpportunityArtifact,
  writeSteamReviewOpportunityArtifact
} from "../jobs/steam_review_opportunity_artifact.mjs";
import { runSteamReviewOpportunityAudit } from "../jobs/steam_review_opportunity_audit.mjs";
import {
  collectSteamReviewOpportunities,
  parseSteamCatalogPage
} from "../jobs/steam_review_opportunity_source.mjs";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const fixture = JSON.parse(readFileSync(
  new URL("./fixtures/steam-review-opportunity-source.json", import.meta.url),
  "utf8"
));
const reportDate = "2026-07-16";
const generatedAt = "2026-07-16T01:00:00+08:00";

describe("Steam review opportunity audit artifact", () => {
  it("builds a deterministic schema-shaped audit with exact scan and decision counts", async () => {
    const artifact = buildSteamReviewOpportunityArtifact({
      reportDate,
      generatedAt,
      collection: await fixtureCollection()
    });

    assert.equal(artifact.schema_version, 1);
    assert.equal(artifact.source_contract, "steam-schinese-reviews-v1");
    assert.deepEqual(artifact.scan_summary, {
      scan_complete: true,
      pages_scanned: 3,
      catalog_entries_seen: 5,
      unique_apps_seen: 5,
      reported_total: 5,
      prefilter_matches: 4,
      records_total: 4,
      official_reviews_confirmed: 4,
      store_details_confirmed: 4,
      qualified: 3,
      not_qualified: 1,
      needs_evidence: 0,
      source_failures: []
    });
    assert.deepEqual(artifact.opportunities.map((item) => [
      item.steam_app_id,
      item.decision,
      item.primary_lane,
      item.steam_review_summary.total_reviews,
      item.early_access.confirmed_current
    ]), [
      ["1002", "not_qualified", null, 1000, true],
      ["1003", "qualified", "ea_mobile_high_traction", 1000, true],
      ["1004", "qualified", "china_heat_ops", 10000, false],
      ["1005", "qualified", "china_heat_ops", 20000, true]
    ]);
    assert.deepEqual(artifact.opportunities.at(-1).matched_rules, ["ea_mobile_high_traction", "china_heat_ops"]);
    assert.doesNotThrow(() => validateSteamReviewOpportunityArtifact(artifact));
  });

  it("rejects duplicate AppIDs, count drift, inconsistent raw review totals, and false complete scans", async () => {
    const artifact = buildSteamReviewOpportunityArtifact({
      reportDate,
      generatedAt,
      collection: await fixtureCollection()
    });

    const duplicate = structuredClone(artifact);
    duplicate.opportunities.push(structuredClone(duplicate.opportunities[0]));
    duplicate.scan_summary.records_total += 1;
    duplicate.scan_summary.not_qualified += 1;
    assert.throws(() => validateSteamReviewOpportunityArtifact(duplicate), /duplicate steam_app_id/);

    const countDrift = structuredClone(artifact);
    countDrift.scan_summary.qualified = 2;
    assert.throws(() => validateSteamReviewOpportunityArtifact(countDrift), /scan_summary.qualified/);

    const rawCountDrift = structuredClone(artifact);
    rawCountDrift.opportunities[1].steam_review_summary.negative_reviews = 199;
    assert.throws(() => validateSteamReviewOpportunityArtifact(rawCountDrift), /positive_reviews \+ negative_reviews/);

    const falseComplete = structuredClone(artifact);
    falseComplete.scan_summary.source_failures.push({
      stage: "reviews",
      steam_app_id: "1003",
      message: "fixture failure"
    });
    assert.throws(() => validateSteamReviewOpportunityArtifact(falseComplete), /scan_complete cannot be true/);
  });

  it("preserves unknown official review metrics as null audit evidence", async () => {
    const collection = await fixtureCollection();
    collection.summary.scanComplete = false;
    collection.summary.officialReviewsConfirmed = 3;
    collection.summary.notQualified = 0;
    collection.summary.needsEvidence = 1;
    collection.summary.sourceFailures = [{ stage: "reviews", appId: "1002", message: "fixture unavailable" }];
    collection.opportunities[0].reviewSummary = {
      status: "unknown",
      text: null,
      positiveReviews: null,
      negativeReviews: null,
      totalReviews: null,
      positiveRate: null,
      language: "schinese",
      purchaseType: "all",
      sourceStatus: "not_fetched"
    };
    collection.opportunities[0].decision = "needs_evidence";
    collection.opportunities[0].matchedRules = [];
    collection.opportunities[0].primaryLane = null;
    collection.opportunities[0].missingEvidence = ["steam_schinese_review_summary"];
    collection.opportunities[0].exclusionReasons = [];

    const artifact = buildSteamReviewOpportunityArtifact({ reportDate, generatedAt, collection });
    assert.equal(artifact.opportunities[0].steam_review_summary.positive_rate, null);
    assert.equal(artifact.opportunities[0].steam_review_summary.total_reviews, null);
    assert.doesNotThrow(() => validateSteamReviewOpportunityArtifact(artifact));
  });

  it("writes only the dedicated audit path through the private-field sanitizer", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "crm-steam-review-audit-"));
    const collection = await fixtureCollection();
    collection.opportunities[0]._private_fixture = "must not leak";

    const result = await runSteamReviewOpportunityAudit({
      rootDir,
      reportDate,
      generatedAt,
      collectImpl: async () => collection
    });
    const expectedPath = path.join(rootDir, `data/steam_review_opportunities/${reportDate}.json`);

    assert.equal(result.outputPath, expectedPath);
    assert.equal(readFileSync(expectedPath, "utf8"), `${JSON.stringify(result.artifact, null, 2)}\n`);
    assert.doesNotMatch(readFileSync(expectedPath, "utf8"), /_private_fixture/);
    assert.doesNotThrow(() => validateSteamReviewOpportunityArtifact(JSON.parse(readFileSync(expectedPath, "utf8"))));
  });

  it("validates the fixed artifact against the dedicated JSON schema and integrity contract", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "crm-steam-review-schema-"));
    const artifact = buildSteamReviewOpportunityArtifact({
      reportDate,
      generatedAt,
      collection: await fixtureCollection()
    });
    const filePath = path.join(rootDir, "fixture.json");
    await writeSteamReviewOpportunityArtifact(filePath, artifact);

    const valid = runSchemaValidator(filePath);
    assert.equal(valid.status, 0, `${valid.stdout}\n${valid.stderr}`);
    assert.match(valid.stdout, /"ok": true/);

    const invalid = structuredClone(artifact);
    invalid.opportunities[0].unexpected_sync_payload = { synced: true };
    writeFileSync(filePath, `${JSON.stringify(invalid, null, 2)}\n`, "utf8");
    const rejected = runSchemaValidator(filePath);
    assert.notEqual(rejected.status, 0);
    assert.match(`${rejected.stdout}\n${rejected.stderr}`, /additional properties|unexpected_sync_payload/i);
  });

  it("keeps the new artifact outside Daily, production workflows, import, and CRM sync paths", () => {
    for (const relativePath of [
      "automations/jobs/online_daily_v4.mjs",
      "automations/jobs/import_to_crm.ts",
      "functions/_lib/crm.ts",
      ".github/workflows/sync-daily-report.yml",
      ".github/workflows/daily-report-watchdog.yml"
    ]) {
      const source = readFileSync(path.join(repoRoot, relativePath), "utf8");
      assert.doesNotMatch(source, /steam_review_opportunit/i, relativePath);
    }

    const buildWorkflow = readFileSync(path.join(repoRoot, ".github/workflows/build.yml"), "utf8");
    assert.match(buildWorkflow, /node --test automations\/test\/steamReviewOpportunity\*\.test\.mjs/);
  });
});

async function fixtureCollection() {
  const scan = {
    summary: {
      scanComplete: true,
      pagesScanned: 3,
      catalogEntriesSeen: 5,
      uniqueAppsSeen: 5,
      reportedTotal: 5,
      sourceFailures: []
    },
    candidates: fixture.catalog_pages.flatMap((page) => parseSteamCatalogPage(page.payload, { start: page.start }).candidates)
  };

  return collectSteamReviewOpportunities({
    scanCatalogImpl: async () => scan,
    fetchReviewSummaryImpl: async (appId) => {
      const summary = fixture.review_responses[appId].query_summary;
      return {
        status: "available",
        text: summary.review_score_desc,
        positiveReviews: summary.total_positive,
        negativeReviews: summary.total_negative,
        totalReviews: summary.total_reviews,
        positiveRate: Number(((summary.total_positive / summary.total_reviews) * 100).toFixed(4)),
        language: "schinese",
        purchaseType: "all",
        sourceStatus: "steam_appreviews"
      };
    },
    fetchAppDetailsImpl: async (appId) => fixture.appdetails[appId]
  });
}

function runSchemaValidator(filePath) {
  return spawnSync(process.execPath, [
    path.join(repoRoot, "scripts/validate-steam-review-opportunities.mjs"),
    `--file=${filePath}`
  ], { cwd: repoRoot, encoding: "utf8" });
}
