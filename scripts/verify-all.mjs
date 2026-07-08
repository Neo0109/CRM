#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const defaultTempRoot = path.join(tmpdir(), "crm-verify-all");

function quoteArg(value) {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function task(id, command, args, options = {}) {
  return {
    id,
    command,
    args,
    cwd: options.cwd ?? ".",
    shell: options.shell ?? false,
  };
}

export function buildVerificationTasks({ tempRoot = defaultTempRoot } = {}) {
  const frontendDist = path.join(tempRoot, "frontend-dist");

  return [
    task("frontend-tests", "sh", ["-lc", "pnpm dlx tsx@4.16.2 --test app/frontend/test/*.mjs"]),
    task("backend-tests", "sh", ["-lc", "pnpm dlx tsx@4.16.2 --test app/backend/test/*.test.ts"]),
    task("functions-tests", "sh", ["-lc", "pnpm dlx tsx@4.16.2 --test functions/test/*.test.ts"]),
    task("daily-v4-tests", "sh", ["-lc", "node --test automations/test/*.mjs"]),
    task("automation-diagnostics-test", "pnpm", ["dlx", "tsx@4.16.2", "scripts/test-automation-diagnostics.ts"]),
    task("lead-assistant-test", "pnpm", ["dlx", "tsx@4.16.2", "scripts/test-lead-assistant-model.ts"]),
    task("sourcing-learning-test", "node", ["--test", "scripts/test-sourcing-learning.mjs"]),
    task("frontend-typecheck", "pnpm", ["--package=typescript@5.5.3", "dlx", "tsc", "-p", "app/frontend/tsconfig.json", "--noEmit"]),
    task("backend-typecheck", "pnpm", ["--package=typescript@5.5.3", "dlx", "tsc", "-p", "app/backend/tsconfig.json", "--noEmit"]),
    task("functions-typecheck", "pnpm", ["--package=typescript@5.5.3", "dlx", "tsc", "-p", "functions/tsconfig.json", "--noEmit"]),
    task("sourcing-v6-4", "sh", ["-lc", "node scripts/test-sourcing-v6-3.mjs && node scripts/test-bilibili-probe.mjs"]),
    task("daily-contract", "node", ["scripts/validate-daily-contract.mjs", "--allowLowVolume"]),
    task("frontend-build-temp", "npm", ["exec", "--", "vite", "build", "--outDir", frontendDist, "--emptyOutDir"], { cwd: "app/frontend" }),
    task("diff-check", "git", ["diff", "--check"]),
  ];
}

function commandLineFor(taskToFormat) {
  return [taskToFormat.command, ...taskToFormat.args].map(quoteArg).join(" ");
}

export function formatTaskList(tasks) {
  return tasks.map((taskToFormat) => `${taskToFormat.id}: ${commandLineFor(taskToFormat)}`).join("\n");
}

export function runVerificationTasks(tasks, options = {}) {
  const rootDir = options.repoRoot ?? repoRoot;
  const env = options.env ?? process.env;
  const stdio = options.stdio ?? "inherit";
  const runner = options.runner ?? spawnSync;

  for (const taskToRun of tasks) {
    const taskCwd = path.resolve(rootDir, taskToRun.cwd);

    if (!existsSync(taskCwd)) {
      throw new Error(`verify-all task ${taskToRun.id} has missing cwd: ${taskToRun.cwd}`);
    }

    console.log(`[verify-all] running ${taskToRun.id}: ${commandLineFor(taskToRun)}`);
    const result = runner(taskToRun.command, taskToRun.args, {
      cwd: taskCwd,
      env,
      shell: taskToRun.shell,
      stdio,
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      const status = result.status ?? "unknown";
      throw new Error(`verify-all task ${taskToRun.id} failed with exit code ${status}`);
    }
  }
}

function printUsage() {
  console.log(`Usage: node scripts/verify-all.mjs [--list]\n\nRuns the local CRM verification suite without running live generators.`);
}

function main(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }

  const tasks = buildVerificationTasks();

  if (argv.includes("--list")) {
    console.log(formatTaskList(tasks));
    return;
  }

  runVerificationTasks(tasks);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
