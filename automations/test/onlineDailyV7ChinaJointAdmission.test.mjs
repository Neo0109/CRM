import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildSourcingCandidateArtifact } from "../jobs/online_daily_v4_candidate_audit.mjs";
import { buildPools } from "../jobs/online_daily_v4_decision.mjs";
import {
  CHINA_JOINT_GATE_IDS,
  evaluateChinaJointAdmission,
  evaluateMediaChinaJointAdmission,
  evaluateSteamChinaJointAdmission
} from "../jobs/online_daily_v7_2_china_joint_admission.mjs";
import { REGULAR_SOURCING_RULE_VERSION } from "../jobs/online_daily_v7_2_regular_admission.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/v7-2-china-joint-admission.json", import.meta.url), "utf8"));
const indieFixture = JSON.parse(readFileSync(new URL("./fixtures/v7-indie-admission.json", import.meta.url), "utf8"));
const reportDate = fixture.report_date;
const capturedAt = `${reportDate}T08:00:00+08:00`;

describe("V7.2 china_joint admission", () => {
  it("implements the three locked data paths at their exact boundaries", () => {
    assert.deepEqual(CHINA_JOINT_GATE_IDS, [
      "identity_and_dedupe",
      "traction_or_proven_team_event",
      "current_china_opportunity",
      "mature_china_partner_clear"
    ]);

    for (const boundary of fixture.traction_boundaries) {
      const result = evaluateChinaJointAdmission({
        ...fixture.china_joint_base,
        ...boundary.patch
      });
      assert.equal(result.qualified, boundary.qualified, boundary.name);
      assert.equal(result.sourcing_lane, "china_joint", boundary.name);
      assert.equal(result.sourcing_rule_version, REGULAR_SOURCING_RULE_VERSION, boundary.name);
      assert.equal(
        result.failed_gates.includes("traction_or_proven_team_event"),
        !boundary.qualified,
        boundary.name
      );
    }
  });

  it("requires a current China opportunity and excludes mature China-partner occupancy", () => {
    for (const excluded of fixture.excluded_projects) {
      const result = evaluateChinaJointAdmission({
        ...fixture.china_joint_base,
        ...excluded,
        dedupe_key: `steam:${excluded.steam_app_id}`
      });
      assert.equal(result.qualified, false, excluded.project);
      assert.equal(result.disposition, "excluded", excluded.project);
      assert.ok(result.failed_gates.includes(excluded.expected_gate), excluded.project);
    }
  });

  it("maps Steam rating text, current China demand, product events, and China partner occupancy into auditable evidence", () => {
    const qualified = evaluateSteamChinaJointAdmission(jointSteamCandidate({
      ...fixture.china_joint_base,
      recommendation_count: 1500,
      review_rating: "very_positive"
    }, {
      reviewText: "Very Positive (1,500)",
      recommendationCount: 1500,
      chinaDemandEvidence: "The developer is currently seeking a China publishing partner.",
      chinaPartnerOccupied: false,
      _chinaJointAdmissionEvidence: undefined
    }));
    assert.equal(qualified.qualified, true);
    assert.equal(qualified.evidence.review_rating, "very_positive");
    assert.equal(qualified.evidence.china_opportunities.length, 1);

    const occupied = evaluateSteamChinaJointAdmission(jointSteamCandidate(fixture.china_joint_base, {
      publishers: ["Tencent Games"],
      chinaPartnerOccupied: true,
      _chinaJointAdmissionEvidence: undefined
    }));
    assert.equal(occupied.qualified, false);
    assert.ok(occupied.failed_gates.includes("mature_china_partner_clear"));
  });

  it("maps a current official media product event into the same joint-publishing decision", () => {
    const result = evaluateMediaChinaJointAdmission({
      project: "Official Media Joint",
      steam_app_id: "9740001",
      china_partner_occupied: false,
      _officialSourceMatched: true,
      _mediaItem: {
        title: "Official Media Joint seeks a China publishing partner",
        summary: "The developer is currently seeking China localization and marketing cooperation.",
        link: "https://official-media-joint.example/current-event"
      },
      _steamEntityResolution: {
        details: {
          recommendations: { total: 5000 },
          publishers: []
        }
      }
    });

    assert.equal(result.qualified, true);
    assert.equal(result.sourcing_lane, "china_joint");
    assert.ok(result.evidence.current_official_product_events.length > 0);
    assert.ok(result.evidence.china_opportunities.length > 0);
  });

  it("publishes the fixed same-day 5 indie plus 4 joint fixture as all 9 formal Leads", () => {
    assert.equal(fixture.same_day.indie_projects.length, 5);
    assert.equal(fixture.same_day.china_joint_projects.length, 4);

    const indieCandidates = fixture.same_day.indie_projects.map((project, index) => indieSteamCandidate(project, {
      score: 1000 - index
    }));
    const jointCandidates = fixture.same_day.china_joint_projects.map((project, index) => jointSteamCandidate({
      ...fixture.china_joint_base,
      ...project,
      dedupe_key: `steam:${project.steam_app_id}`,
      verified_major_title_records: project.verified_major_title_records ?? [],
      current_official_product_events: project.current_official_product_events ?? []
    }, {
      score: -1000 - index
    }));
    const allCandidates = [...indieCandidates, ...jointCandidates];
    const pools = buildPools(allCandidates, [], { reportDate });

    assert.equal(pools.push.length, 9);
    assert.equal(pools.new_qualified_count, 9);
    assert.equal(pools.new_qualified_count, pools.push.length);
    assert.deepEqual(pools.watch, []);
    assert.deepEqual(pools.drop, []);
    assert.deepEqual(countByLane(pools.push), { indie_prelaunch: 5, china_joint: 4 });
    assert.ok(pools.push.every((lead) => lead.priority === null));
    assert.ok(pools.push.every((lead) => lead.sourcing_rule_version === REGULAR_SOURCING_RULE_VERSION));
    assert.deepEqual(
      new Set(pools.push.map((lead) => lead.steam_app_id)),
      new Set(allCandidates.map((candidate) => candidate.appId)),
      "ranking and low scores may change reading order but cannot truncate qualified projects"
    );
  });

  it("keeps no-demand and occupied-partner projects out of the formal pool and records their exclusions", () => {
    const excluded = fixture.excluded_projects.map((project) => jointSteamCandidate({
      ...fixture.china_joint_base,
      ...project,
      dedupe_key: `steam:${project.steam_app_id}`
    }));
    const pools = buildPools(excluded, [], { reportDate });
    const artifact = buildSourcingCandidateArtifact({
      reportDate,
      capturedAt,
      ruleVersion: REGULAR_SOURCING_RULE_VERSION,
      rawSteamCandidates: excluded,
      enrichedSteamCandidates: excluded,
      candidatePools: pools,
      publishedPools: pools
    });

    assert.equal(pools.push.length, 0);
    assert.equal(artifact.scan_summary.formal, 0);
    assert.equal(artifact.scan_summary.excluded, 2);
    assert.equal(artifact.scan_summary.new_qualified_count, 0);
    assert.equal(artifact.scan_summary.push_pool_count, 0);
    for (const project of fixture.excluded_projects) {
      const candidate = artifact.candidates.find((item) => item.steam_app_id === project.steam_app_id);
      assert.equal(candidate.decision, "excluded", project.project);
      assert.equal(candidate.sourcing_lane, "china_joint", project.project);
      assert.ok(candidate.exclusion_reasons.length > 0, project.project);
    }
  });
});

function indieSteamCandidate(project, overrides = {}) {
  const evidence = {
    ...indieFixture.qualified_base,
    ...project,
    dedupe_key: `steam:${project.steam_app_id}`
  };
  return baseSteamCandidate(project, {
    _indieAdmissionEvidence: evidence,
    recommendationCount: 1200,
    reviewText: "Positive",
    alreadyReleased: false,
    comingSoon: true,
    daysToRelease: 169,
    releaseTooSoon: false,
    hasDemoSignal: true,
    ...overrides
  });
}

function jointSteamCandidate(evidence, overrides = {}) {
  const project = {
    project: evidence.project,
    steam_app_id: evidence.steam_app_id
  };
  return baseSteamCandidate(project, {
    _indieAdmissionEvidence: {
      ...indieFixture.qualified_base,
      project: evidence.project,
      steam_app_id: evidence.steam_app_id,
      dedupe_key: `steam:${evidence.steam_app_id}`,
      release_state: "released",
      release_window: "too_soon",
      official_demo_evidence: []
    },
    _chinaJointAdmissionEvidence: evidence,
    recommendationCount: evidence.recommendation_count,
    reviewText: ratingText(evidence.review_rating),
    alreadyReleased: true,
    comingSoon: false,
    daysToRelease: -30,
    releaseTooSoon: false,
    hasDemoSignal: false,
    ...overrides
  });
}

function baseSteamCandidate(project, overrides = {}) {
  return {
    appId: project.steam_app_id,
    title: project.project,
    source: "Steam current product event fixture",
    score: 0,
    genres: ["Strategy", "Simulation"],
    categories: ["Single-player"],
    developers: ["Fixture Studio"],
    publishers: [],
    country: "海外",
    region: "海外",
    releaseDate: "2026-06-01",
    earlyAccess: false,
    publisherOccupied: false,
    chinaPartnerOccupied: false,
    narrativeHeavy: false,
    indiaTeam: false,
    strongGameplay: true,
    highVisual: true,
    strongData: true,
    validatedPcHit: true,
    mobileAdaptationPotential: true,
    hasDetails: true,
    contactMethods: [{ type: "Email", value: "bd@fixture-studio.example" }],
    storeUrl: `https://store.steampowered.com/app/${project.steam_app_id}/`,
    steamDbUrl: `https://steamdb.info/app/${project.steam_app_id}/`,
    website: "https://fixture-studio.example",
    shortDescription: "A systems-heavy strategy game.",
    screenshotCount: 6,
    movieCount: 1,
    chinaDemandEvidence: "The developer is currently seeking a China publishing partner.",
    ...overrides
  };
}

function ratingText(value) {
  if (value === "very_positive") return "Very Positive";
  if (value === "overwhelmingly_positive") return "Overwhelmingly Positive";
  if (value === "mixed") return "Mixed";
  if (value === "positive") return "Positive";
  return "";
}

function countByLane(leads) {
  return leads.reduce((counts, lead) => {
    counts[lead.sourcing_lane] = (counts[lead.sourcing_lane] ?? 0) + 1;
    return counts;
  }, {});
}
