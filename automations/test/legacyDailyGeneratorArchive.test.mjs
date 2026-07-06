import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const legacyGeneratorNames = ["online_daily.mjs", "online_daily_v2.mjs", "online_daily_v3.mjs"];
const activeRunnerName = "online_daily_runner.mjs";
const activeGeneratorName = "online_daily_v4.mjs";

function readRepoFile(repoPath) {
  return readFileSync(resolve(rootDir, repoPath), "utf8");
}

function escapedName(name) {
  return name.replaceAll(".", "\\.");
}

describe("legacy daily generator archive contract", () => {
  it("keeps only the current runner and V4 generator in the active jobs root", () => {
    const jobs = readdirSync(resolve(rootDir, "automations/jobs"));

    for (const name of legacyGeneratorNames) {
      assert.equal(
        jobs.includes(name),
        false,
        `${name} is archived in git history and must not remain an active job entrypoint`
      );
      assert.equal(existsSync(resolve(rootDir, "automations/jobs", name)), false);
    }

    assert.ok(jobs.includes(activeRunnerName));
    assert.ok(jobs.includes(activeGeneratorName));
  });

  it("keeps GitHub Actions wired through the rule guard runner only", () => {
    const workflowPaths = [
      ".github/workflows/sync-daily-report.yml",
      ".github/workflows/daily-report-watchdog.yml"
    ];

    for (const workflowPath of workflowPaths) {
      const source = readRepoFile(workflowPath);

      assert.match(source, /node automations\/jobs\/online_daily_runner\.mjs/);
      for (const name of legacyGeneratorNames) {
        assert.doesNotMatch(source, new RegExp(`automations/jobs/${escapedName(name)}`));
      }
    }
  });

  it("keeps runner and rule config pointed at online_daily_v4 only", () => {
    const runnerSource = readRepoFile("automations/jobs/online_daily_runner.mjs");
    const rules = JSON.parse(readRepoFile("automations/rules/daily-report.json"));

    assert.match(runnerSource, /online_daily_v4\.mjs/);
    for (const name of legacyGeneratorNames) {
      assert.doesNotMatch(runnerSource, new RegExp(escapedName(name)));
    }
    assert.deepEqual(rules.compatible_generators, ["automations/jobs/online_daily_v4.mjs"]);
  });

  it("documents that legacy daily generators are archived instead of active entrypoints", () => {
    const source = readRepoFile("docs/CRM_OPTIMIZATION_CONTEXT.md");

    assert.match(source, /Legacy daily generators/);
    assert.match(source, /online_daily\.mjs/);
    assert.match(source, /online_daily_v2\.mjs/);
    assert.match(source, /online_daily_v3\.mjs/);
    assert.match(source, /archived in git history/i);
  });
});
