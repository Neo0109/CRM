import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { RULE_VERSION } from "./online_daily_v4_rules.mjs";
import {
  mediaIndieAdmissionEvidence,
  steamIndieAdmissionEvidence
} from "./online_daily_v7_indie_admission.mjs";
import {
  canonicalJson,
  computeBehaviorContractSha256,
  computeReplayCorpusPayloadSha256,
  measureReplayCorpusPayload,
  sha256Canonical,
  validateReplayCorpus,
  validateReplayPrivacy
} from "./online_daily_v7_3_replay_corpus_contract.mjs";
import {
  V73_OBTAINABLE_EVIDENCE_RULE_VERSION
} from "./online_daily_v7_3_obtainable_evidence.mjs";
import {
  evaluateMediaV73RegularAdmission,
  evaluateSteamV73RegularAdmission
} from "./online_daily_v7_3_regular_admission.mjs";
import {
  fetchV73TargetedEvidence,
  runV73TargetedCandidateSecondPasses
} from "./online_daily_v7_3_second_pass_orchestrator.mjs";
import { buildSourcingCandidateArtifact } from "./online_daily_v7_3_shadow_candidate_audit.mjs";
import { buildPools } from "./online_daily_v7_3_shadow_decision.mjs";

export const C5B_COLLECTOR_CONTRACT_VERSION = 1;
export const C5B_SECOND_PASS_MAX_CANDIDATES = 12;
export const C5B_PROVIDER_RETRY_LIMIT = 0;
export const C5B_DEFAULT_PROVIDER_TIMEOUT_MS = 15_000;
export const C5B_BEHAVIOR_DEPENDENCY_PATHS = Object.freeze([
  ".github/workflows/daily-report-watchdog.yml",
  ".github/workflows/sync-daily-report.yml",
  "automations/jobs/bilibili_evidence.mjs",
  "automations/jobs/bilibili_probe.mjs",
  "automations/jobs/online_daily_v4.mjs",
  "automations/jobs/online_daily_v4_artifacts.mjs",
  "automations/jobs/online_daily_v4_candidate_state.mjs",
  "automations/jobs/online_daily_v4_decision.mjs",
  "automations/jobs/online_daily_v4_dedupe.mjs",
  "automations/jobs/online_daily_v4_enrichment_scheduler.mjs",
  "automations/jobs/online_daily_v4_media_enrichment.mjs",
  "automations/jobs/online_daily_v4_media_entities.mjs",
  "automations/jobs/online_daily_v4_media_leads.mjs",
  "automations/jobs/online_daily_v4_media_rules.mjs",
  "automations/jobs/online_daily_v4_media_sources.mjs",
  "automations/jobs/online_daily_v4_network.mjs",
  "automations/jobs/online_daily_v4_rules.mjs",
  "automations/jobs/online_daily_v4_source_health.mjs",
  "automations/jobs/online_daily_v4_source_utils.mjs",
  "automations/jobs/online_daily_v4_steam_source.mjs",
  "automations/jobs/online_daily_v7_2_china_joint_admission.mjs",
  "automations/jobs/online_daily_v7_2_regular_admission.mjs",
  "automations/jobs/online_daily_v7_indie_admission.mjs",
  "automations/jobs/online_daily_v7_3_obtainable_evidence.mjs",
  "automations/jobs/online_daily_v7_3_regular_admission.mjs",
  "automations/jobs/online_daily_v7_3_replay_corpus_contract.mjs",
  "automations/jobs/online_daily_v7_3_second_pass_orchestrator.mjs",
  "automations/jobs/online_daily_v7_3_shadow_candidate_audit.mjs",
  "automations/jobs/online_daily_v7_3_shadow_collector.mjs",
  "automations/jobs/online_daily_v7_3_shadow_decision.mjs",
  "automations/jobs/sourcing_v6_3_quality.mjs",
  "automations/rules/daily-report-v7-3-shadow.json",
  "automations/rules/daily-report.json",
  "schemas/sourcing_candidates_v3_shadow.schema.json",
  "schemas/sourcing_replay_corpus.schema.json",
  "schemas/sourcing_replay_window.schema.json"
]);
export const C5B_BEHAVIOR_PRODUCTION_EXCLUSIONS = Object.freeze([
  "automations/jobs/online_daily_v4_candidate_audit.mjs",
  "automations/jobs/online_daily_v4_reports.mjs",
  "automations/jobs/online_daily_v4_volume.mjs"
]);

const SUPPORTED_ACTION_FIELDS = new Map([
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
const V73_HARD_EXCLUSION_GATES = new Set([
  "identity_and_dedupe",
  "prelaunch_window",
  "publisher_china_capacity_clear",
  "non_narrative_product",
  "non_india_team"
]);
const EVIDENCE_SOURCE_ROLES = new Set([
  "official",
  "developer",
  "publisher",
  "media",
  "trusted_creator",
  "keyword",
  "unclassified"
]);
const INDEPENDENT_SOURCE_ROLES = new Set(["media", "trusted_creator"]);

export function isC5BShadowCaptureEligible(runContext = {}) {
  const eventName = String(runContext.event_name ?? "").trim();
  const runSlot = String(runContext.run_slot ?? "").trim();
  if (eventName !== "schedule") return false;
  if (runSlot === "afternoon") return true;
  return runSlot === "watchdog"
    && runContext.generation_performed === true
    && runContext.forced !== true;
}

export async function collectV73ShadowCore({
  rootDir = process.cwd(),
  reportDate,
  capturedAt,
  runContext = {},
  steamCandidates = [],
  mediaCandidates = [],
  mediaSignals = [],
  candidateStates = new Map(),
  steamEnrichmentMetrics = null,
  budgetLimits = {},
  budgetUsage = {},
  provider = fetchV73TargetedEvidence,
  providerContext = {},
  providerTimeoutMs = C5B_DEFAULT_PROVIDER_TIMEOUT_MS,
  behaviorManifest = null
} = {}) {
  assertDate(reportDate);
  if (!isC5BShadowCaptureEligible(runContext)) {
    throw new Error("C5-B shadow capture is not eligible for this event and slot");
  }
  if (!Array.isArray(steamCandidates) || !Array.isArray(mediaCandidates)) {
    throw new TypeError("C5-B shadow candidates must be arrays");
  }
  if (!(candidateStates instanceof Map)) {
    throw new TypeError("C5-B shadow candidateStates must be a Map");
  }
  if (typeof provider !== "function") {
    throw new TypeError("C5-B provider must be an injected function");
  }

  const manifest = behaviorManifest
    ? sortedManifest(behaviorManifest)
    : await buildC5BBehaviorManifest({ rootDir });
  validateBehaviorAuthority(manifest);
  const steamBefore = cloneValue(steamCandidates);
  const mediaBefore = cloneValue(mediaCandidates);
  const statesBefore = cloneMap(candidateStates);
  const mediaSignalsSafe = publicSignals(mediaSignals);
  const captureErrors = [];
  const providerRecords = new Map();
  const boundedTimeout = boundedInteger(providerTimeoutMs, C5B_DEFAULT_PROVIDER_TIMEOUT_MS, 1, 60_000);
  const recordingProvider = createRecordingProvider({
    provider,
    providerContext: publicProviderContext(providerContext),
    timeoutMs: boundedTimeout,
    records: providerRecords,
    captureErrors
  });

  const secondPassOutcome = await runV73TargetedCandidateSecondPasses({
    steamCandidates: steamBefore,
    mediaCandidates: mediaBefore,
    candidateStates: statesBefore,
    capturedAt,
    maxCandidates: C5B_SECOND_PASS_MAX_CANDIDATES,
    fetchEvidence: recordingProvider,
    mediaSignals: mediaSignalsSafe,
    context: publicProviderContext(providerContext)
  });
  const shadowPools = buildPools(
    secondPassOutcome.steam_candidates,
    secondPassOutcome.media_candidates,
    { reportDate, ruleVersion: V73_OBTAINABLE_EVIDENCE_RULE_VERSION }
  );
  const shadowCandidateArtifact = buildSourcingCandidateArtifact({
    reportDate,
    capturedAt,
    ruleVersion: V73_OBTAINABLE_EVIDENCE_RULE_VERSION,
    rawSteamCandidates: steamBefore,
    enrichedSteamCandidates: secondPassOutcome.steam_candidates,
    mediaSignalsSeen: mediaSignalsSafe.length,
    mediaCandidates: secondPassOutcome.media_candidates,
    candidatePools: shadowPools,
    publishedPools: shadowPools,
    candidateStates: secondPassOutcome.candidate_states,
    steamEnrichmentMetrics
  });
  const evaluatorDependencySha256 = sha256Canonical({
    obtainable_evidence: manifest["automations/jobs/online_daily_v7_3_obtainable_evidence.mjs"] ?? null,
    regular_admission: manifest["automations/jobs/online_daily_v7_3_regular_admission.mjs"] ?? null,
    second_pass: manifest["automations/jobs/online_daily_v7_3_second_pass_orchestrator.mjs"] ?? null
  });
  const universe = buildDecisionUniverse({
    reportDate,
    capturedAt,
    steamBefore,
    mediaBefore,
    steamAfter: secondPassOutcome.steam_candidates,
    mediaAfter: secondPassOutcome.media_candidates,
    candidateStates: secondPassOutcome.candidate_states,
    shadowPools,
    shadowCandidateArtifact,
    secondPassResults: secondPassOutcome.results,
    providerRecords,
    mediaSignals: mediaSignalsSafe,
    evaluatorDependencySha256
  });
  const selectionOrder = secondPassOutcome.results.map((item) => item.dedupe_key);
  const selectionRank = new Map(selectionOrder.map((id, index) => [id, index]));
  universe.transactions.sort((left, right) => (
    (selectionRank.get(left.candidate_id) ?? Number.MAX_SAFE_INTEGER)
    - (selectionRank.get(right.candidate_id) ?? Number.MAX_SAFE_INTEGER)
  ));
  const secondPass = buildSecondPass(
    universe.candidates,
    universe.transactions,
    selectionOrder
  );
  const limits = normalizedBudgetLimits(budgetLimits);
  const usage = normalizedBudgetUsage({
    budgetUsage,
    candidates: universe.candidates,
    transactions: universe.transactions
  });
  const captureStatus = captureErrors.length ? "incomplete" : "complete";
  const reasonCodes = captureErrors.length ? ["privacy_violation"] : [];
  const summary = buildSummary(universe.candidates, universe.evidenceCatalog, secondPass);
  const core = {
    contract_version: 1,
    corpus_id: corpusId(reportDate, runContext),
    report_date: reportDate,
    timezone: "Asia/Shanghai",
    captured_at: normalizedCapturedAt(capturedAt),
    event_name: "schedule",
    run_slot: String(runContext.run_slot),
    workflow_run_id: positiveInteger(runContext.workflow_run_id, "workflow_run_id"),
    run_attempt: positiveInteger(runContext.run_attempt ?? 1, "run_attempt"),
    run_url: sanitizePublicUrl(runContext.run_url),
    input_commit_sha: gitSha(runContext.input_commit_sha),
    node_version: normalizedNodeVersion(runContext.node_version ?? process.version),
    active_production_rule_version: RULE_VERSION,
    shadow_rule_version: V73_OBTAINABLE_EVIDENCE_RULE_VERSION,
    collector_contract_version: C5B_COLLECTOR_CONTRACT_VERSION,
    behavior_manifest: manifest,
    behavior_contract_sha256: computeBehaviorContractSha256(manifest),
    capture_status: captureStatus,
    capture_errors: captureErrors,
    budgets: { limits, usage },
    discovery_summary: buildDiscoverySummary({
      steamBefore,
      mediaBefore,
      candidateCount: universe.candidates.length
    }),
    evidence_catalog: universe.evidenceCatalog,
    candidates: universe.candidates,
    second_pass: secondPass,
    summary,
    integrity: {
      canonical_json_version: 1,
      payload_sha256: "0".repeat(64),
      ordered_candidate_count: universe.candidates.length,
      ordered_evidence_count: universe.evidenceCatalog.length,
      artifact_binding_count: 0,
      byte_size: 0,
      inline_text_characters: 0,
      status: captureStatus,
      reason_codes: reasonCodes
    },
    shadow_candidate_artifact: shadowCandidateArtifact
  };

  const privacy = validateReplayPrivacy(core);
  if (!privacy.valid) {
    throw new Error(`C5-B privacy boundary rejected the shadow core: ${privacy.errors[0]?.code ?? "unknown"}`);
  }
  return core;
}

export async function runC5BShadowCollectorSafely(options = {}) {
  if (!isC5BShadowCaptureEligible(options.runContext)) {
    return { status: "skipped", reason: "ineligible_event_or_slot", pending_path: null };
  }
  try {
    const core = await collectV73ShadowCore(options);
    const rootDir = options.rootDir ?? process.cwd();
    const pendingPath = path.join(rootDir, pendingRelativePath(core));
    await mkdir(path.dirname(pendingPath), { recursive: true });
    await writeFile(pendingPath, `${canonicalJson(core)}\n`, "utf8");
    return {
      status: "pending",
      capture_status: core.capture_status,
      pending_path: pendingPath,
      candidate_count: core.candidates.length,
      transaction_count: core.second_pass.transactions.length
    };
  } catch (error) {
    console.warn(`C5-B shadow collector isolated failure: ${errorMessage(error)}`);
    return { status: "error", reason: errorMessage(error), pending_path: null };
  }
}

export async function finalizeC5BReplayCorpusSafely(options = {}) {
  try {
    return await finalizeC5BReplayCorpus(options);
  } catch (error) {
    console.warn(`C5-B shadow finalizer isolated failure: ${errorMessage(error)}`);
    return { status: "error", reason: errorMessage(error), corpus_path: null };
  }
}

export async function buildC5BBehaviorManifest({
  rootDir = process.cwd(),
  dependencyPaths = C5B_BEHAVIOR_DEPENDENCY_PATHS
} = {}) {
  const manifest = {};
  for (const relativePath of [...dependencyPaths].sort()) {
    const content = await readFile(path.join(rootDir, relativePath));
    manifest[relativePath] = gitBlobSha(content);
  }
  return manifest;
}

async function finalizeC5BReplayCorpus({
  rootDir = process.cwd(),
  reportDate,
  runSlot,
  receiptPath = path.join(rootDir, "data", "automation_runs", `${reportDate}-${runSlot}.json`)
} = {}) {
  assertDate(reportDate);
  const pendingPath = await findPendingPath({ rootDir, reportDate, runSlot });
  if (!pendingPath) return { status: "skipped", reason: "pending_core_missing", corpus_path: null };
  const core = JSON.parse(await readFile(pendingPath, "utf8"));
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  const runId = positiveInteger(core.workflow_run_id, "workflow_run_id");
  const attempt = positiveInteger(core.run_attempt, "run_attempt");
  const corpusRelativePath = `data/sourcing_replay_corpus/${reportDate}/${runId}-${attempt}-${runSlot}.json`;
  const bindings = {
    report: await artifactBinding(rootDir, `data/reports/${reportDate}.json`, "report"),
    sourcing_candidates: await artifactBinding(
      rootDir,
      `data/sourcing_candidates/${reportDate}.json`,
      "sourcing_candidates"
    ),
    replay_corpus: {
      path: corpusRelativePath,
      git_blob_sha: null,
      payload_sha256: "0".repeat(64),
      record_count: core.candidates.length,
      validation_status: "valid"
    },
    receipt: await artifactBinding(
      rootDir,
      path.relative(rootDir, receiptPath),
      "receipt"
    )
  };
  for (const [key, relativePath] of [
    ["radar", `data/radar/${reportDate}.json`],
    ["steam_trends", `data/steam_trends/${reportDate}.json`]
  ]) {
    try {
      bindings[key] = await artifactBinding(rootDir, relativePath, key);
    } catch {}
  }
  const syncResponse = parseSyncResponse(receipt.sync_response);
  const corpus = {
    contract_version: core.contract_version,
    corpus_id: core.corpus_id,
    report_date: core.report_date,
    timezone: core.timezone,
    captured_at: core.captured_at,
    event_name: core.event_name,
    run_slot: core.run_slot,
    workflow_run_id: core.workflow_run_id,
    run_attempt: core.run_attempt,
    run_url: core.run_url,
    input_commit_sha: core.input_commit_sha,
    node_version: core.node_version,
    active_production_rule_version: core.active_production_rule_version,
    shadow_rule_version: core.shadow_rule_version,
    collector_contract_version: core.collector_contract_version,
    behavior_manifest: core.behavior_manifest,
    behavior_contract_sha256: core.behavior_contract_sha256,
    capture_status: core.capture_status,
    capture_errors: core.capture_errors,
    artifact_bindings: bindings,
    delivery_health: {
      generation_status: normalizedRunStatus(receipt.generation_status),
      validation_status: normalizedRunStatus(receipt.validation_status),
      receipt_status: receipt.status === "success" ? "success" : "failed",
      sync_response: { synced: syncResponse.synced === true },
      source_health_status: sourceHealthStatus(receipt),
      failure_stage: stringOrNull(receipt.failure_stage)
    },
    budgets: core.budgets,
    discovery_summary: core.discovery_summary,
    evidence_catalog: core.evidence_catalog,
    candidates: core.candidates,
    second_pass: core.second_pass,
    summary: core.summary,
    integrity: {
      ...core.integrity,
      artifact_binding_count: Object.keys(bindings).length,
      payload_sha256: "0".repeat(64),
      byte_size: 0,
      inline_text_characters: 0
    }
  };
  stabilizePayloadMetrics(corpus);
  const payloadSha = computeReplayCorpusPayloadSha256(corpus);
  corpus.integrity.payload_sha256 = payloadSha;
  corpus.artifact_bindings.replay_corpus.payload_sha256 = payloadSha;
  const validation = validateReplayCorpus(corpus);
  if (!validation.valid) {
    const first = validation.errors[0];
    throw new Error(`C5-B replay corpus validation failed: ${first?.code ?? "unknown"} at ${first?.path ?? "/"}`);
  }
  const corpusPath = path.join(rootDir, corpusRelativePath);
  await mkdir(path.dirname(corpusPath), { recursive: true });
  await writeFile(corpusPath, `${canonicalJson(corpus)}\n`, "utf8");
  return {
    status: corpus.capture_status,
    corpus_path: corpusPath,
    corpus_relative_path: corpusRelativePath,
    payload_sha256: payloadSha,
    behavior_contract_sha256: corpus.behavior_contract_sha256
  };
}

function createRecordingProvider({
  provider,
  providerContext,
  timeoutMs,
  records,
  captureErrors
}) {
  return async (request) => {
    const dedupeKey = String(request?.evidence?.dedupe_key ?? "").trim();
    const actions = cloneValue(request?.actions ?? []);
    const transactionId = `transaction:${createHash("sha256")
      .update(canonicalJson({ dedupe_key: dedupeKey, actions }))
      .digest("hex")
      .slice(0, 24)}`;
    const record = {
      transaction_id: transactionId,
      dedupe_key: dedupeKey,
      request: safeProviderRequest(request),
      raw_provider_result: null,
      filtered_patch: {},
      provider_status: "error",
      error: null,
      request_metrics: { request_count: 1, retry_count: 0, timeout_ms: timeoutMs }
    };
    records.set(dedupeKey, record);
    try {
      const raw = await withTimeout(
        Promise.resolve(provider({ ...cloneValue(request), context: providerContext })),
        timeoutMs
      );
      if (!isPlainObject(raw)) throw new Error("C5B_PROVIDER_INVALID_RESULT");
      if (Object.keys(raw).length === 0) throw new Error("C5B_PROVIDER_EMPTY_RESULT");
      const privacyPrepared = providerPrivacyBoundary(raw);
      const privacy = validateReplayPrivacy(privacyPrepared);
      if (!privacy.valid) {
        captureErrors.push({
          stage: "privacy",
          code: "privacy_violation",
          message: `Provider result rejected by privacy boundary: ${privacy.errors[0]?.code ?? "unknown"}`
        });
        throw new Error("C5B_PROVIDER_PRIVACY_VIOLATION");
      }
      const filtered = filterProviderPatch(privacyPrepared, actions);
      if (Object.keys(filtered).length === 0) throw new Error("C5B_PROVIDER_EMPTY_RESULT");
      record.raw_provider_result = privacyPrepared;
      record.filtered_patch = filtered;
      record.provider_status = "success";
      record.error = null;
      return filtered;
    } catch (error) {
      record.provider_status = error?.code === "C5B_PROVIDER_TIMEOUT" ? "timeout" : "error";
      record.error = errorMessage(error);
      record.raw_provider_result = null;
      record.filtered_patch = {};
      throw error;
    }
  };
}

function buildDecisionUniverse({
  reportDate,
  capturedAt,
  steamBefore,
  mediaBefore,
  steamAfter,
  mediaAfter,
  candidateStates,
  shadowPools,
  shadowCandidateArtifact,
  secondPassResults,
  providerRecords,
  mediaSignals,
  evaluatorDependencySha256
}) {
  const entries = new Map();
  addUniverseEntries(entries, "steam", steamBefore, steamAfter, candidateStates);
  addUniverseEntries(entries, "media", mediaBefore, mediaAfter, candidateStates);
  const resultByKey = new Map(secondPassResults.map((item) => [item.dedupe_key, item]));
  const auditByKey = new Map(
    shadowCandidateArtifact.candidates.map((item) => [item.dedupe_key, item])
  );
  const evidenceCatalog = [];
  const evidenceIds = new Set();
  const transactions = [];
  const candidates = [];

  for (const entry of [...entries.values()].sort((left, right) => left.dedupeKey.localeCompare(right.dedupeKey))) {
    const candidateId = entry.dedupeKey;
    const firstAdmission = admissionForEntry(entry, "before");
    const finalAdmission = admissionForEntry(entry, "after");
    const evidence = candidateEvidence({
      candidateId,
      entry,
      firstAdmission,
      finalAdmission,
      mediaSignals,
      capturedAt
    });
    for (const item of evidence.catalog) {
      if (evidenceIds.has(item.evidence_id)) continue;
      evidenceIds.add(item.evidence_id);
      evidenceCatalog.push(item);
    }
    const result = resultByKey.get(entry.dedupeKey) ?? null;
    const providerRecord = providerRecords.get(entry.dedupeKey) ?? null;
    const transaction = result && providerRecord
      ? transactionFromResult({
          candidateId,
          result,
          providerRecord,
          evaluatorDependencySha256,
          evidence
        })
      : null;
    if (transaction) transactions.push(transaction);
    const audit = auditByKey.get(entry.dedupeKey) ?? null;
    const publication = publicationForEntry({
      candidateId,
      entry,
      admission: finalAdmission,
      audit,
      shadowPools
    });
    const eligible = secondPassEligible(firstAdmission.lane_results?.indie_prelaunch);
    const selected = Boolean(result);
    const state = entry.state;
    candidates.push({
      candidate_id: candidateId,
      project: String(firstAdmission.evidence?.project ?? entry.project).trim(),
      steam_app_id: stringOrNull(firstAdmission.evidence?.steam_app_id ?? entry.steamAppId),
      dedupe_key: entry.dedupeKey,
      source_type: entry.sourceTypes.size > 1 ? "multi_source" : [...entry.sourceTypes][0],
      source_lane: "regular",
      origin_signal_ids: [...entry.originSignalIds].sort(),
      first_seen: validDateOr(state?.first_seen, reportDate),
      last_seen: validDateOr(state?.last_seen, reportDate),
      scheduler_lane: schedulerLane(state),
      enrichment_status: enrichmentStatus(state, entry.sourceTypes),
      enrichment_attempts: nonNegativeInteger(state?.enrichment_attempts),
      snapshot_status: snapshotStatus(state, entry.sourceTypes),
      evidence_freshness: evidenceFreshness(state, entry.sourceTypes),
      normalized_candidate: normalizedCandidate(entry, firstAdmission.evidence),
      discovery_score: Number(entry.discoveryScore) || 0,
      ranking_inputs: {
        action_count: firstAdmission.lane_results?.indie_prelaunch?.next_evidence_actions?.length ?? 0,
        discovery_score: Number(entry.discoveryScore) || 0,
        dedupe_key: entry.dedupeKey,
        source_type: entry.sourceTypes.size > 1 ? "multi_source" : [...entry.sourceTypes][0]
      },
      qualification_affected_by_ranking: false,
      dedupe_boundary: {
        history_match: false,
        crm_preexisting_match: false,
        match_basis: "none",
        audit_digest: sha256Canonical({
          dedupe_key: entry.dedupeKey,
          history_match: false,
          crm_preexisting_match: false
        })
      },
      first_pass: {
        evaluator_dependency_sha256: evaluatorDependencySha256,
        indie_prelaunch: laneEvaluation(
          firstAdmission.lane_results.indie_prelaunch,
          evidence,
          true
        ),
        china_joint: laneEvaluation(
          firstAdmission.lane_results.china_joint,
          evidence,
          false
        ),
        regular_selection: regularSelection(firstAdmission)
      },
      second_pass: {
        eligible,
        rejection_reason: eligible
          ? selected ? null : "budget_omitted"
          : secondPassRejection(firstAdmission.lane_results?.indie_prelaunch),
        selected,
        attempted: Boolean(transaction),
        transaction_id: transaction?.transaction_id ?? null
      },
      publication
    });
  }
  return {
    candidates,
    evidenceCatalog: evidenceCatalog.sort((left, right) => left.evidence_id.localeCompare(right.evidence_id)),
    transactions
  };
}

function addUniverseEntries(entries, sourceType, before, after, candidateStates) {
  before.forEach((candidate, index) => {
    const evidence = sourceType === "steam"
      ? steamIndieAdmissionEvidence(candidate)
      : mediaIndieAdmissionEvidence(candidate);
    const dedupeKey = String(evidence.dedupe_key ?? "").trim();
    if (!dedupeKey) throw new Error("C5-B candidate is missing a deterministic dedupe key");
    const existing = entries.get(dedupeKey) ?? {
      dedupeKey,
      sourceTypes: new Set(),
      originSignalIds: new Set(),
      beforeByType: {},
      afterByType: {},
      state: candidateStates.get(dedupeKey) ?? null,
      project: evidence.project,
      steamAppId: evidence.steam_app_id,
      discoveryScore: Number(candidate?.score ?? candidate?.media_score ?? 0)
    };
    existing.sourceTypes.add(sourceType);
    existing.originSignalIds.add(originSignalId(sourceType, candidate, evidence));
    existing.beforeByType[sourceType] = candidate;
    existing.afterByType[sourceType] = after[index] ?? candidate;
    if (Number(candidate?.score ?? candidate?.media_score ?? 0) > existing.discoveryScore) {
      existing.discoveryScore = Number(candidate?.score ?? candidate?.media_score ?? 0);
    }
    entries.set(dedupeKey, existing);
  });
}

function admissionForEntry(entry, phase) {
  const values = phase === "before" ? entry.beforeByType : entry.afterByType;
  const admissions = [];
  if (values.steam) admissions.push(evaluateSteamV73RegularAdmission(values.steam));
  if (values.media) admissions.push(evaluateMediaV73RegularAdmission(values.media));
  return admissions.sort((left, right) => (
    Number(right.qualified) - Number(left.qualified)
    || dispositionRank(right.disposition) - dispositionRank(left.disposition)
    || String(left.sourcing_lane).localeCompare(String(right.sourcing_lane))
  ))[0];
}

function candidateEvidence({
  candidateId,
  entry,
  firstAdmission,
  finalAdmission,
  mediaSignals,
  capturedAt
}) {
  const candidate = entry.beforeByType.steam ?? entry.beforeByType.media;
  const defaultUrl = candidatePublicUrl(candidate, entry.sourceTypes);
  const defaultId = evidenceId(candidateId, "source", defaultUrl);
  const catalog = [evidenceRecord({
    evidenceId: defaultId,
    gateId: "candidate_source",
    url: defaultUrl,
    sourceRole: entry.sourceTypes.has("steam") ? "developer" : sourceRoleForUrl(defaultUrl, mediaSignals),
    family: "playability",
    capturedAt,
    title: entry.project,
    summary: "Normalized public candidate source used by the shadow decision."
  })];
  const firstProofIds = [];
  const finalProofIds = [];
  const firstProofUrls = new Set(
    (firstAdmission.lane_results?.indie_prelaunch?.evidence?.quality_proofs ?? [])
      .map((item) => sanitizePublicUrl(item.url))
  );
  const finalProofUrls = new Set(
    (finalAdmission.lane_results?.indie_prelaunch?.evidence?.quality_proofs ?? [])
      .map((item) => sanitizePublicUrl(item.url))
  );
  const proofItems = uniqueByUrl([
    ...(firstAdmission.lane_results?.indie_prelaunch?.evidence?.quality_proofs ?? []),
    ...(finalAdmission.lane_results?.indie_prelaunch?.evidence?.quality_proofs ?? [])
  ]);
  for (const proof of proofItems) {
    const url = sanitizePublicUrl(proof.url);
    const role = independentRoleForProof(proof, url, mediaSignals);
    const id = evidenceId(candidateId, "quality", url);
    catalog.push(evidenceRecord({
      evidenceId: id,
      gateId: "independent_quality_proof",
      url,
      sourceRole: role,
      family: role === "trusted_creator" ? "user_feedback" : "external_validation",
      capturedAt,
      title: String(proof.value ?? proof.title ?? "Independent public evidence"),
      summary: "Normalized bounded independent public evidence used by the shadow evaluator."
    }));
    if (INDEPENDENT_SOURCE_ROLES.has(role)) {
      if (firstProofUrls.has(url)) firstProofIds.push(id);
      if (finalProofUrls.has(url)) finalProofIds.push(id);
    }
  }
  return { catalog, defaultId, firstProofIds, finalProofIds };
}

function laneEvaluation(admission, evidence, indieLane) {
  return {
    input: safeAdmissionEvidence(admission.evidence),
    output: safeAdmissionOutput(admission),
    gate_results: (admission.gate_results ?? []).map((gate) => ({
      gate_id: gate.id,
      status: gate.status,
      hard_exclusion: indieLane
        && gate.status === "fail"
        && V73_HARD_EXCLUSION_GATES.has(gate.id),
      evidence_ids: gate.id === "independent_quality_proof"
        ? evidence.firstProofIds
        : gate.status === "unknown" ? [] : [evidence.defaultId]
    }))
  };
}

function regularSelection(admission) {
  return {
    status: admission.qualified ? "selected" : "rejected",
    lane: admission.sourcing_lane ?? null,
    reason_code: admission.qualified
      ? `${admission.sourcing_lane}_qualified`
      : `${admission.sourcing_lane ?? "regular"}_not_qualified`
  };
}

function transactionFromResult({
  candidateId,
  result,
  providerRecord,
  evaluatorDependencySha256,
  evidence
}) {
  const first = safeAdmissionOutput(result.first_pass);
  const final = safeAdmissionOutput(result.final_pass);
  return {
    transaction_id: providerRecord.transaction_id,
    candidate_id: candidateId,
    requested_actions: cloneValue(result.requested_actions ?? []),
    allowlisted_patch_fields: allowedPatchFields(result.requested_actions ?? []),
    bounded_signals: providerRecord.request.bounded_signals,
    provider_contract_version: "public-second-pass-v1",
    request_metrics: providerRecord.request_metrics,
    raw_provider_result: providerRecord.raw_provider_result,
    filtered_patch: providerRecord.filtered_patch,
    provider_status: providerRecord.provider_status,
    error: providerRecord.error,
    merged_final_input: {
      ...safeAdmissionEvidence(result.final_pass?.evidence ?? result.first_pass?.evidence ?? {}),
      qualified: first.qualified
    },
    final_output: {
      ...final,
      evidence_ids: [...evidence.finalProofIds]
    },
    decision_changed: first.qualified !== final.qualified || first.disposition !== final.disposition,
    changed_gate: changedGate(result.first_pass, result.final_pass),
    evaluator_dependency_sha256: evaluatorDependencySha256
  };
}

function publicationForEntry({ candidateId, entry, admission, audit, shadowPools }) {
  const decision = audit?.decision ?? (admission.qualified ? "formal" : admission.disposition === "excluded" ? "excluded" : "candidate");
  const lead = shadowPools.push.find((item) => (
    entry.steamAppId
      ? String(item.steam_app_id ?? "") === String(entry.steamAppId)
      : String(item.project ?? "").trim() === String(entry.project ?? "").trim()
  ));
  const inPush = Boolean(lead);
  return {
    decision: inPush ? "formal" : decision === "formal" ? "candidate" : decision,
    selected_lane: admission.sourcing_lane ?? null,
    shadow_push_pool: inPush,
    dedupe_suppressed: admission.qualified === true && !inPush,
    shadow_lead_payload_sha256: inPush
      ? sha256Canonical(privacyStrippedLead(lead, candidateId))
      : null,
    risk_flags: uniqueStrings(admission.exclusion_reasons ?? []),
    day_lead_count_used: false
  };
}

function buildSecondPass(candidates, transactions, selectionOrder) {
  const eligibleIds = candidates
    .filter((item) => item.second_pass.eligible)
    .sort((left, right) => (
      left.ranking_inputs.action_count - right.ranking_inputs.action_count
      || right.ranking_inputs.discovery_score - left.ranking_inputs.discovery_score
      || left.ranking_inputs.dedupe_key.localeCompare(right.ranking_inputs.dedupe_key)
      || left.ranking_inputs.source_type.localeCompare(right.ranking_inputs.source_type)
    ))
    .map((item) => item.candidate_id);
  const candidateIds = new Set(candidates.map((item) => item.candidate_id));
  const selectedIds = selectionOrder.filter((id) => candidateIds.has(id));
  const attemptedSet = new Set(
    candidates.filter((item) => item.second_pass.attempted).map((item) => item.candidate_id)
  );
  const attemptedIds = selectedIds.filter((id) => attemptedSet.has(id));
  const failedIds = transactions
    .filter((item) => item.provider_status === "error" || item.provider_status === "timeout")
    .map((item) => item.candidate_id);
  const qualifiedIds = transactions
    .filter((item) => item.final_output.qualified === true)
    .map((item) => item.candidate_id);
  return {
    selector_version: "targeted-v1",
    max_candidates: C5B_SECOND_PASS_MAX_CANDIDATES,
    eligible_ids: eligibleIds,
    selected_ids: selectedIds,
    omitted_ids: eligibleIds.filter((id) => !selectedIds.includes(id)),
    attempted_ids: attemptedIds,
    failed_ids: failedIds,
    qualified_ids: qualifiedIds,
    transactions
  };
}

function buildSummary(candidates, evidenceCatalog, secondPass) {
  const countDecision = (decision) => candidates.filter((item) => item.publication.decision === decision).length;
  return {
    candidate_count: candidates.length,
    evidence_count: evidenceCatalog.length,
    second_pass_eligible_count: secondPass.eligible_ids.length,
    second_pass_selected_count: secondPass.selected_ids.length,
    second_pass_attempted_count: secondPass.attempted_ids.length,
    second_pass_failed_count: secondPass.failed_ids.length,
    second_pass_qualified_count: secondPass.qualified_ids.length,
    formal_count: countDecision("formal"),
    candidate_decision_count: countDecision("candidate"),
    excluded_count: countDecision("excluded"),
    shadow_push_pool_count: candidates.filter((item) => item.publication.shadow_push_pool).length
  };
}

function buildDiscoverySummary({ steamBefore, mediaBefore, candidateCount }) {
  return {
    decision_universe_count: candidateCount,
    sources: [
      { source_id: "steam", raw_count: steamBefore.length, retained_count: steamBefore.length, failure_count: 0 },
      { source_id: "media", raw_count: mediaBefore.length, retained_count: mediaBefore.length, failure_count: 0 }
    ]
  };
}

function normalizedBudgetLimits(input) {
  return {
    max_candidates: boundedInteger(input.max_candidates, 320, 0, 360),
    max_steam_details: boundedInteger(input.max_steam_details, 90, 0, 160),
    new_lane: boundedInteger(input.new_lane, 40, 0, 160),
    backlog_lane: boundedInteger(input.backlog_lane, 30, 0, 160),
    retry_refresh_lane: boundedInteger(input.retry_refresh_lane, 20, 0, 160),
    snapshot_ttl_days: boundedInteger(input.snapshot_ttl_days, 7, 0, 365),
    second_pass_max_candidates: C5B_SECOND_PASS_MAX_CANDIDATES,
    actions_per_candidate_min: 1,
    actions_per_candidate_max: 3,
    provider_request_limit: C5B_SECOND_PASS_MAX_CANDIDATES,
    provider_retry_limit: C5B_PROVIDER_RETRY_LIMIT,
    scheduled_network_budget: boundedInteger(input.scheduled_network_budget, 90, 0, 360)
  };
}

function normalizedBudgetUsage({ budgetUsage, candidates, transactions }) {
  const candidateIds = new Set(candidates.map((item) => item.candidate_id));
  const filterCandidates = (values) => uniqueStrings(values).filter((id) => candidateIds.has(id));
  const fresh = filterCandidates(budgetUsage.fresh_steam_detail_candidate_ids ?? []);
  const scheduled = filterCandidates(budgetUsage.scheduled_network_candidate_ids ?? fresh);
  const reusedFromCandidates = candidates
    .filter((item) => item.snapshot_status === "reused")
    .map((item) => item.candidate_id);
  const reused = filterCandidates(budgetUsage.reused_snapshot_candidate_ids ?? reusedFromCandidates);
  const transactionIds = transactions.map((item) => item.transaction_id);
  return {
    fresh_steam_detail_requests: fresh.length,
    scheduled_network_requests: scheduled.length,
    reused_snapshot_count: reused.length,
    provider_requests: transactionIds.length,
    fresh_steam_detail_candidate_ids: fresh,
    scheduled_network_candidate_ids: scheduled,
    reused_snapshot_candidate_ids: reused,
    provider_transaction_ids: transactionIds
  };
}

async function artifactBinding(rootDir, relativePath, kind) {
  const content = await readFile(path.join(rootDir, relativePath));
  const payload = JSON.parse(content.toString("utf8"));
  return {
    path: relativePath,
    git_blob_sha: gitBlobSha(content),
    payload_sha256: sha256Canonical(payload),
    record_count: artifactRecordCount(payload, kind),
    validation_status: "valid"
  };
}

function artifactRecordCount(payload, kind) {
  if (kind === "receipt") return 1;
  if (kind === "sourcing_candidates") return Array.isArray(payload.candidates) ? payload.candidates.length : 0;
  if (kind === "report") {
    return ["push_pool", "watch_pool", "drop_pool"]
      .reduce((total, key) => total + (Array.isArray(payload[key]) ? payload[key].length : 0), 0);
  }
  for (const key of ["items", "radar_items", "trends", "steam_trends"]) {
    if (Array.isArray(payload[key])) return payload[key].length;
  }
  return 0;
}

async function findPendingPath({ rootDir, reportDate, runSlot }) {
  const runtimeDir = path.join(rootDir, "data", "runtime");
  let entries;
  try {
    entries = await import("node:fs/promises").then(({ readdir }) => readdir(runtimeDir));
  } catch {
    return null;
  }
  const suffix = `-${runSlot}.json`;
  const name = entries
    .filter((item) => item.startsWith(`${reportDate}-c5b-shadow-`) && item.endsWith(suffix))
    .sort()
    .at(-1);
  return name ? path.join(runtimeDir, name) : null;
}

function pendingRelativePath(core) {
  return `data/runtime/${core.report_date}-c5b-shadow-${core.workflow_run_id}-${core.run_attempt}-${core.run_slot}.json`;
}

function corpusId(reportDate, runContext) {
  return `${reportDate}/${positiveInteger(runContext.workflow_run_id, "workflow_run_id")}/${positiveInteger(runContext.run_attempt ?? 1, "run_attempt")}/${String(runContext.run_slot)}`;
}

function evidenceRecord({
  evidenceId,
  gateId,
  url,
  sourceRole,
  family,
  capturedAt,
  title,
  summary
}) {
  const safeUrl = sanitizePublicUrl(url);
  return {
    evidence_id: evidenceId,
    evidence_type: "public_url",
    gate_id: gateId,
    url: safeUrl,
    source_id: sourceIdFromUrl(safeUrl),
    source_role: sourceRole,
    evidence_family: family,
    captured_at: normalizedCapturedAt(capturedAt),
    title: boundedText(title, 240),
    normalized_summary: boundedText(summary, 500),
    content_sha256: sha256Canonical({ url: safeUrl, title: boundedText(title, 240), summary: boundedText(summary, 500) }),
    source_status: "success",
    fetch_error: null,
    official_public_business_entry: false
  };
}

function safeAdmissionEvidence(value) {
  const evidence = cloneValue(value ?? {});
  if (Array.isArray(evidence.business_entrypoints)) {
    evidence.business_entrypoints = evidence.business_entrypoints.map((item) => ({
      type: boundedText(item?.type, 80),
      value: boundedText(item?.value, 500),
      ...(item?.url ? { url: sanitizePublicUrl(item.url) } : {}),
      official_public_business_entry: true
    }));
  }
  return evidence;
}

function safeAdmissionOutput(admission = {}) {
  return cloneValue({
    qualified: admission.qualified === true,
    disposition: admission.disposition ?? "candidate",
    sourcing_lane: admission.sourcing_lane ?? null,
    sourcing_rule_version: admission.sourcing_rule_version ?? V73_OBTAINABLE_EVIDENCE_RULE_VERSION,
    failed_gates: admission.failed_gates ?? [],
    missing_evidence: admission.missing_evidence ?? [],
    exclusion_reasons: admission.exclusion_reasons ?? [],
    gate_results: admission.gate_results ?? []
  });
}

function safeProviderRequest(request = {}) {
  return {
    candidate_id: String(request.evidence?.dedupe_key ?? ""),
    source_type: String(request.source_type ?? ""),
    actions: cloneValue(request.actions ?? []),
    bounded_signals: publicSignals(request.mediaSignals ?? []).slice(0, 24)
  };
}

function providerPrivacyBoundary(raw) {
  const value = cloneValue(raw);
  if (Array.isArray(value.business_entrypoints)) {
    value.business_entrypoints = value.business_entrypoints.map((item) => ({
      ...item,
      official_public_business_entry: true
    }));
  }
  return value;
}

function filterProviderPatch(raw, actions) {
  const allowed = new Set(allowedPatchFields(actions));
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([key]) => allowed.has(key))
      .map(([key, value]) => [key, cloneValue(value)])
  );
}

function allowedPatchFields(actions) {
  const fields = new Set();
  for (const item of actions) {
    for (const field of SUPPORTED_ACTION_FIELDS.get(item?.action) ?? []) fields.add(field);
  }
  return [...fields].sort();
}

function publicProviderContext(value = {}) {
  return {
    reportDate: value.reportDate,
    maxBilibiliLeadAgeDays: boundedInteger(value.maxBilibiliLeadAgeDays, 120, 1, 365),
    ...(typeof value.fetchOfficialBilibiliCandidatesImpl === "function"
      ? { fetchOfficialBilibiliCandidatesImpl: value.fetchOfficialBilibiliCandidatesImpl }
      : {}),
    ...(typeof value.fetchTextImpl === "function" ? { fetchTextImpl: value.fetchTextImpl } : {}),
    ...(typeof value.sleepImpl === "function" ? { sleepImpl: value.sleepImpl } : {})
  };
}

function publicSignals(items) {
  return (Array.isArray(items) ? items : []).flatMap((item) => {
    const rawUrl = item?.link ?? item?.url;
    let url;
    try {
      url = sanitizePublicUrl(rawUrl);
    } catch {
      return [];
    }
    return [{
      source_id: sourceIdFromUrl(url),
      source: boundedText(item?.source, 160),
      title: boundedText(item?.title, 240),
      url,
      source_role: sourceRoleForSignal(item, url)
    }];
  });
}

function normalizedCandidate(entry, evidence = {}) {
  return {
    project: boundedText(evidence.project ?? entry.project, 240),
    steam_app_id: stringOrNull(evidence.steam_app_id ?? entry.steamAppId),
    dedupe_key: entry.dedupeKey,
    source_type: entry.sourceTypes.size > 1 ? "multi_source" : [...entry.sourceTypes][0],
    region: stringOrNull(evidence.region),
    release_state: stringOrNull(evidence.release_state),
    release_window: stringOrNull(evidence.release_window),
    early_access_state: stringOrNull(evidence.early_access_state),
    publisher_occupancy: stringOrNull(evidence.publisher_occupancy),
    narrative_state: stringOrNull(evidence.narrative_state),
    india_team_state: stringOrNull(evidence.india_team_state)
  };
}

function privacyStrippedLead(lead, candidateId) {
  return {
    candidate_id: candidateId,
    project: boundedText(lead?.project, 240),
    steam_app_id: stringOrNull(lead?.steam_app_id),
    sourcing_lane: stringOrNull(lead?.sourcing_lane),
    sourcing_rule_version: stringOrNull(lead?.sourcing_rule_version),
    links: uniqueStrings((lead?.links ?? []).flatMap((item) => {
      try { return [sanitizePublicUrl(item)]; } catch { return []; }
    }))
  };
}

function candidatePublicUrl(candidate, sourceTypes) {
  const values = sourceTypes.has("steam")
    ? [candidate?.storeUrl, candidate?.href, candidate?.appId ? `https://store.steampowered.com/app/${candidate.appId}/` : null]
    : [candidate?._mediaItem?.link, ...(candidate?.links ?? [])];
  for (const value of values) {
    try { return sanitizePublicUrl(value); } catch {}
  }
  throw new Error("C5-B candidate is missing a public evidence URL");
}

function independentRoleForProof(proof, url, mediaSignals) {
  const explicit = String(proof?.source_role ?? proof?.source_kind ?? "").toLowerCase();
  if (EVIDENCE_SOURCE_ROLES.has(explicit)) return explicit;
  if (/trusted_creator|creator_playtest/i.test(String(proof?.type ?? ""))) {
    return "trusted_creator";
  }
  const fromSignal = sourceRoleForUrl(url, mediaSignals);
  return EVIDENCE_SOURCE_ROLES.has(fromSignal) ? fromSignal : "unclassified";
}

function sourceRoleForUrl(url, signals) {
  const signal = signals.find((item) => item.url === url || item.link === url);
  return signal?.source_role ?? sourceRoleForSignal(signal, url);
}

function sourceRoleForSignal(item, url) {
  const kind = String(item?.bilibili_probe?.source_kind ?? item?.source_role ?? "").toLowerCase();
  if (kind === "trusted_creator") return "trusted_creator";
  if (kind === "media") return "media";
  if (kind === "official" || kind === "developer" || kind === "publisher" || kind === "keyword") return kind;
  return "unclassified";
}

function secondPassEligible(admission) {
  const actions = admission?.next_evidence_actions ?? [];
  return admission?.qualified !== true
    && admission?.disposition !== "excluded"
    && actions.length >= 1
    && actions.length <= 3
    && actions.every((item) => SUPPORTED_ACTION_FIELDS.has(item?.action));
}

function secondPassRejection(admission) {
  if (admission?.qualified === true) return "already_qualified";
  if (admission?.disposition === "excluded") return "hard_exclusion";
  return "unsupported_or_unobtainable_gap";
}

function originSignalId(sourceType, candidate, evidence) {
  const raw = sourceType === "steam"
    ? `steam:${evidence.steam_app_id ?? candidate?.appId ?? evidence.dedupe_key}`
    : `media:${candidate?._mediaItem?.link ?? candidate?.links?.[0] ?? evidence.dedupe_key}`;
  return `signal:${createHash("sha256").update(String(raw)).digest("hex").slice(0, 24)}`;
}

function evidenceId(candidateId, family, url) {
  return `evidence:${createHash("sha256")
    .update(`${candidateId}\0${family}\0${url}`)
    .digest("hex")
    .slice(0, 24)}`;
}

function changedGate(first, final) {
  const finalById = new Map((final?.gate_results ?? []).map((item) => [item.id, item.status]));
  return (first?.gate_results ?? []).find((item) => finalById.get(item.id) !== item.status)?.id ?? null;
}

function snapshotStatus(state, sourceTypes) {
  if (!sourceTypes.has("steam")) return "not_applicable";
  if (!state) return "missing";
  if (state.scheduler_lane === "reuse") return "reused";
  if (state.enrichment_status === "success") return "fresh_success";
  if (state.enrichment_status === "failed") return "failed";
  return "missing";
}

function evidenceFreshness(state, sourceTypes) {
  const status = snapshotStatus(state, sourceTypes);
  if (status === "not_applicable") return "not_applicable";
  if (status === "reused") return "reused";
  if (status === "fresh_success") return "fresh";
  return "missing";
}

function schedulerLane(state) {
  const value = String(state?.scheduler_lane ?? "");
  return ["new", "backlog", "retry_refresh", "reuse"].includes(value) ? value : "not_applicable";
}

function enrichmentStatus(state, sourceTypes) {
  if (!sourceTypes.has("steam")) return "not_applicable";
  const value = String(state?.enrichment_status ?? "");
  return ["pending", "success", "failed"].includes(value) ? value : "not_applicable";
}

function sourceHealthStatus(receipt) {
  if (receipt.generation_status !== "success" || receipt.validation_status !== "success") return "failed";
  const failures = Number(receipt?.volume_diagnostics?.source_failures ?? 0);
  return failures > 0 ? "degraded" : "healthy";
}

function normalizedRunStatus(value) {
  return ["success", "failed", "skipped"].includes(value) ? value : "skipped";
}

function parseSyncResponse(value) {
  if (isPlainObject(value)) return value;
  try { return JSON.parse(String(value ?? "")); } catch { return { synced: false }; }
}

function validateBehaviorAuthority(manifest) {
  if (!isPlainObject(manifest) || Object.keys(manifest).length === 0) {
    throw new Error("C5-B behavior manifest is empty");
  }
  for (const [key, value] of Object.entries(manifest)) {
    if (!/^[0-9a-f]{40}$/.test(value)) throw new Error(`C5-B invalid behavior blob for ${key}`);
  }
}

function sortedManifest(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function stabilizePayloadMetrics(corpus) {
  for (let index = 0; index < 12; index += 1) {
    const before = `${corpus.integrity.byte_size}:${corpus.integrity.inline_text_characters}`;
    const metrics = measureReplayCorpusPayload(corpus);
    corpus.integrity.byte_size = metrics.byte_size;
    corpus.integrity.inline_text_characters = metrics.inline_text_characters;
    const after = `${corpus.integrity.byte_size}:${corpus.integrity.inline_text_characters}`;
    if (before === after) return;
  }
}

function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`C5-B provider timed out after ${timeoutMs}ms`);
      error.code = "C5B_PROVIDER_TIMEOUT";
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function gitBlobSha(content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  return createHash("sha1").update(`blob ${buffer.length}\0`).update(buffer).digest("hex");
}

function gitSha(value) {
  const sha = String(value ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("C5-B input commit SHA is invalid");
  return sha;
}

function sanitizePublicUrl(value) {
  const url = new URL(String(value ?? ""));
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("C5-B evidence URL must be public HTTP(S)");
  url.username = "";
  url.password = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/token|secret|signature|sig|auth|password|key/i.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

function sourceIdFromUrl(value) {
  const url = new URL(value);
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function isBilibiliUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "bilibili.com" || host.endsWith(".bilibili.com") || host === "b23.tv" || host.endsWith(".b23.tv");
  } catch { return false; }
}

function uniqueByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    let url;
    try { url = sanitizePublicUrl(item?.url); } catch { return false; }
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function cloneMap(value) {
  return new Map([...value.entries()].map(([key, item]) => [key, cloneValue(item)]));
}

function cloneValue(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function dispositionRank(value) {
  return value === "formal" ? 3 : value === "candidate" ? 2 : 1;
}

function boundedText(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function stringOrNull(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => String(item ?? "").trim()).filter(Boolean))];
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function nonNegativeInteger(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function positiveInteger(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`C5-B ${name} must be a positive integer`);
  return number;
}

function assertDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) throw new Error("C5-B report date is invalid");
}

function validDateOr(value, fallback) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "")) ? String(value) : fallback;
}

function normalizedCapturedAt(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) {
    throw new Error("C5-B captured_at is invalid");
  }
  return text;
}

function normalizedNodeVersion(value) {
  const text = String(value ?? "").trim().replace(/^v/, "");
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(text)) throw new Error("C5-B node version is invalid");
  return text;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
