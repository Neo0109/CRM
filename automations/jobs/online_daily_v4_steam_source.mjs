import { scoreCandidate } from "./online_daily_v4_decision.mjs";
import { fetchJson, fetchText } from "./online_daily_v4_network.mjs";
import {
  buildSteamOfficialDemoEvidence,
  buildSteamOfficialGameplayEvidence,
  buildVerifiedPublicQualityProofs,
  deriveConcreteChinaBilibiliValue,
  deriveExplicitChinaDemandEvidence
} from "./online_daily_v7_indie_admission.mjs";
import {
  addContact,
  cleanExtractedText,
  daysUntil,
  decodeHtml,
  firstRealWebsite,
  hasMaturePublisher,
  isDomesticDiscoveryQuery,
  isSteamStoreLike,
  looksDomestic,
  normalizeReleaseDate,
  sleep,
  stripTags
} from "./online_daily_v4_source_utils.mjs";

export function buildSteamCandidateTasks(context = {}) {
  const fetchSteamSearchImpl = context.fetchSteamSearchImpl ?? fetchSteamSearch;
  const fetchFeaturedCategoriesImpl = context.fetchFeaturedCategoriesImpl ?? fetchFeaturedCategories;
  return [
    () => fetchSteamSearchImpl("popularcomingsoon", "Steam CN Domestic Demo Keyword", [], { cc: "cn", l: "schinese", domesticLens: true, query: "国产 Demo", ...context }),
    () => fetchSteamSearchImpl("popularcomingsoon", "Steam CN Indie Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "国产 独立游戏", ...context }),
    () => fetchSteamSearchImpl("popularcomingsoon", "Steam CN China Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "中国", ...context }),
    () => fetchSteamSearchImpl("popularcomingsoon", "Steam CN Guofeng Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "国风", ...context }),
    () => fetchSteamSearchImpl("popularcomingsoon", "Steam CN Deckbuilder Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "卡牌 构筑", ...context }),
    () => fetchSteamSearchImpl("popularcomingsoon", "Steam CN Roguelike Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "肉鸽", ...context }),
    () => fetchSteamSearchImpl("popularcomingsoon", "Steam CN Management Keyword Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, query: "模拟经营", ...context }),
    () => fetchSteamSearchImpl("popularcomingsoon", "Steam CN Popular Upcoming", [], { cc: "cn", l: "schinese", domesticLens: true, ...context }),
    () => fetchSteamSearchImpl("popularcomingsoon", "Steam CN Demo/Next Fest Window", [21], { cc: "cn", l: "schinese", domesticLens: true, ...context }),
    () => fetchSteamSearchImpl("popularcomingsoon", "Steam CN Strategy Upcoming", [9], { cc: "cn", l: "schinese", domesticLens: true, ...context }),
    () => fetchSteamSearchImpl("popularcomingsoon", "Steam CN Simulation Upcoming", [599], { cc: "cn", l: "schinese", domesticLens: true, ...context }),
    () => fetchSteamSearchImpl("popularcomingsoon", "Steam CN Roguelike Upcoming", [1716], { cc: "cn", l: "schinese", domesticLens: true, ...context }),
    () => fetchSteamSearchImpl("popularcomingsoon", "Steam CN Deckbuilder Upcoming", [32322], { cc: "cn", l: "schinese", domesticLens: true, ...context }),
    () => fetchSteamSearchImpl("popularcomingsoon", "Steam Popular Upcoming", [], context),
    () => fetchSteamSearchImpl("popularcomingsoon", "Steam Demo/Next Fest Window", [21], context),
    () => fetchSteamSearchImpl("popularcomingsoon", "Strategy Upcoming", [9], context),
    () => fetchSteamSearchImpl("popularcomingsoon", "Simulation Upcoming", [599], context),
    () => fetchSteamSearchImpl("popularcomingsoon", "Roguelike Upcoming", [1716], context),
    () => fetchSteamSearchImpl("popularcomingsoon", "Deckbuilder Upcoming", [32322], context),
    () => fetchFeaturedCategoriesImpl(context)
  ];
}

export async function fetchSteamSearch(filter, source, tags = [], options = {}) {
  const fetchTextImpl = options.fetchTextImpl ?? fetchText;
  const logger = options.logger ?? console;
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
    const text = await fetchTextImpl(resultUrl.toString(), { timeoutMs: 12000, accept: "application/json,text/html;q=0.9,*/*;q=0.8" });
    const parsed = tagSearchCandidates(parseSteamSearchHtml(parseMaybeJsonHtml(text), source), options);
    if (parsed.length) return parsed;
    return tagSearchCandidates(parseSteamSearchHtml(await fetchTextImpl(pageUrl.toString(), { timeoutMs: 12000, accept: "text/html,*/*;q=0.8" }), source), options);
  } catch (error) {
    logger.warn?.(`Steam search failed for ${source}: ${error.message}`);
    return [];
  }
}

export function tagSearchCandidates(items, options) {
  return items.map((item) => ({
    ...item,
    domesticLens: Boolean(options.domesticLens),
    domesticQuery: Boolean(options.domesticQuery ?? isDomesticDiscoveryQuery(options.query ?? ""))
  }));
}

export function parseMaybeJsonHtml(text) {
  try {
    const payload = JSON.parse(text);
    return payload.results_html ?? payload.html ?? text;
  } catch {
    return text;
  }
}

export function parseSteamSearchHtml(html, source) {
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

export async function fetchFeaturedCategories(context = {}) {
  const fetchJsonImpl = context.fetchJsonImpl ?? fetchJson;
  const logger = context.logger ?? console;
  try {
    const payload = await fetchJsonImpl("https://store.steampowered.com/api/featuredcategories?cc=us&l=english");
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
    logger.warn?.(`Steam featured categories failed: ${error.message}`);
    return [];
  }
}

export async function fetchAppDetails(appId, context = {}) {
  const fetchJsonImpl = context.fetchJsonImpl ?? fetchJson;
  const sleepImpl = context.sleepImpl ?? sleep;
  const logger = context.logger ?? console;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const payload = await fetchJsonImpl(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=english`);
      const entry = payload[String(appId)];
      const acceptedAppTypes = Array.isArray(context.acceptedAppTypes) && context.acceptedAppTypes.length
        ? context.acceptedAppTypes
        : ["game"];
      return entry?.success && acceptedAppTypes.includes(entry.data?.type) ? entry.data : null;
    } catch (error) {
      if (attempt < 3 && /429|too many requests/i.test(error.message)) {
        await sleepImpl(2500 * attempt);
        continue;
      }
      logger.warn?.(`AppDetails failed for ${appId}: ${error.message}`);
      return null;
    }
  }
  return null;
}

export async function enrichSteamCandidates(candidates, context = {}) {
  const enriched = [];
  const concurrency = context.concurrency ?? 2;
  const fetchAppDetailsImpl = context.fetchAppDetailsImpl ?? ((appId) => fetchAppDetails(appId, context));
  const sleepImpl = context.sleepImpl ?? sleep;
  for (let index = 0; index < candidates.length; index += concurrency) {
    const chunk = candidates.slice(index, index + concurrency);
    const results = await Promise.all(chunk.map(async (candidate) => {
      const details = await fetchAppDetailsImpl(candidate.appId);
      return enrichSteamCandidate(candidate, details, context);
    }));
    enriched.push(...results);
    if (index + concurrency < candidates.length) await sleepImpl(1200);
  }
  return enriched;
}

export function prioritizeSteamCandidatesForReview(candidates, context = {}) {
  return [...candidates].sort((a, b) => {
    const diff = steamCandidateReviewWindowScore(b, context) - steamCandidateReviewWindowScore(a, context);
    if (diff) return diff;
    return (a.sourceIndex ?? 999) - (b.sourceIndex ?? 999);
  });
}

export function steamCandidateReviewWindowScore(candidate, context = {}) {
  const reportDate = context.reportDate ?? new Date().toISOString().slice(0, 10);
  const releaseDate = normalizeReleaseDate(candidate.release);
  const daysToRelease = daysUntil(releaseDate, reportDate);
  let score = 0;

  if (candidate.domesticQuery) score += 100;
  if (candidate.domesticLens) score += 35;
  if (/Demo|Next Fest|试玩|新品节/i.test(candidate.source ?? "")) score += 18;
  if (/Keyword|国产|中国|国风|修仙|武侠|肉鸽|卡牌|模拟经营/i.test(`${candidate.source ?? ""} ${candidate.title ?? ""}`)) score += 12;
  if (/CN/.test(candidate.source ?? "")) score += 5;

  if (typeof daysToRelease === "number") {
    if (daysToRelease < 0) score -= 220;
    else if (daysToRelease < 60) score -= 170;
    else if (daysToRelease <= 365) score += 140;
    else score += 80;
  } else if (/coming soon|tba|to be announced|待定|即将/i.test(`${candidate.release ?? ""}`)) {
    score += 90;
  } else {
    score += 30;
  }

  return score;
}

export async function enrichSteamCandidate(candidate, details, context = {}) {
  const reportDate = context.reportDate ?? new Date().toISOString().slice(0, 10);
  const scoreCandidateImpl = context.scoreCandidateImpl ?? scoreCandidate;
  const collectContactMethodsImpl = context.collectContactMethodsImpl ?? ((nextDetails, appId) => collectContactMethods(nextDetails, appId, context));
  const developers = Array.isArray(details?.developers) ? details.developers : [];
  const publishers = Array.isArray(details?.publishers) ? details.publishers : [];
  const genres = [...new Set([...(details?.genres ?? []).map((genre) => genre.description), ...(candidate.tags ?? [])].filter(Boolean))].slice(0, 6);
  const categories = (details?.categories ?? []).map((category) => category.description).slice(0, 8);
  const text = [candidate.title, details?.name, details?.short_description, ...developers, ...publishers, ...genres, ...categories].join(" ");
  const lower = text.toLowerCase();
  const releaseDate = normalizeReleaseDate(details?.release_date?.date ?? candidate.release);
  const daysToRelease = daysUntil(releaseDate, reportDate);
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
  const contactMethods = await collectContactMethodsImpl(details, candidate.appId);
  const score = scoreCandidateImpl({ source: candidate.source, domestic, domesticLens: Boolean(candidate.domesticLens), domesticQuery: Boolean(candidate.domesticQuery), hasDemoSignal, strongGameplay, highVisual, strongData, validatedPcHit, mobileAdaptationPotential, alreadyReleased, releaseTooSoon, earlyAccess, narrativeHeavy, indiaTeam, publisherOccupied, comingSoon, hasDetails: Boolean(details), contactCount: contactMethods.length });
  const officialDemoEvidence = buildSteamOfficialDemoEvidence(details, candidate.appId);
  const officialGameplayEvidence = buildSteamOfficialGameplayEvidence(details);
  const qualityProofs = buildVerifiedPublicQualityProofs(details, candidate.appId);
  const chinaBilibiliValue = deriveConcreteChinaBilibiliValue(`${genres.join(" ")} ${categories.join(" ")}`);
  const chinaDemandEvidence = deriveExplicitChinaDemandEvidence(
    details?.short_description,
    details?.detailed_description,
    details?.about_the_game,
    details?.supported_languages
  );

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
    officialDemoEvidence,
    officialGameplayEvidence,
    qualityProofs,
    chinaBilibiliValue,
    chinaDemandEvidence,
    reviewText: candidate.reviewText ?? "",
    domesticQuery: Boolean(candidate.domesticQuery),
    releaseTooSoon,
    score
  };
}

export function isNarrativeHeavy(lowerText, genres) {
  const genreText = genres.join(" ").toLowerCase();
  if (/visual novel|interactive fiction|story rich|narrative|walking simulator|视觉小说|文字冒险|互动小说|剧情向|叙事/.test(lowerText)) return true;
  if (/jrpg|adventure/.test(genreText) && /story|legend|novel|chapter|dialogue|romance|mystery/.test(lowerText) && !/deckbuilder|strategy|simulation|management|co-op|multiplayer|roguelike|sandbox|survival/.test(lowerText)) return true;
  return false;
}

export function hasStrongPublicData(reviewText, source, details) {
  const text = `${reviewText ?? ""} ${source ?? ""}`.toLowerCase();
  if (/very positive|overwhelmingly positive|好评如潮|特别好评|wishlist|愿望单/.test(text)) return true;
  if ((details?.recommendations?.total ?? 0) >= 500) return true;
  return false;
}

export function hasValidatedPcHit(reviewText, details) {
  const recommendations = details?.recommendations?.total ?? 0;
  const text = `${reviewText ?? ""} ${details?.name ?? ""} ${details?.short_description ?? ""}`.toLowerCase();
  if (recommendations >= 5000) return true;
  if (recommendations >= 1500 && /very positive|overwhelmingly positive|好评如潮|特别好评/.test(text)) return true;
  if (/overwhelmingly positive|好评如潮/.test(text)) return true;
  return false;
}

export function hasMobileAdaptationPotential(text, genres, categories) {
  const joined = `${text} ${genres.join(" ")} ${categories.join(" ")}`.toLowerCase();
  return /card|deckbuilder|turn[- ]?based|strategy|simulation|management|tycoon|puzzle|idle|roguelike|tactical|auto battler|tower defense|city builder|colony|survivors-like|卡牌|构筑|回合|策略|模拟|经营|放置|肉鸽|塔防|战棋|自走棋/.test(joined);
}

export async function collectContactMethods(details, appId, context = {}) {
  const methods = [];
  const support = details?.support_info ?? {};
  const website = firstRealWebsite(details?.website, support.url);
  addContact(methods, "Email", support.email, "Steam support email");
  addContact(methods, "官网", website, "Steam official website");
  if (support.url !== website) addContact(methods, "官网", support.url, "Steam support URL");

  if (website) {
    const contactsFromWebsiteImpl = context.contactsFromWebsiteImpl ?? ((nextWebsite) => contactsFromWebsite(nextWebsite, context));
    for (const method of await contactsFromWebsiteImpl(website)) addContact(methods, method.type, method.value, method.note);
  }

  addContact(methods, "Steam", `https://steamcommunity.com/app/${appId}/discussions/`, methods.length ? "Steam community backup" : "Official Steam community fallback");
  return methods.slice(0, 4);
}

export async function contactsFromWebsite(website, context = {}) {
  const fetchTextImpl = context.fetchTextImpl ?? fetchText;
  try {
    const html = await fetchTextImpl(website, { timeoutMs: 7000, accept: "text/html,*/*;q=0.8" });
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

export { firstRealWebsite, isSteamStoreLike };
