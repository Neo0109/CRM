// Online CRM generator v4 runtime, currently executing Sourcing Rules V6.5.
// Core principle: every output must be useful to a Bilibili BD owner.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultBilibiliProbeDiagnostics } from "./bilibili_probe.mjs";
import { buildPools } from "./online_daily_v4_decision.mjs";
import {
  dedupeByAppId,
  dedupeMediaSignals,
  normalizeText,
  normalizeUrl,
  selectDiverseMediaSignals
} from "./online_daily_v4_dedupe.mjs";
import { buildMediaLeadCandidates } from "./online_daily_v4_media_leads.mjs";
import { fetchMediaSignals } from "./online_daily_v4_media_sources.mjs";
import { recordReleaseWindowHealth } from "./online_daily_v4_source_health.mjs";
import { buildDailyReport, buildRadarReport, buildSteamTrendReport, mediaSignalToRadarItem } from "./online_daily_v4_reports.mjs";
import { buildDailyRuleConfig, loadDailyRules, validateDailyRules } from "./online_daily_v4_rules.mjs";
import { buildSteamCandidateTasks, enrichSteamCandidates, prioritizeSteamCandidatesForReview } from "./online_daily_v4_steam_source.mjs";
import { looseChineseProjectKey } from "./online_daily_v4_source_utils.mjs";
import { validateDailyVolume } from "./online_daily_v4_volume.mjs";

const rootDir = process.cwd();
const sourcingRuleVersion = "sourcing-rules-v6.5-window-hygiene";
const generatorName = "online_daily_v4_sourcing_rules_v6_5_window_hygiene";
const args = parseArgs(process.argv.slice(2));
const dailyRules = await loadDailyRules({ rootDir, rulesPath: args.rulesPath ?? args.dailyRulesPath });
validateDailyRules(dailyRules);
const ruleConfig = buildDailyRuleConfig(dailyRules);
const reportDate = args.date ?? todayInShanghai();
const capturedAt = nowInShanghaiIso();
const requestedMaxCandidates = Number(args.maxCandidates ?? 320);
const maxCandidates = Number.isFinite(requestedMaxCandidates) ? Math.min(Math.max(requestedMaxCandidates, 80), 360) : 320;
const maxSteamDetails = boundedNumber(args.maxSteamDetails, 90, 40, 160);
const minReviewLeads = boundedNumber(args.minReviewLeads, 18, 8, 48);
const minReviewBackfillScore = boundedNumber(args.minReviewBackfillScore, 18, 8, 48);
const minMediaLeadsWhenHealthy = boundedNumber(args.minMediaLeads, 10, 4, 30);
const maxBilibiliLeadAgeDays = boundedNumber(args.maxBilibiliLeadAgeDays, ruleConfig.mediaQualityGates.maxBilibiliLeadAgeDays, 14, 365);
const maxOfficialLookups = boundedNumber(args.maxOfficialLookups, 12, 0, 30);
const maxExactSteamLookups = boundedNumber(args.maxExactSteamLookups, 12, 0, 30);
const existingIndex = await readExistingProjectIndex(reportDate, args.existingIndex);
const sourcingDiagnostics = {
  rule_version: sourcingRuleVersion,
  source_failures: 0,
  media_signals_raw: 0,
  media_stale_filtered: 0,
  media_banned_filtered: 0,
  media_low_score_filtered: 0,
  media_non_product_filtered: 0,
  media_expanded_product_candidates: 0,
  media_rescue_product_candidates: 0,
  media_duplicate_filtered: 0,
  media_steam_appids_extracted: 0,
  media_released_routed_to_drop: 0,
  media_radar_only: 0,
  media_rejected: 0,
  media_exact_steam_lookup_attempts: 0,
  media_exact_steam_lookup_hits: 0,
  media_demo_parent_resolutions: 0,
  media_publisher_occupied_routed_to_radar: 0,
  steam_links_detected: 0,
  steam_evidence_materialized: 0,
  steam_demo_parent_converted: 0,
  steam_evidence_released_filtered: 0,
  steam_evidence_duplicate_merged: 0,
  steam_evidence_lost: 0,
  bilibili_official_source_lookups: 0,
  bilibili_official_source_hits: 0,
  bilibili_probe: defaultBilibiliProbeDiagnostics(),
  low_volume_warnings: []
};
const sourceContext = {
  rootDir,
  args,
  ruleConfig,
  reportDate,
  diagnostics: sourcingDiagnostics,
  maxBilibiliLeadAgeDays,
  maxOfficialLookups,
  maxExactSteamLookups,
  steamExactTitleCache: new Map()
};

const steamCandidateTasks = buildSteamCandidateTasks(sourceContext);
const rawCandidates = dedupeByAppId((await runLimited(steamCandidateTasks, 2)).flat())
  .filter((candidate) => candidate.appId && candidate.title && !isExistingSteamCandidate(candidate, existingIndex))
  .slice(0, maxCandidates);

const mediaSignals = await fetchMediaSignals(sourceContext);
const industrySignals = selectDiverseMediaSignals(dedupeMediaSignals(mediaSignals), ruleConfig.radarDiversity.limit, ruleConfig.radarDiversity);
const mediaLeadCandidates = await buildMediaLeadCandidates(mediaSignals, existingIndex, sourceContext);
const steamCandidatesForReview = prioritizeSteamCandidatesForReview(rawCandidates, sourceContext);
const enrichedCandidates = await enrichSteamCandidates(steamCandidatesForReview.slice(0, maxSteamDetails), sourceContext);
recordReleaseWindowHealth(sourcingDiagnostics, {
  steamCandidates: enrichedCandidates,
  mediaLeads: mediaLeadCandidates
});

if (!rawCandidates.length && !mediaLeadCandidates.length) {
  throw new Error("No Steam candidates or domestic media/Bilibili product leads were fetched; refusing to overwrite daily reports with an empty run.");
}

if (!enrichedCandidates.length && !mediaLeadCandidates.length) {
  throw new Error("No Steam candidates were enriched and no media/Bilibili product leads survived filtering; refusing to overwrite daily reports with an empty run.");
}

enrichedCandidates.sort((a, b) => b.score - a.score);
const pools = buildPools(enrichedCandidates, mediaLeadCandidates, { reportDate, minReviewLeads, minReviewBackfillScore });
let volumeDiagnostics;
try {
  volumeDiagnostics = validateDailyVolume({
    pools,
    mediaSignals,
    mediaLeadCandidates,
    rawCandidateCount: rawCandidates.length,
    enrichedCandidateCount: enrichedCandidates.length,
    diagnostics: sourcingDiagnostics,
    minReviewLeads,
    minMediaLeadsWhenHealthy
  });
} catch (error) {
  const failurePayload = generationFailurePayload({
    error,
    reportDate,
    capturedAt,
    rawCandidates,
    enrichedCandidates,
    industrySignals,
    mediaSignals,
    mediaLeadCandidates,
    pools,
    minReviewLeads,
    minMediaLeadsWhenHealthy,
    minReviewBackfillScore,
    sourcingDiagnostics
  });
  await writeJson(`data/runtime/${reportDate}-generation-failure.json`, failurePayload);
  console.error(JSON.stringify(failurePayload, null, 2));
  throw error;
}
sourcingDiagnostics.low_volume_warnings.push(...volumeDiagnostics.warnings);

await writeJson(`data/reports/${reportDate}.json`, buildDailyReport({
  pools,
  rawCount: rawCandidates.length,
  enrichedCount: enrichedCandidates.length,
  mediaLeadCount: mediaLeadCandidates.length,
  reportDate,
  diagnostics: sourcingDiagnostics
}));
await writeJson(`data/radar/${reportDate}.json`, buildRadarReport({
  candidates: enrichedCandidates,
  pools,
  industrySignals,
  reportDate,
  capturedAt,
  mediaSignalToRadarItem
}));
await writeJson(`data/steam_trends/${reportDate}.json`, buildSteamTrendReport({
  candidates: enrichedCandidates,
  pools,
  reportDate,
  capturedAt
}));

console.log(JSON.stringify({
  ok: true,
  generator: generatorName,
  rule_version: sourcingRuleVersion,
  report_date: reportDate,
  candidates_seen: rawCandidates.length,
  candidates_enriched: enrichedCandidates.length,
  industry_signals: industrySignals.length,
  media_signals_seen: mediaSignals.length,
  media_lead_candidates: mediaLeadCandidates.length,
  max_steam_details: maxSteamDetails,
  min_review_leads: minReviewLeads,
  min_review_backfill_score: minReviewBackfillScore,
  min_media_leads_when_healthy: minMediaLeadsWhenHealthy,
  max_bilibili_lead_age_days: maxBilibiliLeadAgeDays,
  existing_project_names: existingIndex.projects.size,
  existing_steam_app_ids: existingIndex.steamAppIds.size,
  existing_links: existingIndex.links.size,
  diagnostics: sourcingDiagnostics,
  duplicate_filtered: sourcingDiagnostics.media_duplicate_filtered,
  released_filtered: sourcingDiagnostics.media_released_routed_to_drop,
  bilibili_official_source_hits: sourcingDiagnostics.bilibili_official_source_hits,
  bilibili_probe_candidates: sourcingDiagnostics.bilibili_probe?.raw_candidates ?? 0,
  bilibili_probe_final_candidates: sourcingDiagnostics.bilibili_probe?.final_candidates ?? 0,
  final_import_candidates: pools.push.length + pools.watch.length,
  push_pool: pools.push.length,
  watch_pool: pools.watch.length,
  drop_pool: pools.drop.length,
  captured_at: capturedAt
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (const item of argv) {
    const match = item.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

async function runLimited(taskFactories, concurrency) {
  const results = new Array(taskFactories.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, taskFactories.length) }, async () => {
    while (cursor < taskFactories.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await taskFactories[index]();
    }
  });
  await Promise.all(workers);
  return results;
}

function todayInShanghai() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function nowInShanghaiIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}+08:00`;
}

async function readExistingProjectIndex(date, externalIndexPath) {
  const projects = new Set();
  const steamAppIds = new Set();
  const links = new Set();
  const keys = new Set();
  const projectLooseKeys = new Set();
  for (const reportPath of previousDatePaths(date, 45)) {
    try {
      const report = JSON.parse(await readFile(path.join(rootDir, reportPath), "utf8"));
      for (const bucket of ["push_pool", "watch_pool", "drop_pool"]) {
        for (const lead of report[bucket] ?? []) {
          addExistingProjectKeys(projects, projectLooseKeys, lead.project);
          if (lead.steam_app_id) steamAppIds.add(normalizeText(lead.steam_app_id));
          for (const link of lead.links ?? []) links.add(normalizeUrl(link));
          for (const key of automationLeadKeys(lead)) keys.add(key);
        }
      }
    } catch {}
  }

  if (externalIndexPath) {
    try {
      const external = JSON.parse(await readFile(path.resolve(rootDir, externalIndexPath), "utf8"));
      for (const project of external.projects ?? []) addExistingProjectKeys(projects, projectLooseKeys, project);
      for (const appId of external.steam_app_ids ?? []) steamAppIds.add(normalizeText(appId));
      for (const link of external.links ?? []) links.add(normalizeUrl(link));
      for (const key of external.keys ?? []) keys.add(String(key));
    } catch (error) {
      throw new Error(`Failed to load CRM dedupe index from ${externalIndexPath}: ${error.message}`);
    }
  }

  return { projects, steamAppIds, links, keys, projectLooseKeys };
}

function addExistingProjectKeys(projects, projectLooseKeys, value) {
  const normalized = normalizeText(value);
  if (normalized) projects.add(normalized);
  const looseKey = looseChineseProjectKey(value);
  if (looseKey) projectLooseKeys.add(looseKey);
}

function automationLeadKeys(lead) {
  const keys = [];
  if (lead.project) keys.push(`project:${normalizeText(lead.project)}`);
  if (lead.steam_app_id) keys.push(`steam:${normalizeText(lead.steam_app_id)}`);
  for (const link of lead.links ?? []) keys.push(`link:${normalizeUrl(link)}`);
  return keys;
}

function isExistingSteamCandidate(candidate, existingIndex) {
  return existingIndex.steamAppIds.has(normalizeText(candidate.appId)) || existingIndex.projects.has(normalizeText(candidate.title));
}

function previousDatePaths(date, days) {
  const paths = [];
  const current = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(current.getTime())) return paths;
  for (let index = 1; index <= days; index += 1) {
    const previous = new Date(current);
    previous.setUTCDate(current.getUTCDate() - index);
    paths.push(`data/reports/${previous.toISOString().slice(0, 10)}.json`);
  }
  return paths;
}

async function writeJson(relativePath, payload) {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function generationFailurePayload({
  error,
  reportDate,
  capturedAt,
  rawCandidates,
  enrichedCandidates,
  industrySignals,
  mediaSignals,
  mediaLeadCandidates,
  pools,
  minReviewLeads,
  minMediaLeadsWhenHealthy,
  minReviewBackfillScore,
  sourcingDiagnostics
}) {
  return {
    ok: false,
    failure_stage: "volume_validation",
    failure_reason: error instanceof Error ? error.message : String(error),
    report_date: reportDate,
    generator: generatorName,
    rule_version: sourcingRuleVersion,
    captured_at: capturedAt,
    candidates_seen: rawCandidates.length,
    candidates_enriched: enrichedCandidates.length,
    industry_signals: industrySignals.length,
    media_signals_seen: mediaSignals.length,
    media_lead_candidates: mediaLeadCandidates.length,
    min_review_leads: minReviewLeads,
    min_media_leads_when_healthy: minMediaLeadsWhenHealthy,
    min_review_backfill_score: minReviewBackfillScore,
    push_pool: pools.push.length,
    watch_pool: pools.watch.length,
    drop_pool: pools.drop.length,
    final_import_candidates: pools.push.length + pools.watch.length,
    volume_diagnostics: error?.volumeDiagnostics ?? null,
    diagnostics: sourcingDiagnostics
  };
}
