import { readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SOURCE_COVERAGE_CONFIG = Object.freeze({
  schema_version: 1,
  mode: "observe",
  families: {
    steam: {
      healthy: { productive_sources: 3, signals: 150 },
      degraded: { productive_sources: 1, signals: 50 }
    },
    bilibili: {
      healthy: { productive_sources: 5, signals: 20 },
      degraded: { productive_sources: 2, signals: 5 }
    },
    domestic_media: {
      healthy: { productive_sources: 5, signals: 50 },
      degraded: { productive_sources: 3, signals: 20 }
    },
    global_media: {
      healthy: { productive_sources: 5, signals: 0 },
      degraded: { productive_sources: 2, signals: 0 }
    }
  }
});

const FAMILY_KEYS = ["steam", "bilibili", "domestic_media", "global_media"];
const CORE_FAMILIES = ["steam", "bilibili", "domestic_media"];

export async function loadSourceCoverageConfig({ rootDir = process.cwd(), configPath = null } = {}) {
  const filePath = configPath ?? path.join(rootDir, "automations/rules/source-coverage.json");
  return validateSourceCoverageConfig(JSON.parse(await readFile(filePath, "utf8")));
}

export function validateSourceCoverageConfig(value) {
  if (Number(value?.schema_version) !== 1) throw new Error("source coverage schema_version must be 1");
  if (!["observe", "enforce"].includes(value?.mode)) throw new Error("source coverage mode must be observe or enforce");
  for (const family of FAMILY_KEYS) {
    for (const level of ["healthy", "degraded"]) {
      const threshold = value?.families?.[family]?.[level];
      if (!Number.isFinite(Number(threshold?.productive_sources)) || !Number.isFinite(Number(threshold?.signals))) {
        throw new Error(`source coverage ${family}.${level} thresholds must be numeric`);
      }
    }
  }
  return value;
}

export function buildSourceCoverage({ diagnostics = {}, rawSteamCandidateCount = 0, config = DEFAULT_SOURCE_COVERAGE_CONFIG } = {}) {
  validateSourceCoverageConfig(config);
  const metrics = {
    steam: steamMetrics(diagnostics, rawSteamCandidateCount),
    bilibili: bilibiliMetrics(diagnostics),
    domestic_media: mediaMetrics(diagnostics, "domestic_media"),
    global_media: mediaMetrics(diagnostics, "global_media")
  };
  const families = Object.fromEntries(FAMILY_KEYS.map((family) => [
    family,
    evaluateFamily(family, metrics[family], config.families[family])
  ]));
  const coreUsableCount = CORE_FAMILIES.filter((family) => families[family].status !== "unavailable").length;
  const allCoreHealthy = CORE_FAMILIES.every((family) => families[family].status === "healthy");
  const status = coreUsableCount < 2 ? "blocked" : allCoreHealthy ? "healthy" : "degraded";
  const incidents = [
    ...(Array.isArray(diagnostics.source_incidents) ? diagnostics.source_incidents : []),
    ...(Array.isArray(diagnostics.bilibili_probe?.incidents) ? diagnostics.bilibili_probe.incidents : [])
  ].slice(-50).map(sanitizeIncident);

  return {
    schema_version: 1,
    mode: config.mode,
    status,
    core_usable_count: coreUsableCount,
    families,
    incidents,
    recovery_suppressed_until: null
  };
}

function steamMetrics(diagnostics, rawSteamCandidateCount) {
  const entries = Object.values(diagnostics.steam_source_health ?? {});
  const observedRawSignals = entries.reduce((sum, entry) => sum + nonNegativeInteger(entry.raw_signals ?? entry.candidates), 0);
  return {
    productive_sources: entries.filter(isProductiveSource).length,
    signals: entries.length ? observedRawSignals : nonNegativeInteger(rawSteamCandidateCount),
    failures: failureCounts(entries)
  };
}

function bilibiliMetrics(diagnostics) {
  const entries = Object.entries(diagnostics.bilibili_probe?.source_health ?? {})
    .filter(([source]) => source.startsWith("keyword:"))
    .map(([, entry]) => entry);
  return {
    productive_sources: entries.filter(isProductiveSource).length,
    signals: nonNegativeInteger(diagnostics.bilibili_probe?.final_candidates),
    failures: failureCounts(entries)
  };
}

function mediaMetrics(diagnostics, family) {
  const entries = Object.values(diagnostics.media_source_health ?? {}).filter((entry) => entry?.family === family);
  return {
    productive_sources: entries.filter(isProductiveSource).length,
    signals: entries.reduce((sum, entry) => sum + nonNegativeInteger(entry.raw_signals), 0),
    failures: failureCounts(entries)
  };
}

function evaluateFamily(family, metrics, thresholds) {
  const meetsHealthy = meets(metrics, thresholds.healthy);
  const meetsDegraded = meets(metrics, thresholds.degraded);
  const status = meetsHealthy ? "healthy" : meetsDegraded ? "degraded" : "unavailable";
  const reasons = [];
  if (status !== "healthy") {
    reasons.push(
      `${family}: productive_sources=${metrics.productive_sources}/${thresholds.healthy.productive_sources}`,
      `${family}: signals=${metrics.signals}/${thresholds.healthy.signals}`
    );
  }
  for (const [outcome, count] of Object.entries(metrics.failures)) {
    if (count > 0) reasons.push(`${outcome}=${count}`);
  }
  return {
    status,
    productive_sources: metrics.productive_sources,
    signals: metrics.signals,
    failures: metrics.failures,
    reasons
  };
}

function meets(metrics, threshold) {
  return metrics.productive_sources >= Number(threshold.productive_sources)
    && metrics.signals >= Number(threshold.signals);
}

function isProductiveSource(entry) {
  const candidates = nonNegativeInteger(entry?.candidates ?? entry?.raw_signals);
  return nonNegativeInteger(entry?.successes) > 0 && candidates > 0 && entry?.last_outcome !== "parse_mismatch";
}

function failureCounts(entries) {
  const counts = {};
  for (const entry of entries) {
    for (const [outcome, value] of Object.entries(entry?.outcome_counts ?? {})) {
      if (outcome === "ok") continue;
      counts[outcome] = (counts[outcome] ?? 0) + nonNegativeInteger(value);
    }
  }
  return counts;
}

function sanitizeIncident(value = {}) {
  const httpStatus = value.http_status;
  return {
    source_id: String(value.source_id ?? "unknown").slice(0, 160),
    family: FAMILY_KEYS.includes(value.family) ? value.family : "global_media",
    outcome: String(value.outcome ?? "upstream_error").slice(0, 60),
    http_status: httpStatus === null || httpStatus === undefined || httpStatus === ""
      ? null
      : Number.isFinite(Number(httpStatus)) ? Number(httpStatus) : null,
    provider: value.provider === "cloudflare" ? "cloudflare" : null,
    fallback_used: Boolean(value.fallback_used)
  };
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}
