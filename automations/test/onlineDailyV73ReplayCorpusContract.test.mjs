import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  canonicalJson,
  computeBehaviorContractSha256,
  computeReplayCorpusPayloadSha256,
  computeReplayWindowPayloadSha256,
  measureReplayCorpusPayload,
  measureReplayWindowPayload,
  sha256Canonical,
  validateReplayCorpus,
  validateReplayWindow
} from "../jobs/online_daily_v7_3_replay_corpus_contract.mjs";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const BLOB_A = "1".repeat(40);
const BLOB_B = "2".repeat(40);
const BEHAVIOR_MANIFEST = {
  "automations/jobs/online_daily_v7_3_obtainable_evidence.mjs": BLOB_A,
  "automations/jobs/online_daily_v7_3_regular_admission.mjs": BLOB_B
};
const EVALUATOR_SHA = "d".repeat(64);

describe("Replay Corpus Contract v1 schemas", () => {
  it("declares closed, versioned corpus and window contracts", () => {
    const corpusSchema = readSchema("../../schemas/sourcing_replay_corpus.schema.json");
    const windowSchema = readSchema("../../schemas/sourcing_replay_window.schema.json");

    assert.equal(corpusSchema.additionalProperties, false);
    assert.equal(corpusSchema.properties.contract_version.const, 1);
    assert.deepEqual(corpusSchema.properties.capture_status.enum, [
      "complete",
      "incomplete",
      "corrupt",
      "unreplayable"
    ]);
    assert.equal(windowSchema.additionalProperties, false);
    assert.equal(windowSchema.properties.contract_version.const, 1);
    assert.deepEqual(windowSchema.properties.status.enum, ["active", "failed", "complete"]);
    assert.ok(windowSchema.$defs.dateEntry.required.includes("replay_binding"));
    assert.equal(
      windowSchema.$defs.replayBinding.properties.engine_contract_version.const,
      1
    );
    const activeState = windowSchema.allOf.find((branch) => (
      branch.if?.properties?.status?.const === "active"
    ));
    const failedState = windowSchema.allOf.find((branch) => (
      branch.if?.properties?.status?.const === "failed"
    ));
    assert.equal(activeState.then.properties.dates.minItems, 1);
    assert.equal(activeState.then.properties.dates.maxItems, 14);
    assert.equal(
      activeState.then.properties.integrity.properties.reason_codes.maxItems,
      0
    );
    assert.equal(failedState.then.properties.dates.maxItems, 14);
  });

  it("allows the replay corpus self binding to defer its Git blob SHA", () => {
    const corpusSchema = readSchema("../../schemas/sourcing_replay_corpus.schema.json");
    const replayBindingRef =
      corpusSchema.$defs.artifactBindings.properties.replay_corpus.$ref;

    assert.equal(replayBindingRef, "#/$defs/replayCorpusArtifactBinding");
    assert.deepEqual(
      corpusSchema.$defs.replayCorpusArtifactBinding.properties.git_blob_sha.oneOf,
      [{ $ref: "#/$defs/gitSha" }, { type: "null" }]
    );
  });

  it("models requested actions as closed gate/action records", () => {
    const corpusSchema = readSchema("../../schemas/sourcing_replay_corpus.schema.json");
    const requestedActionItems =
      corpusSchema.$defs.transaction.properties.requested_actions.items;
    const requestedAction = corpusSchema.$defs.requestedAction;

    assert.equal(requestedActionItems.$ref, "#/$defs/requestedAction");
    assert.equal(requestedAction.type, "object");
    assert.deepEqual(requestedAction.required, ["gate_id", "action"]);
    assert.equal(requestedAction.additionalProperties, false);
    assert.deepEqual(requestedAction.properties.gate_id.enum, [
      "identity_and_dedupe",
      "prelaunch_window",
      "publisher_china_capacity_clear",
      "non_narrative_product",
      "non_india_team",
      "official_playable_or_gameplay",
      "independent_quality_proof",
      "non_steam_business_entry",
      "concrete_china_bilibili_value"
    ]);
    assert.deepEqual(requestedAction.properties.action.enum, [
      "resolve_project_identity",
      "verify_prelaunch_window",
      "verify_publisher_china_capacity",
      "verify_product_focus",
      "verify_team_region",
      "fetch_official_playable_or_gameplay",
      "fetch_independent_quality_evidence",
      "fetch_non_steam_business_entry",
      "research_china_bilibili_value"
    ]);
  });
});

describe("canonical JSON and SHA-256", () => {
  it("sorts object keys recursively while preserving array order", () => {
    const left = {
      z: 3,
      nested: { z: 2, a: 1 },
      array: [{ z: 2, a: 1 }, "second"]
    };
    const right = {
      array: [{ a: 1, z: 2 }, "second"],
      nested: { a: 1, z: 2 },
      z: 3
    };

    assert.equal(canonicalJson(left), canonicalJson(right));
    assert.equal(
      canonicalJson(left),
      "{\"array\":[{\"a\":1,\"z\":2},\"second\"],\"nested\":{\"a\":1,\"z\":2},\"z\":3}"
    );
    assert.notEqual(canonicalJson({ array: [1, 2] }), canonicalJson({ array: [2, 1] }));
    assert.equal(sha256Canonical(left), sha256Canonical(right));
  });

  it("rejects unsupported and non-finite JSON values with stable error codes", () => {
    expectCanonicalError({ value: undefined }, "CANONICAL_UNSUPPORTED_TYPE");
    expectCanonicalError({ value: () => true }, "CANONICAL_UNSUPPORTED_TYPE");
    expectCanonicalError({ value: Number.NaN }, "CANONICAL_NON_FINITE_NUMBER");
    expectCanonicalError({ value: Number.POSITIVE_INFINITY }, "CANONICAL_NON_FINITE_NUMBER");

    const cyclic = {};
    cyclic.self = cyclic;
    expectCanonicalError(cyclic, "CANONICAL_CYCLE");
  });
});

describe("Replay corpus validator", () => {
  it("accepts deterministic complete and explained incomplete fixtures", () => {
    const complete = completeCorpusFixture();
    const first = validateReplayCorpus(complete);
    const second = validateReplayCorpus(structuredClone(complete));
    assert.deepEqual(first, { valid: true, errors: [] });
    assert.deepEqual(second, first);
    assert.equal(computeReplayCorpusPayloadSha256(complete), complete.integrity.payload_sha256);

    const incomplete = incompleteCorpusFixture();
    assert.deepEqual(validateReplayCorpus(incomplete), { valid: true, errors: [] });
  });

  it("rejects missing evidence provenance", () => {
    const corpus = mutateCorpus((value) => {
      delete value.evidence_catalog[1].evidence_family;
    });
    expectInvalid(
      validateReplayCorpus(corpus),
      "SCHEMA_REQUIRED",
      "/evidence_catalog/1/evidence_family"
    );
  });

  it("rejects a missing complete second-pass transaction", () => {
    const corpus = mutateCorpus((value) => {
      value.second_pass.transactions = [];
    });
    expectInvalid(
      validateReplayCorpus(corpus),
      "SECOND_PASS_TRANSACTION_MISSING",
      "/second_pass/attempted_ids/0"
    );
  });

  it("accepts an unavailable self Git blob SHA while preserving payload binding", () => {
    const corpus = mutateCorpus((value) => {
      value.artifact_bindings.replay_corpus.git_blob_sha = null;
    });

    assert.deepEqual(validateReplayCorpus(corpus), { valid: true, errors: [] });
    assert.equal(
      computeReplayCorpusPayloadSha256(corpus),
      corpus.integrity.payload_sha256
    );
  });

  it("accepts structured requested actions and rejects unsupported actions", () => {
    const valid = mutateCorpus((value) => {
      value.second_pass.transactions[0].requested_actions = [
        {
          gate_id: "official_playable_or_gameplay",
          action: "fetch_official_playable_or_gameplay"
        }
      ];
    });
    assert.deepEqual(validateReplayCorpus(valid), { valid: true, errors: [] });

    const invalid = mutateCorpus((value) => {
      value.second_pass.transactions[0].requested_actions = [
        {
          gate_id: "official_playable_or_gameplay",
          action: "fetch_everything"
        }
      ];
    });
    expectInvalid(
      validateReplayCorpus(invalid),
      "SCHEMA_ENUM",
      "/second_pass/transactions/0/requested_actions/0/action"
    );
  });

  it("rejects hard-excluded candidates from every second-pass admission set", () => {
    const corpus = mutateCorpus((value) => {
      Object.assign(
        value.candidates[0].first_pass.indie_prelaunch.gate_results[0],
        {
          status: "fail",
          hard_exclusion: true
        }
      );
    });
    const result = validateReplayCorpus(corpus);

    for (const field of ["eligible_ids", "selected_ids", "attempted_ids"]) {
      expectInvalid(
        result,
        "SECOND_PASS_HARD_EXCLUSION",
        `/second_pass/${field}/0`
      );
    }
  });

  it("binds each attempted transaction reference to the same candidate", () => {
    const corpus = mutateCorpus((value) => {
      addSecondAttemptedCandidate(value);
      value.candidates[0].second_pass.transaction_id = "transaction:two";
      value.candidates[1].second_pass.transaction_id = "transaction:one";
    });
    const result = validateReplayCorpus(corpus);

    expectInvalid(
      result,
      "SECOND_PASS_TRANSACTION_CANDIDATE_MISMATCH",
      "/candidates/0/second_pass/transaction_id"
    );
    expectInvalid(
      result,
      "SECOND_PASS_TRANSACTION_CANDIDATE_MISMATCH",
      "/candidates/1/second_pass/transaction_id"
    );
  });

  it("rejects duplicate candidate, evidence, and transaction identifiers", () => {
    const candidateCorpus = mutateCorpus((value) => {
      value.candidates.push(structuredClone(value.candidates[0]));
      value.summary.candidate_count = 2;
      value.summary.formal_count = 2;
      value.summary.shadow_push_pool_count = 2;
    });
    expectInvalid(
      validateReplayCorpus(candidateCorpus),
      "DUPLICATE_CANDIDATE_ID",
      "/candidates/1/candidate_id"
    );

    const evidenceCorpus = mutateCorpus((value) => {
      value.evidence_catalog.push(structuredClone(value.evidence_catalog[0]));
      value.summary.evidence_count = 4;
    });
    expectInvalid(
      validateReplayCorpus(evidenceCorpus),
      "DUPLICATE_EVIDENCE_ID",
      "/evidence_catalog/3/evidence_id"
    );

    const transactionCorpus = mutateCorpus((value) => {
      value.second_pass.transactions.push(structuredClone(value.second_pass.transactions[0]));
    });
    expectInvalid(
      validateReplayCorpus(transactionCorpus),
      "DUPLICATE_TRANSACTION_ID",
      "/second_pass/transactions/1/transaction_id"
    );
  });

  it("rejects payload and behavior hash mismatches", () => {
    const payloadMismatch = completeCorpusFixture();
    payloadMismatch.integrity.payload_sha256 = "0".repeat(64);
    expectInvalid(
      validateReplayCorpus(payloadMismatch),
      "PAYLOAD_HASH_MISMATCH",
      "/integrity/payload_sha256"
    );

    const behaviorMismatch = completeCorpusFixture();
    behaviorMismatch.behavior_contract_sha256 = "0".repeat(64);
    sealCorpus(behaviorMismatch);
    behaviorMismatch.behavior_contract_sha256 = "0".repeat(64);
    expectInvalid(
      validateReplayCorpus(behaviorMismatch),
      "BEHAVIOR_HASH_MISMATCH",
      "/behavior_contract_sha256"
    );
  });

  it("recursively rejects private, credential, header, raw HTML, and secret URL data", () => {
    const cases = [
      {
        code: "PRIVACY_PRIVATE_LEAD",
        path: "/candidates/0/normalized_candidate/private_notes",
        apply(value) {
          value.candidates[0].normalized_candidate.private_notes = "do not persist";
        }
      },
      {
        code: "PRIVACY_AUTH_HEADER",
        path: "/candidates/0/normalized_candidate/Authorization",
        apply(value) {
          value.candidates[0].normalized_candidate.Authorization = "Bearer redacted";
        }
      },
      {
        code: "PRIVACY_RESPONSE_HEADERS",
        path: "/candidates/0/normalized_candidate/response_headers",
        apply(value) {
          value.candidates[0].normalized_candidate.response_headers = { etag: "private" };
        }
      },
      {
        code: "PRIVACY_RAW_HTML",
        path: "/candidates/0/normalized_candidate/raw_html",
        apply(value) {
          value.candidates[0].normalized_candidate.raw_html = "<html>forbidden</html>";
        }
      },
      {
        code: "PRIVACY_URL_CREDENTIALS",
        path: "/candidates/0/normalized_candidate/source_url",
        apply(value) {
          value.candidates[0].normalized_candidate.source_url =
            "https://username:password@example.test/game";
        }
      },
      {
        code: "PRIVACY_SECRET_QUERY",
        path: "/candidates/0/normalized_candidate/source_url",
        apply(value) {
          value.candidates[0].normalized_candidate.source_url =
            "https://example.test/game?access_token=forbidden";
        }
      }
    ];

    for (const privacyCase of cases) {
      const corpus = mutateCorpus(privacyCase.apply);
      expectInvalid(validateReplayCorpus(corpus), privacyCase.code, privacyCase.path);
    }
  });

  it("rejects count, publication parity, and gate-evidence mismatches", () => {
    const countMismatch = mutateCorpus((value) => {
      value.summary.candidate_count = 2;
    });
    expectInvalid(
      validateReplayCorpus(countMismatch),
      "SUMMARY_CANDIDATE_COUNT_MISMATCH",
      "/summary/candidate_count"
    );

    const parityMismatch = mutateCorpus((value) => {
      value.summary.shadow_push_pool_count = 0;
    });
    expectInvalid(
      validateReplayCorpus(parityMismatch),
      "PUBLICATION_PARITY_MISMATCH",
      "/summary/shadow_push_pool_count"
    );

    const missingEvidence = mutateCorpus((value) => {
      value.candidates[0].first_pass.indie_prelaunch.gate_results[1].evidence_ids = [
        "evidence:missing"
      ];
    });
    expectInvalid(
      validateReplayCorpus(missingEvidence),
      "EVIDENCE_REFERENCE_NOT_FOUND",
      "/candidates/0/first_pass/indie_prelaunch/gate_results/1/evidence_ids/0"
    );
  });

  it("rejects qualified final outputs without two eligible referenced public sources", () => {
    const cases = [
      {
        code: "FINAL_EVIDENCE_REQUIRED",
        path: "/second_pass/transactions/0/final_output/evidence_ids",
        apply(value) {
          delete value.second_pass.transactions[0].final_output.evidence_ids;
        }
      },
      {
        code: "FINAL_EVIDENCE_REQUIRED",
        path: "/second_pass/transactions/0/final_output/evidence_ids",
        apply(value) {
          value.second_pass.transactions[0].final_output.evidence_ids = [];
        }
      },
      {
        code: "EVIDENCE_REFERENCE_NOT_FOUND",
        path: "/second_pass/transactions/0/final_output/evidence_ids/0",
        apply(value) {
          value.second_pass.transactions[0].final_output.evidence_ids = [
            "evidence:missing",
            "evidence:creator"
          ];
        }
      },
      {
        code: "INDEPENDENT_ROLE_FORBIDDEN",
        path: "/second_pass/transactions/0/final_output/evidence_ids/0",
        apply(value) {
          value.second_pass.transactions[0].final_output.evidence_ids = [
            "evidence:official",
            "evidence:creator"
          ];
        }
      },
      {
        code: "INDEPENDENT_SOURCE_COUNT",
        path: "/second_pass/transactions/0/final_output/evidence_ids",
        apply(value) {
          value.evidence_catalog[2].source_id = value.evidence_catalog[1].source_id;
        }
      }
    ];

    for (const finalEvidenceCase of cases) {
      const corpus = mutateCorpus(finalEvidenceCase.apply);
      expectInvalid(
        validateReplayCorpus(corpus),
        finalEvidenceCase.code,
        finalEvidenceCase.path
      );
    }
  });

  it("rejects ineligible independent proof roles and unexplained capture states", () => {
    const ineligibleRole = mutateCorpus((value) => {
      value.evidence_catalog[1].source_role = "official";
    });
    expectInvalid(
      validateReplayCorpus(ineligibleRole),
      "INDEPENDENT_ROLE_FORBIDDEN",
      "/candidates/0/first_pass/indie_prelaunch/gate_results/1/evidence_ids/0"
    );

    const completeWithErrors = mutateCorpus((value) => {
      value.capture_errors.push({
        stage: "collector",
        code: "UNEXPECTED",
        message: "complete cannot contain capture errors"
      });
    });
    expectInvalid(
      validateReplayCorpus(completeWithErrors),
      "COMPLETE_CAPTURE_ERRORS",
      "/capture_errors"
    );

    const unexplainedIncomplete = mutateCorpus((value) => {
      value.capture_status = "incomplete";
      value.capture_errors = [];
      value.integrity.status = "incomplete";
      value.integrity.reason_codes = [];
    });
    expectInvalid(
      validateReplayCorpus(unexplainedIncomplete),
      "CAPTURE_REASON_REQUIRED",
      "/capture_errors"
    );
  });

  it("does not count reused snapshots as fresh or scheduled network requests", () => {
    const corpus = mutateCorpus((value) => {
      value.candidates[0].snapshot_status = "reused";
      value.candidates[0].evidence_freshness = "reused";
      value.budgets.usage.reused_snapshot_candidate_ids = ["candidate:one"];
      value.budgets.usage.reused_snapshot_count = 1;
    });
    expectInvalid(
      validateReplayCorpus(corpus),
      "REUSED_SNAPSHOT_COUNTED_FRESH",
      "/budgets/usage/fresh_steam_detail_candidate_ids/0"
    );
  });
});

describe("Replay window validator", () => {
  it("accepts a complete 15-day window and an explained failed partial window", () => {
    const complete = completeWindowFixture();
    assert.deepEqual(validateReplayWindow(complete), { valid: true, errors: [] });
    assert.equal(computeReplayWindowPayloadSha256(complete), complete.integrity.payload_sha256);

    const failed = failedWindowFixture();
    assert.deepEqual(validateReplayWindow(failed), { valid: true, errors: [] });
  });

  it("rejects complete windows with fewer than 15 days or a date gap", () => {
    const shortWindow = mutateWindow((value) => {
      value.dates.pop();
    });
    expectInvalid(
      validateReplayWindow(shortWindow),
      "WINDOW_COMPLETE_DATE_COUNT",
      "/dates"
    );

    const gappedWindow = mutateWindow((value) => {
      value.dates[7].report_date = "2026-07-20";
    });
    expectInvalid(
      validateReplayWindow(gappedWindow),
      "WINDOW_DATE_GAP",
      "/dates/7/report_date"
    );
  });

  it("rejects impossible active windows and binds active boundaries to retained dates", () => {
    const emptyActive = completeWindowFixture();
    Object.assign(emptyActive, {
      status: "active",
      start_date: "2026-07-01",
      end_date: "2026-07-14",
      dates: [],
      failure_date: null,
      failure_reasons: []
    });
    emptyActive.integrity.status = "incomplete";
    emptyActive.integrity.reason_codes = ["behavior_drift"];
    sealWindow(emptyActive);
    expectInvalid(
      validateReplayWindow(emptyActive),
      "WINDOW_ACTIVE_DATE_COUNT",
      "/dates"
    );
    expectInvalid(
      validateReplayWindow(emptyActive),
      "WINDOW_ACTIVE_INTEGRITY_REASONS",
      "/integrity/reason_codes"
    );

    const mismatchedBoundaries = completeWindowFixture();
    Object.assign(mismatchedBoundaries, {
      status: "active",
      start_date: "2026-07-02",
      end_date: "2026-07-14",
      dates: mismatchedBoundaries.dates.slice(0, 2),
      failure_date: null,
      failure_reasons: []
    });
    mismatchedBoundaries.integrity.status = "incomplete";
    mismatchedBoundaries.integrity.reason_codes = [];
    sealWindow(mismatchedBoundaries);
    expectInvalid(
      validateReplayWindow(mismatchedBoundaries),
      "WINDOW_START_DATE_MISMATCH",
      "/start_date"
    );
    expectInvalid(
      validateReplayWindow(mismatchedBoundaries),
      "WINDOW_END_DATE_MISMATCH",
      "/end_date"
    );
  });

  it("requires failed end-date, failure-date, and integrity-reason parity", () => {
    const endMismatch = failedWindowFixture();
    endMismatch.end_date = "2026-07-09";
    sealWindow(endMismatch);
    expectInvalid(
      validateReplayWindow(endMismatch),
      "WINDOW_FAILED_END_DATE_MISMATCH",
      "/end_date"
    );

    const reasonMismatch = failedWindowFixture();
    reasonMismatch.integrity.reason_codes = ["behavior_drift"];
    sealWindow(reasonMismatch);
    expectInvalid(
      validateReplayWindow(reasonMismatch),
      "WINDOW_FAILURE_REASON_PARITY",
      "/integrity/reason_codes"
    );
  });

  it("rejects a complete window containing a non-canonical retained date", () => {
    const windowManifest = mutateWindow((value) => {
      value.dates[7].canonical = false;
      value.dates[7].capture_status = "corrupt";
      value.dates[7].receipt_binding.generation_status = "failed";
      value.dates[7].receipt_binding.validation_status = "failed";
      value.dates[7].receipt_binding.receipt_status = "failed";
      value.dates[7].receipt_binding.synced = false;
    });

    expectInvalid(
      validateReplayWindow(windowManifest),
      "WINDOW_NON_CANONICAL_DATE",
      "/dates/7/canonical"
    );
  });

  it("rejects duplicate dates, behavior drift, and manual-only canonical runs", () => {
    const duplicateDate = mutateWindow((value) => {
      value.dates[7].report_date = value.dates[6].report_date;
    });
    expectInvalid(
      validateReplayWindow(duplicateDate),
      "WINDOW_DUPLICATE_DATE",
      "/dates/7/report_date"
    );

    const drift = mutateWindow((value) => {
      value.dates[7].behavior_contract_sha256 = SHA_C;
    });
    expectInvalid(
      validateReplayWindow(drift),
      "WINDOW_BEHAVIOR_DRIFT",
      "/dates/7/behavior_contract_sha256"
    );

    const manual = mutateWindow((value) => {
      Object.assign(value.dates[7], {
        event_name: "workflow_dispatch",
        run_slot: "manual",
        manual_only: true,
        canonical: true
      });
    });
    expectInvalid(
      validateReplayWindow(manual),
      "WINDOW_MANUAL_CANONICAL",
      "/dates/7/canonical"
    );
  });

  it("rejects a window payload hash mismatch", () => {
    const windowManifest = completeWindowFixture();
    windowManifest.integrity.payload_sha256 = "0".repeat(64);
    expectInvalid(
      validateReplayWindow(windowManifest),
      "PAYLOAD_HASH_MISMATCH",
      "/integrity/payload_sha256"
    );
  });

  it("rejects a retained date without a deterministic replay match", () => {
    const missingBinding = mutateWindow((value) => {
      delete value.dates[7].replay_binding;
    });
    expectInvalid(
      validateReplayWindow(missingBinding),
      "SCHEMA_REQUIRED",
      "/dates/7/replay_binding"
    );

    const mismatch = mutateWindow((value) => {
      value.dates[7].replay_binding.deterministic = false;
      value.dates[7].replay_binding.status = "mismatch";
      value.dates[7].replay_binding.replayed_decision_sha256 = SHA_B;
    });
    expectInvalid(
      validateReplayWindow(mismatch),
      "WINDOW_REPLAY_NON_DETERMINISTIC",
      "/dates/7/replay_binding/deterministic"
    );
    expectInvalid(
      validateReplayWindow(mismatch),
      "WINDOW_REPLAY_MISMATCH",
      "/dates/7/replay_binding/status"
    );
  });
});

function readSchema(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

function expectCanonicalError(value, code) {
  assert.throws(
    () => canonicalJson(value),
    (error) => error && error.code === code
  );
}

function expectInvalid(result, code, path) {
  assert.equal(result.valid, false, `expected ${code} at ${path}`);
  assert.ok(
    result.errors.some((error) => error.code === code && error.path === path),
    `missing ${code} at ${path}; received ${JSON.stringify(result.errors)}`
  );
}

function mutateCorpus(mutator) {
  const value = completeCorpusFixture();
  mutator(value);
  return sealCorpus(value);
}

function mutateWindow(mutator) {
  const value = completeWindowFixture();
  mutator(value);
  return sealWindow(value);
}

function completeCorpusFixture() {
  const corpus = {
    contract_version: 1,
    corpus_id: "2026-07-30/9001/1/afternoon",
    report_date: "2026-07-30",
    timezone: "Asia/Shanghai",
    captured_at: "2026-07-30T15:05:00+08:00",
    event_name: "schedule",
    run_slot: "afternoon",
    workflow_run_id: 9001,
    run_attempt: 1,
    run_url: "https://github.com/Neo0109/CRM/actions/runs/9001",
    input_commit_sha: BLOB_A,
    node_version: "22.17",
    active_production_rule_version: "sourcing-v7.2-china-joint",
    shadow_rule_version: "sourcing-rules-v7.3-obtainable-evidence",
    collector_contract_version: 1,
    behavior_manifest: structuredClone(BEHAVIOR_MANIFEST),
    behavior_contract_sha256: "",
    capture_status: "complete",
    capture_errors: [],
    artifact_bindings: {
      report: binding("data/daily_reports/2026-07-30.json", BLOB_A, SHA_A, 1),
      sourcing_candidates: binding("data/sourcing_candidates/2026-07-30.json", BLOB_B, SHA_B, 1),
      replay_corpus: binding(
        "data/sourcing_replay_corpus/2026-07-30/9001-1-afternoon.json",
        null,
        "0".repeat(64),
        1
      ),
      receipt: binding("data/automation_runs/2026-07-30-afternoon.json", BLOB_B, SHA_C, 1)
    },
    delivery_health: {
      generation_status: "success",
      validation_status: "success",
      receipt_status: "success",
      sync_response: { synced: true },
      source_health_status: "healthy",
      failure_stage: null
    },
    budgets: {
      limits: {
        max_candidates: 280,
        max_steam_details: 60,
        new_lane: 20,
        backlog_lane: 20,
        retry_refresh_lane: 20,
        snapshot_ttl_days: 7,
        second_pass_max_candidates: 12,
        actions_per_candidate_min: 1,
        actions_per_candidate_max: 3,
        provider_request_limit: 12,
        provider_retry_limit: 0,
        scheduled_network_budget: 60
      },
      usage: {
        fresh_steam_detail_requests: 1,
        scheduled_network_requests: 1,
        reused_snapshot_count: 0,
        provider_requests: 1,
        fresh_steam_detail_candidate_ids: ["candidate:one"],
        scheduled_network_candidate_ids: ["candidate:one"],
        reused_snapshot_candidate_ids: [],
        provider_transaction_ids: ["transaction:one"]
      }
    },
    discovery_summary: {
      decision_universe_count: 1,
      sources: [
        {
          source_id: "steam",
          raw_count: 1,
          retained_count: 1,
          failure_count: 0
        }
      ]
    },
    evidence_catalog: [
      evidence({
        id: "evidence:official",
        gate: "official_product",
        role: "official",
        family: "playability",
        url: "https://store.steampowered.com/app/100/"
      }),
      evidence({
        id: "evidence:media",
        gate: "independent_quality_proof",
        role: "media",
        family: "external_validation",
        url: "https://media.example.test/review/game-one"
      }),
      evidence({
        id: "evidence:creator",
        gate: "independent_quality_proof",
        role: "trusted_creator",
        family: "user_feedback",
        url: "https://creator.example.test/video/game-one"
      })
    ],
    candidates: [candidateFixture()],
    second_pass: {
      selector_version: "targeted-v1",
      max_candidates: 12,
      eligible_ids: ["candidate:one"],
      selected_ids: ["candidate:one"],
      omitted_ids: [],
      attempted_ids: ["candidate:one"],
      failed_ids: [],
      qualified_ids: ["candidate:one"],
      transactions: [transactionFixture()]
    },
    summary: {
      candidate_count: 1,
      evidence_count: 3,
      second_pass_eligible_count: 1,
      second_pass_selected_count: 1,
      second_pass_attempted_count: 1,
      second_pass_failed_count: 0,
      second_pass_qualified_count: 1,
      formal_count: 1,
      candidate_decision_count: 0,
      excluded_count: 0,
      shadow_push_pool_count: 1
    },
    integrity: {
      canonical_json_version: 1,
      payload_sha256: "0".repeat(64),
      ordered_candidate_count: 1,
      ordered_evidence_count: 3,
      artifact_binding_count: 4,
      byte_size: 0,
      inline_text_characters: 0,
      status: "complete",
      reason_codes: []
    }
  };

  return sealCorpus(corpus);
}

function incompleteCorpusFixture() {
  return mutateCorpus((value) => {
    value.capture_status = "incomplete";
    value.capture_errors = [
      {
        stage: "collector",
        code: "ARTIFACT_TOO_LARGE",
        message: "Normalized decision input exceeded the contract byte budget."
      }
    ];
    value.integrity.status = "incomplete";
    value.integrity.reason_codes = ["capture_error"];
  });
}

function candidateFixture() {
  return {
    candidate_id: "candidate:one",
    project: "Game One",
    steam_app_id: "100",
    dedupe_key: "steam:100",
    source_type: "multi_source",
    source_lane: "regular",
    origin_signal_ids: ["signal:steam:100", "signal:media:100"],
    first_seen: "2026-07-29",
    last_seen: "2026-07-30",
    scheduler_lane: "new",
    enrichment_status: "success",
    enrichment_attempts: 1,
    snapshot_status: "fresh_success",
    evidence_freshness: "fresh",
    normalized_candidate: {
      title: "Game One",
      release_state: "prelaunch",
      official_demo: true
    },
    discovery_score: 77,
    ranking_inputs: { source_weight: 2, freshness: 1 },
    qualification_affected_by_ranking: false,
    dedupe_boundary: {
      history_match: false,
      crm_preexisting_match: false,
      match_basis: "none",
      audit_digest: SHA_A
    },
    first_pass: {
      evaluator_dependency_sha256: EVALUATOR_SHA,
      indie_prelaunch: {
        input: { release_state: "prelaunch", quality_proof_count: 2 },
        output: { qualified: true, disposition: "formal" },
        gate_results: [
          {
            gate_id: "official_product",
            status: "pass",
            hard_exclusion: false,
            evidence_ids: ["evidence:official"]
          },
          {
            gate_id: "independent_quality_proof",
            status: "pass",
            hard_exclusion: false,
            evidence_ids: ["evidence:media", "evidence:creator"]
          }
        ]
      },
      china_joint: {
        input: { current_china_demand: false },
        output: { qualified: false, disposition: "candidate" },
        gate_results: [
          {
            gate_id: "china_joint",
            status: "fail",
            hard_exclusion: false,
            evidence_ids: ["evidence:media"]
          }
        ]
      },
      regular_selection: {
        status: "selected",
        lane: "indie_prelaunch",
        reason_code: "indie_qualified"
      }
    },
    second_pass: {
      eligible: true,
      rejection_reason: null,
      selected: true,
      attempted: true,
      transaction_id: "transaction:one"
    },
    publication: {
      decision: "formal",
      selected_lane: "indie_prelaunch",
      shadow_push_pool: true,
      dedupe_suppressed: false,
      shadow_lead_payload_sha256: SHA_B,
      risk_flags: [],
      day_lead_count_used: false
    }
  };
}

function addSecondAttemptedCandidate(value) {
  const candidate = structuredClone(value.candidates[0]);
  candidate.candidate_id = "candidate:two";
  candidate.project = "Game Two";
  candidate.steam_app_id = "200";
  candidate.dedupe_key = "steam:200";
  candidate.origin_signal_ids = ["signal:steam:200", "signal:media:200"];
  candidate.dedupe_boundary.audit_digest = SHA_B;
  candidate.second_pass.transaction_id = "transaction:two";
  value.candidates.push(candidate);

  for (const field of ["eligible_ids", "selected_ids", "attempted_ids", "qualified_ids"]) {
    value.second_pass[field].push("candidate:two");
  }

  const transaction = structuredClone(value.second_pass.transactions[0]);
  transaction.transaction_id = "transaction:two";
  transaction.candidate_id = "candidate:two";
  value.second_pass.transactions.push(transaction);

  value.budgets.usage.provider_requests = 2;
  value.budgets.usage.provider_transaction_ids.push("transaction:two");
  value.artifact_bindings.replay_corpus.record_count = 2;
  value.discovery_summary.decision_universe_count = 2;
  value.discovery_summary.sources[0].raw_count = 2;
  value.discovery_summary.sources[0].retained_count = 2;
  value.summary.candidate_count = 2;
  value.summary.second_pass_eligible_count = 2;
  value.summary.second_pass_selected_count = 2;
  value.summary.second_pass_attempted_count = 2;
  value.summary.second_pass_qualified_count = 2;
  value.summary.formal_count = 2;
  value.summary.shadow_push_pool_count = 2;
}

function transactionFixture() {
  return {
    transaction_id: "transaction:one",
    candidate_id: "candidate:one",
    requested_actions: [
      {
        gate_id: "official_playable_or_gameplay",
        action: "fetch_official_playable_or_gameplay"
      }
    ],
    allowlisted_patch_fields: ["official_gameplay_evidence"],
    bounded_signals: [{ source_id: "steam:100", title: "Official gameplay" }],
    provider_contract_version: "public-second-pass-v1",
    request_metrics: { request_count: 1, retry_count: 0 },
    raw_provider_result: { official_gameplay_evidence: ["evidence:official"] },
    filtered_patch: { official_gameplay_evidence: ["evidence:official"] },
    provider_status: "success",
    error: null,
    merged_final_input: { official_gameplay: true },
    final_output: {
      qualified: true,
      disposition: "formal",
      evidence_ids: ["evidence:media", "evidence:creator"]
    },
    decision_changed: true,
    changed_gate: "official_product",
    evaluator_dependency_sha256: EVALUATOR_SHA
  };
}

function evidence({ id, gate, role, family, url }) {
  return {
    evidence_id: id,
    evidence_type: "public_url",
    gate_id: gate,
    url,
    source_id: new URL(url).hostname,
    source_role: role,
    evidence_family: family,
    captured_at: "2026-07-30T15:00:00+08:00",
    title: `Public evidence ${id}`,
    normalized_summary: `Normalized bounded public evidence for ${id}.`,
    content_sha256: SHA_A,
    source_status: "success",
    fetch_error: null,
    official_public_business_entry: false
  };
}

function binding(path, gitBlobSha, payloadSha256, recordCount) {
  return {
    path,
    git_blob_sha: gitBlobSha,
    payload_sha256: payloadSha256,
    record_count: recordCount,
    validation_status: "valid"
  };
}

function sealCorpus(corpus) {
  corpus.behavior_contract_sha256 = computeBehaviorContractSha256(corpus.behavior_manifest);
  corpus.integrity.ordered_candidate_count = corpus.candidates.length;
  corpus.integrity.ordered_evidence_count = corpus.evidence_catalog.length;
  corpus.integrity.artifact_binding_count = Object.keys(corpus.artifact_bindings).length;
  corpus.integrity.payload_sha256 = "0".repeat(64);
  corpus.artifact_bindings.replay_corpus.payload_sha256 = "0".repeat(64);

  stabilizeMetrics(corpus, measureReplayCorpusPayload);

  const payloadSha256 = computeReplayCorpusPayloadSha256(corpus);
  corpus.integrity.payload_sha256 = payloadSha256;
  corpus.artifact_bindings.replay_corpus.payload_sha256 = payloadSha256;
  return corpus;
}

function completeWindowFixture() {
  const behaviorHash = computeBehaviorContractSha256(BEHAVIOR_MANIFEST);
  const dates = Array.from({ length: 15 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return {
      report_date: `2026-07-${day}`,
      corpus_id: `2026-07-${day}/900${day}/1/afternoon`,
      event_name: "schedule",
      run_slot: "afternoon",
      canonical: true,
      manual_only: false,
      capture_status: "complete",
      corpus_contract_version: 1,
      behavior_contract_sha256: behaviorHash,
      corpus_path: `data/sourcing_replay_corpus/2026-07-${day}/900${day}-1-afternoon.json`,
      git_blob_sha: BLOB_A,
      payload_sha256: SHA_A,
      receipt_binding: {
        path: `data/automation_runs/2026-07-${day}-afternoon.json`,
        git_blob_sha: BLOB_B,
        payload_sha256: SHA_B,
        generation_status: "success",
        validation_status: "success",
        receipt_status: "success",
        synced: true
      },
      replay_binding: {
        engine_contract_version: 1,
        input_corpus_payload_sha256: SHA_A,
        expected_decision_sha256: SHA_C,
        replayed_decision_sha256: SHA_C,
        deterministic: true,
        status: "match"
      }
    };
  });

  return sealWindow({
    contract_version: 1,
    window_id: "2026-07-01_2026-07-15",
    timezone: "Asia/Shanghai",
    start_date: "2026-07-01",
    end_date: "2026-07-15",
    status: "complete",
    corpus_contract_version: 1,
    behavior_contract_sha256: behaviorHash,
    dates,
    failure_date: null,
    failure_reasons: [],
    rejected_attempts: [],
    integrity: {
      canonical_json_version: 1,
      payload_sha256: "0".repeat(64),
      byte_size: 0,
      inline_text_characters: 0,
      status: "complete",
      reason_codes: []
    }
  });
}

function failedWindowFixture() {
  const value = completeWindowFixture();
  value.status = "failed";
  value.end_date = "2026-07-08";
  value.dates = value.dates.slice(0, 7);
  value.failure_date = "2026-07-08";
  value.failure_reasons = ["missing_date"];
  value.integrity.status = "incomplete";
  value.integrity.reason_codes = ["missing_date"];
  return sealWindow(value);
}

function sealWindow(windowManifest) {
  windowManifest.integrity.payload_sha256 = "0".repeat(64);
  stabilizeMetrics(windowManifest, measureReplayWindowPayload);
  windowManifest.integrity.payload_sha256 =
    computeReplayWindowPayloadSha256(windowManifest);
  return windowManifest;
}

function stabilizeMetrics(value, measure) {
  for (let index = 0; index < 8; index += 1) {
    const metrics = measure(value);
    if (
      value.integrity.byte_size === metrics.byte_size
      && value.integrity.inline_text_characters === metrics.inline_text_characters
    ) {
      return;
    }
    value.integrity.byte_size = metrics.byte_size;
    value.integrity.inline_text_characters = metrics.inline_text_characters;
  }
}
