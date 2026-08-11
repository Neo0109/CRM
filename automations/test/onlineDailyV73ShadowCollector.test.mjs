import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import {
  validateReplayCorpus,
  validateReplayPrivacy
} from "../jobs/online_daily_v7_3_replay_corpus_contract.mjs";
import {
  fetchV73TargetedEvidence
} from "../jobs/online_daily_v7_3_second_pass_orchestrator.mjs";

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
  source_role: "media",
  value: "Selected for an independent showcase",
  url: "https://showcase.example/games/c5b-fixture"
};
const secondQualityProof = {
  type: "trusted_creator_playtest",
  source_id: "creator:trusted-playtester",
  source_role: "trusted_creator",
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

  it("emits collector v2 diagnostics without redefining empty allowlisted patches as transport failures", async () => {
    requireCollector("collectV73ShadowCore");
    const evidence = nearMissEvidence(14);
    const core = await collector.collectV73ShadowCore({
      reportDate,
      capturedAt,
      runContext: automaticRun({ workflow_run_id: "9014" }),
      steamCandidates: [steamCandidate(evidence)],
      mediaCandidates: [],
      mediaSignals: [],
      candidateStates: new Map(),
      behaviorManifest,
      provider: async () => ({ quality_proofs: [] })
    });

    assert.equal(core.collector_contract_version, 2);
    assert.equal(core.second_pass.selector_version, "actionability-v2");
    assert.equal(core.second_pass.transactions[0].provider_status, "success");
    assert.equal(core.second_pass.transactions[0].error, null);
    assert.deepEqual(core.second_pass.transactions[0].evidence_diagnostics, {
      project_matching_signal_count: 0,
      eligible_source_role_signal_count: 0,
      quality_keyword_signal_count: 0,
      independent_source_count: 1,
      accepted_proof_count: 0,
      actionable_gate_count: 0,
      outcome: "no_project_match"
    });
    assert.deepEqual(core.summary.second_pass_outcome_counts, {
      evidence_found: 0,
      no_project_match: 1,
      source_role_rejected: 0,
      quality_keyword_missing: 0,
      insufficient_independent_sources: 0,
      not_requested: 0
    });
    assert.deepEqual(
      validateReplayPrivacy(core.second_pass.transactions[0].evidence_diagnostics),
      { valid: true, errors: [] }
    );
  });

  it("freezes one capped privacy-safe bounded signal projection for analyzer, provider, and replay", async () => {
    requireCollector("collectV73ShadowCore");
    const evidence = nearMissEvidence(24);
    const mediaSignals = Array.from({ length: 26 }, (_, index) => ({
      title: `${evidence.project} independent hands-on review ${index}`,
      source: `Fixture media ${index}`,
      source_role: "media",
      link: `https://media-${index}.example/reviews/v73-bounded-signal`
    }));
    const providerRequests = [];
    const core = await collector.collectV73ShadowCore({
      reportDate,
      capturedAt,
      runContext: automaticRun({ workflow_run_id: "9024" }),
      steamCandidates: [steamCandidate(evidence)],
      mediaCandidates: [],
      mediaSignals,
      candidateStates: new Map(),
      behaviorManifest,
      provider: async (request) => {
        providerRequests.push(structuredClone(request));
        return { quality_proofs: [] };
      }
    });

    assert.equal(providerRequests.length, 1);
    assert.equal(core.second_pass.bounded_signals.length, 24);
    assert.deepEqual(providerRequests[0].mediaSignals, core.second_pass.bounded_signals);
    assert.deepEqual(
      core.second_pass.transactions[0].bounded_signals,
      core.second_pass.bounded_signals
    );
    assert.deepEqual(validateReplayPrivacy(core.second_pass.bounded_signals), {
      valid: true,
      errors: []
    });
  });

  it("projects private candidate audit state out of the persisted pending core", async () => {
    requireCollector("runC5BShadowCollectorSafely");
    const rootDir = await mkdtemp(path.join(tmpdir(), "c5b-shadow-private-state-"));
    const candidate = steamCandidate(nearMissEvidence(15));
    const dedupeKey = `steam:${candidate.appId}`;
    const candidateStates = new Map([[dedupeKey, {
      first_seen: reportDate,
      last_seen: reportDate,
      enrichment_status: "success",
      enrichment_attempts: 1,
      last_attempted_at: capturedAt,
      last_enriched_at: capturedAt,
      next_retry_date: null,
      scheduler_lane: "new",
      evidence_snapshot: {
        contract_version: 1,
        captured_at: capturedAt,
        expires_on: "2026-08-10",
        dedupe_key: dedupeKey,
        evidence: {
          contactMethods: [{
            type: "email",
            value: "private-owner@c5b-fixture.example",
            note: "candidate audit snapshot only"
          }]
        }
      }
    }]]);

    const capture = await collector.runC5BShadowCollectorSafely({
      rootDir,
      reportDate,
      capturedAt,
      runContext: automaticRun({ workflow_run_id: "9015" }),
      steamCandidates: [candidate],
      mediaCandidates: [],
      mediaSignals: [],
      candidateStates,
      steamEnrichmentMetrics: { steam_candidates_enriched: 1 },
      behaviorManifest,
      provider: async () => ({ quality_proofs: [secondQualityProof] })
    });

    assert.equal(capture.status, "pending", capture.reason);
    assert.ok(existsSync(capture.pending_path));
    const pending = JSON.parse(await readFile(capture.pending_path, "utf8"));
    assert.equal("shadow_candidate_artifact" in pending, false);
    assert.doesNotMatch(
      JSON.stringify(pending),
      /contactMethods|private-owner@c5b-fixture\.example/
    );
  });

  it("projects private contact data from live candidate, admission, and transaction shapes", async () => {
    requireCollector("collectV73ShadowCore");
    requireCollector("runC5BShadowCollectorSafely");
    requireCollector("finalizeC5BReplayCorpusSafely");
    const rootDir = await mkdtemp(path.join(tmpdir(), "c5b-shadow-live-private-shape-"));
    const privateContact = "private-projection@c5b-fixture.example";
    const publicBusinessEntry = "public-business@c5b-fixture.example";
    const evidence = nearMissEvidence(16, {
      project: `C5-B live-shape candidate ${privateContact}`,
      quality_proofs: [{
        ...firstQualityProof,
        contactMethods: [{ type: "email", value: privateContact }],
        email: privateContact
      }],
      business_entrypoints: [{
        type: "Email",
        value: publicBusinessEntry,
        official_public_business_entry: true
      }]
    });
    const candidate = steamCandidate(evidence);
    const mediaSignals = [{
      title: `C5-B bounded signal ${privateContact}`,
      source: "Fixture Games Media",
      link: "https://media.example/reviews/c5b-live-private-shape"
    }];
    const options = {
      rootDir,
      reportDate,
      capturedAt,
      runContext: automaticRun({ workflow_run_id: "9016" }),
      steamCandidates: [candidate],
      mediaCandidates: [],
      mediaSignals,
      candidateStates: new Map(),
      behaviorManifest,
      provider: async () => ({
        quality_proofs: [secondQualityProof],
        business_entrypoints: [{
          type: "Email",
          value: publicBusinessEntry,
          email: publicBusinessEntry,
          official_public_business_entry: true
        }]
      })
    };

    const core = await collector.collectV73ShadowCore(options);
    const rawPersistedShape = structuredClone(core);
    delete rawPersistedShape.shadow_candidate_artifact;
    const privatePaths = validateReplayPrivacy(rawPersistedShape).errors
      .filter((item) => item.code === "PRIVACY_PRIVATE_CONTACT")
      .map((item) => item.path);
    assert.ok(privatePaths.some((item) => /^\/candidates\/0\/project$/.test(item)));
    assert.equal(privatePaths.includes(
      "/candidates/0/first_pass/indie_prelaunch/input/quality_proofs/0/contactMethods/0/value"
    ), true);
    assert.equal(privatePaths.includes(
      "/second_pass/transactions/0/bounded_signals/0/title"
    ), true);
    assert.equal(privatePaths.includes(
      "/second_pass/transactions/0/merged_final_input/quality_proofs/0/contactMethods/0/value"
    ), true);
    assert.equal(core.candidates[0].project.includes(privateContact), true);
    assert.equal(
      core.second_pass.transactions[0].bounded_signals[0].title.includes(privateContact),
      true
    );

    const capture = await collector.runC5BShadowCollectorSafely(options);
    assert.equal(capture.status, "pending", capture.reason);
    const pending = JSON.parse(await readFile(capture.pending_path, "utf8"));
    assert.deepEqual(validateReplayPrivacy(pending), { valid: true, errors: [] });
    assert.equal(JSON.stringify(pending).includes(privateContact), false);
    const pendingAdmissionProof = pending.candidates[0].first_pass.indie_prelaunch
      .input.quality_proofs[0];
    assert.equal("contactMethods" in pendingAdmissionProof, false);
    assert.equal("email" in pendingAdmissionProof, false);
    const pendingBusinessEntry = pending.candidates[0].first_pass.indie_prelaunch
      .input.business_entrypoints[0];
    assert.equal(pendingBusinessEntry.official_public_business_entry, true);
    assert.equal(pendingBusinessEntry.value, publicBusinessEntry);
    const pendingTransactionBusinessEntry = pending.second_pass.transactions[0]
      .raw_provider_result.business_entrypoints[0];
    assert.equal(pendingTransactionBusinessEntry.official_public_business_entry, true);
    assert.equal(pendingTransactionBusinessEntry.email, publicBusinessEntry);

    await writeFinalizerArtifacts(rootDir);
    const receiptPath = path.join(
      rootDir,
      "data/automation_runs",
      `${reportDate}-afternoon.json`
    );
    await writeReceipt(receiptPath, healthyReceipt({
      run_id: "9016",
      run_attempt: 1
    }));
    const finalized = await collector.finalizeC5BReplayCorpusSafely({
      rootDir,
      reportDate,
      runSlot: "afternoon",
      receiptPath
    });
    assert.equal(finalized.status, "complete", finalized.reason);
    const corpus = JSON.parse(await readFile(finalized.corpus_path, "utf8"));
    assert.deepEqual(validateReplayCorpus(corpus), { valid: true, errors: [] });
    assert.equal(JSON.stringify(corpus).includes(privateContact), false);
    const corpusBusinessEntry = corpus.candidates[0].first_pass.indie_prelaunch
      .input.business_entrypoints[0];
    assert.equal(corpusBusinessEntry.official_public_business_entry, true);
    assert.equal(corpusBusinessEntry.value, publicBusinessEntry);
    const corpusTransactionBusinessEntry = corpus.second_pass.transactions[0]
      .raw_provider_result.business_entrypoints[0];
    assert.equal(corpusTransactionBusinessEntry.official_public_business_entry, true);
    assert.equal(corpusTransactionBusinessEntry.email, publicBusinessEntry);
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
    const evidenceById = new Map(core.evidence_catalog.map((item) => [item.evidence_id, item]));
    for (const transaction of core.second_pass.transactions) {
      assert.equal(transaction.final_output.evidence_ids.length, 2);
      assert.deepEqual(
        new Set(transaction.final_output.evidence_ids.map((id) => evidenceById.get(id)?.source_role)),
        new Set(["media", "trusted_creator"])
      );
    }
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

  it("preserves the media role from the real fixture provider and binds both final proofs", async () => {
    requireCollector("collectV73ShadowCore");
    const evidence = nearMissEvidence(20, {
      quality_proofs: [secondQualityProof]
    });
    const ordinaryMediaSignal = {
      title: `${evidence.project} hands-on preview`,
      summary: `${evidence.project} independent media playtest review`,
      source: "Fixture Games Media",
      link: "https://media.example/reviews/c5b-role-fixture"
    };
    const core = await collector.collectV73ShadowCore({
      reportDate,
      capturedAt,
      runContext: automaticRun({ workflow_run_id: "9010" }),
      steamCandidates: [steamCandidate(evidence)],
      mediaCandidates: [],
      mediaSignals: [ordinaryMediaSignal],
      candidateStates: new Map(),
      behaviorManifest,
      provider: (request) => fetchV73TargetedEvidence({
        ...request,
        context: {
        fetchOfficialBilibiliCandidatesImpl: async () => []
        }
      })
    });

    const transaction = core.second_pass.transactions[0];
    assert.equal(transaction.final_output.qualified, true);
    assert.ok(
      transaction.filtered_patch.quality_proofs.some((proof) => (
        proof.url === ordinaryMediaSignal.link && proof.source_role === "media"
      )),
      "the real provider must classify an ordinary non-Bilibili media proof explicitly"
    );
    assert.equal(transaction.final_output.evidence_ids.length, 2);
    const evidenceById = new Map(core.evidence_catalog.map((item) => [item.evidence_id, item]));
    assert.deepEqual(
      new Set(transaction.final_output.evidence_ids.map((id) => evidenceById.get(id)?.source_role)),
      new Set(["media", "trusted_creator"])
    );
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

  it("does not coerce official or unknown proof roles into independent media evidence", async () => {
    requireCollector("collectV73ShadowCore");
    const officialProof = {
      type: "developer_statement",
      source_id: "developer:fixture",
      source_role: "official",
      value: "Developer-authored quality statement",
      url: "https://developer.example/games/c5b-fixture"
    };
    const unknownProof = {
      type: "external_blog",
      source_id: "blog:unclassified",
      value: "Unclassified external write-up",
      url: "https://unknown.example/reviews/c5b-fixture"
    };
    const candidate = steamCandidate({
      ...nearMissEvidence(60),
      quality_proofs: [officialProof]
    });
    const core = await collector.collectV73ShadowCore({
      reportDate,
      capturedAt,
      runContext: automaticRun({ workflow_run_id: "9006" }),
      steamCandidates: [candidate],
      mediaCandidates: [],
      mediaSignals: [],
      candidateStates: new Map(),
      behaviorManifest,
      provider: async () => ({ quality_proofs: [unknownProof] })
    });

    const qualityEvidence = core.evidence_catalog.filter(
      (item) => item.gate_id === "independent_quality_proof"
    );
    assert.deepEqual(
      new Set(qualityEvidence.map((item) => item.source_role)),
      new Set(["official", "unclassified"])
    );
    const firstGate = core.candidates[0].first_pass.indie_prelaunch.gate_results.find(
      (item) => item.gate_id === "independent_quality_proof"
    );
    assert.deepEqual(firstGate.evidence_ids, []);
    assert.deepEqual(core.second_pass.transactions[0].final_output.evidence_ids, []);
  });

  it("matches a known Steam publication only by app ID when titles collide", async () => {
    requireCollector("collectV73ShadowCore");
    const sharedProject = "C5-B Shared Steam Title";
    const qualifiedEvidence = nearMissEvidence(80, {
      project: sharedProject,
      quality_proofs: [firstQualityProof, secondQualityProof]
    });
    const excludedEvidence = nearMissEvidence(81, {
      project: sharedProject,
      publisher_occupancy: "occupied",
      quality_proofs: [firstQualityProof, secondQualityProof]
    });
    const core = await collector.collectV73ShadowCore({
      reportDate,
      capturedAt,
      runContext: automaticRun({ workflow_run_id: "9011" }),
      steamCandidates: [
        steamCandidate(qualifiedEvidence),
        steamCandidate(excludedEvidence, {
          publisherOccupied: true,
          chinaPartnerOccupied: true
        })
      ],
      mediaCandidates: [],
      mediaSignals: [],
      candidateStates: new Map(),
      behaviorManifest
    });

    const qualified = core.candidates.find(
      (item) => item.steam_app_id === qualifiedEvidence.steam_app_id
    );
    const excluded = core.candidates.find(
      (item) => item.steam_app_id === excludedEvidence.steam_app_id
    );
    assert.equal(qualified.publication.shadow_push_pool, true);
    assert.equal(excluded.publication.shadow_push_pool, false);
    assert.equal(excluded.publication.shadow_lead_payload_sha256, null);
  });

  it("selects the exact receipt run tuple among same-date and same-slot pending cores", async () => {
    requireCollector("runC5BShadowCollectorSafely");
    requireCollector("finalizeC5BReplayCorpusSafely");
    const fixture = await finalizerFixture([
      automaticRun({ workflow_run_id: "9004", run_attempt: 1 }),
      automaticRun({ workflow_run_id: "9005", run_attempt: 2 }),
      automaticRun({ workflow_run_id: "9006", run_attempt: 1 })
    ]);
    await writeReceipt(fixture.receiptPath, healthyReceipt({
      run_id: "9005",
      run_attempt: 2
    }));

    const finalized = await collector.finalizeC5BReplayCorpusSafely({
      rootDir: fixture.rootDir,
      reportDate,
      runSlot: "afternoon",
      receiptPath: fixture.receiptPath
    });
    assert.equal(finalized.status, "complete");
    const corpus = JSON.parse(await readFile(finalized.corpus_path, "utf8"));
    assert.deepEqual(validateReplayCorpus(corpus), { valid: true, errors: [] });
    assert.equal(corpus.corpus_id, `${reportDate}/9005/2/afternoon`);
    assert.equal(corpus.workflow_run_id, 9005);
    assert.equal(corpus.run_attempt, 2);
    assert.equal(corpus.delivery_health.sync_response.synced, true);
    assert.equal(corpus.artifact_bindings.replay_corpus.git_blob_sha, null);
    assert.equal(corpus.artifact_bindings.receipt.validation_status, "valid");
    assert.equal(corpus.integrity.payload_sha256, corpus.artifact_bindings.replay_corpus.payload_sha256);
  });

  it("fails closed on a missing, invalid, or mismatched receipt run tuple", async (t) => {
    requireCollector("runC5BShadowCollectorSafely");
    requireCollector("finalizeC5BReplayCorpusSafely");
    const cases = [
      ["missing run_attempt", { run_id: "9004" }],
      ["zero run_attempt", { run_id: "9004", run_attempt: 0 }],
      ["negative run_attempt", { run_id: "9004", run_attempt: -1 }],
      ["fractional run_attempt", { run_id: "9004", run_attempt: 1.5 }],
      ["string run_attempt", { run_id: "9004", run_attempt: "1" }],
      ["run_id mismatch", { run_id: "9904", run_attempt: 1 }],
      ["run_attempt mismatch", { run_id: "9004", run_attempt: 2 }],
      ["report_date mismatch", { report_date: "2026-08-02", run_id: "9004", run_attempt: 1 }],
      ["slot mismatch", { slot: "watchdog", run_id: "9004", run_attempt: 1 }],
      ["event_name mismatch", { event_name: "workflow_dispatch", run_id: "9004", run_attempt: 1 }]
    ];

    for (const [name, overrides] of cases) {
      await t.test(name, async () => {
        const fixture = await finalizerFixture([
          automaticRun({ workflow_run_id: "9004", run_attempt: 1 })
        ]);
        await writeReceipt(fixture.receiptPath, healthyReceipt(overrides));
        const receiptBefore = await readFile(fixture.receiptPath, "utf8");

        const finalized = await collector.finalizeC5BReplayCorpusSafely({
          rootDir: fixture.rootDir,
          reportDate,
          runSlot: "afternoon",
          receiptPath: fixture.receiptPath
        });

        assert.equal(finalized.status, "error", `${name} must fail closed`);
        assert.equal(finalized.corpus_path, null);
        assert.equal(await readFile(fixture.receiptPath, "utf8"), receiptBefore);
        assert.equal(existsSync(expectedCorpusPath(fixture.rootDir, 9004, 1)), false);
      });
    }
  });

  it("rejects an exact pending filename whose core tuple does not match the receipt", async () => {
    requireCollector("runC5BShadowCollectorSafely");
    requireCollector("finalizeC5BReplayCorpusSafely");
    const fixture = await finalizerFixture([
      automaticRun({ workflow_run_id: "9004", run_attempt: 1 })
    ]);
    const wrongCore = await readFile(fixture.captures[0].pending_path, "utf8");
    const forgedExactPath = path.join(
      fixture.rootDir,
      "data/runtime",
      `${reportDate}-c5b-shadow-9005-2-afternoon.json`
    );
    await writeFile(forgedExactPath, wrongCore);
    await writeReceipt(fixture.receiptPath, healthyReceipt({
      run_id: "9005",
      run_attempt: 2
    }));

    const finalized = await collector.finalizeC5BReplayCorpusSafely({
      rootDir: fixture.rootDir,
      reportDate,
      runSlot: "afternoon",
      receiptPath: fixture.receiptPath
    });

    assert.equal(finalized.status, "error");
    assert.equal(finalized.corpus_path, null);
    assert.equal(existsSync(expectedCorpusPath(fixture.rootDir, 9005, 2)), false);
  });

  it("preserves receipt bytes and emits no corpus when corpus validation fails", async () => {
    requireCollector("runC5BShadowCollectorSafely");
    requireCollector("finalizeC5BReplayCorpusSafely");
    const fixture = await finalizerFixture([
      automaticRun({ workflow_run_id: "9004", run_attempt: 1 })
    ]);
    const invalidCore = JSON.parse(await readFile(fixture.captures[0].pending_path, "utf8"));
    invalidCore.contract_version = 0;
    await writeFile(fixture.captures[0].pending_path, `${JSON.stringify(invalidCore, null, 2)}\n`);
    await writeReceipt(fixture.receiptPath, healthyReceipt({
      run_id: "9004",
      run_attempt: 1
    }));
    const receiptBefore = await readFile(fixture.receiptPath, "utf8");

    const finalized = await collector.finalizeC5BReplayCorpusSafely({
      rootDir: fixture.rootDir,
      reportDate,
      runSlot: "afternoon",
      receiptPath: fixture.receiptPath
    });

    assert.equal(finalized.status, "error");
    assert.equal(finalized.corpus_path, null);
    assert.equal(await readFile(fixture.receiptPath, "utf8"), receiptBefore);
    assert.equal(existsSync(expectedCorpusPath(fixture.rootDir, 9004, 1)), false);
  });
});

async function finalizerFixture(runContexts) {
  const rootDir = await mkdtemp(path.join(tmpdir(), "c5b-shadow-finalizer-"));
  const candidate = steamCandidate(nearMissEvidence(70));
  const captures = [];
  for (const runContext of runContexts) {
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
    captures.push(capture);
  }

  await writeFinalizerArtifacts(rootDir);
  return {
    rootDir,
    captures,
    receiptPath: path.join(rootDir, "data", "automation_runs", `${reportDate}-afternoon.json`)
  };
}

async function writeFinalizerArtifacts(rootDir) {
  const artifactPayloads = {
    report: { report_date: reportDate, push_pool: [], watch_pool: [], drop_pool: [] },
    sourcing_candidates: { report_date: reportDate, candidates: [] },
    radar: { report_date: reportDate, items: [] },
    steam_trends: { report_date: reportDate, items: [] }
  };
  for (const [name, payload] of Object.entries(artifactPayloads)) {
    const directory = name === "report" ? "reports" : name;
    await mkdir(path.join(rootDir, "data", directory), { recursive: true });
    await writeFile(
      path.join(rootDir, "data", directory, `${reportDate}.json`),
      `${JSON.stringify(payload, null, 2)}\n`
    );
  }
  await mkdir(path.join(rootDir, "data", "automation_runs"), { recursive: true });
}

function healthyReceipt(overrides = {}) {
  return {
    report_date: reportDate,
    slot: "afternoon",
    status: "success",
    generation_status: "success",
    validation_status: "success",
    event_name: "schedule",
    sync_response: JSON.stringify({ synced: true }),
    ...overrides
  };
}

async function writeReceipt(receiptPath, payload) {
  await writeFile(receiptPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function expectedCorpusPath(rootDir, runId, runAttempt) {
  return path.join(
    rootDir,
    "data/sourcing_replay_corpus",
    reportDate,
    `${runId}-${runAttempt}-afternoon.json`
  );
}

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
