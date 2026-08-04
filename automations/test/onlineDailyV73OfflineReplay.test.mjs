import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  canonicalJson,
  computeBehaviorContractSha256,
  computeReplayCorpusPayloadSha256,
  measureReplayCorpusPayload,
  sha256Canonical,
  validateReplayCorpus
} from "../jobs/online_daily_v7_3_replay_corpus_contract.mjs";
import {
  C5C_REPLAY_ENGINE_CONTRACT_VERSION,
  buildReplayedDecisionView,
  buildStoredDecisionView,
  replayOfflineCorpus
} from "../jobs/online_daily_v7_3_offline_replay.mjs";
import { evaluateV73IndiePrelaunchAdmission } from "../jobs/online_daily_v7_3_obtainable_evidence.mjs";
import { evaluateChinaJointAdmission } from "../jobs/online_daily_v7_2_china_joint_admission.mjs";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const BLOB_A = "1".repeat(40);
const BLOB_B = "2".repeat(40);

describe("C5-C no-network offline replay", () => {
  it("has no fs, network, provider, environment, clock, or randomness dependency", () => {
    const source = readFileSync(
      new URL("../jobs/online_daily_v7_3_offline_replay.mjs", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(
      source,
      /node:(?:fs|http|https|net|tls)|\bundici\b|\bfetch\b|\bprovider\b|process\.env|Date\.now|Math\.random/
    );
  });

  it("replays the same explicit bytes twice with one canonical decision hash", () => {
    const fixture = replayFixture();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => {
      throw new Error("network sentinel tripped");
    };
    try {
      const first = replayOfflineCorpus(fixture);
      const second = replayOfflineCorpus(fixture);
      assert.equal(first.status, "match");
      assert.equal(first.deterministic, true);
      assert.equal(first.expected_decision_sha256, first.replayed_decision_sha256);
      assert.equal(first.replayed_decision_sha256, second.replayed_decision_sha256);
      assert.equal(first.engine_contract_version, C5C_REPLAY_ENGINE_CONTRACT_VERSION);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("detects a stored decision view that differs from the replayed decision", () => {
    const corpus = decisionCorpus();
    const replayed = buildReplayedDecisionView(corpus);
    applyReplayedState(corpus, replayed);
    assert.equal(
      sha256Canonical(buildStoredDecisionView(corpus)),
      sha256Canonical(buildReplayedDecisionView(corpus))
    );

    corpus.candidates[0].publication.decision = "excluded";
    assert.notEqual(
      sha256Canonical(buildStoredDecisionView(corpus)),
      sha256Canonical(buildReplayedDecisionView(corpus))
    );

    const boundMismatch = replayFixture({ withCandidate: true, storedDecisionMismatch: true });
    expectReplayError(() => replayOfflineCorpus(boundMismatch), "REPLAY_MISMATCH");
  });

  it("rebuilds first-pass decisions from evaluator input and treats stored targets as comparison-only", () => {
    const corpus = decisionCorpus();
    const baseline = sha256Canonical(buildReplayedDecisionView(corpus));

    const storedTargetTamper = structuredClone(corpus);
    storedTargetTamper.candidates[0].first_pass.indie_prelaunch.output.qualified = false;
    storedTargetTamper.candidates[0].first_pass.indie_prelaunch.gate_results = [{
      gate_id: "prelaunch_window",
      status: "fail",
      hard_exclusion: true,
      evidence_ids: []
    }];
    storedTargetTamper.candidates[0].publication.decision = "excluded";
    assert.equal(
      sha256Canonical(buildReplayedDecisionView(storedTargetTamper)),
      baseline,
      "stored output, gate_results, and publication must not feed replay"
    );

    const inputTamper = structuredClone(corpus);
    inputTamper.candidates[0].first_pass.indie_prelaunch.input.release_state = "released";
    assert.notEqual(
      sha256Canonical(buildReplayedDecisionView(inputTamper)),
      baseline,
      "changing frozen evaluator input must change the replayed decision"
    );
  });

  it("rebuilds second-pass decisions from merged bounded input, not captured final output", () => {
    const corpus = secondPassDecisionCorpus();
    const baseline = sha256Canonical(buildReplayedDecisionView(corpus));

    const storedTargetTamper = structuredClone(corpus);
    storedTargetTamper.second_pass.transactions[0].final_output.gate_results = [{
      id: "prelaunch_window",
      status: "fail"
    }];
    storedTargetTamper.candidates[0].publication.decision = "excluded";
    assert.equal(
      sha256Canonical(buildReplayedDecisionView(storedTargetTamper)),
      baseline,
      "captured final output and publication must be comparison-only"
    );

    const mergedInputTamper = structuredClone(corpus);
    mergedInputTamper.second_pass.transactions[0].merged_final_input.official_gameplay_evidence = [];
    mergedInputTamper.second_pass.transactions[0].filtered_patch.official_gameplay_evidence = [];
    assert.notEqual(
      sha256Canonical(buildReplayedDecisionView(mergedInputTamper)),
      baseline,
      "changing frozen merged input must change the replayed decision"
    );
  });

  it("rejects corpus and receipt artifact metadata mismatches", () => {
    const badCorpus = replayFixture();
    badCorpus.artifactMetadata.replay_corpus.git_blob_sha = BLOB_B;
    expectReplayError(() => replayOfflineCorpus(badCorpus), "ARTIFACT_MISMATCH");

    const badReceipt = replayFixture();
    badReceipt.artifactMetadata.receipt.payload_sha256 = SHA_A;
    expectReplayError(() => replayOfflineCorpus(badReceipt), "ARTIFACT_MISMATCH");
  });

  it("requires actual bytes for non-corpus artifacts and verifies their hashes", () => {
    const missingReport = replayFixture();
    delete missingReport.artifactBytes.report;
    expectReplayError(
      () => replayOfflineCorpus(missingReport),
      "ARTIFACT_BYTES_REQUIRED"
    );

    const changedReport = replayFixture();
    changedReport.artifactBytes.report = `${JSON.stringify({
      report_date: "1900-01-01",
      push_pool: [],
      watch_pool: [],
      drop_pool: []
    }, null, 2)}\n`;
    expectReplayError(() => replayOfflineCorpus(changedReport), "ARTIFACT_MISMATCH");
  });

  it("closes report-date, run-slot, corpus-id, and canonical path identity", () => {
    const wrongReceiptDate = replayFixture({ receiptReportDate: "1900-01-01" });
    expectReplayError(
      () => replayOfflineCorpus(wrongReceiptDate),
      "ARTIFACT_IDENTITY_MISMATCH"
    );

    const wrongPaths = replayFixture({ artifactPathDate: "1900-01-01" });
    expectReplayError(
      () => replayOfflineCorpus(wrongPaths),
      "ARTIFACT_IDENTITY_MISMATCH"
    );
  });

  it("rejects unhealthy receipts and a behavior hash outside the frozen contract", () => {
    const unhealthy = replayFixture({ healthy: false });
    expectReplayError(() => replayOfflineCorpus(unhealthy), "RECEIPT_UNHEALTHY");

    const drift = replayFixture();
    drift.expectedBehaviorContractSha256 = "f".repeat(64);
    expectReplayError(() => replayOfflineCorpus(drift), "BEHAVIOR_DRIFT");
  });

  it("binds the receipt run tuple to corpus identity even when every hash is self-consistent", () => {
    const wrongRunId = replayFixture({ receiptRunId: "9101" });
    expectReplayError(
      () => replayOfflineCorpus(wrongRunId),
      "ARTIFACT_IDENTITY_MISMATCH"
    );

    const wrongRunAttempt = replayFixture({ receiptRunAttempt: 2 });
    expectReplayError(
      () => replayOfflineCorpus(wrongRunAttempt),
      "ARTIFACT_IDENTITY_MISMATCH"
    );
  });

  it("derives the bounded patch from raw provider output instead of trusting stored filtered output", () => {
    const corpus = secondPassDecisionCorpus();
    const candidate = corpus.candidates[0];
    const transaction = corpus.second_pass.transactions[0];
    const authoritativeEvidence = [{
      source_id: "official-channel",
      type: "official_gameplay",
      url: "https://authority.example/gameplay"
    }];
    const forgedEvidence = [{
      source_id: "forged-channel",
      type: "official_gameplay",
      url: "https://forged.example/gameplay"
    }];
    transaction.raw_provider_result = {
      official_gameplay_evidence: authoritativeEvidence,
      project: "Stored patch must not widen the allowlist"
    };
    transaction.filtered_patch = { official_gameplay_evidence: forgedEvidence };
    transaction.merged_final_input = {
      ...structuredClone(candidate.first_pass.indie_prelaunch.input),
      official_gameplay_evidence: forgedEvidence
    };

    expectReplayError(
      () => buildReplayedDecisionView(corpus),
      "REPLAY_INPUT_MISMATCH"
    );
  });

  it("replays the frozen privacy boundary before comparing the stored filtered patch", () => {
    const corpus = secondPassDecisionCorpus();
    const candidate = corpus.candidates[0];
    const transaction = corpus.second_pass.transactions[0];
    const storedEntry = {
      type: "Email",
      value: "public@example.test",
      official_public_business_entry: false
    };
    transaction.requested_actions = [{
      gate_id: "non_steam_business_entry",
      action: "fetch_non_steam_business_entry"
    }];
    transaction.allowlisted_patch_fields = ["business_entrypoints"];
    transaction.raw_provider_result = {
      business_entrypoints: [storedEntry]
    };
    transaction.filtered_patch = {
      business_entrypoints: [storedEntry]
    };
    transaction.merged_final_input = {
      ...structuredClone(candidate.first_pass.indie_prelaunch.input),
      business_entrypoints: [
        ...structuredClone(candidate.first_pass.indie_prelaunch.input.business_entrypoints),
        storedEntry
      ]
    };

    expectReplayError(
      () => buildReplayedDecisionView(corpus),
      "REPLAY_INPUT_MISMATCH"
    );
  });

  it("merges bounded evidence with normalized source, URL, and type-value priority", () => {
    const corpus = secondPassDecisionCorpus();
    const candidate = corpus.candidates[0];
    const transaction = corpus.second_pass.transactions[0];
    const firstInput = candidate.first_pass.indie_prelaunch.input;
    const retained = [
      {
        source_id: "Media-One",
        value: "retained source priority",
        url: "https://one.example/original"
      },
      {
        value: "retained URL priority",
        url: "https://TWO.example/Review"
      },
      {
        type: "Review",
        value: "Same Value",
        note: "retained type-value priority"
      }
    ];
    const uniqueIncoming = {
      source_id: "media-three",
      value: "unique incoming evidence",
      url: "https://three.example/review"
    };
    const incoming = [
      {
        source_id: " MEDIA-ONE ",
        value: "must not replace source priority",
        url: "https://one.example/replacement"
      },
      {
        value: "must not replace URL priority",
        url: "https://two.example/review"
      },
      {
        type: "review",
        value: "same value",
        note: "must not replace type-value priority"
      },
      uniqueIncoming
    ];
    firstInput.quality_proofs = retained;
    transaction.requested_actions = [{
      gate_id: "independent_quality_proof",
      action: "fetch_independent_quality_evidence"
    }];
    transaction.allowlisted_patch_fields = ["quality_proofs"];
    transaction.raw_provider_result = { quality_proofs: incoming };
    transaction.filtered_patch = { quality_proofs: incoming };
    transaction.merged_final_input = {
      ...structuredClone(firstInput),
      quality_proofs: [...retained, uniqueIncoming]
    };

    assert.doesNotThrow(() => buildReplayedDecisionView(corpus));
  });

  it("replays media-first publication with production pool keys and Han loose-key dedupe", () => {
    const corpus = decisionCorpus();
    corpus.candidates = [
      publicationCandidate({
        candidateId: "steam-app",
        sourceType: "steam",
        project: "Steam Variant",
        steamAppId: "777",
        dedupeKey: "candidate:steam-app"
      }),
      publicationCandidate({
        candidateId: "media-app",
        sourceType: "media",
        project: "Media Variant",
        steamAppId: "777",
        dedupeKey: "candidate:media-app"
      }),
      publicationCandidate({
        candidateId: "media-han-retained",
        sourceType: "media",
        project: "山海星河传奇世界",
        steamAppId: null,
        dedupeKey: "candidate:media-han-retained"
      }),
      publicationCandidate({
        candidateId: "media-han-duplicate",
        sourceType: "media",
        project: "界世奇传河星海山",
        steamAppId: null,
        dedupeKey: "candidate:media-han-duplicate"
      })
    ];

    const replayed = buildReplayedDecisionView(corpus);
    const publication = new Map(
      replayed.candidates.map((candidate) => [candidate.candidate_id, candidate.publication])
    );
    assert.equal(publication.get("media-app").shadow_push_pool, true);
    assert.equal(publication.get("steam-app").shadow_push_pool, false);
    assert.equal(publication.get("media-han-retained").shadow_push_pool, true);
    assert.equal(publication.get("media-han-duplicate").shadow_push_pool, false);
  });
});

function replayFixture({
  reportDate = "2026-08-04",
  runSlot = "afternoon",
  eventName = "schedule",
  workflowRunId = 9100,
  runAttempt = 1,
  healthy = true,
  withCandidate = false,
  storedDecisionMismatch = false,
  receiptReportDate = reportDate,
  receiptRunId = String(workflowRunId),
  receiptRunAttempt = runAttempt,
  artifactPathDate = reportDate,
  behaviorManifest = {
    "automations/jobs/online_daily_v7_3_offline_replay.mjs": BLOB_A,
    "automations/jobs/online_daily_v7_3_replay_window.mjs": BLOB_B
  }
} = {}) {
  const receipt = {
    report_date: receiptReportDate,
    slot: runSlot,
    run_id: receiptRunId,
    run_attempt: receiptRunAttempt,
    status: healthy ? "success" : "failed",
    generation_status: healthy ? "success" : "failed",
    validation_status: healthy ? "success" : "failed",
    sync_response: { synced: healthy }
  };
  const receiptBytes = `${JSON.stringify(receipt, null, 2)}\n`;
  const receiptPayloadSha = sha256Canonical(receipt);
  const receiptBlobSha = gitBlobSha(receiptBytes);
  const behaviorHash = computeBehaviorContractSha256(behaviorManifest);
  const corpusPath = `data/sourcing_replay_corpus/${artifactPathDate}/${workflowRunId}-${runAttempt}-${runSlot}.json`;
  const receiptPath = `data/automation_runs/${artifactPathDate}-${runSlot}.json`;
  const report = { report_date: reportDate, push_pool: [], watch_pool: [], drop_pool: [] };
  const sourcingCandidates = { schema_version: 2, report_date: reportDate, candidates: [] };
  const reportBytes = `${JSON.stringify(report, null, 2)}\n`;
  const sourcingCandidatesBytes = `${JSON.stringify(sourcingCandidates, null, 2)}\n`;
  const corpus = {
    contract_version: 1,
    corpus_id: `${reportDate}/${workflowRunId}/${runAttempt}/${runSlot}`,
    report_date: reportDate,
    timezone: "Asia/Shanghai",
    captured_at: `${reportDate}T15:05:00+08:00`,
    event_name: eventName,
    run_slot: runSlot,
    workflow_run_id: workflowRunId,
    run_attempt: runAttempt,
    run_url: `https://github.com/Neo0109/CRM/actions/runs/${workflowRunId}`,
    input_commit_sha: BLOB_A,
    node_version: "22.17",
    active_production_rule_version: "sourcing-rules-v7.2-china-joint",
    shadow_rule_version: "sourcing-rules-v7.3-obtainable-evidence",
    collector_contract_version: 1,
    behavior_manifest: structuredClone(behaviorManifest),
    behavior_contract_sha256: behaviorHash,
    capture_status: "complete",
    capture_errors: [],
    artifact_bindings: {
      report: binding(
        `data/reports/${artifactPathDate}.json`,
        gitBlobSha(reportBytes),
        sha256Canonical(report),
        0
      ),
      sourcing_candidates: binding(
        `data/sourcing_candidates/${artifactPathDate}.json`,
        gitBlobSha(sourcingCandidatesBytes),
        sha256Canonical(sourcingCandidates),
        0
      ),
      replay_corpus: binding(corpusPath, null, "0".repeat(64), 0),
      receipt: binding(receiptPath, receiptBlobSha, receiptPayloadSha, 1)
    },
    delivery_health: {
      generation_status: healthy ? "success" : "failed",
      validation_status: healthy ? "success" : "failed",
      receipt_status: healthy ? "success" : "failed",
      sync_response: { synced: healthy },
      source_health_status: healthy ? "healthy" : "failed",
      failure_stage: healthy ? null : "sync"
    },
    budgets: {
      limits: {
        max_candidates: 320,
        max_steam_details: 90,
        new_lane: 40,
        backlog_lane: 30,
        retry_refresh_lane: 20,
        snapshot_ttl_days: 7,
        second_pass_max_candidates: 12,
        actions_per_candidate_min: 1,
        actions_per_candidate_max: 3,
        provider_request_limit: 12,
        provider_retry_limit: 0,
        scheduled_network_budget: 90
      },
      usage: {
        fresh_steam_detail_requests: 0,
        scheduled_network_requests: 0,
        reused_snapshot_count: 0,
        provider_requests: 0,
        fresh_steam_detail_candidate_ids: [],
        scheduled_network_candidate_ids: [],
        reused_snapshot_candidate_ids: [],
        provider_transaction_ids: []
      }
    },
    discovery_summary: {
      decision_universe_count: withCandidate ? 1 : 0,
      sources: withCandidate
        ? [{ source_id: "steam", raw_count: 1, retained_count: 1, failure_count: 0 }]
        : []
    },
    evidence_catalog: withCandidate ? [evidenceFixture()] : [],
    candidates: withCandidate ? [candidateFixture()] : [],
    second_pass: {
      selector_version: "targeted-v1",
      max_candidates: 12,
      eligible_ids: [],
      selected_ids: [],
      omitted_ids: [],
      attempted_ids: [],
      failed_ids: [],
      qualified_ids: [],
      transactions: []
    },
    summary: {
      candidate_count: withCandidate ? 1 : 0,
      evidence_count: withCandidate ? 1 : 0,
      second_pass_eligible_count: 0,
      second_pass_selected_count: 0,
      second_pass_attempted_count: 0,
      second_pass_failed_count: 0,
      second_pass_qualified_count: 0,
      formal_count: withCandidate ? 1 : 0,
      candidate_decision_count: 0,
      excluded_count: 0,
      shadow_push_pool_count: withCandidate ? 1 : 0
    },
    integrity: {
      canonical_json_version: 1,
      payload_sha256: "0".repeat(64),
      ordered_candidate_count: withCandidate ? 1 : 0,
      ordered_evidence_count: withCandidate ? 1 : 0,
      artifact_binding_count: 4,
      byte_size: 0,
      inline_text_characters: 0,
      status: "complete",
      reason_codes: []
    }
  };
  corpus.artifact_bindings.replay_corpus.record_count = corpus.candidates.length;
  if (storedDecisionMismatch) {
    corpus.candidates[0].first_pass.indie_prelaunch.output.qualified = false;
    corpus.candidates[0].first_pass.indie_prelaunch.output.disposition = "candidate";
  }
  sealCorpus(corpus);
  assert.deepEqual(validateReplayCorpus(corpus), { valid: true, errors: [] });
  const corpusBytes = `${canonicalJson(corpus)}\n`;
  const artifactMetadata = Object.fromEntries(
    Object.entries(corpus.artifact_bindings).map(([key, value]) => [key, {
      path: value.path,
      git_blob_sha: value.git_blob_sha,
      payload_sha256: value.payload_sha256
    }])
  );
  artifactMetadata.replay_corpus.git_blob_sha = gitBlobSha(corpusBytes);
  return {
    corpusBytes,
    receiptBytes,
    artifactBytes: {
      report: reportBytes,
      sourcing_candidates: sourcingCandidatesBytes
    },
    artifactMetadata,
    expectedBehaviorContractSha256: behaviorHash
  };
}

function candidateFixture() {
  const indieInput = qualifiedIndieInput();
  const chinaInput = {};
  const indieOutput = evaluateV73IndiePrelaunchAdmission(indieInput);
  const chinaOutput = evaluateChinaJointAdmission(chinaInput);
  return {
    candidate_id: "steam:100",
    project: "Game One",
    steam_app_id: "100",
    dedupe_key: "steam:100",
    source_type: "steam",
    source_lane: "regular",
    origin_signal_ids: ["signal:steam:100"],
    first_seen: "2026-08-04",
    last_seen: "2026-08-04",
    scheduler_lane: "new",
    enrichment_status: "success",
    enrichment_attempts: 1,
    snapshot_status: "fresh_success",
    evidence_freshness: "fresh",
    normalized_candidate: { project: "Game One", steam_app_id: "100" },
    discovery_score: 10,
    ranking_inputs: {
      action_count: 0,
      discovery_score: 10,
      dedupe_key: "steam:100",
      source_type: "steam"
    },
    qualification_affected_by_ranking: false,
    dedupe_boundary: {
      history_match: false,
      crm_preexisting_match: false,
      match_basis: "none",
      audit_digest: SHA_A
    },
    first_pass: {
      evaluator_dependency_sha256: SHA_B,
      indie_prelaunch: {
        input: indieInput,
        output: indieOutput,
        gate_results: [{
          gate_id: "identity_and_dedupe",
          status: "pass",
          hard_exclusion: false,
          evidence_ids: ["evidence:one"]
        }]
      },
      china_joint: {
        input: chinaInput,
        output: chinaOutput,
        gate_results: [{
          gate_id: "china_joint",
          status: "fail",
          hard_exclusion: false,
          evidence_ids: ["evidence:one"]
        }]
      },
      regular_selection: {
        status: "selected",
        lane: "indie_prelaunch",
        reason_code: "indie_prelaunch_qualified"
      }
    },
    second_pass: {
      eligible: false,
      rejection_reason: "already_qualified",
      selected: false,
      attempted: false,
      transaction_id: null
    },
    publication: {
      decision: "formal",
      selected_lane: "indie_prelaunch",
      shadow_push_pool: true,
      dedupe_suppressed: false,
      shadow_lead_payload_sha256: SHA_A,
      risk_flags: [],
      day_lead_count_used: false
    }
  };
}

function evidenceFixture() {
  return {
    evidence_id: "evidence:one",
    evidence_type: "public_url",
    gate_id: "identity_and_dedupe",
    url: "https://store.steampowered.com/app/100/",
    source_id: "store.steampowered.com",
    source_role: "official",
    evidence_family: "playability",
    captured_at: "2026-08-04T15:00:00+08:00",
    title: "Game One",
    normalized_summary: "Normalized public evidence.",
    content_sha256: SHA_A,
    source_status: "success",
    fetch_error: null,
    official_public_business_entry: false
  };
}

function decisionCorpus() {
  const indieInput = qualifiedIndieInput();
  const chinaInput = {};
  const indieOutput = evaluateV73IndiePrelaunchAdmission(indieInput);
  const chinaOutput = evaluateChinaJointAdmission(chinaInput);
  return {
    contract_version: 1,
    corpus_id: "decision-only",
    behavior_contract_sha256: SHA_A,
    evidence_catalog: [],
    candidates: [{
      candidate_id: "steam:100",
      ranking_inputs: {
        action_count: 0,
        discovery_score: 10,
        dedupe_key: "steam:100",
        source_type: "steam"
      },
      first_pass: {
        indie_prelaunch: { input: indieInput, output: indieOutput, gate_results: [] },
        china_joint: { input: chinaInput, output: chinaOutput, gate_results: [] },
        regular_selection: {}
      },
      second_pass: {
        eligible: false,
        rejection_reason: "unsupported_or_unobtainable_gap",
        selected: false,
        attempted: false,
        transaction_id: null
      },
      publication: {
        decision: "candidate",
        selected_lane: "indie_prelaunch",
        shadow_push_pool: false,
        dedupe_suppressed: false,
        shadow_lead_payload_sha256: null,
        risk_flags: [],
        day_lead_count_used: false
      }
    }],
    second_pass: {
      selector_version: "targeted-v1",
      max_candidates: 12,
      eligible_ids: [],
      selected_ids: [],
      omitted_ids: [],
      attempted_ids: [],
      failed_ids: [],
      qualified_ids: [],
      transactions: []
    },
    summary: {}
  };
}

function secondPassDecisionCorpus() {
  const corpus = decisionCorpus();
  const candidate = corpus.candidates[0];
  const firstInput = qualifiedIndieInput();
  firstInput.official_gameplay_evidence = [];
  candidate.first_pass.indie_prelaunch.input = firstInput;
  candidate.first_pass.indie_prelaunch.output = evaluateV73IndiePrelaunchAdmission(firstInput);
  candidate.ranking_inputs.action_count = 1;
  candidate.second_pass = {
    eligible: true,
    rejection_reason: null,
    selected: true,
    attempted: true,
    transaction_id: "tx:steam:100"
  };
  const mergedInput = qualifiedIndieInput();
  const finalOutput = evaluateV73IndiePrelaunchAdmission(mergedInput);
  corpus.second_pass = {
    selector_version: "targeted-v1",
    max_candidates: 1,
    eligible_ids: [candidate.candidate_id],
    selected_ids: [candidate.candidate_id],
    omitted_ids: [],
    attempted_ids: [candidate.candidate_id],
    failed_ids: [],
    qualified_ids: [candidate.candidate_id],
    transactions: [{
      transaction_id: "tx:steam:100",
      candidate_id: candidate.candidate_id,
      requested_actions: [{
        gate_id: "official_playable_or_gameplay",
        action: "fetch_official_playable_or_gameplay"
      }],
      allowlisted_patch_fields: ["official_demo_evidence", "official_gameplay_evidence"],
      bounded_signals: [],
      provider_contract_version: "public-second-pass-v1",
      request_metrics: {},
      raw_provider_result: { official_gameplay_evidence: mergedInput.official_gameplay_evidence },
      filtered_patch: { official_gameplay_evidence: mergedInput.official_gameplay_evidence },
      provider_status: "success",
      error: null,
      merged_final_input: mergedInput,
      final_output: finalOutput,
      decision_changed: true,
      changed_gate: "official_playable_or_gameplay",
      evaluator_dependency_sha256: SHA_B
    }]
  };
  return corpus;
}

function qualifiedIndieInput() {
  return {
    project: "Game One",
    steam_app_id: "100",
    dedupe_key: "steam:100",
    region: "domestic",
    release_state: "prelaunch",
    release_window: "over_60",
    early_access_state: "no",
    publisher_occupancy: "clear",
    narrative_state: "no",
    india_team_state: "no",
    official_demo_evidence: [],
    official_gameplay_evidence: [{
      type: "official_gameplay",
      url: "https://example.com/gameplay"
    }],
    quality_proofs: [
      { source_id: "media-one", value: "review one", url: "https://one.example/review" },
      { source_id: "media-two", value: "review two", url: "https://two.example/review" }
    ],
    business_entrypoints: [{ type: "website", url: "https://game.example/contact" }],
    china_bilibili_value: "Systemic gameplay supports creator challenges."
  };
}

function publicationCandidate({
  candidateId,
  sourceType,
  project,
  steamAppId,
  dedupeKey
}) {
  const candidate = candidateFixture();
  const indieInput = qualifiedIndieInput();
  indieInput.project = project;
  indieInput.steam_app_id = steamAppId;
  indieInput.dedupe_key = dedupeKey;
  candidate.candidate_id = candidateId;
  candidate.project = project;
  candidate.steam_app_id = steamAppId;
  candidate.dedupe_key = dedupeKey;
  candidate.source_type = sourceType;
  candidate.normalized_candidate = {
    project,
    steam_app_id: steamAppId,
    dedupe_key: dedupeKey,
    source_type: sourceType
  };
  candidate.ranking_inputs = {
    action_count: 0,
    discovery_score: 10,
    dedupe_key: dedupeKey,
    source_type: sourceType
  };
  candidate.first_pass.indie_prelaunch.input = indieInput;
  candidate.first_pass.indie_prelaunch.output =
    evaluateV73IndiePrelaunchAdmission(indieInput);
  candidate.second_pass = {
    eligible: false,
    rejection_reason: "already_qualified",
    selected: false,
    attempted: false,
    transaction_id: null
  };
  return candidate;
}

function applyReplayedState(corpus, replayed) {
  const replayedCandidate = replayed.candidates[0];
  const candidate = corpus.candidates[0];
  candidate.first_pass.indie_prelaunch.output = replayedCandidate.first_pass.indie_prelaunch.output;
  candidate.first_pass.china_joint.output = replayedCandidate.first_pass.china_joint.output;
  candidate.first_pass.regular_selection = replayedCandidate.first_pass.regular_selection;
  candidate.second_pass = replayedCandidate.second_pass;
  candidate.publication = replayedCandidate.publication;
  corpus.second_pass = replayed.second_pass;
  corpus.summary = replayed.summary;
}

function binding(path, gitBlobShaValue, payloadSha256, recordCount) {
  return {
    path,
    git_blob_sha: gitBlobShaValue,
    payload_sha256: payloadSha256,
    record_count: recordCount,
    validation_status: "valid"
  };
}

function sealCorpus(corpus) {
  corpus.integrity.payload_sha256 = "0".repeat(64);
  corpus.artifact_bindings.replay_corpus.payload_sha256 = "0".repeat(64);
  for (let index = 0; index < 8; index += 1) {
    const metrics = measureReplayCorpusPayload(corpus);
    if (
      corpus.integrity.byte_size === metrics.byte_size
      && corpus.integrity.inline_text_characters === metrics.inline_text_characters
    ) break;
    corpus.integrity.byte_size = metrics.byte_size;
    corpus.integrity.inline_text_characters = metrics.inline_text_characters;
  }
  const payloadSha = computeReplayCorpusPayloadSha256(corpus);
  corpus.integrity.payload_sha256 = payloadSha;
  corpus.artifact_bindings.replay_corpus.payload_sha256 = payloadSha;
}

function gitBlobSha(value) {
  const bytes = Buffer.from(value, "utf8");
  return createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
}

function expectReplayError(fn, code) {
  assert.throws(fn, (error) => error?.code === code);
}
