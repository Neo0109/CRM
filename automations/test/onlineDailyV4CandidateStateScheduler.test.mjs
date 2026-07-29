import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  EVIDENCE_SNAPSHOT_CONTRACT_VERSION,
  applySteamEnrichmentOutcomes,
  candidateStateForAudit,
  createEvidenceSnapshot,
  reconstructSteamCandidateStates
} from "../jobs/online_daily_v4_candidate_state.mjs";
import { scheduleSteamCandidateEnrichment } from "../jobs/online_daily_v4_enrichment_scheduler.mjs";
import { evaluateSteamRegularAdmission } from "../jobs/online_daily_v7_2_regular_admission.mjs";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const validatorPath = fileURLToPath(new URL("../../scripts/validate-daily-contract.mjs", import.meta.url));
const replayDate = "2026-07-29";

describe("PR B candidate state and fair enrichment", () => {
  it("reuses a compatible seven-day evidence snapshot without spending enrichment budget and preserves V7.2 parity", () => {
    const raw = rawCandidate(1);
    const evidence = enrichedEvidence(raw);
    const snapshot = createEvidenceSnapshot(evidence, {
      capturedAt: "2026-07-28T09:00:00+08:00"
    });
    const history = [artifactFromStateRows("2026-07-28", [{
      dedupe_key: keyFor(raw),
      source_type: "steam",
      matched_rules: ["steam_discovery", "steam_enriched"],
      missing_evidence: [],
      ...baseState({
        firstSeen: "2026-07-28",
        lastSeen: "2026-07-28",
        status: "success",
        attempts: 1,
        lastAttemptedAt: "2026-07-28T09:00:00+08:00",
        lastEnrichedAt: "2026-07-28T09:00:00+08:00",
        snapshot
      })
    }])];

    const states = reconstructSteamCandidateStates({
      candidates: [raw],
      historicalArtifacts: history,
      reportDate: replayDate
    });
    const plan = scheduleSteamCandidateEnrichment({
      candidates: [raw],
      states,
      reportDate: replayDate,
      maxCandidates: 90,
      reviewScore: () => 100
    });

    assert.equal(snapshot.contract_version, EVIDENCE_SNAPSHOT_CONTRACT_VERSION);
    assert.equal(plan.scheduled.length, 0);
    assert.equal(plan.reused.length, 1);
    assert.equal(plan.snapshot_rejections.length, 0);
    assert.deepEqual(plan.reused[0].enrichedCandidate, evidence);
    assert.deepEqual(
      evaluateSteamRegularAdmission(plan.reused[0].enrichedCandidate),
      evaluateSteamRegularAdmission(evidence)
    );
  });

  it("rejects expired, corrupt, and contract-mismatched snapshots and records every rejection", () => {
    const candidates = [rawCandidate(11), rawCandidate(12), rawCandidate(13)];
    const validSnapshots = candidates.map((candidate, index) => createEvidenceSnapshot(
      enrichedEvidence(candidate),
      { capturedAt: index === 0 ? "2026-07-20T09:00:00+08:00" : "2026-07-28T09:00:00+08:00" }
    ));
    validSnapshots[1] = { ...validSnapshots[1], contract_version: 999 };
    validSnapshots[2] = {
      ...validSnapshots[2],
      evidence: { appId: candidates[2].appId, hasDetails: true }
    };
    const history = [artifactFromStateRows("2026-07-28", candidates.map((candidate, index) => ({
      dedupe_key: keyFor(candidate),
      source_type: "steam",
      matched_rules: ["steam_discovery", "steam_enriched"],
      missing_evidence: [],
      ...baseState({
        firstSeen: "2026-07-20",
        lastSeen: "2026-07-28",
        status: "success",
        attempts: 1,
        lastAttemptedAt: "2026-07-28T09:00:00+08:00",
        lastEnrichedAt: "2026-07-28T09:00:00+08:00",
        snapshot: validSnapshots[index]
      })
    })))];

    const states = reconstructSteamCandidateStates({
      candidates,
      historicalArtifacts: history,
      reportDate: replayDate
    });
    const plan = scheduleSteamCandidateEnrichment({
      candidates,
      states,
      reportDate: replayDate,
      maxCandidates: 90,
      reviewScore: () => 100
    });

    assert.equal(plan.reused.length, 0);
    assert.equal(plan.scheduled.length, 3);
    assert.deepEqual(
      new Set(plan.snapshot_rejections.map((item) => item.reason)),
      new Set(["expired", "contract_version_mismatch", "invalid_evidence"])
    );
  });

  it("keeps legacy v1 artifacts readable but never treats them as reusable snapshots", () => {
    const raw = rawCandidate(21);
    const legacy = {
      schema_version: 1,
      report_date: "2026-07-28",
      generated_at: "2026-07-28T09:00:00+08:00",
      candidates: [{
        dedupe_key: keyFor(raw),
        source_type: "steam",
        matched_rules: ["steam_discovery", "steam_enriched"],
        missing_evidence: []
      }]
    };
    const states = reconstructSteamCandidateStates({
      candidates: [raw],
      historicalArtifacts: [legacy],
      reportDate: replayDate
    });
    const plan = scheduleSteamCandidateEnrichment({
      candidates: [raw],
      states,
      reportDate: replayDate,
      maxCandidates: 90,
      reviewScore: () => 100
    });

    assert.equal(plan.reused.length, 0);
    assert.equal(plan.scheduled.length, 1);
    assert.equal(plan.scheduled[0].schedulerLane, "retry_refresh");
  });

  it("does not retry a failed candidate again on the same Shanghai calendar day", () => {
    const raw = rawCandidate(31);
    const states = new Map([[keyFor(raw), baseState({
      firstSeen: replayDate,
      lastSeen: replayDate,
      status: "failed",
      attempts: 1,
      lastAttemptedAt: "2026-07-29T09:00:00+08:00",
      nextRetryDate: "2026-07-30"
    })]]);
    const plan = scheduleSteamCandidateEnrichment({
      candidates: [raw],
      states,
      reportDate: replayDate,
      maxCandidates: 90,
      reviewScore: () => 100
    });

    assert.equal(plan.scheduled.length, 0);
    assert.equal(plan.deferred.length, 1);
    assert.equal(plan.deferred[0].deferReason, "retry_cooldown");
  });

  it("uses deterministic 4:3:2 weighted scheduling and remains work-conserving", () => {
    const reportDate = replayDate;
    const newCandidates = Array.from({ length: 100 }, (_, index) => rawCandidate(1000 + index));
    const backlogCandidates = Array.from({ length: 100 }, (_, index) => rawCandidate(2000 + index));
    const retryCandidates = Array.from({ length: 100 }, (_, index) => rawCandidate(3000 + index));
    const candidates = [...newCandidates, ...backlogCandidates, ...retryCandidates];
    const states = new Map();

    for (const candidate of newCandidates) {
      states.set(keyFor(candidate), baseState({ firstSeen: reportDate, lastSeen: reportDate }));
    }
    for (const candidate of backlogCandidates) {
      states.set(keyFor(candidate), baseState({
        firstSeen: "2026-07-20",
        lastSeen: reportDate
      }));
    }
    for (const candidate of retryCandidates) {
      states.set(keyFor(candidate), baseState({
        firstSeen: "2026-07-20",
        lastSeen: reportDate,
        status: "failed",
        attempts: 1,
        lastAttemptedAt: "2026-07-28T09:00:00+08:00",
        nextRetryDate: reportDate
      }));
    }

    const plan = scheduleSteamCandidateEnrichment({
      candidates,
      states,
      reportDate,
      maxCandidates: 90,
      reviewScore: (candidate) => 100000 - candidate.sourceIndex
    });
    assert.equal(plan.scheduled.length, 90);
    assert.deepEqual(plan.lane_counts, {
      new: 40,
      backlog: 30,
      retry_refresh: 20
    });

    const sparseCandidates = [...backlogCandidates.slice(0, 2), ...retryCandidates.slice(0, 30)];
    const sparsePlan = scheduleSteamCandidateEnrichment({
      candidates: sparseCandidates,
      states,
      reportDate,
      maxCandidates: 18,
      reviewScore: (candidate) => 100000 - candidate.sourceIndex
    });
    assert.equal(sparsePlan.scheduled.length, 18);
    assert.equal(sparsePlan.lane_counts.backlog, 2);
    assert.equal(sparsePlan.lane_counts.retry_refresh, 16);
  });

  it("covers at least 85 percent of a stable 260-candidate pool within three 90-slot runs", () => {
    const candidates = Array.from({ length: 260 }, (_, index) => rawCandidate(4000 + index));
    const history = [];
    const evaluatedKeys = new Set();
    const dates = ["2026-07-27", "2026-07-28", "2026-07-29"];

    for (const reportDate of dates) {
      const states = reconstructSteamCandidateStates({
        candidates,
        historicalArtifacts: history,
        reportDate
      });
      const plan = scheduleSteamCandidateEnrichment({
        candidates,
        states,
        reportDate,
        maxCandidates: 90,
        reviewScore: (candidate) => 100000 - candidate.sourceIndex
      });
      assert.ok(plan.scheduled.length <= 90);
      for (const item of [...plan.reused, ...plan.scheduled]) evaluatedKeys.add(item.key);

      const fresh = plan.scheduled.map((item) => enrichedEvidence(item.candidate));
      const applied = applySteamEnrichmentOutcomes({
        states,
        scheduled: plan.scheduled,
        reused: plan.reused,
        deferred: plan.deferred,
        snapshotRejections: plan.snapshot_rejections,
        enrichedCandidates: fresh,
        reportDate,
        capturedAt: reportDate + "T12:00:00+08:00"
      });
      history.push(artifactFromStateMap(reportDate, applied.states));
    }

    assert.ok(evaluatedKeys.size / candidates.length >= 0.85);
    assert.equal(evaluatedKeys.size, 260);
  });

  it("turns every 2026-07-28 to 2026-07-29 duplicate success into reuse instead of another request", () => {
    const july28 = JSON.parse(readFileSync(new URL("../../data/sourcing_candidates/2026-07-28.json", import.meta.url), "utf8"));
    const july29 = JSON.parse(readFileSync(new URL("../../data/sourcing_candidates/2026-07-29.json", import.meta.url), "utf8"));
    const enriched28 = new Set(july28.candidates
      .filter((candidate) => candidate.matched_rules.includes("steam_enriched"))
      .map((candidate) => candidate.dedupe_key));
    const enriched29 = new Set(july29.candidates
      .filter((candidate) => candidate.matched_rules.includes("steam_enriched"))
      .map((candidate) => candidate.dedupe_key));
    const duplicateSuccess = new Set([...enriched28].filter((key) => enriched29.has(key)));
    assert.equal(duplicateSuccess.size, 86);

    const stateRows = july28.candidates
      .filter((candidate) => candidate.steam_app_id && ["steam", "multi_source"].includes(candidate.source_type))
      .map((candidate) => {
        const raw = rawFromAudit(candidate);
        const succeeded = enriched28.has(candidate.dedupe_key);
        return {
          dedupe_key: candidate.dedupe_key,
          source_type: candidate.source_type,
          matched_rules: candidate.matched_rules,
          missing_evidence: candidate.missing_evidence,
          ...baseState({
            firstSeen: "2026-07-28",
            lastSeen: "2026-07-28",
            status: succeeded ? "success" : "pending",
            attempts: succeeded ? 1 : 0,
            lastAttemptedAt: succeeded ? july28.generated_at : null,
            lastEnrichedAt: succeeded ? july28.generated_at : null,
            snapshot: succeeded ? createEvidenceSnapshot(enrichedEvidence(raw), {
              capturedAt: july28.generated_at
            }) : null
          })
        };
      });
    const currentCandidates = july29.candidates
      .filter((candidate) => candidate.steam_app_id && ["steam", "multi_source"].includes(candidate.source_type))
      .map(rawFromAudit);
    const states = reconstructSteamCandidateStates({
      candidates: currentCandidates,
      historicalArtifacts: [artifactFromStateRows("2026-07-28", stateRows)],
      reportDate: "2026-07-29"
    });
    const plan = scheduleSteamCandidateEnrichment({
      candidates: currentCandidates,
      states,
      reportDate: "2026-07-29",
      maxCandidates: 90,
      reviewScore: (candidate) => 100000 - candidate.sourceIndex
    });
    const reusedKeys = new Set(plan.reused.map((item) => item.key));
    const scheduledKeys = new Set(plan.scheduled.map((item) => item.key));

    assert.ok([...duplicateSuccess].every((key) => reusedKeys.has(key)));
    assert.ok([...duplicateSuccess].every((key) => !scheduledKeys.has(key)));
    assert.equal(plan.scheduled.length, 90);
  });

  it("validates both legacy schema v1 and stateful schema v2 artifacts", () => {
    const rootDir = temporaryContractRoot();
    const legacy = JSON.parse(readFileSync(new URL("../../data/sourcing_candidates/2026-07-29.json", import.meta.url), "utf8"));
    writeCandidateArtifact(rootDir, legacy);
    const legacyResult = runValidator(rootDir);
    assert.equal(legacyResult.status, 0, legacyResult.stdout + "\n" + legacyResult.stderr);

    const v2 = upgradeArtifactToV2(legacy);
    writeCandidateArtifact(rootDir, v2);
    const v2Result = runValidator(rootDir);
    assert.equal(v2Result.status, 0, v2Result.stdout + "\n" + v2Result.stderr);

    const corrupt = structuredClone(v2);
    const firstSteam = corrupt.candidates.find((candidate) => ["steam", "multi_source"].includes(candidate.source_type));
    delete firstSteam.first_seen;
    writeCandidateArtifact(rootDir, corrupt);
    const corruptResult = runValidator(rootDir);
    assert.notEqual(corruptResult.status, 0);
    assert.match(corruptResult.stdout + "\n" + corruptResult.stderr, /first_seen/);
  });
});

function rawCandidate(index, overrides = {}) {
  return {
    appId: String(100000 + index),
    title: "Candidate " + index,
    source: "Steam Upcoming",
    sourceIndex: index,
    release: "Dec 2030",
    reviewText: "",
    tags: ["Strategy"],
    ...overrides
  };
}

function rawFromAudit(candidate, index = 0) {
  const numeric = Number(candidate.steam_app_id);
  return rawCandidate(Number.isFinite(numeric) ? numeric : index, {
    appId: String(candidate.steam_app_id),
    title: candidate.project,
    sourceIndex: index
  });
}

function enrichedEvidence(raw, overrides = {}) {
  return {
    appId: String(raw.appId),
    title: raw.title,
    source: raw.source,
    storeUrl: "https://store.steampowered.com/app/" + raw.appId + "/",
    steamDbUrl: "https://steamdb.info/app/" + raw.appId + "/",
    developers: ["Example Studio"],
    publishers: [],
    country: "海外",
    region: "海外",
    genres: ["Strategy"],
    categories: [],
    shortDescription: "",
    releaseDate: "2030-12-01",
    daysToRelease: 1000,
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
    mobileAdaptationPotential: false,
    publisherOccupied: false,
    chinaPartnerOccupied: false,
    contactMethods: [],
    website: "https://example.com/" + raw.appId,
    hasDetails: true,
    recommendationCount: 0,
    screenshotCount: 6,
    movieCount: 1,
    officialDemoEvidence: [{ type: "steam_demo", url: "https://store.steampowered.com/app/" + raw.appId + "/" }],
    officialGameplayEvidence: [{ type: "steam_movie", url: "https://store.steampowered.com/app/" + raw.appId + "/" }],
    qualityProofs: [],
    chinaBilibiliValue: ["Strategy community fit"],
    chinaDemandEvidence: [],
    reviewText: raw.reviewText ?? "",
    domesticQuery: Boolean(raw.domesticQuery),
    releaseTooSoon: false,
    score: 80,
    ...overrides
  };
}

function baseState({
  firstSeen,
  lastSeen,
  status = "pending",
  attempts = 0,
  lastAttemptedAt = null,
  lastEnrichedAt = null,
  nextRetryDate = null,
  schedulerLane = null,
  snapshot = null
} = {}) {
  return {
    first_seen: firstSeen ?? replayDate,
    last_seen: lastSeen ?? replayDate,
    enrichment_status: status,
    enrichment_attempts: attempts,
    last_attempted_at: lastAttemptedAt,
    last_enriched_at: lastEnrichedAt,
    next_retry_date: nextRetryDate,
    scheduler_lane: schedulerLane,
    evidence_snapshot: snapshot
  };
}

function keyFor(candidate) {
  return "steam:" + candidate.appId;
}

function artifactFromStateRows(reportDate, rows) {
  return {
    schema_version: 2,
    report_date: reportDate,
    generated_at: reportDate + "T12:00:00+08:00",
    candidates: rows
  };
}

function artifactFromStateMap(reportDate, states) {
  return artifactFromStateRows(reportDate, [...states.entries()].map(([dedupeKey, state]) => ({
    dedupe_key: dedupeKey,
    source_type: "steam",
    matched_rules: state.last_enriched_at ? ["steam_discovery", "steam_enriched"] : ["steam_discovery"],
    missing_evidence: state.last_enriched_at ? [] : ["steam_app_details"],
    ...candidateStateForAudit(state)
  })));
}

function temporaryContractRoot() {
  const rootDir = mkdtempSync(path.join(tmpdir(), "crm-pr-b-candidate-contract-"));
  cpSync(path.join(repoRoot, "schemas"), path.join(rootDir, "schemas"), { recursive: true });
  for (const directory of ["reports", "radar", "steam_trends"]) {
    const target = path.join(rootDir, "data/" + directory + "/" + replayDate + ".json");
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(path.join(repoRoot, "data/" + directory + "/" + replayDate + ".json"), target);
  }
  return rootDir;
}

function writeCandidateArtifact(rootDir, artifact) {
  const target = path.join(rootDir, "data/sourcing_candidates/" + replayDate + ".json");
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(artifact, null, 2) + "\n", "utf8");
}

function runValidator(rootDir) {
  return spawnSync(process.execPath, [
    validatorPath,
    "--rootDir=" + rootDir,
    "--date=" + replayDate,
    "--allowLowVolume=true",
    "--requireSourcingCandidates=true"
  ], { encoding: "utf8" });
}

function upgradeArtifactToV2(legacy) {
  const artifact = structuredClone(legacy);
  artifact.schema_version = 2;
  const steamCandidates = artifact.candidates.filter((candidate) => ["steam", "multi_source"].includes(candidate.source_type));
  const scheduled = steamCandidates.filter((candidate) => candidate.matched_rules.includes("steam_enriched")).length;
  artifact.scan_summary = {
    ...artifact.scan_summary,
    steam_candidates_scheduled: scheduled,
    steam_candidates_reused: 0,
    steam_candidates_fresh_success: scheduled,
    steam_candidates_failed: 0,
    steam_candidates_deferred: steamCandidates.length - scheduled,
    steam_candidates_evaluated: scheduled,
    backlog_unenriched_count: steamCandidates.length - scheduled,
    scheduler_lane_counts: { new: scheduled, backlog: 0, retry_refresh: 0 },
    evidence_snapshot_rejections: 0
  };
  artifact.candidates = artifact.candidates.map((candidate) => {
    if (!["steam", "multi_source"].includes(candidate.source_type)) return candidate;
    const succeeded = candidate.matched_rules.includes("steam_enriched");
    return {
      ...candidate,
      ...baseState({
        firstSeen: artifact.report_date,
        lastSeen: artifact.report_date,
        status: succeeded ? "success" : "pending",
        attempts: succeeded ? 1 : 0,
        lastAttemptedAt: succeeded ? artifact.generated_at : null,
        lastEnrichedAt: succeeded ? artifact.generated_at : null,
        schedulerLane: succeeded ? "new" : null
      })
    };
  });
  return artifact;
}
