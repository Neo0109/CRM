import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { after, describe, it } from "node:test";

import { createEvidenceSnapshot } from "../jobs/online_daily_v4_candidate_state.mjs";
import {
  V73_OBTAINABLE_EVIDENCE_RULE_VERSION,
  evaluateV73IndiePrelaunchAdmission
} from "../jobs/online_daily_v7_3_obtainable_evidence.mjs";

const orchestratorUrl = new URL(
  "../jobs/online_daily_v7_3_second_pass_orchestrator.mjs",
  import.meta.url
);
const orchestratorModule = existsSync(orchestratorUrl)
  ? await import(orchestratorUrl)
  : {};
const runV73TargetedCandidateSecondPasses =
  orchestratorModule.runV73TargetedCandidateSecondPasses
  ?? missingSecondPassOrchestrator;
const fetchV73TargetedEvidence =
  orchestratorModule.fetchV73TargetedEvidence
  ?? missingTargetedEvidenceProvider;
const compareV73SecondPassPriority =
  orchestratorModule.compareV73SecondPassPriority
  ?? missingSecondPassPriorityComparator;
const analyzeV73EvidenceAvailability =
  orchestratorModule.analyzeV73EvidenceAvailability
  ?? missingEvidenceAvailabilityAnalyzer;
const collectorUrl = new URL(
  "../jobs/online_daily_v7_3_shadow_collector.mjs",
  import.meta.url
);
const collectorModule = existsSync(collectorUrl)
  ? await import(collectorUrl)
  : {};
const collectV73ShadowCore = collectorModule.collectV73ShadowCore
  ?? missingShadowCollector;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error("C5-B test network sentinel: live access is forbidden");
};
after(() => {
  globalThis.fetch = originalFetch;
});

const reportDate = "2026-07-30";
const capturedAt = "2026-07-30T08:00:00+08:00";
const firstQualityProof = {
  type: "official_festival_selection",
  source_id: "festival:indie-showcase",
  value: "Selected for the official indie showcase",
  url: "https://showcase.example/games/orchestrator-fixture"
};
const secondQualityProof = {
  type: "trusted_creator_playtest",
  source_id: "creator:trusted-playtester",
  value: "Independent hands-on playtest",
  url: "https://creator.example/reviews/orchestrator-fixture"
};

describe("V7.3 targeted second-pass Daily orchestration", () => {
  it("exposes a bounded batch orchestrator and a source-constrained evidence provider", () => {
    assert.equal(
      typeof orchestratorModule.runV73TargetedCandidateSecondPasses,
      "function",
      "the Daily second-pass batch orchestrator must be implemented"
    );
    assert.equal(
      typeof orchestratorModule.fetchV73TargetedEvidence,
      "function",
      "the targeted public-evidence provider must be implemented"
    );
  });

  it("selects at most twelve deterministic near-misses with one to three supported actions", async () => {
    const nearMisses = Array.from({ length: 14 }, (_, index) => {
      const evidence = nearMissEvidence(index + 1);
      return steamCandidate(evidence, { score: 100 - index });
    });
    const hardExcludedEvidence = nearMissEvidence(90, { release_state: "released" });
    const wideGapEvidence = nearMissEvidence(91, {
      official_demo_evidence: [],
      official_gameplay_evidence: [],
      quality_proofs: [],
      business_entrypoints: [],
      china_bilibili_value: null
    });
    const fetchCalls = [];
    const fetchEvidence = async (request) => {
      fetchCalls.push(structuredClone(request));
      return { quality_proofs: [secondQualityProof] };
    };

    const forward = await runV73TargetedCandidateSecondPasses({
      steamCandidates: [
        ...nearMisses,
        steamCandidate(hardExcludedEvidence),
        steamCandidate(wideGapEvidence)
      ],
      mediaCandidates: [],
      candidateStates: new Map(),
      capturedAt,
      maxCandidates: 12,
      fetchEvidence
    });
    const reverse = await runV73TargetedCandidateSecondPasses({
      steamCandidates: [
        steamCandidate(wideGapEvidence),
        steamCandidate(hardExcludedEvidence),
        ...nearMisses.toReversed()
      ],
      mediaCandidates: [],
      candidateStates: new Map(),
      capturedAt,
      maxCandidates: 12,
      fetchEvidence: async () => ({ quality_proofs: [secondQualityProof] })
    });

    assert.equal(forward.metrics.eligible_count, 14);
    assert.equal(forward.metrics.selected_count, 12);
    assert.equal(forward.metrics.attempted_count, 12);
    assert.equal(forward.metrics.qualified_count, 12);
    assert.equal(fetchCalls.length, 12);
    assert.ok(fetchCalls.every((call) => call.source_type === "steam"));
    assert.ok(fetchCalls.every((call) => call.actions.length >= 1 && call.actions.length <= 3));
    assert.ok(fetchCalls.every((call) => call.actions.every((item) => (
      item.action === "fetch_independent_quality_evidence"
    ))));
    assert.deepEqual(
      forward.results.map((item) => item.dedupe_key),
      reverse.results.map((item) => item.dedupe_key),
      "selection must not depend on discovery array order"
    );
    assert.equal(
      forward.results.some((item) => item.dedupe_key === hardExcludedEvidence.dedupe_key),
      false
    );
    assert.equal(
      forward.results.some((item) => item.dedupe_key === wideGapEvidence.dedupe_key),
      false
    );
  });

  it("prioritizes locally actionable gate changes and preserves the frozen order when none are actionable", async () => {
    const highScoreEvidence = nearMissEvidence(15);
    const actionableEvidence = nearMissEvidence(16);
    const highScore = steamCandidate(highScoreEvidence, { score: 100 });
    const actionable = steamCandidate(actionableEvidence, { score: 1 });
    const actionableSignal = {
      title: `${actionableEvidence.project} hands-on preview`,
      summary: `${actionableEvidence.project} independent media playtest review`,
      source: "Actionable Games Media",
      link: "https://actionable-media.example/reviews/v73-actionability"
    };

    const prioritized = await runV73TargetedCandidateSecondPasses({
      steamCandidates: [highScore, actionable],
      mediaCandidates: [],
      candidateStates: new Map(),
      capturedAt,
      maxCandidates: 1,
      mediaSignals: [actionableSignal]
    });

    assert.deepEqual(
      prioritized.results.map((item) => item.dedupe_key),
      [actionableEvidence.dedupe_key]
    );
    assert.deepEqual(prioritized.results[0].evidence_diagnostics, {
      project_matching_signal_count: 1,
      eligible_source_role_signal_count: 1,
      quality_keyword_signal_count: 1,
      independent_source_count: 2,
      accepted_proof_count: 1,
      actionable_gate_count: 1,
      outcome: "evidence_found"
    });

    const frozenOrder = await runV73TargetedCandidateSecondPasses({
      steamCandidates: [actionable, highScore],
      mediaCandidates: [],
      candidateStates: new Map(),
      capturedAt,
      maxCandidates: 2,
      mediaSignals: [],
      fetchEvidence: async () => ({ quality_proofs: [] })
    });
    assert.deepEqual(
      frozenOrder.results.map((item) => item.dedupe_key),
      [highScoreEvidence.dedupe_key, actionableEvidence.dedupe_key],
      "the legacy action-count/score/dedupe/source order must remain exact when actionability ties"
    );
  });

  it("prioritizes unique provider-backed requested gates even when quality evidence is unavailable locally", async () => {
    const qualityOnlyEvidence = nearMissEvidence(21);
    const officialLookupEvidence = nearMissEvidence(22, {
      official_demo_evidence: [],
      official_gameplay_evidence: [],
      quality_proofs: [firstQualityProof, secondQualityProof]
    });
    let evaluatorCalls = 0;
    const evaluate = (input) => {
      evaluatorCalls += 1;
      return evaluateV73IndiePrelaunchAdmission(input);
    };
    const outcome = await runV73TargetedCandidateSecondPasses({
      steamCandidates: [
        steamCandidate(qualityOnlyEvidence, { score: 100 }),
        steamCandidate(officialLookupEvidence, { score: 1 })
      ],
      mediaCandidates: [],
      candidateStates: new Map(),
      capturedAt,
      maxCandidates: 1,
      mediaSignals: [],
      evaluate,
      fetchEvidence: async () => ({ official_demo_evidence: [] })
    });

    assert.deepEqual(
      outcome.results.map((item) => item.dedupe_key),
      [officialLookupEvidence.dedupe_key]
    );
    assert.equal(outcome.results[0].evidence_diagnostics.actionable_gate_count, 1);
    assert.equal(outcome.results[0].evidence_diagnostics.outcome, "not_requested");
    assert.ok(evaluatorCalls > 2, "the injected evaluator must also drive actionability analysis");
    const duplicateGateDiagnostics = analyzeV73EvidenceAvailability({
      candidate: officialLookupEvidence,
      evidence: officialLookupEvidence,
      actions: [
        {
          gate_id: "official_playable_or_gameplay",
          action: "fetch_official_playable_or_gameplay"
        },
        {
          gate_id: "official_playable_or_gameplay",
          action: "fetch_official_playable_or_gameplay"
        }
      ],
      mediaSignals: [],
      evaluate
    });
    assert.equal(duplicateGateDiagnostics.actionable_gate_count, 1);
    assert.equal(duplicateGateDiagnostics.outcome, "not_requested");
  });

  it("classifies approved evidence availability outcomes without provider or network access", () => {
    const withOneExistingProof = nearMissEvidence(17);
    const withNoExistingProof = nearMissEvidence(18, { quality_proofs: [] });
    const qualityActions = evaluateV73IndiePrelaunchAdmission(withOneExistingProof)
      .next_evidence_actions;
    const matchingRejectedRole = {
      title: `${withOneExistingProof.project} 试玩评测`,
      summary: `${withOneExistingProof.project} hands-on review`,
      source: "Keyword probe",
      url: "https://www.bilibili.com/video/BV1RejectedRole/",
      source_role: "keyword"
    };
    const matchingNoKeyword = {
      title: `${withOneExistingProof.project} announcement`,
      summary: `${withOneExistingProof.project} launch information`,
      source: "Independent Games Media",
      url: "https://media.example/announcements/no-quality-keyword",
      source_role: "media"
    };
    const matchingQuality = {
      title: `${withOneExistingProof.project} hands-on preview`,
      summary: `${withOneExistingProof.project} independent review`,
      source: "Independent Games Media",
      url: "https://media.example/reviews/one-independent-source",
      source_role: "media"
    };

    const analyze = (evidence, actions, mediaSignals) => analyzeV73EvidenceAvailability({
      candidate: evidence,
      evidence,
      actions,
      mediaSignals
    });

    assert.equal(analyze(withOneExistingProof, [], [matchingQuality]).outcome, "not_requested");
    assert.equal(analyze(withOneExistingProof, qualityActions, []).outcome, "no_project_match");
    assert.equal(
      analyze(withOneExistingProof, qualityActions, [matchingRejectedRole]).outcome,
      "source_role_rejected"
    );
    for (const sourceRole of ["official", "developer", "keyword", "unclassified"]) {
      const rejectedNonBilibili = analyze(withOneExistingProof, qualityActions, [{
        ...matchingQuality,
        source_role: sourceRole,
        url: `https://${sourceRole}.example/reviews/rejected-independent-role`
      }]);
      assert.equal(
        rejectedNonBilibili.outcome,
        "source_role_rejected",
        `${sourceRole} must not occupy an independent-quality slot`
      );
      assert.equal(rejectedNonBilibili.eligible_source_role_signal_count, 0);
      assert.equal(rejectedNonBilibili.accepted_proof_count, 0);
      assert.equal(rejectedNonBilibili.actionable_gate_count, 0);
    }
    assert.equal(
      analyze(withOneExistingProof, qualityActions, [matchingNoKeyword]).outcome,
      "quality_keyword_missing"
    );
    assert.equal(
      analyze(withNoExistingProof, qualityActions, [{
        ...matchingQuality,
        title: `${withNoExistingProof.project} hands-on preview`,
        summary: `${withNoExistingProof.project} independent review`
      }]).outcome,
      "insufficient_independent_sources"
    );
    assert.equal(
      analyze(withOneExistingProof, qualityActions, [matchingQuality]).outcome,
      "evidence_found"
    );
    let injectedEvaluatorCalls = 0;
    const qualityForcedPassEvaluator = (input) => {
      injectedEvaluatorCalls += 1;
      const admission = evaluateV73IndiePrelaunchAdmission(input);
      return {
        ...admission,
        gate_results: admission.gate_results.map((gate) => (
          gate.id === "independent_quality_proof"
            ? { ...gate, status: "pass" }
            : gate
        ))
      };
    };
    assert.equal(analyzeV73EvidenceAvailability({
      candidate: withOneExistingProof,
      evidence: withOneExistingProof,
      actions: qualityActions,
      mediaSignals: [matchingQuality],
      evaluate: qualityForcedPassEvaluator
    }).actionable_gate_count, 0);
    assert.ok(injectedEvaluatorCalls >= 1);
  });

  it("compares the current sixty eligible candidates deterministically without network access", () => {
    const corpus = JSON.parse(readFileSync(
      new URL(
        "../../data/sourcing_replay_corpus/2026-08-11/31469882089-1-afternoon.json",
        import.meta.url
      ),
      "utf8"
    ));
    const eligible = new Set(corpus.second_pass.eligible_ids);
    const boundedSignals = corpus.second_pass.transactions[0].bounded_signals;
    const buildRankItems = () => corpus.candidates
      .filter((candidate) => eligible.has(candidate.candidate_id))
      .map((candidate) => {
        const evidence = structuredClone(candidate.first_pass.indie_prelaunch.input);
        const admission = evaluateV73IndiePrelaunchAdmission(evidence);
        return {
          actions: admission.next_evidence_actions,
          score: candidate.ranking_inputs.discovery_score,
          dedupe_key: candidate.ranking_inputs.dedupe_key,
          source_type: candidate.ranking_inputs.source_type,
          evidence_diagnostics: analyzeV73EvidenceAvailability({
            candidate: evidence,
            evidence: admission.evidence,
            actions: admission.next_evidence_actions,
            mediaSignals: boundedSignals
          })
        };
      });
    const rankItems = buildRankItems();
    assert.deepEqual(buildRankItems(), rankItems, "the pure comparison inputs must repeat exactly");
    assert.ok(rankItems.every((item) => (
      Number.isInteger(item.evidence_diagnostics.actionable_gate_count)
      && typeof item.evidence_diagnostics.outcome === "string"
    )));
    assert.deepEqual({
      zero: rankItems.filter((item) => item.evidence_diagnostics.actionable_gate_count === 0).length,
      one: rankItems.filter((item) => item.evidence_diagnostics.actionable_gate_count === 1).length,
      two: rankItems.filter((item) => item.evidence_diagnostics.actionable_gate_count === 2).length
    }, { zero: 20, one: 37, two: 3 });
    const legacy = [...rankItems].sort((left, right) => (
      left.actions.length - right.actions.length
      || right.score - left.score
      || left.dedupe_key.localeCompare(right.dedupe_key)
      || left.source_type.localeCompare(right.source_type)
    ));
    const actionability = [...rankItems].sort(compareV73SecondPassPriority);

    assert.equal(rankItems.length, 60);
    assert.deepEqual(
      legacy.map((item) => item.dedupe_key),
      corpus.second_pass.eligible_ids
    );
    assert.deepEqual(
      actionability.map((item) => item.evidence_diagnostics.actionable_gate_count),
      [...actionability]
        .map((item) => item.evidence_diagnostics.actionable_gate_count)
        .toSorted((left, right) => right - left),
      "provider-backed gates must define the primary priority tier"
    );
    for (const actionableGateCount of [0, 1, 2]) {
      assert.deepEqual(
        actionability
          .filter((item) => item.evidence_diagnostics.actionable_gate_count === actionableGateCount)
          .map((item) => item.dedupe_key),
        legacy
          .filter((item) => item.evidence_diagnostics.actionable_gate_count === actionableGateCount)
          .map((item) => item.dedupe_key),
        `legacy order must remain exact inside actionability tier ${actionableGateCount}`
      );
    }

    const promoted = structuredClone(rankItems);
    promoted.at(-1).evidence_diagnostics.actionable_gate_count = 3;
    assert.equal(
      promoted.sort(compareV73SecondPassPriority)[0].dedupe_key,
      rankItems.at(-1).dedupe_key,
      "one locally actionable candidate must outrank legacy score without changing tie keys"
    );
  });

  it("writes normalized second-pass evidence back to the candidate snapshot without changing PR B state semantics", async () => {
    const evidence = nearMissEvidence(30);
    const candidate = steamCandidate(evidence);
    const originalSnapshot = createEvidenceSnapshot(candidate, { capturedAt });
    const originalState = {
      first_seen: reportDate,
      last_seen: reportDate,
      enrichment_status: "success",
      enrichment_attempts: 1,
      last_attempted_at: capturedAt,
      last_enriched_at: capturedAt,
      next_retry_date: null,
      scheduler_lane: "new",
      evidence_snapshot: originalSnapshot
    };
    const states = new Map([[evidence.dedupe_key, originalState]]);
    let requested = null;

    const outcome = await runV73TargetedCandidateSecondPasses({
      steamCandidates: [candidate],
      mediaCandidates: [],
      candidateStates: states,
      capturedAt,
      maxCandidates: 12,
      fetchEvidence: async (request) => {
        requested = structuredClone(request);
        return { quality_proofs: [secondQualityProof] };
      }
    });

    const updatedCandidate = outcome.steam_candidates[0];
    const updatedState = outcome.candidate_states.get(evidence.dedupe_key);
    assert.deepEqual(requested?.actions, [{
      gate_id: "independent_quality_proof",
      action: "fetch_independent_quality_evidence"
    }]);
    assert.equal(outcome.results[0].first_pass.qualified, false);
    assert.equal(outcome.results[0].final_pass.qualified, true);
    assert.equal(updatedCandidate._indieAdmissionEvidence.quality_proofs.length, 2);
    assert.equal(
      updatedState.evidence_snapshot.evidence._indieAdmissionEvidence.quality_proofs.length,
      2
    );
    assert.equal(updatedState.first_seen, originalState.first_seen);
    assert.equal(updatedState.last_seen, originalState.last_seen);
    assert.equal(updatedState.enrichment_status, originalState.enrichment_status);
    assert.equal(updatedState.enrichment_attempts, originalState.enrichment_attempts);
    assert.equal(updatedState.last_enriched_at, originalState.last_enriched_at);
    assert.equal(updatedState.scheduler_lane, originalState.scheduler_lane);
    assert.equal(states.get(evidence.dedupe_key).evidence_snapshot, originalSnapshot);
    assert.equal("steam_candidates_scheduled" in outcome.metrics, false);
  });

  it("isolates provider failures and never converts a hard exclusion into a fetch attempt", async () => {
    const nearMiss = steamCandidate(nearMissEvidence(40));
    const excluded = steamCandidate(nearMissEvidence(41, { early_access_state: "yes" }));
    let fetchCount = 0;

    const outcome = await runV73TargetedCandidateSecondPasses({
      steamCandidates: [nearMiss, excluded],
      mediaCandidates: [],
      candidateStates: new Map(),
      capturedAt,
      maxCandidates: 12,
      fetchEvidence: async () => {
        fetchCount += 1;
        throw new Error("targeted source unavailable");
      }
    });

    assert.equal(fetchCount, 1);
    assert.equal(outcome.metrics.selected_count, 1);
    assert.equal(outcome.metrics.attempted_count, 1);
    assert.equal(outcome.metrics.qualified_count, 0);
    assert.equal(outcome.metrics.failed_count, 1);
    assert.equal(outcome.results[0].error, "targeted source unavailable");
    assert.deepEqual(
      outcome.steam_candidates[0]._indieAdmissionEvidence,
      nearMiss._indieAdmissionEvidence
    );
    assert.equal(
      outcome.results.some((item) => item.dedupe_key === excluded._indieAdmissionEvidence.dedupe_key),
      false
    );
  });

  it("keeps project-controlled and unclassified Bilibili signals out of independent quality", async () => {
    const evidence = nearMissEvidence(45, {
      official_demo_evidence: [],
      official_gameplay_evidence: [],
      quality_proofs: []
    });
    const candidate = steamCandidate(evidence);
    const rejectedKinds = ["official", "developer", "publisher", "keyword", null];

    for (const sourceKind of rejectedKinds) {
      const label = sourceKind ?? "missing";
      const signal = {
        title: `${evidence.project} ${label} Demo 实机`,
        summary: `UP主：${label}Channel ${evidence.project} hands-on playtest gameplay`,
        source: "B站官方复核",
        link: `https://www.bilibili.com/video/BV1Rejected${label}/`,
        ...(sourceKind ? { bilibili_probe: { source_kind: sourceKind } } : {})
      };
      const patch = await fetchV73TargetedEvidence({
        candidate,
        source_type: "steam",
        actions: [
          {
            gate_id: "official_playable_or_gameplay",
            action: "fetch_official_playable_or_gameplay"
          },
          {
            gate_id: "independent_quality_proof",
            action: "fetch_independent_quality_evidence"
          }
        ],
        evidence,
        mediaSignals: [],
        context: { fetchOfficialBilibiliCandidatesImpl: async () => [signal] }
      });

      if (["official", "developer", "publisher"].includes(sourceKind)) {
        assert.equal(patch.official_demo_evidence.length, 1, label);
        assert.equal(patch.official_gameplay_evidence.length, 1, label);
      }
      assert.deepEqual(
        patch.quality_proofs,
        [],
        `${label} Bilibili evidence must not consume an independent-quality slot`
      );
    }
  });

  it("keeps one independent source below the unchanged gate and accepts two classified sources", async () => {
    const evidence = nearMissEvidence(46, { quality_proofs: [] });
    const candidate = steamCandidate(evidence);
    const officialSelfEvidence = {
      title: `${evidence.project} developer Demo playtest`,
      summary: `UP主：FixtureStudio ${evidence.project} hands-on gameplay`,
      source: "B站官方复核",
      link: "https://www.bilibili.com/video/BV1DeveloperSelf/",
      bilibili_probe: { source_kind: "developer" }
    };
    const externalMedia = {
      title: `${evidence.project} hands-on preview`,
      summary: "Independent media played the public demo",
      source: "Trusted Games Media",
      link: "https://media.example/previews/independent-quality-fixture"
    };
    const bilibiliMedia = {
      title: `${evidence.project} 独立媒体试玩评测`,
      summary: `UP主：IndependentBiliMedia ${evidence.project} hands-on playtest`,
      source: "B站媒体复核",
      link: "https://www.bilibili.com/video/BV1IndependentMedia/",
      bilibili_probe: { source_kind: "media" }
    };
    const actions = [{
      gate_id: "independent_quality_proof",
      action: "fetch_independent_quality_evidence"
    }];

    const oneSourcePatch = await fetchV73TargetedEvidence({
      candidate,
      source_type: "steam",
      actions,
      evidence,
      mediaSignals: [externalMedia],
      context: {
        fetchOfficialBilibiliCandidatesImpl: async () => [officialSelfEvidence]
      }
    });
    assert.deepEqual(
      oneSourcePatch.quality_proofs.map((item) => item.url),
      [externalMedia.link]
    );
    const oneSourceDecision = evaluateV73IndiePrelaunchAdmission({
      ...evidence,
      quality_proofs: oneSourcePatch.quality_proofs
    });
    assert.equal(oneSourceDecision.qualified, false);
    assert.ok(oneSourceDecision.failed_gates.includes("independent_quality_proof"));

    const twoSourcePatch = await fetchV73TargetedEvidence({
      candidate,
      source_type: "steam",
      actions,
      evidence,
      mediaSignals: [externalMedia, bilibiliMedia],
      context: {
        fetchOfficialBilibiliCandidatesImpl: async () => [officialSelfEvidence]
      }
    });
    assert.deepEqual(
      new Set(twoSourcePatch.quality_proofs.map((item) => item.url)),
      new Set([externalMedia.link, bilibiliMedia.link])
    );
    const twoSourceDecision = evaluateV73IndiePrelaunchAdmission({
      ...evidence,
      quality_proofs: twoSourcePatch.quality_proofs
    });
    assert.equal(twoSourceDecision.qualified, true);
  });

  it("materializes only requested normalized public evidence with source URLs", async () => {
    const evidence = nearMissEvidence(50, {
      official_demo_evidence: [],
      official_gameplay_evidence: [],
      business_entrypoints: [],
      china_bilibili_value: null
    });
    const candidate = steamCandidate(evidence);
    let lookupCount = 0;
    const officialBilibili = {
      title: `${evidence.project} 官方 Demo 实机演示`,
      summary: `UP主：ExampleStudio ${evidence.project} Playtest gameplay`,
      source: "B站官方复核",
      link: "https://www.bilibili.com/video/BV1OfficialFixture/",
      bilibili_probe: { source_kind: "developer" }
    };
    const creatorPlaytest = {
      title: `${evidence.project} 独立试玩测评`,
      summary: `UP主：TrustedCreator ${evidence.project} hands-on playtest`,
      source: "B站官方复核",
      link: "https://www.bilibili.com/video/BV1CreatorFixture/",
      bilibili_probe: { source_kind: "trusted_creator" }
    };
    const mediaSignals = [creatorPlaytest, {
      title: `${evidence.project} hands-on preview`,
      summary: "Independent media played the public demo",
      source: "Trusted Games Media",
      link: "https://media.example/previews/orchestrator-fixture"
    }, {
      title: "Unrelated project preview",
      summary: "Not the requested project",
      source: "Other Media",
      link: "https://other.example/unrelated"
    }];
    const actions = [
      { gate_id: "official_playable_or_gameplay", action: "fetch_official_playable_or_gameplay" },
      { gate_id: "independent_quality_proof", action: "fetch_independent_quality_evidence" },
      { gate_id: "non_steam_business_entry", action: "fetch_non_steam_business_entry" },
      { gate_id: "concrete_china_bilibili_value", action: "research_china_bilibili_value" }
    ];

    const patch = await fetchV73TargetedEvidence({
      candidate,
      source_type: "steam",
      actions,
      evidence,
      mediaSignals,
      context: {
        fetchOfficialBilibiliCandidatesImpl: async () => {
          lookupCount += 1;
          return [officialBilibili];
        }
      }
    });

    assert.equal(lookupCount, 1);
    assert.ok(patch.official_demo_evidence.some((item) => item.url === officialBilibili.link));
    assert.ok(patch.official_gameplay_evidence.some((item) => item.url === officialBilibili.link));
    assert.equal(
      patch.quality_proofs.some((item) => item.url === officialBilibili.link),
      false
    );
    assert.ok(patch.quality_proofs.some((item) => item.url === creatorPlaytest.link));
    assert.ok(patch.quality_proofs.some((item) => item.url === mediaSignals[1].link));
    assert.equal(patch.quality_proofs.some((item) => item.url === mediaSignals[2].link), false);
    assert.ok(patch.business_entrypoints.some((item) => item.value === officialBilibili.link));
    assert.match(patch.china_bilibili_value, /B站|社区|内容|玩法/);

    let qualityOnlyOfficialLookupCount = 0;
    const qualityOnly = await fetchV73TargetedEvidence({
      candidate,
      source_type: "steam",
      actions: [{
        gate_id: "independent_quality_proof",
        action: "fetch_independent_quality_evidence"
      }],
      evidence,
      mediaSignals,
      context: {
        fetchOfficialBilibiliCandidatesImpl: async () => {
          qualityOnlyOfficialLookupCount += 1;
          throw new Error("quality-only requests must not perform an official lookup");
        }
      }
    });
    assert.equal(qualityOnlyOfficialLookupCount, 0);
    assert.deepEqual(Object.keys(qualityOnly), ["quality_proofs"]);
    assert.ok(
      qualityOnly.quality_proofs.some((item) => item.url === mediaSignals[1].link),
      "locally available quality evidence must survive an unavailable official provider"
    );
  });

  it("keeps the bounded second pass inside a deep-cloned shadow collector result", async () => {
    assert.equal(
      typeof collectorModule.collectV73ShadowCore,
      "function",
      "the C5-B shadow collector must be implemented before GREEN"
    );
    const candidate = steamCandidate(nearMissEvidence(60));
    const before = structuredClone(candidate);
    const core = await collectV73ShadowCore({
      reportDate,
      capturedAt,
      runContext: automaticAfternoonRun(),
      steamCandidates: [candidate],
      mediaCandidates: [],
      mediaSignals: [],
      candidateStates: new Map(),
      provider: async () => ({ quality_proofs: [secondQualityProof] })
    });

    assert.deepEqual(candidate, before, "the production candidate must remain byte-identical");
    assert.equal(core.active_production_rule_version, "sourcing-rules-v7.2-china-joint");
    assert.equal(core.shadow_rule_version, V73_OBTAINABLE_EVIDENCE_RULE_VERSION);
    assert.deepEqual(core.second_pass.selected_ids, [before._indieAdmissionEvidence.dedupe_key]);
    assert.equal(core.shadow_candidate_artifact.scan_summary.formal, 1);
    assert.equal("production_pools" in core, false);
    assert.equal("production_candidate_artifact" in core, false);
  });
});

function automaticAfternoonRun() {
  return {
    event_name: "schedule",
    run_slot: "afternoon",
    workflow_run_id: "9001",
    run_attempt: 1,
    run_url: "https://github.com/Neo0109/CRM/actions/runs/9001",
    input_commit_sha: "a".repeat(40),
    node_version: "22.17.0"
  };
}

async function missingShadowCollector() {
  throw new Error("C5-B shadow collector is not implemented");
}

function nearMissEvidence(index, overrides = {}) {
  const appId = String(9600000 + index);
  return {
    project: `V7.3 Orchestrator Fixture ${String(index).padStart(2, "0")}`,
    steam_app_id: appId,
    dedupe_key: `steam:${appId}`,
    region: "overseas",
    release_state: "prelaunch",
    release_window: "over_60",
    early_access_state: "no",
    publisher_occupancy: "clear",
    narrative_state: "no",
    india_team_state: "no",
    official_demo_evidence: [{
      type: "steam_demo",
      value: "Official playable Demo",
      url: `https://store.steampowered.com/app/${appId}/`
    }],
    official_gameplay_evidence: [],
    quality_proofs: [firstQualityProof],
    business_entrypoints: [{
      type: "Email",
      value: `bd+${appId}@orchestrator-fixture.example`
    }],
    china_bilibili_value: "系统型合作玩法可形成机制讲解和长期内容，并以简中社区运营承接B站反馈。",
    china_demand: null,
    ...overrides
  };
}

function steamCandidate(evidence, overrides = {}) {
  return {
    appId: evidence.steam_app_id,
    title: evidence.project,
    source: "Steam discovery V7.3 orchestrator fixture",
    storeUrl: `https://store.steampowered.com/app/${evidence.steam_app_id}/`,
    steamDbUrl: `https://steamdb.info/app/${evidence.steam_app_id}/`,
    developers: ["Fixture Studio"],
    publishers: [],
    country: "US",
    region: "海外",
    genres: ["Strategy", "Simulation"],
    categories: ["Co-op"],
    shortDescription: "A systems-led cooperative strategy game.",
    releaseDate: "2027-02-01",
    daysToRelease: 186,
    alreadyReleased: evidence.release_state === "released",
    comingSoon: true,
    hasDemoSignal: evidence.official_demo_evidence.length > 0,
    earlyAccess: evidence.early_access_state === "yes",
    narrativeHeavy: evidence.narrative_state === "yes",
    indiaTeam: evidence.india_team_state === "yes",
    strongGameplay: true,
    highVisual: true,
    strongData: false,
    validatedPcHit: false,
    mobileAdaptationPotential: true,
    publisherOccupied: evidence.publisher_occupancy === "occupied",
    chinaPartnerOccupied: false,
    contactMethods: evidence.business_entrypoints,
    website: "https://orchestrator-fixture.example",
    hasDetails: true,
    recommendationCount: 0,
    screenshotCount: 6,
    movieCount: 1,
    officialDemoEvidence: evidence.official_demo_evidence,
    officialGameplayEvidence: evidence.official_gameplay_evidence,
    qualityProofs: evidence.quality_proofs,
    chinaBilibiliValue: evidence.china_bilibili_value,
    chinaDemandEvidence: evidence.china_demand,
    reviewText: "",
    domesticQuery: false,
    releaseTooSoon: false,
    score: 80,
    _indieAdmissionEvidence: structuredClone(evidence),
    ...overrides
  };
}

async function missingSecondPassOrchestrator({
  steamCandidates = [],
  mediaCandidates = [],
  candidateStates = new Map()
} = {}) {
  return {
    steam_candidates: structuredClone(steamCandidates),
    media_candidates: structuredClone(mediaCandidates),
    candidate_states: candidateStates,
    metrics: {
      eligible_count: 0,
      selected_count: 0,
      attempted_count: 0,
      qualified_count: 0,
      failed_count: 0
    },
    results: []
  };
}

async function missingTargetedEvidenceProvider() {
  return {};
}

function missingSecondPassPriorityComparator() {
  return 0;
}

function missingEvidenceAvailabilityAnalyzer() {
  return {};
}

assert.equal(
  evaluateV73IndiePrelaunchAdmission(nearMissEvidence(999)).next_evidence_actions.length,
  1,
  "the RED fixture itself must remain a valid one-action V7.3 near-miss"
);
