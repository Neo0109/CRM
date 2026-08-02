import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

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
    assert.match(generator, /C5B_SHADOW_IMPORT_START/);
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
    assert.doesNotMatch(generator, /buildPools\([^)]*v73SecondPass/s);
    assert.doesNotMatch(generator, /buildSourcingCandidateArtifact\([^)]*v73SecondPass/s);
    assert.match(generator, /buildPools\(enrichedCandidates, mediaLeadCandidates, \{ reportDate \}\)/);
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

function stripC5BBlocks(value) {
  return value
    .replace(/\/\* C5B_SHADOW_[A-Z_]+_START \*\/[\s\S]*?\/\* C5B_SHADOW_[A-Z_]+_END \*\/\n?/g, "")
    .replace(/^\s*# C5B_SHADOW_[A-Z_]+_START\n[\s\S]*?^\s*# C5B_SHADOW_[A-Z_]+_END\n?/gm, "");
}

function gitBlobSha(value) {
  const payload = Buffer.from(value, "utf8");
  return createHash("sha1")
    .update(`blob ${payload.length}\0`)
    .update(payload)
    .digest("hex");
}
