#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateSteamReviewOpportunityArtifact } from "../automations/jobs/steam_review_opportunity_artifact.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = parseArgs(process.argv.slice(2));
if (!args.file) {
  console.error("Usage: node scripts/validate-steam-review-opportunities.mjs --file=path/to/artifact.json");
  process.exit(1);
}

try {
  const filePath = path.resolve(repoRoot, args.file);
  const schema = JSON.parse(readFileSync(path.join(repoRoot, "schemas/steam_review_opportunities.schema.json"), "utf8"));
  const artifact = JSON.parse(readFileSync(filePath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validateSchema = ajv.compile(schema);
  if (!validateSchema(artifact)) {
    const details = (validateSchema.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`).join("\n");
    throw new Error(`Steam review opportunity schema validation failed:\n${details}`);
  }
  const integrity = validateSteamReviewOpportunityArtifact(artifact);
  console.log(JSON.stringify({ ok: true, file: filePath, records: integrity.records }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {};
  for (const item of argv) {
    const match = item.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
