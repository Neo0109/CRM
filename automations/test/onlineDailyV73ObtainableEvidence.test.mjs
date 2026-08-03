import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  V73_OBTAINABLE_EVIDENCE_RULE_VERSION,
  evaluateV73IndiePrelaunchAdmission,
  runV73TargetedSecondPass
} from "../jobs/online_daily_v7_3_obtainable_evidence.mjs";

const firstQualityProof = {
  type: "official_festival_selection",
  source_id: "festival:indie-showcase",
  value: "Selected for the official indie showcase",
  url: "https://showcase.example/games/obtainable-evidence-fixture"
};

const secondQualityProof = {
  type: "trusted_creator_playtest",
  source_id: "creator:trusted-playtester",
  value: "Independent hands-on playtest with systems analysis",
  url: "https://creator.example/reviews/obtainable-evidence-fixture"
};

const qualifiedBase = {
  project: "Obtainable Evidence Fixture",
  steam_app_id: "9400001",
  dedupe_key: "steam:9400001",
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
      url: "https://store.steampowered.com/app/9400001/"
    }
  ],
  official_gameplay_evidence: [],
  quality_proofs: [firstQualityProof, secondQualityProof],
  business_entrypoints: [
    {
      type: "Email",
      value: "bd@obtainable-evidence.example"
    }
  ],
  china_bilibili_value: "系统型合作玩法可形成组队挑战、机制讲解和长期栏目，并以简中社区运营承接B站反馈。",
  china_demand: null
};

describe("V7.3 obtainable evidence and targeted second pass", () => {
  it("accepts one official playable/gameplay family member plus two independent public quality sources", () => {
    const demoOnly = evaluateV73IndiePrelaunchAdmission(qualifiedBase);

    assert.equal(demoOnly.qualified, true);
    assert.equal(demoOnly.disposition, "formal");
    assert.equal(demoOnly.sourcing_rule_version, V73_OBTAINABLE_EVIDENCE_RULE_VERSION);
    assert.equal(gateStatus(demoOnly, "official_playable_or_gameplay"), "pass");
    assert.equal(gateStatus(demoOnly, "independent_quality_proof"), "pass");
    assert.deepEqual(demoOnly.failed_gate_details, []);
    assert.deepEqual(demoOnly.next_evidence_actions, []);

    const gameplayOnly = evaluateV73IndiePrelaunchAdmission({
      ...qualifiedBase,
      official_demo_evidence: [],
      official_gameplay_evidence: [
        {
          type: "official_gameplay_video",
          value: "Official gameplay walkthrough",
          url: "https://developer.example/games/obtainable-evidence-fixture/gameplay"
        }
      ]
    });

    assert.equal(gameplayOnly.qualified, true);
    assert.equal(gateStatus(gameplayOnly, "official_playable_or_gameplay"), "pass");
  });

  it("counts independent quality sources instead of duplicate evidence from one source", () => {
    const duplicateSource = evaluateV73IndiePrelaunchAdmission({
      ...qualifiedBase,
      quality_proofs: [
        firstQualityProof,
        {
          ...firstQualityProof,
          type: "festival_interview",
          value: "A second page from the same showcase source",
          url: "https://showcase.example/interviews/obtainable-evidence-fixture"
        }
      ]
    });

    assert.equal(duplicateSource.qualified, false);
    assert.equal(duplicateSource.disposition, "candidate");
    assert.equal(gateStatus(duplicateSource, "independent_quality_proof"), "unknown");
    assert.deepEqual(duplicateSource.failed_gate_details, [
      {
        gate_id: "independent_quality_proof",
        status: "unknown",
        hard_exclusion: false,
        obtainable: true
      }
    ]);
    assert.deepEqual(duplicateSource.next_evidence_actions, [
      {
        gate_id: "independent_quality_proof",
        action: "fetch_independent_quality_evidence"
      }
    ]);
  });

  it("keeps hard exclusions final and never advertises a second-pass route for them", () => {
    const released = evaluateV73IndiePrelaunchAdmission({
      ...qualifiedBase,
      release_state: "released"
    });

    assert.equal(released.qualified, false);
    assert.equal(released.disposition, "excluded");
    assert.ok(released.failed_gates.includes("prelaunch_window"));
    assert.ok(released.failed_gate_details.some((detail) => (
      detail.gate_id === "prelaunch_window"
      && detail.hard_exclusion === true
      && detail.obtainable === false
    )));
    assert.deepEqual(released.next_evidence_actions, []);
  });

  it("fetches only named missing evidence and calls the exact same decision function again", async () => {
    const nearMiss = {
      ...qualifiedBase,
      quality_proofs: [firstQualityProof]
    };
    const evaluatedEvidence = [];
    const evaluator = (evidence) => {
      evaluatedEvidence.push(structuredClone(evidence));
      return evaluateV73IndiePrelaunchAdmission(evidence);
    };
    let requestedActions = null;

    const outcome = await runV73TargetedSecondPass({
      evidence: nearMiss,
      evaluate: evaluator,
      fetchEvidence: async (actions) => {
        requestedActions = structuredClone(actions);
        return { quality_proofs: [secondQualityProof] };
      }
    });

    assert.equal(outcome.first_pass.qualified, false);
    assert.equal(outcome.second_pass_attempted, true);
    assert.equal(outcome.final_pass.qualified, true);
    assert.equal(evaluatedEvidence.length, 2);
    assert.deepEqual(requestedActions, outcome.first_pass.next_evidence_actions);
    assert.deepEqual(evaluatedEvidence[0].quality_proofs, [firstQualityProof]);
    assert.deepEqual(evaluatedEvidence[1].quality_proofs, [firstQualityProof, secondQualityProof]);
  });

  it("does not fetch evidence or re-evaluate when the first pass is hard-excluded", async () => {
    let evaluationCount = 0;
    let fetchCount = 0;
    const evaluator = (evidence) => {
      evaluationCount += 1;
      return evaluateV73IndiePrelaunchAdmission(evidence);
    };

    const outcome = await runV73TargetedSecondPass({
      evidence: { ...qualifiedBase, early_access_state: "yes" },
      evaluate: evaluator,
      fetchEvidence: async () => {
        fetchCount += 1;
        return {};
      }
    });

    assert.equal(outcome.first_pass.disposition, "excluded");
    assert.equal(outcome.second_pass_attempted, false);
    assert.equal(outcome.final_pass.disposition, "excluded");
    assert.equal(evaluationCount, 1);
    assert.equal(fetchCount, 0);
  });
});

function gateStatus(result, gateId) {
  return result.gate_results.find((gate) => gate.id === gateId)?.status ?? null;
}
