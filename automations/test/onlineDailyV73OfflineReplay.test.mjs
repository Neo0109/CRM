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

    corpus.candidates[0].publication.decision = "formal";
    assert.notEqual(
      sha256Canonical(buildStoredDecisionView(corpus)),
      sha256Canonical(buildReplayedDecisionView(corpus))
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

  it("rejects unhealthy receipts and a behavior hash outside the frozen contract", () => {
    const unhealthy = replayFixture({ healthy: false });
    expectReplayError(() => replayOfflineCorpus(unhealthy), "RECEIPT_UNHEALTHY");

    const drift = replayFixture();
    drift.expectedBehaviorContractSha256 = "f".repeat(64);
    expectReplayError(() => replayOfflineCorpus(drift), "BEHAVIOR_DRIFT");
  });
});

function replayFixture({
  reportDate = "2026-08-04",
  runSlot = "afternoon",
  eventName = "schedule",
  workflowRunId = 9100,
  runAttempt = 1,
  healthy = true,
  behaviorManifest = {
    "automations/jobs/online_daily_v7_3_offline_replay.mjs": BLOB_A,
    "automations/jobs/online_daily_v7_3_replay_window.mjs": BLOB_B
  }
} = {}) {
  const receipt = {
    status: healthy ? "success" : "failed",
    generation_status: healthy ? "success" : "failed",
    validation_status: healthy ? "success" : "failed",
    sync_response: { synced: healthy }
  };
  const receiptBytes = `${JSON.stringify(receipt, null, 2)}\n`;
  const receiptPayloadSha = sha256Canonical(receipt);
  const receiptBlobSha = gitBlobSha(receiptBytes);
  const behaviorHash = computeBehaviorContractSha256(behaviorManifest);
  const corpusPath = `data/sourcing_replay_corpus/${reportDate}/${workflowRunId}-${runAttempt}-${runSlot}.json`;
  const receiptPath = `data/automation_runs/${reportDate}-${runSlot}.json`;
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
      report: binding(`data/reports/${reportDate}.json`, BLOB_A, SHA_A, 0),
      sourcing_candidates: binding(
        `data/sourcing_candidates/${reportDate}.json`,
        BLOB_B,
        SHA_B,
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
    discovery_summary: { decision_universe_count: 0, sources: [] },
    evidence_catalog: [],
    candidates: [],
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
      candidate_count: 0,
      evidence_count: 0,
      second_pass_eligible_count: 0,
      second_pass_selected_count: 0,
      second_pass_attempted_count: 0,
      second_pass_failed_count: 0,
      second_pass_qualified_count: 0,
      formal_count: 0,
      candidate_decision_count: 0,
      excluded_count: 0,
      shadow_push_pool_count: 0
    },
    integrity: {
      canonical_json_version: 1,
      payload_sha256: "0".repeat(64),
      ordered_candidate_count: 0,
      ordered_evidence_count: 0,
      artifact_binding_count: 4,
      byte_size: 0,
      inline_text_characters: 0,
      status: "complete",
      reason_codes: []
    }
  };
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
    artifactMetadata,
    expectedBehaviorContractSha256: behaviorHash
  };
}

function decisionCorpus() {
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
        indie_prelaunch: { input: {}, output: {}, gate_results: [] },
        china_joint: { input: {}, output: {}, gate_results: [] },
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
