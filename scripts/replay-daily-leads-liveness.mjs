#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeDailyLeadsLivenessFromRepository } from "../automations/jobs/online_daily_leads_liveness.mjs";

const defaultRootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

try {
  const args = parseArgs(process.argv.slice(2));
  const replay = analyzeDailyLeadsLivenessFromRepository({
    rootDir: args.root ? path.resolve(args.root) : defaultRootDir,
    startDate: args.from,
    endDate: args.to,
    days: args.days ? Number(args.days) : 15
  });
  console.log(JSON.stringify(replay, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseArgs(argv) {
  const args = {};
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      throw new Error(`Unknown Daily Leads liveness argument: ${argument}`);
    }
    args[match[1]] = match[2];
  }
  return args;
}
