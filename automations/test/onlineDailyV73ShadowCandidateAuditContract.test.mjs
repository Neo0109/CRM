import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildSourcingCandidateArtifact } from "../jobs/online_daily_v7_3_shadow_candidate_audit.mjs";
import { buildPools } from "../jobs/online_daily_v7_3_shadow_decision.mjs";
import { V73_OBTAINABLE_EVIDENCE_RULE_VERSION } from "../jobs/online_daily_v7_3_obtainable_evidence.mjs";

const reportDate = "2026-07-30";
const capturedAt = "2026-07-30T08:00:00+08:00";
const chinaJointFixture = JSON.parse(
  readFileSync(new URL("./fixtures/v7-2-china-joint-admission.json", import.meta.url), "utf8")
);
const firstQualityProof = {
  type: "official_festival_selection",
  source_id: "festival:indie-showcase",
  value: "Selected for the official indie showcase",
  url: "https://showcase.example/games/v73-audit-near-miss"
};
const evidence = {
  project: "V7.3 Audit Near Miss",
  steam_app_id: "9500001",
  dedupe_key: "steam:9500001",
  region: "overseas",
  release_state: "prelaunch",
  release_window: "over_60",
  early_access_state: "no",
  publisher_occupancy: "clear",
  narrative_state: "no",
  india_team_state: "no",
  official_demo_evidence: [
    {
      type: "steam_demo",
      value: "Official playable Demo",
      url: "https://store.steampowered.com/app/9500001/"
    }
  ],
  official_gameplay_evidence: [],
  quality_proofs: [firstQualityProof],
  business_entrypoints: [
    {
      type: "Email",
      value: "bd@v73-audit-near-miss.example"
    }
  ],
  china_bilibili_value: "系统型合作玩法可形成组队挑战、机制讲解和长期栏目，并以简中社区运营承接B站反馈。",
  china_demand: null
};

const artifact = buildSourcingCandidateArtifact({
  reportDate,
  capturedAt,
  ruleVersion: V73_OBTAINABLE_EVIDENCE_RULE_VERSION,
  rawSteamCandidates: [steamCandidate(evidence)],
  enrichedSteamCandidates: [steamCandidate(evidence)],
  mediaSignalsSeen: 0,
  mediaCandidates: [],
  candidatePools: emptyPools(),
  publishedPools: emptyPools(),
  candidateStates: new Map(),
  steamEnrichmentMetrics: {
    steam_candidates_enriched: 1,
    steam_candidates_scheduled: 1,
    steam_candidates_reused: 0,
    steam_candidates_fresh_success: 1,
    steam_candidates_failed: 0,
    steam_candidates_deferred: 0,
    steam_candidates_evaluated: 1,
    backlog_unenriched_count: 0,
    scheduler_lane_counts: { new: 1, backlog: 0, retry_refresh: 0 },
    evidence_snapshot_rejections: 0
  }
});
const candidate = artifact.candidates.find((item) => item.dedupe_key === evidence.dedupe_key);
const schema = JSON.parse(readFileSync(new URL("../../schemas/sourcing_candidates_v3_shadow.schema.json", import.meta.url), "utf8"));

describe("V7.3 candidate audit and schema contract", () => {
  it("projects actionable near-miss details from the V7.3 decision into the candidate artifact", () => {
    assert.ok(candidate);
    assert.equal(candidate.decision, "candidate");
    assert.equal(candidate.sourcing_lane, "indie_prelaunch");
    assert.equal(candidate.sourcing_rule_version, V73_OBTAINABLE_EVIDENCE_RULE_VERSION);
    assert.ok(candidate.missing_evidence.includes("independent_quality_proof"));
    assert.deepEqual(candidate.failed_gate_details, [
      {
        gate_id: "independent_quality_proof",
        status: "unknown",
        hard_exclusion: false,
        obtainable: true
      }
    ]);
    assert.deepEqual(candidate.next_evidence_actions, [
      {
        gate_id: "independent_quality_proof",
        action: "fetch_independent_quality_evidence"
      }
    ]);
  });


  it("keeps a merged multi-source formal record aligned with the qualified admission", () => {
    const mergeEvidence = {
      ...evidence,
      project: "V7.3 Multi Source Merge",
      steam_app_id: "9500004",
      dedupe_key: "steam:9500004",
      quality_proofs: [
        firstQualityProof,
        {
          type: "media_review",
          source_id: "media:independent-review",
          value: "Independent hands-on review",
          url: "https://independent-review.example/games/v73-multi-source-merge"
        }
      ]
    };
    const steamNearMiss = {
      ...steamCandidate({
        ...mergeEvidence,
        quality_proofs: [firstQualityProof]
      }),
      developers: ["V7.3 Multi Source Studio"],
      publishers: [],
      country: "US",
      region: "海外",
      validatedPcHit: false,
      mobileAdaptationPotential: false,
      hasDemoSignal: true,
      strongGameplay: true,
      highVisual: true,
      strongData: true,
      shortDescription: "A systems-driven co-op strategy game."
    };
    const mediaQualified = {
      project: mergeEvidence.project,
      steam_app_id: mergeEvidence.steam_app_id,
      source: "Independent media V7.3 audit fixture",
      links: ["https://independent-review.example/games/v73-multi-source-merge"],
      risks: null,
      bilibili_fit: mergeEvidence.china_bilibili_value,
      _mediaItem: {
        title: "V7.3 Multi Source Merge hands-on review",
        summary: "Independent hands-on review confirms the core gameplay loop.",
        link: "https://independent-review.example/games/v73-multi-source-merge"
      },
      _steamEntityResolution: {
        details: {
          name: mergeEvidence.project,
          recommendations: { total: 900 },
          publishers: [],
          screenshots: [{ id: 1 }],
          movies: [{ id: 1 }]
        }
      },
      _indieAdmissionEvidence: mergeEvidence
    };
    const pools = buildPools([steamNearMiss], [mediaQualified], {
      reportDate,
      ruleVersion: V73_OBTAINABLE_EVIDENCE_RULE_VERSION
    });
    const mergedArtifact = buildSourcingCandidateArtifact({
      reportDate,
      capturedAt,
      ruleVersion: V73_OBTAINABLE_EVIDENCE_RULE_VERSION,
      rawSteamCandidates: [steamNearMiss],
      enrichedSteamCandidates: [steamNearMiss],
      mediaSignalsSeen: 1,
      mediaCandidates: [mediaQualified],
      candidatePools: pools,
      publishedPools: pools
    });
    const mergedAudit = mergedArtifact.candidates.find(
      (item) => item.steam_app_id === mergeEvidence.steam_app_id
    );

    assert.equal(pools.push.length, 1);
    assert.ok(mergedAudit);
    assert.equal(mergedArtifact.candidates.length, 1);
    assert.equal(mergedAudit.decision, "formal");
    assert.equal(mergedAudit.source_type, "multi_source");
    assert.equal(mergedAudit.sourcing_lane, "indie_prelaunch");
    assert.deepEqual(mergedAudit.missing_evidence, []);
    assert.deepEqual(mergedAudit.failed_gate_details, []);
    assert.deepEqual(mergedAudit.next_evidence_actions, []);
    assert.deepEqual(mergedAudit.exclusion_reasons, []);
    assert.ok(mergedAudit.matched_rules.includes("steam_discovery"));
    assert.ok(mergedAudit.matched_rules.includes("media_discovery"));
    assert.ok(mergedAudit.source_links.includes(
      "https://store.steampowered.com/app/9500004/"
    ));
    assert.ok(mergedAudit.source_links.includes(
      "https://independent-review.example/games/v73-multi-source-merge"
    ));
    assert.equal(mergedArtifact.scan_summary.new_qualified_count, 1);
    assert.equal(mergedArtifact.scan_summary.push_pool_count, 1);
  });


  it("keeps a retained Steam china_joint formal Lead aligned with the V7.3 candidate audit", () => {
    const jointCandidate = retainedJointSteamCandidate();
    const pools = buildPools([jointCandidate], [], {
      reportDate,
      ruleVersion: V73_OBTAINABLE_EVIDENCE_RULE_VERSION
    });
    const jointArtifact = buildSourcingCandidateArtifact({
      reportDate,
      capturedAt,
      ruleVersion: V73_OBTAINABLE_EVIDENCE_RULE_VERSION,
      rawSteamCandidates: [jointCandidate],
      enrichedSteamCandidates: [jointCandidate],
      mediaSignalsSeen: 0,
      mediaCandidates: [],
      candidatePools: pools,
      publishedPools: pools
    });
    const jointAudit = jointArtifact.candidates.find(
      (item) => item.steam_app_id === jointCandidate.appId
    );

    assert.equal(pools.push.length, 1);
    assert.equal(pools.new_qualified_count, 1);
    assert.equal(pools.push[0].sourcing_lane, "china_joint");
    assert.ok(jointAudit);
    assert.equal(jointAudit.decision, "formal");
    assert.equal(jointAudit.sourcing_lane, "china_joint");
    assert.equal(
      jointAudit.sourcing_rule_version,
      V73_OBTAINABLE_EVIDENCE_RULE_VERSION
    );
    assert.deepEqual(jointAudit.failed_gate_details, []);
    assert.deepEqual(jointAudit.next_evidence_actions, []);
    assert.deepEqual(jointAudit.exclusion_reasons, []);
    assert.equal(jointArtifact.scan_summary.new_qualified_count, 1);
    assert.equal(jointArtifact.scan_summary.push_pool_count, 1);
  });

  it("keeps a retained media china_joint formal Lead aligned with the V7.3 candidate audit", () => {
    const jointCandidate = retainedJointMediaCandidate();
    const pools = buildPools([], [jointCandidate], {
      reportDate,
      ruleVersion: V73_OBTAINABLE_EVIDENCE_RULE_VERSION
    });
    const jointArtifact = buildSourcingCandidateArtifact({
      reportDate,
      capturedAt,
      ruleVersion: V73_OBTAINABLE_EVIDENCE_RULE_VERSION,
      rawSteamCandidates: [],
      enrichedSteamCandidates: [],
      mediaSignalsSeen: 1,
      mediaCandidates: [jointCandidate],
      candidatePools: pools,
      publishedPools: pools
    });
    const jointAudit = jointArtifact.candidates.find(
      (item) => item.steam_app_id === jointCandidate.steam_app_id
    );

    assert.equal(pools.push.length, 1);
    assert.equal(pools.new_qualified_count, 1);
    assert.equal(pools.push[0].sourcing_lane, "china_joint");
    assert.ok(jointAudit);
    assert.equal(jointAudit.decision, "formal");
    assert.equal(jointAudit.sourcing_lane, "china_joint");
    assert.equal(
      jointAudit.sourcing_rule_version,
      V73_OBTAINABLE_EVIDENCE_RULE_VERSION
    );
    assert.deepEqual(jointAudit.failed_gate_details, []);
    assert.deepEqual(jointAudit.next_evidence_actions, []);
    assert.deepEqual(jointAudit.exclusion_reasons, []);
    assert.equal(jointArtifact.scan_summary.new_qualified_count, 1);
    assert.equal(jointArtifact.scan_summary.push_pool_count, 1);
  });

  it("emits schema version 3 for V7.3 while retaining PR B scan metrics", () => {
    assert.equal(artifact.schema_version, 3);
    assert.equal(artifact.scan_summary.steam_candidates_enriched, 1);
    assert.equal(artifact.scan_summary.steam_candidates_scheduled, 1);
    assert.equal(artifact.scan_summary.steam_candidates_fresh_success, 1);
    assert.deepEqual(artifact.scan_summary.scheduler_lane_counts, {
      new: 1,
      backlog: 0,
      retry_refresh: 0
    });
  });

  it("declares schema v3 and typed actionable evidence fields", () => {
    assert.deepEqual(schema.properties.schema_version.enum, [1, 2, 3]);
    assert.deepEqual(schema.$defs.candidate.properties.failed_gate_details, {
      type: "array",
      items: { $ref: "#/$defs/failedGateDetail" }
    });
    assert.deepEqual(schema.$defs.candidate.properties.next_evidence_actions, {
      type: "array",
      items: { $ref: "#/$defs/nextEvidenceAction" }
    });
    assert.deepEqual(schema.$defs.failedGateDetail.required, [
      "gate_id",
      "status",
      "hard_exclusion",
      "obtainable"
    ]);
    assert.deepEqual(schema.$defs.failedGateDetail.properties.status.enum, ["fail", "unknown"]);
    assert.equal(schema.$defs.failedGateDetail.properties.hard_exclusion.type, "boolean");
    assert.equal(schema.$defs.failedGateDetail.properties.obtainable.type, "boolean");
    assert.equal(schema.$defs.failedGateDetail.additionalProperties, false);
    assert.deepEqual(schema.$defs.nextEvidenceAction.required, ["gate_id", "action"]);
    assert.equal(schema.$defs.nextEvidenceAction.additionalProperties, false);
  });

  it("requires actionable fields only for schema v3 so historical v1/v2 candidates remain valid", () => {
    const baseRequired = schema.$defs.candidate.required;
    assert.equal(baseRequired.includes("failed_gate_details"), false);
    assert.equal(baseRequired.includes("next_evidence_actions"), false);

    const v3Conditional = (schema.allOf ?? []).find((item) => (
      item?.if?.properties?.schema_version?.const === 3
    ));
    assert.ok(v3Conditional, "schema v3 must add a conditional candidate contract");
    assert.deepEqual(
      v3Conditional.then.properties.candidates.items.required,
      ["failed_gate_details", "next_evidence_actions"]
    );
  });
});

function steamCandidate(admissionEvidence) {
  return {
    appId: admissionEvidence.steam_app_id,
    title: admissionEvidence.project,
    source: "Steam discovery V7.3 audit fixture",
    storeUrl: `https://store.steampowered.com/app/${admissionEvidence.steam_app_id}/`,
    steamDbUrl: `https://steamdb.info/app/${admissionEvidence.steam_app_id}/`,
    website: "https://v73-audit-near-miss.example",
    hasDetails: true,
    comingSoon: true,
    releaseDate: "2027-02-01",
    daysToRelease: 186,
    alreadyReleased: false,
    releaseTooSoon: false,
    earlyAccess: false,
    publisherOccupied: false,
    narrativeHeavy: false,
    indiaTeam: false,
    genres: ["Strategy", "Simulation"],
    categories: ["Co-op"],
    contactMethods: admissionEvidence.business_entrypoints,
    reviewText: "Positive public response",
    recommendationCount: 800,
    screenshotCount: 6,
    movieCount: 1,
    score: 80,
    _indieAdmissionEvidence: admissionEvidence
  };
}


function retainedJointSteamCandidate() {
  const jointEvidence = retainedJointEvidence({
    project: "V7.3 Retained Steam Joint",
    steam_app_id: "9500002"
  });
  return {
    appId: jointEvidence.steam_app_id,
    title: jointEvidence.project,
    source: "Steam retained china_joint audit fixture",
    storeUrl: `https://store.steampowered.com/app/${jointEvidence.steam_app_id}/`,
    steamDbUrl: `https://steamdb.info/app/${jointEvidence.steam_app_id}/`,
    website: "https://retained-steam-joint.example",
    hasDetails: true,
    comingSoon: false,
    releaseDate: "2026-06-01",
    daysToRelease: -59,
    alreadyReleased: true,
    releaseTooSoon: false,
    earlyAccess: false,
    publisherOccupied: false,
    chinaPartnerOccupied: false,
    narrativeHeavy: false,
    indiaTeam: false,
    genres: ["Strategy", "Simulation"],
    categories: ["Co-op"],
    developers: ["Retained Steam Joint Studio"],
    publishers: [],
    contactMethods: [{ type: "Email", value: "bd@retained-steam-joint.example" }],
    reviewText: "Positive",
    recommendationCount: jointEvidence.recommendation_count,
    screenshotCount: 6,
    movieCount: 1,
    score: 80,
    chinaDemandEvidence: "The developer is currently seeking a China publishing partner.",
    _indieAdmissionEvidence: releasedIndieEvidence(jointEvidence),
    _chinaJointAdmissionEvidence: jointEvidence
  };
}

function retainedJointMediaCandidate() {
  const jointEvidence = retainedJointEvidence({
    project: "V7.3 Retained Media Joint",
    steam_app_id: "9500003"
  });
  return {
    project: jointEvidence.project,
    steam_app_id: jointEvidence.steam_app_id,
    source: "Official media retained china_joint audit fixture",
    links: ["https://retained-media-joint.example/current-event"],
    risks: null,
    bilibili_fit: "中国发行合作窗口明确。",
    _officialSourceMatched: true,
    _mediaItem: {
      title: "V7.3 Retained Media Joint seeks a China publishing partner",
      summary: "The developer is currently seeking China publishing cooperation.",
      link: "https://retained-media-joint.example/current-event"
    },
    _steamEntityResolution: {
      details: {
        recommendations: { total: jointEvidence.recommendation_count },
        publishers: [],
        screenshots: [{ id: 1 }],
        movies: [{ id: 1 }]
      }
    },
    _indieAdmissionEvidence: releasedIndieEvidence(jointEvidence),
    _chinaJointAdmissionEvidence: jointEvidence
  };
}

function retainedJointEvidence({ project, steam_app_id }) {
  return {
    ...chinaJointFixture.china_joint_base,
    project,
    steam_app_id,
    dedupe_key: `steam:${steam_app_id}`
  };
}

function releasedIndieEvidence(jointEvidence) {
  return {
    ...evidence,
    project: jointEvidence.project,
    steam_app_id: jointEvidence.steam_app_id,
    dedupe_key: jointEvidence.dedupe_key,
    release_state: "released",
    release_window: "too_soon",
    official_demo_evidence: []
  };
}

function emptyPools() {
  return { push: [], watch: [], drop: [] };
}
