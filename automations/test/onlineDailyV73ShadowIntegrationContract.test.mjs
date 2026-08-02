import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import * as shadowCollector from "../jobs/online_daily_v7_3_shadow_collector.mjs";

const generator = read("../jobs/online_daily_v4.mjs");
const activeRulesModule = read("../jobs/online_daily_v4_rules.mjs");
const activeRuleText = read("../rules/daily-report.json");
const activeRule = JSON.parse(activeRuleText);
const activeDecision = read("../jobs/online_daily_v4_decision.mjs");
const activeCandidateAudit = read("../jobs/online_daily_v4_candidate_audit.mjs");
const activeReports = read("../jobs/online_daily_v4_reports.mjs");
const dailyValidator = read("../../scripts/validate-daily-contract.mjs");
const syncWorkflow = read("../../.github/workflows/sync-daily-report.yml");
const watchdogWorkflow = read("../../.github/workflows/daily-report-watchdog.yml");

const ORIGINAL_BLOBS = {
  generator: "5864b38f5d88969d85ccb47492b56ee564798cb6",
  activeRulesModule: "0d76e678a322dca98d709677a739de7d38a62135",
  activeRule: "04a63e7d8e644835948ef348ed7e01bb1ac84624",
  activeDecision: "b326be1cb67b36985616ec54a489d30ec958a8c3",
  activeCandidateAudit: "f6e4403f937eaec60e935c01ea37bd8eeacd40d2",
  activeReports: "2d78c1d1605fd5ad6a89e68a85e5c2b20fa3d7e1",
  dailyValidator: "e05e38be25c22ebcd24e9acebfa9012d79e491a3",
  syncWorkflow: "72282bc6964e1b0744624b1903d2c5f4d26d416e",
  watchdogWorkflow: "3a01348ed0b8fc45798e59ceb60dff3a03f94be4"
};

describe("C5-B shadow-only production integration", () => {
  it("keeps every exact denylist and production V7.2 authority blob unchanged", () => {
    assert.equal(gitBlobSha(activeRulesModule), ORIGINAL_BLOBS.activeRulesModule);
    assert.equal(gitBlobSha(activeRuleText), ORIGINAL_BLOBS.activeRule);
    assert.equal(gitBlobSha(activeDecision), ORIGINAL_BLOBS.activeDecision);
    assert.equal(gitBlobSha(activeCandidateAudit), ORIGINAL_BLOBS.activeCandidateAudit);
    assert.equal(gitBlobSha(activeReports), ORIGINAL_BLOBS.activeReports);
    assert.equal(gitBlobSha(dailyValidator), ORIGINAL_BLOBS.dailyValidator);
    assert.match(activeRulesModule, /REGULAR_SOURCING_RULE_VERSION/);
    assert.equal(activeRule.rule_version, "sourcing-rules-v7.2-china-joint");
  });

  it("adds only one non-throwing hook after all four production writes", () => {
    assert.match(generator, /runC5BShadowCollectorSafely/);
    assert.match(generator, /C5B_SHADOW_HOOK_START/);
    assert.equal(gitBlobSha(stripC5BBlocks(generator)), ORIGINAL_BLOBS.generator);

    const hookIndex = generator.indexOf("await runC5BShadowCollectorSafely");
    const writeIndexes = [
      "data/sourcing_candidates/${reportDate}.json",
      "data/reports/${reportDate}.json",
      "data/radar/${reportDate}.json",
      "data/steam_trends/${reportDate}.json"
    ].map((value) => generator.indexOf(value));
    assert.ok(hookIndex > 0);
    assert.ok(writeIndexes.every((index) => index >= 0 && index < hookIndex));
    assert.match(generator, /steamCandidates:\s*enrichedCandidates/);
    assert.match(generator, /mediaCandidates:\s*mediaLeadCandidates/);
    assert.match(generator, /candidateStates/);
    assert.match(generator, /new_lane:\s*40/);
    assert.match(generator, /backlog_lane:\s*30/);
    assert.match(generator, /retry_refresh_lane:\s*20/);
    assert.doesNotMatch(generator, /buildPools\([^)]*v73SecondPass/s);
    assert.doesNotMatch(generator, /buildSourcingCandidateArtifact\([^)]*v73SecondPass/s);
    assert.match(generator, /buildPools\(enrichedCandidates, mediaLeadCandidates, \{ reportDate \}\)/);
  });

  it("isolates an injected collector module-load failure after all four production writes", () => {
    const fixture = mkdtempSync(path.join(tmpdir(), "c5b-generator-load-failure-"));
    try {
      writeFileSync(path.join(fixture, "failing-collector.mjs"), "export const = ;\n");
      const importBlock = c5bBlock(generator, "IMPORT");
      const hookBlock = c5bBlock(generator, "HOOK");
      const harness = `${importBlock}\n${generatorHarnessPrelude()}\n${hookBlock}\n`;
      const harnessPath = path.join(fixture, "generator-harness.mjs");
      const writeLog = path.join(fixture, "writes.json");
      writeFileSync(
        harnessPath,
        harness.replaceAll(
          "./online_daily_v7_3_shadow_collector.mjs",
          "./failing-collector.mjs"
        )
      );

      const result = spawnSync(process.execPath, [harnessPath], {
        cwd: fixture,
        env: { ...process.env, C5B_WRITE_LOG: writeLog },
        encoding: "utf8"
      });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(readFileSync(writeLog, "utf8")), [
        "data/sourcing_candidates/2026-08-03.json",
        "data/reports/2026-08-03.json",
        "data/radar/2026-08-03.json",
        "data/steam_trends/2026-08-03.json"
      ]);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("uses only existing workflow receipt plumbing and the exact corpus path", () => {
    assert.equal(gitBlobSha(stripC5BBlocks(syncWorkflow)), ORIGINAL_BLOBS.syncWorkflow);
    assert.equal(gitBlobSha(stripC5BBlocks(watchdogWorkflow)), ORIGINAL_BLOBS.watchdogWorkflow);
    for (const workflow of [syncWorkflow, watchdogWorkflow]) {
      assert.match(workflow, /C5B_SHADOW_FINALIZER_START/);
      assert.match(workflow, /finalizeC5BReplayCorpusSafely/);
      assert.match(workflow, /data\/sourcing_replay_corpus/);
      assert.doesNotMatch(workflow, /^\s*push:/m);
      assert.equal((workflow.match(/\n\s*- name:/g) ?? []).length, (stripC5BBlocks(workflow).match(/\n\s*- name:/g) ?? []).length);
    }
    assert.match(syncWorkflow, /cron:\s*"37 1 \* \* \*"/);
    assert.match(syncWorkflow, /cron:\s*"17 6 \* \* \*"/);
    assert.match(watchdogWorkflow, /cron:\s*"23 2-8 \* \* \*"/);
    assert.match(syncWorkflow, /git add "data\/automation_runs\/\$REPORT_DATE-\$RUN_SLOT\.json"/);
    assert.match(watchdogWorkflow, /git add "data\/automation_runs\/\$REPORT_DATE-watchdog\.json"/);
  });

  it("isolates injected finalizer module-load failures without changing receipt or exit status", () => {
    for (const [name, workflow, runSlot] of [
      ["sync", syncWorkflow, "afternoon"],
      ["watchdog", watchdogWorkflow, "watchdog"]
    ]) {
      const fixture = mkdtempSync(path.join(tmpdir(), `c5b-${name}-finalizer-load-failure-`));
      try {
        writeFileSync(path.join(fixture, "failing-collector.mjs"), "export const = ;\n");
        const receiptPath = path.join(fixture, "receipt.json");
        const block = c5bBlock(workflow, "FINALIZER").replaceAll(
          "./automations/jobs/online_daily_v7_3_shadow_collector.mjs",
          "./failing-collector.mjs"
        );
        const harnessPath = path.join(fixture, "finalizer-harness.mjs");
        writeFileSync(harnessPath, finalizerHarness({ block, receiptPath, runSlot }));

        const result = spawnSync(process.execPath, [harnessPath], {
          cwd: fixture,
          encoding: "utf8"
        });
        assert.equal(result.status, 0, `${name}: ${result.stderr}`);
        assert.equal(readFileSync(receiptPath, "utf8"), "receipt-before-finalizer\n");
      } finally {
        rmSync(fixture, { recursive: true, force: true });
      }
    }
  });

  it("declares the approved behavior floor and closes every loaded local dependency", () => {
    const manifest = new Set(shadowCollector.C5B_BEHAVIOR_DEPENDENCY_PATHS ?? []);
    const exclusions = new Set(shadowCollector.C5B_BEHAVIOR_PRODUCTION_EXCLUSIONS ?? []);
    assert.deepEqual([...exclusions].sort(), [
      "automations/jobs/online_daily_v4_candidate_audit.mjs",
      "automations/jobs/online_daily_v4_reports.mjs",
      "automations/jobs/online_daily_v4_volume.mjs"
    ]);

    const approvedAdditions = [
      "automations/jobs/bilibili_evidence.mjs",
      "automations/jobs/online_daily_v4_decision.mjs",
      "automations/jobs/online_daily_v4_enrichment_scheduler.mjs",
      "automations/jobs/online_daily_v4_media_enrichment.mjs",
      "automations/jobs/online_daily_v4_media_entities.mjs",
      "automations/jobs/online_daily_v4_media_rules.mjs",
      "automations/jobs/online_daily_v4_network.mjs",
      "automations/jobs/online_daily_v4_source_health.mjs",
      "automations/jobs/online_daily_v4_steam_source.mjs",
      "automations/jobs/sourcing_v6_3_quality.mjs"
    ];
    assert.deepEqual(
      approvedAdditions.filter((relativePath) => !manifest.has(relativePath)),
      []
    );

    const collectorClosure = relativeImportClosure([
      "automations/jobs/online_daily_v7_3_shadow_collector.mjs"
    ]);
    assert.deepEqual(
      [...collectorClosure].filter((relativePath) => exclusions.has(relativePath)),
      [],
      "a loaded collector dependency cannot be hidden behind a production-only exclusion"
    );
    const loadedClosure = relativeImportClosure([
      "automations/jobs/online_daily_v4.mjs",
      "automations/jobs/online_daily_v7_3_shadow_collector.mjs"
    ]);
    assert.deepEqual(
      [...loadedClosure]
        .filter((relativePath) => !manifest.has(relativePath) && !exclusions.has(relativePath))
        .sort(),
      []
    );
  });

  it("contains no activation acceptance or return flow from shadow into production", () => {
    const replacementTest = read("../test/onlineDailyV73SecondPassOrchestrator.test.mjs");
    assert.doesNotMatch(replacementTest, /RULE_VERSION\s*,?\s*V73_OBTAINABLE_EVIDENCE_RULE_VERSION/);
    assert.doesNotMatch(replacementTest, /daily-report\.json[\s\S]{0,300}V73_OBTAINABLE_EVIDENCE_RULE_VERSION/);
    assert.doesNotMatch(replacementTest, /buildPools\(\s*v73SecondPass/);
    assert.doesNotMatch(replacementTest, /candidateStates:\s*v73SecondPass\.candidate_states/);
    assert.match(replacementTest, /network sentinel/);
  });
});

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function readRepo(relativePath) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

function c5bBlock(source, label) {
  const match = source.match(new RegExp(
    `^[ \\t]*(?:/\\*|#) C5B_SHADOW_${label}_START(?: \\*/)?\\n([\\s\\S]*?)^[ \\t]*(?:/\\*|#) C5B_SHADOW_${label}_END(?: \\*/)?$`,
    "m"
  ));
  return match?.[1] ?? "";
}

function generatorHarnessPrelude() {
  return `
import { writeFileSync } from "node:fs";
const rootDir = process.cwd();
const reportDate = "2026-08-03";
const capturedAt = "2026-08-03T14:30:00+08:00";
const enrichedCandidates = [];
const mediaLeadCandidates = [];
const mediaSignals = [];
const candidateStates = new Map();
const steamEnrichmentMetrics = {};
const maxCandidates = 320;
const maxSteamDetails = 90;
const maxBilibiliLeadAgeDays = 30;
const enrichmentPlan = { scheduled: [], reused: [] };
const writes = [];
async function writeJson(relativePath) {
  writes.push(relativePath);
  writeFileSync(process.env.C5B_WRITE_LOG, JSON.stringify(writes));
}
await writeJson(\`data/sourcing_candidates/\${reportDate}.json\`, {});
await writeJson(\`data/reports/\${reportDate}.json\`, {});
await writeJson(\`data/radar/\${reportDate}.json\`, {});
await writeJson(\`data/steam_trends/\${reportDate}.json\`, {});
`;
}

function finalizerHarness({ block, receiptPath, runSlot }) {
  return `
import { writeFileSync } from "node:fs";
const reportDate = "2026-08-03";
const runSlot = ${JSON.stringify(runSlot)};
await (async () => {
  writeFileSync(${JSON.stringify(receiptPath)}, "receipt-before-finalizer\\n");
${block}
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`;
}

function relativeImportClosure(roots) {
  const closure = new Set();
  const pending = [...roots];
  while (pending.length) {
    const relativePath = pending.pop();
    if (closure.has(relativePath)) continue;
    closure.add(relativePath);
    const source = readRepo(relativePath);
    const specifiers = source.matchAll(
      /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["'](\.[^"']+)["']|import\(\s*["'](\.[^"']+)["']\s*\)/g
    );
    for (const match of specifiers) {
      const specifier = match[1] ?? match[2];
      let dependency = path.posix.normalize(
        path.posix.join(path.posix.dirname(relativePath), specifier)
      );
      if (!path.posix.extname(dependency)) dependency += ".mjs";
      if (dependency.endsWith(".mjs") && existsSync(new URL(`../../${dependency}`, import.meta.url))) {
        pending.push(dependency);
      }
    }
  }
  return closure;
}

function stripC5BBlocks(value) {
  return value
    .replace(/^[ \t]*\/\* C5B_SHADOW_[A-Z_]+_START \*\/[\s\S]*?^[ \t]*\/\* C5B_SHADOW_[A-Z_]+_END \*\/\n?/gm, "")
    .replace(/^[ \t]*# C5B_SHADOW_[A-Z_]+_START\n[\s\S]*?^[ \t]*# C5B_SHADOW_[A-Z_]+_END\n?/gm, "");
}

function gitBlobSha(value) {
  const payload = Buffer.from(value, "utf8");
  return createHash("sha1")
    .update(`blob ${payload.length}\0`)
    .update(payload)
    .digest("hex");
}
