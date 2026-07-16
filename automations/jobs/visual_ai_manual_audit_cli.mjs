#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  runVisualAiManualAudit,
  validateVisualAiManualAuditArtifact,
  visualAiConfigFromEnv
} from "./visual_ai_manual_audit.mjs";
import { createFakeVisualAiProvider } from "./visual_ai_fake_provider.mjs";
import { createOpenAiVisualAiProvider } from "./visual_ai_openai_provider.mjs";

export async function runVisualAiManualAuditCli({ argv = process.argv.slice(2), env = process.env } = {}) {
  const args = parseArgs(argv);
  const outputPath = path.resolve(args.output ?? env.VISUAL_AI_OUTPUT_PATH ?? "data/runtime/visual-ai-manual-audit.json");
  const config = visualAiConfigFromEnv(env);
  const request = {
    project: env.VISUAL_AI_PROJECT ?? "",
    dedupe_key: env.VISUAL_AI_DEDUPE_KEY ?? "",
    image_urls: parseJsonArray(env.VISUAL_AI_IMAGE_URLS_JSON, "VISUAL_AI_IMAGE_URLS_JSON"),
    context: env.VISUAL_AI_CONTEXT ?? "",
    lead_snapshot: parseJsonObject(env.VISUAL_AI_LEAD_SNAPSHOT_JSON, "VISUAL_AI_LEAD_SNAPSHOT_JSON")
  };
  const providers = {
    fake: createFakeVisualAiProvider(),
    openai: createOpenAiVisualAiProvider()
  };
  const artifact = await runVisualAiManualAudit({ request, config, providers });
  const errors = validateVisualAiManualAuditArtifact(artifact);
  if (errors.length) throw new Error(`visual AI audit contract failed:\n- ${errors.join("\n- ")}`);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: artifact.status,
    provider: artifact.provider,
    skip_reason: artifact.skip_reason,
    real_ai_requests: artifact.guardrails.real_ai_requests,
    output_path: outputPath
  }));
  return artifact;
}

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith("--") || !item.includes("=")) continue;
    const [key, ...rest] = item.slice(2).split("=");
    args[key] = rest.join("=");
  }
  return args;
}

function parseJsonArray(value, name) {
  if (!value) return [];
  const parsed = parseJson(value, name);
  if (!Array.isArray(parsed)) throw new Error(`${name} must be a JSON array`);
  return parsed;
}

function parseJsonObject(value, name) {
  if (!value) return {};
  const parsed = parseJson(value, name);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${name} must be a JSON object`);
  return parsed;
}

function parseJson(value, name) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${name} must contain valid JSON`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVisualAiManualAuditCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
