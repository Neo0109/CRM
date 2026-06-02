// Online CRM generator v4 runtime, currently executing Sourcing Rules V6.
// Core principle: every output must be useful to a Bilibili BD owner.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const args = parseArgs(process.argv.slice(2));
const reportDate = args.date ?? todayInShanghai();
const capturedAt = nowInShanghaiIso();
const requestedMaxCandidates = Number(args.maxCandidates ?? 320);
const maxCandidates = Number.isFinite(requestedMaxCandidates) ? Math.min(Math.max(requestedMaxCandidates, 80), 360) : 320;
const minReviewLeads = boundedNumber(args.minReviewLeads, 18, 8, 48);
const minMediaLeadsWhenHealthy = boundedNumber(args.minMediaLeads, 10, 4, 30);
const existingIndex = await readExistingProjectIndex(reportDate, args.existingIndex);

const rawCandidates = dedupeByAppId((await Promise.all([
  fetchSteamSearch("popularcomingsoon", "Steam CN Domestic Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "国产 游戏" }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Domestic Demo Keyword", [], { cc: "cn", l: "schinese", domesticLens: true, query: "国产 Demo" }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Indie Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "国产 独立游戏" }),
  fetchSteamSearch("popularcomingsoon", "Steam CN China Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "中国" }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Guofeng Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "国风" }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Xianxia Wuxia Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "修仙 武侠" }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Shanhai Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "山海" }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Three Kingdoms Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "三国" }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Deckbuilder Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "卡牌 构筑" }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Roguelike Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "肉鸽" }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Management Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "模拟经营" }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Popular Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Demo/Next Fest Window", [21], { cc: "cn", l: "schinese", domesticLens: true }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Strategy Upcoming", [9], { cc: "cn", l: "schinese", domesticLens: true }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Simulation Upcoming", [599], { cc: "cn", l: "schinese", domesticLens: true }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Co-op Upcoming", [1685], { cc: "cn", l: "schinese", domesticLens: true }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Roguelike Upcoming", [1716], { cc: "cn", l: "schinese", domesticLens: true }),
  fetchSteamSearch("popularcomingsoon", "Steam CN Deckbuilder Upcoming", [32322], { cc: "cn", l: "schinese", domesticLens: true }),
  fetchSteamSearch("popularcomingsoon", "Steam Popular Upcoming"),
  fetchSteamSearch("popularcomingsoon", "Steam Demo/Next Fest Window", [21]),
  fetchSteamSearch("popularcomingsoon", "Strategy Upcoming", [9]),
  fetchSteamSearch("popularcomingsoon", "Simulation Upcoming", [599]),
  fetchSteamSearch("popularcomingsoon", "Co-op Upcoming", [1685]),
  fetchSteamSearch("popularcomingsoon", "Roguelike Upcoming", [1716]),
  fetchSteamSearch("popularcomingsoon", "Deckbuilder Upcoming", [32322]),
  fetchFeaturedCategories()
])).flat())
  .filter((candidate) => candidate.appId && candidate.title && !isExistingSteamCandidate(candidate, existingIndex))
  .slice(0, maxCandidates);

const mediaSignals = await fetchMediaSignals();
const industrySignals = selectDiverseMediaSignals(dedupeMediaSignals(mediaSignals), 14);
const mediaLeadCandidates = buildMediaLeadCandidates(mediaSignals, existingIndex.projects);

const enrichedCandidates = await enrichCandidates(rawCandidates);

if (!rawCandidates.length && !mediaLeadCandidates.length) {
  throw new Error("No Steam candidates or domestic media/Bilibili product leads were fetched; refusing to overwrite daily reports with an empty run.");
}

if (!enrichedCandidates.length && !mediaLeadCandidates.length) {
  throw new Error("No Steam candidates were enriched and no media/Bilibili product leads survived filtering; refusing to overwrite daily reports with an empty run.");
}

enrichedCandidates.sort((a, b) => b.score - a.score);
const pools = buildPools(enrichedCandidates, mediaLeadCandidates);
validateDailyVolume({
  pools,
  mediaSignals,
  mediaLeadCandidates,
  rawCandidateCount: rawCandidates.length,
  enrichedCandidateCount: enrichedCandidates.length
});

await writeJson(`data/reports/${reportDate}.json`, buildDailyReport(pools, rawCandidates.length, enrichedCandidates.length, mediaLeadCandidates.length));
await writeJson(`data/radar/${reportDate}.json`, buildRadarReport(enrichedCandidates, pools, industrySignals));
await writeJson(`data/steam_trends/${reportDate}.json`, buildSteamTrendReport(enrichedCandidates, pools));

console.log(JSON.stringify({
  ok: true,
  generator: "online_daily_v4_sourcing_rules_v6",
  report_date: reportDate,
  candidates_seen: rawCandidates.length,
  candidates_enriched: enrichedCandidates.length,
  industry_signals: industrySignals.length,
  media_signals_seen: mediaSignals.length,
  media_lead_candidates: mediaLeadCandidates.length,
  min_review_leads: minReviewLeads,
  min_media_leads_when_healthy: minMediaLeadsWhenHealthy,
  existing_project_names: existingIndex.projects.size,
  existing_steam_app_ids: existingIndex.steamAppIds.size,
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
  for (const reportPath of previousDatePaths(date, 45)) {
    try {
      const report = JSON.parse(await readFile(path.join(rootDir, reportPath), "utf8"));
      for (const bucket of ["push_pool", "watch_pool", "drop_pool"]) {
        for (const lead of report[bucket] ?? []) {
          if (lead.project) projects.add(normalizeText(lead.project));
          if (lead.steam_app_id) steamAppIds.add(normalizeText(lead.steam_app_id));
        }
      }
    } catch {}
  }

  if (externalIndexPath) {
    try {
      const external = JSON.parse(await readFile(path.resolve(rootDir, externalIndexPath), "utf8"));
      for (const project of external.projects ?? []) projects.add(normalizeText(project));
      for (const appId of external.steam_app_ids ?? []) steamAppIds.add(normalizeText(appId));
    } catch (error) {
      throw new Error(`Failed to load CRM dedupe index from ${externalIndexPath}: ${error.message}`);
    }
  }

  return { projects, steamAppIds };
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
        await sleep(1200 * attempt);
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
  const concurrency = 8;
  for (let index = 0; index < candidates.length; index += concurrency) {
    const chunk = candidates.slice(index, index + concurrency);
    const results = await Promise.all(chunk.map(async (candidate) => {
      const details = await fetchAppDetails(candidate.appId);
      return enrichCandidate(candidate, details);
    }));
    enriched.push(...results);
    if (index + concurrency < candidates.length) await sleep(200);
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

function scoreCandidate(input) {
  let score = 0;
  if (input.source.includes("Upcoming")) score += 24;
  if (input.source.includes("Demo") || input.source.includes("Next Fest")) score += 14;
  if (input.source.includes("Featured Coming")) score += 10;
  if (input.source.includes("CN") || input.domesticLens) score += 6;
  if (input.domesticQuery) score += 18;
  if (input.domestic) score += 30;
  if (input.domestic && input.hasDemoSignal) score += 22;
  if (input.strongGameplay) score += 18;
  if (input.highVisual) score += 12;
  if (input.strongData) score += 14;
  if (!input.domestic) score -= 10;
  if (!input.domestic && input.validatedPcHit) score += 22;
  if (!input.domestic && input.mobileAdaptationPotential) score += 10;
  if (input.comingSoon) score += 6;
  if (input.hasDetails) score += 5;
  if (input.contactCount) score += 4;
  if (input.alreadyReleased) score -= 80;
  if (input.releaseTooSoon) score -= 30;
  if (input.publisherOccupied) score -= 24;
  if (input.earlyAccess) score -= 50;
  if (input.narrativeHeavy) score -= 35;
  if (input.indiaTeam) score -= 50;
  return score;
}

function buildPools(candidates, mediaLeads = []) {
  const leads = candidates.map(toLead);
  const used = new Set();
  const mediaPush = selectUniqueLeads(mediaLeads.filter((lead) => lead._class === "push"), 8, used);
  const steamPush = selectUniqueLeads(leads.filter((lead) => lead._class === "push"), 8, used);
  const push = interleaveLeads(mediaPush, steamPush).slice(0, 14);
  const mediaWatch = selectUniqueLeads(mediaLeads.filter((lead) => lead._class === "watch" || lead._class === "push"), 24, used);
  const steamWatch = selectUniqueLeads(leads.filter((lead) => lead._class === "watch" || lead._class === "push"), 28, used);
  const watch = interleaveLeads(mediaWatch, steamWatch).slice(0, 40);
  const drop = selectUniqueLeads(leads.filter((lead) => lead._class === "drop"), 12, used);
  return { push: push.map(stripPrivate), watch: watch.map(stripPrivate), drop: drop.map(stripPrivate) };
}

function interleaveLeads(primary, secondary) {
  const out = [];
  const maxLength = Math.max(primary.length, secondary.length);
  for (let index = 0; index < maxLength; index += 1) {
    if (primary[index]) out.push(primary[index]);
    if (secondary[index]) out.push(secondary[index]);
  }
  return out;
}

function validateDailyVolume({ pools, mediaSignals, mediaLeadCandidates, rawCandidateCount, enrichedCandidateCount }) {
  const reviewCount = pools.push.length + pools.watch.length;
  if (reviewCount < minReviewLeads) {
    throw new Error(`Daily review candidate count too low: push+watch=${reviewCount}, expected >= ${minReviewLeads}. Steam raw=${rawCandidateCount}, enriched=${enrichedCandidateCount}, media_leads=${mediaLeadCandidates.length}. Refusing to publish a low-volume report.`);
  }

  const domesticSignalCount = mediaSignals.filter((item) => {
    const focus = new Set(item.source_focus ?? []);
    return focus.has("domestic_sourcing") || focus.has("bilibili");
  }).length;
  if (domesticSignalCount >= 18 && mediaLeadCandidates.length < minMediaLeadsWhenHealthy) {
    throw new Error(`Domestic media/Bilibili lead extraction too low: media_leads=${mediaLeadCandidates.length}, expected >= ${minMediaLeadsWhenHealthy} when domestic signals=${domesticSignalCount}. Refusing to publish a Steam-only report.`);
  }
}

function selectUniqueLeads(leads, limit, used) {
  const selected = [];
  for (const lead of leads) {
    const key = poolLeadKey(lead);
    if (used.has(key)) continue;
    selected.push(lead);
    used.add(key);
    if (selected.length >= limit) break;
  }
  return selected;
}

function poolLeadKey(lead) {
  if (lead.steam_app_id) return `steam:${lead.steam_app_id}`;
  const looseKey = looseChineseProjectKey(lead.project);
  return `project:${looseKey || normalizeText(lead.project)}`;
}

function looseChineseProjectKey(value) {
  const hanChars = [...normalizeDisplayText(value)].filter((char) => /\p{Script=Han}/u.test(char));
  if (hanChars.length < 6 || hanChars.length > 24) return null;
  return `han:${hanChars.sort().join("")}`;
}

function toLead(candidate) {
  const dropReason = hardDropReason(candidate);
  const pushEligible = isPushEligible(candidate, dropReason);
  const className = dropReason ? "drop" : pushEligible ? "push" : "watch";
  const bucket = className === "drop" ? "淘汰池" : "未处理";
  const priority = className === "push" ? "P1" : className === "drop" ? "P3" : candidate.score >= 34 ? "P2" : "P3";
  const genre = candidate.genres.join(" / ") || null;
  const priorityReason = buildPriorityReason(candidate, className, dropReason);
  return {
    _class: className,
    id: `lead_steam_${candidate.appId}_${reportDate}`,
    project: candidate.title,
    steam_app_id: candidate.appId,
    team: candidate.developers[0] ?? null,
    team_size: null,
    country: candidate.country,
    region: candidate.region,
    city: null,
    region_priority: candidate.region === "中国" ? "国内优先" : candidate.validatedPcHit && candidate.mobileAdaptationPotential ? "海外-强数据" : "其他",
    bucket,
    stage: className === "drop" ? "rejected" : "new",
    priority,
    priority_reason: priorityReason,
    rule_fit: buildRuleFit(candidate, dropReason, className),
    genre,
    gameplay: candidate.shortDescription || `${genre ?? "玩法待复核"}。需要打开 Steam 页面确认实机画面、玩法循环、Demo/愿望单信号和中文计划。`,
    progress: `Steam ${candidate.source}；发售窗口：${candidate.releaseDate}${candidate.hasDemoSignal ? "；Demo/试玩信号需优先复核" : ""}`,
    release_window: candidate.releaseDate,
    early_access: candidate.earlyAccess,
    narrative_heavy: candidate.narrativeHeavy,
    india_team: candidate.indiaTeam,
    publisher_status: buildPublisherStatus(candidate),
    publisher_name: candidate.publishers[0] ?? null,
    china_capability_occupied: candidate.publisherOccupied,
    traction_summary: buildTractionSummary(candidate),
    public_signals: `${candidate.source} / Steam App ${candidate.appId}`,
    contact: candidate.contactMethods.map((method) => `${method.type}: ${method.value}`).join("；"),
    contact_methods: candidate.contactMethods,
    links: [candidate.storeUrl, candidate.steamDbUrl, candidate.website].filter(Boolean),
    exposure_trail: buildExposureTrail(candidate),
    bilibili_fit: buildBilibiliFit(candidate),
    amplification: buildAmplification(candidate),
    risks: buildRisks(candidate, dropReason),
    verdict: buildVerdict(className, dropReason),
    next_action: buildNextAction(className),
    owner: null,
    due_date: null,
    first_seen: reportDate,
    notes: buildLeadNote(candidate, className, dropReason)
  };
}

function hardDropReason(candidate) {
  if (candidate.earlyAccess) return "命中排除项：PC Early Access";
  if (candidate.narrativeHeavy) return "命中排除项：叙事主导/视觉小说倾向";
  if (candidate.indiaTeam) return "命中排除项：印度团队/印度开发主体";
  if (candidate.publisherOccupied) return "成熟发行商占位，BD切入价值低";
  if (candidate.alreadyReleased) return "Steam 页面显示已发售，不符合前置BD窗口";
  if (candidate.region === "海外" && !candidate.validatedPcHit) return "海外项目缺少PC大数据验证，不符合当前国内BD优先策略";
  if (candidate.region === "海外" && !candidate.mobileAdaptationPotential) return "海外项目缺少明确手游化/移动端改编角度";
  if (candidate.releaseTooSoon && candidate.region !== "中国") return "海外项目发售窗口不足60天，默认不进正式推进";
  return null;
}

function isPushEligible(candidate, dropReason) {
  if (dropReason) return false;
  if (!candidate.strongGameplay) return false;
  if (candidate.region === "中国") {
    if (!candidate.hasDetails && !candidate.hasDemoSignal) return false;
    if (candidate.releaseTooSoon && !candidate.hasDemoSignal) return false;
    return candidate.score >= 54;
  }
  if (typeof candidate.daysToRelease === "number" && candidate.daysToRelease < 60) return false;
  return candidate.score >= 72 && candidate.validatedPcHit && candidate.mobileAdaptationPotential;
}

function buildPriorityReason(candidate, className, dropReason) {
  if (className === "drop") return dropReason;
  const windowText = releaseWindowText(candidate);
  if (className === "push") return `${candidate.source} 前置信号 + ${candidate.region === "中国" ? "国内优先" : "海外PC验证/手游化角度"} + 系统型玩法，${windowText}，先提测验证再决定商务深聊`;
  if (candidate.region === "中国") return `${candidate.source} 有国内前置信号，${windowText}；先进入未处理 inbox，由人工决定是否提测或观察`;
  return `${candidate.source} 有前置信号，${windowText}；海外项目只在PC数据/手游化角度成立时继续占用复核名额`;
}

function releaseWindowText(candidate) {
  if (typeof candidate.daysToRelease !== "number") return "窗口待确认";
  if (candidate.daysToRelease < 0) return `已发售约${Math.abs(candidate.daysToRelease)}天`;
  return `距发售约${candidate.daysToRelease}天`;
}

function buildRuleFit(candidate, dropReason, className) {
  const parts = [];
  if (candidate.region === "中国") parts.push("国内项目优先");
  if (candidate.region === "中国" && candidate.hasDemoSignal) parts.push("国内开发者Demo测试提权");
  if (candidate.region === "海外" && candidate.validatedPcHit && candidate.mobileAdaptationPotential) parts.push("海外PC爆款验证 + 手游化角度成立");
  if (candidate.strongGameplay) parts.push("玩法具备内容化潜力");
  if (typeof candidate.daysToRelease === "number") parts.push(releaseWindowText(candidate));
  if (className === "push") parts.push("窗口仍在，允许优先触达");
  if (dropReason) parts.push(dropReason);
  if (!parts.length) parts.push("基础入口成立，待人工复核");
  return parts.join("；");
}

function buildPublisherStatus(candidate) {
  if (!candidate.publishers.length) return "发行结构待确认";
  return `${candidate.publishers.join(" / ")}；${candidate.publisherOccupied ? "成熟发行商可能已占位" : "未见成熟中国发行能力占位"}`;
}

function buildTractionSummary(candidate) {
  const signals = [candidate.source];
  if (candidate.highVisual) signals.push("素材/截图/视频可验证");
  if (candidate.hasDemoSignal) signals.push("Demo/试玩信号");
  if (candidate.strongData) signals.push("存在强公开数据信号");
  if (candidate.strongGameplay) signals.push("玩法具备内容化空间");
  return `${signals.join("；")}。`;
}

function buildExposureTrail(candidate) {
  return `最早自动捕捉：${candidate.source}（${reportDate}）。待反查：Steam News、SteamDB、GamesPress、YouTube trailer、B站、indienova、官网/Discord。目标是确认是否仍处在最佳BD窗口。`;
}

function buildRisks(candidate, dropReason) {
  if (dropReason) return dropReason;
  const risks = [];
  if (typeof candidate.daysToRelease !== "number") risks.push("发售窗口未精确");
  if (!candidate.strongData) risks.push("缺少愿望单/口碑/社区强数据");
  if (candidate.region === "海外" && !candidate.validatedPcHit) risks.push("海外项目缺少PC爆款验证");
  if (candidate.region === "海外" && !candidate.mobileAdaptationPotential) risks.push("海外项目缺少手游化角度");
  if (!candidate.developers.length) risks.push("团队信息待确认");
  if (!candidate.contactMethods.length) risks.push("联系入口待确认");
  return risks.length ? risks.join("；") : "需要人工确认团队地区、中文计划、发行占位和商务合作意愿。";
}

function buildVerdict(className, dropReason) {
  if (className === "push") return "符合V6重点复核标准，建议先测游戏；测试成立后再确认中国区合作窗口与开发者真实需求";
  if (className === "drop") return `${dropReason}，暂不投入BD时间`;
  return "方向可看但还不够商务推进，先进入未处理 inbox；测试/观察不成立就直接淘汰";
}

function buildNextAction(className) {
  if (className === "drop") return "归档原因，避免重复讨论";
  if (className === "push") return "先安排实机/运营测试；通过后再确认团队地区、商务邮箱/Discord、中文计划和发行占位";
  return "人工 review 后决定提测、观察或淘汰；不要因为缺联系方式阻塞首轮测试";
}

function buildLeadNote(candidate, className, dropReason) {
  if (className === "drop") return `V6判断：${dropReason}。`;
  if (className === "push") return "V6判断：国内优先或海外PC验证/手游化角度成立；下一步先测游戏，测试成立再推进商务。";
  return "V6判断：前置信号成立但还不够商务推进；先放入未处理 inbox，人工决定提测、观察或淘汰。";
}

function buildBilibiliFit(candidate) {
  const text = `${candidate.genres.join(" ")} ${candidate.categories.join(" ")}`;
  if (/co-op|multiplayer/i.test(text)) return "多人协作适合直播切片、挑战局和UP主联动。";
  if (/strategy|simulation|management|automation|city builder|tower defense|factory/i.test(text)) return "系统型玩法适合做教学、机制讲解、效率挑战和长线栏目。";
  if (/roguelike|deckbuilder|card game|tactical/i.test(text)) return "构筑、流派和局内选择适合标题化、复盘化和挑战化。";
  if (candidate.highVisual) return "画面素材较完整，适合先做视觉向短内容和愿望单转化测试。";
  return "需要先看 Steam 页面素材，确认是否能被标题化、切片化和讲解化。";
}

function buildAmplification(candidate) {
  const text = `${candidate.genres.join(" ")} ${candidate.categories.join(" ")}`;
  if (/roguelike|deckbuilder|card game|tactical/i.test(text)) return "可围绕构筑、流派、挑战路线做栏目化内容。";
  if (/simulation|management|automation|city builder|factory/i.test(text)) return "可做新手指南、效率对比、失败案例和长期连载。";
  if (/co-op|multiplayer/i.test(text)) return "可做多人首测、主播局和社交传播节点。";
  return "先用实机素材验证点击和完播，再决定是否推进商务触达。";
}

function buildMediaLeadCandidates(items, existingProjects) {
  const normalizedExisting = new Set([...existingProjects].map(normalizeText));
  const sourceCount = new Map();
  const strictLeads = dedupeMediaSignals(items)
    .filter(isProductSourcingSignal)
    .map((item) => mediaSignalToLead(item, "strict"))
    .filter((lead) => isNewMediaLead(lead, normalizedExisting))
    .sort((a, b) => (b.media_score ?? 0) - (a.media_score ?? 0));
  const expandedLeads = dedupeMediaSignals(items)
    .filter((item) => !isProductSourcingSignal(item) && isExpandedDomesticProductSignal(item))
    .map((item) => mediaSignalToLead(item, "expanded"))
    .filter((lead) => isNewMediaLead(lead, normalizedExisting))
    .sort((a, b) => (b.media_score ?? 0) - (a.media_score ?? 0));

  const selected = selectBalancedMediaLeadCandidates([...strictLeads, ...expandedLeads], sourceCount, 30);
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

function isNewMediaLead(lead, existingProjects) {
  if (!lead.project) return false;
  const projectKey = normalizeText(lead.project);
  if (!projectKey || existingProjects.has(projectKey)) return false;
  if (/^(媒体|b站|今日亮点|行业新闻|国产游戏|独立游戏|游戏|steam|demo|pv|实机|试玩|新作|上线|公布|预告)$/i.test(projectKey)) return false;
  return true;
}

function isProductSourcingSignal(item) {
  const focus = new Set(item.source_focus ?? []);
  const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  const title = normalizeDisplayText(item.title);
  const isBilibili = isBilibiliSignal(item);
  const hasUsefulSource = focus.has("domestic_sourcing") || focus.has("bilibili") || (focus.has("china") && (focus.has("product") || focus.has("indie") || focus.has("mobile")));
  if (!hasUsefulSource) return false;
  if (/招聘|岗位|财报|收入|销量榜|折扣|促销|史低|攻略|教程|如何报名|报名steam新品节|愿望单经验|曝光量|经验分享|开发经验|开发教程|cosplay|壁纸|周边|赛事战报|补丁说明|停服|维护|安卓|android|pixel|iphone|手机也能升|主机情报|次世代|硬件|显卡|处理器|大会|峰会|获奖名单|招聘|财报|流水|营收/i.test(text)) return false;
  if (/视觉小说|galgame|恋爱模拟|纯剧情|互动小说/i.test(text)) return false;

  const hasQuotedName = /《[^》]{2,48}》/.test(item.title);
  const hasBilibiliProjectShape = isBilibili
    && !hasQuotedName
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
  if (/视觉小说|galgame|恋爱模拟|纯剧情|互动小说/i.test(text)) return false;

  const quoted = /《[^》]{2,48}》/.test(item.title);
  const hasDomesticContext = /国产|国人|华人|中国团队|国内团队|国内开发|版号|过审|获批|独立游戏|开发日志|taptap|好游快爆|indienova|国风|武侠|修仙|山海|二次元|小游戏|手游|b站|bilibili|哔哩哔哩/.test(text) || isBilibiliSignal(item);
  const hasActionableProductMoment = /新作|首曝|公布|发布|上线|定档|测试|试玩|demo|实机|pv|预告|steam|taptap|好游快爆|开发者|制作人|愿望单|商店页|b站|bilibili|版号|过审|获批|预约|肉鸽|卡牌|策略|模拟|经营|二次元|国风|武侠|修仙/i.test(text);
  const titleLooksLikeConcreteProject = title.length >= 4
    && title.length <= 80
    && !/^(更多|首页|新闻|资讯|专题|视频|搜索|登录|注册|投稿|广告|榜单|盘点|合集|周报|月报)$/i.test(title)
    && !/教程|经验|报名|指南|课程|盘点|榜单|数据分享|开发经验|愿望单增长|steam新品节报名/i.test(title);

  return hasDomesticContext && hasActionableProductMoment && (quoted || titleLooksLikeConcreteProject);
}

function isBannedMediaLeadText(text) {
  const bannedPatterns = [
    /招聘|岗位|财报|收入|销量榜|折扣|促销|史低|攻略|教程|如何报名|报名steam新品节|愿望单经验|曝光量|经验分享|开发经验|开发教程/i,
    /cosplay|壁纸|周边|赛事战报|补丁说明|停服|维护|android|pixel|iphone|手机也能升|主机情报|次世代|硬件|显卡|处理器|大会|峰会|获奖名单|流水|营收/i,
    /手游推荐|游戏推荐|必玩|好玩到爆|盘点|合集|几款|十款|\d+\s*款|锐评|吐槽/i,
    /黑神话：悟空|蔚蓝档案|galgame|国gal|恋爱模拟|致郁系|情书|我在b站做|占比百分之/i
  ];
  return bannedPatterns.some((pattern) => pattern.test(text));
}

function mediaSignalToLead(item, confidence = "strict") {
  const project = extractMediaProjectName(item.title);
  const score = mediaLeadScore(item);
  const isBilibili = isBilibiliSignal(item);
  const isPush = confidence === "strict" && score >= 52 && /国产|国人|华人|国内团队|中国团队|b站|bilibili|taptap|好游快爆|indienova|开发日志/i.test(`${item.title} ${item.summary} ${item.source} ${item.link}`);
  const sourceLink = item.link;
  const contactMethods = isBilibili
    ? [{ type: "B站", value: sourceLink, note: `${item.source} 原始视频/搜索入口` }]
    : [{ type: "其他", value: sourceLink, note: `${item.source} 原始线索入口；首轮只做产品判断，通过后再补商务触点` }];
  const concise = normalizeDisplayText(item.summary || item.title).slice(0, 160);

  return {
    _class: isPush ? "push" : "watch",
    media_score: confidence === "expanded" ? score - 6 : score,
    id: `lead_media_${reportDate.replaceAll("-", "")}_${hashText(`${item.source}:${sourceLink}:${project}`)}`,
    project,
    steam_app_id: null,
    team: null,
    team_size: null,
    country: "中国（媒体/B站信号待确认）",
    region: "中国",
    city: null,
    region_priority: "国内优先",
    bucket: "未处理",
    stage: "new",
    priority: isPush ? "P1" : "P2",
    priority_reason: `${item.source} 捕捉到${confidence === "expanded" ? "待核验" : "具体"}产品信号：${normalizeDisplayText(item.title).slice(0, 90)}。先点开原始链接判断玩法和内容潜力，不因缺 Steam 链接阻塞首轮 review。`,
    rule_fit: `国内媒体/B站产品发现源；${confidence === "expanded" ? "扩展候选，先确认是否为具体游戏；" : ""}非 Steam 线索允许进入未处理 inbox；先测/先看内容，再决定补 Steam、官网、TapTap 或商务联系人。`,
    genre: inferMediaGenre(item),
    gameplay: concise || "来自媒体/B站的产品线索，需打开原文/视频确认玩法循环、实机内容和开发阶段。",
    progress: `${item.source} 原始信号：${normalizeDisplayText(item.title).slice(0, 110)}`,
    release_window: null,
    early_access: false,
    narrative_heavy: false,
    india_team: false,
    publisher_status: "媒体/B站信号，发行结构待确认",
    publisher_name: null,
    china_capability_occupied: false,
    traction_summary: `${item.source} 分数 ${score}；${isBilibili ? "B站视频/搜索语境" : "国内媒体/社区语境"}；需要人工确认是否有可测版本、商店页或官方账号。`,
    public_signals: `${item.source} / ${sourceLink}`,
    contact: contactMethods.map((method) => `${method.type}: ${method.value}`).join("；") || null,
    contact_methods: contactMethods,
    links: [sourceLink],
    exposure_trail: `自动从${item.source}捕捉到媒体/B站线索（${reportDate}）。这类线索用于扩大国内产品发现，不要求先具备 Steam AppID。`,
    bilibili_fit: isBilibili ? "已出现在B站语境，优先看播放、评论、弹幕和UP主表达是否能转化为发行前内容资产。" : "需反查B站是否有PV、实机、试玩或UP主讨论，判断能否做内容种草。",
    amplification: "先从原始链接提炼一句传播钩子；若玩法能被视频讲清楚，再进入提测或补资料。",
    risks: confidence === "expanded" ? "扩展媒体/B站候选，可能存在项目名不准或只是资讯标题；首轮先判定是不是具体可看的游戏，不成立直接淘汰。" : "非Steam来源，项目名/开发者/发售窗口和联系方式可能不完整；首轮只做产品判断，不要求立即补全商务资料。",
    verdict: isPush ? "媒体/B站信号足够具体，建议进入当天未处理队列优先看原文/视频。" : "作为国内发现线索保留，人工确认产品真实度和可测性后再分池。",
    next_action: "打开原始链接确认玩法、团队、是否可测；能测就提测，不成立就直接淘汰；通过首测后再补 Steam/官网/联系方式。",
    owner: null,
    due_date: null,
    first_seen: reportDate,
    notes: `媒体/B站扩展来源；confidence=${confidence}；media_score=${score}`
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

function isBilibiliSignal(item) {
  return /bilibili|b站|哔哩哔哩/i.test(`${item.source} ${item.link}`);
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

function buildDailyReport(pools, rawCount, enrichedCount, mediaLeadCount) {
  return {
    report_date: reportDate,
    summary: `Sourcing V6线上自动化：扫描 Steam 候选 ${rawCount} 条、富化 ${enrichedCount} 条，另从国内媒体/B站提取产品线索 ${mediaLeadCount} 条；进入日报候选 ${pools.push.length + pools.watch.length + pools.drop.length} 条；推荐优先复核 ${pools.push.length} 条、普通复核 ${pools.watch.length} 条、淘汰 ${pools.drop.length} 条。非淘汰项目统一进入未处理 inbox，人工 review 后再分池。`,
    insights: [
      "V6把日报读者明确为B站商务负责人：国内项目优先，不输出泛趋势废话，只输出能辅助BD判断的信息。",
      "每个可review项目必须说明玩法循环、公开数据、优势、短板、B站内容/社区赋能方式和下一步测试/BD动作。",
      "国内媒体和B站捕捉到的具体产品必须进入lead候选；没有Steam AppID时，原文、视频、官网、TapTap、indienova等链接也可作为首轮验证入口。",
      "行业雷达必须来自真实媒体、厂商、法院/公司公告或可核验社区信号，不能用内部规则说明冒充行业新闻。",
      "Steam趋势必须输出大盘观察：近期冒头品类、活动/窗口、发行商新品、数据样本和BD含义，不能把日报规则贴到趋势页。",
      "国内开发者的Demo/试玩信号一律提权；窗口可以更早更长，不再把60天当唯一前置判断，国内项目先测再商务。",
      "海外项目默认不占用BD复核名额，除非具备PC数据验证且能说清手游化/移动端改编角度。",
      "已发售、EA、叙事主导、印度团队、成熟发行商占位的项目不再进入人工复核候选。",
      "有效lead必须回答三件事：窗口是否还在、权益空间是否还在、B站是否能把中国区盘子做大。",
      "自动日报只负责发现和优先级建议，非淘汰项目不得自动进入观察池/待评测/跟进池/推进池。"
    ],
    push_pool: pools.push,
    watch_pool: pools.watch,
    drop_pool: pools.drop
  };
}

function buildRadarReport(candidates, pools, industrySignals) {
  const genres = summarizeGenres(candidates);
  const mediaItems = industrySignals.slice(0, 14).map(mediaSignalToRadarItem);
  if (!candidates.length) {
    return {
      report_date: reportDate,
      summary: `Sourcing V6行业雷达：今日选入 ${industrySignals.length} 条中外媒体/社区信号。Steam 抓取未返回候选，雷达不再用内部扫描状态凑数。`,
      items: mediaItems
    };
  }

  const bilibiliSignal = radarItem(
    "bilibili_bd_lens",
    "B站趋势",
    `今日Steam候选中值得人工复核的方向：${genres.slice(0, 4).join("、") || "待观察"}`,
    `样本高频不等于推荐。V6只关心这些方向里哪些产品能被UP主讲清楚、剪出看点、形成社区话题，并且仍有中国区权益空间。`,
    "中",
    "CRM Online Scan",
    "https://store.steampowered.com/search/?filter=popularcomingsoon",
    "这是给BD选品的背景信号，不是新闻，也不直接进入推进池。",
    `优先复核 ${pools.push.length} 个强信号项目；其余候选先在未处理 inbox 等人工分池。`
  );
  return {
    report_date: reportDate,
    summary: `Sourcing V6行业雷达：今日选入 ${industrySignals.length} 条中外媒体/社区信号，另扫描 Steam 候选 ${candidates.length} 个。行业新闻只放宏观大事件；具体游戏、IP、公司/法律八卦和好玩线索统一进入今日亮点。`,
    items: [...mediaItems, bilibiliSignal]
  };
}

function buildSteamTrendReport(candidates, pools) {
  if (!candidates.length && (pools.push.length || pools.watch.length)) {
    return buildSteamUnavailableFallbackTrendReport(pools);
  }

  const marketInsights = buildSteamMarketInsights(candidates, pools);
  const genreSignals = buildSteamGenreSignals(candidates);
  const focusGenres = genreSignals.slice(0, 3).map((signal) => signal.genre.replace(/（.+$/, ""));
  const steamSamples = selectSteamTrendSamples(candidates);
  const steamItems = steamSamples.map((candidate) => ({
    id: `steam_trend_${reportDate.replaceAll("-", "_")}_${candidate.appId}`,
    title: candidate.title,
    steam_app_id: candidate.appId,
    rank_bucket: candidate.source,
    signal: buildV5SteamSignal(candidate),
    source: "Steam Store / AppDetails",
    links: [candidate.storeUrl, candidate.steamDbUrl],
    bilibili_fit: buildBilibiliFit(candidate),
    reason: buildV5TrendReason(candidate),
    auto_import: candidate.score >= 24 && !hardDropReason(candidate),
    captured_at: capturedAt
  }));
  const mediaFallbackItems = steamItems.length >= 8
    ? []
    : buildFallbackSteamTrendItems([...pools.push, ...pools.watch], steamItems.length, 12 - steamItems.length);
  return {
    report_date: reportDate,
    summary: `Steam大盘V6：扫描 ${candidates.length} 个候选，输出 ${marketInsights.length} 条大盘观察和 ${genreSignals.length} 个品类信号。今日重点看 ${focusGenres.join("、") || "Demo/新品窗口"}；候选入库仍只进入未处理 inbox，人工再分池。`,
    market_insights: marketInsights,
    genre_signals: genreSignals,
    items: [...steamItems, ...mediaFallbackItems].slice(0, 12),
    crm_candidates: [...pools.push, ...pools.watch.slice(0, 8)]
  };
}

function buildSteamUnavailableFallbackTrendReport(pools) {
  const reviewLeads = [...pools.push, ...pools.watch];
  const genreSignals = buildFallbackGenreSignals(reviewLeads);
  const items = buildFallbackSteamTrendItems(reviewLeads, 0, 12);

  return {
    report_date: reportDate,
    summary: `Steam大盘V6：本次 Steam 抓取未返回有效候选，使用 ${reviewLeads.length} 个国内媒体/B站 review 候选做保底观察，避免日报因单一源失败而断档。`,
    market_insights: [
      steamInsight(
        "steam_fetch_unavailable",
        "Steam 抓取不可用：不能让日报断档",
        "本次 Steam Search/AppDetails 没有返回有效候选。日报应透明标记源异常，并用国内媒体/B站候选保持 BD review 队列。",
        "高",
        "Steam Store fetch status",
        "https://store.steampowered.com/search/?filter=popularcomingsoon",
        "稍后补跑 Steam；当前先 review 国内媒体/B站候选，能测就测，不成立就淘汰。"
      ),
      steamInsight(
        "domestic_media_backup",
        `国内媒体/B站保底：${reviewLeads.length} 个可 review 候选`,
        "这些候选来自媒体/B站原始链接，不要求先有 Steam AppID。它们的价值是扩大国内产品发现，先判断玩法、题材、视频表达和可测性。",
        "中",
        "Domestic media / Bilibili discovery",
        "https://search.bilibili.com/all?keyword=%E5%9B%BD%E4%BA%A7%E6%B8%B8%E6%88%8F%20%E8%AF%95%E7%8E%A9%20Demo",
        "先打开原始链接做产品判断；通过首测后再补 Steam、官网、联系人和商务窗口。"
      ),
      steamInsight(
        "source_resilience",
        "源韧性：Steam 不是单点故障",
        "当 Steam 暂时不可用时，日报仍应从国内游戏媒体、B站视频、TapTap/indienova、官方开发者动态里产出可操作线索。",
        "中",
        "Domestic discovery source mix",
        "https://www.gamelook.com.cn/",
        "后续持续扩展国内源，并用低数量闸门阻止一两条线索的坏日报上线。"
      )
    ],
    genre_signals: genreSignals,
    items,
    crm_candidates: reviewLeads.slice(0, 12)
  };
}

function buildFallbackSteamTrendItems(reviewLeads, offset, limit) {
  return reviewLeads.slice(0, limit).map((lead, index) => ({
    id: `steam_trend_${reportDate.replaceAll("-", "_")}_fallback_${offset + index + 1}`,
    title: lead.project,
    steam_app_id: lead.steam_app_id ?? null,
    rank_bucket: "Domestic media/Bilibili fallback",
    signal: [
      "Steam Store 本次抓取没有返回有效候选，日报使用国内媒体/B站产品线索保持发现不中断。",
      `原始信号：${lead.public_signals ?? lead.progress ?? "媒体/B站线索"}`,
      `产品观察：${lead.gameplay ?? lead.priority_reason ?? "待打开原始链接确认玩法和内容钩子"}`
    ].join("\n"),
    source: lead.public_signals?.split(" / ")[0] ?? "Domestic media/Bilibili",
    links: lead.links ?? [],
    bilibili_fit: lead.bilibili_fit ?? "先看视频/原文能否提炼成B站选题、试玩或发行前内容资产。",
    reason: lead.priority_reason ?? "Steam 不可用时的国内发现保底候选；先做人工首轮 review。",
    auto_import: true,
    captured_at: capturedAt
  }));
}

function buildFallbackGenreSignals(leads) {
  const clusters = [
    ["Roguelike / Deckbuilder", /rogue|肉鸽|卡牌|构筑|deck|card/i, "构筑和单局反馈适合B站挑战、攻略和流派复盘。", "优先确认是否有可测Demo和差异化构筑。"],
    ["Strategy / Tactical", /策略|战棋|回合|strategy|tactical|三国|战争/i, "策略题材适合长线讲解和核心用户沉淀。", "看前10分钟是否能讲清核心决策和视频看点。"],
    ["Simulation / Management", /模拟|经营|管理|建造|simulation|management|tycoon/i, "经营模拟适合系列化视频和长期连载。", "看成长曲线、失败反馈和题材新鲜度。"],
    ["Action / Visual Hook", /动作|射击|战斗|boss|平台|action|shooter|combat/i, "强操作或强视觉更容易通过PV/实机建立第一印象。", "看打击反馈、角色辨识度和可剪素材。"],
    ["Domestic Discovery", /国产|国风|武侠|修仙|山海|中国|国内|b站|bilibili|taptap|indienova/i, "国内信号代表沟通效率、文化适配和签约概率更高。", "先测/先看内容，通过后再补商务触点。"]
  ];
  const signals = clusters.map(([genre, pattern, why, action]) => {
    const matched = leads.filter((lead) => pattern.test(`${lead.project} ${lead.genre} ${lead.gameplay} ${lead.priority_reason} ${lead.public_signals}`));
    return {
      id: `steam_genre_${reportDate.replaceAll("-", "_")}_fallback_${normalizeText(genre).replace(/[^a-z0-9]+/g, "_")}`,
      genre: `${genre}（${matched.length}/${leads.length}）`,
      signal: `${matched.length} 个国内媒体/B站候选命中；代表样本：${matched.slice(0, 3).map((lead) => lead.project).join("、") || "待打开原始链接确认"}。`,
      why_it_matters: why,
      bd_action: action,
      links: matched.flatMap((lead) => lead.links ?? []).slice(0, 3)
    };
  }).filter((signal) => !/^.+（0\//.test(signal.genre));

  while (signals.length < 3 && leads[signals.length]) {
    const lead = leads[signals.length];
    signals.push({
      id: `steam_genre_${reportDate.replaceAll("-", "_")}_fallback_product_${signals.length + 1}`,
      genre: `国内产品线索（${signals.length + 1}/${leads.length}）`,
      signal: `代表样本：${lead.project}。`,
      why_it_matters: "Steam 不可用时，用国内媒体/B站具体产品保持 BD review 节奏。",
      bd_action: "先打开原始链接判断玩法和视频表达；不成立直接淘汰。",
      links: lead.links ?? []
    });
  }

  return signals.slice(0, 5);
}

async function fetchMediaSignals() {
  const results = (await Promise.all(mediaSources().map(fetchMediaSource))).flat();
  const scored = results
    .map((item) => ({ ...item, score: scoreMediaSignal(item) }))
    .filter((item) => !isStaleMediaSignal(item))
    .filter((item) => !isBilibiliSignal(item) || !isBannedMediaLeadText(`${item.title} ${item.summary} ${item.source}`.toLowerCase()))
    .filter((item) => item.score >= 12)
    .sort((a, b) => b.score - a.score);

  return dedupeMediaSignals(scored);
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
    { name: "B站搜索-国产独立游戏", url: "https://search.bilibili.com/all?keyword=%E5%9B%BD%E4%BA%A7%E7%8B%AC%E7%AB%8B%E6%B8%B8%E6%88%8F%20Demo%20Steam", type: "page", quality: 11, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站搜索-国产游戏试玩", url: "https://search.bilibili.com/all?keyword=%E5%9B%BD%E4%BA%A7%E6%B8%B8%E6%88%8F%20%E8%AF%95%E7%8E%A9%20Demo", type: "page", quality: 11, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站搜索-国产游戏实机", url: "https://search.bilibili.com/all?keyword=%E5%9B%BD%E4%BA%A7%E6%B8%B8%E6%88%8F%20%E5%AE%9E%E6%9C%BA%20PV", type: "page", quality: 11, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站搜索-国产肉鸽卡牌", url: "https://search.bilibili.com/all?keyword=%E5%9B%BD%E4%BA%A7%20%E8%82%89%E9%B8%BD%20%E5%8D%A1%E7%89%8C%20Steam", type: "page", quality: 11, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
    { name: "B站搜索-独立游戏制作人", url: "https://search.bilibili.com/all?keyword=%E7%8B%AC%E7%AB%8B%E6%B8%B8%E6%88%8F%20%E5%88%B6%E4%BD%9C%E4%BA%BA%20%E5%BC%80%E5%8F%91%E6%97%A5%E5%BF%97", type: "page", quality: 11, focus: ["china", "bilibili", "creator", "domestic_sourcing"] },
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
    if (source.type === "article") return [parseArticleItem(text, source)].filter(Boolean);
    return parsePageItems(text, source);
  } catch (error) {
    if (source.type === "bilibili_video_search" && source.fallbackUrl) {
      try {
        return parsePageItems(await fetchText(source.fallbackUrl, 12000, "text/html,*/*;q=0.8"), source);
      } catch (fallbackError) {
        console.warn(`Media source failed for ${source.name}: ${error.message}; fallback failed: ${fallbackError.message}`);
        return [];
      }
    }
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
        published_at: item.pubdate ? new Date(Number(item.pubdate) * 1000).toISOString() : ""
      }, source);
    }).filter((item) => item.title && item.link);
  } catch {
    return [];
  }
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
  if (sourceFocus.has("mobile") && /手游|移动端|买量|发行|渠道|小游戏|版号|出海/i.test(text)) score += 6;
  if (topicPoints < 8) score -= 12;
  if (isLowInformationMediaTitle(item.title)) score -= 60;
  if (!hasGameOrBdContext(text, item)) score -= 30;

  if (/\b(review|guide|walkthrough|tips|best settings|deal|sale|discount|cosplay|quiz)\b|攻略|评测|折扣|促销|史低|壁纸|图赏|盘点/.test(text)) score -= 10;
  if (/手游推荐|游戏推荐|必玩|好玩到爆|合集|几款|十款|\d+\s*款/.test(text)) score -= 22;
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
  const timestamp = Date.parse(item.published_at ?? "");
  if (!Number.isFinite(timestamp)) return false;
  const reportTimestamp = Date.parse(`${reportDate}T00:00:00+08:00`);
  if (!Number.isFinite(reportTimestamp)) return false;
  const ageDays = (reportTimestamp - timestamp) / 86400000;
  return ageDays > 540;
}

function dedupeMediaSignals(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = normalizeText(item.title).slice(0, 80);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function selectDiverseMediaSignals(items, limit) {
  const selected = [];
  const sourceCount = new Map();
  const familyCount = new Map();
  const regionCount = new Map();

  takeRadarSignals(items, selected, sourceCount, familyCount, regionCount, limit, (item) => categoryForMediaSignal(item) === "行业新闻" && mediaRegion(item) === "china", 2);
  takeRadarSignals(items, selected, sourceCount, familyCount, regionCount, limit, (item) => categoryForMediaSignal(item) === "行业新闻" && mediaRegion(item) === "global", 3);
  takeRadarSignals(items, selected, sourceCount, familyCount, regionCount, limit, (item) => categoryForMediaSignal(item) === "今日亮点" && mediaRegion(item) === "china", 4);
  takeRadarSignals(items, selected, sourceCount, familyCount, regionCount, limit, (item) => categoryForMediaSignal(item) === "今日亮点" && mediaRegion(item) === "global", 2);
  takeRadarSignals(items, selected, sourceCount, familyCount, regionCount, limit, (item) => categoryForMediaSignal(item) === "AI 游戏", 2);
  takeRadarSignals(items, selected, sourceCount, familyCount, regionCount, limit, (item) => ["B站趋势", "新梗热点"].includes(categoryForMediaSignal(item)), 1);

  for (const item of items) {
    if (selected.includes(item)) continue;
    if (!canSelectRadarSignal(item, sourceCount, familyCount, regionCount)) continue;
    selected.push(item);
    bumpRadarCounts(item, sourceCount, familyCount, regionCount);
    if (selected.length >= limit) return selected;
  }

  for (const item of items) {
    if (selected.includes(item)) continue;
    selected.push(item);
    if (selected.length >= limit) break;
  }

  return selected;
}

function takeRadarSignals(items, selected, sourceCount, familyCount, regionCount, limit, predicate, target) {
  let taken = 0;
  for (const item of items) {
    if (selected.includes(item)) continue;
    if (!predicate(item)) continue;
    if (!canSelectRadarSignal(item, sourceCount, familyCount, regionCount)) continue;
    selected.push(item);
    bumpRadarCounts(item, sourceCount, familyCount, regionCount);
    taken += 1;
    if (selected.length >= limit || taken >= target) break;
  }
}

function canSelectRadarSignal(item, sourceCount, familyCount, regionCount) {
  const family = mediaTopicFamily(item);
  const region = mediaRegion(item);
  if ((sourceCount.get(item.source) ?? 0) >= 2) return false;
  if ((familyCount.get(family) ?? 0) >= 4) return false;
  if ((regionCount.get(region) ?? 0) >= 8) return false;
  return true;
}

function bumpRadarCounts(item, sourceCount, familyCount, regionCount) {
  const family = mediaTopicFamily(item);
  const region = mediaRegion(item);
  sourceCount.set(item.source, (sourceCount.get(item.source) ?? 0) + 1);
  familyCount.set(family, (familyCount.get(family) ?? 0) + 1);
  regionCount.set(region, (regionCount.get(region) ?? 0) + 1);
}

function mediaRegion(item) {
  const focus = new Set(item.source_focus ?? []);
  const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  if (focus.has("china") || focus.has("domestic_sourcing") || /中国|国产|国内|出海|腾讯|网易|米哈游|莉莉丝|心动|鹰角|b站|哔哩哔哩|taptap|indienova/i.test(text)) return "china";
  return "global";
}

function mediaSignalToRadarItem(item, index) {
  const category = categoryForMediaSignal(item);
  const title = normalizeDisplayText(item.title);
  return radarItem(
    `media_${index}_${normalizeText(title).replace(/[^a-z0-9]+/g, "_").slice(0, 36)}`,
    category,
    title,
    conciseMediaSummary(item),
    item.score >= 25 ? "高" : "中",
    item.source,
    item.link,
    relevanceForMediaSignal(item),
    actionForMediaSignal(item)
  );
}

function categoryForMediaSignal(item) {
  const family = mediaTopicFamily(item);
  if (family === "ai_production") return "AI 游戏";
  if (isBilibiliSignal(item)) return isMetaBilibiliTrend(item) ? "B站趋势" : "今日亮点";
  if (family === "creator_community") return isBilibiliSignal(item) ? "B站趋势" : "新梗热点";
  if (family === "business_legal" && isMacroBusinessSignal(item)) return "行业新闻";
  if (family === "product_ip" || family === "business_legal") return "今日亮点";
  if (family === "platform_market" || family === "industry_context") return "行业新闻";
  return "行业新闻";
}

function conciseMediaSummary(item) {
  const text = [item.summary, item.title].filter(Boolean).join(" ");
  const cleaned = normalizeDisplayText(text);
  const family = mediaTopicFamily(item);
  if (isBilibiliSignal(item) && !isMetaBilibiliTrend(item)) return `今日亮点：${cleaned.slice(0, 90)}。先看画面、玩法、评论和UP主表达，判断能否变成选题、试玩或潜在线索。`;
  if (isMetaBilibiliTrend(item)) return `B站趋势：${cleaned.slice(0, 90)}。重点看内容风向、UP主扩散和社区情绪变化。`;
  if (family === "product_ip") return `今日亮点：${cleaned.slice(0, 90)}。重点看它是否能变成B站选题、试玩推荐、IP节点或潜在线索。`;
  if (family === "business_legal") return `今日亮点：${cleaned.slice(0, 90)}。把公司/IP/法律/资本八卦当成BD尽调和窗口判断线索。`;
  if (family === "platform_market") return `行业新闻：${cleaned.slice(0, 90)}。重点看平台、渠道、政策或市场节奏是否改变发行打法。`;
  if (family === "creator_community") return `社区/创作者信号：${cleaned.slice(0, 80)}。重点看B站内容打法、达人合作和话题扩散。`;
  if (family === "ai_production") return `AI/工具链信号：${cleaned.slice(0, 80)}。重点看研发效率、素材风险、内容供给质量和平台合规。`;
  return cleaned.slice(0, 120);
}

function relevanceForMediaSignal(item) {
  const family = mediaTopicFamily(item);
  if (isBilibiliSignal(item) && !isMetaBilibiliTrend(item)) return "今日亮点用于把具体视频、试玩、PV和产品讨论转成B站商务可判断的线索。";
  if (isMetaBilibiliTrend(item)) return "B站趋势用于判断内容生态、UP主扩散和玩家话题是否正在改变。";
  if (family === "product_ip") return "今日亮点用于发现具体游戏、IP节点、好玩内容或可转化成B站选题的线索。";
  if (family === "business_legal") return "今日亮点中的八卦/公司事件用于辅助BD判断合作方可信度、权属风险和窗口变化。";
  if (family === "platform_market") return "行业新闻用于判断平台流量规则、渠道窗口、监管和发行资源配置是否变化。";
  if (family === "creator_community") return "对B站商务的价值在于判断是否能形成UP主选题、直播节点和社区扩散。";
  if (family === "ai_production") return "对BD判断的价值在于理解供给侧变化、研发效率和内容合规风险。";
  return "用于判断游戏行业外部环境、发行节奏和内容平台可介入窗口。";
}

function actionForMediaSignal(item) {
  const family = mediaTopicFamily(item);
  if (isBilibiliSignal(item) && !isMetaBilibiliTrend(item)) return "打开视频看实机、弹幕、评论和UP主结论；像产品线索的进入人工review，泛娱乐内容只做趋势观察。";
  if (isMetaBilibiliTrend(item)) return "记录正在扩散的内容形式、UP主类型和玩家争议点，供选品与内容合作复用。";
  if (family === "product_ip") return "点开原文看画面、玩法、热度和社区反应；值得玩的线索转入人工review或专题观察。";
  if (family === "business_legal") return "记录关键人、权属、诉讼、公司变化和发行占位，必要时进入合作方尽调。";
  if (family === "platform_market") return "提炼宏观变化对选品、上线窗口、渠道资源和内容投放的影响。";
  if (family === "creator_community") return "观察B站/YouTube/Twitch等内容扩散，筛选可合作达人和可复制选题。";
  if (family === "ai_production") return "关注产品是否涉及AI披露、素材争议、产能变化或平台合规风险。";
  return "只保留有BD启发的媒体信号；无业务动作的普通新闻不进雷达。";
}

function sourceTaggedItem(item, source) {
  return {
    ...item,
    source: source.name,
    source_focus: source.focus ?? [],
    source_quality: source.quality ?? 0
  };
}

function topicScore(text, pattern, points) {
  return pattern.test(text) ? points : 0;
}

function mediaTopicFamily(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (/\b(artificial intelligence|generative ai|genai|machine learning|deepmind|large language model|llm)\b|人工智能|生成式|aigc/i.test(text)) return "ai_production";
  if (/\b(steam|steam deck|epic games store|game pass|playstation|xbox|switch|nintendo|mobile|wishlist|demo|next fest|early access|store policy|platform|hardware|pricing|price|showcase|direct|state of play|summer game fest)\b|平台|商店|愿望单|试玩|新品节|抢先体验|主机|掌机|硬件|涨价|降价|定价|移动端|渠道|发布会|直面会/.test(text)) return "platform_market";
  if (/\b(publisher|publishing|acquisition|investment|funding|layoffs?|lawsuit|court|rights?|licen[cs]e|studio closure|executive|leadership)\b|出版|收购|投资|融资|裁员|诉讼|法院|判决|死刑|执行死刑|版权|授权|股权|高管|创始人|工作室|关停|监管|版号|财报/.test(text)) return "business_legal";
  if (/\b(expansion|dlc|major update|announced|showcase|release date|delay|remaster|remake|sequel|cross[- ]?media|adaptation|restarted from scratch)\b|资料片|大型更新|公布|发布会|延期|重制|续作|新作|改编|影视化|动画|联动|周年|上线|定档|发售|手游|端游/.test(text)) return "product_ip";
  if (/\b(streamer|creator|ugc|youtube|twitch|community|mod|viral|meme|esports)\b|主播|创作者|up主|视频|直播|社区|二创|模组|爆火|梗|赛事|传播/.test(text)) return "creator_community";
  return "industry_context";
}

function isMacroBusinessSignal(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  return /\b(acquisition|investment|funding|layoffs?|union|financial results|earnings|regulation|regulator|antitrust|publisher|publishing)\b|收购|投资|融资|裁员|工会|监管|版号|财报|资本|头部厂商|平台方|发行商/.test(text);
}

function isMetaBilibiliTrend(item) {
  if (!isBilibiliSignal(item)) return false;
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (/《[^》]+》|\bpv\b|\bdemo\b|实机|试玩|首曝|新作|上线|发售|公布|预告/.test(text)) return false;
  return /\b(trend|ranking|weekly|monthly|creator|streamer|community)\b|趋势|榜单|周榜|月榜|盘点|生态|up主|创作者|直播|热搜|话题|弹幕|播放|内容风向/.test(text);
}

function buildSteamMarketInsights(candidates, pools) {
  const clusters = buildSteamGenreSignals(candidates);
  const domestic = candidates.filter((candidate) => candidate.region === "中国");
  const demoCandidates = candidates.filter((candidate) => candidate.hasDemoSignal || /Demo|Next Fest|试玩|新品节/i.test(candidate.source));
  const strongDataCandidates = candidates.filter((candidate) => candidate.strongData || candidate.validatedPcHit || candidate.recommendationCount >= 500);
  const publisherRows = topPublishers(candidates);
  const upcomingLink = "https://store.steampowered.com/search/?filter=popularcomingsoon";
  const nextFestLink = "https://store.steampowered.com/sale/nextfest";
  const chartsLink = "https://steamdb.info/charts/";
  const topSellersLink = "https://store.steampowered.com/search/?filter=topsellers";

  return [
    steamInsight(
      "category_risers",
      `近期冒头品类：${clusters.slice(0, 3).map((item) => item.genre.replace(/（.+$/, "")).join("、") || "待观察"}`,
      clusters.length
        ? `样本中 ${clusters.slice(0, 4).map((item) => item.genre).join("、")} 最集中。重点不是标签热闹，而是这些品类是否有清晰循环、可剪视频看点和B站讨论空间。`
        : "今日 Steam 样本没有形成稳定品类聚类，先观察新品窗口和榜单波动。",
      "高",
      "Steam Store / AppDetails scan",
      upcomingLink,
      "优先打开头部样本看玩法循环和视频素材；只把能被UP主讲清楚、测得出差异的项目放进人工复核。"
    ),
    steamInsight(
      "demo_window",
      `Demo/活动窗口：${demoCandidates.length} 个候选带试玩或新品节信号`,
      `其中国内相关 ${demoCandidates.filter((candidate) => candidate.region === "中国").length} 个。Demo、Next Fest、热门即将推出比普通标签更接近可执行窗口，适合安排运营测试和内容预判。`,
      demoCandidates.length >= 8 ? "高" : "中",
      "Steam Demo / Next Fest / Upcoming",
      nextFestLink,
      "先测游戏，再决定商务；国内Demo优先排期，海外Demo必须同时看PC数据和手游化角度。"
    ),
    steamInsight(
      "publisher_slate",
      `发行商新品：${publisherRows.length ? publisherRows.slice(0, 4).map(([name, count]) => `${name}(${count})`).join("、") : "待确认"}`,
      publisherRows.length
        ? `今日样本里这些发行/开发主体重复出现。重复出现不等于可签，反而要判断是否已被成熟发行商占位、是否仍有中国区权益空间。`
        : "今日样本的发行商信息较分散，需要依靠单品质量和联系方式继续判断。",
      publisherRows.length ? "中" : "低",
      "Steam publisher/developer fields",
      topSellersLink,
      "对成熟发行商占位项目降低BD优先级；对国内自研或发行结构未明项目，测试通过后再补联系方式。"
    ),
    steamInsight(
      "data_quality",
      `数据面：${strongDataCandidates.length} 个样本有公开热度或强素材信号`,
      `扫描样本 ${candidates.length} 个，国内 ${domestic.length} 个，推荐数/口碑/强数据命中 ${strongDataCandidates.length} 个，素材充足样本 ${candidates.filter((candidate) => candidate.screenshotCount >= 6 || candidate.movieCount >= 1).length} 个。`,
      strongDataCandidates.length >= 8 ? "高" : "中",
      "Steam recommendations / media assets / SteamDB",
      chartsLink,
      "缺数据的项目不急着商务推进；先补公开视频、试玩反馈、愿望单/评论/社区证据，再决定进入跟进。"
    )
  ];
}

function buildSteamGenreSignals(candidates) {
  const clusters = [
    {
      genre: "Roguelike / Deckbuilder",
      pattern: /rogue|roguelike|deck|card|卡牌|构筑|肉鸽/i,
      why: "机制清晰、单局反馈强，适合B站做挑战、构筑分享、直播切片和攻略复盘。",
      action: "优先看是否有差异化机制、局外成长和可复播内容；只保留能被视频讲清楚的项目。",
      links: ["https://store.steampowered.com/tags/en/Roguelike/", "https://store.steampowered.com/tags/en/Deckbuilding/"]
    },
    {
      genre: "Strategy / Tactical",
      pattern: /strategy|tactical|turn|battle|war|策略|战棋|回合|战争|塔防/i,
      why: "策略品类容易形成长线讨论、攻略内容和核心用户沉淀，但上手门槛会影响破圈。",
      action: "看Demo是否能在前10分钟讲清核心决策；国内题材和强视觉反馈优先。",
      links: ["https://store.steampowered.com/tags/en/Strategy/", "https://store.steampowered.com/tags/en/Turn-Based%20Tactics/"]
    },
    {
      genre: "Simulation / Management",
      pattern: /simulation|management|tycoon|city builder|colony|simulator|模拟|经营|建造|管理/i,
      why: "经营模拟适合系列化视频、直播养成和社群二创，若主题独特可放大B站内容价值。",
      action: "优先筛选题材新、目标明确、可展示成长曲线的项目；纯数值堆叠谨慎。",
      links: ["https://store.steampowered.com/tags/en/Simulation/", "https://store.steampowered.com/tags/en/Management/"]
    },
    {
      genre: "Co-op / Multiplayer",
      pattern: /co-op|multiplayer|online co-op|party|pvp|多人|合作|联机|派对|对战/i,
      why: "多人协作/对抗天然适合直播和UP主联动，但服务器、匹配和运营成本要提前判断。",
      action: "看是否能形成多人节目效果；没有稳定测试和社区节奏的项目不急着推进商务。",
      links: ["https://store.steampowered.com/tags/en/Co-op/", "https://store.steampowered.com/tags/en/Multiplayer/"]
    },
    {
      genre: "Survival / Sandbox",
      pattern: /survival|sandbox|craft|open world|生存|沙盒|开放世界|建造/i,
      why: "生存沙盒容易产生长视频和社区服务器玩法，但内容体量、更新节奏和差异化很关键。",
      action: "看首测是否有明确生存压力、社交目标和长期内容；素材不足先观察。",
      links: ["https://store.steampowered.com/tags/en/Survival/", "https://store.steampowered.com/tags/en/Sandbox/"]
    },
    {
      genre: "Action / Visual Hook",
      pattern: /action|shooter|boss|combat|platformer|动作|射击|战斗|Boss|平台跳跃/i,
      why: "动作和强视觉项目更容易在B站首曝/PV/实机演示里被快速理解。",
      action: "优先看打击反馈、镜头语言、角色辨识度和Demo观感；普通动作壳不占用复核名额。",
      links: ["https://store.steampowered.com/tags/en/Action/", "https://store.steampowered.com/tags/en/Shooter/"]
    }
  ];

  return clusters
    .map((cluster) => {
      const matched = candidates.filter((candidate) => cluster.pattern.test(candidateGenreText(candidate)));
      const examples = matched.slice(0, 3).map((candidate) => candidate.title).join("、");
      return {
        ...cluster,
        count: matched.length,
        examples
      };
    })
    .filter((cluster) => cluster.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((cluster) => ({
      id: `steam_genre_${reportDate.replaceAll("-", "_")}_${normalizeText(cluster.genre).replace(/[^a-z0-9]+/g, "_")}`,
      genre: `${cluster.genre}（${cluster.count}/${candidates.length}）`,
      signal: `${cluster.count} 个候选命中；代表样本：${cluster.examples || "待打开Steam页确认"}。`,
      why_it_matters: cluster.why,
      bd_action: cluster.action,
      links: cluster.links
    }));
}

function selectSteamTrendSamples(candidates) {
  const selected = [];
  const seen = new Set();
  const validCandidates = candidates.filter((candidate) => !hardDropReason(candidate));
  for (const predicate of [
    (candidate) => candidate.region === "中国" && candidate.hasDemoSignal,
    (candidate) => candidate.region === "中国" && candidate.score >= 80,
    (candidate) => candidate.strongData || candidate.validatedPcHit,
    (candidate) => candidate.hasDemoSignal,
    () => true
  ]) {
    for (const candidate of validCandidates) {
      if (selected.length >= 12) return selected;
      if (seen.has(candidate.appId) || !predicate(candidate)) continue;
      selected.push(candidate);
      seen.add(candidate.appId);
    }
  }
  return selected;
}

function topPublishers(candidates) {
  const counts = new Map();
  for (const candidate of candidates) {
    const names = [...candidate.publishers, ...candidate.developers].filter(Boolean).slice(0, 2);
    for (const name of names) {
      if (/unknown|tbd|待确认/i.test(name)) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6);
}

function candidateGenreText(candidate) {
  return [
    candidate.title,
    candidate.shortDescription,
    ...(candidate.genres ?? []),
    ...(candidate.categories ?? []),
    candidate.source
  ].join(" ");
}

function describeSteamCluster(candidate) {
  const signal = buildSteamGenreSignals([candidate])[0]?.genre.replace(/（.+$/, "");
  if (signal) return signal;
  if (candidate.region === "中国") return "国内前置样本";
  if (candidate.validatedPcHit) return "海外PC数据样本";
  return "普通Upcoming样本";
}

function buildV5SteamSignal(candidate) {
  return [
    `大盘位置：${describeSteamCluster(candidate)}；来源 ${candidate.source}；发售窗口 ${candidate.releaseDate}。`,
    `公开数据：推荐数 ${candidate.recommendationCount || "无公开"}；素材 ${candidate.screenshotCount}图/${candidate.movieCount}视频；${candidate.hasDemoSignal ? "有Demo/试玩窗口" : "暂无明确Demo信号"}。`,
    `产品观察：${candidate.shortDescription || candidate.genres.join(" / ") || "待打开Steam页确认玩法循环"}。`,
    `BD判断：优势 ${buildProductStrength(candidate)}；风险 ${buildProductWeakness(candidate)}。`
  ].join("\n");
}

function buildV5TrendReason(candidate) {
  if (candidate.alreadyReleased) return "不建议推进：Steam 显示已发售，已错过前置BD窗口，只可作为市场复盘。";
  if (candidate.releaseTooSoon && candidate.region !== "中国") return "不建议推进：海外项目窗口过近，只作为市场背景。";
  if (candidate.earlyAccess) return "不建议推进：Early Access命中排除项。";
  if (candidate.publisherOccupied) return "不建议推进：成熟发行商可能已占位。";
  if (candidate.region === "中国") return `B站赋能：${buildBilibiliFit(candidate)} BD动作：先做实机/运营测试；测试不成立直接淘汰，测试成立再补联系人、官网和商务窗口。`;
  return `B站赋能：${buildBilibiliFit(candidate)} BD动作：${candidate.score >= 58 ? "优先确认中国区权益、联系方式、中文计划和Demo/愿望单数据。" : "先看PC数据和手游化角度，证据不足就不占用BD队列。"}`;
}

function buildProductStrength(candidate) {
  const strengths = [];
  if (candidate.strongGameplay) strengths.push("玩法具备机制表达空间");
  if (candidate.highVisual) strengths.push("截图/视频素材较完整");
  if (candidate.strongData) strengths.push("存在公开数据或榜单信号");
  if (candidate.region === "中国") strengths.push("国内项目，沟通效率和文化适配优先");
  if (candidate.region === "中国" && candidate.hasDemoSignal) strengths.push("国内开发者Demo/试玩信号，适合优先提测");
  if (candidate.region === "海外" && candidate.validatedPcHit && candidate.mobileAdaptationPotential) strengths.push("海外PC数据已验证，可从手游化/移动端改编角度观察");
  if (candidate.contactMethods.length) strengths.push("有可尝试联系入口");
  return strengths.join("；") || "目前只有基础Steam曝光，优势待复核";
}

function buildProductWeakness(candidate) {
  const weaknesses = [];
  if (typeof candidate.daysToRelease !== "number") weaknesses.push("发售窗口不精确");
  if (!candidate.strongData) weaknesses.push("缺愿望单/口碑/社区强数据");
  if (!candidate.highVisual) weaknesses.push("视觉素材不足，内容转化需验证");
  if (candidate.alreadyReleased) weaknesses.push("已发售，前置BD窗口已过");
  if (candidate.releaseTooSoon && !(candidate.region === "中国" && candidate.hasDemoSignal)) weaknesses.push("发售过近");
  if (candidate.region === "海外" && !candidate.validatedPcHit) weaknesses.push("海外项目缺少PC爆款数据验证");
  if (candidate.region === "海外" && !candidate.mobileAdaptationPotential) weaknesses.push("海外项目缺少手游化角度");
  if (candidate.publisherOccupied) weaknesses.push("发行可能已占位");
  return weaknesses.join("；") || "主要风险在团队地区、发行结构和中国区权益空间";
}

function radarItem(id, category, title, summary, heat, source, link, relevance, suggestedAction) {
  return { id: `radar_${reportDate.replaceAll("-", "_")}_${id}`, category, title, summary, heat, source, link, relevance, suggested_action: suggestedAction, captured_at: capturedAt };
}

function steamInsight(id, title, summary, signalLevel, source, link, suggestedAction) {
  return { id: `steam_macro_${reportDate.replaceAll("-", "_")}_${id}`, title, summary, signal_level: signalLevel, source, link, suggested_action: suggestedAction, captured_at: capturedAt };
}

function summarizeGenres(candidates) {
  const counts = new Map();
  for (const candidate of candidates) for (const genre of candidate.genres.slice(0, 4)) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([genre]) => genre);
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
  } finally {
    clearTimeout(timer);
  }
}

function defaultHeaders(accept) {
  return { "User-Agent": "Mozilla/5.0 SourcingCRM/1.0 (+https://github.com/Neo0109/CRM)", Accept: accept ?? "*/*" };
}

async function writeJson(relativePath, payload) {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function dedupeByAppId(items) {
  const byAppId = new Map();
  for (const item of items) {
    if (!item?.appId) continue;
    const appId = String(item.appId);
    const normalized = { ...item, appId };
    const current = byAppId.get(appId);
    if (!current || sourcePriority(normalized) > sourcePriority(current)) byAppId.set(appId, normalized);
  }
  return [...byAppId.values()];
}

function sourcePriority(item) {
  let priority = 0;
  if (item.domesticQuery) priority += 100;
  if (item.domesticLens) priority += 25;
  if (/Demo|Next Fest|试玩|新品节/i.test(item.source)) priority += 20;
  if (/Keyword|国产|中国|国风|修仙|武侠|肉鸽|卡牌|模拟经营/i.test(`${item.source} ${item.title}`)) priority += 15;
  if (/CN/.test(item.source)) priority += 5;
  return priority;
}

function stripPrivate(lead) {
  const { _class, media_score, ...rest } = lead;
  return rest;
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

function normalizeDisplayText(value) {
  return cleanExtractedText(value);
}

function cleanExtractedText(value) {
  return stripTags(decodeHtml(value)).replace(/\s+/g, " ").trim();
}

function hasGameOrBdContext(text, item) {
  const broadSources = new Set(["IT之家", "证券时报", "澎湃新闻"]);
  if (!broadSources.has(item.source)) return true;
  return /game|gaming|steam|xbox|playstation|nintendo|switch|publisher|developer|studio|bilibili|acg|ip|游戏|手游|端游|主机|电竞|动画|动漫|发行|发售|上线|资料片|腾讯游戏|网易游戏|米哈游|莉莉丝|心动|鹰角|游族|三体|版权|授权|版号|B站|哔哩哔哩/i.test(text);
}

function normalizeText(value) {
  return String(value ?? "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return String(value ?? "").trim().replace(/\/$/, "").toLowerCase();
  }
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
