import { existsSync, readFileSync, readdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = parseArgs(process.argv.slice(2));
const reportDate = args.date ?? todayInShanghai();
const minCandidates = numberArg(args.minCandidates, 8);
const minReviewCandidates = numberArg(args.minReviewCandidates, 3);
const minRadarItems = numberArg(args.minRadarItems, 8);
const minSteamTrendItems = numberArg(args.minSteamTrendItems, 8);
const minSteamMarketInsights = numberArg(args.minSteamMarketInsights, 3);
const minSteamGenreSignals = numberArg(args.minSteamGenreSignals, 3);

const state = inspectDailyReport(reportDate, { minCandidates, minReviewCandidates, minRadarItems, minSteamTrendItems, minSteamMarketInsights, minSteamGenreSignals });

if (args.githubOutput) {
  appendGithubOutput(args.githubOutput, {
    date: reportDate,
    needs_run: String(state.needs_run),
    reasons: state.reasons.join("; ")
  });
}

console.log(JSON.stringify(state, null, 2));

if (args.fail && state.needs_run) process.exit(1);

function inspectDailyReport(date, thresholds) {
  const files = {
    report: `data/reports/${date}.json`,
    radar: `data/radar/${date}.json`,
    steam_trends: `data/steam_trends/${date}.json`
  };
  const reasons = [];
  const missing = Object.entries(files).filter(([, repoPath]) => !existsSync(path.join(rootDir, repoPath))).map(([label]) => label);
  if (missing.length) reasons.push(`missing files: ${missing.join(", ")}`);

  let report = null;
  let radar = null;
  let steamTrends = null;
  if (!missing.includes("report")) report = readJson(files.report, reasons);
  if (!missing.includes("radar")) radar = readJson(files.radar, reasons);
  if (!missing.includes("steam_trends")) steamTrends = readJson(files.steam_trends, reasons);

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
  if (report && counts.total < thresholds.minCandidates) reasons.push(`candidate count ${counts.total} below threshold ${thresholds.minCandidates}`);
  if (report && counts.review < thresholds.minReviewCandidates) reasons.push(`review candidate count ${counts.review} below threshold ${thresholds.minReviewCandidates}`);
  if (radar && counts.radar_items < thresholds.minRadarItems) reasons.push(`radar item count ${counts.radar_items} below threshold ${thresholds.minRadarItems}`);
  if (steamTrends && counts.steam_trend_items < thresholds.minSteamTrendItems) reasons.push(`steam trend item count ${counts.steam_trend_items} below threshold ${thresholds.minSteamTrendItems}`);
  if (steamTrends && counts.steam_market_insights < thresholds.minSteamMarketInsights) reasons.push(`steam market insight count ${counts.steam_market_insights} below threshold ${thresholds.minSteamMarketInsights}`);
  if (steamTrends && counts.steam_genre_signals < thresholds.minSteamGenreSignals) reasons.push(`steam genre signal count ${counts.steam_genre_signals} below threshold ${thresholds.minSteamGenreSignals}`);

  const receipts = readReceipts(date);
  const successfulReceipt = receipts.find((receipt) => receipt.status === "success" || /"synced"\s*:\s*true/.test(String(receipt.sync_response ?? "")));
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
    needs_run: reasons.length > 0,
    report_date: date,
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
    reasons
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

function readReceipts(date) {
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

function readJson(repoPath, reasons) {
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
