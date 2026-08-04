import { createHash } from "node:crypto";

const CAPTURE_STATUSES = ["complete", "incomplete", "corrupt", "unreplayable"];
const EVENT_NAMES = ["schedule", "watchdog", "workflow_dispatch"];
const RUN_SLOTS = ["morning", "afternoon", "watchdog", "manual"];
const SOURCE_ROLES = [
  "official",
  "developer",
  "publisher",
  "media",
  "trusted_creator",
  "keyword",
  "unclassified"
];
const EVIDENCE_FAMILIES = [
  "playability",
  "product_performance",
  "external_validation",
  "early_market_signal",
  "team_execution",
  "user_feedback"
];
const REQUESTED_ACTION_GATE_IDS = [
  "identity_and_dedupe",
  "prelaunch_window",
  "publisher_china_capacity_clear",
  "non_narrative_product",
  "non_india_team",
  "official_playable_or_gameplay",
  "independent_quality_proof",
  "non_steam_business_entry",
  "concrete_china_bilibili_value"
];
const REQUESTED_ACTION_VALUES = [
  "resolve_project_identity",
  "verify_prelaunch_window",
  "verify_publisher_china_capacity",
  "verify_product_focus",
  "verify_team_region",
  "fetch_official_playable_or_gameplay",
  "fetch_independent_quality_evidence",
  "fetch_non_steam_business_entry",
  "research_china_bilibili_value"
];
const INDEPENDENT_SOURCE_ROLES = new Set(["media", "trusted_creator"]);
const CORPUS_REASON_CODES = [
  "capture_error",
  "schema_invalid",
  "hash_mismatch",
  "duplicate_id",
  "count_mismatch",
  "privacy_violation",
  "behavior_mismatch",
  "missing_transaction",
  "unreplayable_dependency"
];
const WINDOW_FAILURE_REASONS = [
  "missing_date",
  "no_canonical",
  "duplicate_date",
  "date_gap",
  "behavior_drift",
  "corpus_contract_drift",
  "contract_drift",
  "manual_only",
  "corpus_incomplete",
  "receipt_unhealthy",
  "payload_mismatch",
  "artifact_mismatch",
  "replay_mismatch"
];
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const DATE_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const SECRET_QUERY_NAMES = new Set([
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "auth",
  "authorization",
  "client_secret",
  "jwt",
  "password",
  "secret",
  "sig",
  "signature",
  "token"
]);
const AUTH_HEADER_KEYS = new Set(["authorization", "cookie", "setcookie"]);
const SECRET_FIELD_KEYS = new Set([
  "accesstoken",
  "refreshtoken",
  "apikey",
  "clientsecret",
  "privatekey",
  "authtoken",
  "bearertoken",
  "password",
  "secret"
]);
const PRIVATE_CRM_KEYS = new Set([
  "crmdedupeindex",
  "fullcrmindex",
  "privatecrmindex",
  "privatecrmdedupeindex"
]);
const PRIVATE_LEAD_KEYS = new Set([
  "leadidentity",
  "leadnotes",
  "leadowner",
  "owneremail",
  "ownerid",
  "privateleadidentity",
  "privatenotes"
]);
const PRIVATE_CONTACT_KEYS = new Set([
  "contactemail",
  "contactname",
  "contactphone",
  "personalemail",
  "personalphone",
  "qq",
  "wechat",
  "wecom"
]);
const RAW_HTML_KEYS = new Set([
  "html",
  "htmlbody",
  "rawhtml",
  "responsehtml"
]);
const RESPONSE_HEADER_KEYS = new Set([
  "headers",
  "responseheaders",
  "rawheaders"
]);

export class CanonicalJsonError extends TypeError {
  constructor(code, path, message) {
    super(`${code} at ${path || "/"}: ${message}`);
    this.name = "CanonicalJsonError";
    this.code = code;
    this.path = path || "/";
  }
}

export function canonicalJson(value) {
  return serializeCanonical(value, "", new WeakSet());
}

export function sha256Canonical(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function computeBehaviorContractSha256(behaviorManifest) {
  return sha256Canonical(behaviorManifest);
}

export function computeReplayCorpusPayloadSha256(corpus) {
  return sha256Canonical(replayCorpusPayloadView(corpus));
}

export function computeReplayWindowPayloadSha256(windowManifest) {
  return sha256Canonical(replayWindowPayloadView(windowManifest));
}

export function measureReplayCorpusPayload(corpus) {
  return payloadMetrics(replayCorpusPayloadView(corpus));
}

export function measureReplayWindowPayload(windowManifest) {
  return payloadMetrics(replayWindowPayloadView(windowManifest));
}

export function validateReplayPrivacy(value) {
  const errors = [];
  scanPrivacy(value, "", false, new WeakSet(), errors);
  return validationResult(errors);
}

export function validateReplayCorpus(corpus) {
  const errors = [];
  const canonical = validateCanonicalInput(corpus, errors);

  if (validateClosedObject(
    corpus,
    "",
    [
      "contract_version",
      "corpus_id",
      "report_date",
      "timezone",
      "captured_at",
      "event_name",
      "run_slot",
      "workflow_run_id",
      "run_attempt",
      "run_url",
      "input_commit_sha",
      "node_version",
      "active_production_rule_version",
      "shadow_rule_version",
      "collector_contract_version",
      "behavior_manifest",
      "behavior_contract_sha256",
      "capture_status",
      "capture_errors",
      "artifact_bindings",
      "delivery_health",
      "budgets",
      "discovery_summary",
      "evidence_catalog",
      "candidates",
      "second_pass",
      "summary",
      "integrity"
    ],
    [
      "contract_version",
      "corpus_id",
      "report_date",
      "timezone",
      "captured_at",
      "event_name",
      "run_slot",
      "workflow_run_id",
      "run_attempt",
      "run_url",
      "input_commit_sha",
      "node_version",
      "active_production_rule_version",
      "shadow_rule_version",
      "collector_contract_version",
      "behavior_manifest",
      "behavior_contract_sha256",
      "capture_status",
      "capture_errors",
      "artifact_bindings",
      "delivery_health",
      "budgets",
      "discovery_summary",
      "evidence_catalog",
      "candidates",
      "second_pass",
      "summary",
      "integrity"
    ],
    errors
  )) {
    validateConst(corpus.contract_version, 1, "/contract_version", errors);
    validateNonEmptyString(corpus.corpus_id, "/corpus_id", errors);
    validateDate(corpus.report_date, "/report_date", errors);
    validateConst(corpus.timezone, "Asia/Shanghai", "/timezone", errors);
    validateDateTime(corpus.captured_at, "/captured_at", errors);
    validateEnum(corpus.event_name, EVENT_NAMES, "/event_name", errors);
    validateEnum(corpus.run_slot, RUN_SLOTS, "/run_slot", errors);
    validateInteger(corpus.workflow_run_id, "/workflow_run_id", errors, 1);
    validateInteger(corpus.run_attempt, "/run_attempt", errors, 1);
    validatePublicUrl(corpus.run_url, "/run_url", errors);
    validatePattern(corpus.input_commit_sha, GIT_SHA_PATTERN, "/input_commit_sha", errors);
    validatePattern(corpus.node_version, /^v?[0-9]+\.[0-9]+(?:\.[0-9]+)?$/, "/node_version", errors);
    validateNonEmptyString(
      corpus.active_production_rule_version,
      "/active_production_rule_version",
      errors
    );
    validateConst(
      corpus.shadow_rule_version,
      "sourcing-rules-v7.3-obtainable-evidence",
      "/shadow_rule_version",
      errors
    );
    validateConst(corpus.collector_contract_version, 1, "/collector_contract_version", errors);
    validateBehaviorManifest(corpus.behavior_manifest, "/behavior_manifest", errors);
    validateSha256(corpus.behavior_contract_sha256, "/behavior_contract_sha256", errors);
    validateEnum(corpus.capture_status, CAPTURE_STATUSES, "/capture_status", errors);
    validateCaptureErrors(corpus.capture_errors, "/capture_errors", errors);
    validateArtifactBindings(corpus.artifact_bindings, "/artifact_bindings", errors);
    validateDeliveryHealth(corpus.delivery_health, "/delivery_health", errors);
    validateBudgets(corpus.budgets, "/budgets", errors);
    validateDiscoverySummary(corpus.discovery_summary, "/discovery_summary", errors);
    validateEvidenceCatalog(corpus.evidence_catalog, "/evidence_catalog", errors);
    validateCandidates(corpus.candidates, "/candidates", errors);
    validateRunSecondPass(corpus.second_pass, "/second_pass", errors);
    validateSummary(corpus.summary, "/summary", errors);
    validateCorpusIntegrity(corpus.integrity, "/integrity", errors);
  }

  errors.push(...validateReplayPrivacy(corpus).errors);

  if (isPlainObject(corpus)) {
    validateCaptureState(corpus, errors);
    validateCorpusCrossRecordIntegrity(corpus, canonical, errors);
  }

  return validationResult(errors);
}

export function validateReplayWindow(windowManifest) {
  const errors = [];
  const canonical = validateCanonicalInput(windowManifest, errors);

  if (validateClosedObject(
    windowManifest,
    "",
    [
      "contract_version",
      "window_id",
      "timezone",
      "start_date",
      "end_date",
      "status",
      "corpus_contract_version",
      "behavior_contract_sha256",
      "dates",
      "failure_date",
      "failure_reasons",
      "rejected_attempts",
      "integrity"
    ],
    [
      "contract_version",
      "window_id",
      "timezone",
      "start_date",
      "end_date",
      "status",
      "corpus_contract_version",
      "behavior_contract_sha256",
      "dates",
      "failure_date",
      "failure_reasons",
      "rejected_attempts",
      "integrity"
    ],
    errors
  )) {
    validateConst(windowManifest.contract_version, 1, "/contract_version", errors);
    validateNonEmptyString(windowManifest.window_id, "/window_id", errors);
    validateConst(windowManifest.timezone, "Asia/Shanghai", "/timezone", errors);
    validateDate(windowManifest.start_date, "/start_date", errors);
    validateDate(windowManifest.end_date, "/end_date", errors);
    validateEnum(windowManifest.status, ["active", "failed", "complete"], "/status", errors);
    validateConst(
      windowManifest.corpus_contract_version,
      1,
      "/corpus_contract_version",
      errors
    );
    validateSha256(
      windowManifest.behavior_contract_sha256,
      "/behavior_contract_sha256",
      errors
    );
    validateWindowDates(windowManifest.dates, "/dates", errors);
    validateNullableDate(windowManifest.failure_date, "/failure_date", errors);
    validateStringArray(
      windowManifest.failure_reasons,
      "/failure_reasons",
      errors,
      WINDOW_FAILURE_REASONS
    );
    validateRejectedAttempts(windowManifest.rejected_attempts, "/rejected_attempts", errors);
    validateWindowIntegrity(windowManifest.integrity, "/integrity", errors);
  }

  errors.push(...validateReplayPrivacy(windowManifest).errors);

  if (isPlainObject(windowManifest)) {
    validateWindowState(windowManifest, errors);
    validateWindowCrossRecordIntegrity(windowManifest, canonical, errors);
  }

  return validationResult(errors);
}

function serializeCanonical(value, path, ancestors) {
  if (value === null) return "null";

  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") {
    return JSON.stringify(value);
  }
  if (valueType === "number") {
    if (!Number.isFinite(value)) {
      throw new CanonicalJsonError(
        "CANONICAL_NON_FINITE_NUMBER",
        path,
        "numbers must be finite"
      );
    }
    return JSON.stringify(value);
  }
  if (
    valueType === "undefined"
    || valueType === "function"
    || valueType === "symbol"
    || valueType === "bigint"
  ) {
    throw new CanonicalJsonError(
      "CANONICAL_UNSUPPORTED_TYPE",
      path,
      `unsupported ${valueType} value`
    );
  }
  if (valueType !== "object") {
    throw new CanonicalJsonError(
      "CANONICAL_UNSUPPORTED_TYPE",
      path,
      `unsupported ${valueType} value`
    );
  }
  if (ancestors.has(value)) {
    throw new CanonicalJsonError("CANONICAL_CYCLE", path, "cyclic references are forbidden");
  }

  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    ancestors.add(value);
    const serialized = [];
    for (let index = 0; index < value.length; index += 1) {
      const itemPath = appendPath(path, index);
      if (!Object.hasOwn(value, index)) {
        ancestors.delete(value);
        throw new CanonicalJsonError(
          "CANONICAL_UNSUPPORTED_TYPE",
          itemPath,
          "sparse array entries are forbidden"
        );
      }
      serialized.push(serializeCanonical(value[index], itemPath, ancestors));
    }
    ancestors.delete(value);
    return `[${serialized.join(",")}]`;
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new CanonicalJsonError(
      "CANONICAL_UNSUPPORTED_TYPE",
      path,
      "only plain objects and arrays are supported"
    );
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new CanonicalJsonError(
      "CANONICAL_UNSUPPORTED_TYPE",
      path,
      "symbol keys are forbidden"
    );
  }

  ancestors.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(value).sort();
  const serialized = [];
  for (const key of keys) {
    const descriptor = descriptors[key];
    const itemPath = appendPath(path, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) {
      ancestors.delete(value);
      throw new CanonicalJsonError(
        "CANONICAL_UNSUPPORTED_TYPE",
        itemPath,
        "accessor properties are forbidden"
      );
    }
    serialized.push(
      `${JSON.stringify(key)}:${serializeCanonical(descriptor.value, itemPath, ancestors)}`
    );
  }
  ancestors.delete(value);
  return `{${serialized.join(",")}}`;
}

function replayCorpusPayloadView(corpus) {
  const view = cloneCanonicalJson(corpus);
  if (isPlainObject(view.integrity)) delete view.integrity.payload_sha256;
  if (isPlainObject(view.artifact_bindings?.replay_corpus)) {
    delete view.artifact_bindings.replay_corpus.payload_sha256;
  }
  return view;
}

function replayWindowPayloadView(windowManifest) {
  const view = cloneCanonicalJson(windowManifest);
  if (isPlainObject(view.integrity)) delete view.integrity.payload_sha256;
  return view;
}

function cloneCanonicalJson(value) {
  return JSON.parse(canonicalJson(value));
}

function payloadMetrics(value) {
  const text = canonicalJson(value);
  return {
    byte_size: Buffer.byteLength(text, "utf8"),
    inline_text_characters: countInlineTextCharacters(value)
  };
}

function countInlineTextCharacters(value) {
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countInlineTextCharacters(item), 0);
  }
  if (isPlainObject(value)) {
    return Object.values(value).reduce(
      (total, item) => total + countInlineTextCharacters(item),
      0
    );
  }
  return 0;
}

function validateCanonicalInput(value, errors) {
  try {
    canonicalJson(value);
    return true;
  } catch (error) {
    if (error instanceof CanonicalJsonError) {
      addError(errors, error.code, error.path, error.message);
    } else {
      addError(errors, "CANONICAL_INVALID", "/", String(error));
    }
    return false;
  }
}

function validateBehaviorManifest(value, path, errors) {
  if (!isPlainObject(value)) {
    addTypeError(errors, path, "object");
    return;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    addError(errors, "SCHEMA_MIN_PROPERTIES", path, "at least one dependency is required");
  }
  for (const key of keys) {
    validatePattern(value[key], GIT_SHA_PATTERN, appendPath(path, key), errors);
  }
}

function validateCaptureErrors(value, path, errors) {
  if (!validateArray(value, path, errors)) return;
  value.forEach((item, index) => {
    const itemPath = appendPath(path, index);
    if (!validateClosedObject(
      item,
      itemPath,
      ["stage", "code", "message"],
      ["stage", "code", "message"],
      errors
    )) return;
    validateEnum(
      item.stage,
      [
        "collector",
        "schema",
        "privacy",
        "hash",
        "binding",
        "dependency",
        "second_pass",
        "publication",
        "window"
      ],
      appendPath(itemPath, "stage"),
      errors
    );
    validateNonEmptyString(item.code, appendPath(itemPath, "code"), errors);
    validateNonEmptyString(item.message, appendPath(itemPath, "message"), errors);
  });
}

function validateArtifactBindings(value, path, errors) {
  const allowed = [
    "report",
    "sourcing_candidates",
    "replay_corpus",
    "receipt",
    "radar",
    "steam_trends"
  ];
  if (!validateClosedObject(
    value,
    path,
    ["report", "sourcing_candidates", "replay_corpus", "receipt"],
    allowed,
    errors
  )) return;
  for (const key of allowed) {
    if (Object.hasOwn(value, key)) {
      validateArtifactBinding(
        value[key],
        appendPath(path, key),
        errors,
        { allowUnavailableGitBlobSha: key === "replay_corpus" }
      );
    }
  }
}

function validateArtifactBinding(
  value,
  path,
  errors,
  { allowUnavailableGitBlobSha = false } = {}
) {
  if (!validateClosedObject(
    value,
    path,
    ["path", "git_blob_sha", "payload_sha256", "record_count", "validation_status"],
    ["path", "git_blob_sha", "payload_sha256", "record_count", "validation_status"],
    errors
  )) return;
  validateNonEmptyString(value.path, appendPath(path, "path"), errors);
  if (!(allowUnavailableGitBlobSha && value.git_blob_sha === null)) {
    validatePattern(
      value.git_blob_sha,
      GIT_SHA_PATTERN,
      appendPath(path, "git_blob_sha"),
      errors
    );
  }
  validateSha256(value.payload_sha256, appendPath(path, "payload_sha256"), errors);
  validateInteger(value.record_count, appendPath(path, "record_count"), errors, 0);
  validateEnum(
    value.validation_status,
    ["valid", "invalid", "missing", "unavailable"],
    appendPath(path, "validation_status"),
    errors
  );
}

function validateDeliveryHealth(value, path, errors) {
  const fields = [
    "generation_status",
    "validation_status",
    "receipt_status",
    "sync_response",
    "source_health_status",
    "failure_stage"
  ];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  validateEnum(
    value.generation_status,
    ["success", "failed", "skipped"],
    appendPath(path, "generation_status"),
    errors
  );
  validateEnum(
    value.validation_status,
    ["success", "failed", "skipped"],
    appendPath(path, "validation_status"),
    errors
  );
  validateEnum(
    value.receipt_status,
    ["success", "failed", "missing"],
    appendPath(path, "receipt_status"),
    errors
  );
  if (validateClosedObject(
    value.sync_response,
    appendPath(path, "sync_response"),
    ["synced"],
    ["synced"],
    errors
  )) {
    validateBoolean(
      value.sync_response.synced,
      appendPath(appendPath(path, "sync_response"), "synced"),
      errors
    );
  }
  validateEnum(
    value.source_health_status,
    ["healthy", "degraded", "failed", "unknown"],
    appendPath(path, "source_health_status"),
    errors
  );
  validateNullableString(value.failure_stage, appendPath(path, "failure_stage"), errors);
}

function validateBudgets(value, path, errors) {
  if (!validateClosedObject(value, path, ["limits", "usage"], ["limits", "usage"], errors)) return;
  validateBudgetLimits(value.limits, appendPath(path, "limits"), errors);
  validateBudgetUsage(value.usage, appendPath(path, "usage"), errors);
}

function validateBudgetLimits(value, path, errors) {
  const fields = [
    "max_candidates",
    "max_steam_details",
    "new_lane",
    "backlog_lane",
    "retry_refresh_lane",
    "snapshot_ttl_days",
    "second_pass_max_candidates",
    "actions_per_candidate_min",
    "actions_per_candidate_max",
    "provider_request_limit",
    "provider_retry_limit",
    "scheduled_network_budget"
  ];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  for (const field of fields) {
    validateInteger(value[field], appendPath(path, field), errors, 0);
  }
}

function validateBudgetUsage(value, path, errors) {
  const counts = [
    "fresh_steam_detail_requests",
    "scheduled_network_requests",
    "reused_snapshot_count",
    "provider_requests"
  ];
  const lists = [
    "fresh_steam_detail_candidate_ids",
    "scheduled_network_candidate_ids",
    "reused_snapshot_candidate_ids",
    "provider_transaction_ids"
  ];
  const fields = [...counts, ...lists];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  for (const field of counts) validateInteger(value[field], appendPath(path, field), errors, 0);
  for (const field of lists) validateStringArray(value[field], appendPath(path, field), errors);
}

function validateDiscoverySummary(value, path, errors) {
  if (!validateClosedObject(
    value,
    path,
    ["decision_universe_count", "sources"],
    ["decision_universe_count", "sources"],
    errors
  )) return;
  validateInteger(
    value.decision_universe_count,
    appendPath(path, "decision_universe_count"),
    errors,
    0
  );
  if (!validateArray(value.sources, appendPath(path, "sources"), errors)) return;
  value.sources.forEach((source, index) => {
    const itemPath = appendPath(appendPath(path, "sources"), index);
    const fields = ["source_id", "raw_count", "retained_count", "failure_count"];
    if (!validateClosedObject(source, itemPath, fields, fields, errors)) return;
    validateNonEmptyString(source.source_id, appendPath(itemPath, "source_id"), errors);
    for (const field of fields.slice(1)) {
      validateInteger(source[field], appendPath(itemPath, field), errors, 0);
    }
  });
}

function validateEvidenceCatalog(value, path, errors) {
  if (!validateArray(value, path, errors)) return;
  value.forEach((item, index) => validateEvidence(item, appendPath(path, index), errors));
}

function validateEvidence(value, path, errors) {
  const fields = [
    "evidence_id",
    "evidence_type",
    "gate_id",
    "url",
    "source_id",
    "source_role",
    "evidence_family",
    "captured_at",
    "title",
    "normalized_summary",
    "content_sha256",
    "source_status",
    "fetch_error",
    "official_public_business_entry"
  ];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  for (const field of ["evidence_id", "evidence_type", "gate_id", "source_id"]) {
    validateNonEmptyString(value[field], appendPath(path, field), errors);
  }
  validatePublicUrl(value.url, appendPath(path, "url"), errors);
  validateEnum(value.source_role, SOURCE_ROLES, appendPath(path, "source_role"), errors);
  validateEnum(
    value.evidence_family,
    EVIDENCE_FAMILIES,
    appendPath(path, "evidence_family"),
    errors
  );
  validateDateTime(value.captured_at, appendPath(path, "captured_at"), errors);
  validateString(value.title, appendPath(path, "title"), errors);
  validateString(value.normalized_summary, appendPath(path, "normalized_summary"), errors);
  validateSha256(value.content_sha256, appendPath(path, "content_sha256"), errors);
  validateEnum(
    value.source_status,
    ["success", "failed", "unknown"],
    appendPath(path, "source_status"),
    errors
  );
  validateNullableString(value.fetch_error, appendPath(path, "fetch_error"), errors);
  validateBoolean(
    value.official_public_business_entry,
    appendPath(path, "official_public_business_entry"),
    errors
  );
}

function validateCandidates(value, path, errors) {
  if (!validateArray(value, path, errors)) return;
  value.forEach((item, index) => validateCandidate(item, appendPath(path, index), errors));
}

function validateCandidate(value, path, errors) {
  const fields = [
    "candidate_id",
    "project",
    "steam_app_id",
    "dedupe_key",
    "source_type",
    "source_lane",
    "origin_signal_ids",
    "first_seen",
    "last_seen",
    "scheduler_lane",
    "enrichment_status",
    "enrichment_attempts",
    "snapshot_status",
    "evidence_freshness",
    "normalized_candidate",
    "discovery_score",
    "ranking_inputs",
    "qualification_affected_by_ranking",
    "dedupe_boundary",
    "first_pass",
    "second_pass",
    "publication"
  ];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  for (const field of ["candidate_id", "project", "dedupe_key"]) {
    validateNonEmptyString(value[field], appendPath(path, field), errors);
  }
  validateNullableString(value.steam_app_id, appendPath(path, "steam_app_id"), errors);
  validateEnum(
    value.source_type,
    ["steam", "media", "multi_source"],
    appendPath(path, "source_type"),
    errors
  );
  validateEnum(
    value.source_lane,
    ["regular", "indie_prelaunch", "china_joint"],
    appendPath(path, "source_lane"),
    errors
  );
  validateStringArray(value.origin_signal_ids, appendPath(path, "origin_signal_ids"), errors);
  validateDate(value.first_seen, appendPath(path, "first_seen"), errors);
  validateDate(value.last_seen, appendPath(path, "last_seen"), errors);
  validateEnum(
    value.scheduler_lane,
    ["new", "backlog", "retry_refresh", "reuse", "not_applicable"],
    appendPath(path, "scheduler_lane"),
    errors
  );
  validateEnum(
    value.enrichment_status,
    ["pending", "success", "failed", "not_applicable"],
    appendPath(path, "enrichment_status"),
    errors
  );
  validateInteger(value.enrichment_attempts, appendPath(path, "enrichment_attempts"), errors, 0);
  validateEnum(
    value.snapshot_status,
    ["fresh_success", "reused", "failed", "missing", "not_applicable"],
    appendPath(path, "snapshot_status"),
    errors
  );
  validateEnum(
    value.evidence_freshness,
    ["fresh", "reused", "missing", "not_applicable"],
    appendPath(path, "evidence_freshness"),
    errors
  );
  validateJsonObject(value.normalized_candidate, appendPath(path, "normalized_candidate"), errors);
  validateNumber(value.discovery_score, appendPath(path, "discovery_score"), errors);
  validateJsonObject(value.ranking_inputs, appendPath(path, "ranking_inputs"), errors);
  validatePublicationOrder(
    value.ranking_inputs?.publication_order,
    appendPath(appendPath(path, "ranking_inputs"), "publication_order"),
    value.source_type,
    errors
  );
  validateConst(
    value.qualification_affected_by_ranking,
    false,
    appendPath(path, "qualification_affected_by_ranking"),
    errors,
    "RANKING_AFFECTS_QUALIFICATION"
  );
  validateDedupeBoundary(value.dedupe_boundary, appendPath(path, "dedupe_boundary"), errors);
  validateFirstPass(value.first_pass, appendPath(path, "first_pass"), errors);
  validateCandidateSecondPass(value.second_pass, appendPath(path, "second_pass"), errors);
  validatePublication(value.publication, appendPath(path, "publication"), errors);
}

function validatePublicationOrder(value, path, sourceType, errors) {
  const fields = ["source_priority", "source_index"];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  validateInteger(value.source_priority, appendPath(path, "source_priority"), errors, 0);
  validateInteger(value.source_index, appendPath(path, "source_index"), errors, 0);
  const expectedPriority = sourceType === "steam" ? 1 : 0;
  if (value.source_priority !== expectedPriority) {
    addError(
      errors,
      "PUBLICATION_ORDER_SOURCE_MISMATCH",
      appendPath(path, "source_priority"),
      "publication source priority must match the frozen production source lane"
    );
  }
}

function validateDedupeBoundary(value, path, errors) {
  const fields = ["history_match", "crm_preexisting_match", "match_basis", "audit_digest"];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  validateBoolean(value.history_match, appendPath(path, "history_match"), errors);
  validateBoolean(
    value.crm_preexisting_match,
    appendPath(path, "crm_preexisting_match"),
    errors
  );
  validateEnum(
    value.match_basis,
    ["none", "public_history", "private_crm", "both"],
    appendPath(path, "match_basis"),
    errors
  );
  if (value.audit_digest !== null) {
    validateSha256(value.audit_digest, appendPath(path, "audit_digest"), errors);
  }
}

function validateFirstPass(value, path, errors) {
  const fields = [
    "evaluator_dependency_sha256",
    "indie_prelaunch",
    "china_joint",
    "regular_selection"
  ];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  validateSha256(
    value.evaluator_dependency_sha256,
    appendPath(path, "evaluator_dependency_sha256"),
    errors
  );
  validateLaneEvaluation(value.indie_prelaunch, appendPath(path, "indie_prelaunch"), errors);
  validateLaneEvaluation(value.china_joint, appendPath(path, "china_joint"), errors);
  validateRegularSelection(value.regular_selection, appendPath(path, "regular_selection"), errors);
}

function validateLaneEvaluation(value, path, errors) {
  const fields = ["input", "output", "gate_results"];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  validateJsonObject(value.input, appendPath(path, "input"), errors);
  validateJsonObject(value.output, appendPath(path, "output"), errors);
  if (!validateArray(value.gate_results, appendPath(path, "gate_results"), errors)) return;
  value.gate_results.forEach((gate, index) => {
    const gatePath = appendPath(appendPath(path, "gate_results"), index);
    const gateFields = ["gate_id", "status", "hard_exclusion", "evidence_ids"];
    if (!validateClosedObject(gate, gatePath, gateFields, gateFields, errors)) return;
    validateNonEmptyString(gate.gate_id, appendPath(gatePath, "gate_id"), errors);
    validateEnum(gate.status, ["pass", "fail", "unknown"], appendPath(gatePath, "status"), errors);
    validateBoolean(gate.hard_exclusion, appendPath(gatePath, "hard_exclusion"), errors);
    validateStringArray(gate.evidence_ids, appendPath(gatePath, "evidence_ids"), errors);
  });
}

function validateRegularSelection(value, path, errors) {
  const fields = ["status", "lane", "reason_code"];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  validateEnum(value.status, ["selected", "rejected"], appendPath(path, "status"), errors);
  validateNullableEnum(
    value.lane,
    ["indie_prelaunch", "china_joint"],
    appendPath(path, "lane"),
    errors
  );
  validateNonEmptyString(value.reason_code, appendPath(path, "reason_code"), errors);
}

function validateCandidateSecondPass(value, path, errors) {
  const fields = ["eligible", "rejection_reason", "selected", "attempted", "transaction_id"];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  validateBoolean(value.eligible, appendPath(path, "eligible"), errors);
  validateNullableString(value.rejection_reason, appendPath(path, "rejection_reason"), errors);
  validateBoolean(value.selected, appendPath(path, "selected"), errors);
  validateBoolean(value.attempted, appendPath(path, "attempted"), errors);
  validateNullableString(value.transaction_id, appendPath(path, "transaction_id"), errors);
}

function validatePublication(value, path, errors) {
  const fields = [
    "decision",
    "selected_lane",
    "shadow_push_pool",
    "dedupe_suppressed",
    "shadow_lead_payload_sha256",
    "risk_flags",
    "day_lead_count_used"
  ];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  validateEnum(
    value.decision,
    ["formal", "candidate", "excluded"],
    appendPath(path, "decision"),
    errors
  );
  validateNullableEnum(
    value.selected_lane,
    ["indie_prelaunch", "china_joint"],
    appendPath(path, "selected_lane"),
    errors
  );
  validateBoolean(value.shadow_push_pool, appendPath(path, "shadow_push_pool"), errors);
  validateBoolean(value.dedupe_suppressed, appendPath(path, "dedupe_suppressed"), errors);
  if (value.shadow_lead_payload_sha256 !== null) {
    validateSha256(
      value.shadow_lead_payload_sha256,
      appendPath(path, "shadow_lead_payload_sha256"),
      errors
    );
  }
  validateStringArray(value.risk_flags, appendPath(path, "risk_flags"), errors);
  validateConst(
    value.day_lead_count_used,
    false,
    appendPath(path, "day_lead_count_used"),
    errors,
    "DAY_LEAD_COUNT_USED"
  );
}

function validateRunSecondPass(value, path, errors) {
  const fields = [
    "selector_version",
    "max_candidates",
    "eligible_ids",
    "selected_ids",
    "omitted_ids",
    "attempted_ids",
    "failed_ids",
    "qualified_ids",
    "transactions"
  ];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  validateNonEmptyString(value.selector_version, appendPath(path, "selector_version"), errors);
  validateInteger(value.max_candidates, appendPath(path, "max_candidates"), errors, 0);
  for (const field of fields.slice(2, 8)) {
    validateStringArray(value[field], appendPath(path, field), errors);
  }
  if (!validateArray(value.transactions, appendPath(path, "transactions"), errors)) return;
  value.transactions.forEach((item, index) => {
    validateTransaction(item, appendPath(appendPath(path, "transactions"), index), errors);
  });
}

function validateRequestedActions(value, path, errors) {
  if (!validateArray(value, path, errors)) return;
  if (value.length < 1) {
    addError(errors, "SCHEMA_MIN_ITEMS", path, "requires at least 1 item");
  }
  if (value.length > 3) {
    addError(errors, "SCHEMA_MAX_ITEMS", path, "allows at most 3 items");
  }
  const seen = new Set();
  value.forEach((item, index) => {
    const itemPath = appendPath(path, index);
    if (!validateClosedObject(
      item,
      itemPath,
      ["gate_id", "action"],
      ["gate_id", "action"],
      errors
    )) return;
    validateEnum(
      item.gate_id,
      REQUESTED_ACTION_GATE_IDS,
      appendPath(itemPath, "gate_id"),
      errors
    );
    validateEnum(
      item.action,
      REQUESTED_ACTION_VALUES,
      appendPath(itemPath, "action"),
      errors
    );
    const key = `${String(item.gate_id)}\u0000${String(item.action)}`;
    if (seen.has(key)) {
      addError(
        errors,
        "SCHEMA_UNIQUE_ITEMS",
        itemPath,
        "duplicate requested action"
      );
    } else {
      seen.add(key);
    }
  });
}

function validateTransaction(value, path, errors) {
  const fields = [
    "transaction_id",
    "candidate_id",
    "requested_actions",
    "allowlisted_patch_fields",
    "bounded_signals",
    "provider_contract_version",
    "request_metrics",
    "raw_provider_result",
    "filtered_patch",
    "provider_status",
    "error",
    "merged_final_input",
    "final_output",
    "decision_changed",
    "changed_gate",
    "evaluator_dependency_sha256"
  ];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  validateNonEmptyString(value.transaction_id, appendPath(path, "transaction_id"), errors);
  validateNonEmptyString(value.candidate_id, appendPath(path, "candidate_id"), errors);
  validateRequestedActions(
    value.requested_actions,
    appendPath(path, "requested_actions"),
    errors
  );
  validateStringArray(
    value.allowlisted_patch_fields,
    appendPath(path, "allowlisted_patch_fields"),
    errors
  );
  validateJsonArray(value.bounded_signals, appendPath(path, "bounded_signals"), errors);
  validateNonEmptyString(
    value.provider_contract_version,
    appendPath(path, "provider_contract_version"),
    errors
  );
  validateJsonObject(value.request_metrics, appendPath(path, "request_metrics"), errors);
  if (value.raw_provider_result !== null) {
    validateJsonObject(
      value.raw_provider_result,
      appendPath(path, "raw_provider_result"),
      errors
    );
  }
  validateJsonObject(value.filtered_patch, appendPath(path, "filtered_patch"), errors);
  validateEnum(
    value.provider_status,
    ["success", "error", "timeout"],
    appendPath(path, "provider_status"),
    errors
  );
  validateNullableString(value.error, appendPath(path, "error"), errors);
  validateJsonObject(value.merged_final_input, appendPath(path, "merged_final_input"), errors);
  validateJsonObject(value.final_output, appendPath(path, "final_output"), errors);
  validateBoolean(value.decision_changed, appendPath(path, "decision_changed"), errors);
  validateNullableString(value.changed_gate, appendPath(path, "changed_gate"), errors);
  validateSha256(
    value.evaluator_dependency_sha256,
    appendPath(path, "evaluator_dependency_sha256"),
    errors
  );
}

function validateSummary(value, path, errors) {
  const fields = [
    "candidate_count",
    "evidence_count",
    "second_pass_eligible_count",
    "second_pass_selected_count",
    "second_pass_attempted_count",
    "second_pass_failed_count",
    "second_pass_qualified_count",
    "formal_count",
    "candidate_decision_count",
    "excluded_count",
    "shadow_push_pool_count"
  ];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  for (const field of fields) validateInteger(value[field], appendPath(path, field), errors, 0);
}

function validateCorpusIntegrity(value, path, errors) {
  const fields = [
    "canonical_json_version",
    "payload_sha256",
    "ordered_candidate_count",
    "ordered_evidence_count",
    "artifact_binding_count",
    "byte_size",
    "inline_text_characters",
    "status",
    "reason_codes"
  ];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  validateConst(value.canonical_json_version, 1, appendPath(path, "canonical_json_version"), errors);
  validateSha256(value.payload_sha256, appendPath(path, "payload_sha256"), errors);
  for (const field of [
    "ordered_candidate_count",
    "ordered_evidence_count",
    "artifact_binding_count",
    "byte_size",
    "inline_text_characters"
  ]) {
    validateInteger(value[field], appendPath(path, field), errors, 0);
  }
  validateEnum(value.status, CAPTURE_STATUSES, appendPath(path, "status"), errors);
  validateStringArray(
    value.reason_codes,
    appendPath(path, "reason_codes"),
    errors,
    CORPUS_REASON_CODES
  );
}

function validateWindowDates(value, path, errors) {
  if (!validateArray(value, path, errors)) return;
  value.forEach((item, index) => {
    const itemPath = appendPath(path, index);
    const fields = [
      "report_date",
      "corpus_id",
      "event_name",
      "run_slot",
      "canonical",
      "manual_only",
      "capture_status",
      "corpus_contract_version",
      "behavior_contract_sha256",
      "corpus_path",
      "git_blob_sha",
      "payload_sha256",
      "receipt_binding",
      "replay_binding"
    ];
    if (!validateClosedObject(item, itemPath, fields, fields, errors)) return;
    validateDate(item.report_date, appendPath(itemPath, "report_date"), errors);
    validateNonEmptyString(item.corpus_id, appendPath(itemPath, "corpus_id"), errors);
    validateEnum(item.event_name, EVENT_NAMES, appendPath(itemPath, "event_name"), errors);
    validateEnum(item.run_slot, RUN_SLOTS, appendPath(itemPath, "run_slot"), errors);
    validateConst(
      item.canonical,
      true,
      appendPath(itemPath, "canonical"),
      errors,
      "WINDOW_NON_CANONICAL_DATE"
    );
    validateBoolean(item.manual_only, appendPath(itemPath, "manual_only"), errors);
    validateEnum(item.capture_status, CAPTURE_STATUSES, appendPath(itemPath, "capture_status"), errors);
    validateConst(
      item.corpus_contract_version,
      1,
      appendPath(itemPath, "corpus_contract_version"),
      errors
    );
    validateSha256(
      item.behavior_contract_sha256,
      appendPath(itemPath, "behavior_contract_sha256"),
      errors
    );
    validateNonEmptyString(item.corpus_path, appendPath(itemPath, "corpus_path"), errors);
    validatePattern(item.git_blob_sha, GIT_SHA_PATTERN, appendPath(itemPath, "git_blob_sha"), errors);
    validateSha256(item.payload_sha256, appendPath(itemPath, "payload_sha256"), errors);
    validateReceiptBinding(item.receipt_binding, appendPath(itemPath, "receipt_binding"), errors);
    validateReplayBinding(item.replay_binding, appendPath(itemPath, "replay_binding"), errors);
  });
}

function validateReceiptBinding(value, path, errors) {
  const fields = [
    "path",
    "git_blob_sha",
    "payload_sha256",
    "generation_status",
    "validation_status",
    "receipt_status",
    "synced"
  ];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  validateNonEmptyString(value.path, appendPath(path, "path"), errors);
  validatePattern(value.git_blob_sha, GIT_SHA_PATTERN, appendPath(path, "git_blob_sha"), errors);
  validateSha256(value.payload_sha256, appendPath(path, "payload_sha256"), errors);
  validateEnum(
    value.generation_status,
    ["success", "failed", "skipped"],
    appendPath(path, "generation_status"),
    errors
  );
  validateEnum(
    value.validation_status,
    ["success", "failed", "skipped"],
    appendPath(path, "validation_status"),
    errors
  );
  validateEnum(
    value.receipt_status,
    ["success", "failed", "missing"],
    appendPath(path, "receipt_status"),
    errors
  );
  validateBoolean(value.synced, appendPath(path, "synced"), errors);
}

function validateReplayBinding(value, path, errors) {
  const fields = [
    "engine_contract_version",
    "input_corpus_payload_sha256",
    "expected_decision_sha256",
    "replayed_decision_sha256",
    "deterministic",
    "status"
  ];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  validateConst(
    value.engine_contract_version,
    1,
    appendPath(path, "engine_contract_version"),
    errors
  );
  validateSha256(
    value.input_corpus_payload_sha256,
    appendPath(path, "input_corpus_payload_sha256"),
    errors
  );
  validateSha256(
    value.expected_decision_sha256,
    appendPath(path, "expected_decision_sha256"),
    errors
  );
  validateSha256(
    value.replayed_decision_sha256,
    appendPath(path, "replayed_decision_sha256"),
    errors
  );
  if (value.deterministic !== true) {
    addError(
      errors,
      "WINDOW_REPLAY_NON_DETERMINISTIC",
      appendPath(path, "deterministic"),
      "canonical replay must be deterministic"
    );
  }
  if (value.status !== "match") {
    addError(
      errors,
      "WINDOW_REPLAY_MISMATCH",
      appendPath(path, "status"),
      "canonical replay must match the stored decision view"
    );
  }
  if (value.expected_decision_sha256 !== value.replayed_decision_sha256) {
    addError(
      errors,
      "WINDOW_REPLAY_HASH_MISMATCH",
      appendPath(path, "replayed_decision_sha256"),
      "stored and replayed decision hashes must be equal"
    );
  }
}

function validateRejectedAttempts(value, path, errors) {
  if (!validateArray(value, path, errors)) return;
  value.forEach((item, index) => {
    const itemPath = appendPath(path, index);
    const fields = ["report_date", "corpus_id", "event_name", "run_slot", "reason_code"];
    if (!validateClosedObject(item, itemPath, fields, fields, errors)) return;
    validateDate(item.report_date, appendPath(itemPath, "report_date"), errors);
    validateNonEmptyString(item.corpus_id, appendPath(itemPath, "corpus_id"), errors);
    validateEnum(item.event_name, EVENT_NAMES, appendPath(itemPath, "event_name"), errors);
    validateEnum(item.run_slot, RUN_SLOTS, appendPath(itemPath, "run_slot"), errors);
    validateEnum(
      item.reason_code,
      [
        "manual_only",
        "morning_only",
        "incomplete",
        "corrupt",
        "unreplayable",
          "delivery_unhealthy",
          "superseded_automatic_attempt",
          "rerun",
          "artifact_mismatch",
          "replay_mismatch",
          "contract_drift",
          "behavior_drift"
      ],
      appendPath(itemPath, "reason_code"),
      errors
    );
  });
}

function validateWindowIntegrity(value, path, errors) {
  const fields = [
    "canonical_json_version",
    "payload_sha256",
    "byte_size",
    "inline_text_characters",
    "status",
    "reason_codes"
  ];
  if (!validateClosedObject(value, path, fields, fields, errors)) return;
  validateConst(value.canonical_json_version, 1, appendPath(path, "canonical_json_version"), errors);
  validateSha256(value.payload_sha256, appendPath(path, "payload_sha256"), errors);
  validateInteger(value.byte_size, appendPath(path, "byte_size"), errors, 0);
  validateInteger(
    value.inline_text_characters,
    appendPath(path, "inline_text_characters"),
    errors,
    0
  );
  validateEnum(value.status, CAPTURE_STATUSES, appendPath(path, "status"), errors);
  validateStringArray(
    value.reason_codes,
    appendPath(path, "reason_codes"),
    errors,
    WINDOW_FAILURE_REASONS
  );
}

function validateCaptureState(corpus, errors) {
  const captureErrors = Array.isArray(corpus.capture_errors) ? corpus.capture_errors : [];
  const reasonCodes = Array.isArray(corpus.integrity?.reason_codes)
    ? corpus.integrity.reason_codes
    : [];
  if (corpus.capture_status === "complete") {
    if (captureErrors.length > 0) {
      addError(
        errors,
        "COMPLETE_CAPTURE_ERRORS",
        "/capture_errors",
        "complete corpus cannot contain capture errors"
      );
    }
    if (corpus.integrity?.status !== "complete") {
      addError(
        errors,
        "COMPLETE_INTEGRITY_STATUS",
        "/integrity/status",
        "complete corpus requires complete integrity status"
      );
    }
    if (reasonCodes.length > 0) {
      addError(
        errors,
        "COMPLETE_INTEGRITY_REASONS",
        "/integrity/reason_codes",
        "complete corpus cannot contain integrity reasons"
      );
    }
    return;
  }
  if (CAPTURE_STATUSES.includes(corpus.capture_status) && captureErrors.length === 0) {
    addError(
      errors,
      "CAPTURE_REASON_REQUIRED",
      "/capture_errors",
      "non-complete corpus requires a structured capture error"
    );
  }
  if (CAPTURE_STATUSES.includes(corpus.capture_status) && reasonCodes.length === 0) {
    addError(
      errors,
      "CAPTURE_REASON_REQUIRED",
      "/integrity/reason_codes",
      "non-complete corpus requires an integrity reason"
    );
  }
  if (
    CAPTURE_STATUSES.includes(corpus.capture_status)
    && corpus.capture_status !== "complete"
    && corpus.integrity?.status !== corpus.capture_status
  ) {
    addError(
      errors,
      "CAPTURE_INTEGRITY_STATUS_MISMATCH",
      "/integrity/status",
      "capture and integrity status must match"
    );
  }
}

function validateCorpusCrossRecordIntegrity(corpus, canonical, errors) {
  const candidates = Array.isArray(corpus.candidates) ? corpus.candidates : [];
  const evidenceCatalog = Array.isArray(corpus.evidence_catalog) ? corpus.evidence_catalog : [];
  const transactions = Array.isArray(corpus.second_pass?.transactions)
    ? corpus.second_pass.transactions
    : [];
  const evidenceById = uniqueIndex(
    evidenceCatalog,
    "evidence_id",
    "/evidence_catalog",
    "DUPLICATE_EVIDENCE_ID",
    errors
  );
  const candidateById = uniqueIndex(
    candidates,
    "candidate_id",
    "/candidates",
    "DUPLICATE_CANDIDATE_ID",
    errors
  );
  const transactionById = uniqueIndex(
    transactions,
    "transaction_id",
    "/second_pass/transactions",
    "DUPLICATE_TRANSACTION_ID",
    errors
  );

  if (isPlainObject(corpus.summary)) {
    validateCount(
      corpus.summary.candidate_count,
      candidates.length,
      "SUMMARY_CANDIDATE_COUNT_MISMATCH",
      "/summary/candidate_count",
      errors
    );
    validateCount(
      corpus.summary.evidence_count,
      evidenceCatalog.length,
      "SUMMARY_EVIDENCE_COUNT_MISMATCH",
      "/summary/evidence_count",
      errors
    );
    validateDecisionSummary(corpus, candidates, errors);
    validateSecondPassSummary(corpus, errors);
  }
  if (isPlainObject(corpus.discovery_summary)) {
    validateCount(
      corpus.discovery_summary.decision_universe_count,
      candidates.length,
      "DISCOVERY_UNIVERSE_COUNT_MISMATCH",
      "/discovery_summary/decision_universe_count",
      errors
    );
  }
  if (isPlainObject(corpus.integrity)) {
    validateCount(
      corpus.integrity.ordered_candidate_count,
      candidates.length,
      "INTEGRITY_CANDIDATE_COUNT_MISMATCH",
      "/integrity/ordered_candidate_count",
      errors
    );
    validateCount(
      corpus.integrity.ordered_evidence_count,
      evidenceCatalog.length,
      "INTEGRITY_EVIDENCE_COUNT_MISMATCH",
      "/integrity/ordered_evidence_count",
      errors
    );
    validateCount(
      corpus.integrity.artifact_binding_count,
      isPlainObject(corpus.artifact_bindings) ? Object.keys(corpus.artifact_bindings).length : 0,
      "INTEGRITY_BINDING_COUNT_MISMATCH",
      "/integrity/artifact_binding_count",
      errors
    );
  }
  if (isPlainObject(corpus.artifact_bindings?.replay_corpus)) {
    validateCount(
      corpus.artifact_bindings.replay_corpus.record_count,
      candidates.length,
      "REPLAY_BINDING_RECORD_COUNT_MISMATCH",
      "/artifact_bindings/replay_corpus/record_count",
      errors
    );
  }

  validateEvidenceReferences(candidates, evidenceById, errors);
  validateFinalEvidenceReferences(transactions, evidenceById, errors);
  validateSecondPassIntegrity(
    corpus,
    candidates,
    candidateById,
    transactions,
    transactionById,
    errors
  );
  validateBudgetIntegrity(corpus, candidateById, transactionById, errors);

  if (canonical) {
    try {
      const expectedBehaviorHash = computeBehaviorContractSha256(corpus.behavior_manifest);
      if (corpus.behavior_contract_sha256 !== expectedBehaviorHash) {
        addError(
          errors,
          "BEHAVIOR_HASH_MISMATCH",
          "/behavior_contract_sha256",
          "behavior manifest does not match its SHA-256"
        );
      }
      const expectedPayloadHash = computeReplayCorpusPayloadSha256(corpus);
      if (corpus.integrity?.payload_sha256 !== expectedPayloadHash) {
        addError(
          errors,
          "PAYLOAD_HASH_MISMATCH",
          "/integrity/payload_sha256",
          "corpus canonical payload does not match its SHA-256"
        );
      }
      if (corpus.artifact_bindings?.replay_corpus?.payload_sha256 !== expectedPayloadHash) {
        addError(
          errors,
          "REPLAY_BINDING_HASH_MISMATCH",
          "/artifact_bindings/replay_corpus/payload_sha256",
          "replay binding must use the corpus self-hash"
        );
      }
      const metrics = measureReplayCorpusPayload(corpus);
      validateCount(
        corpus.integrity?.byte_size,
        metrics.byte_size,
        "INTEGRITY_BYTE_SIZE_MISMATCH",
        "/integrity/byte_size",
        errors
      );
      validateCount(
        corpus.integrity?.inline_text_characters,
        metrics.inline_text_characters,
        "INTEGRITY_TEXT_SIZE_MISMATCH",
        "/integrity/inline_text_characters",
        errors
      );
    } catch (error) {
      if (error instanceof CanonicalJsonError) {
        addError(errors, error.code, error.path, error.message);
      }
    }
  }
}

function validateDecisionSummary(corpus, candidates, errors) {
  const formal = candidates.filter((item) => item?.publication?.decision === "formal").length;
  const candidate = candidates.filter((item) => item?.publication?.decision === "candidate").length;
  const excluded = candidates.filter((item) => item?.publication?.decision === "excluded").length;
  const pushPool = candidates.filter((item) => item?.publication?.shadow_push_pool === true).length;
  validateCount(
    corpus.summary.formal_count,
    formal,
    "SUMMARY_FORMAL_COUNT_MISMATCH",
    "/summary/formal_count",
    errors
  );
  validateCount(
    corpus.summary.candidate_decision_count,
    candidate,
    "SUMMARY_CANDIDATE_DECISION_COUNT_MISMATCH",
    "/summary/candidate_decision_count",
    errors
  );
  validateCount(
    corpus.summary.excluded_count,
    excluded,
    "SUMMARY_EXCLUDED_COUNT_MISMATCH",
    "/summary/excluded_count",
    errors
  );
  validateCount(
    corpus.summary.shadow_push_pool_count,
    pushPool,
    "SUMMARY_PUSH_POOL_COUNT_MISMATCH",
    "/summary/shadow_push_pool_count",
    errors
  );
  if (corpus.summary.formal_count !== corpus.summary.shadow_push_pool_count) {
    addError(
      errors,
      "PUBLICATION_PARITY_MISMATCH",
      "/summary/shadow_push_pool_count",
      "formal count must equal the final shadow push-pool count"
    );
  }
}

function validateSecondPassSummary(corpus, errors) {
  const fields = [
    ["eligible_ids", "second_pass_eligible_count"],
    ["selected_ids", "second_pass_selected_count"],
    ["attempted_ids", "second_pass_attempted_count"],
    ["failed_ids", "second_pass_failed_count"],
    ["qualified_ids", "second_pass_qualified_count"]
  ];
  for (const [listField, countField] of fields) {
    const expected = Array.isArray(corpus.second_pass?.[listField])
      ? corpus.second_pass[listField].length
      : 0;
    validateCount(
      corpus.summary[countField],
      expected,
      "SECOND_PASS_SUMMARY_COUNT_MISMATCH",
      `/summary/${countField}`,
      errors
    );
  }
}

function validateEvidenceReferences(candidates, evidenceById, errors) {
  candidates.forEach((candidate, candidateIndex) => {
    for (const lane of ["indie_prelaunch", "china_joint"]) {
      const gates = candidate?.first_pass?.[lane]?.gate_results;
      if (!Array.isArray(gates)) continue;
      gates.forEach((gate, gateIndex) => {
        const gatePath =
          `/candidates/${candidateIndex}/first_pass/${lane}/gate_results/${gateIndex}`;
        const evidenceIds = Array.isArray(gate.evidence_ids) ? gate.evidence_ids : [];
        if (gate.status !== "unknown" && evidenceIds.length === 0) {
          addError(
            errors,
            "GATE_EVIDENCE_REQUIRED",
            `${gatePath}/evidence_ids`,
            "non-unknown gate results require concrete evidence references"
          );
        }
        const independentSources = new Set();
        evidenceIds.forEach((evidenceId, evidenceIndex) => {
          const referencePath = `${gatePath}/evidence_ids/${evidenceIndex}`;
          const evidence = evidenceById.get(evidenceId);
          if (!evidence) {
            addError(
              errors,
              "EVIDENCE_REFERENCE_NOT_FOUND",
              referencePath,
              `unknown evidence_id ${String(evidenceId)}`
            );
            return;
          }
          if (gate.gate_id === "independent_quality_proof") {
            if (!INDEPENDENT_SOURCE_ROLES.has(evidence.source_role)) {
              addError(
                errors,
                "INDEPENDENT_ROLE_FORBIDDEN",
                referencePath,
                `${String(evidence.source_role)} cannot occupy an independent-quality slot`
              );
            } else {
              independentSources.add(evidence.source_id);
            }
          }
        });
        if (
          gate.gate_id === "independent_quality_proof"
          && gate.status === "pass"
          && independentSources.size < 2
        ) {
          addError(
            errors,
            "INDEPENDENT_SOURCE_COUNT",
            `${gatePath}/evidence_ids`,
            "independent-quality pass requires two distinct eligible public sources"
          );
        }
      });
    }
  });
}

function validateFinalEvidenceReferences(transactions, evidenceById, errors) {
  transactions.forEach((transaction, transactionIndex) => {
    if (transaction?.final_output?.qualified !== true) return;
    const evidencePath =
      `/second_pass/transactions/${transactionIndex}/final_output/evidence_ids`;
    const evidenceIds = transaction.final_output.evidence_ids;
    if (!Array.isArray(evidenceIds) || evidenceIds.length === 0) {
      addError(
        errors,
        "FINAL_EVIDENCE_REQUIRED",
        evidencePath,
        "qualified final output requires concrete independent evidence references"
      );
      return;
    }
    const independentSources = new Set();
    evidenceIds.forEach((evidenceId, evidenceIndex) => {
      const referencePath = `${evidencePath}/${evidenceIndex}`;
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) {
        addError(
          errors,
          "EVIDENCE_REFERENCE_NOT_FOUND",
          referencePath,
          `unknown evidence_id ${String(evidenceId)}`
        );
        return;
      }
      if (!INDEPENDENT_SOURCE_ROLES.has(evidence.source_role)) {
        addError(
          errors,
          "INDEPENDENT_ROLE_FORBIDDEN",
          referencePath,
          `${String(evidence.source_role)} cannot occupy an independent-quality slot`
        );
        return;
      }
      independentSources.add(evidence.source_id);
    });
    if (independentSources.size < 2) {
      addError(
        errors,
        "INDEPENDENT_SOURCE_COUNT",
        evidencePath,
        "qualified final output requires two distinct eligible public sources"
      );
    }
  });
}

function hasHardExclusion(candidate) {
  for (const lane of ["indie_prelaunch", "china_joint"]) {
    const gates = candidate?.first_pass?.[lane]?.gate_results;
    if (
      Array.isArray(gates)
      && gates.some((gate) => gate?.status === "fail" && gate?.hard_exclusion === true)
    ) {
      return true;
    }
  }
  return false;
}

function validateSecondPassIntegrity(
  corpus,
  candidates,
  candidateById,
  transactions,
  transactionById,
  errors
) {
  const secondPass = corpus.second_pass;
  if (!isPlainObject(secondPass)) return;
  const listFields = [
    "eligible_ids",
    "selected_ids",
    "omitted_ids",
    "attempted_ids",
    "failed_ids",
    "qualified_ids"
  ];
  for (const field of listFields) {
    const list = Array.isArray(secondPass[field]) ? secondPass[field] : [];
    validateUniquePrimitiveList(list, `/second_pass/${field}`, "DUPLICATE_CANDIDATE_ID", errors);
    list.forEach((candidateId, index) => {
      if (!candidateById.has(candidateId)) {
        addError(
          errors,
          "SECOND_PASS_CANDIDATE_NOT_FOUND",
          `/second_pass/${field}/${index}`,
          `unknown candidate_id ${String(candidateId)}`
        );
      }
    });
  }

  const eligible = new Set(secondPass.eligible_ids ?? []);
  const selected = new Set(secondPass.selected_ids ?? []);
  const omitted = new Set(secondPass.omitted_ids ?? []);
  const attempted = new Set(secondPass.attempted_ids ?? []);
  const failed = new Set(secondPass.failed_ids ?? []);
  const qualified = new Set(secondPass.qualified_ids ?? []);
  for (const field of ["eligible_ids", "selected_ids", "attempted_ids"]) {
    (secondPass[field] ?? []).forEach((candidateId, index) => {
      const candidate = candidateById.get(candidateId);
      if (candidate && hasHardExclusion(candidate)) {
        addError(
          errors,
          "SECOND_PASS_HARD_EXCLUSION",
          `/second_pass/${field}/${index}`,
          "hard-excluded candidates cannot receive second pass"
        );
      }
    });
  }
  for (const candidateId of selected) {
    if (!eligible.has(candidateId)) {
      addError(
        errors,
        "SECOND_PASS_SELECTION_NOT_ELIGIBLE",
        `/second_pass/selected_ids/${secondPass.selected_ids.indexOf(candidateId)}`,
        "selected candidate must be eligible"
      );
    }
  }
  for (const candidateId of attempted) {
    if (!selected.has(candidateId)) {
      addError(
        errors,
        "SECOND_PASS_ATTEMPT_NOT_SELECTED",
        `/second_pass/attempted_ids/${secondPass.attempted_ids.indexOf(candidateId)}`,
        "attempted candidate must be selected"
      );
    }
  }
  for (const candidateId of eligible) {
    if (selected.has(candidateId) === omitted.has(candidateId)) {
      addError(
        errors,
        "SECOND_PASS_PARTITION_MISMATCH",
        "/second_pass/omitted_ids",
        "eligible candidates must appear in exactly one of selected or omitted"
      );
    }
  }
  if (
    Number.isInteger(secondPass.max_candidates)
    && Array.isArray(secondPass.selected_ids)
    && secondPass.selected_ids.length > secondPass.max_candidates
  ) {
    addError(
      errors,
      "SECOND_PASS_SELECTION_LIMIT",
      "/second_pass/selected_ids",
      "selected candidates exceed the frozen maximum"
    );
  }
  if (
    Number.isInteger(corpus.budgets?.limits?.second_pass_max_candidates)
    && secondPass.max_candidates !== corpus.budgets.limits.second_pass_max_candidates
  ) {
    addError(
      errors,
      "SECOND_PASS_LIMIT_MISMATCH",
      "/second_pass/max_candidates",
      "selector and frozen budget maximum must match"
    );
  }

  const transactionByCandidate = new Map();
  transactions.forEach((transaction, index) => {
    const transactionPath = `/second_pass/transactions/${index}`;
    if (transactionByCandidate.has(transaction?.candidate_id)) {
      addError(
        errors,
        "DUPLICATE_CANDIDATE_TRANSACTION",
        `${transactionPath}/candidate_id`,
        "a candidate may have only one second-pass transaction"
      );
    } else {
      transactionByCandidate.set(transaction?.candidate_id, transaction);
    }
    const candidate = candidateById.get(transaction?.candidate_id);
    if (!candidate) return;
    if (
      transaction.evaluator_dependency_sha256
      !== candidate.first_pass?.evaluator_dependency_sha256
    ) {
      addError(
        errors,
        "EVALUATOR_DEPENDENCY_MISMATCH",
        `${transactionPath}/evaluator_dependency_sha256`,
        "first and second pass must use the same evaluator dependency hash"
      );
    }
    if (transaction.provider_status === "success") {
      if (!isPlainObject(transaction.raw_provider_result)) {
        addError(
          errors,
          "PROVIDER_SUCCESS_RESULT_MISSING",
          `${transactionPath}/raw_provider_result`,
          "successful transaction requires its normalized provider result"
        );
      }
      if (transaction.error !== null) {
        addError(
          errors,
          "PROVIDER_SUCCESS_ERROR_PRESENT",
          `${transactionPath}/error`,
          "successful transaction cannot contain an error"
        );
      }
    }
    if (["error", "timeout"].includes(transaction.provider_status)) {
      if (typeof transaction.error !== "string" || transaction.error.length === 0) {
        addError(
          errors,
          "PROVIDER_FAILURE_ERROR_MISSING",
          `${transactionPath}/error`,
          "failed transaction requires a captured error"
        );
      }
      if (transaction.raw_provider_result !== null) {
        addError(
          errors,
          "PROVIDER_FAILURE_RESULT_PRESENT",
          `${transactionPath}/raw_provider_result`,
          "failed transaction must use a null normalized provider result"
        );
      }
    }
  });

  (secondPass.attempted_ids ?? []).forEach((candidateId, index) => {
    if (!transactionByCandidate.has(candidateId)) {
      addError(
        errors,
        "SECOND_PASS_TRANSACTION_MISSING",
        `/second_pass/attempted_ids/${index}`,
        "complete attempted candidate requires a success/error/timeout transaction"
      );
    }
  });
  transactions.forEach((transaction, index) => {
    if (!attempted.has(transaction?.candidate_id)) {
      addError(
        errors,
        "SECOND_PASS_TRANSACTION_NOT_ATTEMPTED",
        `/second_pass/transactions/${index}/candidate_id`,
        "transaction candidate must appear in attempted_ids"
      );
    }
  });

  candidates.forEach((candidate, index) => {
    const id = candidate?.candidate_id;
    const candidateSecondPass = candidate?.second_pass;
    if (!isPlainObject(candidateSecondPass)) return;
    const checks = [
      ["eligible", eligible.has(id), "eligible_ids"],
      ["selected", selected.has(id), "selected_ids"],
      ["attempted", attempted.has(id), "attempted_ids"]
    ];
    for (const [field, expected, listField] of checks) {
      if (candidateSecondPass[field] !== expected) {
        addError(
          errors,
          "SECOND_PASS_CANDIDATE_FLAG_MISMATCH",
          `/candidates/${index}/second_pass/${field}`,
          `${field} must match second_pass.${listField}`
        );
      }
    }
    if (candidateSecondPass.attempted === true) {
      const referencedTransaction = transactionById.get(candidateSecondPass.transaction_id);
      if (!referencedTransaction) {
        addError(
          errors,
          "SECOND_PASS_TRANSACTION_REFERENCE_MISSING",
          `/candidates/${index}/second_pass/transaction_id`,
          "attempted candidate transaction_id must resolve"
        );
      } else if (referencedTransaction.candidate_id !== id) {
        addError(
          errors,
          "SECOND_PASS_TRANSACTION_CANDIDATE_MISMATCH",
          `/candidates/${index}/second_pass/transaction_id`,
          "attempted candidate must reference its own transaction"
        );
      }
    }
    if (candidateSecondPass.attempted !== true && candidateSecondPass.transaction_id !== null) {
      addError(
        errors,
        "SECOND_PASS_UNATTEMPTED_TRANSACTION",
        `/candidates/${index}/second_pass/transaction_id`,
        "unattempted candidate cannot reference a transaction"
      );
    }
  });

  const derivedFailed = new Set(
    transactions
      .filter((transaction) => ["error", "timeout"].includes(transaction?.provider_status))
      .map((transaction) => transaction.candidate_id)
  );
  const derivedQualified = new Set(
    transactions
      .filter((transaction) => transaction?.final_output?.qualified === true)
      .map((transaction) => transaction.candidate_id)
  );
  validateSetEquality(
    failed,
    derivedFailed,
    "/second_pass/failed_ids",
    "SECOND_PASS_FAILED_LIST_MISMATCH",
    errors
  );
  validateSetEquality(
    qualified,
    derivedQualified,
    "/second_pass/qualified_ids",
    "SECOND_PASS_QUALIFIED_LIST_MISMATCH",
    errors
  );
}

function validateBudgetIntegrity(corpus, candidateById, transactionById, errors) {
  const usage = corpus.budgets?.usage;
  const limits = corpus.budgets?.limits;
  if (!isPlainObject(usage) || !isPlainObject(limits)) return;
  const listCounts = [
    ["fresh_steam_detail_requests", "fresh_steam_detail_candidate_ids"],
    ["scheduled_network_requests", "scheduled_network_candidate_ids"],
    ["reused_snapshot_count", "reused_snapshot_candidate_ids"],
    ["provider_requests", "provider_transaction_ids"]
  ];
  for (const [countField, listField] of listCounts) {
    const list = Array.isArray(usage[listField]) ? usage[listField] : [];
    validateCount(
      usage[countField],
      list.length,
      "BUDGET_USAGE_COUNT_MISMATCH",
      `/budgets/usage/${countField}`,
      errors
    );
  }
  const reused = new Set(usage.reused_snapshot_candidate_ids ?? []);
  (usage.fresh_steam_detail_candidate_ids ?? []).forEach((candidateId, index) => {
    if (reused.has(candidateId)) {
      addError(
        errors,
        "REUSED_SNAPSHOT_COUNTED_FRESH",
        `/budgets/usage/fresh_steam_detail_candidate_ids/${index}`,
        "reused snapshot cannot consume a fresh request"
      );
    }
  });
  (usage.scheduled_network_candidate_ids ?? []).forEach((candidateId, index) => {
    if (reused.has(candidateId)) {
      addError(
        errors,
        "REUSED_SNAPSHOT_COUNTED_SCHEDULED",
        `/budgets/usage/scheduled_network_candidate_ids/${index}`,
        "reused snapshot cannot consume the scheduled network budget"
      );
    }
  });
  for (const [field, limitField] of [
    ["fresh_steam_detail_requests", "max_steam_details"],
    ["scheduled_network_requests", "scheduled_network_budget"],
    ["provider_requests", "provider_request_limit"]
  ]) {
    if (Number.isInteger(usage[field]) && Number.isInteger(limits[limitField])) {
      if (usage[field] > limits[limitField]) {
        addError(
          errors,
          "BUDGET_LIMIT_EXCEEDED",
          `/budgets/usage/${field}`,
          `${field} exceeds ${limitField}`
        );
      }
    }
  }
  for (const field of [
    "fresh_steam_detail_candidate_ids",
    "scheduled_network_candidate_ids",
    "reused_snapshot_candidate_ids"
  ]) {
    (usage[field] ?? []).forEach((candidateId, index) => {
      if (!candidateById.has(candidateId)) {
        addError(
          errors,
          "BUDGET_CANDIDATE_NOT_FOUND",
          `/budgets/usage/${field}/${index}`,
          `unknown candidate_id ${String(candidateId)}`
        );
      }
    });
  }
  (usage.provider_transaction_ids ?? []).forEach((transactionId, index) => {
    if (!transactionById.has(transactionId)) {
      addError(
        errors,
        "BUDGET_TRANSACTION_NOT_FOUND",
        `/budgets/usage/provider_transaction_ids/${index}`,
        `unknown transaction_id ${String(transactionId)}`
      );
    }
  });
  candidateById.forEach((candidate, candidateId) => {
    if (candidate?.snapshot_status === "reused" && !reused.has(candidateId)) {
      addError(
        errors,
        "REUSED_SNAPSHOT_USAGE_MISSING",
        "/budgets/usage/reused_snapshot_candidate_ids",
        `reused candidate ${candidateId} is absent from budget usage`
      );
    }
  });
}

function validateWindowState(windowManifest, errors) {
  const dates = Array.isArray(windowManifest.dates) ? windowManifest.dates : [];
  const failureReasons = Array.isArray(windowManifest.failure_reasons)
    ? windowManifest.failure_reasons
    : [];
  if (windowManifest.status === "complete") {
    if (dates.length !== 15) {
      addError(
        errors,
        "WINDOW_COMPLETE_DATE_COUNT",
        "/dates",
        "complete window must contain exactly 15 dates"
      );
    }
    if (windowManifest.failure_date !== null || failureReasons.length > 0) {
      addError(
        errors,
        "WINDOW_COMPLETE_FAILURE_PRESENT",
        "/failure_reasons",
        "complete window cannot contain failure state"
      );
    }
    if (windowManifest.integrity?.status !== "complete") {
      addError(
        errors,
        "WINDOW_COMPLETE_INTEGRITY_STATUS",
        "/integrity/status",
        "complete window requires complete integrity"
      );
    }
    if (Array.isArray(windowManifest.integrity?.reason_codes)
      && windowManifest.integrity.reason_codes.length > 0) {
      addError(
        errors,
        "WINDOW_COMPLETE_INTEGRITY_REASONS",
        "/integrity/reason_codes",
        "complete window cannot contain integrity reasons"
      );
    }
  } else if (windowManifest.status === "failed") {
    if (dates.length > 14) {
      addError(
        errors,
        "WINDOW_FAILED_DATE_COUNT",
        "/dates",
        "failed window may retain at most 14 dates"
      );
    }
    if (!isValidDateString(windowManifest.failure_date)) {
      addError(
        errors,
        "WINDOW_FAILURE_DATE_REQUIRED",
        "/failure_date",
        "failed window requires a failure date"
      );
    }
    if (failureReasons.length === 0) {
      addError(
        errors,
        "WINDOW_FAILURE_REASON_REQUIRED",
        "/failure_reasons",
        "failed window requires a reason"
      );
    }
    if (windowManifest.integrity?.status === "complete") {
      addError(
        errors,
        "WINDOW_FAILED_INTEGRITY_STATUS",
        "/integrity/status",
        "failed window cannot have complete integrity"
      );
    }
    if (windowManifest.end_date !== windowManifest.failure_date) {
      addError(
        errors,
        "WINDOW_FAILED_END_DATE_MISMATCH",
        "/end_date",
        "failed window end_date must equal failure_date"
      );
    }
    const integrityReasons = Array.isArray(windowManifest.integrity?.reason_codes)
      ? windowManifest.integrity.reason_codes
      : [];
    if (!sameStringSet(integrityReasons, failureReasons)) {
      addError(
        errors,
        "WINDOW_FAILURE_REASON_PARITY",
        "/integrity/reason_codes",
        "failed window integrity reasons must equal failure_reasons"
      );
    }
  } else if (windowManifest.status === "active") {
    if (dates.length < 1 || dates.length > 14) {
      addError(
        errors,
        "WINDOW_ACTIVE_DATE_COUNT",
        "/dates",
        "active window must retain 1 to 14 consecutive dates"
      );
    }
    if (windowManifest.failure_date !== null || failureReasons.length > 0) {
      addError(
        errors,
        "WINDOW_ACTIVE_FAILURE_PRESENT",
        "/failure_reasons",
        "active window cannot contain failure state"
      );
    }
    if (windowManifest.integrity?.status !== "incomplete") {
      addError(
        errors,
        "WINDOW_ACTIVE_INTEGRITY_STATUS",
        "/integrity/status",
        "active window has incomplete integrity until it closes"
      );
    }
    if (Array.isArray(windowManifest.integrity?.reason_codes)
      && windowManifest.integrity.reason_codes.length > 0) {
      addError(
        errors,
        "WINDOW_ACTIVE_INTEGRITY_REASONS",
        "/integrity/reason_codes",
        "active window cannot contain integrity reasons"
      );
    }
  }
}

function validateWindowCrossRecordIntegrity(windowManifest, canonical, errors) {
  const dates = Array.isArray(windowManifest.dates) ? windowManifest.dates : [];
  const seenDates = new Set();
  const seenCorpusIds = new Set();
  dates.forEach((entry, index) => {
    if (seenDates.has(entry?.report_date)) {
      addError(
        errors,
        "WINDOW_DUPLICATE_DATE",
        `/dates/${index}/report_date`,
        "window dates must be unique"
      );
    } else {
      seenDates.add(entry?.report_date);
    }
    if (seenCorpusIds.has(entry?.corpus_id)) {
      addError(
        errors,
        "DUPLICATE_CORPUS_ID",
        `/dates/${index}/corpus_id`,
        "window corpus IDs must be unique"
      );
    } else {
      seenCorpusIds.add(entry?.corpus_id);
    }
    if (entry?.behavior_contract_sha256 !== windowManifest.behavior_contract_sha256) {
      addError(
        errors,
        "WINDOW_BEHAVIOR_DRIFT",
        `/dates/${index}/behavior_contract_sha256`,
        "all dates must use one behavior contract hash"
      );
    }
    if (entry?.corpus_contract_version !== windowManifest.corpus_contract_version) {
      addError(
        errors,
        "WINDOW_CORPUS_CONTRACT_DRIFT",
        `/dates/${index}/corpus_contract_version`,
        "all dates must use one corpus contract version"
      );
    }
    if (
      entry?.canonical === true
      && (
        entry.manual_only === true
        || entry.event_name === "workflow_dispatch"
        || entry.run_slot === "manual"
      )
    ) {
      addError(
        errors,
        "WINDOW_MANUAL_CANONICAL",
        `/dates/${index}/canonical`,
        "manual-only recovery cannot be a canonical run"
      );
    }
    if (entry?.canonical === true && entry.run_slot === "morning") {
      addError(
        errors,
        "WINDOW_INELIGIBLE_CANONICAL_SLOT",
        `/dates/${index}/run_slot`,
        "morning runs cannot be canonical"
      );
    }
    validateCanonicalDateHealth(entry, index, errors);
  });

  for (let index = 1; index < dates.length; index += 1) {
    const expected = nextDateString(dates[index - 1]?.report_date);
    if (expected && dates[index]?.report_date !== expected) {
      addError(
        errors,
        "WINDOW_DATE_GAP",
        `/dates/${index}/report_date`,
        `expected ${expected}`
      );
    }
  }
  if (dates.length > 0) {
    if (windowManifest.start_date !== dates[0]?.report_date) {
      addError(
        errors,
        "WINDOW_START_DATE_MISMATCH",
        "/start_date",
        "start_date must match the first retained date"
      );
    }
    if (windowManifest.status === "failed") {
      const expectedFailureDate = nextDateString(dates[dates.length - 1]?.report_date);
      if (expectedFailureDate && windowManifest.failure_date !== expectedFailureDate) {
        addError(
          errors,
          "WINDOW_FAILURE_DATE_SEQUENCE",
          "/failure_date",
          `expected ${expectedFailureDate}`
        );
      }
    }
    if (
      windowManifest.status !== "failed"
      && windowManifest.end_date !== dates[dates.length - 1]?.report_date
    ) {
      addError(
        errors,
        "WINDOW_END_DATE_MISMATCH",
        "/end_date",
        "end_date must match the last retained date"
      );
    }
  } else if (
    windowManifest.status === "failed"
    && windowManifest.start_date !== windowManifest.failure_date
  ) {
    addError(
      errors,
      "WINDOW_FAILED_START_DATE_MISMATCH",
      "/start_date",
      "failed window without retained dates must start on failure_date"
    );
  }

  if (canonical) {
    try {
      const expectedPayloadHash = computeReplayWindowPayloadSha256(windowManifest);
      if (windowManifest.integrity?.payload_sha256 !== expectedPayloadHash) {
        addError(
          errors,
          "PAYLOAD_HASH_MISMATCH",
          "/integrity/payload_sha256",
          "window canonical payload does not match its SHA-256"
        );
      }
      const metrics = measureReplayWindowPayload(windowManifest);
      validateCount(
        windowManifest.integrity?.byte_size,
        metrics.byte_size,
        "INTEGRITY_BYTE_SIZE_MISMATCH",
        "/integrity/byte_size",
        errors
      );
      validateCount(
        windowManifest.integrity?.inline_text_characters,
        metrics.inline_text_characters,
        "INTEGRITY_TEXT_SIZE_MISMATCH",
        "/integrity/inline_text_characters",
        errors
      );
    } catch (error) {
      if (error instanceof CanonicalJsonError) {
        addError(errors, error.code, error.path, error.message);
      }
    }
  }
}

function sameStringSet(left, right) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function validateCanonicalDateHealth(entry, index, errors) {
  if (entry.capture_status !== "complete") {
    addError(
      errors,
      "WINDOW_CANONICAL_CORPUS_INCOMPLETE",
      `/dates/${index}/capture_status`,
      "canonical date requires a complete corpus"
    );
  }
  const receipt = entry.receipt_binding;
  if (!isPlainObject(receipt)) return;
  if (
    receipt.generation_status !== "success"
    || receipt.validation_status !== "success"
    || receipt.receipt_status !== "success"
    || receipt.synced !== true
  ) {
    addError(
      errors,
      "WINDOW_CANONICAL_RECEIPT_UNHEALTHY",
      `/dates/${index}/receipt_binding`,
      "canonical date requires generation, validation, receipt, and sync success"
    );
  }
  const replay = entry.replay_binding;
  if (!isPlainObject(replay)) return;
  if (replay.input_corpus_payload_sha256 !== entry.payload_sha256) {
    addError(
      errors,
      "WINDOW_REPLAY_INPUT_HASH_MISMATCH",
      `/dates/${index}/replay_binding/input_corpus_payload_sha256`,
      "replay input hash must match the retained corpus payload hash"
    );
  }
}

function scanPrivacy(value, path, publicBusinessContext, ancestors, errors) {
  if (typeof value === "string") {
    scanPrivacyString(value, path || "/", publicBusinessContext, errors);
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (ancestors.has(value)) return;
  ancestors.add(value);

  const objectPublicBusiness =
    publicBusinessContext
    || (isPlainObject(value) && value.official_public_business_entry === true);
  const entries = Array.isArray(value)
    ? value.map((item, index) => [index, item])
    : Object.entries(value);

  for (const [rawKey, child] of entries) {
    const childPath = appendPath(path, rawKey);
    if (typeof rawKey === "string") {
      const normalizedKey = normalizePrivacyKey(rawKey);
      if (AUTH_HEADER_KEYS.has(normalizedKey)) {
        addError(
          errors,
          "PRIVACY_AUTH_HEADER",
          childPath,
          "authorization and cookie headers are forbidden"
        );
      }
      if (SECRET_FIELD_KEYS.has(normalizedKey)) {
        addError(
          errors,
          "PRIVACY_SECRET_FIELD",
          childPath,
          "tokens, API keys, passwords, and secrets are forbidden"
        );
      }
      if (RESPONSE_HEADER_KEYS.has(normalizedKey)) {
        addError(
          errors,
          "PRIVACY_RESPONSE_HEADERS",
          childPath,
          "response headers are forbidden"
        );
      }
      if (RAW_HTML_KEYS.has(normalizedKey)) {
        addError(errors, "PRIVACY_RAW_HTML", childPath, "raw HTML is forbidden");
      }
      if (PRIVATE_CRM_KEYS.has(normalizedKey)) {
        addError(
          errors,
          "PRIVACY_PRIVATE_CRM",
          childPath,
          "full private CRM indexes are forbidden"
        );
      }
      if (PRIVATE_LEAD_KEYS.has(normalizedKey)) {
        addError(
          errors,
          "PRIVACY_PRIVATE_LEAD",
          childPath,
          "private Lead identity, notes, and owner fields are forbidden"
        );
      }
      if (PRIVATE_CONTACT_KEYS.has(normalizedKey)) {
        addError(
          errors,
          "PRIVACY_PRIVATE_CONTACT",
          childPath,
          "private or personal contact fields are forbidden"
        );
      }
    }
    scanPrivacy(child, childPath, objectPublicBusiness, ancestors, errors);
  }
  ancestors.delete(value);
}

function scanPrivacyString(value, path, publicBusinessContext, errors) {
  if (/<(?:!doctype|html|head|body|script|style|div|span|p|a)\b/i.test(value)) {
    addError(errors, "PRIVACY_RAW_HTML", path, "raw HTML content is forbidden");
  }
  if (
    /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i.test(value)
    || /\b(?:ghp_|github_pat_|sk-)[A-Za-z0-9_-]{8,}/.test(value)
    || /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/.test(value)
  ) {
    addError(errors, "PRIVACY_SECRET_VALUE", path, "token-like secret value is forbidden");
  }
  if (!publicBusinessContext && /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) {
    addError(
      errors,
      "PRIVACY_PRIVATE_CONTACT",
      path,
      "contact data requires an official_public_business_entry boundary"
    );
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    return;
  }
  if (!["http:", "https:"].includes(url.protocol)) return;
  if (url.username || url.password) {
    addError(errors, "PRIVACY_URL_CREDENTIALS", path, "URL credentials are forbidden");
  }
  for (const key of url.searchParams.keys()) {
    if (SECRET_QUERY_NAMES.has(key.toLowerCase())) {
      addError(
        errors,
        "PRIVACY_SECRET_QUERY",
        path,
        `secret query parameter ${key} is forbidden`
      );
    }
  }
}

function uniqueIndex(items, key, path, code, errors) {
  const index = new Map();
  items.forEach((item, itemIndex) => {
    const value = item?.[key];
    if (index.has(value)) {
      addError(
        errors,
        code,
        `${path}/${itemIndex}/${escapePointer(key)}`,
        `duplicate ${key} ${String(value)}`
      );
    } else {
      index.set(value, item);
    }
  });
  return index;
}

function validateUniquePrimitiveList(values, path, code, errors) {
  const seen = new Set();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      addError(errors, code, `${path}/${index}`, `duplicate value ${String(value)}`);
    } else {
      seen.add(value);
    }
  });
}

function validateSetEquality(actual, expected, path, code, errors) {
  if (actual.size !== expected.size || [...actual].some((item) => !expected.has(item))) {
    addError(errors, code, path, "recorded list does not match captured transactions");
  }
}

function validateCount(actual, expected, code, path, errors) {
  if (actual !== expected) {
    addError(errors, code, path, `expected ${expected}, received ${String(actual)}`);
  }
}

function validateClosedObject(value, path, required, allowed, errors) {
  if (!isPlainObject(value)) {
    addTypeError(errors, path || "/", "object");
    return false;
  }
  for (const field of required) {
    if (!Object.hasOwn(value, field)) {
      addError(
        errors,
        "SCHEMA_REQUIRED",
        appendPath(path, field),
        `required property ${field} is missing`
      );
    }
  }
  const allowedSet = new Set(allowed);
  for (const field of Object.keys(value)) {
    if (!allowedSet.has(field)) {
      addError(
        errors,
        "SCHEMA_ADDITIONAL_PROPERTY",
        appendPath(path, field),
        `additional property ${field} is forbidden`
      );
    }
  }
  return true;
}

function validateJsonObject(value, path, errors) {
  if (!isPlainObject(value)) addTypeError(errors, path, "object");
}

function validateJsonArray(value, path, errors) {
  if (!Array.isArray(value)) addTypeError(errors, path, "array");
}

function validateArray(value, path, errors) {
  if (!Array.isArray(value)) {
    addTypeError(errors, path, "array");
    return false;
  }
  return true;
}

function validateStringArray(value, path, errors, enumValues = null, bounds = {}) {
  if (!validateArray(value, path, errors)) return;
  if (Number.isInteger(bounds.min) && value.length < bounds.min) {
    addError(errors, "SCHEMA_MIN_ITEMS", path, `requires at least ${bounds.min} items`);
  }
  if (Number.isInteger(bounds.max) && value.length > bounds.max) {
    addError(errors, "SCHEMA_MAX_ITEMS", path, `allows at most ${bounds.max} items`);
  }
  const seen = new Set();
  value.forEach((item, index) => {
    const itemPath = appendPath(path, index);
    validateNonEmptyString(item, itemPath, errors);
    if (enumValues && !enumValues.includes(item)) {
      addError(errors, "SCHEMA_ENUM", itemPath, `unsupported value ${String(item)}`);
    }
    if (seen.has(item)) {
      addError(errors, "SCHEMA_UNIQUE_ITEMS", itemPath, `duplicate value ${String(item)}`);
    } else {
      seen.add(item);
    }
  });
}

function validateConst(value, expected, path, errors, code = "SCHEMA_CONST") {
  if (value !== expected) addError(errors, code, path, `expected ${String(expected)}`);
}

function validateEnum(value, allowed, path, errors) {
  if (!allowed.includes(value)) {
    addError(errors, "SCHEMA_ENUM", path, `unsupported value ${String(value)}`);
  }
}

function validateNullableEnum(value, allowed, path, errors) {
  if (value !== null) validateEnum(value, allowed, path, errors);
}

function validateString(value, path, errors) {
  if (typeof value !== "string") addTypeError(errors, path, "string");
}

function validateNonEmptyString(value, path, errors) {
  if (typeof value !== "string") {
    addTypeError(errors, path, "non-empty string");
  } else if (value.length === 0) {
    addError(errors, "SCHEMA_MIN_LENGTH", path, "string must not be empty");
  }
}

function validateNullableString(value, path, errors) {
  if (value !== null) validateString(value, path, errors);
}

function validateBoolean(value, path, errors) {
  if (typeof value !== "boolean") addTypeError(errors, path, "boolean");
}

function validateNumber(value, path, errors) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    addTypeError(errors, path, "finite number");
  }
}

function validateInteger(value, path, errors, minimum) {
  if (!Number.isInteger(value)) {
    addTypeError(errors, path, "integer");
  } else if (value < minimum) {
    addError(errors, "SCHEMA_MINIMUM", path, `must be at least ${minimum}`);
  }
}

function validatePattern(value, pattern, path, errors) {
  if (typeof value !== "string") {
    addTypeError(errors, path, "string");
  } else if (!pattern.test(value)) {
    addError(errors, "SCHEMA_PATTERN", path, "string does not match the contract pattern");
  }
}

function validateSha256(value, path, errors) {
  validatePattern(value, SHA256_PATTERN, path, errors);
}

function validateDate(value, path, errors) {
  if (!isValidDateString(value)) {
    addError(errors, "SCHEMA_DATE", path, "expected a valid YYYY-MM-DD date");
  }
}

function validateNullableDate(value, path, errors) {
  if (value !== null) validateDate(value, path, errors);
}

function validateDateTime(value, path, errors) {
  if (
    typeof value !== "string"
    || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(value)
  ) {
    addError(errors, "SCHEMA_DATE_TIME", path, "expected an ISO-8601 timestamp with timezone");
  }
}

function validatePublicUrl(value, path, errors) {
  if (typeof value !== "string") {
    addTypeError(errors, path, "public HTTP(S) URL");
    return;
  }
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      addError(errors, "SCHEMA_URL", path, "URL must use HTTP or HTTPS");
    }
  } catch {
    addError(errors, "SCHEMA_URL", path, "expected a valid public URL");
  }
}

function isValidDateString(value) {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function nextDateString(value) {
  if (!isValidDateString(value)) return null;
  const [yearText, monthText, dayText] = value.split("-");
  let year = Number(yearText);
  let month = Number(monthText);
  let day = Number(dayText) + 1;
  if (day > daysInMonth(year, month)) {
    day = 1;
    month += 1;
  }
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function validationResult(errors) {
  const unique = new Map();
  for (const error of errors) {
    const key = `${error.path}\u0000${error.code}\u0000${error.message}`;
    if (!unique.has(key)) unique.set(key, error);
  }
  const sorted = [...unique.values()].sort(compareErrors);
  return { valid: sorted.length === 0, errors: sorted };
}

function compareErrors(left, right) {
  if (left.path < right.path) return -1;
  if (left.path > right.path) return 1;
  if (left.code < right.code) return -1;
  if (left.code > right.code) return 1;
  if (left.message < right.message) return -1;
  if (left.message > right.message) return 1;
  return 0;
}

function addTypeError(errors, path, expected) {
  addError(errors, "SCHEMA_TYPE", path, `expected ${expected}`);
}

function addError(errors, code, path, message) {
  errors.push({ code, path: path || "/", message });
}

function appendPath(path, segment) {
  return `${path}/${escapePointer(segment)}`;
}

function escapePointer(value) {
  return String(value).replace(/~/g, "~0").replace(/\//g, "~1");
}

function normalizePrivacyKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
