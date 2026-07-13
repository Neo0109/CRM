// Loads the online daily-report rules before running the generator.
// This keeps rule iteration visible and fail-fast in GitHub Actions.
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { RULE_VERSION } from "./online_daily_v4_rules.mjs";

const rootDir = process.cwd();
const args = parseArgs(process.argv.slice(2));
const reportDate = args.date ?? todayInShanghai();
const jobDir = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = path.join(rootDir, "automations/rules/daily-report.json");
const generatorPath = path.join(jobDir, "online_daily_v4.mjs");
const generatorRepoPath = "automations/jobs/online_daily_v4.mjs";

const rules = await loadRules(rulesPath);
validateRules(rules);

console.log(JSON.stringify({
  ok: true,
  stage: "daily_report_rules_loaded",
  rule_version: rules.rule_version,
  schema_version: rules.schema_version,
  active_rules_doc: rules.active_rules_doc,
  canonical_rules_doc: rules.canonical_rules_doc,
  generator: generatorRepoPath
}, null, 2));

await import(pathToFileURL(generatorPath).href);
runDailyContractValidation(reportDate, { allowLowVolume: booleanArg(args.allowLowVolume) });

async function loadRules(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to load daily report rules from ${filePath}: ${error.message}`);
  }
}

function validateRules(value) {
  if (!value || typeof value !== "object") throw new Error("Daily report rules must be a JSON object.");
  if (value.schema_version !== 1) throw new Error(`Unsupported daily report rule schema: ${value.schema_version}`);
  if (value.rule_version !== RULE_VERSION) throw new Error(`Unsupported daily report rule version: ${value.rule_version}`);
  if (!Array.isArray(value.compatible_generators) || !value.compatible_generators.includes(generatorRepoPath)) {
    throw new Error(`Daily report rules are not marked compatible with ${generatorRepoPath}.`);
  }
  if (value.active_rules_doc !== "docs/SOURCING_RULES_CURRENT.md") {
    throw new Error(`Unexpected active rules doc: ${value.active_rules_doc}`);
  }
}

function runDailyContractValidation(date, options = {}) {
  const validateArgs = ["scripts/validate-daily-contract.mjs", `--date=${date}`];
  if (options.allowLowVolume) validateArgs.push("--allowLowVolume=true");
  const result = spawnSync(process.execPath, validateArgs, {
    cwd: rootDir,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`Daily report contract validation failed for ${date}.`);
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (const item of argv) {
    const match = item.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

function booleanArg(value) {
  return value === true || value === "true" || value === "1" || value === "yes";
}

function todayInShanghai() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
