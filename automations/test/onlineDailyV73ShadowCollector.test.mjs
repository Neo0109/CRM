import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import {
  validateReplayCorpus
} from "../jobs/online_daily_v7_3_replay_corpus_contract.mjs";

const collectorUrl = new URL(
  "../jobs/online_daily_v7_3_shadow_collector.mjs",
  import.meta.url
);
const collector = existsSync(collectorUrl) ? await import(collectorUrl) : {};
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error("C5-B collector test network sentinel: live access is forbidden");
};
after(() => {
  globalThis.fetch = originalFetch;
});

const reportDate = "2026-08-03";
const capturedAt = "2026-08-03T14:30:00+08:00";
const firstQualityProof = {
  type: "official_festival_selection",
  source_id: "festival:indie-showcase",
  value: "Selected for an independent showcase",
  url: "https://showcase.example/games/c5b-fixture"
};
const secondQualityProof = {
  type: "trusted_creator_playtest",
  source_id: "creator:trusted-playtester",
  value: "Independent hands-on playtest",
  url: "https://creator.example/reviews/c5b-fixture"
};
const behaviorManifest = {
  "automations/jobs/online_daily_v7_3_shadow_collector.mjs": "b".repeat(40),
  "automations/jobs/online_daily_v7_3_second_pass_orchestrator.mjs": "c".repeat(40)
};

describe("C5-B V7.3 shadow collector", () => {
  it("exposes the shadow-only collector, safe writer, eligibility guard, and receipt finalizer", () => {
    for (const name of [
      "collectV73ShadowCore",
      "runC5BShadowCollectorSafely",
      "isC5BShadowCaptureEligible",
      "finalizeC5BReplayCorpusSafely"
    ]) {
      assert.equal(typeof collector[name], "function", `${name} must exist before GREEN`);
    }
  });

  it("accepts only automatic afternoon and real automatic watchdog generation", () => {
    requireCollector("isC5BShadowCaptureEligible");
    assert.equal(collector.isC5BShadowCaptureEligible({ event_name: "schedule", run_slot: "afternoon" }), true);
    assert.equal(collector.isC5BShadowCaptureEligible({ event_name: "schedule", run_slot: "watchdog", generation_performed: true }), true);
    assert.equal(collector.isC5BShadowCaptureEligible({ event_name: "schedule", run_slot: "watchdog", generation_performed: false }), false);
    assert.equal(collector.isC5BShadowCaptureEligible({ event_name: "workflow_dispatch", run_slot: "afternoon", generation_performed: true }), false);
    assert.equal(collector.isC5BShadowCaptureEligible({ event_name: "workflow_dispatch", run_slot: "watchdog", generation_performed: true, forced: true }), false);
    assert.equal(collector.isC5BShadowCaptureEligible({ event_name: "schedule", run_slot: "morning" }), false);
  });

  it("captures the full cloned universe while binding a deterministic max-12 second pass", async () => {
    requireCollector("collectV73ShadowCore");
    const steamCandidates = Array.from({ length: 14 }, (_, index) => (
      steamCandidate(nearMissEvidence(index + 1), { score: 100 - index })
    ));
    const productionBefore = digest(steamCandidates);
    const providerCalls = [];
    const core = await collector.collectV73ShadowCore({
      reportDate,
      capturedAt,
      runContext: automaticRun(),
      steamCandidates,
      mediaCandidates: [],
      mediaSignals: [],
      candidateStates: new Map(),
      behaviorManifest,
      provider: async (request) => {
        providerCalls.push(structuredClone(request));
        return { quality_proofs: [secondQualityProof] };
      }
    });

    assert.equal(digest(steamCandidates), productionBefore, "production candidates must not mutate");
    assert.equal(core.active_production_rule_version, "sourcing-rules-v7.2-china-joint");
    assert.equal(core.shadow_rule_version, "sourcing-rules-v7.3-obtainable-evidence");
    assert.equal(core.candidates.length, 14, "the decision universe must be lossless");
    assert.equal(core.second_pass.eligible_ids.length, 14);
    assert.equal(core.second_pass.selected_ids.length, 12);
    assert.equal(core.second_pass.omitted_ids.length, 2);
    assert.equal(core.second_pass.attempted_ids.length, 12);
    assert.equal(core.second_pass.transactions.length, 12);
    assert.equal(providerCalls.length, 12);
    assert.ok(providerCalls.every((call) => call.actions.length >= 1 && call.actions.length <= 3));
    assert.deepEqual(
      core.budgets.usage.provider_transaction_ids,
      core.second_pass.transactions.map((item) => item.transaction_id)
    );
    assert.deepEqual(
      {
        new_lane: core.budgets.limits.new_lane,
        backlog_lane: core.budgets.limits.backlog_lane,
        retry_refresh_lane: core.budgets.limits.retry_refresh_lane
      },
      { new_lane: 40, backlog_lane: 30, retry_refresh_lane: 20 },
      "the corpus must freeze PR B's 4:3:2 network-lane budget"
    );
    assert.equal(core.summary.candidate_count, 14);
    assert.equal(core.summary.second_pass_selected_count, 12);
    assert.ok(core.candidates.every((item) => item.qualification_affected_by_ranking === false));
    assert.ok(core.candidates.every((item) => item.ranking_inputs.dedupe_key));
    assert.equal("production_pools" in core, false);
    assert.equal("production_candidate_artifact" in core, false);
  });

  it("records thrown, empty, invalid, and timeout outcomes once and retains first pass", async () => {
    requireCollector("collectV73ShadowCore");
    const candidates = Array.from({ length: 4 }, (_, index) => steamCandidate(nearMissEvidence(30 + index)));
    const calls = new Map();
    const core = await collector.collectV73ShadowCore({
      reportDate,
      capturedAt,
      runContext: automaticRun({ workflow_run_id: "9002" }),
      steamCandidates: candidates,
      mediaCandidates: [],
      mediaSignals: [],
      candidateStates: new Map(),
      behaviorManifest,
      providerTimeoutMs: 5,
      provider: async (request) => {
        const key = request.evidence.dedupe_key;
        calls.set(key, (calls.get(key) ?? 0) + 1);
        if (key.endsWith("30")) throw new Error("provider exploded");
        if (key.endsWith("31")) return {};
        if (key.endsWith("32")) return [];
        return new Promise(() => {});
      }
    });

    assert.equal([...calls.values()].every((count) => count === 1), true, "retry limit must be zero");
    assert.equal(core.second_pass.failed_ids.length, 4);
    assert.deepEqual(
      new Set(core.second_pass.transactions.map((item) => item.provider_status)),
      new Set(["error", "timeout"])
    );
    assert.ok(core.second_pass.transactions.every((item) => item.request_metrics.retry_count === 0));
    assert.ok(core.second_pass.transactions.every((item) => (
      item.final_output.qualified === item.merged_final_input.qualified
    )));
    assert.equal(core.summary.second_pass_qualified_count, 0);
  });

  it("fails capture closed on forbidden provider fields without serializing the secret", async () => {
    requireCollector("collectV73ShadowCore");
    const candidate = steamCandidate(nearMissEvidence(50));
    const before = digest(candidate);
    const core = await collector.collectV73ShadowCore({
      reportDate,
      capturedAt,
      runContext: automaticRun({ workflow_run_id: "9003" }),
      steamCandidates: [candidate],
      mediaCandidates: [],
      mediaSignals: [],
      candidateStates: new Map(),
      behaviorManifest,
      provider: async () => ({
        quality_proofs: [secondQualityProof],
        authorization: "Bearer forbidden-secret"
      })
    });

    assert.equal(digest(candidate), before);
    assert.equal(core.capture_status, "incomplete");
    assert.ok(core.capture_errors.some((item) => item.code === "privacy_violation"));
    assert.doesNotMatch(JSON.stringify(core), /forbidden-secret|authorization/i);
  });

  it("writes a pending core and finalizes one schema-valid receipt-bound corpus", async () => {
    requireCollector("runC5BShadowCollectorSafely");
    requireCollector("finalizeC5BReplayCorpusSafely");
    const rootDir = await mkdtemp(path.join(tmpdir(), "c5b-shadow-collector-"));
    const runContext = automaticRun({ workflow_run_id: "9004" });
    const candidate = steamCandidate(nearMissEvidence(70));
    const capture = await collector.runC5BShadowCollectorSafely({
      rootDir,
      reportDate,
      capturedAt,
      runContext,
      steamCandidates: [candidate],
      mediaCandidates: [],
      mediaSignals: [],
      candidateStates: new Map(),
      behaviorManifest,
      provider: async () => ({ quality_proofs: [secondQualityProof] })
    });
    assert.equal(capture.status, "pending");
    assert.ok(existsSync(capture.pending_path));

    const artifactPayloads = {
      report: { report_date: reportDate, push_pool: [], watch_pool: [], drop_pool: [] },
      sourcing_candidates: { report_date: reportDate, candidates: [] },
      radar: { report_date: reportDate, items: [] },
      steam_trends: { report_date: reportDate, items: [] }
    };
    for (const [name, payload] of Object.entries(artifactPayloads)) {
      const directory = name === "report" ? "reports" : name;
      await mkdir(path.join(rootDir, "data", directory), { recursive: true });
      await writeFile(path.join(rootDir, "data", directory, `${reportDate}.json`), `${JSON.stringify(payload, null, 2)}\n`);
    }
    await mkdir(path.join(rootDir, "data", "automation_runs"), { recursive: true });
    const receiptPath = path.join(rootDir, "data", "automation_runs", `${reportDate}-afternoon.json`);
    await writeFile(receiptPath, `${JSON.stringify({
      report_date: reportDate,
      slot: "afternoon",
      status: "success",
      generation_status: "success",
      validation_status: "success",
      sync_response: JSON.stringify({ synced: true })
    }, null, 2)}\n`);

    const finalized = await collector.finalizeC5BReplayCorpusSafely({
      rootDir,
      reportDate,
      runSlot: "afternoon",
      receiptPath
    });
    assert.equal(finalized.status, "complete");
    const corpus = JSON.parse(await readFile(finalized.corpus_path, "utf8"));
    assert.deepEqual(validateReplayCorpus(corpus), { valid: true, errors: [] });
    assert.equal(corpus.delivery_health.sync_response.synced, true);
    assert.equal(corpus.artifact_bindings.replay_corpus.git_blob_sha, null);
    assert.equal(corpus.artifact_bindings.receipt.validation_status, "valid");
    assert.equal(corpus.integrity.payload_sha256, corpus.artifact_bindings.replay_corpus.payload_sha256);
  });
});

function requireCollector(name) {
  assert.equal(typeof collector[name], "function", `${name} is missing at the accepted RED boundary`);
}

function automaticRun(overrides = {}) {
  return {
    event_name: "schedule",
    run_slot: "afternoon",
    workflow_run_id: "9001",
    run_attempt: 1,
    run_url: "https://github.com/Neo0109/CRM/actions/runs/9001",
    input_commit_sha: "a".repeat(40),
    node_version: "22.17.0",
    generation_performed: true,
    forced: false,
    ...overrides
  };
}

function nearMissEvidence(index, overrides = {}) {
  const appId = String(9700000 + index);
  return {
    project: `C5-B Shadow Fixture ${String(index).padStart(2, "0")}`,
    steam_app_id: appId,
    dedupe_key: `steam:${appId}`,
    region: "overseas",
    release_state: "prelaunch",
    release_window: "over_60",
    early_access_state: "no",
    publisher_occupancy: "clear",
    narrative_state: "no",
    india_team_state: "no",
    official_demo_evidence: [{
      type: "steam_demo",
      value: "Official playable Demo",
      url: `https://store.steampowered.com/app/${appId}/`
    }],
    official_gameplay_evidence: [],
    quality_proofs: [firstQualityProof],
    business_entrypoints: [{ type: "Email", value: `bd+${appId}@c5b-fixture.example` }],
    china_bilibili_value: "系统型合作玩法可形成机制讲解和长期内容，并以简中社区运营承接B站反馈。",
    china_demand: null,
    ...overrides
  };
}

function steamCandidate(evidence, overrides = {}) {
  return {
    appId: evidence.steam_app_id,
    title: evidence.project,
    source: "Steam discovery C5-B fixture",
    storeUrl: `https://store.steampowered.com/app/${evidence.steam_app_id}/`,
    steamDbUrl: `https://steamdb.info/app/${evidence.steam_app_id}/`,
    developers: ["Fixture Studio"],
    publishers: [],
    country: "US",
    region: "海外",
    genres: ["Strategy", "Simulation"],
    categories: ["Co-op"],
    shortDescription: "A systems-led cooperative strategy game.",
    releaseDate: "2027-02-01",
    daysToRelease: 186,
    alreadyReleased: false,
    comingSoon: true,
    hasDemoSignal: true,
    earlyAccess: false,
    narrativeHeavy: false,
    indiaTeam: false,
    strongGameplay: true,
    highVisual: true,
    strongData: false,
    validatedPcHit: false,
    mobileAdaptationPotential: true,
    publisherOccupied: false,
    chinaPartnerOccupied: false,
    contactMethods: evidence.business_entrypoints,
    website: "https://c5b-fixture.example",
    hasDetails: true,
    recommendationCount: 0,
    screenshotCount: 6,
    movieCount: 1,
    officialDemoEvidence: evidence.official_demo_evidence,
    officialGameplayEvidence: evidence.official_gameplay_evidence,
    qualityProofs: evidence.quality_proofs,
    chinaBilibiliValue: evidence.china_bilibili_value,
    chinaDemandEvidence: evidence.china_demand,
    reviewText: "",
    score: 80,
    _indieAdmissionEvidence: structuredClone(evidence),
    ...overrides
  };
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
