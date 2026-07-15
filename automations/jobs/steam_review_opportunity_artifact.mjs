import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { serializeArtifact } from "./online_daily_v4_artifacts.mjs";
import { STEAM_REVIEW_SOURCE_VERSION } from "./steam_review_opportunity_source.mjs";

export const STEAM_REVIEW_OPPORTUNITY_SCHEMA_VERSION = 1;

export function buildSteamReviewOpportunityArtifact({
  reportDate,
  generatedAt,
  collection
}) {
  const summary = collection?.summary ?? {};
  const opportunities = (collection?.opportunities ?? []).map(toAuditOpportunity);
  return {
    schema_version: STEAM_REVIEW_OPPORTUNITY_SCHEMA_VERSION,
    report_date: reportDate,
    generated_at: generatedAt,
    source_contract: STEAM_REVIEW_SOURCE_VERSION,
    scan_summary: {
      scan_complete: summary.scanComplete === true,
      pages_scanned: integerOrZero(summary.pagesScanned),
      catalog_entries_seen: integerOrZero(summary.catalogEntriesSeen),
      unique_apps_seen: integerOrZero(summary.uniqueAppsSeen),
      reported_total: nullableInteger(summary.reportedTotal),
      prefilter_matches: integerOrZero(summary.prefilterMatches),
      records_total: opportunities.length,
      official_reviews_confirmed: integerOrZero(summary.officialReviewsConfirmed),
      store_details_confirmed: integerOrZero(summary.storeDetailsConfirmed),
      qualified: integerOrZero(summary.qualified),
      not_qualified: integerOrZero(summary.notQualified),
      needs_evidence: integerOrZero(summary.needsEvidence),
      source_failures: (summary.sourceFailures ?? []).map((failure) => ({
        stage: String(failure?.stage ?? "catalog"),
        steam_app_id: stringOrNull(failure?.appId ?? failure?.steam_app_id),
        message: String(failure?.message ?? "unknown source failure")
      }))
    },
    opportunities
  };
}

export function validateSteamReviewOpportunityArtifact(artifact) {
  const errors = [];
  if (artifact?.schema_version !== STEAM_REVIEW_OPPORTUNITY_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${STEAM_REVIEW_OPPORTUNITY_SCHEMA_VERSION}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(artifact?.report_date ?? ""))) {
    errors.push("report_date must use YYYY-MM-DD");
  }
  if (!isIsoDateTime(artifact?.generated_at)) errors.push("generated_at must be an ISO date-time");
  if (artifact?.source_contract !== STEAM_REVIEW_SOURCE_VERSION) {
    errors.push(`source_contract must be ${STEAM_REVIEW_SOURCE_VERSION}`);
  }

  const summary = artifact?.scan_summary ?? {};
  const opportunities = Array.isArray(artifact?.opportunities) ? artifact.opportunities : [];
  if (!Array.isArray(artifact?.opportunities)) errors.push("opportunities must be an array");
  for (const key of [
    "pages_scanned",
    "catalog_entries_seen",
    "unique_apps_seen",
    "prefilter_matches",
    "records_total",
    "official_reviews_confirmed",
    "store_details_confirmed",
    "qualified",
    "not_qualified",
    "needs_evidence"
  ]) {
    if (!isNonNegativeInteger(summary[key])) errors.push(`scan_summary.${key} must be a non-negative integer`);
  }
  if (typeof summary.scan_complete !== "boolean") errors.push("scan_summary.scan_complete must be a boolean");
  if (summary.reported_total !== null && !isNonNegativeInteger(summary.reported_total)) {
    errors.push("scan_summary.reported_total must be null or a non-negative integer");
  }
  if (!Array.isArray(summary.source_failures)) errors.push("scan_summary.source_failures must be an array");
  if (summary.scan_complete === true && (summary.source_failures?.length ?? 0) > 0) {
    errors.push("scan_complete cannot be true when source_failures are present");
  }

  const seenAppIds = new Set();
  for (const opportunity of opportunities) {
    const appId = String(opportunity?.steam_app_id ?? "");
    if (!/^\d+$/.test(appId)) errors.push("opportunity steam_app_id must contain digits only");
    if (seenAppIds.has(appId)) errors.push(`duplicate steam_app_id: ${appId}`);
    seenAppIds.add(appId);
    validateOpportunity(opportunity, errors);
  }

  const actual = {
    records_total: opportunities.length,
    prefilter_matches: opportunities.length,
    official_reviews_confirmed: opportunities.filter((item) => item?.steam_review_summary?.status === "available").length,
    store_details_confirmed: opportunities.filter((item) => item?.early_access?.store_state !== "unknown").length,
    qualified: opportunities.filter((item) => item?.decision === "qualified").length,
    not_qualified: opportunities.filter((item) => item?.decision === "not_qualified").length,
    needs_evidence: opportunities.filter((item) => item?.decision === "needs_evidence").length
  };
  for (const [key, value] of Object.entries(actual)) {
    if (summary[key] !== value) errors.push(`scan_summary.${key} expected ${value}, received ${summary[key]}`);
  }

  if (errors.length) {
    throw new Error(`Steam review opportunity artifact validation failed:\n- ${errors.join("\n- ")}`);
  }
  return { ok: true, records: opportunities.length };
}

export async function writeSteamReviewOpportunityArtifact(filePath, artifact) {
  validateSteamReviewOpportunityArtifact(artifact);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, serializeArtifact(artifact), "utf8");
  return filePath;
}

function toAuditOpportunity(value) {
  return {
    steam_app_id: String(value?.appId ?? ""),
    project: String(value?.title ?? "").trim(),
    store_url: String(value?.storeUrl ?? ""),
    catalog_review_summary: {
      status: value?.catalogReviewSummary?.status ?? "unknown",
      text: stringOrNull(value?.catalogReviewSummary?.text),
      total_reviews: nullableInteger(value?.catalogReviewSummary?.totalReviews),
      usage: "prefilter_only"
    },
    steam_review_summary: {
      status: value?.reviewSummary?.status ?? "unknown",
      text: stringOrNull(value?.reviewSummary?.text),
      positive_reviews: nullableInteger(value?.reviewSummary?.positiveReviews),
      negative_reviews: nullableInteger(value?.reviewSummary?.negativeReviews),
      total_reviews: nullableInteger(value?.reviewSummary?.totalReviews),
      positive_rate: nullableNumber(value?.reviewSummary?.positiveRate),
      language: value?.reviewSummary?.language ?? "schinese",
      purchase_type: value?.reviewSummary?.purchaseType ?? "all",
      source_status: value?.reviewSummary?.sourceStatus ?? "not_fetched"
    },
    early_access: {
      catalog_tag: value?.earlyAccess?.catalogTag ?? "no",
      store_state: value?.earlyAccess?.storeState ?? "unknown",
      confirmed_current: value?.earlyAccess?.confirmedCurrent === true
    },
    decision: value?.decision ?? "needs_evidence",
    matched_rules: uniqueStrings(value?.matchedRules),
    primary_lane: value?.primaryLane ?? null,
    missing_evidence: uniqueStrings(value?.missingEvidence),
    exclusion_reasons: uniqueStrings(value?.exclusionReasons)
  };
}

function validateOpportunity(opportunity, errors) {
  const label = opportunity?.steam_app_id || "opportunity";
  if (!String(opportunity?.project ?? "").trim()) errors.push(`${label}: project must not be empty`);
  if (opportunity?.store_url !== `https://store.steampowered.com/app/${opportunity?.steam_app_id}/`) {
    errors.push(`${label}: store_url must be the canonical Steam AppID URL`);
  }

  const review = opportunity?.steam_review_summary ?? {};
  if (review.status === "available") {
    for (const key of ["positive_reviews", "negative_reviews", "total_reviews"]) {
      if (!isNonNegativeInteger(review[key])) errors.push(`${label}: ${key} must be a non-negative integer when reviews are available`);
    }
    if (isNonNegativeInteger(review.positive_reviews)
      && isNonNegativeInteger(review.negative_reviews)
      && isNonNegativeInteger(review.total_reviews)
      && review.positive_reviews + review.negative_reviews !== review.total_reviews) {
      errors.push(`${label}: positive_reviews + negative_reviews must equal total_reviews`);
    }
    if (!isRate(review.positive_rate)) errors.push(`${label}: positive_rate must be between 0 and 100`);
    if (isNonNegativeInteger(review.positive_reviews) && isNonNegativeInteger(review.total_reviews) && review.total_reviews > 0) {
      const expectedRate = Number(((review.positive_reviews / review.total_reviews) * 100).toFixed(4));
      if (Math.abs(expectedRate - Number(review.positive_rate)) > 0.0001) {
        errors.push(`${label}: positive_rate must be calculated from raw positive_reviews / total_reviews`);
      }
    }
    if (review.language !== "schinese") errors.push(`${label}: available review language must be schinese`);
    if (review.purchase_type !== "all") errors.push(`${label}: available review purchase_type must be all`);
    if (review.source_status !== "steam_appreviews") errors.push(`${label}: available reviews must use steam_appreviews source_status`);
  } else if (["positive_reviews", "negative_reviews", "total_reviews", "positive_rate"].some((key) => review[key] !== null)) {
    errors.push(`${label}: unknown review metrics must remain null`);
  }

  const matchedRules = Array.isArray(opportunity?.matched_rules) ? opportunity.matched_rules : [];
  const eaMatched = matchedRules.includes("ea_mobile_high_traction");
  const heatMatched = matchedRules.includes("china_heat_ops");
  const totalReviews = review.total_reviews;
  const positiveRate = review.positive_rate;
  if (eaMatched && opportunity?.early_access?.confirmed_current !== true) {
    errors.push(`${label}: ea_mobile_high_traction requires confirmed current Early Access`);
  }
  if (eaMatched && !(totalReviews >= 1000 && reviewRateAtLeast(review, 80))) {
    errors.push(`${label}: ea_mobile_high_traction review threshold mismatch`);
  }
  if (heatMatched && !(totalReviews >= 10000)) {
    errors.push(`${label}: china_heat_ops review threshold mismatch`);
  }
  const expectedLane = heatMatched ? "china_heat_ops" : eaMatched ? "ea_mobile_high_traction" : null;
  if (opportunity?.primary_lane !== expectedLane) errors.push(`${label}: primary_lane does not match matched_rules`);
  if (opportunity?.decision === "qualified" && matchedRules.length === 0) {
    errors.push(`${label}: qualified opportunity must have a matched rule`);
  }
  if (opportunity?.decision !== "qualified" && matchedRules.length > 0) {
    errors.push(`${label}: non-qualified opportunity cannot have matched rules`);
  }
  if (opportunity?.decision === "needs_evidence" && !(opportunity?.missing_evidence?.length > 0)) {
    errors.push(`${label}: needs_evidence opportunity must name missing evidence`);
  }
}

function isIsoDateTime(value) {
  const text = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)
    && !Number.isNaN(Date.parse(text));
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isRate(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function reviewRateAtLeast(review, threshold) {
  if (isNonNegativeInteger(review?.positive_reviews) && isNonNegativeInteger(review?.total_reviews)) {
    return review.total_reviews > 0 && (review.positive_reviews / review.total_reviews) * 100 >= threshold;
  }
  return isRate(review?.positive_rate) && review.positive_rate >= threshold;
}

function integerOrZero(value) {
  return isNonNegativeInteger(value) ? value : 0;
}

function nullableInteger(value) {
  return isNonNegativeInteger(value) ? value : null;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean))];
}

function stringOrNull(value) {
  const text = String(value ?? "").trim();
  return text || null;
}
