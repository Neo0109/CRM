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
  const warnings = [];
  const reviewCount = pools.push.length + pools.watch.length;
  if (reviewCount < minReviewLeads) {
    warnings.push(`Daily review candidate count low: push+watch=${reviewCount}, expected >= ${minReviewLeads}. Steam raw=${rawCandidateCount}, enriched=${enrichedCandidateCount}, media_leads=${mediaLeadCandidates.length}, media_raw=${diagnostics.media_signals_raw}, stale_filtered=${diagnostics.media_stale_filtered}, banned_filtered=${diagnostics.media_banned_filtered}, low_score_filtered=${diagnostics.media_low_score_filtered}, non_product_filtered=${diagnostics.media_non_product_filtered}, duplicate_filtered=${diagnostics.media_duplicate_filtered}. Publishing low-volume valid report with diagnostics.`);
  }

  const domesticSignalCount = mediaSignals.filter((item) => {
    const focus = new Set(item.source_focus ?? []);
    return focus.has("domestic_sourcing") || focus.has("bilibili");
  }).length;
  if (domesticSignalCount >= 18 && mediaLeadCandidates.length < minMediaLeadsWhenHealthy) {
    warnings.push(`Domestic media/Bilibili lead extraction low: media_leads=${mediaLeadCandidates.length}, expected >= ${minMediaLeadsWhenHealthy} when domestic signals=${domesticSignalCount}. Official hits=${diagnostics.bilibili_official_source_hits}, expanded_candidates=${diagnostics.media_expanded_product_candidates}, rescue_candidates=${diagnostics.media_rescue_product_candidates}, released_routed_to_drop=${diagnostics.media_released_routed_to_drop}. Publishing with fallback diagnostics instead of failing scheduled automation.`);
  }
  for (const warning of warnings) logger.warn(warning);
  return { warnings, reviewCount, domesticSignalCount };
}
