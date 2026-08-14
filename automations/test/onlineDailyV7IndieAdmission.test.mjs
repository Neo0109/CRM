import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildSourcingCandidateArtifact } from "../jobs/online_daily_v4_candidate_audit.mjs";
import { buildPools } from "../jobs/online_daily_v4_decision.mjs";
import {
  evaluateIndiePrelaunchAdmission,
  evaluateMediaIndiePrelaunchAdmission,
  INDIE_PRELAUNCH_GATE_IDS,
  INDIE_PRELAUNCH_RULE_VERSION
} from "../jobs/online_daily_v7_indie_admission.mjs";
import { REGULAR_SOURCING_RULE_VERSION } from "../jobs/online_daily_v7_2_regular_admission.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/v7-indie-admission.json", import.meta.url), "utf8"));
const reportDate = "2026-07-16";
const capturedAt = "2026-07-16T08:00:00+08:00";

describe("V7.0 indie_prelaunch admission", () => {
  it("requires every non-compensating gate even when the discovery score is maximal", () => {
    const base = { ...fixture.qualified_base, discovery_score: 9999 };
    const qualified = evaluateIndiePrelaunchAdmission(base);

    assert.equal(qualified.qualified, true);
    assert.equal(qualified.disposition, "formal");
    assert.equal(qualified.sourcing_lane, "indie_prelaunch");
    assert.equal(qualified.sourcing_rule_version, INDIE_PRELAUNCH_RULE_VERSION);
    assert.deepEqual(INDIE_PRELAUNCH_GATE_IDS, fixture.gate_failures.map((item) => item.gate_id));

    for (const failure of fixture.gate_failures) {
      const result = evaluateIndiePrelaunchAdmission({ ...base, ...failure.patch });
      assert.equal(result.qualified, false, `${failure.gate_id} must not be bypassed by score`);
      assert.equal(result.disposition, failure.expected_disposition, failure.gate_id);
      assert.ok(result.failed_gates.includes(failure.gate_id), failure.gate_id);
    }
  });

  it("does not let official assets, source relevance, tags, or contact completeness replace independent quality proof", () => {
    const result = evaluateIndiePrelaunchAdmission({
      ...fixture.qualified_base,
      discovery_score: 10000,
      source_relevance: "highest",
      screenshot_count: 40,
      movie_count: 8,
      tags: ["Strategy", "Simulation", "Co-op"],
      quality_proofs: []
    });

    assert.equal(result.qualified, false);
    assert.equal(result.disposition, "candidate");
    assert.deepEqual(result.failed_gates, ["independent_quality_proof"]);
  });

  for (const expectedCount of fixture.qualified_counts) {
    it(`publishes exactly ${expectedCount} of ${expectedCount} qualified projects without truncation or backfill`, () => {
      const candidates = Array.from({ length: expectedCount }, (_, index) => steamCandidate({
        ...fixture.qualified_base,
        project: `Qualified ${index}`,
        steam_app_id: String(9100000 + index),
        dedupe_key: `steam:${9100000 + index}`
      }, { score: -9999 }));
      const pools = buildPools(candidates, [], { reportDate });

      assert.equal(pools.new_qualified_count, expectedCount);
      assert.equal(pools.push.length, expectedCount);
      assert.equal(pools.new_qualified_count, pools.push.length);
      assert.deepEqual(pools.watch, []);
      assert.deepEqual(pools.drop, []);
      assert.ok(pools.push.every((lead) => lead.priority === null));
      assert.ok(pools.push.every((lead) => lead.sourcing_lane === "indie_prelaunch"));
      assert.ok(pools.push.every((lead) => lead.sourcing_rule_version === REGULAR_SOURCING_RULE_VERSION));
      assert.ok(pools.push.every((lead) => lead.sourcing_run_type === "scheduled"));
    });
  }

  it("dedupes qualified Steam and media evidence once, with ranking affecting order only", () => {
    const evidence = {
      ...fixture.qualified_base,
      project: "Cross Source Qualified",
      steam_app_id: "9200001",
      dedupe_key: "steam:9200001"
    };
    const steam = steamCandidate(evidence, { score: -1000 });
    const media = mediaLead(evidence, { media_score: 1000 });
    const pools = buildPools([steam], [media], { reportDate });

    assert.equal(pools.new_qualified_count, 1);
    assert.equal(pools.push.length, 1);
    assert.equal(pools.push[0].steam_app_id, "9200001");
  });

  it("applies the same gate contract to an actually enriched official media candidate", () => {
    const result = evaluateIndiePrelaunchAdmissionFromMediaFixture();

    assert.equal(result.qualified, true);
    assert.deepEqual(result.failed_gates, []);
    assert.ok(result.evidence.official_demo_evidence.length > 0);
    assert.ok(result.evidence.official_gameplay_evidence.length > 0);
    assert.ok(result.evidence.quality_proofs.length > 0);
  });

  it("keeps all seven historical weak Steam samples out of formal Leads", () => {
    assert.equal(fixture.historical_weak_samples.length, 7);
    for (const sample of fixture.historical_weak_samples) {
      const evidence = {
        ...fixture.qualified_base,
        project: sample.project,
        steam_app_id: sample.steam_app_id,
        dedupe_key: `steam:${sample.steam_app_id}`,
        quality_proofs: []
      };
      const result = evaluateIndiePrelaunchAdmission(evidence);
      assert.equal(result.qualified, false, sample.project);
      assert.equal(result.disposition, "candidate", sample.project);
      assert.ok(result.failed_gates.includes("independent_quality_proof"), sample.project);
    }
  });

  it("keeps hard failures in audit while recording strict/review publication parity", () => {
    const qualifiedEvidence = {
      ...fixture.qualified_base,
      project: "Formal Fixture",
      steam_app_id: "9300001",
      dedupe_key: "steam:9300001"
    };
    const weakEvidence = {
      ...fixture.qualified_base,
      project: "Candidate Fixture",
      steam_app_id: "9300002",
      dedupe_key: "steam:9300002",
      quality_proofs: []
    };
    const excludedEvidence = {
      ...fixture.qualified_base,
      project: "Released Fixture",
      steam_app_id: "9300003",
      dedupe_key: "steam:9300003",
      release_state: "released"
    };
    const enriched = [steamCandidate(qualifiedEvidence), steamCandidate(weakEvidence), steamCandidate(excludedEvidence)];
    const pools = buildPools(enriched, [], { reportDate });
    const artifact = buildSourcingCandidateArtifact({
      reportDate,
      capturedAt,
      ruleVersion: REGULAR_SOURCING_RULE_VERSION,
      rawSteamCandidates: enriched,
      enrichedSteamCandidates: enriched,
      candidatePools: pools,
      publishedPools: pools
    });

    assert.equal(pools.push.length, 2);
    assert.deepEqual(pools.watch, []);
    assert.deepEqual(pools.drop, []);
    assert.equal(artifact.scan_summary.new_qualified_count, 2);
    assert.equal(artifact.scan_summary.push_pool_count, 2);
    assert.equal(artifact.scan_summary.strict_formal_count, 1);
    assert.equal(artifact.scan_summary.near_pass_review_count, 1);
    assert.equal(artifact.scan_summary.new_qualified_count, artifact.scan_summary.push_pool_count);
    assert.equal(artifact.scan_summary.formal, 2);
    assert.equal(artifact.scan_summary.candidate, 0);
    assert.equal(artifact.scan_summary.excluded, 1);
    assert.equal(artifact.candidates.find((item) => item.steam_app_id === "9300001").decision, "formal");
    assert.equal(artifact.candidates.find((item) => item.steam_app_id === "9300001").publication_tier, "strict_formal");
    assert.equal(artifact.candidates.find((item) => item.steam_app_id === "9300002").decision, "formal");
    assert.equal(artifact.candidates.find((item) => item.steam_app_id === "9300002").publication_tier, "near_pass_review");
    assert.ok(artifact.candidates.find((item) => item.steam_app_id === "9300002").missing_evidence.includes("independent_quality_proof"));
    assert.equal(artifact.candidates.find((item) => item.steam_app_id === "9300003").decision, "excluded");
    assert.equal(artifact.candidates.find((item) => item.steam_app_id === "9300003").publication_tier, null);
  });
});

function steamCandidate(evidence, overrides = {}) {
  return {
    appId: evidence.steam_app_id,
    title: evidence.project,
    source: "Steam discovery fixture",
    score: 0,
    genres: ["Strategy", "Simulation"],
    categories: ["Single-player"],
    developers: ["Fixture Studio"],
    publishers: [],
    country: evidence.region === "overseas" ? "海外" : "中国（待确认）",
    region: evidence.region === "overseas" ? "海外" : "中国",
    releaseDate: "2027-01-01",
    daysToRelease: 169,
    alreadyReleased: false,
    releaseTooSoon: false,
    comingSoon: true,
    earlyAccess: false,
    publisherOccupied: false,
    narrativeHeavy: false,
    indiaTeam: false,
    strongGameplay: true,
    highVisual: true,
    strongData: evidence.quality_proofs.length > 0,
    hasDemoSignal: true,
    hasDetails: true,
    contactMethods: evidence.business_entrypoints,
    storeUrl: `https://store.steampowered.com/app/${evidence.steam_app_id}/`,
    steamDbUrl: `https://steamdb.info/app/${evidence.steam_app_id}/`,
    website: "https://qualified-indie.example",
    shortDescription: "A systems-heavy strategy simulation.",
    recommendationCount: evidence.quality_proofs.length ? 1200 : 0,
    screenshotCount: 6,
    movieCount: 1,
    _indieAdmissionEvidence: evidence,
    ...overrides
  };
}

function mediaLead(evidence, overrides = {}) {
  return {
    _class: "push",
    _indieAdmissionEvidence: evidence,
    project: evidence.project,
    steam_app_id: evidence.steam_app_id,
    bucket: "未处理",
    stage: "new",
    priority: "P1",
    contact_methods: evidence.business_entrypoints,
    links: [`https://store.steampowered.com/app/${evidence.steam_app_id}/`, "https://qualified-indie.example"],
    gameplay: "Strategy / Simulation",
    progress: "Demo 可玩、正式版未发售",
    public_signals: "B站官方源 / https://www.bilibili.com/video/BVqualified",
    ...overrides
  };
}

function evaluateIndiePrelaunchAdmissionFromMediaFixture() {
  const lead = {
    project: "Official Media Qualified",
    steam_app_id: "9250001",
    region: "中国",
    country: "中国（媒体/B站信号待确认）",
    progress: "Demo 可玩、正式版未发售",
    gameplay: "Strategy / Simulation",
    first_seen: reportDate,
    release_window: null,
    _class: "push",
    _officialSourceMatched: true,
    _mediaItem: {
      title: "Official Media Qualified 官方实机 Gameplay",
      summary: "开发者官方账号发布 Demo 实机演示",
      link: "https://www.bilibili.com/video/BVofficialqualified"
    },
    _steamEntityResolution: {
      canonical_app_id: "9250001",
      relation: "self",
      demo_available: true,
      demo_only: false,
      details: {
        name: "Official Media Qualified",
        type: "game",
        developers: ["Official Studio"],
        publishers: [],
        release_date: { coming_soon: true, date: "Coming soon" },
        short_description: "A strategy simulation game.",
        genres: [{ description: "Strategy" }],
        categories: [{ description: "Single-player" }],
        demos: [{ appid: 9250002 }],
        movies: [{ name: "Official Gameplay Trailer" }],
        recommendations: { total: 800 }
      }
    },
    contact_methods: [{ type: "Email", value: "bd@official-media.example" }]
  };
  return evaluateMediaIndiePrelaunchAdmission(lead);
}
