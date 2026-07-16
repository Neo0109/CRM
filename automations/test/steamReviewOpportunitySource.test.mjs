import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  collectSteamReviewOpportunities,
  evaluateSteamReviewOpportunity,
  fetchSteamReviewSummary,
  officialStoreEarlyAccess,
  parseSteamCatalogPage,
  prefilterSteamReviewCandidates,
  scanSteamPcCatalog
} from "../jobs/steam_review_opportunity_source.mjs";

const fixture = JSON.parse(readFileSync(
  new URL("./fixtures/steam-review-opportunity-source.json", import.meta.url),
  "utf8"
));

describe("Steam simplified-Chinese review opportunity source", () => {
  it("parses localized catalog review counts and the Steam Early Access tag", () => {
    const page = fixture.catalog_pages[0];
    const parsed = parseSteamCatalogPage(page.payload, { start: page.start });

    assert.equal(parsed.totalCount, 5);
    assert.deepEqual(parsed.candidates.map((candidate) => ({
      appId: candidate.appId,
      totalReviews: candidate.catalogReviewSummary.totalReviews,
      earlyAccessTag: candidate.earlyAccessTag
    })), [
      { appId: "1001", totalReviews: 999, earlyAccessTag: true },
      { appId: "1002", totalReviews: 1000, earlyAccessTag: true }
    ]);
  });

  it("pages the public Steam PC catalog to completion with fixed responses", async () => {
    const starts = [];
    const scan = await scanSteamPcCatalog({
      pageSize: 2,
      fetchTextImpl: async (url) => {
        const start = Number(new URL(url).searchParams.get("start"));
        starts.push(start);
        const page = fixture.catalog_pages.find((item) => item.start === start);
        assert.ok(page, `unexpected catalog start ${start}`);
        return JSON.stringify(page.payload);
      }
    });

    assert.deepEqual(starts, [0, 2, 4]);
    assert.equal(scan.summary.scanComplete, true);
    assert.equal(scan.summary.pagesScanned, 3);
    assert.equal(scan.summary.catalogEntriesSeen, 5);
    assert.equal(scan.summary.uniqueAppsSeen, 5);
    assert.deepEqual(scan.candidates.map((candidate) => candidate.appId), ["1001", "1002", "1003", "1004", "1005"]);
  });

  it("paces catalog pages and retries a 429 after the server cooldown", async () => {
    const attempts = [];
    const sleeps = [];
    let firstAttempt = true;
    const scan = await scanSteamPcCatalog({
      pageSize: 2,
      requestDelayMs: 100,
      retryBaseDelayMs: 50,
      retryJitterRatio: 0,
      fetchTextImpl: async (url) => {
        const start = Number(new URL(url).searchParams.get("start"));
        attempts.push(start);
        if (firstAttempt) {
          firstAttempt = false;
          const error = new Error("429 Too Many Requests");
          error.status = 429;
          error.retryAfterMs = 700;
          throw error;
        }
        const page = fixture.catalog_pages.find((item) => item.start === start);
        assert.ok(page, `unexpected catalog start ${start}`);
        return JSON.stringify(page.payload);
      },
      sleepImpl: async (milliseconds) => {
        sleeps.push(milliseconds);
      }
    });

    assert.equal(scan.summary.scanComplete, true);
    assert.deepEqual(attempts, [0, 0, 2, 4]);
    assert.ok(sleeps.includes(700), `expected Retry-After wait, got ${sleeps.join(",")}`);
    assert.ok(sleeps.filter((value) => value === 100).length >= 2);
  });

  it("uses the localized catalog summary only to prefilter official lookups", () => {
    const candidates = fixture.catalog_pages.flatMap((page) => parseSteamCatalogPage(page.payload, { start: page.start }).candidates);
    const prefiltered = prefilterSteamReviewCandidates(candidates);

    assert.deepEqual(prefiltered.map((candidate) => candidate.appId), ["1002", "1003", "1004", "1005"]);
    assert.equal(prefiltered.some((candidate) => candidate.appId === "1001"), false);
  });

  it("requests the official schinese all-purchase summary and derives rate from raw counts", async () => {
    let requestedUrl;
    const summary = await fetchSteamReviewSummary("1003", {
      fetchJsonImpl: async (url) => {
        requestedUrl = new URL(url);
        return fixture.review_responses["1003"];
      }
    });

    assert.equal(requestedUrl.pathname, "/appreviews/1003");
    assert.equal(requestedUrl.searchParams.get("json"), "1");
    assert.equal(requestedUrl.searchParams.get("filter"), "all");
    assert.equal(requestedUrl.searchParams.get("language"), "schinese");
    assert.equal(requestedUrl.searchParams.get("purchase_type"), "all");
    assert.equal(requestedUrl.searchParams.get("review_type"), "all");
    assert.equal(summary.positiveReviews, 800);
    assert.equal(summary.negativeReviews, 200);
    assert.equal(summary.totalReviews, 1000);
    assert.equal(summary.positiveRate, 80);
  });

  it("honors Retry-After before bounded exponential retry with deterministic jitter", async () => {
    const sleeps = [];
    let calls = 0;
    const summary = await fetchSteamReviewSummary("1003", {
      requestDelayMs: 0,
      retryBaseDelayMs: 100,
      retryMaxDelayMs: 1000,
      retryJitterRatio: 0,
      sleepImpl: async (milliseconds) => {
        sleeps.push(milliseconds);
      },
      fetchJsonImpl: async () => {
        calls += 1;
        if (calls <= 2) {
          const error = new Error("429 Too Many Requests");
          error.status = 429;
          if (calls === 1) error.retryAfterMs = 500;
          throw error;
        }
        return fixture.review_responses["1003"];
      }
    });

    assert.equal(summary.status, "available");
    assert.equal(calls, 3);
    assert.deepEqual(sleeps, [500, 200]);
  });

  it("retries transient AppDetails logical payloads before declaring a source failure", async () => {
    const appId = "1003";
    const candidate = fixture.catalog_pages
      .flatMap((page) => parseSteamCatalogPage(page.payload, { start: page.start }).candidates)
      .find((item) => item.appId === appId);
    let appDetailsCalls = 0;
    const sleeps = [];
    const result = await collectSteamReviewOpportunities({
      scanCatalogImpl: async () => ({
        summary: {
          scanComplete: true,
          pagesScanned: 1,
          catalogEntriesSeen: 1,
          uniqueAppsSeen: 1,
          reportedTotal: 1,
          sourceFailures: []
        },
        candidates: [candidate]
      }),
      fetchReviewSummaryImpl: async () => ({
        status: "available",
        text: "Very Positive",
        positiveReviews: 800,
        negativeReviews: 200,
        totalReviews: 1000,
        positiveRate: 80,
        language: "schinese",
        purchaseType: "all",
        sourceStatus: "steam_appreviews"
      }),
      fetchJsonImpl: async (url) => {
        assert.match(url, /api\/appdetails/);
        appDetailsCalls += 1;
        if (appDetailsCalls === 1) return { [appId]: { success: false } };
        return { [appId]: { success: true, data: fixture.appdetails[appId] } };
      },
      requestDelayMs: 0,
      retryBaseDelayMs: 100,
      retryJitterRatio: 0,
      sleepImpl: async (milliseconds) => {
        sleeps.push(milliseconds);
      },
      logger: { warn() {} }
    });

    assert.equal(appDetailsCalls, 2);
    assert.deepEqual(sleeps, [100]);
    assert.equal(result.summary.scanComplete, true);
    assert.deepEqual(result.summary.sourceFailures, []);
    assert.equal(result.opportunities[0].earlyAccess.storeState, "yes");
  });

  it("requires both the catalog tag and official store metadata for current EA", () => {
    assert.equal(officialStoreEarlyAccess(fixture.appdetails["1003"]), true);
    assert.equal(officialStoreEarlyAccess(fixture.appdetails["1004"]), false);

    const reviewSummary = { status: "available", totalReviews: 1000, positiveRate: 80 };
    assert.deepEqual(evaluateSteamReviewOpportunity({
      reviewSummary,
      catalogEarlyAccess: true,
      storeEarlyAccess: false
    }).matchedRules, []);
    assert.deepEqual(evaluateSteamReviewOpportunity({
      reviewSummary,
      catalogEarlyAccess: false,
      storeEarlyAccess: true
    }).matchedRules, []);
  });

  it("implements every locked threshold boundary without truncation", () => {
    for (const testCase of fixture.threshold_cases) {
      const result = evaluateSteamReviewOpportunity({
        reviewSummary: {
          status: testCase.review_summary.status,
          totalReviews: testCase.review_summary.total_reviews,
          positiveRate: testCase.review_summary.positive_rate
        },
        catalogEarlyAccess: testCase.catalog_early_access,
        storeEarlyAccess: testCase.store_early_access
      });
      assert.deepEqual(result.matchedRules, testCase.expected_rules, testCase.name);
      assert.equal(result.primaryLane, testCase.expected_primary_lane, testCase.name);
    }
  });

  it("uses raw review counts instead of a rounded display rate at the 80 percent edge", () => {
    const result = evaluateSteamReviewOpportunity({
      reviewSummary: {
        status: "available",
        positiveReviews: 8000000,
        negativeReviews: 2000001,
        totalReviews: 10000001,
        positiveRate: 80
      },
      catalogEarlyAccess: true,
      storeEarlyAccess: true
    });

    assert.deepEqual(result.matchedRules, ["china_heat_ops"]);
    assert.equal(result.primaryLane, "china_heat_ops");
  });

  it("confirms every prefilter hit through official fixtures and never calls the 999-review miss", async () => {
    const reviewCalls = [];
    const detailsCalls = [];
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

    const result = await collectSteamReviewOpportunities({
      scanCatalogImpl: async () => scan,
      fetchReviewSummaryImpl: async (appId) => {
        reviewCalls.push(appId);
        const payload = fixture.review_responses[appId];
        return {
          status: "available",
          text: payload.query_summary.review_score_desc,
          positiveReviews: payload.query_summary.total_positive,
          negativeReviews: payload.query_summary.total_negative,
          totalReviews: payload.query_summary.total_reviews,
          positiveRate: Number(((payload.query_summary.total_positive / payload.query_summary.total_reviews) * 100).toFixed(4)),
          language: "schinese",
          purchaseType: "all",
          sourceStatus: "steam_appreviews"
        };
      },
      fetchAppDetailsImpl: async (appId) => {
        detailsCalls.push(appId);
        return fixture.appdetails[appId];
      }
    });

    assert.deepEqual(reviewCalls, ["1002", "1003", "1004", "1005"]);
    assert.deepEqual(detailsCalls, ["1002", "1003", "1005"]);
    assert.equal(result.summary.prefilterMatches, 4);
    assert.equal(result.summary.officialReviewsConfirmed, 4);
    assert.equal(result.summary.qualified, 3);
    assert.equal(result.summary.notQualified, 1);
    assert.equal(result.summary.needsEvidence, 0);
    assert.deepEqual(result.opportunities.map((item) => [item.appId, item.primaryLane]), [
      ["1002", null],
      ["1003", "ea_mobile_high_traction"],
      ["1004", "china_heat_ops"],
      ["1005", "china_heat_ops"]
    ]);
    assert.deepEqual(result.opportunities.at(-1).matchedRules, ["ea_mobile_high_traction", "china_heat_ops"]);
  });
});
