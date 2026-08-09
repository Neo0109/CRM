import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  canonicalJson,
  computeBehaviorContractSha256,
  computeReplayCorpusPayloadSha256,
  measureReplayCorpusPayload,
  sha256Canonical,
  validateReplayWindow
} from "../jobs/online_daily_v7_3_replay_corpus_contract.mjs";
import {
  advanceReplayWindow,
  buildReplayWindowSequence,
  selectCanonicalReplayRun
} from "../jobs/online_daily_v7_3_replay_window.mjs";
import { evaluateV73IndiePrelaunchAdmission } from "../jobs/online_daily_v7_3_obtainable_evidence.mjs";
import { evaluateChinaJointAdmission } from "../jobs/online_daily_v7_2_china_joint_admission.mjs";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const BLOB_A = "1".repeat(40);
const BLOB_B = "2".repeat(40);
const BEHAVIOR_MANIFEST = {
  "automations/jobs/online_daily_v7_3_offline_replay.mjs": BLOB_A,
  "automations/jobs/online_daily_v7_3_replay_window.mjs": BLOB_B
};
const BEHAVIOR_HASH = computeBehaviorContractSha256(BEHAVIOR_MANIFEST);

describe("C5-C canonical replay-run selector", () => {
  it("uses only a healthy natural afternoon and rejects watchdog fallback", () => {
    const reportDate = "2026-08-04";
    const result = selectCanonicalReplayRun({
      reportDate,
      expectedBehaviorContractSha256: BEHAVIOR_HASH,
      attempts: [
        attempt({ reportDate, runSlot: "watchdog", workflowRunId: 9200 }),
        attempt({ reportDate, runSlot: "afternoon", workflowRunId: 9102 }),
        attempt({ reportDate, runSlot: "afternoon", workflowRunId: 9101 })
      ]
    });
    assert.equal(result.status, "selected");
    assert.equal(result.canonical_entry.run_slot, "afternoon");
    assert.equal(result.canonical_entry.corpus_id, `${reportDate}/9101/1/afternoon`);
    assert.deepEqual(
      result.rejected_attempts.map((item) => item.reason_code),
      ["superseded_automatic_attempt", "watchdog_only"]
    );

    const fallback = selectCanonicalReplayRun({
      reportDate,
      expectedBehaviorContractSha256: BEHAVIOR_HASH,
      attempts: [
        attempt({ reportDate, runSlot: "afternoon", workflowRunId: 9100, healthy: false }),
        attempt({ reportDate, runSlot: "watchdog", workflowRunId: 9200 })
      ]
    });
    assert.equal(fallback.status, "failed");
    assert.equal(fallback.canonical_entry, null);
    assert.ok(fallback.rejected_attempts.some((item) => item.reason_code === "delivery_unhealthy"));
    assert.ok(fallback.rejected_attempts.some((item) => item.reason_code === "watchdog_only"));
  });

  it("excludes morning, workflow_dispatch, manual, rerun, and incomplete corpus", () => {
    const reportDate = "2026-08-05";
    const result = selectCanonicalReplayRun({
      reportDate,
      expectedBehaviorContractSha256: BEHAVIOR_HASH,
      attempts: [
        attempt({ reportDate, runSlot: "morning", workflowRunId: 9301 }),
        attempt({ reportDate, runSlot: "manual", eventName: "workflow_dispatch", workflowRunId: 9302 }),
        attempt({ reportDate, runSlot: "afternoon", workflowRunId: 9303, runAttempt: 2 }),
        attempt({ reportDate, runSlot: "afternoon", workflowRunId: 9304, captureStatus: "incomplete" })
      ]
    });
    assert.equal(result.status, "failed");
    assert.deepEqual(
      new Set(result.rejected_attempts.map((item) => item.reason_code)),
      new Set(["morning_only", "manual_only", "rerun", "incomplete"])
    );
    assert.deepEqual(result.failure_reasons, ["no_canonical"]);
  });

  it("fails closed on artifact mismatch and pre-C5-C behavior hash drift", () => {
    const reportDate = "2026-08-06";
    const badArtifact = attempt({ reportDate, runSlot: "afternoon", workflowRunId: 9401 });
    badArtifact.artifactMetadata.replay_corpus.git_blob_sha = BLOB_B;
    const artifactFailure = selectCanonicalReplayRun({
      reportDate,
      expectedBehaviorContractSha256: BEHAVIOR_HASH,
      attempts: [badArtifact]
    });
    assert.equal(artifactFailure.status, "failed");
    assert.deepEqual(artifactFailure.failure_reasons, ["artifact_mismatch"]);

    const preC5C = attempt({
      reportDate,
      runSlot: "afternoon",
      workflowRunId: 9402,
      behaviorManifest: { "automations/jobs/pre-c5c.mjs": BLOB_A }
    });
    const behaviorFailure = selectCanonicalReplayRun({
      reportDate,
      expectedBehaviorContractSha256: BEHAVIOR_HASH,
      attempts: [preC5C]
    });
    assert.equal(behaviorFailure.status, "failed");
    assert.deepEqual(behaviorFailure.failure_reasons, ["behavior_drift"]);
  });

  it("fails closed when requested Shanghai date differs from retained corpus identity", () => {
    const attemptForNextDay = attempt({
      reportDate: "2026-08-05",
      runSlot: "afternoon",
      workflowRunId: 9450
    });
    const result = selectCanonicalReplayRun({
      reportDate: "2026-08-04",
      expectedBehaviorContractSha256: BEHAVIOR_HASH,
      attempts: [attemptForNextDay]
    });
    assert.equal(result.status, "failed");
    assert.deepEqual(result.failure_reasons, ["artifact_mismatch"]);
    assert.equal(result.rejected_attempts[0].report_date, "2026-08-05");
  });
});

describe("C5-C three-natural-afternoon-day evidence windows", () => {
  it("handles month-end, year-end, and leap-day sequences when one distinct project converts", () => {
    for (const startDate of ["2026-01-25", "2026-12-25", "2028-02-20"]) {
      const days = naturalDates(startDate, 3).map((reportDate, index) => ({
        report_date: reportDate,
        attempts: [attempt({
          reportDate,
          workflowRunId: 10_000 + index,
          withShadowFormal: index === 1
        })]
      }));
      const result = buildReplayWindowSequence({
        days,
        expectedBehaviorContractSha256: BEHAVIOR_HASH
      });
      assert.equal(result.current_window.status, "complete");
      assert.equal(result.current_window.dates.length, 3);
      assert.deepEqual(
        result.current_window.dates.flatMap((entry) => entry.shadow_formal_candidate_ids),
        ["steam:100"]
      );
      assert.deepEqual(validateReplayWindow(result.current_window), { valid: true, errors: [] });
    }
  });

  it("remains active before three dates and fails on the third zero-shadow day", () => {
    const firstTwo = buildReplayWindowSequence({
      expectedBehaviorContractSha256: BEHAVIOR_HASH,
      days: naturalDates("2026-08-01", 2).map((reportDate, index) => ({
        report_date: reportDate,
        attempts: [attempt({ reportDate, workflowRunId: 15_000 + index })]
      }))
    });
    assert.equal(firstTwo.current_window.status, "active");
    assert.equal(firstTwo.current_window.dates.length, 2);

    const third = advanceReplayWindow({
      window: firstTwo.current_window,
      reportDate: "2026-08-03",
      attempts: [attempt({ reportDate: "2026-08-03", workflowRunId: 15_002 })],
      expectedBehaviorContractSha256: BEHAVIOR_HASH
    });
    assert.equal(third.transition, "failed");
    assert.equal(third.window.status, "failed");
    assert.equal(third.window.failure_date, "2026-08-03");
    assert.equal(third.window.dates.length, 3);
    assert.deepEqual(third.window.failure_reasons, ["evidence_coverage_insufficient"]);
    assert.deepEqual(validateReplayWindow(third.window), { valid: true, errors: [] });
  });

  it("fails closed before the complete-window fast path when persisted state is invalid", () => {
    const days = naturalDates("2026-08-01", 3).map((reportDate, index) => ({
      report_date: reportDate,
      attempts: [attempt({
        reportDate,
        workflowRunId: 20_000 + index,
        withShadowFormal: index === 0
      })]
    }));
    const completed = buildReplayWindowSequence({
      days,
      expectedBehaviorContractSha256: BEHAVIOR_HASH
    }).current_window;
    const tampered = structuredClone(completed);
    tampered.dates = [];

    assert.equal(validateReplayWindow(tampered).valid, false);
    assert.throws(
      () => advanceReplayWindow({
        window: tampered,
        reportDate: "2026-08-04",
        attempts: [],
        expectedBehaviorContractSha256: BEHAVIOR_HASH
      }),
      /invalid persisted replay window/
    );
  });

  it("seals missing/failure/drift days, blocks same-day reopen, and restarts next day", () => {
    const dayOne = advanceReplayWindow({
      window: null,
      reportDate: "2026-08-01",
      attempts: [attempt({ reportDate: "2026-08-01", workflowRunId: 9501 })],
      expectedBehaviorContractSha256: BEHAVIOR_HASH
    });
    assert.equal(dayOne.window.status, "active");

    const failed = advanceReplayWindow({
      window: dayOne.window,
      reportDate: "2026-08-02",
      attempts: [attempt({
        reportDate: "2026-08-02",
        workflowRunId: 9502,
        behaviorManifest: { "automations/jobs/pre-c5c.mjs": BLOB_A }
      })],
      expectedBehaviorContractSha256: BEHAVIOR_HASH
    });
    assert.equal(failed.window.status, "failed");
    assert.deepEqual(failed.window.failure_reasons, ["behavior_drift"]);

    const sameDay = advanceReplayWindow({
      window: failed.window,
      reportDate: "2026-08-02",
      attempts: [attempt({ reportDate: "2026-08-02", workflowRunId: 9503 })],
      expectedBehaviorContractSha256: BEHAVIOR_HASH
    });
    assert.equal(sameDay.transition, "same_day_reopen_blocked");
    assert.deepEqual(sameDay.window, failed.window);

    const restarted = advanceReplayWindow({
      window: failed.window,
      reportDate: "2026-08-03",
      attempts: [attempt({ reportDate: "2026-08-03", workflowRunId: 9504 })],
      expectedBehaviorContractSha256: BEHAVIOR_HASH
    });
    assert.equal(restarted.transition, "restarted_after_failure");
    assert.equal(restarted.sealed_window.status, "failed");
    assert.equal(restarted.window.status, "active");
    assert.equal(restarted.window.start_date, "2026-08-03");
  });

  it("fails a gap at the missing Shanghai date and never backfills it", () => {
    const result = buildReplayWindowSequence({
      expectedBehaviorContractSha256: BEHAVIOR_HASH,
      days: [
        {
          report_date: "2026-08-10",
          attempts: [attempt({ reportDate: "2026-08-10", workflowRunId: 9601 })]
        },
        {
          report_date: "2026-08-12",
          attempts: [attempt({ reportDate: "2026-08-12", workflowRunId: 9602 })]
        }
      ]
    });
    assert.equal(result.sealed_windows[0].status, "failed");
    assert.equal(result.sealed_windows[0].failure_date, "2026-08-11");
    assert.deepEqual(result.sealed_windows[0].failure_reasons, ["missing_date"]);
    assert.equal(result.current_window.start_date, "2026-08-12");
  });
});

function attempt({
  reportDate,
  runSlot = "afternoon",
  eventName = "schedule",
  workflowRunId,
  runAttempt = 1,
  healthy = true,
  captureStatus = "complete",
  behaviorManifest = BEHAVIOR_MANIFEST,
  withShadowFormal = false
}) {
  const receipt = {
    report_date: reportDate,
    slot: runSlot,
    event_name: eventName,
    run_id: String(workflowRunId),
    run_attempt: runAttempt,
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
  const report = { report_date: reportDate, push_pool: [], watch_pool: [], drop_pool: [] };
  const sourcingCandidates = { schema_version: 2, report_date: reportDate, candidates: [] };
  const reportBytes = `${JSON.stringify(report, null, 2)}\n`;
  const sourcingCandidatesBytes = `${JSON.stringify(sourcingCandidates, null, 2)}\n`;
  const complete = captureStatus === "complete";
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
    capture_status: captureStatus,
    capture_errors: complete ? [] : [{ stage: "collector", code: "incomplete", message: "fixture" }],
    artifact_bindings: {
      report: binding(
        `data/reports/${reportDate}.json`,
        gitBlobSha(reportBytes),
        sha256Canonical(report),
        0
      ),
      sourcing_candidates: binding(
        `data/sourcing_candidates/${reportDate}.json`,
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
        max_candidates: 320, max_steam_details: 90, new_lane: 40, backlog_lane: 30,
        retry_refresh_lane: 20, snapshot_ttl_days: 7, second_pass_max_candidates: 12,
        actions_per_candidate_min: 1, actions_per_candidate_max: 3,
        provider_request_limit: 12, provider_retry_limit: 0, scheduled_network_budget: 90
      },
      usage: {
        fresh_steam_detail_requests: 0, scheduled_network_requests: 0,
        reused_snapshot_count: 0, provider_requests: 0,
        fresh_steam_detail_candidate_ids: [], scheduled_network_candidate_ids: [],
        reused_snapshot_candidate_ids: [], provider_transaction_ids: []
      }
    },
    discovery_summary: {
      decision_universe_count: withShadowFormal ? 1 : 0,
      sources: withShadowFormal
        ? [{ source_id: "steam", raw_count: 1, retained_count: 1, failure_count: 0 }]
        : []
    },
    evidence_catalog: withShadowFormal ? [evidenceFixture(reportDate)] : [],
    candidates: withShadowFormal ? [candidateFixture(reportDate)] : [],
    second_pass: {
      selector_version: "targeted-v1", max_candidates: 12,
      eligible_ids: [], selected_ids: [], omitted_ids: [], attempted_ids: [],
      failed_ids: [], qualified_ids: [], transactions: []
    },
    summary: {
      candidate_count: withShadowFormal ? 1 : 0,
      evidence_count: withShadowFormal ? 1 : 0,
      second_pass_eligible_count: 0,
      second_pass_selected_count: 0, second_pass_attempted_count: 0,
      second_pass_failed_count: 0, second_pass_qualified_count: 0,
      formal_count: withShadowFormal ? 1 : 0,
      candidate_decision_count: 0, excluded_count: 0,
      shadow_push_pool_count: withShadowFormal ? 1 : 0
    },
    integrity: {
      canonical_json_version: 1, payload_sha256: "0".repeat(64),
      ordered_candidate_count: withShadowFormal ? 1 : 0,
      ordered_evidence_count: withShadowFormal ? 1 : 0,
      artifact_binding_count: 4,
      byte_size: 0, inline_text_characters: 0,
      status: captureStatus,
      reason_codes: complete ? [] : ["capture_error"]
    }
  };
  corpus.artifact_bindings.replay_corpus.record_count = corpus.candidates.length;
  sealCorpus(corpus);
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
    artifactMetadata
  };
}

function candidateFixture(reportDate) {
  const indieInput = qualifiedIndieInput();
  const chinaInput = {};
  return {
    candidate_id: "steam:100",
    project: "Game One",
    steam_app_id: "100",
    dedupe_key: "steam:100",
    source_type: "steam",
    source_lane: "regular",
    origin_signal_ids: ["signal:steam:100"],
    first_seen: reportDate,
    last_seen: reportDate,
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
      source_type: "steam",
      publication_order: { source_priority: 1, source_index: 0 }
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
        output: evaluateV73IndiePrelaunchAdmission(indieInput),
        gate_results: [{
          gate_id: "identity_and_dedupe",
          status: "pass",
          hard_exclusion: false,
          evidence_ids: ["evidence:one"]
        }]
      },
      china_joint: {
        input: chinaInput,
        output: evaluateChinaJointAdmission(chinaInput),
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

function evidenceFixture(reportDate) {
  return {
    evidence_id: "evidence:one",
    evidence_type: "public_url",
    gate_id: "identity_and_dedupe",
    url: "https://store.steampowered.com/app/100/",
    source_id: "store.steampowered.com",
    source_role: "official",
    evidence_family: "playability",
    captured_at: `${reportDate}T15:00:00+08:00`,
    title: "Game One",
    normalized_summary: "Normalized public evidence.",
    content_sha256: SHA_A,
    source_status: "success",
    fetch_error: null,
    official_public_business_entry: false
  };
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

function binding(path, gitBlobShaValue, payloadSha256, recordCount) {
  return {
    path, git_blob_sha: gitBlobShaValue, payload_sha256: payloadSha256,
    record_count: recordCount, validation_status: "valid"
  };
}

function sealCorpus(corpus) {
  corpus.integrity.payload_sha256 = "0".repeat(64);
  corpus.artifact_bindings.replay_corpus.payload_sha256 = "0".repeat(64);
  for (let index = 0; index < 8; index += 1) {
    const metrics = measureReplayCorpusPayload(corpus);
    if (corpus.integrity.byte_size === metrics.byte_size
      && corpus.integrity.inline_text_characters === metrics.inline_text_characters) break;
    corpus.integrity.byte_size = metrics.byte_size;
    corpus.integrity.inline_text_characters = metrics.inline_text_characters;
  }
  const payloadSha = computeReplayCorpusPayloadSha256(corpus);
  corpus.integrity.payload_sha256 = payloadSha;
  corpus.artifact_bindings.replay_corpus.payload_sha256 = payloadSha;
}

function gitBlobSha(value) {
  const bytes = Buffer.from(value, "utf8");
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

function naturalDates(startDate, count) {
  const dates = [];
  let current = startDate;
  for (let index = 0; index < count; index += 1) {
    dates.push(current);
    current = nextDate(current);
  }
  return dates;
}

function nextDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}
