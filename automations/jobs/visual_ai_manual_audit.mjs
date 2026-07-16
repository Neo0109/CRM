import { createHash } from "node:crypto";

export const VISUAL_AI_MANUAL_AUDIT_SCHEMA_VERSION = 1;
export const VISUAL_AI_MANUAL_AUDIT_KIND = "visual_ai_manual_advisory";

const realProviderName = "openai";
const supportedProviders = new Set(["disabled", "fake", realProviderName]);

export async function runVisualAiManualAudit({
  request = {},
  config = {},
  providers = {},
  now = () => new Date().toISOString()
} = {}) {
  const provider = normalizeProvider(config.provider);
  const subject = buildSubject(request);
  const baseArtifact = {
    schema_version: VISUAL_AI_MANUAL_AUDIT_SCHEMA_VERSION,
    audit_kind: VISUAL_AI_MANUAL_AUDIT_KIND,
    generated_at: now(),
    status: "skipped",
    provider,
    model: provider === realProviderName ? stringOrNull(config.model) : null,
    skip_reason: null,
    subject,
    guardrails: guardrails(0),
    result: null
  };

  const gate = providerGate(provider, config, request);
  if (!gate.eligible) {
    return {
      ...baseArtifact,
      skip_reason: gate.reason
    };
  }

  const implementation = providers[provider];
  if (!implementation || implementation.kind !== provider || typeof implementation.audit !== "function") {
    throw new Error(`visual AI provider implementation is unavailable: ${provider}`);
  }

  const providerRequest = immutableProviderRequest(request);
  const rawResult = await implementation.audit(providerRequest, providerRuntimeConfig(config));
  const result = normalizeAuditResult(rawResult);
  const realAiRequests = provider === realProviderName ? 1 : 0;

  return {
    ...baseArtifact,
    status: "completed",
    skip_reason: null,
    guardrails: guardrails(realAiRequests),
    result
  };
}

export function validateVisualAiManualAuditArtifact(artifact) {
  const errors = [];
  if (artifact?.schema_version !== VISUAL_AI_MANUAL_AUDIT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${VISUAL_AI_MANUAL_AUDIT_SCHEMA_VERSION}`);
  }
  if (artifact?.audit_kind !== VISUAL_AI_MANUAL_AUDIT_KIND) {
    errors.push(`audit_kind must be ${VISUAL_AI_MANUAL_AUDIT_KIND}`);
  }
  if (!isIsoDateTime(artifact?.generated_at)) {
    errors.push("generated_at must be an ISO date-time");
  }
  if (!new Set(["completed", "skipped"]).has(artifact?.status)) {
    errors.push("status must be completed or skipped");
  }
  if (!supportedProviders.has(artifact?.provider)) {
    errors.push("provider must be disabled, fake, or openai");
  }
  if (!artifact?.subject || typeof artifact.subject !== "object") {
    errors.push("subject must be an object");
  } else {
    if (typeof artifact.subject.project !== "string" || !artifact.subject.project) errors.push("subject.project must be non-empty");
    if (typeof artifact.subject.dedupe_key !== "string" || !artifact.subject.dedupe_key) errors.push("subject.dedupe_key must be non-empty");
    if (!Number.isInteger(artifact.subject.image_count) || artifact.subject.image_count < 0) errors.push("subject.image_count must be a non-negative integer");
    if (!/^[a-f0-9]{64}$/.test(String(artifact.subject.snapshot_sha256 ?? ""))) errors.push("subject.snapshot_sha256 must be a sha256 digest");
  }

  const requiredZeroFields = ["crm_import_calls", "lead_mutations", "priority_mutations", "pool_mutations"];
  if (!artifact?.guardrails || typeof artifact.guardrails !== "object") {
    errors.push("guardrails must be an object");
  } else {
    if (artifact.guardrails.advisory_only !== true) errors.push("advisory_only must be true");
    for (const field of requiredZeroFields) {
      if (artifact.guardrails[field] !== 0) errors.push(`${field} must be 0`);
    }
    const expectedRealRequests = artifact.status === "completed" && artifact.provider === realProviderName ? 1 : 0;
    if (artifact.guardrails.real_ai_requests !== expectedRealRequests) {
      errors.push(`real_ai_requests must be ${expectedRealRequests}`);
    }
  }

  if (artifact?.status === "completed") {
    errors.push(...validateAuditResult(artifact.result));
    if (artifact.skip_reason !== null) errors.push("completed audit skip_reason must be null");
  } else {
    if (typeof artifact?.skip_reason !== "string" || !artifact.skip_reason) errors.push("skipped audit must include skip_reason");
    if (artifact?.result !== null) errors.push("skipped audit result must be null");
  }

  return errors;
}

export function visualAiConfigFromEnv(env = process.env) {
  return {
    provider: env.VISUAL_AI_PROVIDER,
    productionApproved: env.VISUAL_AI_PRODUCTION_APPROVED,
    apiKey: env.VISUAL_AI_API_KEY,
    model: env.VISUAL_AI_MODEL,
    maxRequests: env.VISUAL_AI_MAX_REQUESTS,
    maxImages: env.VISUAL_AI_MAX_IMAGES,
    maxOutputTokens: env.VISUAL_AI_MAX_OUTPUT_TOKENS
  };
}

function providerGate(provider, config, request) {
  if (provider === "disabled") {
    const requestedProvider = typeof config.provider === "string" ? config.provider.trim().toLowerCase() : "";
    return { eligible: false, reason: requestedProvider && requestedProvider !== "disabled" ? "unsupported_provider" : "provider_disabled" };
  }
  if (provider === "fake") return { eligible: true, reason: null };
  if (!isTrue(config.productionApproved)) return { eligible: false, reason: "production_not_approved" };
  if (!nonEmptyString(config.apiKey)) return { eligible: false, reason: "missing_api_key" };
  if (!nonEmptyString(config.model)) return { eligible: false, reason: "missing_model" };
  if (!positiveInteger(config.maxRequests)) return { eligible: false, reason: "missing_request_budget" };
  if (!positiveInteger(config.maxImages)) return { eligible: false, reason: "missing_image_budget" };
  if (!positiveInteger(config.maxOutputTokens)) return { eligible: false, reason: "missing_output_token_budget" };

  const imageUrls = normalizeImageUrls(request?.image_urls);
  if (imageUrls.length === 0) return { eligible: false, reason: "missing_images" };
  if (imageUrls.length > Number(config.maxImages)) return { eligible: false, reason: "image_budget_exceeded" };
  return { eligible: true, reason: null };
}

function immutableProviderRequest(request) {
  const project = nonEmptyString(request?.project) ? request.project.trim() : "Unspecified manual audit";
  const dedupeKey = nonEmptyString(request?.dedupe_key) ? request.dedupe_key.trim() : "manual:unspecified";
  const providerRequest = {
    project,
    dedupe_key: dedupeKey,
    image_urls: normalizeImageUrls(request?.image_urls),
    context: typeof request?.context === "string" ? request.context.trim() : ""
  };
  return deepFreeze(providerRequest);
}

function buildSubject(request) {
  const snapshot = request?.lead_snapshot && typeof request.lead_snapshot === "object" ? request.lead_snapshot : {};
  return {
    project: nonEmptyString(request?.project) ? request.project.trim() : "Unspecified manual audit",
    dedupe_key: nonEmptyString(request?.dedupe_key) ? request.dedupe_key.trim() : "manual:unspecified",
    image_count: normalizeImageUrls(request?.image_urls).length,
    snapshot_sha256: createHash("sha256").update(stableJson(snapshot)).digest("hex")
  };
}

function normalizeAuditResult(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    visual_summary: typeof source.visual_summary === "string" ? source.visual_summary.trim() : "",
    strengths: stringArray(source.strengths),
    risks: stringArray(source.risks),
    questions_for_human: stringArray(source.questions_for_human),
    confidence: new Set(["low", "medium", "high"]).has(source.confidence) ? source.confidence : "low",
    recommendation_impact: "none"
  };
}

function validateAuditResult(result) {
  const errors = [];
  if (!result || typeof result !== "object") return ["completed audit result must be an object"];
  const allowed = new Set(["visual_summary", "strengths", "risks", "questions_for_human", "confidence", "recommendation_impact"]);
  for (const field of Object.keys(result)) {
    if (!allowed.has(field)) errors.push(`audit result field is not allowed: ${field}`);
  }
  if (typeof result.visual_summary !== "string") errors.push("result.visual_summary must be a string");
  for (const field of ["strengths", "risks", "questions_for_human"]) {
    if (!Array.isArray(result[field]) || result[field].some((item) => typeof item !== "string")) errors.push(`result.${field} must be a string array`);
  }
  if (!new Set(["low", "medium", "high"]).has(result.confidence)) errors.push("result.confidence must be low, medium, or high");
  if (result.recommendation_impact !== "none") errors.push("result.recommendation_impact must be none");
  return errors;
}

function guardrails(realAiRequests) {
  return {
    advisory_only: true,
    real_ai_requests: realAiRequests,
    crm_import_calls: 0,
    lead_mutations: 0,
    priority_mutations: 0,
    pool_mutations: 0
  };
}

function providerRuntimeConfig(config) {
  return deepFreeze({
    apiKey: typeof config.apiKey === "string" ? config.apiKey : "",
    model: typeof config.model === "string" ? config.model.trim() : "",
    maxRequests: Number(config.maxRequests) || 0,
    maxImages: Number(config.maxImages) || 0,
    maxOutputTokens: Number(config.maxOutputTokens) || 0
  });
}

function normalizeProvider(value) {
  const provider = typeof value === "string" ? value.trim().toLowerCase() : "disabled";
  return supportedProviders.has(provider) ? provider : "disabled";
}

function normalizeImageUrls(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => /^https:\/\/[^\s]+$/i.test(item)))];
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function stringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function stringOrNull(value) {
  return nonEmptyString(value) ? value.trim() : null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
}

function isTrue(value) {
  return value === true || (typeof value === "string" && value.trim().toLowerCase() === "true");
}

function isIsoDateTime(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) && /T/.test(value);
}
