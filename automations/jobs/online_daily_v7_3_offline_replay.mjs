import { createHash } from "node:crypto";

import {
  canonicalJson,
  computeReplayCorpusPayloadSha256,
  sha256Canonical,
  validateReplayCorpus
} from "./online_daily_v7_3_replay_corpus_contract.mjs";

export const C5C_REPLAY_ENGINE_CONTRACT_VERSION = 1;
const V73_OBTAINABLE_EVIDENCE_RULE_VERSION =
  "sourcing-rules-v7.3-obtainable-evidence";
const CHINA_JOINT_RULE_VERSION = "sourcing-rules-v7.2-china-joint";

const SUPPORTED_SECOND_PASS_ACTIONS = new Set([
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

export class OfflineReplayError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "OfflineReplayError";
    this.code = code;
    this.details = details;
  }
}

export function replayOfflineCorpus({
  corpusBytes,
  receiptBytes,
  artifactMetadata,
  expectedBehaviorContractSha256
} = {}) {
  const corpusBuffer = explicitBytes(corpusBytes, "corpusBytes");
  const receiptBuffer = explicitBytes(receiptBytes, "receiptBytes");
  const corpus = parseJsonBytes(corpusBuffer, "CORPUS_PARSE_ERROR");
  const receipt = parseJsonBytes(receiptBuffer, "RECEIPT_PARSE_ERROR");
  const validation = validateReplayCorpus(corpus);
  if (!validation.valid) {
    throw new OfflineReplayError(
      "CORPUS_CONTRACT_INVALID",
      "replay corpus failed its frozen contract",
      validation.errors
    );
  }
  if (
    !isSha256(expectedBehaviorContractSha256)
    || corpus.behavior_contract_sha256 !== expectedBehaviorContractSha256
  ) {
    throw new OfflineReplayError(
      "BEHAVIOR_DRIFT",
      "replay corpus behavior hash does not match the frozen C5-C hash"
    );
  }

  const inputCorpusPayloadSha256 = computeReplayCorpusPayloadSha256(corpus);
  verifyArtifactBindings({
    corpus,
    receipt,
    corpusBuffer,
    receiptBuffer,
    artifactMetadata,
    inputCorpusPayloadSha256
  });
  verifyHealthyReceipt(corpus, receipt);

  const storedDecision = buildStoredDecisionView(corpus);
  const replayedDecisionFirst = buildReplayedDecisionView(corpus);
  const replayedDecisionSecond = buildReplayedDecisionView(corpus);
  const expectedDecisionSha256 = sha256Canonical(storedDecision);
  const replayedDecisionSha256 = sha256Canonical(replayedDecisionFirst);
  const secondReplaySha256 = sha256Canonical(replayedDecisionSecond);
  const deterministic = replayedDecisionSha256 === secondReplaySha256;
  if (!deterministic) {
    throw new OfflineReplayError(
      "NON_DETERMINISTIC_REPLAY",
      "identical replay input produced different canonical decision hashes"
    );
  }
  if (expectedDecisionSha256 !== replayedDecisionSha256) {
    throw new OfflineReplayError(
      "REPLAY_MISMATCH",
      "stored and replayed decision views do not match",
      { expected_decision_sha256: expectedDecisionSha256, replayed_decision_sha256: replayedDecisionSha256 }
    );
  }

  return {
    engine_contract_version: C5C_REPLAY_ENGINE_CONTRACT_VERSION,
    input_corpus_payload_sha256: inputCorpusPayloadSha256,
    expected_decision_sha256: expectedDecisionSha256,
    replayed_decision_sha256: replayedDecisionSha256,
    deterministic,
    status: "match",
    corpus,
    receipt
  };
}

export function buildStoredDecisionView(corpus = {}) {
  const transactions = transactionIndex(corpus);
  return {
    engine_contract_version: C5C_REPLAY_ENGINE_CONTRACT_VERSION,
    corpus_contract_version: corpus.contract_version ?? null,
    corpus_id: corpus.corpus_id ?? null,
    behavior_contract_sha256: corpus.behavior_contract_sha256 ?? null,
    candidates: (corpus.candidates ?? []).map((candidate) => {
      const transaction = transactions.get(candidate?.second_pass?.transaction_id) ?? null;
      return {
        candidate_id: candidate?.candidate_id ?? null,
        first_pass: {
          indie_prelaunch: {
            output: decisionOutput(candidate?.first_pass?.indie_prelaunch?.output)
          },
          china_joint: {
            output: decisionOutput(candidate?.first_pass?.china_joint?.output)
          },
          regular_selection: regularSelectionView(
            candidate?.first_pass?.regular_selection
          )
        },
        second_pass: secondPassCandidateView(candidate?.second_pass),
        final_output: transaction ? decisionOutput(transaction.final_output) : null,
        publication: publicationView(candidate?.publication)
      };
    }),
    second_pass: secondPassRunView(corpus.second_pass),
    summary: summaryView(corpus.summary)
  };
}

export function buildReplayedDecisionView(corpus = {}) {
  const transactions = transactionIndex(corpus);
  const candidates = (corpus.candidates ?? []).map((candidate) => {
    const indie = replayLaneOutput(
      candidate?.first_pass?.indie_prelaunch,
      "indie_prelaunch"
    );
    const china = replayLaneOutput(candidate?.first_pass?.china_joint, "china_joint");
    const selected = selectRegular(indie, china);
    const transaction = transactions.get(candidate?.second_pass?.transaction_id) ?? null;
    const finalIndie = transaction
      ? replayLaneOutput(
          { gate_results: transaction.final_output?.gate_results ?? [] },
          "indie_prelaunch"
        )
      : indie;
    const finalSelected = selectRegular(finalIndie, china);
    return {
      candidate_id: candidate?.candidate_id ?? null,
      ranking_inputs: {
        action_count: Array.isArray(indie.next_evidence_actions)
          ? indie.next_evidence_actions.length
          : 0,
        discovery_score: finiteNumber(candidate?.ranking_inputs?.discovery_score),
        dedupe_key: String(candidate?.ranking_inputs?.dedupe_key ?? candidate?.candidate_id ?? ""),
        source_type: String(candidate?.ranking_inputs?.source_type ?? "")
      },
      eligible: secondPassEligible(indie),
      transaction,
      first_pass: {
        indie_prelaunch: { output: decisionOutput(indie) },
        china_joint: { output: decisionOutput(china) },
        regular_selection: regularSelection(selected)
      },
      final_output: transaction ? decisionOutput(finalIndie) : null,
      final_selected: finalSelected,
      captured_publication: candidate?.publication ?? {}
    };
  });

  const rankedEligible = candidates
    .filter((candidate) => candidate.eligible)
    .sort((left, right) => (
      left.ranking_inputs.action_count - right.ranking_inputs.action_count
      || right.ranking_inputs.discovery_score - left.ranking_inputs.discovery_score
      || left.ranking_inputs.dedupe_key.localeCompare(right.ranking_inputs.dedupe_key)
      || left.ranking_inputs.source_type.localeCompare(right.ranking_inputs.source_type)
    ));
  const eligibleIds = rankedEligible.map((candidate) => candidate.candidate_id);
  const maxCandidates = nonNegativeInteger(corpus.second_pass?.max_candidates);
  const selectedIds = eligibleIds.slice(0, maxCandidates);
  const selected = new Set(selectedIds);
  const attemptedIds = candidates
    .filter((candidate) => selected.has(candidate.candidate_id) && candidate.transaction)
    .map((candidate) => candidate.candidate_id);
  const failedIds = candidates
    .filter((candidate) => (
      selected.has(candidate.candidate_id)
      && ["error", "timeout"].includes(candidate.transaction?.provider_status)
    ))
    .map((candidate) => candidate.candidate_id);
  const qualifiedIds = candidates
    .filter((candidate) => (
      selected.has(candidate.candidate_id)
      && candidate.transaction
      && candidate.final_selected?.qualified === true
    ))
    .map((candidate) => candidate.candidate_id);

  const replayedCandidates = candidates.map((candidate) => {
    const isSelected = selected.has(candidate.candidate_id);
    const attempted = attemptedIds.includes(candidate.candidate_id);
    return {
      candidate_id: candidate.candidate_id,
      first_pass: candidate.first_pass,
      second_pass: {
        eligible: candidate.eligible,
        rejection_reason: candidate.eligible
          ? isSelected ? null : "budget_omitted"
          : secondPassRejection(
              replayLaneOutput(
                (corpus.candidates ?? []).find(
                  (item) => item?.candidate_id === candidate.candidate_id
                )?.first_pass?.indie_prelaunch,
                "indie_prelaunch"
              )
            ),
        selected: isSelected,
        attempted,
        transaction_id: attempted ? candidate.transaction?.transaction_id ?? null : null
      },
      final_output: candidate.final_output,
      publication: replayedPublication(
        candidate.final_selected,
        candidate.captured_publication
      )
    };
  });
  const secondPass = {
    selector_version: String(corpus.second_pass?.selector_version ?? ""),
    max_candidates: maxCandidates,
    eligible_ids: eligibleIds,
    selected_ids: selectedIds,
    omitted_ids: eligibleIds.filter((candidateId) => !selected.has(candidateId)),
    attempted_ids: attemptedIds,
    failed_ids: failedIds,
    qualified_ids: qualifiedIds
  };
  return {
    engine_contract_version: C5C_REPLAY_ENGINE_CONTRACT_VERSION,
    corpus_contract_version: corpus.contract_version ?? null,
    corpus_id: corpus.corpus_id ?? null,
    behavior_contract_sha256: corpus.behavior_contract_sha256 ?? null,
    candidates: replayedCandidates,
    second_pass: secondPass,
    summary: replayedSummary(corpus, replayedCandidates, secondPass)
  };
}

function verifyArtifactBindings({
  corpus,
  receipt,
  corpusBuffer,
  receiptBuffer,
  artifactMetadata,
  inputCorpusPayloadSha256
}) {
  if (!isPlainObject(artifactMetadata)) {
    throw new OfflineReplayError("ARTIFACT_MISMATCH", "artifact metadata must be explicit");
  }
  for (const [key, binding] of Object.entries(corpus.artifact_bindings ?? {})) {
    const metadata = artifactMetadata[key];
    if (!isPlainObject(metadata)) {
      throw new OfflineReplayError("ARTIFACT_MISMATCH", `missing metadata for ${key}`);
    }
    if (metadata.path !== binding.path || metadata.payload_sha256 !== binding.payload_sha256) {
      throw new OfflineReplayError("ARTIFACT_MISMATCH", `payload metadata mismatch for ${key}`);
    }
    if (key !== "replay_corpus" && metadata.git_blob_sha !== binding.git_blob_sha) {
      throw new OfflineReplayError("ARTIFACT_MISMATCH", `Git blob metadata mismatch for ${key}`);
    }
  }

  const corpusMetadata = artifactMetadata.replay_corpus;
  if (
    corpusMetadata.git_blob_sha !== gitBlobSha(corpusBuffer)
    || corpusMetadata.payload_sha256 !== inputCorpusPayloadSha256
    || corpus.artifact_bindings?.replay_corpus?.payload_sha256 !== inputCorpusPayloadSha256
  ) {
    throw new OfflineReplayError("ARTIFACT_MISMATCH", "replay corpus bytes are not bound");
  }
  const receiptMetadata = artifactMetadata.receipt;
  if (
    receiptMetadata.git_blob_sha !== gitBlobSha(receiptBuffer)
    || receiptMetadata.payload_sha256 !== sha256Canonical(receipt)
  ) {
    throw new OfflineReplayError("ARTIFACT_MISMATCH", "receipt bytes are not bound");
  }
}

function verifyHealthyReceipt(corpus, receipt) {
  const syncResponse = parseSyncResponse(receipt.sync_response);
  const corpusHealth = corpus.delivery_health ?? {};
  if (
    receipt.status !== "success"
    || receipt.generation_status !== "success"
    || receipt.validation_status !== "success"
    || syncResponse.synced !== true
    || corpusHealth.generation_status !== "success"
    || corpusHealth.validation_status !== "success"
    || corpusHealth.receipt_status !== "success"
    || corpusHealth.sync_response?.synced !== true
  ) {
    throw new OfflineReplayError(
      "RECEIPT_UNHEALTHY",
      "canonical replay requires successful generation, validation, receipt, and sync"
    );
  }
}

function selectRegular(indie, china) {
  const selected = indie.qualified
    ? indie
    : china.qualified
      ? china
      : indie.disposition !== "excluded"
        ? indie
        : china;
  return { ...selected, sourcing_rule_version: V73_OBTAINABLE_EVIDENCE_RULE_VERSION };
}

function regularSelection(admission = {}) {
  return {
    status: admission.qualified ? "selected" : "rejected",
    lane: admission.sourcing_lane ?? null,
    reason_code: admission.qualified
      ? `${admission.sourcing_lane}_qualified`
      : `${admission.sourcing_lane ?? "regular"}_not_qualified`
  };
}

function regularSelectionView(value = {}) {
  return {
    status: value?.status ?? null,
    lane: value?.lane ?? null,
    reason_code: value?.reason_code ?? null
  };
}

function decisionOutput(value = {}) {
  return cloneJson({
    qualified: value?.qualified === true,
    disposition: value?.disposition ?? "candidate",
    sourcing_lane: value?.sourcing_lane ?? null,
    sourcing_rule_version:
      value?.sourcing_rule_version ?? V73_OBTAINABLE_EVIDENCE_RULE_VERSION,
    failed_gates: value?.failed_gates ?? [],
    missing_evidence: value?.missing_evidence ?? []
  });
}

function replayLaneOutput(value = {}, lane) {
  const gates = (value?.gate_results ?? []).map((gate) => ({
    id: String(gate?.gate_id ?? gate?.id ?? ""),
    status: String(gate?.status ?? "unknown"),
    hard_exclusion: gate?.hard_exclusion === true
  }));
  const failed = gates.filter((gate) => gate.status === "fail" || gate.status === "unknown");
  const qualified = failed.length === 0;
  const hardFailure = lane === "china_joint"
    ? failed.some((gate) => gate.status === "fail")
    : failed.some((gate) => gate.status === "fail" && gate.hard_exclusion);
  return {
    qualified,
    disposition: qualified ? "formal" : hardFailure ? "excluded" : "candidate",
    sourcing_lane: lane,
    sourcing_rule_version:
      lane === "china_joint" ? CHINA_JOINT_RULE_VERSION : V73_OBTAINABLE_EVIDENCE_RULE_VERSION,
    failed_gates: failed.map((gate) => gate.id),
    missing_evidence: failed
      .filter((gate) => gate.status === "unknown")
      .map((gate) => gate.id),
    next_evidence_actions: lane === "indie_prelaunch"
      ? failed
          .filter((gate) => gate.status === "unknown")
          .map((gate) => ({ action: actionForGate(gate.id) }))
          .filter((item) => item.action)
      : []
  };
}

function actionForGate(gateId) {
  return {
    identity_and_dedupe: "resolve_project_identity",
    prelaunch_window: "verify_prelaunch_window",
    publisher_china_capacity_clear: "verify_publisher_china_capacity",
    non_narrative_product: "verify_product_focus",
    non_india_team: "verify_team_region",
    official_playable_or_gameplay: "fetch_official_playable_or_gameplay",
    independent_quality_proof: "fetch_independent_quality_evidence",
    non_steam_business_entry: "fetch_non_steam_business_entry",
    concrete_china_bilibili_value: "research_china_bilibili_value"
  }[gateId] ?? null;
}

function replayedPublication(admission = {}, captured = {}) {
  const shadowPushPool = captured.shadow_push_pool === true;
  return {
    decision: shadowPushPool
      ? "formal"
      : admission.qualified === true
        ? "candidate"
        : admission.disposition === "excluded" ? "excluded" : "candidate",
    selected_lane: admission.sourcing_lane ?? null,
    shadow_push_pool: shadowPushPool,
    dedupe_suppressed: admission.qualified === true && !shadowPushPool,
    risk_flags: uniqueStrings(captured.risk_flags),
    day_lead_count_used: false
  };
}

function publicationView(value = {}) {
  return {
    decision: value?.decision ?? null,
    selected_lane: value?.selected_lane ?? null,
    shadow_push_pool: value?.shadow_push_pool === true,
    dedupe_suppressed: value?.dedupe_suppressed === true,
    risk_flags: uniqueStrings(value?.risk_flags),
    day_lead_count_used: value?.day_lead_count_used === true
  };
}

function secondPassCandidateView(value = {}) {
  return {
    eligible: value?.eligible === true,
    rejection_reason: value?.rejection_reason ?? null,
    selected: value?.selected === true,
    attempted: value?.attempted === true,
    transaction_id: value?.transaction_id ?? null
  };
}

function secondPassRunView(value = {}) {
  return {
    selector_version: String(value?.selector_version ?? ""),
    max_candidates: nonNegativeInteger(value?.max_candidates),
    eligible_ids: stringList(value?.eligible_ids),
    selected_ids: stringList(value?.selected_ids),
    omitted_ids: stringList(value?.omitted_ids),
    attempted_ids: stringList(value?.attempted_ids),
    failed_ids: stringList(value?.failed_ids),
    qualified_ids: stringList(value?.qualified_ids)
  };
}

function summaryView(value = {}) {
  return {
    candidate_count: nonNegativeInteger(value?.candidate_count),
    evidence_count: nonNegativeInteger(value?.evidence_count),
    second_pass_eligible_count: nonNegativeInteger(value?.second_pass_eligible_count),
    second_pass_selected_count: nonNegativeInteger(value?.second_pass_selected_count),
    second_pass_attempted_count: nonNegativeInteger(value?.second_pass_attempted_count),
    second_pass_failed_count: nonNegativeInteger(value?.second_pass_failed_count),
    second_pass_qualified_count: nonNegativeInteger(value?.second_pass_qualified_count),
    formal_count: nonNegativeInteger(value?.formal_count),
    candidate_decision_count: nonNegativeInteger(value?.candidate_decision_count),
    excluded_count: nonNegativeInteger(value?.excluded_count),
    shadow_push_pool_count: nonNegativeInteger(value?.shadow_push_pool_count)
  };
}

function replayedSummary(corpus, candidates, secondPass) {
  const countDecision = (decision) => candidates
    .filter((candidate) => candidate.publication.decision === decision)
    .length;
  return {
    candidate_count: candidates.length,
    evidence_count: Array.isArray(corpus.evidence_catalog) ? corpus.evidence_catalog.length : 0,
    second_pass_eligible_count: secondPass.eligible_ids.length,
    second_pass_selected_count: secondPass.selected_ids.length,
    second_pass_attempted_count: secondPass.attempted_ids.length,
    second_pass_failed_count: secondPass.failed_ids.length,
    second_pass_qualified_count: secondPass.qualified_ids.length,
    formal_count: countDecision("formal"),
    candidate_decision_count: countDecision("candidate"),
    excluded_count: countDecision("excluded"),
    shadow_push_pool_count: candidates
      .filter((candidate) => candidate.publication.shadow_push_pool)
      .length
  };
}

function secondPassEligible(admission = {}) {
  const actions = admission.next_evidence_actions ?? [];
  return admission.qualified !== true
    && admission.disposition !== "excluded"
    && actions.length >= 1
    && actions.length <= 3
    && actions.every((item) => SUPPORTED_SECOND_PASS_ACTIONS.has(item?.action));
}

function secondPassRejection(admission = {}) {
  if (admission.qualified === true) return "already_qualified";
  if (admission.disposition === "excluded") return "hard_exclusion";
  return "unsupported_or_unobtainable_gap";
}

function transactionIndex(corpus) {
  return new Map(
    (corpus.second_pass?.transactions ?? [])
      .map((transaction) => [transaction?.transaction_id, transaction])
  );
}

function explicitBytes(value, name) {
  if (typeof value === "string") return Buffer.from(value, "utf8");
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new OfflineReplayError("EXPLICIT_BYTES_REQUIRED", `${name} must be explicit bytes`);
}

function parseJsonBytes(bytes, code) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new OfflineReplayError(code, "explicit replay bytes are not valid JSON", String(error));
  }
}

function parseSyncResponse(value) {
  if (isPlainObject(value)) return value;
  try {
    const parsed = JSON.parse(String(value ?? ""));
    return isPlainObject(parsed) ? parsed : { synced: false };
  } catch {
    return { synced: false };
  }
}

function gitBlobSha(bytes) {
  return createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
}

function stringList(value) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function uniqueStrings(value) {
  return [...new Set(stringList(value).filter(Boolean))];
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(0, number) : 0;
}

function isSha256(value) {
  return /^[0-9a-f]{64}$/.test(String(value ?? ""));
}

function cloneJson(value) {
  return JSON.parse(canonicalJson(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
