import { createHash } from "node:crypto";

import {
  canonicalJson,
  computeReplayCorpusPayloadSha256,
  sha256Canonical,
  validateReplayCorpus,
  validateReplayPrivacy
} from "./online_daily_v7_3_replay_corpus_contract.mjs";
import { evaluateV73IndiePrelaunchAdmission } from "./online_daily_v7_3_obtainable_evidence.mjs";
import { analyzeV73EvidenceAvailability } from "./online_daily_v7_3_second_pass_orchestrator.mjs";
import { evaluateChinaJointAdmission } from "./online_daily_v7_2_china_joint_admission.mjs";
import { selectRegularAdmission } from "./online_daily_v7_2_regular_admission.mjs";
import { normalizeDisplayText, normalizeText } from "./online_daily_v4_dedupe.mjs";

export const C5C_REPLAY_ENGINE_CONTRACT_VERSION = 1;
const V73_OBTAINABLE_EVIDENCE_RULE_VERSION =
  "sourcing-rules-v7.3-obtainable-evidence";
const SUPPORTED_RECEIPT_EVENT_NAMES = new Set([
  "schedule",
  "watchdog",
  "workflow_dispatch"
]);

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
const PATCH_FIELDS_BY_ACTION = new Map([
  ["resolve_project_identity", ["project", "steam_app_id", "dedupe_key"]],
  ["verify_prelaunch_window", ["release_state", "release_window", "early_access_state"]],
  ["verify_publisher_china_capacity", ["publisher_occupancy"]],
  ["verify_product_focus", ["narrative_state"]],
  ["verify_team_region", ["india_team_state"]],
  ["fetch_official_playable_or_gameplay", ["official_demo_evidence", "official_gameplay_evidence"]],
  ["fetch_independent_quality_evidence", ["quality_proofs"]],
  ["fetch_non_steam_business_entry", ["business_entrypoints"]],
  ["research_china_bilibili_value", ["china_bilibili_value"]]
]);
const MERGED_EVIDENCE_LIST_FIELDS = new Set([
  "official_demo_evidence",
  "official_gameplay_evidence",
  "quality_proofs",
  "business_entrypoints"
]);
const EVIDENCE_DIAGNOSTIC_OUTCOMES = [
  "evidence_found",
  "no_project_match",
  "source_role_rejected",
  "quality_keyword_missing",
  "insufficient_independent_sources",
  "not_requested"
];

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
  artifactBytes,
  gitBlobResolver,
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
    artifactBytes,
    gitBlobResolver,
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
  const collectorV2 = corpus.collector_contract_version === 2;
  return {
    engine_contract_version: C5C_REPLAY_ENGINE_CONTRACT_VERSION,
    corpus_contract_version: corpus.contract_version ?? null,
    corpus_id: corpus.corpus_id ?? null,
    behavior_contract_sha256: corpus.behavior_contract_sha256 ?? null,
    candidates: (corpus.candidates ?? []).map((candidate) => {
      const transaction = transactions.get(candidate?.second_pass?.transaction_id) ?? null;
      return {
        candidate_id: candidate?.candidate_id ?? null,
        ...(collectorV2 && candidate?.second_pass?.eligible === true
          ? {
              ranking_inputs: {
                actionable_gate_count: nonNegativeInteger(
                  candidate?.ranking_inputs?.actionable_gate_count
                )
              }
            }
          : {}),
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
  const collectorV2 = corpus.collector_contract_version === 2;
  const candidates = (corpus.candidates ?? []).map((candidate) => {
    const indieInput = cloneJson(candidate?.first_pass?.indie_prelaunch?.input ?? {});
    const indie = evaluateV73IndiePrelaunchAdmission(indieInput);
    const eligible = secondPassEligible(indie);
    const evidenceDiagnostics = collectorV2 && eligible
      ? analyzeV73EvidenceAvailability({
          candidate: indieInput,
          evidence: indie.evidence,
          actions: indie.next_evidence_actions,
          mediaSignals: corpus.second_pass?.bounded_signals ?? [],
          evaluate: evaluateV73IndiePrelaunchAdmission
        })
      : null;
    const china = evaluateChinaJointAdmission(
      cloneJson(candidate?.first_pass?.china_joint?.input ?? {})
    );
    const selected = selectRegular(indie, china);
    const transaction = transactions.get(candidate?.second_pass?.transaction_id) ?? null;
    const finalIndie = transaction
      ? evaluateV73IndiePrelaunchAdmission(
          secondPassReplayInput(
            candidate?.first_pass?.indie_prelaunch?.input ?? {},
            transaction
          )
        )
      : indie;
    const finalSelected = selectRegular(finalIndie, china);
    return {
      candidate_id: candidate?.candidate_id ?? null,
      ranking_inputs: {
        action_count: Array.isArray(indie.next_evidence_actions)
          ? indie.next_evidence_actions.length
          : 0,
        actionable_gate_count: nonNegativeInteger(
          collectorV2
            ? evidenceDiagnostics?.actionable_gate_count
            : candidate?.ranking_inputs?.actionable_gate_count
        ),
        discovery_score: finiteNumber(candidate?.ranking_inputs?.discovery_score),
        dedupe_key: String(candidate?.ranking_inputs?.dedupe_key ?? candidate?.candidate_id ?? ""),
        source_type: String(candidate?.ranking_inputs?.source_type ?? ""),
        publication_order: {
          source_priority: nonNegativeInteger(
            candidate?.ranking_inputs?.publication_order?.source_priority
          ),
          source_index: nonNegativeInteger(
            candidate?.ranking_inputs?.publication_order?.source_index
          )
        }
      },
      eligible,
      first_admission: indie,
      transaction,
      first_pass: {
        indie_prelaunch: { output: decisionOutput(indie) },
        china_joint: { output: decisionOutput(china) },
        regular_selection: regularSelection(selected)
      },
      final_output: transaction ? decisionOutput(finalIndie) : null,
      final_selected: finalSelected,
      normalized_candidate: candidate?.normalized_candidate ?? {},
      dedupe_boundary: candidate?.dedupe_boundary ?? {}
    };
  });

  const rankedEligible = candidates
    .filter((candidate) => candidate.eligible)
    .sort((left, right) => (
      (corpus.second_pass?.selector_version === "actionability-v2"
        ? right.ranking_inputs.actionable_gate_count
          - left.ranking_inputs.actionable_gate_count
        : 0)
      || left.ranking_inputs.action_count - right.ranking_inputs.action_count
      || right.ranking_inputs.discovery_score - left.ranking_inputs.discovery_score
      || left.ranking_inputs.dedupe_key.localeCompare(right.ranking_inputs.dedupe_key)
      || left.ranking_inputs.source_type.localeCompare(right.ranking_inputs.source_type)
    ));
  const eligibleIds = rankedEligible.map((candidate) => candidate.candidate_id);
  const maxCandidates = nonNegativeInteger(corpus.second_pass?.max_candidates);
  const selectedIds = eligibleIds.slice(0, maxCandidates);
  const selected = new Set(selectedIds);
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.candidate_id, candidate])
  );
  const attemptedIds = selectedIds.filter((candidateId) => (
    candidateById.get(candidateId)?.transaction
  ));
  const failedIds = selectedIds.filter((candidateId) => (
    ["error", "timeout"].includes(
      candidateById.get(candidateId)?.transaction?.provider_status
    )
  ));
  const qualifiedIds = selectedIds.filter((candidateId) => {
    const candidate = candidateById.get(candidateId);
    return candidate?.transaction && candidate.final_selected?.qualified === true;
  });

  const publicationByCandidateId = replayPublicationIndex(candidates);
  const replayedCandidates = candidates.map((candidate) => {
    const isSelected = selected.has(candidate.candidate_id);
    const attempted = attemptedIds.includes(candidate.candidate_id);
    return {
      candidate_id: candidate.candidate_id,
      ...(collectorV2 && candidate.eligible
        ? {
            ranking_inputs: {
              actionable_gate_count: candidate.ranking_inputs.actionable_gate_count
            }
          }
        : {}),
      first_pass: candidate.first_pass,
      second_pass: {
        eligible: candidate.eligible,
        rejection_reason: candidate.eligible
          ? isSelected ? null : "budget_omitted"
          : secondPassRejection(candidate.first_admission),
        selected: isSelected,
        attempted,
        transaction_id: attempted ? candidate.transaction?.transaction_id ?? null : null
      },
      final_output: candidate.final_output,
      publication: publicationByCandidateId.get(candidate.candidate_id)
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
  artifactBytes,
  gitBlobResolver,
  artifactMetadata,
  inputCorpusPayloadSha256
}) {
  if (!isPlainObject(artifactMetadata)) {
    throw new OfflineReplayError("ARTIFACT_MISMATCH", "artifact metadata must be explicit");
  }
  const payloadByKey = new Map();
  for (const [key, binding] of Object.entries(corpus.artifact_bindings ?? {})) {
    const metadata = artifactMetadata[key];
    if (!isPlainObject(metadata)) {
      throw new OfflineReplayError("ARTIFACT_MISMATCH", `missing metadata for ${key}`);
    }
    if (metadata.path !== binding.path || metadata.payload_sha256 !== binding.payload_sha256) {
      throw new OfflineReplayError("ARTIFACT_MISMATCH", `payload metadata mismatch for ${key}`);
    }
    const bytes = artifactBuffer({
      key,
      binding,
      corpusBuffer,
      receiptBuffer,
      artifactBytes,
      gitBlobResolver
    });
    const payload = parseJsonBytes(bytes, "ARTIFACT_PARSE_ERROR");
    const actualGitBlobSha = gitBlobSha(bytes);
    const actualPayloadSha256 = key === "replay_corpus"
      ? inputCorpusPayloadSha256
      : sha256Canonical(payload);
    if (
      metadata.git_blob_sha !== actualGitBlobSha
      || metadata.payload_sha256 !== actualPayloadSha256
      || binding.payload_sha256 !== actualPayloadSha256
      || (key !== "replay_corpus" && binding.git_blob_sha !== actualGitBlobSha)
    ) {
      throw new OfflineReplayError(
        "ARTIFACT_MISMATCH",
        `artifact bytes are not bound for ${key}`
      );
    }
    payloadByKey.set(key, payload);
  }

  const corpusMetadata = artifactMetadata.replay_corpus;
  if (
    corpusMetadata.git_blob_sha !== gitBlobSha(corpusBuffer)
    || corpusMetadata.payload_sha256 !== inputCorpusPayloadSha256
    || corpus.artifact_bindings?.replay_corpus?.payload_sha256 !== inputCorpusPayloadSha256
  ) {
    throw new OfflineReplayError("ARTIFACT_MISMATCH", "replay corpus bytes are not bound");
  }
  verifyArtifactIdentity(corpus, receipt, payloadByKey);
}

function artifactBuffer({
  key,
  binding,
  corpusBuffer,
  receiptBuffer,
  artifactBytes,
  gitBlobResolver
}) {
  if (key === "replay_corpus") return corpusBuffer;
  if (key === "receipt") return receiptBuffer;
  if (isPlainObject(artifactBytes) && Object.hasOwn(artifactBytes, key)) {
    return explicitBytes(artifactBytes[key], `artifactBytes.${key}`);
  }
  if (typeof gitBlobResolver === "function") {
    const resolved = gitBlobResolver(Object.freeze({
      key,
      path: binding.path,
      git_blob_sha: binding.git_blob_sha
    }));
    if (resolved && typeof resolved.then === "function") {
      throw new OfflineReplayError(
        "ARTIFACT_BYTES_REQUIRED",
        "gitBlobResolver must return explicit bytes synchronously"
      );
    }
    return explicitBytes(resolved, `gitBlobResolver(${key})`);
  }
  throw new OfflineReplayError(
    "ARTIFACT_BYTES_REQUIRED",
    `explicit bytes or a trusted Git blob resolver are required for ${key}`
  );
}

function verifyArtifactIdentity(corpus, receipt, payloadByKey) {
  const reportDate = String(corpus.report_date ?? "");
  const runSlot = String(corpus.run_slot ?? "");
  const runId = String(corpus.workflow_run_id ?? "");
  const runAttempt = String(corpus.run_attempt ?? "");
  const corpusRunId = canonicalRunId(corpus.workflow_run_id);
  const receiptRunId = canonicalRunId(receipt.run_id);
  const corpusRunAttempt = strictRunAttempt(corpus.run_attempt);
  const receiptRunAttempt = strictRunAttempt(receipt.run_attempt);
  const expectedCorpusId = `${reportDate}/${runId}/${runAttempt}/${runSlot}`;
  const expectedPaths = {
    report: `data/reports/${reportDate}.json`,
    sourcing_candidates: `data/sourcing_candidates/${reportDate}.json`,
    replay_corpus: `data/sourcing_replay_corpus/${reportDate}/${runId}-${runAttempt}-${runSlot}.json`,
    receipt: `data/automation_runs/${reportDate}-${runSlot}.json`,
    radar: `data/radar/${reportDate}.json`,
    steam_trends: `data/steam_trends/${reportDate}.json`
  };
  if (
    corpus.corpus_id !== expectedCorpusId
    || receipt.report_date !== reportDate
    || String(receipt.slot ?? "") !== runSlot
    || !SUPPORTED_RECEIPT_EVENT_NAMES.has(receipt.event_name)
    || receipt.event_name !== corpus.event_name
    || !corpusRunId
    || receiptRunId !== corpusRunId
    || corpusRunAttempt === null
    || receiptRunAttempt !== corpusRunAttempt
    || !String(corpus.captured_at ?? "").startsWith(`${reportDate}T`)
    || !String(corpus.captured_at ?? "").endsWith("+08:00")
  ) {
    throw new OfflineReplayError(
      "ARTIFACT_IDENTITY_MISMATCH",
      "receipt and corpus must share one canonical run tuple"
    );
  }
  for (const [key, binding] of Object.entries(corpus.artifact_bindings ?? {})) {
    if (expectedPaths[key] && binding.path !== expectedPaths[key]) {
      throw new OfflineReplayError(
        "ARTIFACT_IDENTITY_MISMATCH",
        `canonical artifact path mismatch for ${key}`
      );
    }
    if (key !== "replay_corpus" && payloadByKey.get(key)?.report_date !== reportDate) {
      throw new OfflineReplayError(
        "ARTIFACT_IDENTITY_MISMATCH",
        `artifact report_date mismatch for ${key}`
      );
    }
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

function secondPassReplayInput(firstInput, transaction) {
  const expectedFields = uniqueStrings(
    (transaction.requested_actions ?? [])
      .flatMap((item) => PATCH_FIELDS_BY_ACTION.get(item?.action) ?? [])
  ).sort();
  const declaredFields = uniqueStrings(transaction.allowlisted_patch_fields).sort();
  if (canonicalJson(expectedFields) !== canonicalJson(declaredFields)) {
    throw new OfflineReplayError(
      "REPLAY_INPUT_MISMATCH",
      "second-pass allowlisted patch fields do not match requested actions"
    );
  }
  const storedFilteredPatch = isPlainObject(transaction.filtered_patch)
    ? transaction.filtered_patch
    : {};
  if (Object.keys(storedFilteredPatch).some((field) => !expectedFields.includes(field))) {
    throw new OfflineReplayError(
      "REPLAY_INPUT_MISMATCH",
      "second-pass filtered patch exceeds its bounded allowlist"
    );
  }
  const replayedFilteredPatch = replayFilteredPatch(transaction, expectedFields);
  if (canonicalJson(replayedFilteredPatch) !== canonicalJson(storedFilteredPatch)) {
    throw new OfflineReplayError(
      "REPLAY_INPUT_MISMATCH",
      "second-pass raw result does not reproduce the stored filtered patch"
    );
  }
  const reconstructed = mergeBoundedInput(firstInput, replayedFilteredPatch);
  const reconstructedEvidence = evaluateV73IndiePrelaunchAdmission(reconstructed).evidence;
  const retainedEvidence = evaluateV73IndiePrelaunchAdmission(
    cloneJson(transaction.merged_final_input ?? {})
  ).evidence;
  if (canonicalJson(reconstructedEvidence) !== canonicalJson(retainedEvidence)) {
    throw new OfflineReplayError(
      "REPLAY_INPUT_MISMATCH",
      "second-pass merged input does not match the bounded patch"
    );
  }
  return retainedEvidence;
}

function replayFilteredPatch(transaction, expectedFields) {
  if (transaction.provider_status !== "success") return {};
  if (!isPlainObject(transaction.raw_provider_result)) {
    throw new OfflineReplayError(
      "REPLAY_INPUT_MISMATCH",
      "successful second-pass transaction requires one raw result"
    );
  }
  const privacyPrepared = replayPrivacyBoundary(transaction.raw_provider_result);
  const privacy = validateReplayPrivacy(privacyPrepared);
  if (!privacy.valid) {
    throw new OfflineReplayError(
      "REPLAY_INPUT_MISMATCH",
      "second-pass raw result fails the frozen privacy boundary",
      privacy.errors
    );
  }
  const allowed = new Set(expectedFields);
  return Object.fromEntries(
    Object.entries(privacyPrepared)
      .filter(([field]) => allowed.has(field))
      .map(([field, value]) => [field, cloneJson(value)])
  );
}

function replayPrivacyBoundary(rawResult) {
  const value = cloneJson(rawResult);
  if (Array.isArray(value.business_entrypoints)) {
    value.business_entrypoints = value.business_entrypoints.map((item) => ({
      ...item,
      official_public_business_entry: true
    }));
  }
  return value;
}

function mergeBoundedInput(firstInput, patch) {
  const merged = cloneJson(firstInput ?? {});
  for (const [field, value] of Object.entries(patch)) {
    if (MERGED_EVIDENCE_LIST_FIELDS.has(field)) {
      const values = [
        ...(Array.isArray(merged[field]) ? merged[field] : []),
        ...(Array.isArray(value) ? value : [])
      ];
      const seen = new Set();
      merged[field] = values.filter((item) => {
        const key = evidenceEntryKey(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map(cloneJson);
    } else {
      merged[field] = cloneJson(value);
    }
  }
  return merged;
}

function evidenceEntryKey(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return normalizeIdentifier(value);
  }
  return normalizeIdentifier(value.source_id)
    || normalizeIdentifier(value.url)
    || normalizeIdentifier(`${value.type ?? ""}:${value.value ?? ""}`);
}

function normalizeIdentifier(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return text || null;
}

function selectRegular(indie, china) {
  const selected = selectRegularAdmission(indie, china);
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

function replayPublicationIndex(candidates) {
  const used = new Set();
  const publications = new Map();
  const publicationOrder = [...candidates].sort((left, right) => (
    left.ranking_inputs.publication_order.source_priority
      - right.ranking_inputs.publication_order.source_priority
    || left.ranking_inputs.publication_order.source_index
      - right.ranking_inputs.publication_order.source_index
    || left.candidate_id.localeCompare(right.candidate_id)
  ));
  for (const candidate of publicationOrder) {
    const admission = candidate.final_selected ?? {};
    const poolKey = replayPoolKey(candidate);
    const duplicate = admission.qualified === true && used.has(poolKey);
    const shadowPushPool = admission.qualified === true && !duplicate;
    if (shadowPushPool) used.add(poolKey);
    publications.set(candidate.candidate_id, {
      decision: shadowPushPool
        ? "formal"
        : admission.disposition === "excluded" ? "excluded" : "candidate",
      selected_lane: admission.sourcing_lane ?? null,
      shadow_push_pool: shadowPushPool,
      dedupe_suppressed: admission.qualified === true && !shadowPushPool,
      risk_flags: uniqueStrings(admission.exclusion_reasons),
      day_lead_count_used: false
    });
  }
  return publications;
}

function replayPoolKey(candidate) {
  const normalized = candidate.normalized_candidate ?? {};
  const steamAppId = String(normalized.steam_app_id ?? "").trim();
  if (steamAppId) return `steam:${steamAppId}`;
  const project = String(normalized.project ?? "");
  const looseKey = looseChineseProjectKey(project);
  return `project:${looseKey || normalizeText(project)}`;
}

function looseChineseProjectKey(value) {
  const hanChars = [...normalizeDisplayText(value)]
    .filter((char) => /\p{Script=Han}/u.test(char));
  if (hanChars.length < 6 || hanChars.length > 24) return null;
  return `han:${hanChars.sort().join("")}`;
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
  const summary = {
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
  if (isPlainObject(value?.second_pass_outcome_counts)) {
    summary.second_pass_outcome_counts = normalizedSecondPassOutcomeCounts(
      value.second_pass_outcome_counts
    );
  }
  return summary;
}

function replayedSummary(corpus, candidates, secondPass) {
  const countDecision = (decision) => candidates
    .filter((candidate) => candidate.publication.decision === decision)
    .length;
  const summary = {
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
  if (corpus.collector_contract_version === 2) {
    const outcomeCounts = normalizedSecondPassOutcomeCounts({});
    for (const transaction of corpus.second_pass?.transactions ?? []) {
      const outcome = transaction?.evidence_diagnostics?.outcome;
      if (Object.hasOwn(outcomeCounts, outcome)) outcomeCounts[outcome] += 1;
    }
    summary.second_pass_outcome_counts = outcomeCounts;
  }
  return summary;
}

function normalizedSecondPassOutcomeCounts(value) {
  return Object.fromEntries(EVIDENCE_DIAGNOSTIC_OUTCOMES.map((outcome) => [
    outcome,
    nonNegativeInteger(value?.[outcome])
  ]));
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

function canonicalRunId(value) {
  if (Number.isSafeInteger(value) && value > 0) return String(value);
  const text = String(value ?? "");
  if (!/^[1-9]\d*$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && String(number) === text ? text : null;
}

function strictRunAttempt(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
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
