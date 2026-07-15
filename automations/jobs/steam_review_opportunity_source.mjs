import { fetchJson, fetchText } from "./online_daily_v4_network.mjs";
import { fetchAppDetails } from "./online_daily_v4_steam_source.mjs";
import { cleanExtractedText, decodeHtml, sleep, stripTags } from "./online_daily_v4_source_utils.mjs";

export const STEAM_REVIEW_SOURCE_VERSION = "steam-schinese-reviews-v1";
export const STEAM_EARLY_ACCESS_TAG_ID = "493";
export const STEAM_REVIEW_LANGUAGE = "schinese";
export const STEAM_REVIEW_PURCHASE_TYPE = "all";

export function parseSteamCatalogPage(value, options = {}) {
  const payload = typeof value === "string" ? JSON.parse(value) : value ?? {};
  const html = String(payload.results_html ?? payload.html ?? "");
  const candidates = html
    .split(/<a\s+/i)
    .slice(1)
    .map((chunk, index) => parseSteamCatalogCandidate(`<a ${chunk}`, Number(options.start ?? 0) + index))
    .filter(Boolean);
  const totalCount = nonNegativeInteger(payload.total_count);

  return {
    totalCount,
    candidates
  };
}

export async function scanSteamPcCatalog(options = {}) {
  const fetchTextImpl = options.fetchTextImpl ?? fetchText;
  const pageSize = boundedInteger(options.pageSize, 50, 1, 100);
  const maxPages = options.maxPages === undefined
    ? Number.POSITIVE_INFINITY
    : boundedInteger(options.maxPages, 1, 1, 100000);
  const candidatesByAppId = new Map();
  const sourceFailures = [];
  let pagesScanned = 0;
  let catalogEntriesSeen = 0;
  let reportedTotal = null;
  let start = 0;
  let reachedEnd = false;

  while (pagesScanned < maxPages) {
    const url = buildSteamCatalogUrl({ start, count: pageSize });
    let parsed;
    try {
      parsed = parseSteamCatalogPage(await fetchTextImpl(url, {
        timeoutMs: options.timeoutMs ?? 15000,
        accept: "application/json,text/html;q=0.9,*/*;q=0.8"
      }), { start });
    } catch (error) {
      sourceFailures.push(sourceFailure("catalog", null, error));
      break;
    }

    pagesScanned += 1;
    catalogEntriesSeen += parsed.candidates.length;
    if (parsed.totalCount !== null) reportedTotal = parsed.totalCount;
    for (const candidate of parsed.candidates) {
      if (!candidatesByAppId.has(candidate.appId)) candidatesByAppId.set(candidate.appId, candidate);
    }

    start += pageSize;
    if (reportedTotal !== null && start >= reportedTotal) {
      reachedEnd = true;
      break;
    }
    if (parsed.candidates.length === 0 || (reportedTotal === null && parsed.candidates.length < pageSize)) {
      reachedEnd = true;
      break;
    }
  }

  return {
    summary: {
      scanComplete: reachedEnd && sourceFailures.length === 0,
      pagesScanned,
      catalogEntriesSeen,
      uniqueAppsSeen: candidatesByAppId.size,
      reportedTotal,
      sourceFailures
    },
    candidates: [...candidatesByAppId.values()]
  };
}

export function prefilterSteamReviewCandidates(candidates) {
  return candidates.filter((candidate) => {
    const totalReviews = candidate?.catalogReviewSummary?.totalReviews;
    if (!Number.isInteger(totalReviews)) return false;
    if (totalReviews >= 10000) return true;
    return candidate.earlyAccessTag === true && totalReviews >= 1000;
  });
}

export async function fetchSteamReviewSummary(appId, context = {}) {
  const fetchJsonImpl = context.fetchJsonImpl ?? fetchJson;
  const sleepImpl = context.sleepImpl ?? sleep;
  const logger = context.logger ?? console;
  const url = buildSteamReviewUrl(appId);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const payload = await fetchJsonImpl(url);
      return normalizeSteamReviewSummary(payload);
    } catch (error) {
      if (attempt < 3 && /429|too many requests/i.test(String(error?.message))) {
        await sleepImpl(2000 * attempt);
        continue;
      }
      logger.warn?.(`Steam simplified-Chinese review summary failed for ${appId}: ${error.message}`);
      return unknownReviewSummary();
    }
  }

  return unknownReviewSummary();
}

export function normalizeSteamReviewSummary(payload) {
  const summary = payload?.success === 1 ? payload.query_summary : null;
  const positiveReviews = nonNegativeInteger(summary?.total_positive);
  const negativeReviews = nonNegativeInteger(summary?.total_negative);
  const totalReviews = nonNegativeInteger(summary?.total_reviews);
  if (positiveReviews === null || negativeReviews === null || totalReviews === null) {
    return unknownReviewSummary();
  }

  return {
    status: "available",
    text: stringOrNull(summary?.review_score_desc),
    positiveReviews,
    negativeReviews,
    totalReviews,
    positiveRate: totalReviews === 0 ? 0 : roundRate((positiveReviews / totalReviews) * 100),
    language: STEAM_REVIEW_LANGUAGE,
    purchaseType: STEAM_REVIEW_PURCHASE_TYPE,
    sourceStatus: "steam_appreviews"
  };
}

export function officialStoreEarlyAccess(details) {
  if (!details || typeof details !== "object") return null;
  if (details.early_access === true || details.is_early_access === true || details.release_date?.early_access === true) return true;
  const genres = Array.isArray(details.genres) ? details.genres : [];
  const categories = Array.isArray(details.categories) ? details.categories : [];
  if (genres.some((item) => String(item?.id) === "70")) return true;
  const structuredText = [...genres, ...categories].map((item) => item?.description).filter(Boolean).join(" ");
  return /early access|抢先体验/i.test(structuredText);
}

export function evaluateSteamReviewOpportunity({
  reviewSummary,
  catalogEarlyAccess,
  storeEarlyAccess
}) {
  const totalReviews = Number(reviewSummary?.totalReviews);
  const positiveRate = Number(reviewSummary?.positiveRate);
  const reviewEvidenceKnown = reviewSummary?.status === "available"
    && Number.isFinite(totalReviews)
    && totalReviews >= 0
    && Number.isFinite(positiveRate)
    && positiveRate >= 0
    && positiveRate <= 100;

  if (!reviewEvidenceKnown) {
    return {
      decision: "needs_evidence",
      matchedRules: [],
      primaryLane: null,
      missingEvidence: ["steam_schinese_review_summary"],
      exclusionReasons: []
    };
  }

  const eaReviewThreshold = totalReviews >= 1000 && positiveRate >= 80;
  const eaConfirmed = catalogEarlyAccess === true && storeEarlyAccess === true;
  const chinaHeatQualified = totalReviews >= 10000;
  const eaQualified = eaReviewThreshold && eaConfirmed;
  const matchedRules = [
    eaQualified ? "ea_mobile_high_traction" : null,
    chinaHeatQualified ? "china_heat_ops" : null
  ].filter(Boolean);
  const primaryLane = chinaHeatQualified
    ? "china_heat_ops"
    : eaQualified
      ? "ea_mobile_high_traction"
      : null;

  if (matchedRules.length) {
    return {
      decision: "qualified",
      matchedRules,
      primaryLane,
      missingEvidence: [],
      exclusionReasons: []
    };
  }

  if (eaReviewThreshold && catalogEarlyAccess === true && storeEarlyAccess === null) {
    return {
      decision: "needs_evidence",
      matchedRules,
      primaryLane,
      missingEvidence: ["steam_store_early_access_state"],
      exclusionReasons: []
    };
  }

  return {
    decision: "not_qualified",
    matchedRules,
    primaryLane,
    missingEvidence: [],
    exclusionReasons: [
      totalReviews < 1000 ? "ea_reviews_below_1000" : null,
      positiveRate < 80 ? "ea_positive_rate_below_80" : null,
      catalogEarlyAccess !== true ? "ea_catalog_tag_not_confirmed" : null,
      storeEarlyAccess !== true ? "ea_store_state_not_confirmed" : null,
      totalReviews < 10000 ? "china_heat_reviews_below_10000" : null
    ].filter(Boolean)
  };
}

export async function collectSteamReviewOpportunities(options = {}) {
  const scanCatalogImpl = options.scanCatalogImpl ?? (() => scanSteamPcCatalog(options));
  const fetchReviewSummaryImpl = options.fetchReviewSummaryImpl
    ?? ((appId) => fetchSteamReviewSummary(appId, options));
  const fetchAppDetailsImpl = options.fetchAppDetailsImpl
    ?? ((appId) => fetchAppDetails(appId, options));
  const sleepImpl = options.sleepImpl ?? sleep;
  const requestDelayMs = Math.max(0, Number(options.requestDelayMs ?? 0));
  const concurrency = boundedInteger(options.concurrency, 2, 1, 10);
  const scan = await scanCatalogImpl(options);
  const candidates = prefilterSteamReviewCandidates(scan.candidates ?? []);
  const opportunities = [];
  const sourceFailures = [...(scan.summary?.sourceFailures ?? [])];

  for (let index = 0; index < candidates.length; index += concurrency) {
    const chunk = candidates.slice(index, index + concurrency);
    const records = await Promise.all(chunk.map(async (candidate) => {
      const [reviewResult, detailsResult] = await Promise.all([
        safeSourceCall("reviews", candidate.appId, () => fetchReviewSummaryImpl(candidate.appId)),
        safeSourceCall("appdetails", candidate.appId, () => fetchAppDetailsImpl(candidate.appId))
      ]);
      if (reviewResult.failure) sourceFailures.push(reviewResult.failure);
      if (detailsResult.failure) sourceFailures.push(detailsResult.failure);
      const reviewSummary = reviewResult.value ?? unknownReviewSummary();
      if (!reviewResult.failure && reviewSummary.status !== "available") {
        sourceFailures.push(sourceFailure("reviews", candidate.appId, "official review summary unavailable"));
      }
      if (!detailsResult.failure && !detailsResult.value) {
        sourceFailures.push(sourceFailure("appdetails", candidate.appId, "official store details unavailable"));
      }
      const storeEarlyAccess = officialStoreEarlyAccess(detailsResult.value);
      const evaluation = evaluateSteamReviewOpportunity({
        reviewSummary,
        catalogEarlyAccess: candidate.earlyAccessTag,
        storeEarlyAccess
      });

      return {
        appId: candidate.appId,
        title: detailsResult.value?.name ?? candidate.title,
        storeUrl: `https://store.steampowered.com/app/${candidate.appId}/`,
        catalogReviewSummary: candidate.catalogReviewSummary,
        reviewSummary,
        earlyAccess: {
          catalogTag: candidate.earlyAccessTag ? "yes" : "no",
          storeState: storeEarlyAccess === null ? "unknown" : storeEarlyAccess ? "yes" : "no",
          confirmedCurrent: candidate.earlyAccessTag === true && storeEarlyAccess === true
        },
        decision: evaluation.decision,
        matchedRules: evaluation.matchedRules,
        primaryLane: evaluation.primaryLane,
        missingEvidence: evaluation.missingEvidence,
        exclusionReasons: evaluation.exclusionReasons
      };
    }));
    opportunities.push(...records);
    if (requestDelayMs > 0 && index + concurrency < candidates.length) await sleepImpl(requestDelayMs);
  }

  const decisionCount = (decision) => opportunities.filter((item) => item.decision === decision).length;
  return {
    summary: {
      ...(scan.summary ?? {}),
      scanComplete: scan.summary?.scanComplete === true && sourceFailures.length === 0,
      sourceFailures,
      prefilterMatches: candidates.length,
      officialReviewsConfirmed: opportunities.filter((item) => item.reviewSummary.status === "available").length,
      storeDetailsConfirmed: opportunities.filter((item) => item.earlyAccess.storeState !== "unknown").length,
      qualified: decisionCount("qualified"),
      notQualified: decisionCount("not_qualified"),
      needsEvidence: decisionCount("needs_evidence")
    },
    opportunities
  };
}

function parseSteamCatalogCandidate(chunk, sourceIndex) {
  const appId = chunk.match(/data-ds-appid=["']\[?(\d+)/i)?.[1] ?? chunk.match(/\/app\/(\d+)\//)?.[1] ?? null;
  const rawTitle = chunk.match(/<span[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]
    ?? chunk.match(/title=["']([^"']+)["']/i)?.[1]
    ?? "";
  const title = decodeHtml(stripTags(rawTitle)).trim();
  if (!appId || !title) return null;
  const tagIds = parseTagIds(chunk);
  const catalogReviewSummary = parseCatalogReviewSummary(chunk);
  const earlyAccessTag = tagIds.includes(STEAM_EARLY_ACCESS_TAG_ID) || /early access|抢先体验/i.test(cleanExtractedText(chunk));

  return {
    appId: String(appId),
    title,
    storeUrl: `https://store.steampowered.com/app/${appId}/`,
    sourceIndex,
    tagIds,
    earlyAccessTag,
    catalogReviewSummary
  };
}

function parseTagIds(chunk) {
  const raw = chunk.match(/data-ds-tagids=["'](\[[^"']*\])["']/i)?.[1];
  if (!raw) return [];
  try {
    return JSON.parse(raw).map(String);
  } catch {
    return [...raw.matchAll(/\d+/g)].map((match) => match[0]);
  }
}

function parseCatalogReviewSummary(chunk) {
  const element = chunk.match(/<(?:span|div)[^>]*class=["'][^"']*search_review(?:_summary|score)[^"']*["'][^>]*>[\s\S]*?<\/(?:span|div)>/i)?.[0] ?? "";
  const openingTag = element.match(/^<[^>]+>/)?.[0] ?? "";
  const tooltip = openingTag.match(/data-tooltip-html=(["'])([\s\S]*?)\1/i)?.[2] ?? "";
  const text = cleanExtractedText(`${tooltip} ${element}`);
  const countText = text.match(/([\d\s,，]+)\s*(?:篇|条)?\s*(?:用户)?(?:评测|评价|reviews?)/i)?.[1] ?? null;
  const totalReviews = countText === null ? null : nonNegativeInteger(countText.replace(/[\s,，]/g, ""));
  return {
    status: totalReviews === null ? "unknown" : "available",
    text: text || null,
    totalReviews,
    usage: "prefilter_only"
  };
}

function buildSteamCatalogUrl({ start, count }) {
  const url = new URL("https://store.steampowered.com/search/results/");
  url.searchParams.set("start", String(start));
  url.searchParams.set("count", String(count));
  url.searchParams.set("dynamic_data", "");
  url.searchParams.set("infinite", "1");
  url.searchParams.set("category1", "998");
  url.searchParams.set("os", "win");
  url.searchParams.set("cc", "cn");
  url.searchParams.set("l", STEAM_REVIEW_LANGUAGE);
  url.searchParams.set("ignore_preferences", "1");
  return url.toString();
}

function buildSteamReviewUrl(appId) {
  const url = new URL(`https://store.steampowered.com/appreviews/${encodeURIComponent(String(appId))}`);
  url.searchParams.set("json", "1");
  url.searchParams.set("filter", "all");
  url.searchParams.set("language", STEAM_REVIEW_LANGUAGE);
  url.searchParams.set("day_range", "365");
  url.searchParams.set("cursor", "*");
  url.searchParams.set("review_type", "all");
  url.searchParams.set("purchase_type", STEAM_REVIEW_PURCHASE_TYPE);
  url.searchParams.set("num_per_page", "1");
  return url.toString();
}

function unknownReviewSummary() {
  return {
    status: "unknown",
    text: null,
    positiveReviews: null,
    negativeReviews: null,
    totalReviews: null,
    positiveRate: null,
    language: STEAM_REVIEW_LANGUAGE,
    purchaseType: STEAM_REVIEW_PURCHASE_TYPE,
    sourceStatus: "not_fetched"
  };
}

async function safeSourceCall(stage, appId, callback) {
  try {
    return { value: await callback(), failure: null };
  } catch (error) {
    return { value: null, failure: sourceFailure(stage, appId, error) };
  }
}

function sourceFailure(stage, appId, error) {
  return {
    stage,
    appId: appId === null ? null : String(appId),
    message: String(error?.message ?? error ?? "unknown error")
  };
}

function nonNegativeInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

function roundRate(value) {
  return Number(Number(value).toFixed(4));
}

function stringOrNull(value) {
  const text = String(value ?? "").trim();
  return text || null;
}
