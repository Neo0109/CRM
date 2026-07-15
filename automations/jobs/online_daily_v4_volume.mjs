export function validateDailyVolume({
  pools,
  mediaSignals,
  mediaLeadCandidates,
  rawCandidateCount,
  enrichedCandidateCount,
  diagnostics,
  newQualifiedCount
}) {
  const pushPoolCount = pools.push.length;
  const qualifiedCount = Number.isInteger(newQualifiedCount)
    ? newQualifiedCount
    : Number.isInteger(pools.new_qualified_count)
      ? pools.new_qualified_count
      : pushPoolCount;
  const qualifiedPushParity = qualifiedCount === pushPoolCount;
  const issues = qualifiedPushParity
    ? []
    : [{
        code: "qualified_push_mismatch",
        message: `V7 admission parity failed: new_qualified_count=${qualifiedCount}, push_pool_count=${pushPoolCount}.`
      }];
  const domesticSignalCount = mediaSignals.filter((item) => {
    const focus = new Set(item.source_focus ?? []);
    return focus.has("domestic_sourcing") || focus.has("bilibili");
  }).length;
  const volumeDiagnostics = {
    ok: qualifiedPushParity,
    degraded: false,
    issues,
    warnings: [],
    leadCountHealthEnabled: false,
    qualifiedPushParity,
    newQualifiedCount: qualifiedCount,
    pushPoolCount,
    reviewCount: pools.push.length + pools.watch.length,
    domesticSignalCount,
    mediaLeadCount: mediaLeadCandidates.length,
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
    mediaReleasedRoutedToDrop: diagnostics.media_released_routed_to_drop
  };

  if (!qualifiedPushParity) {
    const error = new Error(issues[0].message);
    error.volumeDiagnostics = volumeDiagnostics;
    throw error;
  }

  return volumeDiagnostics;
}
