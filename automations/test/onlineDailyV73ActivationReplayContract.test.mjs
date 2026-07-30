import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { analyzeDailyLeadsLivenessFromRepository } from "../jobs/online_daily_leads_liveness.mjs";
import { buildPools } from "../jobs/online_daily_v4_decision.mjs";
import { buildDailyReport } from "../jobs/online_daily_v4_reports.mjs";
import {
  isLeadCountHealthEnabled,
  RULE_VERSION
} from "../jobs/online_daily_v4_rules.mjs";
import {
  evaluateV73IndiePrelaunchAdmission,
  V73_OBTAINABLE_EVIDENCE_RULE_VERSION
} from "../jobs/online_daily_v7_3_obtainable_evidence.mjs";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const reportDate = "2026-07-30";
const v7Fixture = JSON.parse(
  readFileSync(new URL("./fixtures/v7-indie-admission.json", import.meta.url), "utf8")
);
const chinaJointFixture = JSON.parse(
  readFileSync(new URL("./fixtures/v7-2-china-joint-admission.json", import.meta.url), "utf8")
);

const V73_REQUIRED_GATE_IDS = [
  "identity_and_dedupe",
  "prelaunch_window",
  "publisher_china_capacity_clear",
  "non_narrative_product",
  "non_india_team",
  "official_playable_or_gameplay",
  "independent_quality_proof",
  "non_steam_business_entry",
  "concrete_china_bilibili_value"
];

const V73_PUBLIC_EVIDENCE_ACTIONS = [
  "fetch_official_playable_or_gameplay",
  "fetch_independent_quality_evidence",
  "fetch_non_steam_business_entry",
  "research_china_bilibili_value"
];

describe("V7.3 machine-rule activation and fixed replay contract", () => {
  it("activates one V7.3 version across runtime, machine rules, current docs, and the generator boundary", () => {
    const machineRules = readMachineRules();
    const currentRulesDoc = readFileSync(
      new URL("../../docs/SOURCING_RULES_CURRENT.md", import.meta.url),
      "utf8"
    );
    const generator = readFileSync(
      new URL("../jobs/online_daily_v4.mjs", import.meta.url),
      "utf8"
    );

    assert.equal(RULE_VERSION, V73_OBTAINABLE_EVIDENCE_RULE_VERSION);
    assert.equal(machineRules.rule_version, V73_OBTAINABLE_EVIDENCE_RULE_VERSION);
    assert.equal(machineRules.canonical_rules_doc, "docs/SOURCING_RULES_V7_3.md");
    assert.match(currentRulesDoc, /sourcing-rules-v7\.3-obtainable-evidence/);
    assert.match(currentRulesDoc, /SOURCING_RULES_V7_3\.md/);
    assert.match(machineRules.report_contract.daily_report, /V7\.3/);
    assert.doesNotMatch(machineRules.report_contract.daily_report, /V7\.2/);
    assert.match(
      generator,
      /buildPools\(\s*v73SecondPass\.steam_candidates,\s*v73SecondPass\.media_candidates,\s*\{\s*reportDate,\s*ruleVersion:\s*sourcingRuleVersion\s*\}/s
    );
  });

  it("records the obtainable-evidence model in the machine rule without weakening hard gates", () => {
    const indieRule = readMachineRules().indie_prelaunch_admission;

    assert.deepEqual(indieRule.required_gate_ids, V73_REQUIRED_GATE_IDS);
    assert.deepEqual(indieRule.evidence_model, {
      official_playable_or_gameplay: {
        combination: "any_of",
        minimum_required: 1,
        accepted_evidence_ids: [
          "official_demo_or_playtest",
          "official_gameplay"
        ]
      },
      independent_quality_proof: {
        minimum_independent_public_sources: 2
      },
      explicit_china_demand: {
        required: false,
        treatment: "positive_signal"
      }
    });
    assert.equal(indieRule.all_gates_required, true);
    assert.equal(indieRule.formal_lead_minimum, null);
    assert.equal(indieRule.formal_lead_maximum, null);
    assert.equal(indieRule.watch_pool_enabled, false);
    assert.equal(indieRule.drop_pool_enabled, false);
  });

  it("records a bounded public-evidence second pass with no alternate admission path", () => {
    const secondPass = readMachineRules().indie_prelaunch_admission.targeted_second_pass;

    assert.deepEqual(secondPass, {
      enabled: true,
      eligible_missing_action_count: {
        minimum: 1,
        maximum: 3
      },
      max_candidates_per_run: 12,
      allowed_public_actions: V73_PUBLIC_EVIDENCE_ACTIONS,
      same_decision_function_required: true,
      hard_exclusion_bypass: false,
      formal_lead_backfill: false
    });
  });

  it("uses V7.3 for the formal pool while retaining the independent china_joint lane", () => {
    const candidates = [
      steamCandidate(v73QualifiedEvidence()),
      chinaJointCandidate()
    ];
    const pools = buildPools(candidates, [], {
      reportDate,
      ruleVersion: V73_OBTAINABLE_EVIDENCE_RULE_VERSION
    });

    assert.equal(pools.push.length, 2);
    assert.equal(pools.new_qualified_count, 2);
    assert.deepEqual(
      new Set(pools.push.map((lead) => lead.sourcing_lane)),
      new Set(["indie_prelaunch", "china_joint"])
    );
    assert.ok(
      pools.push.every(
        (lead) => lead.sourcing_rule_version === V73_OBTAINABLE_EVIDENCE_RULE_VERSION
      )
    );
    assert.deepEqual(pools.watch, []);
    assert.deepEqual(pools.drop, []);
  });

  it("keeps zero formal Leads outside transport health and quantity backfill", () => {
    const indieRule = readMachineRules().indie_prelaunch_admission;

    assert.equal(isLeadCountHealthEnabled(V73_OBTAINABLE_EVIDENCE_RULE_VERSION), false);
    assert.equal(indieRule.formal_lead_minimum, null);
    assert.equal(indieRule.formal_lead_maximum, null);
    assert.equal(indieRule.watch_pool_enabled, false);
    assert.equal(indieRule.drop_pool_enabled, false);
  });

  it("stamps reader-facing Daily output with V7.3 instead of stale V7.2 claims", () => {
    const report = buildDailyReport({
      pools: { push: [], watch: [], drop: [], new_qualified_count: 0 },
      rawCount: 12,
      enrichedCount: 8,
      mediaLeadCount: 3,
      reportDate,
      ruleVersion: V73_OBTAINABLE_EVIDENCE_RULE_VERSION,
      diagnostics: {
        bilibili_official_source_hits: 0,
        bilibili_probe: {}
      }
    });
    const readerText = [report.summary, ...(report.insights ?? [])].join("\n");

    assert.match(readerText, /V7\.3/);
    assert.doesNotMatch(readerText, /V7\.2/);
  });

  it("keeps the fixed July 15-29 production replay as an immutable historical baseline", () => {
    const replay = analyzeDailyLeadsLivenessFromRepository({
      rootDir: repoRoot,
      startDate: "2026-07-15",
      endDate: "2026-07-29"
    });

    assert.equal(replay.window.report_days, 15);
    assert.equal(replay.window.candidate_artifact_days, 14);
    assert.equal(replay.window.missing_candidate_artifact_days, 1);
    assert.equal(replay.consecutive_zero_days, 15);
    assert.equal(replay.business_liveness_status, "unhealthy-business-liveness");
    assert.deepEqual(replay.top_blocking_gates.slice(0, 3), [
      {
        gate: "independent_quality_proof",
        candidate_occurrences: 3017,
        day_occurrences: 14
      },
      {
        gate: "steam_review_summary",
        candidate_occurrences: 3017,
        day_occurrences: 14
      },
      {
        gate: "official_gameplay",
        candidate_occurrences: 2943,
        day_occurrences: 14
      }
    ]);
    assert.ok(replay.history.every((day) => day.new_lead_count === 0));
  });

  it("keeps all seven historical weak samples out under the V7.3 decision", () => {
    assert.equal(v7Fixture.historical_weak_samples.length, 7);

    for (const sample of v7Fixture.historical_weak_samples) {
      const result = evaluateV73IndiePrelaunchAdmission({
        ...v73QualifiedEvidence(),
        project: sample.project,
        steam_app_id: sample.steam_app_id,
        dedupe_key: `steam:${sample.steam_app_id}`,
        quality_proofs: []
      });

      assert.equal(result.qualified, false, sample.project);
      assert.equal(result.disposition, "candidate", sample.project);
      assert.ok(
        result.failed_gates.includes("independent_quality_proof"),
        sample.project
      );
    }
  });
});

function readMachineRules() {
  return JSON.parse(
    readFileSync(new URL("../rules/daily-report.json", import.meta.url), "utf8")
  );
}

function v73QualifiedEvidence() {
  return {
    project: "V7.3 Activation Fixture",
    steam_app_id: "9800001",
    dedupe_key: "steam:9800001",
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
        url: "https://store.steampowered.com/app/9800001/"
      }
    ],
    official_gameplay_evidence: [],
    quality_proofs: [
      {
        type: "official_festival_selection",
        source_id: "festival:activation-fixture",
        value: "Selected for a public indie showcase",
        url: "https://showcase.example/games/activation-fixture"
      },
      {
        type: "trusted_creator_playtest",
        source_id: "creator:activation-fixture",
        value: "Independent hands-on systems analysis",
        url: "https://creator.example/reviews/activation-fixture"
      }
    ],
    business_entrypoints: [
      {
        type: "Email",
        value: "bd@activation-fixture.example"
      }
    ],
    china_bilibili_value: "系统型合作玩法可形成组队挑战、机制讲解和长期栏目，并以简中社区运营承接B站反馈。",
    china_demand: null
  };
}

function steamCandidate(evidence, overrides = {}) {
  return {
    appId: evidence.steam_app_id,
    title: evidence.project,
    source: "Steam V7.3 activation fixture",
    score: 0,
    genres: ["Strategy", "Simulation"],
    categories: ["Co-op"],
    developers: ["Activation Fixture Studio"],
    publishers: [],
    country: "US",
    region: "海外",
    releaseDate: "2027-01-01",
    daysToRelease: 155,
    alreadyReleased: false,
    releaseTooSoon: false,
    comingSoon: true,
    earlyAccess: false,
    publisherOccupied: false,
    chinaPartnerOccupied: false,
    narrativeHeavy: false,
    indiaTeam: false,
    strongGameplay: true,
    highVisual: true,
    strongData: true,
    validatedPcHit: false,
    mobileAdaptationPotential: false,
    hasDemoSignal: true,
    hasDetails: true,
    contactMethods: evidence.business_entrypoints,
    storeUrl: `https://store.steampowered.com/app/${evidence.steam_app_id}/`,
    steamDbUrl: `https://steamdb.info/app/${evidence.steam_app_id}/`,
    website: "https://activation-fixture.example",
    shortDescription: "A systems-led cooperative strategy game.",
    recommendationCount: 0,
    reviewText: "",
    screenshotCount: 6,
    movieCount: 1,
    chinaDemandEvidence: null,
    _indieAdmissionEvidence: evidence,
    ...overrides
  };
}

function chinaJointCandidate() {
  const evidence = {
    ...chinaJointFixture.china_joint_base,
    project: "V7.3 Retained China Joint",
    steam_app_id: "9800002",
    dedupe_key: "steam:9800002"
  };
  return steamCandidate(
    {
      ...v73QualifiedEvidence(),
      project: evidence.project,
      steam_app_id: evidence.steam_app_id,
      dedupe_key: evidence.dedupe_key,
      release_state: "released",
      release_window: "too_soon",
      official_demo_evidence: []
    },
    {
      source: "Steam retained china_joint fixture",
      releaseDate: "2026-06-01",
      daysToRelease: -30,
      alreadyReleased: true,
      comingSoon: false,
      hasDemoSignal: false,
      recommendationCount: evidence.recommendation_count,
      reviewText: "Positive",
      chinaDemandEvidence: "The studio is currently seeking a China publishing partner.",
      _chinaJointAdmissionEvidence: evidence
    }
  );
}
