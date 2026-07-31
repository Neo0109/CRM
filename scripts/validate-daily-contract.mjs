import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RULE_VERSION } from "../automations/jobs/online_daily_v4_rules.mjs";

const defaultRootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = parseArgs(process.argv.slice(2));
const rootDir = args.rootDir ? path.resolve(args.rootDir) : defaultRootDir;
const dates = args.all ? availableReportDates() : [args.date ?? latestReportDate()];
const thresholds = {
  minRadarItems: numberArg(args.minRadarItems, 8),
  minSteamTrendItems: numberArg(args.minSteamTrendItems, 8),
  minSteamMarketInsights: numberArg(args.minSteamMarketInsights, 3),
  minSteamGenreSignals: numberArg(args.minSteamGenreSignals, 3)
};
const allowLowVolume = booleanArg(args.allowLowVolume);
const requireSourcingCandidates = booleanArg(args.requireSourcingCandidates);
const allErrors = [];
const allWarnings = [];
const summaries = [];

for (const date of dates) {
  const result = validateDate(date, thresholds, { requireSourcingCandidates });
  summaries.push(result.summary);
  allErrors.push(...result.errors.map((error) => `${date}: ${error}`));
  allWarnings.push(...result.warnings.map((warning) => `${date}: ${warning}`));
}

if (allErrors.length) {
  console.error("Daily report contract validation failed:");
  for (const error of allErrors) console.error(`- ${error}`);
  process.exit(1);
}

if (allWarnings.length) {
  console.warn("Daily report contract validation warnings:");
  for (const warning of allWarnings) console.warn(`- ${warning}`);
}

console.log(JSON.stringify({
  ok: true,
  checked_dates: dates,
  warnings: allWarnings,
  summaries
}, null, 2));

function validateDate(date, thresholds, options = {}) {
  const schemas = {
    report: loadJson("schemas/daily_report.schema.json"),
    radar: loadJson("schemas/industry_radar.schema.json"),
    steamTrends: loadJson("schemas/steam_trends.schema.json"),
    sourcingLead: loadJson("schemas/sourcing_lead.schema.json"),
    sourcingCandidates: loadJson("schemas/sourcing_candidates.schema.json")
  };

  const files = {
    report: `data/reports/${date}.json`,
    radar: `data/radar/${date}.json`,
    steamTrends: `data/steam_trends/${date}.json`,
    sourcingCandidates: `data/sourcing_candidates/${date}.json`
  };

  const errors = [];
  const warnings = [];
  for (const [label, filePath] of Object.entries(files).filter(([key]) => key !== "sourcingCandidates")) {
    if (!existsSync(path.join(rootDir, filePath))) errors.push(`missing ${filePath}`);
  }
  const hasSourcingCandidates = existsSync(path.join(rootDir, files.sourcingCandidates));
  if (options.requireSourcingCandidates && !hasSourcingCandidates) errors.push(`missing ${files.sourcingCandidates}`);
  if (errors.length) return { errors, warnings, summary: { date, missing: errors.length } };

  const report = loadJson(files.report);
  const radar = loadJson(files.radar);
  const steamTrends = loadJson(files.steamTrends);
  const sourcingCandidates = hasSourcingCandidates ? loadJson(files.sourcingCandidates) : null;
  const enforceV62 = date >= "2026-06-04";

  validateSchemaSubset("daily report", schemas.report, report, errors, { root: schemas.report, sourcingLead: schemas.sourcingLead });
  validateSchemaSubset("industry radar", schemas.radar, radar, errors, { root: schemas.radar, sourcingLead: schemas.sourcingLead });
  validateSchemaSubset("steam trends", schemas.steamTrends, steamTrends, errors, { root: schemas.steamTrends, sourcingLead: schemas.sourcingLead });
  if (sourcingCandidates) {
    validateSchemaSubset("sourcing candidates", schemas.sourcingCandidates, sourcingCandidates, errors, {
      root: schemas.sourcingCandidates,
      sourcingLead: schemas.sourcingLead
    });
    validateSourcingCandidateIntegrity(sourcingCandidates, report, date, errors);
  }

  if (report.report_date !== date) errors.push(`report_date mismatch in ${files.report}: ${report.report_date}`);
  if (radar.report_date !== date) errors.push(`report_date mismatch in ${files.radar}: ${radar.report_date}`);
  if (steamTrends.report_date !== date) errors.push(`report_date mismatch in ${files.steamTrends}: ${steamTrends.report_date}`);
  addVolumeIssue(warnings, errors, allowLowVolume, (radar.items?.length ?? 0) < thresholds.minRadarItems, `radar has fewer than ${thresholds.minRadarItems} items`);
  addVolumeIssue(warnings, errors, allowLowVolume, (steamTrends.items?.length ?? 0) < thresholds.minSteamTrendItems, `steam trends has fewer than ${thresholds.minSteamTrendItems} items`);
  addVolumeIssue(warnings, errors, allowLowVolume, (steamTrends.market_insights?.length ?? 0) < thresholds.minSteamMarketInsights, `steam trends has fewer than ${thresholds.minSteamMarketInsights} market insights`);
  addVolumeIssue(warnings, errors, allowLowVolume, (steamTrends.genre_signals?.length ?? 0) < thresholds.minSteamGenreSignals, `steam trends has fewer than ${thresholds.minSteamGenreSignals} genre signals`);

  const poolEntries = [
    ...poolLeads(report, "push_pool"),
    ...poolLeads(report, "watch_pool"),
    ...poolLeads(report, "drop_pool")
  ];
  const seen = new Set();
  for (const { pool, lead } of poolEntries) {
    const key = lead.steam_app_id ? `steam:${lead.steam_app_id}` : `project:${normalizeLeadName(lead.project)}`;
    if (seen.has(key)) errors.push(`duplicate lead across pools: ${lead.project}`);
    seen.add(key);

    if (pool === "drop_pool") {
      if (lead.bucket !== "淘汰池") errors.push(`${lead.project}: drop_pool lead must use bucket=淘汰池`);
      if (lead.stage !== "rejected") errors.push(`${lead.project}: drop_pool lead must use stage=rejected`);
    } else {
      if (lead.bucket !== "未处理") errors.push(`${lead.project}: non-dropped daily lead must enter bucket=未处理`);
      if (lead.stage !== "new") errors.push(`${lead.project}: non-dropped daily lead must enter stage=new`);
    }

    if (!Array.isArray(lead.links) || lead.links.length === 0) errors.push(`${lead.project}: links must contain at least one verification URL`);
    for (const method of lead.contact_methods ?? []) {
      if (isSteamStoreOrDb(method.value)) errors.push(`${lead.project}: Steam store/SteamDB URL must be in links, not contact_methods`);
    }
    if (isBilibiliLead(lead)) {
      const text = leadText(lead);
      if (pool !== "drop_pool" && hasAlreadyReleasedMediaText(text)) {
        errors.push(`${lead.project}: Bilibili/media lead appears already released and must not enter push_pool/watch_pool`);
      }
      if (/store\.steampowered\.com\/app\/|steam商店页|Steam商店页/i.test(text) && !(lead.links ?? []).some(isSteamStoreOrDb)) {
        errors.push(`${lead.project}: Bilibili/media text mentions a Steam store page but links do not contain a normalized Steam URL`);
      }
      if (enforceV62 && /https?:\/\//i.test(String(lead.gameplay ?? ""))) {
        errors.push(`${lead.project}: V6.2+ gameplay must be compact tags and must not contain raw URLs`);
      }
      if (enforceV62 && /https?:\/\//i.test(String(lead.progress ?? ""))) {
        errors.push(`${lead.project}: V6.2+ progress must be a short status and must not contain raw URLs`);
      }
    }
  }

  for (const item of radar.items ?? []) {
    const text = `${item.category} ${item.title} ${item.source} ${item.summary}`;
    if (item.category === "行业新闻" && /CRM Online Scan|CRM Sourcing|自动化|内部规则|Sourcing V[0-9]/i.test(text)) {
      errors.push(`radar item is not external industry news: ${item.title}`);
    }
  }
  for (const item of steamTrends.market_insights ?? []) {
    const text = `${item.title} ${item.summary} ${item.source} ${item.link} ${item.suggested_action}`;
    if (/CRM Sourcing|SOURCING_RULES|sourcing-rules|github\.com\/Neo0109\/CRM|内部自动化|日报规则|规则说明|非淘汰项目统一/i.test(text)) {
      errors.push(`steam market insight uses internal rule/source instead of Steam market signal: ${item.title}`);
    }
  }

  return {
    errors,
    warnings,
    summary: {
      date,
      push: report.push_pool?.length ?? 0,
      watch: report.watch_pool?.length ?? 0,
      drop: report.drop_pool?.length ?? 0,
      radar_items: radar.items?.length ?? 0,
      steam_trend_items: steamTrends.items?.length ?? 0,
      steam_market_insights: steamTrends.market_insights?.length ?? 0,
      steam_genre_signals: steamTrends.genre_signals?.length ?? 0,
      sourcing_candidates: sourcingCandidates?.candidates?.length ?? null
    }
  };
}

function validateSourcingCandidateIntegrity(artifact, report, date, errors) {
  if (artifact.report_date !== date) {
    errors.push(`report_date mismatch in data/sourcing_candidates/${date}.json: ${artifact.report_date}`);
  }

  const candidates = Array.isArray(artifact.candidates) ? artifact.candidates : [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = String(candidate?.dedupe_key ?? "");
    if (seen.has(key)) errors.push(`duplicate sourcing candidate dedupe_key: ${key}`);
    seen.add(key);
    if (candidate?.sourcing_rule_version !== artifact.sourcing_rule_version) {
      errors.push(`${key || "sourcing candidate"}: sourcing_rule_version must match artifact`);
    }
  }

  const counts = {
    records_total: candidates.length,
    formal: candidates.filter((candidate) => candidate?.decision === "formal").length,
    candidate: candidates.filter((candidate) => candidate?.decision === "candidate").length,
    excluded: candidates.filter((candidate) => candidate?.decision === "excluded").length
  };
  for (const [key, actual] of Object.entries(counts)) {
    if (artifact.scan_summary?.[key] !== actual) {
      errors.push(`sourcing candidate scan_summary.${key} expected ${actual}, received ${artifact.scan_summary?.[key]}`);
    }
  }

  if (artifact.schema_version === 2) validateSourcingCandidateV2(artifact, candidates, errors);
  if (artifact.schema_version === 3) validateSourcingCandidateV3(artifact, candidates, errors);

  if (artifact.sourcing_rule_version === RULE_VERSION) {
    const newQualifiedCount = artifact.scan_summary?.new_qualified_count;
    const recordedPushPoolCount = artifact.scan_summary?.push_pool_count;
    const reportPushPoolCount = poolLeads(report, "push_pool").length;
    if (!Number.isInteger(newQualifiedCount)) {
      errors.push("V7 sourcing candidate scan_summary.new_qualified_count must be an integer");
    }
    if (!Number.isInteger(recordedPushPoolCount)) {
      errors.push("V7 sourcing candidate scan_summary.push_pool_count must be an integer");
    }
    if (newQualifiedCount !== recordedPushPoolCount) {
      errors.push(`V7 admission parity mismatch: new_qualified_count=${newQualifiedCount}, push_pool_count=${recordedPushPoolCount}`);
    }
    if (recordedPushPoolCount !== reportPushPoolCount) {
      errors.push(`V7 report parity mismatch: scan_summary.push_pool_count=${recordedPushPoolCount}, report push_pool=${reportPushPoolCount}`);
    }
    if (poolLeads(report, "watch_pool").length || poolLeads(report, "drop_pool").length) {
      errors.push("V7 Daily report must keep watch_pool and drop_pool empty");
    }
  }

  const reportFormalKeys = new Set([
    ...poolLeads(report, "push_pool"),
    ...poolLeads(report, "watch_pool")
  ].map(({ lead }) => auditDedupeKey(lead)).filter(Boolean));
  const artifactFormalKeys = new Set(
    candidates.filter((candidate) => candidate?.decision === "formal").map((candidate) => candidate.dedupe_key)
  );
  for (const key of reportFormalKeys) {
    if (!artifactFormalKeys.has(key)) errors.push(`formal report Lead missing from sourcing candidate audit: ${key}`);
  }
  for (const key of artifactFormalKeys) {
    if (!reportFormalKeys.has(key)) errors.push(`formal sourcing candidate missing from report pools: ${key}`);
  }
}

function validateSourcingCandidateV2(artifact, candidates, errors) {
  const summary = artifact.scan_summary ?? {};
  const requiredSummaryFields = [
    "steam_candidates_scheduled",
    "steam_candidates_reused",
    "steam_candidates_fresh_success",
    "steam_candidates_failed",
    "steam_candidates_deferred",
    "steam_candidates_evaluated",
    "backlog_unenriched_count",
    "evidence_snapshot_rejections"
  ];
  for (const field of requiredSummaryFields) {
    if (!Number.isInteger(summary[field]) || summary[field] < 0) {
      errors.push("schema v2 scan_summary." + field + " must be a nonnegative integer");
    }
  }
  const laneCounts = summary.scheduler_lane_counts;
  for (const lane of ["new", "backlog", "retry_refresh"]) {
    if (!Number.isInteger(laneCounts?.[lane]) || laneCounts[lane] < 0) {
      errors.push("schema v2 scan_summary.scheduler_lane_counts." + lane + " must be a nonnegative integer");
    }
  }

  if (summary.steam_candidates_enriched !== summary.steam_candidates_scheduled) {
    errors.push("schema v2 steam_candidates_enriched must equal steam_candidates_scheduled");
  }
  if (summary.steam_candidates_scheduled !== summary.steam_candidates_fresh_success + summary.steam_candidates_failed) {
    errors.push("schema v2 scheduled count must equal fresh success plus failed");
  }
  if (summary.steam_candidates_evaluated !== summary.steam_candidates_scheduled + summary.steam_candidates_reused) {
    errors.push("schema v2 evaluated count must equal scheduled plus reused");
  }
  const laneTotal = ["new", "backlog", "retry_refresh"]
    .reduce((sum, lane) => sum + Number(laneCounts?.[lane] ?? 0), 0);
  if (laneTotal !== summary.steam_candidates_scheduled) {
    errors.push("schema v2 scheduler lane counts must sum to steam_candidates_scheduled");
  }
  if (summary.steam_candidates_evaluated + summary.steam_candidates_deferred !== summary.steam_candidates_seen) {
    errors.push("schema v2 evaluated plus deferred must equal steam_candidates_seen");
  }
  if (summary.backlog_unenriched_count > summary.steam_candidates_seen) {
    errors.push("schema v2 backlog_unenriched_count cannot exceed steam_candidates_seen");
  }

  const requiredStateFields = [
    "first_seen",
    "last_seen",
    "enrichment_status",
    "enrichment_attempts",
    "last_attempted_at",
    "last_enriched_at",
    "next_retry_date",
    "scheduler_lane",
    "evidence_snapshot"
  ];
  for (const candidate of candidates) {
    if (!["steam", "multi_source"].includes(candidate?.source_type)) continue;
    const key = String(candidate?.dedupe_key ?? "sourcing candidate");
    for (const field of requiredStateFields) {
      if (!(field in candidate)) errors.push(key + ": " + field + " is required for schema v2");
    }
    if (candidate.last_seen !== artifact.report_date) {
      errors.push(key + ": last_seen must equal artifact report_date");
    }
    if (candidate.first_seen > candidate.last_seen) {
      errors.push(key + ": first_seen cannot be after last_seen");
    }
    const snapshot = candidate.evidence_snapshot;
    if (!snapshot) continue;
    if (snapshot.contract_version !== 1) {
      errors.push(key + ": evidence_snapshot contract_version must be 1");
    }
    if (snapshot.dedupe_key !== key) {
      errors.push(key + ": evidence_snapshot dedupe_key must match candidate");
    }
    if (String(snapshot.evidence?.appId ?? "") !== String(candidate.steam_app_id ?? "")) {
      errors.push(key + ": evidence_snapshot appId must match candidate");
    }
    if (snapshot.evidence?.hasDetails !== true) {
      errors.push(key + ": evidence_snapshot must contain successful Steam details");
    }
    if (String(snapshot.captured_at ?? "").slice(0, 10) >= String(snapshot.expires_on ?? "")) {
      errors.push(key + ": evidence_snapshot expires_on must be after captured_at");
    }
  }
}

function validateSourcingCandidateV3(artifact, candidates, errors) {
  validateSourcingCandidateV2(artifact, candidates, errors);

  const requiredActionableFields = ["failed_gate_details", "next_evidence_actions"];
  for (const candidate of candidates) {
    const key = String(candidate?.dedupe_key ?? "sourcing candidate");
    for (const field of requiredActionableFields) {
      if (!Object.prototype.hasOwnProperty.call(candidate ?? {}, field)) {
        errors.push(key + ": " + field + " is required for schema v3");
      }
    }
  }
}

function auditDedupeKey(lead) {
  const appId = String(lead?.steam_app_id ?? "").trim();
  if (appId) return `steam:${appId}`;
  const project = normalizeLeadName(lead?.project);
  return project ? `project:${project}` : null;
}

function poolLeads(report, pool) {
  return (report[pool] ?? []).map((lead) => ({ pool, lead }));
}

function validateSchemaSubset(label, schema, value, errors, context, instancePath = "") {
  const resolved = resolveSchemaRef(schema, context);
  if (resolved !== schema) {
    const nextContext = resolved === context.sourcingLead ? { ...context, root: context.sourcingLead } : context;
    validateSchemaSubset(label, resolved, value, errors, nextContext, instancePath);
    return;
  }

  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${label} schema ${instancePath || "/"} expected ${formatType(schema.type)}`);
    return;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${label} schema ${instancePath || "/"} must be one of ${schema.enum.join(", ")}`);
  }

  if (schema.format === "date" && typeof value === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors.push(`${label} schema ${instancePath || "/"} must be YYYY-MM-DD`);
  }
  if (schema.format === "date-time" && typeof value === "string" && Number.isNaN(Date.parse(value))) {
    errors.push(`${label} schema ${instancePath || "/"} must be an ISO date-time`);
  }
  if (typeof value === "string" && typeof schema.minLength === "number" && value.length < schema.minLength) {
    errors.push(`${label} schema ${instancePath || "/"} must contain at least ${schema.minLength} character(s)`);
  }
  if (typeof value === "number" && typeof schema.minimum === "number" && value < schema.minimum) {
    errors.push(`${label} schema ${instancePath || "/"} must be >= ${schema.minimum}`);
  }
  if (typeof value === "number" && typeof schema.maximum === "number" && value > schema.maximum) {
    errors.push(`${label} schema ${instancePath || "/"} must be <= ${schema.maximum}`);
  }

  if (schema.type === "object" || (schema.properties && isPlainObject(value))) {
    if (!isPlainObject(value)) return;
    for (const requiredKey of schema.required ?? []) {
      if (!(requiredKey in value)) errors.push(`${label} schema ${joinPath(instancePath, requiredKey)} is required`);
    }
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) errors.push(`${label} schema ${joinPath(instancePath, key)} is not allowed`);
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (key in value) validateSchemaSubset(label, childSchema, value[key], errors, context, joinPath(instancePath, key));
    }
  }

  if (schema.type === "array" || (schema.items && Array.isArray(value))) {
    if (!Array.isArray(value)) return;
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push(`${label} schema ${instancePath || "/"} must contain at least ${schema.minItems} item(s)`);
    }
    if (schema.items) {
      value.forEach((item, index) => validateSchemaSubset(label, schema.items, item, errors, context, `${instancePath}/${index}`));
    }
  }
}

function resolveSchemaRef(schema, context) {
  if (!schema.$ref) return schema;
  if (schema.$ref.startsWith("#/$defs/")) {
    const key = schema.$ref.replace("#/$defs/", "");
    return context.root.$defs?.[key] ?? schema;
  }
  if (schema.$ref === "./sourcing_lead.schema.json" || schema.$ref === "sourcing_lead.schema.json") {
    return context.sourcingLead;
  }
  return schema;
}

function matchesType(value, type) {
  const types = Array.isArray(type) ? type : [type];
  return types.some((entry) => {
    if (entry === "null") return value === null;
    if (entry === "array") return Array.isArray(value);
    if (entry === "object") return isPlainObject(value);
    if (entry === "integer") return Number.isInteger(value);
    if (entry === "number") return typeof value === "number" && Number.isFinite(value);
    return typeof value === entry;
  });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatType(type) {
  return Array.isArray(type) ? type.join(" or ") : type;
}

function joinPath(base, key) {
  return `${base || ""}/${key}`;
}

function availableReportDates() {
  return readdirSync(path.join(rootDir, "data/reports"))
    .map((name) => name.match(/^(\d{4}-\d{2}-\d{2})\.json$/)?.[1])
    .filter(Boolean)
    .sort();
}

function latestReportDate() {
  const dates = availableReportDates();
  const latest = dates.at(-1);
  if (!latest) throw new Error("No dated daily reports found.");
  return latest;
}

function loadJson(repoPath) {
  return JSON.parse(readFileSync(path.join(rootDir, repoPath), "utf8"));
}

function parseArgs(argv) {
  const parsed = {};
  for (const item of argv) {
    if (item === "--all") parsed.all = true;
    const match = item.match(/^--([^=]+)=(.*)$/);
    if (match) {
      parsed[match[1]] = match[2];
    } else if (item.startsWith("--")) {
      parsed[item.slice(2)] = true;
    }
  }
  return parsed;
}

function numberArg(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function booleanArg(value) {
  return value === true || value === "true" || value === "1" || value === "yes";
}

function addVolumeIssue(warnings, errors, allowLowVolume, condition, message) {
  if (!condition) return;
  if (allowLowVolume) warnings.push(message);
  else errors.push(message);
}

function normalizeLeadName(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isSteamStoreOrDb(value) {
  return /(?:store\.steampowered\.com|steamdb\.info)\/app\/\d+/i.test(String(value ?? ""));
}

function isBilibiliLead(lead) {
  return /bilibili|b站|哔哩哔哩/i.test(leadText(lead));
}

function leadText(lead) {
  return [
    lead.project,
    lead.priority_reason,
    lead.rule_fit,
    lead.gameplay,
    lead.progress,
    lead.traction_summary,
    lead.public_signals,
    lead.exposure_trail,
    lead.bilibili_fit,
    lead.amplification,
    lead.risks,
    lead.verdict,
    lead.next_action,
    lead.notes,
    ...(lead.links ?? []),
    ...(lead.contact_methods ?? []).map((method) => `${method.type} ${method.value} ${method.note ?? ""}`)
  ].filter(Boolean).join(" ");
}

function hasAlreadyReleasedMediaText(value) {
  const text = String(value ?? "");
  if (/商店页已上线|商店页面已上线|页面已上线|store page is live|(?:demo|试玩|测试)[^。；.!?]{0,12}(?:已上线|上线)|(?:已上线|上线)[^。；.!?]{0,12}(?:demo|试玩|测试)/i.test(text)) return false;
  return /现已上线|已经上线|现已发售|已经发售|已发售|正式发售|首发优惠|国区首发|发售\s*PV|available now|out now|released now/i.test(text);
}
