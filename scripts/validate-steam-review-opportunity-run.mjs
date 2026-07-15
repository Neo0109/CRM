#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateSteamReviewOpportunityReceipt } from "../automations/jobs/steam_review_opportunity_delivery.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = parseArgs(process.argv.slice(2));
if (!args.file) {
  console.error("Usage: node scripts/validate-steam-review-opportunity-run.mjs --file=path/to/receipt.json");
  process.exit(1);
}

try {
  const filePath = path.resolve(repoRoot, args.file);
  const schema = JSON.parse(readFileSync(path.join(repoRoot, "schemas/steam_review_opportunity_run.schema.json"), "utf8"));
  const receipt = JSON.parse(readFileSync(filePath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validateSchema = ajv.compile(schema);
  if (!validateSchema(receipt)) {
    const details = (validateSchema.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`).join("\n");
    throw new Error(`Steam review opportunity receipt schema validation failed:\n${details}`);
  }
  validateSteamReviewOpportunityReceipt(receipt);
  console.log(JSON.stringify({ ok: true, file: filePath, status: receipt.status }, null, 2));
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
