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
const collectorSource = read("../jobs/online_daily_v7_3_shadow_collector.mjs");
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
  activeRulesModule: "c89beb38b47a8f23524574c46fe19cc5ef3a3771",
  activeRule: "032133358a01ce11a0cdd49160c4c8328c48e166",
  activeDecision: "b326be1cb67b36985616ec54a489d30ec958a8c3",
  activeCandidateAudit: "f6e4403f937eaec60e935c01ea37bd8eeacd40d2",
  activeReports: "adaa0492f0097bdc0a3f84bf2330163e20226dc4",
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
    assert.equal(activeRule.rule_version, "sourcing-rules-v7.2.1-media-product-domain");
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

  it("adds only the direct run_attempt receipt field while freezing trigger, step, and sync scope", () => {
    assert.equal(gitBlobSha(workflowHeader(syncWorkflow)), "4f0cfdbda3edec5d293d92b70e8a36fa42aca2c4");
    assert.equal(gitBlobSha(workflowHeader(watchdogWorkflow)), "4d0724ad7c1735f3a5bbc50eadd4b52c3822a351");
    assert.deepEqual(workflowStepNames(syncWorkflow), [
      "Checkout repository",
      "Setup Node.js",
      "Resolve report date and run slot",
      "Fetch CRM dedupe index",
      "Generate daily report, radar, and Steam trends",
      "Validate daily report contract",
      "Commit generated data",
      "Sync daily report into CRM",
      "Commit sync receipt",
      "Record CRM import quality",
      "Fail if online daily automation did not succeed",
      "Summary"
    ]);
    assert.deepEqual(workflowStepNames(watchdogWorkflow), [
      "Checkout repository",
      "Setup Node.js",
      "Resolve report date",
      "Inspect report health",
      "Fetch CRM dedupe index",
      "Generate daily report if unhealthy",
      "Validate daily report contract",
      "Commit generated data",
      "Sync daily report into CRM",
      "Commit watchdog receipt",
      "Record watchdog import quality",
      "Fail if watchdog sync did not succeed",
      "Summary"
    ]);
    assert.equal(
      gitBlobSha(workflowStep(syncWorkflow, "Sync daily report into CRM")),
      "fe8a18eddcbda3342f8b0249db652e1f55019dc1"
    );
    assert.equal(
      gitBlobSha(workflowStep(watchdogWorkflow, "Sync daily report into CRM")),
      "8b60b060cfd116c4ba8b768a9f805b5ed25416cc"
    );
    const receiptViolations = [];
    for (const [name, workflow] of [
      ["sync", syncWorkflow],
      ["watchdog", watchdogWorkflow]
    ]) {
      assert.match(workflow, /C5B_SHADOW_FINALIZER_START/);
      assert.match(workflow, /finalizeC5BReplayCorpusSafely/);
      assert.match(workflow, /data\/sourcing_replay_corpus/);
      assert.doesNotMatch(workflow, /^\s*push:/m);
      if (!/GITHUB_RUN_ATTEMPT_VALUE:\s*\$\{\{\s*github\.run_attempt\s*\}\}/.test(workflow)) {
        receiptViolations.push(`${name}: github.run_attempt runtime field absent`);
      }
      if (!/const runAttempt = Number\(process\.env\.GITHUB_RUN_ATTEMPT_VALUE\);/.test(workflow)) {
        receiptViolations.push(`${name}: run_attempt normalization absent`);
      }
      if (!/Number\.isSafeInteger\(runAttempt\)[\s\S]{0,120}(?:runAttempt\s*<=\s*0|runAttempt\s*<\s*1)/.test(workflow)) {
        receiptViolations.push(`${name}: strict positive-integer guard absent`);
      }
      if (!/run_attempt:\s*runAttempt/.test(workflow)) {
        receiptViolations.push(`${name}: normalized run_attempt receipt field absent`);
      }
      if (/\$\{GITHUB_RUN_ATTEMPT:-1\}/.test(workflow)) {
        receiptViolations.push(`${name}: default-to-1 corpus path present`);
      }
      if (/GITHUB_RUN_ATTEMPT_VALUE\s*(?:\|\||\?\?)/.test(workflow)) {
        receiptViolations.push(`${name}: defaulted receipt run_attempt present`);
      }
    }
    assert.deepEqual(receiptViolations, []);
    assert.match(syncWorkflow, /cron:\s*"37 1 \* \* \*"/);
    assert.match(syncWorkflow, /cron:\s*"17 6 \* \* \*"/);
    assert.match(watchdogWorkflow, /cron:\s*"23 2-8 \* \* \*"/);
    assert.match(syncWorkflow, /git add "data\/automation_runs\/\$REPORT_DATE-\$RUN_SLOT\.json"/);
    assert.match(watchdogWorkflow, /git add "data\/automation_runs\/\$REPORT_DATE-watchdog\.json"/);
  });

  it("isolates finalizer validation and module-load failures without changing receipt bytes or V7.2 exit status", () => {
    for (const [name, workflow, runSlot] of [
      ["sync", syncWorkflow, "afternoon"],
      ["watchdog", watchdogWorkflow, "watchdog"]
    ]) {
      for (const [failure, moduleSource] of [
        ["module-load", "export const = ;\n"],
        [
          "validation",
          "export async function finalizeC5BReplayCorpusSafely() { return { status: 'error', reason: 'schema validation failed', corpus_path: null }; }\n"
        ]
      ]) {
        const fixture = mkdtempSync(path.join(tmpdir(), `c5b-${name}-finalizer-${failure}-failure-`));
        try {
          writeFileSync(path.join(fixture, "failing-collector.mjs"), moduleSource);
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
          assert.equal(result.status, 0, `${name}/${failure}: ${result.stderr}`);
          assert.equal(readFileSync(receiptPath, "utf8"), "receipt-before-finalizer\n");
        } finally {
          rmSync(fixture, { recursive: true, force: true });
        }
      }
    }
  });

  it("reads the receipt before pending-core selection and has no default or online resolver", () => {
    const finalizer = finalizerImplementation(collectorSource);
    const receiptReadIndex = finalizer.indexOf("readFile(receiptPath");
    const pendingLookupIndex = finalizer.indexOf("findPendingPath");
    assert.ok(receiptReadIndex >= 0, "the finalizer must read the receipt");
    assert.ok(pendingLookupIndex >= 0, "the finalizer must select an exact pending core");
    assert.ok(
      receiptReadIndex < pendingLookupIndex,
      "the validated receipt tuple must be authoritative before pending-core selection"
    );
    assert.doesNotMatch(finalizer, /run_attempt\s*(?:\?\?|\|\|)\s*1/);
    assert.doesNotMatch(finalizer, /\bfetch\s*\(|https?:\/\/|api\.github|octokit/i);
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
    assert.equal(manifest.size, 38);
    assert.ok(manifest.has("automations/jobs/online_daily_v7_3_offline_replay.mjs"));
    assert.ok(manifest.has("automations/jobs/online_daily_v7_3_replay_window.mjs"));

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

  it("freezes production media order before dedupe-sorted corpus publication replay", async () => {
    const retained = publicationMediaCandidate(
      "界世奇传河星海山",
      "https://media.example.test/retained"
    );
    const duplicate = publicationMediaCandidate(
      "山海星河传奇世界",
      "https://media.example.test/duplicate"
    );
    const core = await shadowCollector.collectV73ShadowCore({
      reportDate: "2026-08-03",
      capturedAt: "2026-08-03T14:30:00+08:00",
      runContext: {
        event_name: "schedule",
        run_slot: "afternoon",
        workflow_run_id: "9110",
        run_attempt: 1,
        run_url: "https://github.com/Neo0109/CRM/actions/runs/9110",
        input_commit_sha: "a".repeat(40),
        node_version: "22.17.0",
        generation_performed: true,
        forced: false
      },
      steamCandidates: [],
      mediaCandidates: [retained, duplicate],
      mediaSignals: [],
      candidateStates: new Map(),
      behaviorManifest: {
        "automations/jobs/online_daily_v7_3_shadow_collector.mjs": "b".repeat(40),
        "automations/jobs/online_daily_v7_3_offline_replay.mjs": "c".repeat(40)
      },
      provider: async () => {
        throw new Error("already-qualified publication candidates must not call a provider");
      }
    });

    assert.deepEqual(core.candidates.map((candidate) => candidate.project), [
      duplicate.project,
      retained.project
    ]);
    const stored = new Map(
      core.candidates.map((candidate) => [candidate.project, candidate])
    );
    assert.deepEqual(stored.get(retained.project).ranking_inputs.publication_order, {
      source_priority: 0,
      source_index: 0
    });
    assert.deepEqual(stored.get(duplicate.project).ranking_inputs.publication_order, {
      source_priority: 0,
      source_index: 1
    });
    assert.equal(stored.get(retained.project).publication.shadow_push_pool, true);
    assert.equal(stored.get(duplicate.project).publication.shadow_push_pool, false);

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

function publicationMediaCandidate(project, url) {
  return {
    project,
    links: [url],
    contact_methods: [{ type: "website", url: `${url}/contact` }],
    _mediaItem: { title: project, summary: "Independent media signal", link: url },
    _indieAdmissionEvidence: {
      project,
      steam_app_id: null,
      dedupe_key: `project:${project}`,
      region: "domestic",
      release_state: "prelaunch",
      release_window: "over_60",
      early_access_state: "no",
      publisher_occupancy: "clear",
      narrative_state: "no",
      india_team_state: "no",
      official_demo_evidence: [],
      official_gameplay_evidence: [{
        type: "official_gameplay",
        url: `${url}/gameplay`
      }],
      quality_proofs: [
        {
          type: "official_festival_selection",
          source_id: "media-one",
          source_role: "media",
          value: "review one",
          url: `${url}/review-one`
        },
        {
          type: "trusted_creator_playtest",
          source_id: "creator-two",
          source_role: "trusted_creator",
          value: "review two",
          url: `${url}/review-two`
        }
      ],
      business_entrypoints: [{ type: "website", url: `${url}/contact` }],
      china_bilibili_value: "系统型玩法适合机制讲解、挑战栏目和长期社区运营。"
    }
  };
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

function workflowHeader(source) {
  const end = source.indexOf("\npermissions:");
  assert.ok(end >= 0, "workflow permissions boundary must exist");
  return source.slice(0, end + 1);
}

function workflowStepNames(source) {
  return [...source.matchAll(/^\s+- name:\s*(.+)$/gm)].map((match) => match[1]);
}

function workflowStep(source, name) {
  const start = source.indexOf(`      - name: ${name}`);
  assert.ok(start >= 0, `workflow step ${name} must exist`);
  const tail = source.slice(start + 1);
  const next = tail.match(/^      - name:/m);
  return source.slice(start, next ? start + 1 + next.index : source.length);
}

function finalizerImplementation(source) {
  const start = source.indexOf("async function finalizeC5BReplayCorpus(");
  const end = source.indexOf("\nfunction createRecordingProvider", start);
  assert.ok(start >= 0 && end > start, "finalizer implementation boundary must exist");
  return source.slice(start, end);
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
