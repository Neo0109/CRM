import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildSourcingCandidateArtifact } from "../jobs/online_daily_v4_candidate_audit.mjs";

const reportDate = "2026-07-15";
const capturedAt = "2026-07-15T21:45:00+08:00";
const ruleVersion = "sourcing-rules-v6.8-quality-quarantine";
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const validatorPath = fileURLToPath(new URL("../../scripts/validate-daily-contract.mjs", import.meta.url));

describe("online daily v4 sourcing candidate audit", () => {
  it("dedupes candidate decisions and preserves zero formal Leads during quality quarantine", () => {
    const artifact = buildFixtureArtifact();

    assert.deepEqual(artifact.scan_summary, {
      steam_candidates_seen: 3,
      steam_candidates_enriched: 2,
      media_signals_seen: 12,
      media_candidates_seen: 1,
      records_total: 4,
      formal: 0,
      candidate: 3,
      excluded: 1
    });
    assert.equal(new Set(artifact.candidates.map((item) => item.dedupe_key)).size, 4);

    const enriched = artifact.candidates.find((item) => item.dedupe_key === "steam:101");
    assert.equal(enriched.decision, "candidate");
    assert.ok(enriched.matched_rules.includes("pre_quarantine_push"));
    assert.ok(enriched.matched_rules.includes("quality_quarantine"));
    assert.equal(enriched.ea_state, "no");
    assert.deepEqual(enriched.visual_state, {
      status: "available",
      screenshot_count: 6,
      movie_count: 1
    });
    assert.equal(enriched.steam_review_summary.status, "available");
    assert.equal(enriched.steam_review_summary.recommendation_count, 1200);

    const discoveryOnly = artifact.candidates.find((item) => item.dedupe_key === "steam:202");
    assert.equal(discoveryOnly.decision, "candidate");
    assert.equal(discoveryOnly.ea_state, "unknown");
    assert.equal(discoveryOnly.visual_state.status, "unknown");
    assert.equal(discoveryOnly.steam_review_summary.status, "unknown");
    assert.ok(discoveryOnly.missing_evidence.includes("steam_app_details"));
    assert.ok(discoveryOnly.missing_evidence.includes("ea_status"));
    assert.ok(discoveryOnly.missing_evidence.includes("visual_assets"));

    const excluded = artifact.candidates.find((item) => item.dedupe_key === "steam:303");
    assert.equal(excluded.decision, "excluded");
    assert.ok(excluded.exclusion_reasons.some((reason) => reason.includes("已发售")));

    const media = artifact.candidates.find((item) => item.dedupe_key === "project:media mystery");
    assert.equal(media.source_type, "media");
    assert.equal(media.ea_state, "unknown");
    assert.ok(media.missing_evidence.includes("steam_app_id"));
    assert.ok(media.source_links.includes("https://www.bilibili.com/video/BV1audit"));
  });

  it("marks only published report-pool records as formal", () => {
    const artifact = buildFixtureArtifact({
      publishedPools: {
        push: [{ project: "Rich Candidate", steam_app_id: "101" }],
        watch: [],
        drop: []
      }
    });

    assert.equal(artifact.scan_summary.formal, 1);
    assert.equal(artifact.scan_summary.candidate, 2);
    assert.equal(artifact.candidates.find((item) => item.dedupe_key === "steam:101").decision, "formal");
  });

  it("validates structure, unknown evidence, counts, and dedupe through the Daily contract", () => {
    const rootDir = temporaryContractRoot();
    const artifact = buildFixtureArtifact();
    writeCandidateArtifact(rootDir, artifact);

    const valid = runValidator(rootDir);
    assert.equal(valid.status, 0, `${valid.stdout}\n${valid.stderr}`);
    assert.match(valid.stdout, /"sourcing_candidates": 4/);

    const duplicate = structuredClone(artifact);
    duplicate.candidates.push(structuredClone(duplicate.candidates[0]));
    duplicate.scan_summary.records_total += 1;
    duplicate.scan_summary.candidate += 1;
    writeCandidateArtifact(rootDir, duplicate);

    const invalid = runValidator(rootDir);
    assert.notEqual(invalid.status, 0);
    assert.match(`${invalid.stdout}\n${invalid.stderr}`, /duplicate sourcing candidate dedupe_key/);
  });

  it("rejects a corrupt candidate artifact instead of treating it as an empty audit", () => {
    const rootDir = temporaryContractRoot();
    const candidatePath = path.join(rootDir, `data/sourcing_candidates/${reportDate}.json`);
    mkdirSync(path.dirname(candidatePath), { recursive: true });
    writeFileSync(candidatePath, "{ broken json\n", "utf8");

    const result = runValidator(rootDir);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /SyntaxError|JSON/);
  });

  it("publishes the audit file but keeps every automatic CRM sync report-only", () => {
    const crmSource = readFileSync(new URL("../../functions/_lib/crm.ts", import.meta.url), "utf8");
    const importSource = readFileSync(new URL("../jobs/import_to_crm.ts", import.meta.url), "utf8");
    const syncWorkflow = readFileSync(new URL("../../.github/workflows/sync-daily-report.yml", import.meta.url), "utf8");
    const watchdogWorkflow = readFileSync(new URL("../../.github/workflows/daily-report-watchdog.yml", import.meta.url), "utf8");

    const syncFunction = crmSource.slice(
      crmSource.indexOf("export async function syncReportFromRepository"),
      crmSource.indexOf("export function todayInShanghai")
    );
    assert.match(syncFunction, /data\/reports\/\$\{reportDate\}\.json/);
    assert.doesNotMatch(syncFunction, /sourcing_candidates/);
    assert.match(importSource, /Usage: npm run import:daily -- data\/reports\/YYYY-MM-DD\.json/);
    assert.doesNotMatch(importSource, /sourcing_candidates/);

    for (const workflow of [syncWorkflow, watchdogWorkflow]) {
      assert.match(workflow, /data\/sourcing_candidates\/\$REPORT_DATE\.json/);
      assert.match(workflow, /api\/reports\/sync\?date=\$REPORT_DATE/);
      assert.doesNotMatch(workflow, /api\/.*sourcing_candidates/);
    }
  });

  it("declares the candidate audit in the active V6.8 artifact manifest", () => {
    const rules = JSON.parse(readFileSync(new URL("../rules/daily-report.json", import.meta.url), "utf8"));
    assert.deepEqual(rules.quality_quarantine.preserve_artifacts, [
      "daily_report",
      "industry_radar",
      "steam_trends",
      "sourcing_candidates"
    ]);
  });
});

function buildFixtureArtifact(overrides = {}) {
  const rawSteamCandidates = [
    { appId: "101", title: "Rich Candidate", source: "Steam Upcoming CN", reviewText: "Very Positive", href: "https://store.steampowered.com/app/101/" },
    { appId: "101", title: "Rich Candidate Duplicate", source: "Steam Demo CN", reviewText: "" },
    { appId: "202", title: "Needs Enrichment", source: "Steam Upcoming", reviewText: "", href: "https://store.steampowered.com/app/202/" }
  ];
  const enrichedSteamCandidates = [
    {
      appId: "101",
      title: "Rich Candidate",
      source: "Steam Upcoming CN",
      storeUrl: "https://store.steampowered.com/app/101/",
      steamDbUrl: "https://steamdb.info/app/101/",
      website: "https://rich.example.com",
      hasDetails: true,
      earlyAccess: false,
      screenshotCount: 6,
      movieCount: 1,
      reviewText: "Very Positive",
      recommendationCount: 1200,
      region: "中国",
      alreadyReleased: false,
      releaseTooSoon: false,
      publisherOccupied: false,
      narrativeHeavy: false,
      indiaTeam: false,
      validatedPcHit: false,
      mobileAdaptationPotential: true,
      score: 80
    },
    {
      appId: "303",
      title: "Released Candidate",
      source: "Steam Upcoming",
      storeUrl: "https://store.steampowered.com/app/303/",
      steamDbUrl: "https://steamdb.info/app/303/",
      website: null,
      hasDetails: true,
      earlyAccess: false,
      screenshotCount: 2,
      movieCount: 0,
      reviewText: "",
      recommendationCount: 0,
      region: "中国",
      alreadyReleased: true,
      releaseTooSoon: false,
      publisherOccupied: false,
      narrativeHeavy: false,
      indiaTeam: false,
      validatedPcHit: false,
      mobileAdaptationPotential: false,
      score: -20
    }
  ];
  const mediaCandidates = [{
    _class: "watch",
    _confidence: "expanded",
    _mediaItem: {
      source: "B站视频-国产独立游戏",
      link: "https://www.bilibili.com/video/BV1audit",
      title: "Media Mystery"
    },
    project: "Media Mystery",
    steam_app_id: null,
    sourcing_lane: null,
    links: ["https://www.bilibili.com/video/BV1audit"],
    early_access: false,
    risks: "Steam evidence pending"
  }];
  const candidatePools = {
    push: [{ project: "Rich Candidate", steam_app_id: "101" }],
    watch: [{ project: "Media Mystery", steam_app_id: null }],
    drop: [{ project: "Released Candidate", steam_app_id: "303", risks: "Steam 页面显示已发售" }]
  };

  return buildSourcingCandidateArtifact({
    reportDate,
    capturedAt,
    ruleVersion,
    rawSteamCandidates,
    enrichedSteamCandidates,
    mediaSignalsSeen: 12,
    mediaCandidates,
    candidatePools,
    publishedPools: overrides.publishedPools ?? { push: [], watch: [], drop: [] }
  });
}

function temporaryContractRoot() {
  const rootDir = mkdtempSync(path.join(tmpdir(), "crm-sourcing-candidate-contract-"));
  cpSync(path.join(repoRoot, "schemas"), path.join(rootDir, "schemas"), { recursive: true });
  for (const directory of ["reports", "radar", "steam_trends"]) {
    const target = path.join(rootDir, `data/${directory}/${reportDate}.json`);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(
      path.join(repoRoot, `data/${directory}/${reportDate}.json`),
      target
    );
  }
  return rootDir;
}

function writeCandidateArtifact(rootDir, artifact) {
  const candidatePath = path.join(rootDir, `data/sourcing_candidates/${reportDate}.json`);
  mkdirSync(path.dirname(candidatePath), { recursive: true });
  writeFileSync(candidatePath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
}

function runValidator(rootDir) {
  return spawnSync(process.execPath, [
    validatorPath,
    `--rootDir=${rootDir}`,
    `--date=${reportDate}`,
    "--allowLowVolume=true",
    "--requireSourcingCandidates=true"
  ], { encoding: "utf8" });
}
