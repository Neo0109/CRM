#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { serializeArtifact } from "./online_daily_v4_artifacts.mjs";
import { runSteamReviewOpportunityAudit } from "./steam_review_opportunity_audit.mjs";
import { validateSteamReviewOpportunityArtifact } from "./steam_review_opportunity_artifact.mjs";

const ruleConfig = loadRuleConfig();

export const STEAM_REVIEW_DELIVERY_SCHEMA_VERSION = 1;
export const STEAM_REVIEW_RULE_VERSION = ruleConfig.rule_version;

export function resolveSteamReviewRunMode(requestedMode = "auto", receipts = []) {
  const mode = String(requestedMode ?? "auto").trim().toLowerCase();
  if (mode === "backfill" || mode === "scheduled") return mode;
  if (mode !== "auto") throw new Error(`Unsupported Steam review opportunity mode: ${requestedMode}`);
  return receipts.some(isStrictSuccessfulBackfillReceipt) ? "scheduled" : "backfill";
}

export function selectSteamReviewDeliveryCandidates({ artifact, priorArtifacts = [], priorReceipts = [], mode }) {
  validateSteamReviewOpportunityArtifact(artifact);
  if (artifact.scan_summary.scan_complete !== true) {
    throw new Error("Steam review opportunity CRM delivery requires scan_complete=true");
  }
  const resolvedMode = resolveSteamReviewRunMode(mode, []);
  const qualified = artifact.opportunities.filter((item) => item.decision === "qualified");
  const previouslyQualifiedAppIds = resolvedMode === "scheduled"
    ? priorQualifiedAppIds(priorArtifacts, priorReceipts)
    : new Set();
  const candidates = qualified.filter((item) => !previouslyQualifiedAppIds.has(item.steam_app_id));

  return {
    candidates,
    qualifiedCount: qualified.length,
    previouslyQualifiedCount: qualified.length - candidates.length,
    importCandidateCount: candidates.length
  };
}

export function buildSteamReviewImportReport({ artifact, priorArtifacts = [], priorReceipts = [], mode }) {
  const resolvedMode = resolveSteamReviewRunMode(mode, []);
  const selection = selectSteamReviewDeliveryCandidates({ artifact, priorArtifacts, priorReceipts, mode: resolvedMode });
  const sourcingRunType = runTypeForMode(resolvedMode);
  return {
    report_date: artifact.report_date,
    summary: `V7.1 Steam review opportunities: ${selection.qualifiedCount} qualified, ${selection.importCandidateCount} eligible for create-only import.`,
    insights: [
      `catalog_scan_count=${artifact.scan_summary.unique_apps_seen}`,
      `qualified_count=${selection.qualifiedCount}`,
      `previously_qualified_count=${selection.previouslyQualifiedCount}`,
      `import_candidate_count=${selection.importCandidateCount}`
    ],
    push_pool: selection.candidates.map((item) => opportunityToLead(item, {
      reportDate: artifact.report_date,
      sourcingRunType,
      artifactPath: `data/steam_review_opportunities/${artifact.report_date}.json`
    })),
    watch_pool: [],
    drop_pool: []
  };
}

export async function prepareSteamReviewOpportunityDelivery(options = {}) {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const reportDate = requiredDate(options.reportDate);
  const runSlot = safeSegment(options.runSlot ?? "manual");
  const generatedAt = options.generatedAt;
  const auditImpl = options.auditImpl ?? runSteamReviewOpportunityAudit;
  const artifactDir = path.join(rootDir, "data/steam_review_opportunities");
  const receiptDir = path.join(rootDir, "data/steam_review_opportunity_runs");
  const runtimeDir = path.join(rootDir, "data/runtime");
  await mkdir(artifactDir, { recursive: true });
  await mkdir(runtimeDir, { recursive: true });

  const priorArtifacts = await readJsonDirectory(artifactDir);
  const priorReceipts = await readJsonDirectory(receiptDir, { missingOk: true });
  const requestedMode = String(options.requestedMode ?? "auto").trim().toLowerCase();
  const mode = resolveSteamReviewRunMode(requestedMode, priorReceipts);
  const collectOptions = normalizeCollectOptions(options.collectOptions);
  const audit = await auditImpl({
    rootDir,
    reportDate,
    generatedAt,
    collectOptions
  });
  validateSteamReviewOpportunityArtifact(audit.artifact);

  const artifactPath = relativeRepoPath(rootDir, audit.outputPath);
  const artifactSha256 = steamReviewOpportunityArtifactSha256(audit.artifact);
  const importPayloadFile = path.join(runtimeDir, `${reportDate}-${runSlot}-steam-review-import.json`);
  const preparationFile = path.join(runtimeDir, `${reportDate}-${runSlot}-steam-review-preparation.json`);
  let importPayloadPath = null;
  let selection = { qualifiedCount: audit.artifact.scan_summary.qualified, previouslyQualifiedCount: 0, importCandidateCount: 0 };

  if (audit.artifact.scan_summary.scan_complete === true) {
    selection = selectSteamReviewDeliveryCandidates({ artifact: audit.artifact, priorArtifacts, priorReceipts, mode });
    const report = buildSteamReviewImportReport({ artifact: audit.artifact, priorArtifacts, priorReceipts, mode });
    await writeFile(importPayloadFile, serializeArtifact(report), "utf8");
    importPayloadPath = relativeRepoPath(rootDir, importPayloadFile);
  }

  const preparation = {
    schema_version: STEAM_REVIEW_DELIVERY_SCHEMA_VERSION,
    report_date: reportDate,
    run_slot: runSlot,
    requested_mode: requestedMode,
    mode,
    sourcing_run_type: runTypeForMode(mode),
    generated_at: audit.artifact.generated_at,
    scan_complete: audit.artifact.scan_summary.scan_complete === true,
    ready_for_sync: audit.artifact.scan_summary.scan_complete === true,
    artifact_path: artifactPath,
    artifact_sha256: artifactSha256,
    import_payload_path: importPayloadPath,
    catalog_scan_count: audit.artifact.scan_summary.unique_apps_seen,
    catalog_entries_seen: audit.artifact.scan_summary.catalog_entries_seen,
    qualified_count: selection.qualifiedCount,
    previously_qualified_count: selection.previouslyQualifiedCount,
    import_candidate_count: selection.importCandidateCount,
    failure_reason: audit.artifact.scan_summary.scan_complete === true ? null : "scan_incomplete",
    collect_options: collectOptions
  };
  await writeFile(preparationFile, serializeArtifact(preparation), "utf8");

  return {
    artifact: audit.artifact,
    preparation,
    preparationPath: preparationFile,
    importPayloadPath: importPayloadPath ? importPayloadFile : null
  };
}

export function buildSteamReviewOpportunityReceipt({
  preparation,
  syncResponse,
  runId = null,
  runNumber = null,
  repository = null,
  headSha = null,
  capturedAt = new Date().toISOString()
}) {
  const response = normalizeSyncResponse(syncResponse, preparation);
  const createdCount = nonNegativeInteger(response.created) ?? 0;
  const deduplicatedCount = nonNegativeInteger(response.skipped_existing) ?? 0;
  const updatedCount = nonNegativeInteger(response.updated) ?? 0;
  const success = preparation?.scan_complete === true
    && preparation?.ready_for_sync === true
    && response.synced === true
    && updatedCount === 0
    && createdCount + deduplicatedCount === preparation.import_candidate_count;
  const status = success
    ? "success"
    : preparation?.scan_complete === true
      ? "sync_failed"
      : "scan_incomplete";

  const receipt = {
    schema_version: STEAM_REVIEW_DELIVERY_SCHEMA_VERSION,
    report_date: preparation.report_date,
    run_slot: preparation.run_slot,
    requested_mode: preparation.requested_mode,
    mode: preparation.mode,
    sourcing_run_type: preparation.sourcing_run_type,
    status,
    scan_complete: preparation.scan_complete === true,
    artifact_path: preparation.artifact_path,
    artifact_sha256: preparation.artifact_sha256,
    catalog_scan_count: integerOrZero(preparation.catalog_scan_count),
    catalog_entries_seen: integerOrZero(preparation.catalog_entries_seen),
    qualified_count: integerOrZero(preparation.qualified_count),
    previously_qualified_count: integerOrZero(preparation.previously_qualified_count),
    import_candidate_count: integerOrZero(preparation.import_candidate_count),
    deduplicated_count: deduplicatedCount,
    created_count: createdCount,
    updated_count: updatedCount,
    failure_reason: success ? null : preparation.failure_reason ?? response.error ?? response.reason ?? "sync_failed",
    run_id: nullableString(runId),
    run_number: nullableString(runNumber),
    run_url: repository && runId ? `https://github.com/${repository}/actions/runs/${runId}` : null,
    head_sha: nullableString(headSha),
    captured_at: capturedAt,
    sync_response: response
  };
  validateSteamReviewOpportunityReceipt(receipt);
  return receipt;
}

export function validateSteamReviewOpportunityReceipt(receipt) {
  const errors = [];
  if (receipt?.schema_version !== STEAM_REVIEW_DELIVERY_SCHEMA_VERSION) errors.push("schema_version must be 1");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(receipt?.report_date ?? ""))) errors.push("report_date must use YYYY-MM-DD");
  if (!receipt?.run_slot) errors.push("run_slot is required");
  if (!["backfill", "scheduled"].includes(receipt?.mode)) errors.push("mode must be backfill or scheduled");
  if (!["initial_backfill", "scheduled"].includes(receipt?.sourcing_run_type)) errors.push("sourcing_run_type is invalid");
  if (!["success", "scan_incomplete", "sync_failed"].includes(receipt?.status)) errors.push("status is invalid");
  if (receipt?.artifact_path !== artifactPathFor({ report_date: receipt?.report_date })) {
    errors.push("artifact_path must match report_date");
  }
  if (!/^[a-f0-9]{64}$/.test(String(receipt?.artifact_sha256 ?? ""))) {
    errors.push("artifact_sha256 must be a lowercase SHA-256 digest");
  }
  for (const key of [
    "catalog_scan_count",
    "catalog_entries_seen",
    "qualified_count",
    "previously_qualified_count",
    "import_candidate_count",
    "deduplicated_count",
    "created_count",
    "updated_count"
  ]) {
    if (nonNegativeInteger(receipt?.[key]) === null) errors.push(`${key} must be a non-negative integer`);
  }
  if (receipt?.status === "success") {
    if (receipt.scan_complete !== true) errors.push("success requires scan_complete=true");
    if (receipt.sync_response?.synced !== true) errors.push("success requires sync_response.synced=true");
    if (receipt.updated_count !== 0) errors.push("success requires updated_count=0");
    if (receipt.created_count + receipt.deduplicated_count !== receipt.import_candidate_count) {
      errors.push("success requires created_count + deduplicated_count = import_candidate_count");
    }
    if (receipt.failure_reason !== null) errors.push("success requires failure_reason=null");
  }
  if (receipt?.scan_complete !== true && receipt?.sync_response?.synced === true) {
    errors.push("incomplete scan cannot have sync_response.synced=true");
  }
  if (errors.length) throw new Error(`Steam review opportunity receipt validation failed:\n- ${errors.join("\n- ")}`);
  return { ok: true };
}

function opportunityToLead(opportunity, { reportDate, sourcingRunType, artifactPath }) {
  const review = opportunity.steam_review_summary;
  const matchedRules = [...new Set(opportunity.matched_rules)];
  const storeUrl = opportunity.store_url;
  const positiveRate = formatRate(review.positive_rate);
  return {
    id: `steam-review-${opportunity.steam_app_id}`,
    project: opportunity.project,
    steam_app_id: opportunity.steam_app_id,
    country: "未知",
    region: "海外",
    region_priority: "其他",
    bucket: "未处理",
    stage: "new",
    priority: null,
    sourcing_lane: opportunity.primary_lane,
    sourcing_rule_version: STEAM_REVIEW_RULE_VERSION,
    sourcing_run_type: sourcingRunType,
    priority_reason: null,
    rule_fit: `V7.1 matched_rules=${matchedRules.join(",")}; primary_lane=${opportunity.primary_lane}`,
    progress: opportunity.early_access.confirmed_current ? "Steam 抢先体验" : "Steam 已发行或抢先体验",
    early_access: opportunity.early_access.confirmed_current === true,
    publisher_status: "待确认",
    traction_summary: `Steam 简中评测 ${review.total_reviews} 条，好评率 ${positiveRate}%`,
    public_signals: `Steam language=schinese, purchase_type=all, positive=${review.positive_reviews}, negative=${review.negative_reviews}, total=${review.total_reviews}`,
    contact_methods: [{ type: "Steam", value: storeUrl, note: "公开数据来源，非商务联系人" }],
    links: [storeUrl],
    exposure_trail: artifactPath,
    bilibili_fit: "待评估",
    amplification: "待评估",
    risks: "发行商、题材、地区、视觉表现和手游化仅作为风险信息，待人工复核，不参与本通道准入。",
    verdict: "满足 V7.1 EA/中文热度准入；待人工评估业务价值。",
    next_action: null,
    first_seen: reportDate,
    notes: null
  };
}

function priorQualifiedAppIds(priorArtifacts, priorReceipts) {
  const successfullyDeliveredArtifacts = new Set(
    priorReceipts
      .filter(isStrictSuccessfulDeliveryReceipt)
      .map(artifactIdentityForReceipt)
  );
  const result = new Set();
  for (const artifact of priorArtifacts) {
    validateSteamReviewOpportunityArtifact(artifact);
    if (artifact.scan_summary.scan_complete !== true) continue;
    if (!successfullyDeliveredArtifacts.has(artifactIdentityForArtifact(artifact))) continue;
    for (const opportunity of artifact.opportunities) {
      if (opportunity.decision === "qualified") result.add(opportunity.steam_app_id);
    }
  }
  return result;
}

function artifactPathFor(artifact) {
  return `data/steam_review_opportunities/${artifact?.report_date}.json`;
}

function artifactIdentityForArtifact(artifact) {
  return `${artifactPathFor(artifact)}#${steamReviewOpportunityArtifactSha256(artifact)}`;
}

function artifactIdentityForReceipt(receipt) {
  return `${receipt.artifact_path}#${receipt.artifact_sha256}`;
}

function steamReviewOpportunityArtifactSha256(artifact) {
  return createHash("sha256").update(serializeArtifact(artifact)).digest("hex");
}

function isStrictSuccessfulDeliveryReceipt(receipt) {
  return receipt?.schema_version === STEAM_REVIEW_DELIVERY_SCHEMA_VERSION
    && receipt?.scan_complete === true
    && receipt?.status === "success"
    && receipt?.sync_response?.synced === true
    && receipt?.updated_count === 0
    && receipt?.failure_reason === null
    && nonNegativeInteger(receipt?.created_count) !== null
    && nonNegativeInteger(receipt?.deduplicated_count) !== null
    && nonNegativeInteger(receipt?.import_candidate_count) !== null
    && receipt.created_count + receipt.deduplicated_count === receipt.import_candidate_count
    && receipt?.artifact_path === artifactPathFor({ report_date: receipt?.report_date })
    && /^[a-f0-9]{64}$/.test(String(receipt?.artifact_sha256 ?? ""));
}

function isStrictSuccessfulBackfillReceipt(receipt) {
  return receipt?.mode === "backfill"
    && receipt?.sourcing_run_type === "initial_backfill"
    && isStrictSuccessfulDeliveryReceipt(receipt);
}

function runTypeForMode(mode) {
  const runType = ruleConfig.run_modes[mode];
  if (!runType) throw new Error(`No sourcing run type configured for mode: ${mode}`);
  return runType;
}

function normalizeCollectOptions(value = {}) {
  return {
    pageSize: boundedInteger(value?.pageSize, 100, 1, 100),
    concurrency: boundedInteger(value?.concurrency, 2, 1, 10),
    requestDelayMs: boundedInteger(value?.requestDelayMs, 250, 0, 10000)
  };
}

async function readJsonDirectory(directory, options = {}) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (options.missingOk && error?.code === "ENOENT") return [];
    throw error;
  }
  const values = [];
  for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(".json")).sort((a, b) => a.name.localeCompare(b.name))) {
    values.push(JSON.parse(await readFile(path.join(directory, entry.name), "utf8")));
  }
  return values;
}

function normalizeSyncResponse(value, preparation) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const response = structuredClone(value);
    if (typeof response.synced !== "boolean") response.synced = false;
    return response;
  }
  return {
    synced: false,
    reason: preparation?.scan_complete === true ? "sync_not_completed" : "scan_incomplete"
  };
}

function loadRuleConfig() {
  const filePath = fileURLToPath(new URL("../rules/steam-review-opportunities.json", import.meta.url));
  const config = JSON.parse(readFileSync(filePath, "utf8"));
  if (config.rule_version !== "sourcing-rules-v7.1") throw new Error("Steam review opportunity rule_version must be sourcing-rules-v7.1");
  if (config.source_contract !== "steam-schinese-reviews-v1") throw new Error("Steam review opportunity source contract mismatch");
  if (config.delivery_guardrails?.full_catalog_scan_required !== true) throw new Error("Full catalog scan must remain required");
  if (config.delivery_guardrails?.scan_complete_required_before_sync !== true) throw new Error("scan_complete must remain required before sync");
  if (config.delivery_guardrails?.crm_import_mode !== "create-only") throw new Error("CRM import mode must remain create-only");
  if (config.delivery_guardrails?.existing_leads_may_be_updated !== false) throw new Error("Existing Leads must remain immutable");
  if (config.delivery_guardrails?.suppression_history_requires_matching_success_receipt !== true) throw new Error("Suppression history must require a matching success receipt");
  if (config.delivery_guardrails?.suppression_history_artifact_identity !== "sha256") throw new Error("Suppression history must bind exact artifact content");
  if (config.delivery_guardrails?.failed_delivery_remains_retryable !== true) throw new Error("Failed deliveries must remain retryable");
  if (config.delivery_guardrails?.bearer_secret !== "CRM_AUTOMATION_TOKEN") throw new Error("Steam review delivery must use CRM_AUTOMATION_TOKEN");
  if (config.delivery_guardrails?.crm_access_token_bearer_fallback !== false) throw new Error("CRM_ACCESS_TOKEN Bearer fallback must remain disabled");
  if (config.delivery_guardrails?.missing_bearer_secret_status !== "sync_failed") throw new Error("Missing automation token must produce sync_failed");
  if (config.admission?.formal_lead_maximum !== null) throw new Error("V7.1 formal Lead count must remain unlimited");
  return config;
}

function requiredDate(value) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("reportDate must use YYYY-MM-DD");
  return text;
}

function safeSegment(value) {
  const text = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  if (!text) throw new Error("runSlot must not be empty");
  return text;
}

function relativeRepoPath(rootDir, filePath) {
  return path.relative(rootDir, path.resolve(filePath)).split(path.sep).join("/");
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function integerOrZero(value) {
  return nonNegativeInteger(value) ?? 0;
}

function nullableString(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function formatRate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(4)) : 0;
}

function parseArgs(argv) {
  const parsed = { command: argv[0] ?? "prepare" };
  for (const item of argv.slice(1)) {
    const match = item.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.command === "prepare") {
    const result = await prepareSteamReviewOpportunityDelivery({
      rootDir: process.cwd(),
      reportDate: args.date,
      runSlot: args.slot,
      requestedMode: args.mode ?? "auto",
      collectOptions: {
        pageSize: args.pageSize,
        concurrency: args.concurrency,
        requestDelayMs: args.requestDelayMs
      }
    });
    console.log(JSON.stringify({
      ok: true,
      preparation_path: result.preparationPath,
      import_payload_path: result.importPayloadPath,
      preparation: result.preparation
    }, null, 2));
    return;
  }

  if (args.command === "receipt") {
    const preparationPath = path.resolve(process.cwd(), args.preparation ?? "");
    const outputPath = path.resolve(process.cwd(), args.output ?? "");
    const preparation = JSON.parse(await readFile(preparationPath, "utf8"));
    const syncResponse = args.syncResponse
      ? JSON.parse(await readFile(path.resolve(process.cwd(), args.syncResponse), "utf8"))
      : null;
    const receipt = buildSteamReviewOpportunityReceipt({
      preparation,
      syncResponse,
      runId: process.env.GITHUB_RUN_ID,
      runNumber: process.env.GITHUB_RUN_NUMBER,
      repository: process.env.GITHUB_REPOSITORY,
      headSha: process.env.GITHUB_SHA
    });
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serializeArtifact(receipt), "utf8");
    console.log(JSON.stringify({ ok: true, output_path: outputPath, receipt }, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${args.command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
