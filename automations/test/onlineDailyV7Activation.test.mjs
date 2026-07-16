import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildDailyReport, buildRadarReport, buildSteamTrendReport } from "../jobs/online_daily_v4_reports.mjs";
import {
  isLeadCountHealthEnabled,
  isQualityQuarantineRule,
  quarantineDailyLeadPools,
  RULE_VERSION
} from "../jobs/online_daily_v4_rules.mjs";
import { validateDailyVolume } from "../jobs/online_daily_v4_volume.mjs";
import { INDIE_PRELAUNCH_GATE_IDS, INDIE_PRELAUNCH_RULE_VERSION } from "../jobs/online_daily_v7_indie_admission.mjs";
import { CHINA_JOINT_GATE_IDS } from "../jobs/online_daily_v7_2_china_joint_admission.mjs";
import { REGULAR_SOURCING_RULE_VERSION } from "../jobs/online_daily_v7_2_regular_admission.mjs";

const emptyPools = () => ({ push: [], watch: [], drop: [], new_qualified_count: 0 });

describe("online Daily V7.2 activation", () => {
  it("uses one executable V7.2 rule across runtime, both lanes, machine rules, docs, and generator", () => {
    const machineRules = JSON.parse(readFileSync(new URL("../rules/daily-report.json", import.meta.url), "utf8"));
    const currentRulesDoc = readFileSync(new URL("../../docs/SOURCING_RULES_CURRENT.md", import.meta.url), "utf8");
    const canonicalRulesDoc = readFileSync(new URL("../../docs/SOURCING_RULES_V7_2.md", import.meta.url), "utf8");
    const generator = readFileSync(new URL("../jobs/online_daily_v4.mjs", import.meta.url), "utf8");

    assert.equal(RULE_VERSION, REGULAR_SOURCING_RULE_VERSION);
    assert.notEqual(RULE_VERSION, INDIE_PRELAUNCH_RULE_VERSION);
    assert.equal(machineRules.rule_version, REGULAR_SOURCING_RULE_VERSION);
    assert.equal(machineRules.canonical_rules_doc, "docs/SOURCING_RULES_V7_2.md");
    assert.deepEqual(machineRules.indie_prelaunch_admission, {
      active: true,
      sourcing_lane: "indie_prelaunch",
      required_gate_ids: INDIE_PRELAUNCH_GATE_IDS,
      all_gates_required: true,
      qualified_route: "push_pool",
      unqualified_route: "sourcing_candidates",
      automatic_priority: null,
      formal_lead_minimum: null,
      formal_lead_maximum: null,
      watch_pool_enabled: false,
      drop_pool_enabled: false,
      invariant: "new_qualified_count === push_pool_count"
    });
    assert.deepEqual(machineRules.china_joint_admission.required_gate_ids, CHINA_JOINT_GATE_IDS);
    assert.equal(machineRules.china_joint_admission.sourcing_lane, "china_joint");
    assert.equal(machineRules.china_joint_admission.automatic_priority, null);
    assert.equal(machineRules.china_joint_admission.formal_lead_minimum, null);
    assert.equal(machineRules.china_joint_admission.formal_lead_maximum, null);
    assert.equal(machineRules.china_joint_admission.data_paths[0].minimum_recommendations, 5000);
    assert.equal(machineRules.china_joint_admission.data_paths[1].minimum_recommendations, 1500);
    assert.deepEqual(machineRules.china_joint_admission.data_paths[1].accepted_ratings, ["very_positive", "overwhelmingly_positive"]);
    assert.equal("quality_quarantine" in machineRules, false);
    assert.match(currentRulesDoc, /sourcing-rules-v7\.2-china-joint/);
    assert.match(currentRulesDoc, /SOURCING_RULES_V7_2\.md/);
    assert.match(canonicalRulesDoc, /new_qualified_count === push_pool_count/);
    assert.match(canonicalRulesDoc, /five qualified `indie_prelaunch` projects and four qualified `china_joint` projects/i);
    assert.match(generator, /const sourcingRuleVersion = RULE_VERSION/);
    assert.doesNotMatch(generator, /quarantineDailyLeadPools|minReviewLeads|minReviewBackfillScore|minMediaLeadsWhenHealthy/);
  });

  it("leaves V6.8 quarantine historical while active V7.2 publishes its qualified pools", () => {
    const candidatePools = {
      push: [{ project: "Qualified" }],
      watch: [],
      drop: [],
      new_qualified_count: 1
    };

    assert.equal(isQualityQuarantineRule(RULE_VERSION), false);
    assert.equal(isLeadCountHealthEnabled(RULE_VERSION), false);
    assert.equal(quarantineDailyLeadPools(candidatePools, RULE_VERSION), candidatePools);
    assert.deepEqual(quarantineDailyLeadPools(candidatePools, "sourcing-rules-v6.8-quality-quarantine"), {
      push: [],
      watch: [],
      drop: []
    });
  });

  it("keeps all three public report artifacts buildable when zero projects qualify", () => {
    const pools = emptyPools();
    const report = buildDailyReport({
      pools,
      rawCount: 12,
      enrichedCount: 8,
      mediaLeadCount: 3,
      reportDate: "2026-07-16",
      diagnostics: { bilibili_official_source_hits: 1, bilibili_probe: {} }
    });
    const radar = buildRadarReport({
      candidates: [],
      pools,
      industrySignals: [{ title: "External signal", source: "GameLook", link: "https://example.com/news" }],
      reportDate: "2026-07-16",
      capturedAt: "2026-07-16T08:00:00+08:00",
      mediaSignalToRadarItem: (item) => ({
        id: "radar_external",
        category: "行业新闻",
        title: item.title,
        source: item.source,
        link: item.link,
        captured_at: "2026-07-16T08:00:00+08:00"
      })
    });
    const steamTrends = buildSteamTrendReport({
      candidates: [],
      pools,
      reportDate: "2026-07-16",
      capturedAt: "2026-07-16T08:00:00+08:00"
    });

    assert.deepEqual(report.push_pool, []);
    assert.deepEqual(report.watch_pool, []);
    assert.deepEqual(report.drop_pool, []);
    assert.match(report.summary, /V7\.2/);
    assert.doesNotMatch(report.summary, /质量隔离/);
    assert.equal(radar.items.length, 1);
    assert.ok(steamTrends.items.length >= 8);
    assert.ok(steamTrends.market_insights.length >= 3);
    assert.ok(steamTrends.genre_signals.length >= 3);
    assert.deepEqual(steamTrends.crm_candidates, []);
  });

  it("treats formal Lead quantity as non-health while blocking qualified/push mismatch", () => {
    const diagnostics = {
      media_signals_raw: 18,
      media_stale_filtered: 0,
      media_banned_filtered: 0,
      media_low_score_filtered: 0,
      media_non_product_filtered: 0,
      media_duplicate_filtered: 0,
      bilibili_official_source_hits: 0,
      media_expanded_product_candidates: 0,
      media_rescue_product_candidates: 0,
      media_released_routed_to_drop: 0
    };
    const result = validateDailyVolume({
      pools: emptyPools(),
      mediaSignals: [],
      mediaLeadCandidates: [],
      rawCandidateCount: 40,
      enrichedCandidateCount: 20,
      diagnostics,
      newQualifiedCount: 0,
      ruleVersion: RULE_VERSION,
      logger: { warn: () => { throw new Error("formal count must not warn"); } }
    });

    assert.equal(result.ok, true);
    assert.equal(result.degraded, false);
    assert.equal(result.leadCountHealthEnabled, false);
    assert.equal(result.qualifiedPushParity, true);
    assert.deepEqual(result.issues, []);

    assert.throws(() => validateDailyVolume({
      pools: { push: [], watch: [], drop: [], new_qualified_count: 1 },
      mediaSignals: [],
      mediaLeadCandidates: [],
      rawCandidateCount: 1,
      enrichedCandidateCount: 1,
      diagnostics,
      newQualifiedCount: 1,
      ruleVersion: RULE_VERSION
    }), /new_qualified_count=1.*push_pool_count=0/);
  });

  it("passes the real Daily contract with zero formal Leads and explicit V7 parity counts", () => {
    const date = "2026-07-16";
    const capturedAt = "2026-07-16T08:00:00+08:00";
    const rootDir = mkdtempSync(path.join(tmpdir(), "crm-v7-indie-contract-"));
    const pools = emptyPools();
    const report = buildDailyReport({
      pools,
      rawCount: 12,
      enrichedCount: 8,
      mediaLeadCount: 3,
      reportDate: date,
      diagnostics: { bilibili_official_source_hits: 1, bilibili_probe: {} }
    });
    const radar = buildRadarReport({
      candidates: [],
      pools,
      industrySignals: Array.from({ length: 8 }, (_, index) => ({
        title: `External market signal ${index}`,
        summary: `External platform and market update ${index}`,
        source: "GameLook",
        link: `https://example.com/news/${index}`,
        score: 30,
        source_focus: ["china", "business"]
      })),
      reportDate: date,
      capturedAt
    });
    const steamTrends = buildSteamTrendReport({ candidates: [], pools, reportDate: date, capturedAt });
    const sourcingCandidates = {
      schema_version: 1,
      report_date: date,
      generated_at: capturedAt,
      sourcing_rule_version: RULE_VERSION,
      scan_summary: {
        steam_candidates_seen: 0,
        steam_candidates_enriched: 0,
        media_signals_seen: 0,
        media_candidates_seen: 0,
        records_total: 0,
        formal: 0,
        candidate: 0,
        excluded: 0,
        new_qualified_count: 0,
        push_pool_count: 0
      },
      candidates: []
    };

    cpSync(fileURLToPath(new URL("../../schemas", import.meta.url)), path.join(rootDir, "schemas"), { recursive: true });
    writeArtifact(rootDir, `data/reports/${date}.json`, report);
    writeArtifact(rootDir, `data/radar/${date}.json`, radar);
    writeArtifact(rootDir, `data/steam_trends/${date}.json`, steamTrends);
    writeArtifact(rootDir, `data/sourcing_candidates/${date}.json`, sourcingCandidates);

    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL("../../scripts/validate-daily-contract.mjs", import.meta.url)),
      `--rootDir=${rootDir}`,
      `--date=${date}`,
      "--requireSourcingCandidates=true"
    ], { encoding: "utf8" });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /"push": 0/);
    assert.match(result.stdout, /"sourcing_candidates": 0/);
  });
});

function writeArtifact(rootDir, relativePath, payload) {
  const absolutePath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(payload)}\n`, "utf8");
}
