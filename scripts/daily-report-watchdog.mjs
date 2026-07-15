import { existsSync, readFileSync, readdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isLeadCountHealthEnabled, RULE_VERSION } from "../automations/jobs/online_daily_v4_rules.mjs";

const defaultRootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function main(argv) {
  const args = parseArgs(argv);
  const reportDate = args.date ?? todayInShanghai();
  const thresholds = {
    minCandidates: numberArg(args.minCandidates, 18),
    minReviewCandidates: numberArg(args.minReviewCandidates, 18),
    minRadarItems: numberArg(args.minRadarItems, 8),
    minSteamTrendItems: numberArg(args.minSteamTrendItems, 8),
    minSteamMarketInsights: numberArg(args.minSteamMarketInsights, 3),
    minSteamGenreSignals: numberArg(args.minSteamGenreSignals, 3)
  };
  const state = inspectDailyReport(reportDate, thresholds);

  if (args.githubOutput) {
    appendGithubOutput(args.githubOutput, {
      date: reportDate,
      needs_run: String(state.needs_run),
      reasons: state.reasons.join("; "),
      warnings: state.warnings.join("; ")
    });
  }

  console.log(JSON.stringify(state, null, 2));
  if (args.fail && state.needs_run) process.exitCode = 1;
}

export function inspectDailyReport(date, thresholds, options = {}) {
  const rootDir = options.rootDir ?? defaultRootDir;
  const ruleVersion = options.ruleVersion ?? RULE_VERSION;
  const leadCountHealthEnabled = isLeadCountHealthEnabled(ruleVersion);
  const files = {
    report: `data/reports/${date}.json`,
    radar: `data/radar/${date}.json`,
    steam_trends: `data/steam_trends/${date}.json`
  };
  const reasons = [];
  const warnings = [];
  const missing = Object.entries(files).filter(([, repoPath]) => !existsSync(path.join(rootDir, repoPath))).map(([label]) => label);
  if (missing.length) reasons.push(`missing files: ${missing.join(", ")}`);

  let report = null;
  let radar = null;
  let steamTrends = null;
  if (!missing.includes("report")) report = readJson(files.report, reasons, rootDir);
  if (!missing.includes("radar")) radar = readJson(files.radar, reasons, rootDir);
  if (!missing.includes("steam_trends")) steamTrends = readJson(files.steam_trends, reasons, rootDir);

  const counts = {
    push: report?.push_pool?.length ?? 0,
    watch: report?.watch_pool?.length ?? 0,
    drop: report?.drop_pool?.length ?? 0,
    radar_items: radar?.items?.length ?? 0,
    steam_trend_items: steamTrends?.items?.length ?? 0,
    steam_market_insights: steamTrends?.market_insights?.length ?? 0,
    steam_genre_signals: steamTrends?.genre_signals?.length ?? 0
  };
  counts.total = counts.push + counts.watch + counts.drop;
  counts.review = counts.push + counts.watch;

  if (report && report.report_date !== date) reasons.push(`report date mismatch: ${report.report_date}`);
  if (radar && radar.report_date !== date) reasons.push(`radar date mismatch: ${radar.report_date}`);
  if (steamTrends && steamTrends.report_date !== date) reasons.push(`steam trends date mismatch: ${steamTrends.report_date}`);
  if (leadCountHealthEnabled && report && counts.total < thresholds.minCandidates) warnings.push(`candidate count ${counts.total} below target ${thresholds.minCandidates}`);
  if (leadCountHealthEnabled && report && counts.review < thresholds.minReviewCandidates) warnings.push(`review candidate count ${counts.review} below target ${thresholds.minReviewCandidates}`);
  if (radar && counts.radar_items < thresholds.minRadarItems) warnings.push(`radar item count ${counts.radar_items} below target ${thresholds.minRadarItems}`);
  if (steamTrends && counts.steam_trend_items < thresholds.minSteamTrendItems) warnings.push(`steam trend item count ${counts.steam_trend_items} below target ${thresholds.minSteamTrendItems}`);
  if (steamTrends && counts.steam_market_insights < thresholds.minSteamMarketInsights) warnings.push(`steam market insight count ${counts.steam_market_insights} below target ${thresholds.minSteamMarketInsights}`);
  if (steamTrends && counts.steam_genre_signals < thresholds.minSteamGenreSignals) warnings.push(`steam genre signal count ${counts.steam_genre_signals} below target ${thresholds.minSteamGenreSignals}`);

  const receipts = readReceipts(date, rootDir);
  const successfulReceipt = receipts.find((receipt) => {
    const syncPayload = parseSyncResponse(receipt.sync_response);
    return receipt.status === "success" && syncPayload?.synced === true;
  });
  if (!successfulReceipt) reasons.push("no successful sync receipt");
  const syncPayload = successfulReceipt ? parseSyncResponse(successfulReceipt.sync_response) : null;
  const importStats = syncPayload?.import_stats ?? null;
  if (importStats) {
    counts.created_unprocessed = Number(importStats.created_unprocessed ?? 0);
    counts.visible_unprocessed = Number(importStats.visible_unprocessed ?? 0);
    counts.stale_updates = Number(importStats.stale_updates ?? 0);
    counts.updated_unprocessed_visible = Number(importStats.updated_unprocessed_visible ?? 0);
    counts.useful_unprocessed = counts.created_unprocessed + counts.visible_unprocessed + counts.updated_unprocessed_visible;
  }

  return {
    ok: reasons.length === 0,
    degraded: warnings.length > 0,
    needs_run: reasons.length > 0,
    report_date: date,
    rule_version: ruleVersion,
    lead_count_health_enabled: leadCountHealthEnabled,
    thresholds,
    counts,
    files,
    receipts: receipts.map((receipt) => ({
      file: receipt.file,
      slot: receipt.slot ?? null,
      status: receipt.status ?? null,
      attempts: receipt.attempts ?? null,
      captured_at: receipt.captured_at ?? null,
      run_url: receipt.run_url ?? null
    })),
    reasons,
    warnings
  };
}

function parseSyncResponse(value) {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readReceipts(date, rootDir) {
  const dir = path.join(rootDir, "data/automation_runs");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.startsWith(`${date}-`) && name.endsWith(".json"))
    .map((name) => {
      try {
        return { file: `data/automation_runs/${name}`, ...JSON.parse(readFileSync(path.join(dir, name), "utf8")) };
      } catch {
        return { file: `data/automation_runs/${name}`, status: "invalid_json" };
      }
    })
    .sort((a, b) => String(b.captured_at ?? "").localeCompare(String(a.captured_at ?? "")));
}

function readJson(repoPath, reasons, rootDir) {
  try {
    return JSON.parse(readFileSync(path.join(rootDir, repoPath), "utf8"));
  } catch (error) {
    reasons.push(`${repoPath} invalid JSON: ${error.message}`);
    return null;
  }
}

function appendGithubOutput(filePath, values) {
  for (const [key, value] of Object.entries(values)) {
    appendFileSync(filePath, `${key}=${String(value).replace(/\n/g, " ")}\n`);
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (const item of argv) {
    if (item === "--fail") parsed.fail = true;
    const match = item.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[toCamelCase(match[1])] = match[2];
  }
  return parsed;
}

function numberArg(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function todayInShanghai() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
