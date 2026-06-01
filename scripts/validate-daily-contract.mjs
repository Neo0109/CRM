import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = parseArgs(process.argv.slice(2));
const dates = args.all ? availableReportDates() : [args.date ?? latestReportDate()];
const allErrors = [];
const summaries = [];

for (const date of dates) {
  const result = validateDate(date);
  summaries.push(result.summary);
  allErrors.push(...result.errors.map((error) => `${date}: ${error}`));
}

if (allErrors.length) {
  console.error("Daily report contract validation failed:");
  for (const error of allErrors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checked_dates: dates,
  summaries
}, null, 2));

function validateDate(date) {
  const schemas = {
    report: loadJson("schemas/daily_report.schema.json"),
    radar: loadJson("schemas/industry_radar.schema.json"),
    steamTrends: loadJson("schemas/steam_trends.schema.json"),
    sourcingLead: loadJson("schemas/sourcing_lead.schema.json")
  };

  const files = {
    report: `data/reports/${date}.json`,
    radar: `data/radar/${date}.json`,
    steamTrends: `data/steam_trends/${date}.json`
  };

  const errors = [];
  for (const [label, filePath] of Object.entries(files)) {
    if (!existsSync(path.join(rootDir, filePath))) errors.push(`missing ${filePath}`);
  }
  if (errors.length) return { errors, summary: { date, missing: errors.length } };

  const report = loadJson(files.report);
  const radar = loadJson(files.radar);
  const steamTrends = loadJson(files.steamTrends);

  validateSchemaSubset("daily report", schemas.report, report, errors, { root: schemas.report, sourcingLead: schemas.sourcingLead });
  validateSchemaSubset("industry radar", schemas.radar, radar, errors, { root: schemas.radar, sourcingLead: schemas.sourcingLead });
  validateSchemaSubset("steam trends", schemas.steamTrends, steamTrends, errors, { root: schemas.steamTrends, sourcingLead: schemas.sourcingLead });

  if (report.report_date !== date) errors.push(`report_date mismatch in ${files.report}: ${report.report_date}`);
  if (radar.report_date !== date) errors.push(`report_date mismatch in ${files.radar}: ${radar.report_date}`);
  if (steamTrends.report_date !== date) errors.push(`report_date mismatch in ${files.steamTrends}: ${steamTrends.report_date}`);

  const poolEntries = [
    ...poolLeads(report, "push_pool"),
    ...poolLeads(report, "watch_pool"),
    ...poolLeads(report, "drop_pool")
  ];
  const totalLeads = poolEntries.length;
  if (!totalLeads) errors.push("report has no leads across push_pool/watch_pool/drop_pool");

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
  }

  for (const item of radar.items ?? []) {
    const text = `${item.category} ${item.title} ${item.source} ${item.summary}`;
    if (item.category === "行业新闻" && /CRM Online Scan|CRM Sourcing|自动化|内部规则|Sourcing V[0-9]/i.test(text)) {
      errors.push(`radar item is not external industry news: ${item.title}`);
    }
  }

  return {
    errors,
    summary: {
      date,
      push: report.push_pool?.length ?? 0,
      watch: report.watch_pool?.length ?? 0,
      drop: report.drop_pool?.length ?? 0,
      radar_items: radar.items?.length ?? 0,
      steam_trend_items: steamTrends.items?.length ?? 0
    }
  };
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
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

function normalizeLeadName(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isSteamStoreOrDb(value) {
  return /(?:store\.steampowered\.com|steamdb\.info)\/app\/\d+/i.test(String(value ?? ""));
}
