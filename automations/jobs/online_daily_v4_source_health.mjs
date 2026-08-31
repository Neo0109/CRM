import { classifySourceError } from "./online_daily_v4_network.mjs";

export function recordMediaSourceFetch(diagnostics, source, result = {}) {
  if (!diagnostics) return null;
  const family = mediaSourceFamily(source);
  const entry = sourceEntry(diagnostics, "media_source_health", source?.name ?? "unknown", family);
  entry.attempts += 1;
  entry.raw_signals += Math.max(0, Number(result.rawCount ?? 0) || 0);
  const outcome = result.outcome ?? (result.ok ? "ok" : classifySourceError(result.error));
  entry.outcome_counts[outcome] = (entry.outcome_counts[outcome] ?? 0) + 1;
  entry.last_outcome = outcome;
  if (result.ok && outcome === "ok") {
    entry.successes += 1;
    entry.last_error = null;
  } else {
    entry.failures += 1;
    entry.last_error = errorMessage(result.error);
    recordSourceIncident(diagnostics, source, { ...result, outcome, family });
  }
  if (result.fallbackUsed) entry.fallback_uses += 1;
  refreshRates(entry);
  return entry;
}

export function recordMediaSourceRetained(diagnostics, items = []) {
  for (const item of items) {
    const entry = sourceEntry(diagnostics, "media_source_health", item?.source ?? "unknown", mediaItemFamily(item));
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
    const entry = sourceEntry(diagnostics, "media_source_health", source || "unknown", "global_media");
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

export function recordSteamSourceFetch(diagnostics, source, result = {}) {
  if (!diagnostics) return null;
  const entry = sourceEntry(diagnostics, "steam_source_health", source ?? "unknown", "steam");
  entry.attempts += 1;
  entry.raw_signals += Math.max(0, Number(result.rawCount ?? 0) || 0);
  entry.candidates = entry.raw_signals;
  const outcome = result.outcome ?? (result.ok ? "ok" : classifySourceError(result.error));
  entry.outcome_counts[outcome] = (entry.outcome_counts[outcome] ?? 0) + 1;
  entry.last_outcome = outcome;
  if (result.ok && outcome === "ok") {
    entry.successes += 1;
    entry.last_error = null;
  } else {
    entry.failures += 1;
    entry.last_error = errorMessage(result.error);
    recordSourceIncident(diagnostics, { name: source }, { ...result, outcome, family: "steam" });
  }
  if (result.fallbackUsed) entry.fallback_uses += 1;
  refreshRates(entry);
  return entry;
}

export function recordSourceIncident(diagnostics, source, result = {}) {
  if (!diagnostics) return null;
  const family = result.family ?? mediaSourceFamily(source);
  const incident = {
    source_id: stableSourceId(family, source?.name ?? source ?? "unknown"),
    family,
    outcome: result.outcome ?? classifySourceError(result.error),
    http_status: Number.isFinite(Number(result.httpStatus ?? result.error?.status))
      ? Number(result.httpStatus ?? result.error?.status)
      : null,
    provider: (result.provider ?? result.error?.provider) === "cloudflare" ? "cloudflare" : null,
    fallback_used: Boolean(result.fallbackUsed)
  };
  diagnostics.source_incidents ??= [];
  diagnostics.source_incidents.push(incident);
  if (diagnostics.source_incidents.length > 100) diagnostics.source_incidents.splice(0, diagnostics.source_incidents.length - 100);
  return incident;
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

function sourceEntry(diagnostics, collection, source, family) {
  diagnostics[collection] ??= {};
  diagnostics[collection][source] ??= {
    source,
    source_id: stableSourceId(family, source),
    family,
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
    last_error: null,
    last_outcome: null,
    outcome_counts: {}
  };
  if (diagnostics[collection][source].family === "global_media" && family !== "global_media") {
    diagnostics[collection][source].family = family;
    diagnostics[collection][source].source_id = stableSourceId(family, source);
  }
  return diagnostics[collection][source];
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

export function mediaSourceFamily(source = {}) {
  const focus = Array.isArray(source.focus) ? source.focus : [];
  if (source.type?.startsWith?.("bilibili_") || focus.includes("bilibili")) return "bilibili";
  if (focus.includes("domestic_sourcing") || focus.includes("china")) return "domestic_media";
  return "global_media";
}

function mediaItemFamily(item = {}) {
  if (Array.isArray(item.source_focus)) {
    return mediaSourceFamily({ focus: item.source_focus, type: item.bvid ? "bilibili_signal" : "media" });
  }
  return "global_media";
}

function stableSourceId(family, source) {
  const slug = String(source ?? "unknown")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "unknown";
  return `${family}:${slug}`;
}

function errorMessage(error) {
  return String(error?.message ?? error ?? "unknown source failure");
}
