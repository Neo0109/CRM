#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

import { validateVisualAiManualAuditArtifact } from "../automations/jobs/visual_ai_manual_audit.mjs";

const fileArg = process.argv.find((item) => item.startsWith("--file="));
if (!fileArg) {
  console.error("Usage: node scripts/validate-visual-ai-manual-audit.mjs --file=PATH");
  process.exitCode = 1;
} else {
  const filePath = path.resolve(fileArg.slice("--file=".length));
  try {
    const artifact = JSON.parse(await readFile(filePath, "utf8"));
    const errors = validateVisualAiManualAuditArtifact(artifact);
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(JSON.stringify({ valid: true, file: filePath, status: artifact.status, real_ai_requests: artifact.guardrails.real_ai_requests }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
