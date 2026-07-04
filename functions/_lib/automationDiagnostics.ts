import {
  buildBusinessAcceptance,
  buildCounts,
  buildFileHealth,
  buildNextActions,
  buildStatus,
  buildWarnings,
  parseSourceBreakdown,
  thresholds,
  type ArtifactName,
  type AutomationBusinessAcceptance,
  type AutomationFileHealth,
  type AutomationReceiptSummary,
  type DailyReport,
  type DiagnosticsStatus,
  type JsonFetchResult,
  type RadarReport,
  type SourceBreakdown,
  type SteamTrendReport,
  type SyncResponse
} from "./automationDiagnosticsModel";

export type {
  AutomationBusinessAcceptance,
  AutomationFileHealth,
  AutomationReceiptSummary
} from "./automationDiagnosticsModel";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const repoFullName = "Neo0109/CRM";
const branch = "main";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

type ReceiptFile = {
  report_date?: string;
  slot?: string;
  status?: string;
  attempts?: number;
  generated_changed?: boolean;
  event_name?: string;
  event_schedule?: string;
  run_id?: string;
  run_number?: string;
  run_url?: string;
  captured_at?: string;
  sync_response?: string | Record<string, unknown> | null;
};

export type AutomationDiagnostics = {
  available_dates: string[];
  business_acceptance?: AutomationBusinessAcceptance;
  counts: {
    drop_candidates: number;
    final_candidates: number;
    push_candidates: number;
    radar_categories: Record<string, number>;
    radar_items: number;
    review_candidates: number;
    steam_crm_candidates: number;
    steam_genre_signals: number;
    steam_items: number;
    steam_market_insights: number;
    watch_candidates: number;
  };
  files: Record<ArtifactName, AutomationFileHealth>;
  generated_at: string;
  import_stats: Record<string, unknown> | null;
  latest_receipt: AutomationReceiptSummary | null;
  latest_synced_receipt: AutomationReceiptSummary | null;
  next_actions: string[];
  receipts: AutomationReceiptSummary[];
  report_date: string;
  requested_date: string;
  rule_version: string | null;
  source_breakdown: SourceBreakdown;
  status: DiagnosticsStatus;
  summary: string;
  thresholds: typeof thresholds;
  warnings: string[];
};

type BuildOptions = {
  fetchFn?: FetchLike;
  today?: string;
};

export async function buildAutomationDiagnostics(requestedDate: string | null, options: BuildOptions = {}): Promise<AutomationDiagnostics> {
  const fetchFn = options.fetchFn ?? fetch;
  const today = options.today ?? todayInShanghai();
  const requested = requestedDate ?? today;
  if (!datePattern.test(requested)) throw new Error("invalid_date");

  const availableDates = await listAvailableDates(fetchFn, "data/reports", today)
    .catch(() => probeAvailableDates(fetchFn, requested, "data/reports"));
  const selectedDate = selectReportDate(requested, availableDates) ?? requested;

  const [reportResult, radarResult, steamResult, receipts] = await Promise.all([
    fetchJson<DailyReport>(fetchFn, rawGithubUrl("data/reports", selectedDate)),
    fetchJson<RadarReport>(fetchFn, rawGithubUrl("data/radar", selectedDate)),
    fetchJson<SteamTrendReport>(fetchFn, rawGithubUrl("data/steam_trends", selectedDate)),
    fetchReceipts(fetchFn, selectedDate)
  ]);

  const report = reportResult.data;
  const radar = radarResult.data;
  const steam = steamResult.data;
  const sourceBreakdown = parseSourceBreakdown(report?.summary);
  const counts = buildCounts(report, radar, steam);
  const sortedReceipts = receipts.sort(compareReceiptDesc);
  const latestReceipt = sortedReceipts[0] ?? null;
  const latestSyncedReceipt = sortedReceipts.find((receipt) => receipt.sync?.synced === true) ?? null;
  const warnings = buildWarnings({
    counts,
    latestSyncedReceipt,
    radarResult,
    reportResult,
    sourceBreakdown,
    steamResult
  });
  const status = buildStatus({
    latestReceipt,
    latestSyncedReceipt,
    radarResult,
    reportResult,
    steamResult,
    warnings
  });
  const nextActions = buildNextActions(warnings, status);
  const files = {
    report: buildFileHealth("data/reports", selectedDate, reportResult),
    radar: buildFileHealth("data/radar", selectedDate, radarResult),
    steam_trends: buildFileHealth("data/steam_trends", selectedDate, steamResult)
  };
  const importStats = latestSyncedReceipt?.sync?.import_stats ?? null;

  return {
    available_dates: availableDates,
    business_acceptance: buildBusinessAcceptance({
      counts,
      files,
      importStats,
      latestReceipt,
      latestSyncedReceipt,
      sourceBreakdown
    }),
    counts,
    files,
    generated_at: new Date().toISOString(),
    import_stats: importStats,
    latest_receipt: latestReceipt,
    latest_synced_receipt: latestSyncedReceipt,
    next_actions: nextActions,
    receipts: sortedReceipts,
    report_date: typeof report?.report_date === "string" ? report.report_date : selectedDate,
    requested_date: requested,
    rule_version: detectRuleVersion([report?.summary, ...(Array.isArray(report?.insights) ? report.insights : [])]),
    source_breakdown: sourceBreakdown,
    status,
    summary: report?.summary ?? "未读取到日报 summary。",
    thresholds,
    warnings
  };
}

function detectRuleVersion(parts: unknown[]) {
  const text = parts.filter((part): part is string => typeof part === "string").join("\n");
  const direct = text.match(/Sourcing\s+V(\d+(?:\.\d+)+)/i)?.[0];
  if (direct) return direct.replace(/\s+/, " ");
  const rules = text.match(/sourcing-rules-v(\d+(?:\.\d+)+)/i)?.[0];
  return rules ?? null;
}

async function fetchReceipts(fetchFn: FetchLike, date: string) {
  const entries = await listPath(fetchFn, "data/automation_runs").catch(() => []);
  const files = entries
    .map((entry) => entry.name)
    .filter((name): name is string => typeof name === "string" && name.startsWith(`${date}-`) && name.endsWith(".json"));
  const receipts = await Promise.all(files.map(async (name) => {
    const result = await fetchJson<ReceiptFile>(fetchFn, rawGithubUrl("data/automation_runs", name.replace(/\.json$/, "")));
    return result.data ? receiptSummary(name, result.data) : null;
  }));
  return receipts.filter((receipt): receipt is AutomationReceiptSummary => Boolean(receipt));
}

function receiptSummary(name: string, receipt: ReceiptFile): AutomationReceiptSummary {
  const sync = parseSyncResponse(receipt.sync_response);
  return {
    attempts: typeof receipt.attempts === "number" ? receipt.attempts : null,
    captured_at: typeof receipt.captured_at === "string" ? receipt.captured_at : null,
    event_name: typeof receipt.event_name === "string" ? receipt.event_name : null,
    event_schedule: typeof receipt.event_schedule === "string" ? receipt.event_schedule : null,
    generated_changed: typeof receipt.generated_changed === "boolean" ? receipt.generated_changed : null,
    name,
    report_date: typeof receipt.report_date === "string" ? receipt.report_date : null,
    run_number: typeof receipt.run_number === "string" ? receipt.run_number : null,
    run_url: typeof receipt.run_url === "string" ? receipt.run_url : null,
    slot: typeof receipt.slot === "string" ? receipt.slot : null,
    status: typeof receipt.status === "string" ? receipt.status : "unknown",
    sync
  };
}

function parseSyncResponse(raw: ReceiptFile["sync_response"]): SyncResponse | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as SyncResponse;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? parsed as SyncResponse : null;
  } catch {
    return null;
  }
}

function compareReceiptDesc(a: AutomationReceiptSummary, b: AutomationReceiptSummary) {
  return dateScore(b.captured_at) - dateScore(a.captured_at) || a.name.localeCompare(b.name);
}

function dateScore(value: string | null) {
  return value ? Date.parse(value) || 0 : 0;
}

async function listAvailableDates(fetchFn: FetchLike, basePath: string, today: string) {
  const allowedDates = new Set(candidateDates(today, 45));
  const entries = await listPath(fetchFn, basePath);
  return entries
    .filter((entry) => entry.type === "file")
    .map((entry) => entry.name?.replace(/\.json$/, "") ?? "")
    .filter((date) => datePattern.test(date) && allowedDates.has(date))
    .sort((a, b) => b.localeCompare(a));
}

async function probeAvailableDates(fetchFn: FetchLike, requested: string, basePath: string) {
  const dates: string[] = [];
  for (const date of candidateDates(requested, 45)) {
    const result = await fetchJson(fetchFn, rawGithubUrl(basePath, date));
    if (result.exists) dates.push(date);
  }
  return dates;
}

async function listPath(fetchFn: FetchLike, basePath: string) {
  const url = `https://api.github.com/repos/${repoFullName}/contents/${basePath}?ref=${encodeURIComponent(branch)}`;
  const response = await fetchFn(`${url}&t=${Date.now()}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "sourcing-crm"
    }
  });
  if (!response.ok) throw new Error(`list_failed:${response.status}`);
  return await response.json() as { name?: string; type?: string }[];
}

async function fetchJson<T>(fetchFn: FetchLike, source: string): Promise<JsonFetchResult<T>> {
  const response = await fetchFn(`${source}?t=${Date.now()}`, { headers: { Accept: "application/json" } });
  if (response.status === 404) return { data: null, exists: false, source, status: 404 };
  if (!response.ok) return { data: null, exists: false, source, status: response.status };
  return {
    data: await response.json() as T,
    exists: true,
    source,
    status: response.status
  };
}

function selectReportDate(requested: string, availableDates: string[]) {
  if (!availableDates.length) return null;
  return availableDates.find((date) => date === requested)
    ?? availableDates.find((date) => date < requested)
    ?? availableDates[0];
}

function candidateDates(startDate: string, days: number) {
  const dates: string[] = [];
  const [year, month, day] = startDate.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() - index);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

function rawGithubUrl(basePath: string, dateOrName: string) {
  return `https://raw.githubusercontent.com/${repoFullName}/${branch}/${basePath}/${dateOrName}.json`;
}

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric"
  }).format(new Date());
}
