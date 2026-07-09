import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

import {
  buildVerificationTasks,
  formatTaskList,
} from "./verify-all.mjs";

const expectedTaskIds = [
  "frontend-tests",
  "backend-tests",
  "functions-tests",
  "daily-v4-tests",
  "automation-diagnostics-test",
  "lead-assistant-test",
  "sourcing-learning-test",
  "daily-heartbeat-test",
  "frontend-typecheck",
  "backend-typecheck",
  "functions-typecheck",
  "sourcing-v6-4",
  "daily-contract",
  "frontend-build-temp",
  "diff-check",
];

test("builds the full verify-all task list in a stable order", () => {
  const tasks = buildVerificationTasks({ tempRoot: "/tmp/crm-verify-all-test" });

  assert.deepEqual(
    tasks.map((task) => task.id),
    expectedTaskIds,
  );
});

test("keeps scattered diagnostics and assistant checks in the default suite", () => {
  const tasks = buildVerificationTasks({ tempRoot: "/tmp/crm-verify-all-test" });
  const commandText = tasks.map((task) => `${task.command} ${task.args.join(" ")}`).join("\n");

  assert.match(commandText, /scripts\/test-automation-diagnostics\.ts/);
  assert.match(commandText, /scripts\/test-lead-assistant-model\.ts/);
  assert.match(commandText, /scripts\/test-sourcing-learning\.mjs/);
  assert.match(commandText, /scripts\/test-daily-report-heartbeat\.mjs/);
});

test("does not include live generators, watchdogs, or manual import commands", () => {
  const tasks = buildVerificationTasks({ tempRoot: "/tmp/crm-verify-all-test" });
  const commandText = tasks.map((task) => `${task.command} ${task.args.join(" ")}`).join("\n");

  assert.doesNotMatch(commandText, /online_daily_runner\.mjs/);
  assert.doesNotMatch(commandText, /daily-report-watchdog\.mjs/);
  assert.doesNotMatch(commandText, /import:daily/);
});

test("builds frontend into a temporary directory instead of tracked dist", () => {
  const tasks = buildVerificationTasks({ tempRoot: "/tmp/crm-verify-all-test" });
  const frontendBuild = tasks.find((task) => task.id === "frontend-build-temp");

  assert.ok(frontendBuild);
  assert.deepEqual(frontendBuild.cwd, "app/frontend");
  assert.ok(frontendBuild.args.includes("--outDir"));
  assert.ok(frontendBuild.args.includes("/tmp/crm-verify-all-test/frontend-dist"));
  assert.doesNotMatch(frontendBuild.args.join(" "), /app\/frontend\/dist/);
});

test("formats task list without requiring command execution", () => {
  const tasks = buildVerificationTasks({ tempRoot: "/tmp/crm-verify-all-test" });
  const output = formatTaskList(tasks);

  for (const id of expectedTaskIds) {
    assert.match(output, new RegExp(`\\b${id}\\b`));
  }
});

test("CLI --list prints task ids and does not run task commands", () => {
  const output = execFileSync(process.execPath, ["scripts/verify-all.mjs", "--list"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });

  for (const id of expectedTaskIds) {
    assert.match(output, new RegExp(`\\b${id}\\b`));
  }
  assert.doesNotMatch(output, /\[verify-all\] running/);
});
