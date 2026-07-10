export function validateDailyVolume({
  pools,
  mediaSignals,
  mediaLeadCandidates,
  rawCandidateCount,
  enrichedCandidateCount,
  diagnostics,
  minReviewLeads,
  minMediaLeadsWhenHealthy,
  logger = console
}) {
  const issues = [];
  const reviewCount = pools.push.length + pools.watch.length;
  if (reviewCount < minReviewLeads) {
    issues.push({
      code: "review_leads_low",
      message: `Daily review candidate count low: push+watch=${reviewCount}, expected >= ${minReviewLeads}. Steam raw=${rawCandidateCount}, enriched=${enrichedCandidateCount}, media_leads=${mediaLeadCandidates.length}, media_raw=${diagnostics.media_signals_raw}, stale_filtered=${diagnostics.media_stale_filtered}, banned_filtered=${diagnostics.media_banned_filtered}, low_score_filtered=${diagnostics.media_low_score_filtered}, non_product_filtered=${diagnostics.media_non_product_filtered}, duplicate_filtered=${diagnostics.media_duplicate_filtered}. Publishing a degraded report with diagnostics.`,
    });
  }

  const domesticSignalCount = mediaSignals.filter((item) => {
    const focus = new Set(item.source_focus ?? []);
    return focus.has("domestic_sourcing") || focus.has("bilibili");
  }).length;
  if (domesticSignalCount >= 18 && mediaLeadCandidates.length < minMediaLeadsWhenHealthy) {
    issues.push({
      code: "domestic_media_leads_low",
      message: `Domestic media/Bilibili lead extraction low: media_leads=${mediaLeadCandidates.length}, expected >= ${minMediaLeadsWhenHealthy} when domestic signals=${domesticSignalCount}. Official hits=${diagnostics.bilibili_official_source_hits}, expanded_candidates=${diagnostics.media_expanded_product_candidates}, rescue_candidates=${diagnostics.media_rescue_product_candidates}, released_routed_to_drop=${diagnostics.media_released_routed_to_drop}. Publishing a degraded report with diagnostics.`,
    });
  }
  const warnings = issues.map((issue) => issue.message);
  const volumeDiagnostics = {
    ok: issues.length === 0,
    degraded: issues.length > 0,
    issues,
    warnings,
    reviewCount,
    minReviewLeads,
    domesticSignalCount,
    mediaLeadCount: mediaLeadCandidates.length,
    minMediaLeadsWhenHealthy,
    rawCandidateCount,
    enrichedCandidateCount,
    mediaSignalsRaw: diagnostics.media_signals_raw,
    mediaStaleFiltered: diagnostics.media_stale_filtered,
    mediaBannedFiltered: diagnostics.media_banned_filtered,
    mediaLowScoreFiltered: diagnostics.media_low_score_filtered,
    mediaNonProductFiltered: diagnostics.media_non_product_filtered,
    mediaDuplicateFiltered: diagnostics.media_duplicate_filtered,
    bilibiliOfficialSourceHits: diagnostics.bilibili_official_source_hits,
    mediaExpandedProductCandidates: diagnostics.media_expanded_product_candidates,
    mediaRescueProductCandidates: diagnostics.media_rescue_product_candidates,
    mediaReleasedRoutedToDrop: diagnostics.media_released_routed_to_drop,
  };

  for (const warning of warnings) logger.warn(warning);

  return volumeDiagnostics;
}
