// Online CRM generator v4 runtime, currently executing Sourcing Rules V6.4.
// Core principle: every output must be useful to a Bilibili BD owner.
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { collectBilibiliProbeSignals, defaultBilibiliProbeDiagnostics } from "./bilibili_probe.mjs";
import {
  choosePreferredBilibiliSignal,
  deriveMediaDecisionFields,
  formatMediaGameplay,
  formatMediaProgress,
  normalizeMediaLinks as normalizeMediaLinksV63,
  steamAppIdFromLinks as steamAppIdFromLinksV63
} from "./sourcing_v6_3_quality.mjs";
import { buildPools, scoreCandidate } from "./online_daily_v4_decision.mjs";
import {
  dedupeByAppId,
  dedupeMediaSignals,
  isBilibiliSignal,
  normalizeDisplayText,
  normalizeText,
  normalizeUrl,
  selectDiverseMediaSignals,
  sourceTaggedItem,
  topicScore
} from "./online_daily_v4_dedupe.mjs";
import { buildDailyReport, buildRadarReport, buildSteamTrendReport, mediaSignalToRadarItem } from "./online_daily_v4_reports.mjs";
import { validateDailyVolume } from "./online_daily_v4_volume.mjs";

const rootDir = process.cwd();
const sourcingRuleVersion = "sourcing-rules-v6.4-bili-probe";
const generatorName = "online_daily_v4_sourcing_rules_v6_4_bili_probe";
const execFile = promisify(execFileCallback);
const args = parseArgs(process.argv.slice(2));
const reportDate = args.date ?? todayInShanghai();
const capturedAt = nowInShanghaiIso();
const requestedMaxCandidates = Number(args.maxCandidates ?? 320);
const maxCandidates = Number.isFinite(requestedMaxCandidates) ? Math.min(Math.max(requestedMaxCandidates, 80), 360) : 320;
const maxSteamDetails = boundedNumber(args.maxSteamDetails, 90, 40, 160);
const minReviewLeads = boundedNumber(args.minReviewLeads, 18, 8, 48);
const minReviewBackfillScore = boundedNumber(args.minReviewBackfillScore, 18, 8, 48);
const minMediaLeadsWhenHealthy = boundedNumber(args.minMediaLeads, 10, 4, 30);
const maxBilibiliLeadAgeDays = boundedNumber(args.maxBilibiliLeadAgeDays, 120, 14, 365);
const maxOfficialLookups = boundedNumber(args.maxOfficialLookups, 12, 0, 30);
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
  bilibili_official_source_lookups: 0,
  bilibili_official_source_hits: 0,
  bilibili_probe: defaultBilibiliProbeDiagnostics(),
  low_volume_warnings: []
};

const steamCandidateTasks = [
  () => fetchSteamSearch("popularcomingsoon", "Steam CN Domestic Demo Keyword", [], { cc: "cn", l: "schinese", domesticLens: true, query: "国产 Demo" }),
  () => fetchSteamSearch("popularcomingsoon", "Steam CN Indie Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "国产 独立游戏" }),
  () => fetchSteamSearch("popularcomingsoon", "Steam CN China Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "中国" }),
  () => fetchSteamSearch("popularcomingsoon", "Steam CN Guofeng Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "国风" }),
  () => fetchSteamSearch("popularcomingsoon", "Steam CN Deckbuilder Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "卡牌 构筑" }),
  () => fetchSteamSearch("popularcomingsoon", "Steam CN Roguelike Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "肉鸽" }),
  () => fetchSteamSearch("popularcomingsoon", "Steam CN Management Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "模拟经营" }),
  () => fetchSteamSearch("popularcomingsoon", "Steam CN Popular Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true }),
  () => fetchSteamSearch("popularcomingsoon", "Steam CN Demo/Next Fest Window", [21], { cc: "cn", l: "schinese", domesticLens: true }),
  () => fetchSteamSearch("popularcomingsoon", "Steam CN Strategy Upcoming", [9], { cc: "cn", l: "schinese", domesticLens: true }),
  () => fetchSteamSearch("popularcomingsoon", "Steam CN Simulation Upcoming", [599], { cc: "cn", l: "schinese", domesticLens: true }),
  () => fetchSteamSearch("popularcomingsoon", "Steam CN Roguelike Upcoming", [1716], { cc: "cn", l: "schinese", domesticLens: true }),
  () => fetchSteamSearch("popularcomingsoon", "Steam CN Deckbuilder Upcoming", [32322], { cc: "cn", l: "schinese", domesticLens: true }),
  () => fetchSteamSearch("popularcomingsoon", "Steam Popular Upcoming"),
  () => fetchSteamSearch("popularcomingsoon", "Steam Demo/Next Fest Window", [21]),
  () => fetchSteamSearch("popularcomingsoon", "Strategy Upcoming", [9]),
  () => fetchSteamSearch("popularcomingsoon", "Simulation Upcoming", [599]),
  () => fetchSteamSearch("popularcomingsoon", "Roguelike Upcoming", [1716]),
  () => fetchSteamSearch("popularcomingsoon", "Deckbuilder Upcoming", [32322]),
  () => fetchFeaturedCategories()
];

const rawCandidates = dedupeByAppId((await runLimited(steamCandidateTasks, 2)).flat())
  .filter((candidate) => candidate.appId && candidate.title && !isExistingSteamCandidate(candidate, existingIndex))
  .slice(0, maxCandidates);

const mediaSignals = await fetchMediaSignals();
const industrySignals = selectDiverseMediaSignals(dedupeMediaSignals(mediaSignals), 14);
const mediaLeadCandidates = await buildMediaLeadCandidates(mediaSignals, existingIndex);

const enrichedCandidates = await enrichCandidates(rawCandidates.slice(0, maxSteamDetails));

if (!rawCandidates.length && !mediaLeadCandidates.length) {
  throw new Error("No Steam candidates or domestic media/Bilibili product leads were fetched; refusing to overwrite daily reports with an empty run.");
}

if (!enrichedCandidates.length && !mediaLeadCandidates.length) {
  throw new Error("No Steam candidates were enriched and no media/Bilibili product leads survived filtering; refusing to overwrite daily reports with an empty run.");
}

enrichedCandidates.sort((a, b) => b.score - a.score);
const pools = buildPools(enrichedCandidates, mediaLeadCandidates, { reportDate, minReviewLeads, minReviewBackfillScore });
const volumeDiagnostics = validateDailyVolume({
  pools,
  mediaSignals,
  mediaLeadCandidates,
  rawCandidateCount: rawCandidates.length,
  enrichedCandidateCount: enrichedCandidates.length,
  diagnostics: sourcingDiagnostics,
  minReviewLeads,
  minMediaLeadsWhenHealthy
});
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

async function fetchSteamSearch(filter, source, tags = [], options = {}) {
  const cc = options.cc ?? "us";
  const language = options.l ?? "english";
  const query = options.query ?? "";
  const resultUrl = new URL("https://store.steampowered.com/search/results/");
  resultUrl.searchParams.set("start", "0");
  resultUrl.searchParams.set("count", "50");
  resultUrl.searchParams.set("dynamic_data", "");
  resultUrl.searchParams.set("infinite", "1");
  resultUrl.searchParams.set("filter", filter);
  resultUrl.searchParams.set("category1", "998");
  resultUrl.searchParams.set("os", "win");
  resultUrl.searchParams.set("cc", cc);
  resultUrl.searchParams.set("l", language);
  if (query) resultUrl.searchParams.set("term", query);
  if (tags.length) resultUrl.searchParams.set("tags", tags.join(","));

  const pageUrl = new URL("https://store.steampowered.com/search/");
  if (query) pageUrl.searchParams.set("term", query);
  pageUrl.searchParams.set("filter", filter);
  pageUrl.searchParams.set("category1", "998");
  pageUrl.searchParams.set("os", "win");
  pageUrl.searchParams.set("cc", cc);
  pageUrl.searchParams.set("l", language);
  if (tags.length) pageUrl.searchParams.set("tags", tags.join(","));

  try {
    const text = await fetchText(resultUrl.toString(), 12000, "application/json,text/html;q=0.9,*/*;q=0.8");
    const parsed = tagSearchCandidates(parseSteamSearchHtml(parseMaybeJsonHtml(text), source), options);
    if (parsed.length) return parsed;
    return tagSearchCandidates(parseSteamSearchHtml(await fetchText(pageUrl.toString(), 12000, "text/html,*/*;q=0.8"), source), options);
  } catch (error) {
    console.warn(`Steam search failed for ${source}: ${error.message}`);
    return [];
  }
}

function tagSearchCandidates(items, options) {
  return items.map((item) => ({
    ...item,
    domesticLens: Boolean(options.domesticLens),
    domesticQuery: Boolean(options.domesticQuery ?? isDomesticDiscoveryQuery(options.query ?? ""))
  }));
}

function parseMaybeJsonHtml(text) {
  try {
    const payload = JSON.parse(text);
    return payload.results_html ?? payload.html ?? text;
  } catch {
    return text;
  }
}

function parseSteamSearchHtml(html, source) {
  return String(html).split(/<a\s+/i).slice(1).map((chunk) => `<a ${chunk}`).map((chunk, index) => {
    const appId = chunk.match(/data-ds-appid=["']\[?(\d+)/i)?.[1] ?? chunk.match(/\/app\/(\d+)\//)?.[1] ?? null;
    const rawTitle = chunk.match(/<span[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]
      ?? chunk.match(/title=["']([^"']+)["']/i)?.[1]
      ?? "";
    const title = decodeHtml(stripTags(rawTitle)).trim();
    const release = decodeHtml(stripTags(chunk.match(/search_released[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "")).trim();
    const reviewText = decodeHtml(stripTags(chunk.match(/search_reviewscore[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "")).trim();
    const tags = [...chunk.matchAll(/<span[^>]*class=["'][^"']*top_tag[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)].map((match) => decodeHtml(stripTags(match[1])).trim()).filter(Boolean);
    if (!appId || !title) return null;
    return { appId: String(appId), title, release, reviewText, tags, source, sourceIndex: index, href: `https://store.steampowered.com/app/${appId}/` };
  }).filter(Boolean);
}

async function fetchFeaturedCategories() {
  try {
    const payload = await fetchJson("https://store.steampowered.com/api/featuredcategories?cc=us&l=english");
    return [["Featured Coming Soon", payload.coming_soon?.items], ["Featured New Releases Context", payload.new_releases?.items], ["Featured Top Sellers Context", payload.top_sellers?.items]]
      .flatMap(([source, items]) => (items ?? []).map((item, index) => ({
        appId: String(item.id ?? ""),
        title: item.name,
        release: source.includes("Coming") ? "Coming soon" : "",
        reviewText: "",
        tags: [],
        source,
        sourceIndex: index,
        href: `https://store.steampowered.com/app/${item.id}/`
      })).filter((item) => item.appId && item.title));
  } catch (error) {
    console.warn(`Steam featured categories failed: ${error.message}`);
    return [];
  }
}

async function fetchAppDetails(appId) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const payload = await fetchJson(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=english`);
      const entry = payload[String(appId)];
      return entry?.success && entry.data?.type === "game" ? entry.data : null;
    } catch (error) {
      if (attempt < 3 && /429|too many requests/i.test(error.message)) {
        await sleep(2500 * attempt);
        continue;
      }
      console.warn(`AppDetails failed for ${appId}: ${error.message}`);
      return null;
    }
  }
  return null;
}

async function enrichCandidates(candidates) {
  const enriched = [];
  const concurrency = 2;
  for (let index = 0; index < candidates.length; index += concurrency) {
    const chunk = candidates.slice(index, index + concurrency);
    const results = await Promise.all(chunk.map(async (candidate) => {
      const details = await fetchAppDetails(candidate.appId);
      return enrichCandidate(candidate, details);
    }));
    enriched.push(...results);
    if (index + concurrency < candidates.length) await sleep(1200);
  }
  return enriched;
}

async function enrichCandidate(candidate, details) {
  const developers = Array.isArray(details?.developers) ? details.developers : [];
  const publishers = Array.isArray(details?.publishers) ? details.publishers : [];
  const genres = [...new Set([...(details?.genres ?? []).map((genre) => genre.description), ...(candidate.tags ?? [])].filter(Boolean))].slice(0, 6);
  const categories = (details?.categories ?? []).map((category) => category.description).slice(0, 8);
  const text = [candidate.title, details?.name, details?.short_description, ...developers, ...publishers, ...genres, ...categories].join(" ");
  const lower = text.toLowerCase();
  const releaseDate = normalizeReleaseDate(details?.release_date?.date ?? candidate.release);
  const daysToRelease = daysUntil(releaseDate);
  const alreadyReleased = typeof daysToRelease === "number" && daysToRelease < 0;
  const releaseTooSoon = typeof daysToRelease === "number" && daysToRelease >= 0 && daysToRelease < 60;
  const comingSoon = Boolean(details?.release_date?.coming_soon) || /coming soon|tba|to be announced/i.test(candidate.release ?? "");
  const hasDemoSignal = /demo|next fest|试玩|新品节/i.test(`${candidate.source} ${candidate.release} ${text}`) || Boolean(details?.demos?.length);
  const earlyAccess = /early access|抢先体验/i.test(text);
  const narrativeHeavy = isNarrativeHeavy(lower, genres);
  const indiaTeam = /india|indian studio|bengaluru|bangalore|mumbai|pune|hyderabad|chennai/i.test(text);
  const strongGameplay = /co-op|multiplayer|strategy|simulation|management|automation|base building|colony|roguelike|deckbuilder|tactical|sandbox|survival|crafting|city builder|card game|tower defense|factory|physics|合作|多人|策略|模拟|经营|自动化|基地|殖民|城市|肉鸽|类Rogue|卡牌|构筑|战棋|沙盒|生存|建造|塔防|工厂|物理/i.test(lower);
  const highVisual = (details?.screenshots?.length ?? 0) >= 4 || (details?.movies?.length ?? 0) > 0;
  const publisherOccupied = hasMaturePublisher(publishers);
  const localizedTitleSignal = candidate.domesticLens && !candidate.domesticQuery ? "" : candidate.title;
  const domestic = looksDomestic([localizedTitleSignal, details?.name, ...developers, ...publishers, details?.website].join(" "));
  const strongData = hasStrongPublicData(candidate.reviewText, candidate.source, details);
  const validatedPcHit = hasValidatedPcHit(candidate.reviewText, details);
  const mobileAdaptationPotential = hasMobileAdaptationPotential(text, genres, categories);
  const contactMethods = await collectContactMethods(details, candidate.appId);
  const score = scoreCandidate({ source: candidate.source, domestic, domesticLens: Boolean(candidate.domesticLens), domesticQuery: Boolean(candidate.domesticQuery), hasDemoSignal, strongGameplay, highVisual, strongData, validatedPcHit, mobileAdaptationPotential, alreadyReleased, releaseTooSoon, earlyAccess, narrativeHeavy, indiaTeam, publisherOccupied, comingSoon, hasDetails: Boolean(details), contactCount: contactMethods.length });

  return {
    appId: candidate.appId,
    title: details?.name ?? candidate.title,
    source: candidate.source,
    storeUrl: `https://store.steampowered.com/app/${candidate.appId}/`,
    steamDbUrl: `https://steamdb.info/app/${candidate.appId}/`,
    developers,
    publishers,
    country: domestic ? "中国（待确认）" : "海外",
    region: domestic ? "中国" : "海外",
    genres,
    categories,
    shortDescription: details?.short_description ?? "",
    releaseDate: releaseDate ?? candidate.release ?? "待确认",
    daysToRelease,
    alreadyReleased,
    comingSoon,
    hasDemoSignal,
    earlyAccess,
    narrativeHeavy,
    indiaTeam,
    strongGameplay,
    highVisual,
    strongData,
    validatedPcHit,
    mobileAdaptationPotential,
    publisherOccupied,
    contactMethods,
    website: details?.website ?? null,
    hasDetails: Boolean(details),
    recommendationCount: details?.recommendations?.total ?? 0,
    screenshotCount: details?.screenshots?.length ?? 0,
    movieCount: details?.movies?.length ?? 0,
    reviewText: candidate.reviewText ?? "",
    domesticQuery: Boolean(candidate.domesticQuery),
    releaseTooSoon,
    score
  };
}

function isNarrativeHeavy(lowerText, genres) {
  const genreText = genres.join(" ").toLowerCase();
  if (/visual novel|interactive fiction|story rich|narrative|walking simulator|视觉小说|文字冒险|互动小说|剧情向|叙事/.test(lowerText)) return true;
  if (/jrpg|adventure/.test(genreText) && /story|legend|novel|chapter|dialogue|romance|mystery/.test(lowerText) && !/deckbuilder|strategy|simulation|management|co-op|multiplayer|roguelike|sandbox|survival/.test(lowerText)) return true;
  return false;
}

function hasStrongPublicData(reviewText, source, details) {
  const text = `${reviewText ?? ""} ${source ?? ""}`.toLowerCase();
  if (/very positive|overwhelmingly positive|好评如潮|特别好评|wishlist|愿望单/.test(text)) return true;
  if ((details?.recommendations?.total ?? 0) >= 500) return true;
  return false;
}

function hasValidatedPcHit(reviewText, details) {
  const recommendations = details?.recommendations?.total ?? 0;
  const text = `${reviewText ?? ""} ${details?.name ?? ""} ${details?.short_description ?? ""}`.toLowerCase();
  if (recommendations >= 5000) return true;
  if (recommendations >= 1500 && /very positive|overwhelmingly positive|好评如潮|特别好评/.test(text)) return true;
  if (/overwhelmingly positive|好评如潮/.test(text)) return true;
  return false;
}

function hasMobileAdaptationPotential(text, genres, categories) {
  const joined = `${text} ${genres.join(" ")} ${categories.join(" ")}`.toLowerCase();
  return /card|deckbuilder|turn[- ]?based|strategy|simulation|management|tycoon|puzzle|idle|roguelike|tactical|auto battler|tower defense|city builder|colony|survivors-like|卡牌|构筑|回合|策略|模拟|经营|放置|肉鸽|塔防|战棋|自走棋/.test(joined);
}

async function collectContactMethods(details, appId) {
  const methods = [];
  const support = details?.support_info ?? {};
  const website = firstRealWebsite(details?.website, support.url);
  addContact(methods, "Email", support.email, "Steam support email");
  addContact(methods, "官网", website, "Steam official website");
  if (support.url !== website) addContact(methods, "官网", support.url, "Steam support URL");

  if (website) {
    for (const method of await contactsFromWebsite(website)) addContact(methods, method.type, method.value, method.note);
  }

  addContact(methods, "Steam", `https://steamcommunity.com/app/${appId}/discussions/`, methods.length ? "Steam community backup" : "Official Steam community fallback");
  return methods.slice(0, 4);
}

async function contactsFromWebsite(website) {
  try {
    const html = await fetchText(website, 7000, "text/html,*/*;q=0.8");
    const methods = [];
    const mailto = decodeHtml(String(html).match(/mailto:([^"'?#>\s]+)/i)?.[1] ?? "");
    const plainEmail = String(html).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
    addContact(methods, "Email", mailto || plainEmail, "Found on official site");
    for (const [type, pattern] of [
      ["Discord", /https?:\/\/(?:www\.)?(?:discord\.gg|discord\.com\/invite)\/[^"'<>\s]+/i],
      ["X/Twitter", /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^"'<>\s]+/i],
      ["B站", /https?:\/\/(?:space\.)?bilibili\.com\/[^"'<>\s]+/i]
    ]) {
      const value = String(html).match(pattern)?.[0];
      addContact(methods, type, value, "Found on official site");
    }
    return methods;
  } catch {
    return [];
  }
}

function firstRealWebsite(...values) {
  return values.find((value) => value && /^https?:\/\//i.test(value) && !isSteamStoreLike(value)) ?? null;
}

function isSteamStoreLike(value) {
  return /(?:store\.steampowered\.com|steamdb\.info)\/app\/\d+/i.test(String(value));
}

function addContact(methods, type, value, note) {
  const cleanValue = typeof value === "string" ? value.trim() : "";
  if (!cleanValue || isSteamStoreLike(cleanValue)) return;
  const key = normalizeUrl(cleanValue);
  if (methods.some((method) => normalizeUrl(method.value) === key)) return;
  methods.push({ type, value: cleanValue, note });
}

async function buildMediaLeadCandidates(items, existingIndex) {
  const sourceCount = new Map();
  const dedupedItems = dedupeMediaSignals(items);
  const strictSourceItems = dedupedItems.filter(isProductSourcingSignal);
  const strictLeadCandidates = strictSourceItems
    .filter(isProductSourcingSignal)
    .map((item) => mediaSignalToLead(item, "strict"))
    .sort((a, b) => (b.media_score ?? 0) - (a.media_score ?? 0));
  const strictLeads = strictLeadCandidates.filter((lead) => isNewMediaLead(lead, existingIndex, { beforeSteamEnrichment: true }));
  sourcingDiagnostics.media_duplicate_filtered += strictLeadCandidates.length - strictLeads.length;

  const expandedSourceItems = dedupedItems
    .filter((item) => !isProductSourcingSignal(item) && isExpandedDomesticProductSignal(item))
    .slice(0, 48);
  sourcingDiagnostics.media_expanded_product_candidates += expandedSourceItems.length;
  const expandedLeadCandidates = expandedSourceItems
    .map((item) => mediaSignalToLead(item, "expanded"))
    .sort((a, b) => (b.media_score ?? 0) - (a.media_score ?? 0));
  const expandedLeads = expandedLeadCandidates.filter((lead) => isNewMediaLead(lead, existingIndex, { beforeSteamEnrichment: true }));
  sourcingDiagnostics.media_duplicate_filtered += expandedLeadCandidates.length - expandedLeads.length;

  const rescueSourceItems = dedupedItems
    .filter((item) => !strictSourceItems.includes(item) && !expandedSourceItems.includes(item) && isDomesticMediaRescueSignal(item))
    .slice(0, 64);
  sourcingDiagnostics.media_rescue_product_candidates += rescueSourceItems.length;
  const rescueLeadCandidates = rescueSourceItems
    .map((item) => mediaSignalToLead(item, "rescue"))
    .sort((a, b) => (b.media_score ?? 0) - (a.media_score ?? 0));
  const rescueLeads = rescueLeadCandidates.filter((lead) => isNewMediaLead(lead, existingIndex, { beforeSteamEnrichment: true }));
  sourcingDiagnostics.media_duplicate_filtered += rescueLeadCandidates.length - rescueLeads.length;

  const sourceCandidateItems = new Set([...strictSourceItems, ...expandedSourceItems, ...rescueSourceItems]);
  sourcingDiagnostics.media_non_product_filtered += dedupedItems.length - sourceCandidateItems.size;

  const verifiedCandidates = await enrichMediaLeadsWithSteamContext([...strictLeads, ...expandedLeads, ...rescueLeads]);
  const verifiedLeads = verifiedCandidates.filter((lead) => isNewMediaLead(lead, existingIndex));
  sourcingDiagnostics.media_duplicate_filtered += verifiedCandidates.length - verifiedLeads.length;
  const selected = selectBalancedMediaLeadCandidates(verifiedLeads, sourceCount, 30);
  return selected;
}

function selectBalancedMediaLeadCandidates(leads, sourceCount, limit) {
  const selected = [];
  for (const lead of leads) {
    const source = lead.public_signals?.split(" / ")[0] ?? "unknown";
    if ((sourceCount.get(source) ?? 0) >= 5) continue;
    selected.push(lead);
    sourceCount.set(source, (sourceCount.get(source) ?? 0) + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}

function isNewMediaLead(lead, existingIndex, options = {}) {
  if (!lead.project) return false;
  const projectKey = normalizeText(lead.project);
  if (!projectKey || existingIndex.projects.has(projectKey)) return false;
  const looseKey = looseChineseProjectKey(lead.project);
  if (looseKey && existingIndex.projectLooseKeys.has(looseKey)) return false;
  if (isUnusableMediaProjectName(lead.project) && !(options.beforeSteamEnrichment && lead.steam_app_id)) return false;
  if (isGenericMediaProjectName(lead.project) && !hasStrongMediaLeadEvidence(lead) && !(options.beforeSteamEnrichment && lead.steam_app_id)) return false;
  if (lead.steam_app_id && existingIndex.steamAppIds.has(normalizeText(lead.steam_app_id))) return false;
  for (const link of lead.links ?? []) {
    const normalizedLink = normalizeUrl(link);
    if (existingIndex.links.has(normalizedLink)) return false;
    if (existingIndex.keys.has(`link:${normalizedLink}`)) return false;
  }
  for (const key of automationLeadKeys(lead)) {
    if (existingIndex.keys.has(key)) return false;
  }
  if (/^(媒体|b站|今日亮点|行业新闻|国产游戏|独立游戏|游戏|steam|demo|pv|实机|试玩|新作|上线|公布|预告)$/i.test(projectKey)) return false;
  return true;
}

function isGenericMediaProjectName(value) {
  const text = normalizeDisplayText(value);
  const key = normalizeText(text);
  if (!key) return true;
  if (/^[0-9A-Za-z]{1,4}$/.test(text)) return true;
  if (/^(媒体|b站|今日亮点|行业新闻|国产游戏|独立游戏|游戏|steam|demo|pv|实机|试玩|新作|上线|公布|预告|推荐|盘点)$/i.test(key)) return true;
  return false;
}

function isUnusableMediaProjectName(value) {
  const text = normalizeDisplayText(value);
  const key = normalizeText(text);
  if (/^(undefined|null|untitled|unknown)$/i.test(text)) return true;
  if (/开发日志|playtest|试玩彩蛋|加入了试玩|更新了试玩|更新了测试|主线|版本更新|资料片|黑神话|诡秘之主|人间地狱/i.test(text)) return true;
  if (/^(国产|国人|独立游戏|游戏)\s*(demo|试玩|实机|pv|公开测试|开发日志)/i.test(text)) return true;
  if (/^(demo|试玩|实机|pv|公开测试|测试)\s*(上线|更新|发布|开放)/i.test(text)) return true;
  if (key.length <= 1) return true;
  return false;
}

function hasStrongMediaLeadEvidence(lead) {
  const text = `${lead.public_signals ?? ""} ${(lead.links ?? []).join(" ")} ${(lead.contact_methods ?? []).map((item) => item?.value).join(" ")}`;
  if (/store\.steampowered\.com\/app\/\d+|taptap|indienova|好游快爆|游戏官网|官网/i.test(text)) return true;
  return Boolean(lead._officialSourceMatched);
}

function isProductSourcingSignal(item) {
  const focus = new Set(item.source_focus ?? []);
  const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  const title = normalizeDisplayText(item.title);
  const isBilibili = isBilibiliSignal(item);
  const hasUsefulSource = focus.has("domestic_sourcing") || focus.has("bilibili") || (focus.has("china") && (focus.has("product") || focus.has("indie") || focus.has("mobile")));
  if (!hasUsefulSource) return false;
  if (/招聘|岗位|财报|收入|销量榜|折扣|促销|史低|攻略|教程|如何报名|报名steam新品节|愿望单经验|曝光量|经验分享|开发经验|开发教程|cosplay|壁纸|周边|赛事战报|补丁说明|停服|维护|安卓|android|pixel|iphone|手机也能升|主机情报|次世代|硬件|显卡|处理器|大会|峰会|获奖名单|招聘|财报|流水|营收/i.test(text)) return false;
  if (isNonLeadMediaTopicText(text)) return false;
  if (/视觉小说|galgame|恋爱模拟|纯剧情|互动小说/i.test(text)) return false;

  const hasQuotedName = /《[^》]{2,48}》/.test(item.title);
  const hasConcreteMarker = hasConcreteMediaProductMarker(item);
  const hasBilibiliProjectShape = isBilibili
    && !hasQuotedName
    && hasConcreteMarker
    && title.length >= 2
    && title.length <= 34
    && /^[A-Za-z0-9\u4e00-\u9fff][A-Za-z0-9\u4e00-\u9fff:'’&.\-\s]+$/.test(title)
    && !/steam|demo|新品节|愿望单|曝光|免费|分享|数据|教程|报名|开发日志|制作人|开发者|自学|课程|指南|经验/i.test(title);
  const hasProductName = hasQuotedName || hasBilibiliProjectShape;
  const domesticCompanySignal = /网易|腾讯|字节|朝夕光年|巨人|西山居|莉莉丝|心动|鹰角|米哈游|散爆|库洛|叠纸|沐瞳|灵犀|祖龙|完美世界|中手游|B站游戏|哔哩哔哩游戏/i.test(text);
  const domesticTextSignal = /国产|国人|华人|中国团队|国内团队|国内开发|版号|过审|获批|独立游戏|开发日志|taptap|好游快爆|indienova|国风|武侠|修仙|山海|二次元|小游戏|手游/.test(text);
  const domesticSourceSignal = focus.has("domestic_sourcing") && /版号|过审|获批|首曝|国产|国内|中国|中式|国风|武侠|修仙|山海|二次元|小游戏|手游/.test(text);
  const hasDomesticLeadContext = isBilibili || domesticTextSignal || domesticCompanySignal || domesticSourceSignal;
  const hasDiscoverySignal = /新作|首曝|公布|发布|上线|定档|测试|试玩|demo|实机|pv|预告|steam|taptap|好游快爆|开发者|制作人|愿望单|商店页|b站|bilibili|版号|过审|获批|预约|肉鸽|卡牌|策略|模拟|经营|二次元|国风|武侠|修仙/i.test(text);
  const hasActionableFormat = /demo|试玩|测试|实机|pv|预告|商店页|愿望单|开发者|制作人|上线steam|开启预约|首曝|公布|版号|过审|获批|预约/i.test(text);
  return hasProductName && hasDomesticLeadContext && hasDiscoverySignal && hasActionableFormat;
}

function isExpandedDomesticProductSignal(item) {
  const focus = new Set(item.source_focus ?? []);
  const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  const title = normalizeDisplayText(item.title);
  const domesticSource = focus.has("domestic_sourcing") || focus.has("bilibili") || focus.has("china");
  if (!domesticSource) return false;
  if (isLowInformationMediaTitle(item.title)) return false;
  if (isBannedMediaLeadText(text)) return false;
  if (isNonLeadMediaTopicText(text)) return false;
  if (/视觉小说|galgame|恋爱模拟|纯剧情|互动小说/i.test(text)) return false;

  const quoted = /《[^》]{2,48}》/.test(item.title);
  const concreteMarker = hasConcreteMediaProductMarker(item);
  const hasDomesticContext = /国产|国人|华人|中国团队|国内团队|国内开发|版号|过审|获批|独立游戏|开发日志|taptap|好游快爆|indienova|国风|武侠|修仙|山海|二次元|小游戏|手游|b站|bilibili|哔哩哔哩/.test(text) || isBilibiliSignal(item);
  const hasActionableProductMoment = /新作|首曝|公布|发布|上线|定档|测试|试玩|demo|实机|pv|预告|steam|taptap|好游快爆|开发者|制作人|愿望单|商店页|b站|bilibili|版号|过审|获批|预约|肉鸽|卡牌|策略|模拟|经营|二次元|国风|武侠|修仙/i.test(text);
  const titleLooksLikeConcreteProject = title.length >= 4
    && title.length <= 80
    && !/^(更多|首页|新闻|资讯|专题|视频|搜索|登录|注册|投稿|广告|榜单|盘点|合集|周报|月报)$/i.test(title)
    && !/教程|经验|报名|指南|课程|盘点|榜单|数据分享|开发经验|愿望单增长|steam新品节报名/i.test(title)
    && !looksLikeCommentaryVideoTitle(title);

  return hasDomesticContext && hasActionableProductMoment && (quoted || (concreteMarker && titleLooksLikeConcreteProject));
}

function isDomesticMediaRescueSignal(item) {
  const focus = new Set(item.source_focus ?? []);
  const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  const title = normalizeDisplayText(item.title);
  const domesticSource = focus.has("domestic_sourcing") || focus.has("bilibili") || focus.has("china");
  if (!domesticSource) return false;
  if (isLowInformationMediaTitle(item.title)) return false;
  if (isBannedMediaLeadText(text) && !isOfficialOrDeveloperBilibiliSignal(item)) return false;
  if (isNonLeadMediaTopicText(text)) return false;
  if (/视觉小说|galgame|恋爱模拟|纯剧情|互动小说/i.test(text)) return false;
  if (hasAlreadyReleasedMediaText(text)) return false;

  const hasProjectShape = /《[^》]{2,48}》/.test(text) || hasConcreteMediaProductMarker(item);
  const hasActionableSignal = /demo|试玩|测试|实机|pv|预告|商店页|愿望单|steam|taptap|好游快爆|indienova|官网|开发日志|开发者|制作人|预约|版号|过审|获批/i.test(text);
  const hasDomesticProductContext = /国产|国人|华人|中国团队|国内团队|国内开发|独立游戏|国风|武侠|修仙|山海|二次元|小游戏|手游|肉鸽|卡牌|策略|模拟|经营|塔防|战棋/i.test(text);
  const titleIsUsable = title.length >= 4 && title.length <= 96 && !looksLikeCommentaryVideoTitle(title);
  return hasProjectShape && hasActionableSignal && titleIsUsable && (hasDomesticProductContext || isOfficialOrDeveloperBilibiliSignal(item));
}

function isOfficialOrDeveloperBilibiliSignal(item) {
  if (!isBilibiliSignal(item)) return false;
  const text = `${item.title ?? ""} ${item.summary ?? ""} ${item.source ?? ""}`;
  const author = bilibiliAuthor(item);
  if (/官方|开发者|制作组|工作室|studio|games|发行商|开发日志/i.test(author)) return true;
  if (/官方号|官方PV|官方\s*PV|开发者|制作组|工作室|studio|games|发行商|开发日志/i.test(text)) return true;
  if (/store\.steampowered\.com\/app\/\d+|steam商店页|官网|taptap|好游快爆|indienova/i.test(text)) return true;
  return false;
}

function isNonLeadMediaTopicText(text) {
  return /gdc|趋势报告|行业报告|市场报告|白皮书|财报|主线|版本更新|大版本|赛季|联动|周年|资料片|dlc|第二章|第三章|黑神话|游科|诡秘之主|人间地狱|锐评|逐帧|reaction|反应/i.test(text);
}

function isBannedMediaLeadText(text) {
  const bannedPatterns = [
    /招聘|岗位|财报|收入|销量榜|折扣|促销|史低|攻略|教程|如何报名|报名steam新品节|愿望单经验|曝光量|经验分享|开发经验|开发教程/i,
    /cosplay|壁纸|周边|赛事战报|补丁说明|停服|维护|android|pixel|iphone|手机也能升|主机情报|次世代|硬件|显卡|处理器|大会|峰会|获奖名单|流水|营收/i,
    /手游推荐|游戏推荐|必玩|好玩到爆|盘点|合集|几款|十款|\d+\s*款|锐评|吐槽/i,
    /黑神话：悟空|黑神话钟馗|诡秘之主|蔚蓝档案|galgame|国gal|恋爱模拟|致郁系|情书|我在b站做|占比百分之/i
  ];
  return bannedPatterns.some((pattern) => pattern.test(text));
}

function hasConcreteMediaProductMarker(item) {
  const text = `${item.title ?? ""} ${item.summary ?? ""} ${item.source ?? ""}`;
  const author = bilibiliAuthor(item);
  if (/《[^》]{2,48}》/.test(text)) return true;
  if (/store\.steampowered\.com\/app\/\d+|steam商店页|steam页面|愿望单|taptap|好游快爆|indienova|官网|qq群|qq\s*群|discord/i.test(text)) return true;
  if (/官方|开发者|制作组|工作室|studio|games|发行商|开发日志/i.test(`${author} ${text}`)) return true;
  return false;
}

function looksLikeCommentaryVideoTitle(title) {
  const text = normalizeDisplayText(title);
  if (/看完|看了|感觉|值不值得|到底|如何评价|锐评|吐槽|试玩了一下|实况|片段|少量实机|最新pv|新pv|pv片段|预告片反应|reaction/i.test(text)) return true;
  if (/^[^《》]{8,80}[，,！!？?][^《》]{4,80}$/.test(text)) return true;
  return false;
}

async function enrichMediaLeadsWithSteamContext(leads) {
  const enriched = [];
  const chunkSize = 2;
  for (let index = 0; index < leads.length; index += chunkSize) {
    const chunk = leads.slice(index, index + chunkSize);
    const results = await Promise.all(chunk.map(enrichMediaLeadWithSteamContext));
    enriched.push(...results);
    if (index + chunkSize < leads.length) await sleep(600);
  }
  return enriched;
}

async function enrichMediaLeadWithSteamContext(lead) {
  const officialLead = await enrichMediaLeadWithOfficialBilibiliContext(lead);
  if (!officialLead.steam_app_id) return finalizeMediaLeadDecisionFields(officialLead, null);

  const details = await fetchAppDetails(officialLead.steam_app_id);
  const releaseDate = normalizeReleaseDate(details?.release_date?.date ?? officialLead.release_window);
  const daysToRelease = daysUntil(releaseDate);
  const alreadyReleased = typeof daysToRelease === "number" && daysToRelease < 0 && !details?.release_date?.coming_soon;
  const steamLinks = [
    `https://store.steampowered.com/app/${officialLead.steam_app_id}/`,
    `https://steamdb.info/app/${officialLead.steam_app_id}/`,
    details?.website
  ].filter(Boolean);
  const steamContacts = details ? await collectContactMethods(details, officialLead.steam_app_id) : [];
  const steamName = normalizeDisplayText(details?.name);
  const project = steamName && shouldPreferSteamName(officialLead.project) ? steamName : officialLead.project;
  const nextLead = {
    ...officialLead,
    project,
    team: officialLead.team ?? details?.developers?.[0] ?? null,
    publisher_name: officialLead.publisher_name ?? details?.publishers?.[0] ?? null,
    publisher_status: details?.publishers?.length
      ? `${details.publishers.join(" / ")}；B站线索已补 Steam 交叉验证`
      : officialLead.publisher_status,
    release_window: releaseDate ?? officialLead.release_window,
    links: mergeLinks([...(officialLead.links ?? []), ...steamLinks]),
    contact_methods: mergeContactMethods([...(officialLead.contact_methods ?? []), ...steamContacts])
  };
  nextLead.contact = nextLead.contact_methods.map((method) => `${method.type}: ${method.value}`).join("；") || null;

  if (alreadyReleased) {
    sourcingDiagnostics.media_released_routed_to_drop += 1;
    return mediaLeadToDrop(finalizeMediaLeadDecisionFields(nextLead, details), `B站/媒体线索补到 Steam AppID ${officialLead.steam_app_id} 后交叉验证：Steam 页面显示已发售约${Math.abs(daysToRelease)}天，不符合前置BD窗口`);
  }

  return finalizeMediaLeadDecisionFields(nextLead, details);
}

function shouldPreferSteamName(project) {
  const text = normalizeDisplayText(project);
  if (isUnusableMediaProjectName(text)) return true;
  if (isGenericMediaProjectName(text)) return true;
  return /国产|独立游戏|试玩|实机|pv|demo|公开测试|商店页|愿望单|即将发售/i.test(text);
}

async function enrichMediaLeadWithOfficialBilibiliContext(lead) {
  if (!lead._mediaItem || !isBilibiliSignal(lead._mediaItem)) return lead;
  if (sourcingDiagnostics.bilibili_official_source_lookups >= maxOfficialLookups) return lead;
  sourcingDiagnostics.bilibili_official_source_lookups += 1;

  const officialCandidates = await fetchOfficialBilibiliCandidates(lead.project);
  const preferred = choosePreferredBilibiliSignal(lead._mediaItem, officialCandidates, lead.project);
  if (!preferred || preferred.link === lead._mediaItem.link) return lead;

  sourcingDiagnostics.bilibili_official_source_hits += 1;
  const officialText = `${preferred.title} ${preferred.summary} ${preferred.source} ${preferred.link}`;
  const officialLinks = normalizeMediaLinksV63([preferred.link, officialText]);
  const officialSteamAppId = steamAppIdFromLinksV63(officialLinks);
  if (officialSteamAppId && officialSteamAppId !== lead.steam_app_id) sourcingDiagnostics.media_steam_appids_extracted += 1;

  return {
    ...lead,
    _mediaItem: preferred,
    _originalMediaItem: lead._mediaItem,
    _officialSourceMatched: true,
    steam_app_id: officialSteamAppId ?? lead.steam_app_id,
    links: mergeLinks([...(lead.links ?? []), ...officialLinks]),
    public_signals: `${preferred.source} / ${preferred.link}`,
    contact_methods: mergeContactMethods([
      ...(lead.contact_methods ?? []),
      ...collectMediaContactMethods(preferred, preferred.link, officialLinks)
    ])
  };
}

async function fetchOfficialBilibiliCandidates(project) {
  const queries = [
    `${project} 官方`,
    `${project} Steam`,
    `${project} PV 实机`,
    `${project} 开发日志`
  ];
  const results = [];
  for (const query of queries) {
    const source = {
      name: "B站官方复核",
      url: bilibiliSearchApi(query),
      fallbackUrl: bilibiliSearchPage(query),
      type: "bilibili_video_search",
      quality: 14,
      focus: ["china", "bilibili", "creator", "domestic_sourcing"]
    };
    try {
      const text = await fetchText(source.url, 10000, "application/json,text/html;q=0.9,*/*;q=0.8");
      results.push(...parseBilibiliVideoSearch(text, source));
    } catch (error) {
      try {
        results.push(...parsePageItems(await fetchText(source.fallbackUrl, 10000, "text/html,*/*;q=0.8"), source));
      } catch (fallbackError) {
        console.warn(`Bilibili official lookup failed for ${project}: ${error.message}; fallback failed: ${fallbackError.message}`);
      }
    }
    if (results.length >= 12) break;
    await sleep(250);
  }
  return enrichBilibiliVideoSignals(dedupeMediaSignals(results).slice(0, 12));
}

function finalizeMediaLeadDecisionFields(lead, details) {
  const sourceText = `${lead._mediaItem?.title ?? ""} ${lead._mediaItem?.summary ?? ""} ${lead.progress ?? ""}`;
  const progress = formatMediaProgress({ details, sourceText, reportDate });
  const gameplay = formatMediaGameplay({
    title: lead.project,
    summary: sourceText,
    genre: lead.genre,
    details
  });
  const releaseDate = normalizeReleaseDate(details?.release_date?.date ?? lead.release_window);
  const daysToRelease = daysUntil(releaseDate);
  const alreadyReleased = progress === "正式上线" || (typeof daysToRelease === "number" && daysToRelease < 0 && !details?.release_date?.coming_soon);
  const fields = deriveMediaDecisionFields({
    title: lead.project,
    source: lead._mediaItem?.source ?? lead.public_signals?.split(" / ")[0] ?? "媒体/B站",
    confidence: lead._confidence ?? "strict",
    score: lead.media_score ?? 0,
    steamAppId: lead.steam_app_id,
    progress,
    gameplay,
    alreadyReleased,
    officialSourceMatched: Boolean(lead._officialSourceMatched)
  });
  return {
    ...lead,
    genre: gameplay,
    gameplay,
    progress,
    release_window: releaseDate ?? lead.release_window,
    priority_reason: fields.priority_reason,
    rule_fit: fields.rule_fit,
    bilibili_fit: fields.bilibili_fit,
    amplification: fields.amplification,
    risks: fields.risks,
    verdict: fields.verdict,
    next_action: fields.next_action,
    notes: fields.notes
  };
}

function mediaLeadToDrop(lead, reason) {
  return {
    ...lead,
    _class: "drop",
    bucket: "淘汰池",
    stage: "rejected",
    priority: "P3",
    priority_reason: reason,
    rule_fit: `${lead.rule_fit ?? ""}；${reason}`.replace(/^；/, ""),
    risks: reason,
    verdict: `${reason}。不进入未处理 review，除非后续明确要求做上线后复盘。`,
    next_action: null,
    notes: null
  };
}

function mediaSignalToLead(item, confidence = "strict") {
  const project = extractMediaProjectName(item.title);
  const score = mediaLeadScore(item);
  const confidencePenalty = confidence === "expanded" ? 6 : confidence === "rescue" ? 10 : 0;
  const isBilibili = isBilibiliSignal(item);
  const mediaText = `${item.title} ${item.summary} ${item.source} ${item.link}`;
  const extractedLinks = normalizeMediaLinksV63([item.link, mediaText]);
  const steamAppId = steamAppIdFromLinksV63(extractedLinks);
  if (steamAppId) sourcingDiagnostics.media_steam_appids_extracted += 1;
  const releasedByText = hasAlreadyReleasedMediaText(mediaText);
  const isPush = !releasedByText && confidence === "strict" && score >= 52 && /国产|国人|华人|国内团队|中国团队|b站|bilibili|taptap|好游快爆|indienova|开发日志/i.test(mediaText);
  const className = releasedByText ? "drop" : isPush ? "push" : "watch";
  const sourceLink = item.link;
  const contactMethods = collectMediaContactMethods(item, sourceLink, extractedLinks);
  const verificationLinks = collectMediaVerificationLinks(sourceLink, extractedLinks, steamAppId);
  const gameplay = formatMediaGameplay({ title: project, summary: mediaText, genre: inferMediaGenre(item) });
  const progress = formatMediaProgress({ sourceText: mediaText, reportDate });
  const decisionFields = deriveMediaDecisionFields({
    title: project,
    source: item.source,
    confidence,
    score,
    steamAppId,
    progress,
    gameplay,
    alreadyReleased: releasedByText,
    officialSourceMatched: false
  });
  const dropReason = releasedByText ? `B站/媒体原文显示已上线或已发售，不符合前置BD窗口` : null;
  if (releasedByText) sourcingDiagnostics.media_released_routed_to_drop += 1;

  return {
    _class: className,
    _mediaItem: item,
    _confidence: confidence,
    _officialSourceMatched: false,
    media_score: score - confidencePenalty,
    id: `lead_media_${reportDate.replaceAll("-", "")}_${hashText(`${item.source}:${sourceLink}:${project}`)}`,
    project,
    steam_app_id: steamAppId,
    team: null,
    team_size: null,
    country: "中国（媒体/B站信号待确认）",
    region: "中国",
    city: null,
    region_priority: "国内优先",
    bucket: className === "drop" ? "淘汰池" : "未处理",
    stage: className === "drop" ? "rejected" : "new",
    priority: className === "push" ? "P1" : className === "drop" ? "P3" : "P2",
    priority_reason: dropReason ?? decisionFields.priority_reason,
    rule_fit: dropReason
      ? `国内媒体/B站产品发现源；${dropReason}；只做淘汰/市场背景，不进入未处理首轮 review。`
      : decisionFields.rule_fit,
    genre: inferMediaGenre(item),
    gameplay,
    progress,
    release_window: null,
    early_access: false,
    narrative_heavy: false,
    india_team: false,
    publisher_status: "媒体/B站信号，发行结构待确认",
    publisher_name: null,
    china_capability_occupied: false,
    traction_summary: `${item.source} 分数 ${score}；${isBilibili ? "B站视频/搜索语境" : "国内媒体/社区语境"}；${steamAppId ? `已从文本补 Steam AppID ${steamAppId}` : "需要人工确认是否有可测版本、商店页或官方账号"}。`,
    public_signals: `${item.source} / ${sourceLink}`,
    contact: contactMethods.map((method) => `${method.type}: ${method.value}`).join("；") || null,
    contact_methods: contactMethods,
    links: verificationLinks,
    exposure_trail: `自动从${item.source}捕捉到媒体/B站线索（${reportDate}）。这类线索用于扩大国内产品发现，不要求先具备 Steam AppID。`,
    bilibili_fit: decisionFields.bilibili_fit,
    amplification: decisionFields.amplification,
    risks: dropReason ?? decisionFields.risks,
    verdict: dropReason ? `${dropReason}，不占用未处理 review 名额。` : decisionFields.verdict,
    next_action: decisionFields.next_action,
    owner: null,
    due_date: null,
    first_seen: reportDate,
    notes: decisionFields.notes
  };
}

function mediaLeadScore(item) {
  const focus = new Set(item.source_focus ?? []);
  const text = `${item.title} ${item.summary}`.toLowerCase();
  let score = item.score ?? 0;
  if (focus.has("bilibili")) score += 12;
  if (focus.has("domestic_sourcing")) score += 10;
  if (/demo|试玩|测试|实机|pv|预告|商店页|愿望单/i.test(text)) score += 10;
  if (/国产|中国|独立游戏|开发者|制作人|国风|武侠|修仙|二次元|版号|过审|首曝|获批/i.test(text)) score += 8;
  if (/steam|taptap|好游快爆|indienova|b站|bilibili/i.test(text)) score += 6;
  if (/肉鸽|rogue|卡牌|deck|策略|strategy|模拟|经营|simulation|management|塔防|战棋|合作|多人/i.test(text)) score += 6;
  return score;
}

function bilibiliAuthor(item) {
  return String(item.summary ?? "").match(/UP主：([^\s]+)/)?.[1] ?? "";
}

function collectMediaVerificationLinks(sourceLink, extractedLinks, steamAppId) {
  const links = [sourceLink, ...extractedLinks];
  if (steamAppId) {
    links.push(`https://store.steampowered.com/app/${steamAppId}/`);
    links.push(`https://steamdb.info/app/${steamAppId}/`);
  }
  return mergeLinks(links);
}

function collectMediaContactMethods(item, sourceLink, extractedLinks) {
  const methods = [];
  if (isBilibiliSignal(item)) addContact(methods, "B站", sourceLink, `${item.source} 原始视频/搜索入口`);
  for (const email of extractEmails(`${item.title} ${item.summary}`)) {
    addContact(methods, "Email", email, "B站/媒体简介中提取");
  }
  for (const link of extractedLinks) {
    const type = inferContactTypeFromLink(link);
    if (!type || isSteamStoreLike(link)) continue;
    addContact(methods, type, link, "B站/媒体简介中提取");
  }
  if (!methods.length) {
    addContact(methods, "其他", sourceLink, `${item.source} 原始线索入口；首轮只做产品判断，通过后再补商务触点`);
  }
  return methods.slice(0, 6);
}

function inferContactTypeFromLink(value) {
  const text = String(value);
  if (/bilibili\.com/i.test(text)) return "B站";
  if (/(?:discord\.gg|discord\.com\/invite)/i.test(text)) return "Discord";
  if (/(?:x\.com|twitter\.com)/i.test(text)) return "X/Twitter";
  if (/store\.steampowered\.com|steamdb\.info|steamcommunity\.com\/app\//i.test(text)) return null;
  if (/^https?:\/\//i.test(text)) return "官网";
  return null;
}

function mergeLinks(values) {
  const out = new Map();
  for (const value of values) {
    if (!value || typeof value !== "string") continue;
    const cleanValue = trimUrlPunctuation(value);
    if (!/^https?:\/\//i.test(cleanValue)) continue;
    if (!isUsableVerificationUrl(cleanValue)) continue;
    out.set(normalizeUrl(cleanValue), cleanValue);
  }
  return [...out.values()];
}

function isUsableVerificationUrl(value) {
  try {
    const url = new URL(value);
    if (!url.hostname.includes(".")) return false;
    if (/^https?:\/\/(?:https?|www)$/i.test(value)) return false;
    return true;
  } catch {
    return false;
  }
}

function mergeContactMethods(values) {
  const out = new Map();
  for (const method of values) {
    if (!method?.value || !method.type) continue;
    const value = trimUrlPunctuation(method.value);
    if (!value || isSteamStoreLike(value)) continue;
    const key = `${method.type}:${normalizeUrl(value)}`;
    if (!out.has(key)) out.set(key, { ...method, value });
  }
  return [...out.values()].slice(0, 6);
}

function extractUrls(value) {
  const text = String(value ?? "");
  const urls = [...text.matchAll(/https?:\/\/[^\s"'<>，。；、）)】\]]+/gi)]
    .map((match) => trimUrlPunctuation(decodeHtml(match[0])));
  const bareSteamUrls = [...text.matchAll(/(?:^|[\s（(【])((?:store\.steampowered\.com|steamcommunity\.com|steamdb\.info)\/app\/\d+[^\s"'<>，。；、）)】\]]*)/gi)]
    .map((match) => `https://${trimUrlPunctuation(decodeHtml(match[1]))}`);
  return mergeLinks([...urls, ...bareSteamUrls]);
}

function trimUrlPunctuation(value) {
  return String(value ?? "")
    .trim()
    .replace(/[),，。；;、】\]]+$/g, "")
    .replace(/&amp;/g, "&");
}

function extractEmails(value) {
  return [...String(value ?? "").matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)]
    .map((match) => match[0])
    .filter(Boolean);
}

function steamAppIdFromLinks(links) {
  for (const link of links) {
    const appId = String(link).match(/(?:store\.steampowered\.com|steamcommunity\.com|steamdb\.info)\/app\/(\d+)/i)?.[1];
    if (appId) return appId;
  }
  return null;
}

function hasAlreadyReleasedMediaText(value) {
  const text = String(value ?? "");
  if (/商店页已上线|商店页面已上线|页面已上线|store page is live|(?:demo|试玩|测试)[^。；.!?]{0,12}(?:已上线|上线)|(?:已上线|上线)[^。；.!?]{0,12}(?:demo|试玩|测试)/i.test(text)) return false;
  return /现已上线|已经上线|现已发售|已经发售|已发售|正式发售|首发优惠|国区首发|发售\s*PV|available now|out now|released now/i.test(text);
}

function extractMediaProjectName(title) {
  const quoted = String(title).match(/《([^》]{2,48})》/)?.[1];
  if (quoted) return quoted.trim();
  const cleaned = normalizeDisplayText(title)
    .replace(/^【[^】]{1,20}】/g, "")
    .replace(/^(国产|独立游戏|游戏|试玩|实机|PV|Demo|开发者|制作人)[：:\s-]+/i, "")
    .replace(/[丨｜].*$/, "")
    .replace(/\s*[-_]\s*(bilibili|哔哩哔哩|游戏葡萄|GameLook|indienova).*$/i, "")
    .trim();
  return cleaned.slice(0, 48) || "媒体/B站发现线索";
}

function inferMediaGenre(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const genres = [];
  if (/肉鸽|rogue/i.test(text)) genres.push("Roguelike");
  if (/卡牌|构筑|deck/i.test(text)) genres.push("Card/Deckbuilder");
  if (/策略|战棋|strategy|tactical/i.test(text)) genres.push("Strategy");
  if (/模拟|经营|simulation|management|tycoon/i.test(text)) genres.push("Simulation/Management");
  if (/塔防|tower defense/i.test(text)) genres.push("Tower Defense");
  if (/合作|多人|co-op|multiplayer/i.test(text)) genres.push("Co-op/Multiplayer");
  if (/国风|武侠|修仙|山海/i.test(text)) genres.push("国风题材");
  return genres.length ? [...new Set(genres)].slice(0, 4).join(" / ") : "媒体/B站待确认";
}

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

async function fetchMediaSignals() {
  const baseResults = (await Promise.all(mediaSources().map(fetchMediaSource))).flat();
  const probeResults = await fetchBilibiliProbeMediaSignals();
  const results = [...baseResults, ...probeResults];
  sourcingDiagnostics.media_signals_raw += results.length;
  const enrichedResults = await enrichBilibiliVideoSignals(results);
  const scored = [];
  for (const item of enrichedResults) {
    if (isStaleMediaSignal(item)) {
      sourcingDiagnostics.media_stale_filtered += 1;
      continue;
    }
    if (isBilibiliSignal(item) && isBannedMediaLeadText(`${item.title} ${item.summary} ${item.source}`.toLowerCase()) && !isOfficialOrDeveloperBilibiliSignal(item)) {
      sourcingDiagnostics.media_banned_filtered += 1;
      continue;
    }
    const next = { ...item, score: scoreMediaSignal(item) };
    if (next.score < 12) {
      sourcingDiagnostics.media_low_score_filtered += 1;
      continue;
    }
    scored.push(next);
  }
  scored.sort((a, b) => b.score - a.score);

  return dedupeMediaSignals(scored);
}

async function fetchBilibiliProbeMediaSignals() {
  try {
    const result = await collectBilibiliProbeSignals({
      rootDir,
      reportDate,
      configPath: args.bilibiliProbeConfig,
      maxVideoAgeDays: maxBilibiliLeadAgeDays
    });
    sourcingDiagnostics.bilibili_probe = result.diagnostics;
    sourcingDiagnostics.source_failures += result.diagnostics.source_failures ?? 0;
    sourcingDiagnostics.bilibili_official_source_hits += result.diagnostics.official_source_hits ?? 0;
    return result.signals;
  } catch (error) {
    sourcingDiagnostics.source_failures += 1;
    sourcingDiagnostics.bilibili_probe = {
      ...defaultBilibiliProbeDiagnostics(),
      source_failures: 1,
      last_error: error.message
    };
    sourcingDiagnostics.low_volume_warnings.push(`B站探头失败：${error.message}`);
    console.warn(`Bilibili probe failed: ${error.message}`);
    return [];
  }
}

async function enrichBilibiliVideoSignals(items) {
  const out = [];
  const chunkSize = 4;
  for (let index = 0; index < items.length; index += chunkSize) {
    const chunk = items.slice(index, index + chunkSize);
    out.push(...await Promise.all(chunk.map(enrichBilibiliVideoSignal)));
    if (index + chunkSize < items.length) await sleep(350);
  }
  return out;
}

async function enrichBilibiliVideoSignal(item) {
  const bvid = item.bvid ?? bvidFromUrl(item.link);
  if (!bvid) return item;
  try {
    const payload = await fetchJson(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`);
    const data = payload?.data;
    if (!data) return item;
    const desc = cleanExtractedText(data.desc ?? "");
    const owner = cleanExtractedText(data.owner?.name ?? "");
    const title = cleanExtractedText(data.title ?? item.title);
    const publishedAt = data.pubdate ? new Date(Number(data.pubdate) * 1000).toISOString() : item.published_at;
    return {
      ...item,
      bvid,
      title: title || item.title,
      summary: [item.summary, desc, owner ? `UP主：${owner}` : ""].filter(Boolean).join(" "),
      published_at: publishedAt || item.published_at
    };
  } catch {
    return item;
  }
}

function mediaSources() {
  return [
    { name: "GameLook", url: "http://www.gamelook.com.cn/feed", type: "feed", quality: 16, focus: ["china", "business", "domestic_sourcing"] },
    { name: "游戏葡萄", url: "https://youxiputao.com/", type: "page", quality: 14, focus: ["china", "business", "domestic_sourcing"] },
    { name: "GameRes游资网", url: "https://www.gameres.com/", type: "page", quality: 13, focus: ["china", "development", "domestic_sourcing"] },
    { name: "游戏陀螺", url: "https://www.youxituoluo.com/", type: "page", quality: 13, focus: ["china", "business", "mobile", "domestic_sourcing"] },
    { name: "手游那点事", url: "https://www.nadianshi.com/", type: "page", quality: 12, focus: ["china", "mobile", "domestic_sourcing"] },
    { name: "游戏茶馆", url: "https://www.youxichaguan.com/news", type: "page", quality: 12, focus: ["china", "business", "domestic_sourcing"] },
    { name: "indienova", url: "https://indienova.com/groups", type: "page", quality: 12, focus: ["china", "indie", "domestic_sourcing"] },
    { name: "游研社", url: "https://www.yystv.cn/", type: "page", quality: 12, focus: ["china", "product", "creator", "domestic_sourcing"] },
    { name: "机核", url: "https://www.gcores.com/", type: "page", quality: 11, focus: ["china", "product", "creator", "domestic_sourcing"] },
    { name: "TapTap发现", url: "https://www.taptap.cn/discover", type: "page", quality: 10, focus: ["china", "mobile", "product", "domestic_sourcing"] },
    { name: "B站视频-国产独立游戏", url: bilibiliSearchApi("国产独立游戏 Demo Steam"), fallbackUrl: bilibiliSearchPage("国产独立游戏 Demo Steam"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产游戏试玩", url: bilibiliSearchApi("国产游戏 试玩 Demo"), fallbackUrl: bilibiliSearchPage("国产游戏 试玩 Demo"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产游戏实机", url: bilibiliSearchApi("国产游戏 实机 PV"), fallbackUrl: bilibiliSearchPage("国产游戏 实机 PV"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产肉鸽卡牌", url: bilibiliSearchApi("国产 肉鸽 卡牌 Steam"), fallbackUrl: bilibiliSearchPage("国产 肉鸽 卡牌 Steam"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-独立游戏开发日志", url: bilibiliSearchApi("独立游戏 开发日志 试玩"), fallbackUrl: bilibiliSearchPage("独立游戏 开发日志 试玩"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产游戏公开测试", url: bilibiliSearchApi("国产游戏 公开测试 试玩"), fallbackUrl: bilibiliSearchPage("国产游戏 公开测试 试玩"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产独立游戏PV", url: bilibiliSearchApi("国产独立游戏 PV 实机"), fallbackUrl: bilibiliSearchPage("国产独立游戏 PV 实机"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产策略模拟", url: bilibiliSearchApi("国产 策略 模拟经营 Steam"), fallbackUrl: bilibiliSearchPage("国产 策略 模拟经营 Steam"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国风修仙游戏", url: bilibiliSearchApi("国风 修仙 游戏 试玩"), fallbackUrl: bilibiliSearchPage("国风 修仙 游戏 试玩"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产二游新作", url: bilibiliSearchApi("国产 二游 新作 PV"), fallbackUrl: bilibiliSearchPage("国产 二游 新作 PV"), type: "bilibili_video_search", quality: 12, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产官方PV", url: bilibiliSearchApi("国产独立游戏 官方 PV"), fallbackUrl: bilibiliSearchPage("国产独立游戏 官方 PV"), type: "bilibili_video_search", quality: 15, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产开发者Demo", url: bilibiliSearchApi("国产游戏 开发者 Demo Steam"), fallbackUrl: bilibiliSearchPage("国产游戏 开发者 Demo Steam"), type: "bilibili_video_search", quality: 15, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产商店页愿望单", url: bilibiliSearchApi("国产游戏 Steam 商店页 愿望单"), fallbackUrl: bilibiliSearchPage("国产游戏 Steam 商店页 愿望单"), type: "bilibili_video_search", quality: 15, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产Playtest", url: bilibiliSearchApi("国产游戏 Playtest 试玩"), fallbackUrl: bilibiliSearchPage("国产游戏 Playtest 试玩"), type: "bilibili_video_search", quality: 14, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国人独立游戏Steam", url: bilibiliSearchApi("国人独立游戏 Steam 商店页"), fallbackUrl: bilibiliSearchPage("国人独立游戏 Steam 商店页"), type: "bilibili_video_search", quality: 14, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站视频-国产TapTap预约", url: bilibiliSearchApi("国产游戏 TapTap 预约 PV"), fallbackUrl: bilibiliSearchPage("国产游戏 TapTap 预约 PV"), type: "bilibili_video_search", quality: 13, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站搜索-国产独立游戏", url: "https://search.bilibili.com/all?keyword=%E5%9B%BD%E4%BA%A7%E7%8B%AC%E7%AB%8B%E6%B8%B8%E6%88%8F%20Demo%20Steam", type: "bilibili_page_search", quality: 11, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站搜索-国产游戏试玩", url: "https://search.bilibili.com/all?keyword=%E5%9B%BD%E4%BA%A7%E6%B8%B8%E6%88%8F%20%E8%AF%95%E7%8E%A9%20Demo", type: "bilibili_page_search", quality: 11, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站搜索-国产游戏实机", url: "https://search.bilibili.com/all?keyword=%E5%9B%BD%E4%BA%A7%E6%B8%B8%E6%88%8F%20%E5%AE%9E%E6%9C%BA%20PV", type: "bilibili_page_search", quality: 11, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站搜索-国产肉鸽卡牌", url: "https://search.bilibili.com/all?keyword=%E5%9B%BD%E4%BA%A7%20%E8%82%89%E9%B8%BD%20%E5%8D%A1%E7%89%8C%20Steam", type: "bilibili_page_search", quality: 11, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站搜索-独立游戏制作人", url: "https://search.bilibili.com/all?keyword=%E7%8B%AC%E7%AB%8B%E6%B8%B8%E6%88%8F%20%E5%88%B6%E4%BD%9C%E4%BA%BA%20%E5%BC%80%E5%8F%91%E6%97%A5%E5%BF%97", type: "bilibili_page_search", quality: 11, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "GamesIndustry.biz", url: "https://www.gamesindustry.biz/feed", type: "feed", quality: 14, focus: ["business", "publishing"] },
    { name: "GameDeveloper", url: "https://www.gamedeveloper.com/rss.xml", type: "feed", quality: 13, focus: ["development", "business"] },
    { name: "VGC", url: "https://www.videogameschronicle.com/feed/", type: "feed", quality: 12, focus: ["industry", "platform"] },
    { name: "Eurogamer", url: "https://www.eurogamer.net/feed/news", type: "feed", quality: 11, focus: ["industry", "product"] },
    { name: "PC Gamer", url: "https://www.pcgamer.com/rss/", type: "feed", quality: 10, focus: ["pc", "community"] },
    { name: "IGN", url: "https://www.ign.com/rss/articles/feed?tags=games", type: "feed", quality: 10, focus: ["product", "mainstream"] },
    { name: "Gematsu", url: "https://www.gematsu.com/feed", type: "feed", quality: 9, focus: ["product", "asia"] },
    { name: "The Verge Gaming", url: "https://www.theverge.com/rss/games/index.xml", type: "feed", quality: 9, focus: ["platform", "technology"] },
    { name: "GameSpot", url: "https://www.gamespot.com/feeds/news/", type: "feed", quality: 8, focus: ["mainstream", "product"] },
    { name: "Polygon", url: "https://www.polygon.com/rss/index.xml", type: "feed", quality: 10, focus: ["mainstream", "product", "culture"] },
    { name: "Rock Paper Shotgun", url: "https://www.rockpapershotgun.com/feed", type: "feed", quality: 9, focus: ["pc", "product", "culture"] },
    { name: "PocketGamer.biz", url: "https://www.pocketgamer.biz/rss/", type: "feed", quality: 10, focus: ["business", "mobile"] },
    { name: "GamesBeat", url: "https://venturebeat.com/category/games/feed/", type: "feed", quality: 9, focus: ["business", "technology"] },
    { name: "Siliconera", url: "https://www.siliconera.com/feed/", type: "feed", quality: 8, focus: ["product", "asia"] },
    { name: "触乐", url: "https://www.chuapp.com/?feed=rss2", type: "feed", quality: 11, focus: ["china", "culture"] },
    { name: "IT之家", url: "https://www.ithome.com/rss/", type: "feed", quality: 7, focus: ["china", "technology"] },
    { name: "3DM", url: "https://www.3dmgame.com/news/", type: "page", quality: 6, focus: ["china", "product"] },
    { name: "游民星空", url: "https://www.gamersky.com/news/", type: "page", quality: 6, focus: ["china", "product"] },
    { name: "证券时报", url: "https://www.stcn.com/", type: "page", quality: 10, focus: ["china", "capital", "legal"] },
    { name: "澎湃新闻", url: "https://m.thepaper.cn/", type: "page", quality: 9, focus: ["china", "legal", "society"] }
  ].filter((source) => !source.activeUntil || reportDate <= source.activeUntil);
}

async function fetchMediaSource(source) {
  try {
    const text = await fetchText(source.url, 12000, "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8");
    if (source.type === "feed") return parseFeedItems(text, source);
    if (source.type === "bilibili_video_search") return parseBilibiliVideoSearch(text, source);
    if (source.type === "bilibili_page_search") return parseBilibiliSearchPage(text, source);
    if (source.type === "article") return [parseArticleItem(text, source)].filter(Boolean);
    return parsePageItems(text, source);
  } catch (error) {
    if (source.type === "bilibili_video_search" && source.fallbackUrl) {
      try {
        return parsePageItems(await fetchText(source.fallbackUrl, 12000, "text/html,*/*;q=0.8"), source);
      } catch (fallbackError) {
        sourcingDiagnostics.source_failures += 1;
        console.warn(`Media source failed for ${source.name}: ${error.message}; fallback failed: ${fallbackError.message}`);
        return [];
      }
    }
    sourcingDiagnostics.source_failures += 1;
    console.warn(`Media source failed for ${source.name}: ${error.message}`);
    return [];
  }
}

function bilibiliSearchApi(keyword) {
  const url = new URL("https://api.bilibili.com/x/web-interface/search/type");
  url.searchParams.set("search_type", "video");
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "20");
  url.searchParams.set("order", "pubdate");
  return url.toString();
}

function bilibiliSearchPage(keyword) {
  const url = new URL("https://search.bilibili.com/all");
  url.searchParams.set("keyword", keyword);
  return url.toString();
}

function parseBilibiliVideoSearch(text, source) {
  try {
    const payload = JSON.parse(text);
    const result = Array.isArray(payload?.data?.result) ? payload.data.result : [];
    return result.slice(0, 20).map((item) => {
      const bvid = item.bvid ?? "";
      const title = cleanExtractedText(item.title ?? "");
      const description = cleanExtractedText(item.description ?? "");
      const author = cleanExtractedText(item.author ?? item.mid ?? "");
      return sourceTaggedItem({
        title,
        link: bvid ? `https://www.bilibili.com/video/${bvid}/` : absolutizeUrl(item.arcurl ?? "", "https://www.bilibili.com/"),
        summary: [description, author ? `UP主：${author}` : ""].filter(Boolean).join(" "),
        published_at: item.pubdate ? new Date(Number(item.pubdate) * 1000).toISOString() : "",
        bvid
      }, source);
    }).filter((item) => item.title && item.link);
  } catch {
    return [];
  }
}

function parseBilibiliSearchPage(html, source) {
  const items = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']*\/video\/BV[0-9A-Za-z]+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html).matchAll(anchorPattern)) {
    const title = cleanExtractedText(match[2]);
    const link = absolutizeUrl(match[1], "https://www.bilibili.com/");
    if (title.length < 8 || title.length > 120) continue;
    items.push(sourceTaggedItem({
      title,
      link,
      summary: title,
      published_at: "",
      bvid: bvidFromUrl(link)
    }, source));
    if (items.length >= 20) break;
  }
  return items;
}

function bvidFromUrl(value) {
  return String(value ?? "").match(/\/video\/(BV[0-9A-Za-z]+)/i)?.[1] ?? "";
}

function parseFeedItems(xml, source) {
  const items = [];
  const blocks = String(xml).split(/<item\b|<entry\b/i).slice(1);
  for (const block of blocks.slice(0, 20)) {
    const title = cleanExtractedText(readXmlTag(block, "title"));
    const rawLink = readXmlTag(block, "link") || block.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || "";
    const link = absolutizeUrl(decodeHtml(stripTags(rawLink)).trim(), source.url);
    const summary = cleanExtractedText(readXmlTag(block, "description") || readXmlTag(block, "summary") || "");
    const publishedAt = cleanExtractedText(readXmlTag(block, "pubDate") || readXmlTag(block, "published") || "");
    if (title && link) items.push(sourceTaggedItem({ title, link, summary, published_at: publishedAt }, source));
  }
  return items;
}

function parsePageItems(html, source) {
  const items = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html).matchAll(anchorPattern)) {
    const title = cleanExtractedText(match[2]);
    if (title.length < 8 || title.length > 100) continue;
    items.push(sourceTaggedItem({
      title,
      link: absolutizeUrl(match[1], source.url),
      summary: title,
      published_at: ""
    }, source));
    if (items.length >= 30) break;
  }
  return items;
}

function parseArticleItem(html, source) {
  const title = cleanExtractedText(
    String(html).match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
    ?? String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?? ""
  );
  const summary = cleanExtractedText(
    String(html).match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)?.[1]
    ?? String(html).match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1]
    ?? title
  );
  return title ? sourceTaggedItem({ title, link: source.url, summary, published_at: "" }, source) : null;
}

function readXmlTag(block, tagName) {
  const match = String(block).match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match?.[1]?.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "") ?? "";
}

function scoreMediaSignal(item) {
  const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  let topicPoints = 0;
  topicPoints += topicScore(text, /\b(publisher|publishing|acquisition|investment|funding|layoffs?|union|lawsuit|court|rights?|licen[cs]e|ip|studio closure|executive|leadership)\b|出版|收购|投资|融资|裁员|诉讼|法院|判决|死刑|执行死刑|版权|授权|股权|高管|创始人|工作室|关停|监管|版号|财报/, 18);
  topicPoints += topicScore(text, /\b(expansion|dlc|major update|announced|showcase|release date|delay|remaster|remake|sequel|cross[- ]?media|adaptation|restarted from scratch)\b|资料片|大型更新|公布|发布会|延期|重制|续作|新作|改编|影视化|动画|联动|周年|上线|定档|发售|手游|端游/, 14);
  topicPoints += topicScore(text, /\b(steam|steam deck|epic games store|game pass|playstation|xbox|switch|nintendo|mobile|wishlist|demo|next fest|early access|store policy|platform|hardware|pricing|price|showcase|direct|state of play|summer game fest)\b|平台|商店|愿望单|试玩|新品节|抢先体验|主机|掌机|硬件|涨价|降价|定价|移动端|渠道|发布会|直面会/, 12);
  topicPoints += topicScore(text, /\b(streamer|creator|ugc|youtube|twitch|community|mod|viral|meme|esports)\b|主播|创作者|up主|视频|直播|社区|二创|模组|爆火|梗|赛事|传播/, 10);
  topicPoints += topicScore(text, /\b(artificial intelligence|generative ai|genai|machine learning|deepmind|large language model|llm)\b|人工智能|生成式|aigc/i, 12);
  topicPoints += topicScore(text, /\b(china|chinese|bilibili|asia|netease|tencent)\b|中国|国产|出海|B站|哔哩哔哩|腾讯|网易|米哈游|莉莉丝|心动|鹰角/, 12);
  topicPoints += topicScore(text, /\b(report|analysis|interview|confirmed|official|financial results)\b|报告|分析|专访|确认|官方|公告|财报/, 4);

  let score = (item.source_quality ?? 0) + topicPoints;
  const sourceFocus = new Set(item.source_focus ?? []);
  if (sourceFocus.has("domestic_sourcing")) score += 10;
  if (sourceFocus.has("bilibili") && /国产|独立游戏|试玩|demo|制作人|开发者|steam|实机|首曝|PV|视频/i.test(text)) score += 10;
  if (isOfficialOrDeveloperBilibiliSignal(item)) score += 16;
  if (sourceFocus.has("mobile") && /手游|移动端|买量|发行|渠道|小游戏|版号|出海/i.test(text)) score += 6;
  if (topicPoints < 8) score -= 12;
  if (isLowInformationMediaTitle(item.title)) score -= 60;
  if (!hasGameOrBdContext(text, item)) score -= 30;

  if (/\b(review|guide|walkthrough|tips|best settings|deal|sale|discount|cosplay|quiz)\b|攻略|评测|折扣|促销|史低|壁纸|图赏|盘点/.test(text)) score -= 10;
  if (/手游推荐|游戏推荐|必玩|好玩到爆|合集|几款|十款|\d+\s*款/.test(text) && !isOfficialOrDeveloperBilibiliSignal(item)) score -= 22;
  if (/rumor|leak|传闻|曝/.test(text) && !/\b(confirmed|official)\b|确认|官方|公告/.test(text)) score -= 4;
  return score;
}

function isLowInformationMediaTitle(title) {
  const text = normalizeDisplayText(title);
  if (text.length < 6) return true;
  if (/^[\d\s:：.,，]+$/.test(text)) return true;
  if (/^\d+\s+\d+\s+\d{1,2}:\d{2}/.test(text)) return true;
  if (/^(观看|播放|评论|弹幕|收藏|分享|赞|投币)\s*\d+/i.test(text)) return true;
  if (/^[\u4e00-\u9fffA-Za-z0-9 _-]{2,30}\s*·\s*20\d{2}-\d{2}-\d{2}$/.test(text)) return true;
  if (/^.{2,40}\s*·\s*(昨天|前天|\d+\s*(小时前|分钟前|天前|周前|月前))$/.test(text)) return true;
  return false;
}

function isStaleMediaSignal(item) {
  if (!isBilibiliSignal(item)) return false;
  const ageDays = mediaSignalAgeDays(item);
  if (typeof ageDays !== "number") return false;
  return ageDays > maxBilibiliLeadAgeDays;
}

function mediaSignalAgeDays(item) {
  const timestamp = Date.parse(item.published_at ?? "");
  if (!Number.isFinite(timestamp)) return null;
  const reportTimestamp = Date.parse(`${reportDate}T00:00:00+08:00`);
  if (!Number.isFinite(reportTimestamp)) return null;
  return (reportTimestamp - timestamp) / 86400000;
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url, 12000, "application/json,text/html;q=0.9,*/*;q=0.8"));
}

async function fetchText(url, timeoutMs, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = defaultHeaders(accept);
    if (/\.bilibili\.com/i.test(url)) {
      headers.Referer = "https://search.bilibili.com/";
      headers.Origin = "https://search.bilibili.com";
    }
    const response = await fetch(url, { signal: controller.signal, headers });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } catch (error) {
    if (isSteamUrl(url) && shouldUseCurlFallback(error)) {
      console.warn(`Steam Node fetch failed for ${new URL(url).host}: ${describeNetworkError(error)}; retrying with curl fallback`);
      return await fetchTextWithCurl(url, timeoutMs, accept);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function defaultHeaders(accept) {
  return { "User-Agent": "Mozilla/5.0 SourcingCRM/1.0 (+https://github.com/Neo0109/CRM)", Accept: accept ?? "*/*" };
}

function isSteamUrl(url) {
  try {
    const host = new URL(url).host;
    return /(^|\.)steampowered\.com$/i.test(host);
  } catch {
    return false;
  }
}

function describeNetworkError(error) {
  return [error.name, error.message, error.cause?.code, error.cause?.message].filter(Boolean).join(" / ");
}

function shouldUseCurlFallback(error) {
  if (/^(403|429)\b/.test(error.message)) return false;
  return /fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|aborted|timeout/i.test(describeNetworkError(error));
}

async function fetchTextWithCurl(url, timeoutMs, accept) {
  const headers = defaultHeaders(accept);
  const maxSeconds = String(Math.max(8, Math.ceil(timeoutMs / 1000)));
  try {
    const { stdout } = await execFile("curl", [
      "--location",
      "--silent",
      "--show-error",
      "--fail",
      "--retry",
      "2",
      "--retry-delay",
      "1",
      "--connect-timeout",
      "8",
      "--max-time",
      maxSeconds,
      "--user-agent",
      headers["User-Agent"],
      "--header",
      `Accept: ${headers.Accept}`,
      url
    ], { maxBuffer: 8 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    const stderr = String(error.stderr ?? "").trim();
    const detail = stderr || error.message;
    throw new Error(`curl fallback failed: ${detail}`);
  }
}

async function writeJson(relativePath, payload) {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function hasMaturePublisher(publishers) {
  const text = publishers.join(" ").toLowerCase();
  return ["devolver", "raw fury", "annapurna", "team17", "hooded horse", "tinybuild", "kasedo", "kepler", "11 bit", "chucklefish", "humble", "paradox", "focus", "playstack", "fireshine", "nacon", "secret mode", "thunderful", "netea", "tencent", "bilibili", "xd", "gamera", " indienova"].some((name) => text.includes(name.trim()));
}

function looksDomestic(text) {
  return /[\u4e00-\u9fff]/.test(text) || /china|beijing|shanghai|shenzhen|guangzhou|chengdu|hangzhou|wuhan|xiamen|nanjing|suzhou|chongqing/i.test(text);
}

function isDomesticDiscoveryQuery(query) {
  return /国产|中国|国风|武侠|修仙|仙侠|山海|三国|水墨|国潮|中式|古风/i.test(String(query));
}

function normalizeReleaseDate(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const chinese = cleaned.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (chinese) return `${chinese[1]}-${chinese[2].padStart(2, "0")}-${chinese[3].padStart(2, "0")}`;
  const parsed = Date.parse(cleaned);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return cleaned || null;
}

function daysUntil(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
  const target = new Date(`${value}T00:00:00+08:00`).getTime();
  const now = new Date(`${reportDate}T00:00:00+08:00`).getTime();
  return Math.round((target - now) / 86400000);
}

function stripTags(value) {
  return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function decodeHtml(value) {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ");
}

function cleanExtractedText(value) {
  return stripTags(decodeHtml(value)).replace(/\s+/g, " ").trim();
}

function hasGameOrBdContext(text, item) {
  const broadSources = new Set(["IT之家", "证券时报", "澎湃新闻"]);
  if (!broadSources.has(item.source)) return true;
  return /game|gaming|steam|xbox|playstation|nintendo|switch|publisher|developer|studio|bilibili|acg|ip|游戏|手游|端游|主机|电竞|动画|动漫|发行|发售|上线|资料片|腾讯游戏|网易游戏|米哈游|莉莉丝|心动|鹰角|游族|三体|版权|授权|版号|B站|哔哩哔哩/i.test(text);
}

function absolutizeUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
