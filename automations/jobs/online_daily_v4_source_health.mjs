export function recordMediaSourceFetch(diagnostics, source, result = {}) {
  const entry = sourceEntry(diagnostics, source?.name ?? "unknown");
  entry.attempts += 1;
  entry.raw_signals += Math.max(0, Number(result.rawCount ?? 0) || 0);
  if (result.ok) {
    entry.successes += 1;
    entry.last_error = null;
  } else {
    entry.failures += 1;
    entry.last_error = String(result.error ?? "unknown source failure");
  }
  if (result.fallbackUsed) entry.fallback_uses += 1;
  refreshRates(entry);
  return entry;
}

export function recordMediaSourceRetained(diagnostics, items = []) {
  for (const item of items) {
    const entry = sourceEntry(diagnostics, item?.source ?? "unknown");
    entry.retained_signals += 1;
    refreshRates(entry);
  }
  return diagnostics.media_source_health;
}

export function recordMediaLeadCandidates(diagnostics, leads = []) {
  for (const lead of leads) {
    const source = lead?._mediaItem?.source
      ?? String(lead?.public_signals ?? "").split(" / ")[0]
      ?? "unknown";
    const entry = sourceEntry(diagnostics, source || "unknown");
    entry.lead_candidates += 1;
    refreshRates(entry);
  }
  return diagnostics.media_source_health;
}

export function sourceHealthEntries(diagnostics = {}) {
  const entries = Object.values(diagnostics.media_source_health ?? {});
  for (const entry of entries) refreshRates(entry);
  return entries.sort((a, b) => a.source.localeCompare(b.source, "zh-CN"));
}

export function recordReleaseWindowHealth(diagnostics, { steamCandidates = [], mediaLeads = [] } = {}) {
  diagnostics.release_window_health = {
    threshold_days: 60,
    steam_candidates: steamCandidates.length,
    steam_domestic_near_launch: steamCandidates.filter((item) => item?.region === "中国" && item?.releaseTooSoon).length,
    steam_overseas_near_launch: steamCandidates.filter((item) => item?.region === "海外" && item?.releaseTooSoon).length,
    media_near_launch_drops: mediaLeads.filter((lead) => /窗口不合适|不足60天/.test(String(lead?.drop_reason ?? lead?.risks ?? ""))).length
  };
  return diagnostics.release_window_health;
}

function sourceEntry(diagnostics, source) {
  diagnostics.media_source_health ??= {};
  diagnostics.media_source_health[source] ??= {
    source,
    attempts: 0,
    successes: 0,
    failures: 0,
    raw_signals: 0,
    retained_signals: 0,
    lead_candidates: 0,
    success_rate: 0,
    retained_rate: 0,
    lead_conversion_rate: 0,
    fallback_uses: 0,
    last_error: null
  };
  return diagnostics.media_source_health[source];
}

function refreshRates(entry) {
  entry.success_rate = rate(entry.successes, entry.attempts);
  entry.retained_rate = rate(entry.retained_signals, entry.raw_signals);
  entry.lead_conversion_rate = rate(entry.lead_candidates, entry.raw_signals);
}

function rate(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 10000;
}
