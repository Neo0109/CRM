import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SOURCE_COVERAGE_CONFIG,
  buildSourceCoverage
} from "../jobs/online_daily_v4_source_coverage.mjs";

function mediaEntry(source, family, rawSignals, outcome = "ok") {
  return {
    source,
    source_id: `${family}:${source.toLowerCase().replace(/\s+/g, "-")}`,
    family,
    attempts: 1,
    successes: outcome === "ok" ? 1 : 0,
    failures: outcome === "ok" ? 0 : 1,
    raw_signals: rawSignals,
    outcome_counts: { [outcome]: 1 },
    last_outcome: outcome
  };
}

function diagnostics({ steamSources = 3, steamSignals = 150, biliSources = 5, biliSignals = 20, domesticSources = 5, domesticSignals = 50, globalSources = 5 } = {}) {
  return {
    steam_source_health: Object.fromEntries(Array.from({ length: steamSources }, (_, index) => [
      `Steam ${index}`,
      mediaEntry(`Steam ${index}`, "steam", Math.ceil(steamSignals / Math.max(steamSources, 1)))
    ])),
    bilibili_probe: {
      final_candidates: biliSignals,
      source_health: Object.fromEntries(Array.from({ length: biliSources }, (_, index) => [
        `keyword:test-${index}`,
        { attempts: 1, successes: 1, failures: 0, candidates: 4, outcome_counts: { ok: 1 }, last_outcome: "ok" }
      ]))
    },
    media_source_health: Object.fromEntries([
      ...Array.from({ length: domesticSources }, (_, index) => [
        `Domestic ${index}`,
        mediaEntry(`Domestic ${index}`, "domestic_media", Math.ceil(domesticSignals / Math.max(domesticSources, 1)))
      ]),
      ...Array.from({ length: globalSources }, (_, index) => [
        `Global ${index}`,
        mediaEntry(`Global ${index}`, "global_media", 5)
      ])
    ]),
    source_incidents: []
  };
}

describe("source coverage operational contract", () => {
  it("uses fixed thresholds and emits schema-v1 healthy coverage", () => {
    const coverage = buildSourceCoverage({
      diagnostics: diagnostics(),
      rawSteamCandidateCount: 150,
      config: DEFAULT_SOURCE_COVERAGE_CONFIG
    });

    assert.equal(coverage.schema_version, 1);
    assert.equal(coverage.mode, "observe");
    assert.equal(coverage.status, "healthy");
    assert.equal(coverage.core_usable_count, 3);
    assert.deepEqual(Object.fromEntries(Object.entries(coverage.families).map(([key, value]) => [key, value.status])), {
      steam: "healthy",
      bilibili: "healthy",
      domestic_media: "healthy",
      global_media: "healthy"
    });
    assert.equal(coverage.recovery_suppressed_until, null);
  });

  it("continues in degraded state when one core lifeline is unavailable", () => {
    const coverage = buildSourceCoverage({
      diagnostics: diagnostics({ steamSources: 0, steamSignals: 0 }),
      rawSteamCandidateCount: 0,
      config: DEFAULT_SOURCE_COVERAGE_CONFIG
    });

    assert.equal(coverage.status, "degraded");
    assert.equal(coverage.core_usable_count, 2);
    assert.equal(coverage.families.steam.status, "unavailable");
  });

  it("calculates blocked when fewer than two core lifelines remain usable", () => {
    const coverage = buildSourceCoverage({
      diagnostics: diagnostics({ steamSources: 0, steamSignals: 0, biliSources: 1, biliSignals: 2 }),
      rawSteamCandidateCount: 0,
      config: DEFAULT_SOURCE_COVERAGE_CONFIG
    });

    assert.equal(coverage.status, "blocked");
    assert.equal(coverage.core_usable_count, 1);
    assert.equal(coverage.mode, "observe");
  });

  it("does not use formal Lead count when deciding source health", () => {
    const zeroLeadDiagnostics = diagnostics();
    zeroLeadDiagnostics.formal_lead_count = 0;
    const coverage = buildSourceCoverage({
      diagnostics: zeroLeadDiagnostics,
      rawSteamCandidateCount: 150,
      config: DEFAULT_SOURCE_COVERAGE_CONFIG
    });

    assert.equal(coverage.status, "healthy");
  });

  it("sanitizes and bounds incidents without response bodies, headers, contacts, or Ray IDs", () => {
    const value = diagnostics();
    value.source_incidents = Array.from({ length: 60 }, (_, index) => ({
      source_id: `media:test-${index}`,
      family: "domestic_media",
      outcome: "challenge",
      http_status: 200,
      provider: "cloudflare",
      fallback_used: false,
      response_body: "secret",
      headers: { cookie: "secret" },
      ray_id: "secret"
    }));
    const coverage = buildSourceCoverage({ diagnostics: value, rawSteamCandidateCount: 150 });

    assert.equal(coverage.incidents.length, 50);
    assert.deepEqual(Object.keys(coverage.incidents[0]).sort(), [
      "fallback_used",
      "family",
      "http_status",
      "outcome",
      "provider",
      "source_id"
    ]);
    value.source_incidents = [{
      source_id: "media:null-status",
      family: "domestic_media",
      outcome: "network_error",
      http_status: null,
      provider: null,
      fallback_used: false
    }];
    assert.equal(buildSourceCoverage({ diagnostics: value, rawSteamCandidateCount: 150 }).incidents[0].http_status, null);
  });
});
