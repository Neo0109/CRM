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

const QUALITY_QUARANTINE_RULE_VERSION = "sourcing-rules-v6.8-quality-quarantine";
const emptyPools = () => ({ push: [], watch: [], drop: [] });

describe("online daily v4 quality quarantine", () => {
  it("uses one explicit V6.8 quarantine rule across runtime, machine rules, docs, and contract validation", () => {
    const machineRules = JSON.parse(readFileSync(new URL("../rules/daily-report.json", import.meta.url), "utf8"));
    const currentRulesDoc = readFileSync(new URL("../../docs/SOURCING_RULES_CURRENT.md", import.meta.url), "utf8");
    const generator = readFileSync(new URL("../jobs/online_daily_v4.mjs", import.meta.url), "utf8");
    const contractValidator = readFileSync(new URL("../../scripts/validate-daily-contract.mjs", import.meta.url), "utf8");

    assert.equal(RULE_VERSION, QUALITY_QUARANTINE_RULE_VERSION);
    assert.equal(machineRules.rule_version, QUALITY_QUARANTINE_RULE_VERSION);
    assert.deepEqual(machineRules.quality_quarantine, {
      active: true,
      publish_lead_pools: false,
      lead_count_health: "disabled",
      preserve_artifacts: ["daily_report", "industry_radar", "steam_trends", "sourcing_candidates"]
    });
    assert.match(currentRulesDoc, /sourcing-rules-v6\.8-quality-quarantine/);
    assert.match(generator, /const sourcingRuleVersion = RULE_VERSION/);
    assert.match(generator, /quarantineDailyLeadPools/);
    assert.match(contractValidator, /isLeadCountHealthEnabled\(RULE_VERSION\)/);
  });

  it("publishes no Daily Lead pools only for the explicit quarantine rule without mutating candidates", () => {
    const candidatePools = {
      push: [{ project: "Push" }],
      watch: [{ project: "Watch" }],
      drop: [{ project: "Drop" }]
    };

    assert.equal(isQualityQuarantineRule(RULE_VERSION), true);
    assert.equal(isLeadCountHealthEnabled(RULE_VERSION), false);
    assert.deepEqual(quarantineDailyLeadPools(candidatePools, RULE_VERSION), emptyPools());
    assert.deepEqual(candidatePools, {
      push: [{ project: "Push" }],
      watch: [{ project: "Watch" }],
      drop: [{ project: "Drop" }]
    });
    assert.equal(quarantineDailyLeadPools(candidatePools, "sourcing-rules-v6.7-non-game-animation-gate"), candidatePools);
  });

  it("keeps Daily, Radar, and Steam Trends artifacts buildable with empty published Lead pools", () => {
    const pools = emptyPools();
    const report = buildDailyReport({
      pools,
      rawCount: 12,
      enrichedCount: 8,
      mediaLeadCount: 3,
      reportDate: "2026-07-15",
      diagnostics: { bilibili_official_source_hits: 1 }
    });
    const radar = buildRadarReport({
      candidates: [],
      pools,
      industrySignals: [{ title: "External signal", source: "GameLook", link: "https://example.com/news" }],
      reportDate: "2026-07-15",
      capturedAt: "2026-07-15T12:00:00+08:00",
      mediaSignalToRadarItem: (item) => ({
        id: "radar_external",
        category: "行业新闻",
        title: item.title,
        source: item.source,
        link: item.link,
        captured_at: "2026-07-15T12:00:00+08:00"
      })
    });
    const steamTrends = buildSteamTrendReport({
      candidates: [],
      pools,
      reportDate: "2026-07-15",
      capturedAt: "2026-07-15T12:00:00+08:00"
    });

    assert.deepEqual(report.push_pool, []);
    assert.deepEqual(report.watch_pool, []);
    assert.deepEqual(report.drop_pool, []);
    assert.match(report.summary, /V6\.8 质量隔离/);
    assert.equal(radar.items.length, 1);
    assert.ok(steamTrends.items.length >= 8);
    assert.ok(steamTrends.market_insights.length >= 3);
    assert.ok(steamTrends.genre_signals.length >= 3);
    assert.deepEqual(steamTrends.crm_candidates, []);
  });

  it("disables only Lead-count diagnostics during quarantine", () => {
    const warnings = [];
    const result = validateDailyVolume({
      pools: emptyPools(),
      mediaSignals: Array.from({ length: 18 }, (_, index) => ({
        title: `domestic ${index}`,
        source_focus: ["domestic_sourcing"]
      })),
      mediaLeadCandidates: [],
      rawCandidateCount: 40,
      enrichedCandidateCount: 20,
      diagnostics: {
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
      },
      minReviewLeads: 18,
      minMediaLeadsWhenHealthy: 10,
      ruleVersion: RULE_VERSION,
      logger: { warn: (message) => warnings.push(message) }
    });

    assert.equal(result.ok, true);
    assert.equal(result.degraded, false);
    assert.equal(result.leadCountHealthEnabled, false);
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(warnings, []);
  });

  it("passes the real Daily contract validator with four valid artifacts and zero formal Leads", () => {
    const date = "2026-07-15";
    const capturedAt = "2026-07-15T12:00:00+08:00";
    const rootDir = mkdtempSync(path.join(tmpdir(), "crm-quality-quarantine-contract-"));
    const pools = emptyPools();
    const report = buildDailyReport({
      pools,
      rawCount: 12,
      enrichedCount: 8,
      mediaLeadCount: 3,
      reportDate: date,
      diagnostics: { bilibili_official_source_hits: 1 }
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
        excluded: 0
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
    assert.match(result.stdout, /"ok": true/);
    assert.match(result.stdout, /"push": 0/);
    assert.match(result.stdout, /"watch": 0/);
    assert.match(result.stdout, /"drop": 0/);
    assert.match(result.stdout, /"sourcing_candidates": 0/);
  });
});

function writeArtifact(rootDir, relativePath, payload) {
  const absolutePath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(payload)}\n`, "utf8");
}
