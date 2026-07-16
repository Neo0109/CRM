#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildSteamReviewOpportunityArtifact,
  validateSteamReviewOpportunityArtifact,
  writeSteamReviewOpportunityArtifact
} from "./steam_review_opportunity_artifact.mjs";
import { collectSteamReviewOpportunities } from "./steam_review_opportunity_source.mjs";

export async function runSteamReviewOpportunityAudit(options = {}) {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const reportDate = options.reportDate ?? todayInShanghai();
  const generatedAt = options.generatedAt ?? nowInShanghaiIso();
  const collectImpl = options.collectImpl ?? collectSteamReviewOpportunities;
  const collection = await collectImpl(options.collectOptions ?? options);
  const artifact = buildSteamReviewOpportunityArtifact({ reportDate, generatedAt, collection });
  validateSteamReviewOpportunityArtifact(artifact);
  const outputPath = options.outputPath
    ? path.resolve(rootDir, options.outputPath)
    : path.join(rootDir, `data/steam_review_opportunities/${reportDate}.json`);
  await writeSteamReviewOpportunityArtifact(outputPath, artifact);
  return { artifact, outputPath };
}

function parseArgs(argv) {
  const parsed = {};
  for (const item of argv) {
    if (item === "--help" || item === "-h") parsed.help = true;
    const match = item.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

function printUsage() {
  console.log(`Usage: node automations/jobs/steam_review_opportunity_audit.mjs [options]

Writes only data/steam_review_opportunities/YYYY-MM-DD.json.

Options:
  --date=YYYY-MM-DD
  --output=relative/or/absolute/path.json
  --pageSize=50
  --maxPages=N       Optional bounded scan; bounded output records scan_complete=false.
  --concurrency=2
  --requestDelayMs=2100`);
}

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function nowInShanghaiIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}+08:00`;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    printUsage();
    return;
  }
  const result = await runSteamReviewOpportunityAudit({
    reportDate: args.date,
    outputPath: args.output,
    collectOptions: {
      pageSize: args.pageSize,
      maxPages: args.maxPages,
      concurrency: args.concurrency,
      requestDelayMs: args.requestDelayMs ?? 2100
    }
  });
  console.log(JSON.stringify({
    ok: true,
    output_path: result.outputPath,
    scan_summary: result.artifact.scan_summary
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
