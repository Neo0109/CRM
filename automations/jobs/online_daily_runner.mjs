// Loads the online daily-report rules before running the generator.
// This keeps rule iteration visible and fail-fast in GitHub Actions.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = process.cwd();
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
  if (value.rule_version !== "sourcing-rules-v4") throw new Error(`Unsupported daily report rule version: ${value.rule_version}`);
  if (!Array.isArray(value.compatible_generators) || !value.compatible_generators.includes(generatorRepoPath)) {
    throw new Error(`Daily report rules are not marked compatible with ${generatorRepoPath}.`);
  }
  if (value.active_rules_doc !== "docs/SOURCING_RULES_CURRENT.md") {
    throw new Error(`Unexpected active rules doc: ${value.active_rules_doc}`);
  }
}
