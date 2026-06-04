type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const repoFullName = "Neo0109/CRM";
const branch = "main";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const thresholds = {
  min_review_candidates: 18,
  min_media_bilibili_candidates: 10,
  min_radar_items: 8,
  min_steam_market_insights: 2,
  min_steam_genre_signals: 2
};

type ArtifactName = "report" | "radar" | "steam_trends";
type DiagnosticsStatus = "healthy" | "warning" | "failed" | "missing";

type DailyReport = {
  report_date?: string;
  summary?: string;
  insights?: unknown[];
  push_pool?: unknown[];
  watch_pool?: unknown[];
  drop_pool?: unknown[];
};

type RadarReport = {
  report_date?: string;
  summary?: string;
  items?: { category?: unknown }[];
};

type SteamTrendReport = {
  report_date?: string;
  summary?: string;
  market_insights?: unknown[];
  genre_signals?: unknown[];
  items?: unknown[];
  crm_candidates?: unknown[];
};

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

type SyncResponse = {
  synced?: boolean;
  created?: number;
  updated?: number;
  dropped?: number;
  total?: number;
  import_stats?: Record<string, unknown>;
  report_date?: string;
  summary?: string;
  source?: string;
  reason?: string;
};

export type AutomationFileHealth = {
  exists: boolean;
  path: string;
  source: string;
  status?: number;
};

export type AutomationReceiptSummary = {
  attempts: number | null;
  captured_at: string | null;
  event_name: string | null;
  event_schedule: string | null;
  generated_changed: boolean | null;
  name: string;
  report_date: string | null;
  run_number: string | null;
  run_url: string | null;
  slot: string | null;
  status: string;
  sync: SyncResponse | null;
};

export type AutomationDiagnostics = {
  available_dates: string[];
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
  source_breakdown: {
    final_candidates: number | null;
    media_bilibili_leads: number | null;
    official_source_hits: number | null;
    raw_summary: string | null;
    steam_enriched: number | null;
    steam_scanned: number | null;
  };
  status: DiagnosticsStatus;
  summary: string;
  thresholds: typeof thresholds;
  warnings: string[];
};

type BuildOptions = {
  fetchFn?: FetchLike;
  today?: string;
};

type JsonFetchResult<T> = {
  data: T | null;
  exists: boolean;
  source: string;
  status?: number;
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
  const warnings = buildWarnings(reportResult, radarResult, steamResult, counts, latestSyncedReceipt, sourceBreakdown);
  const status = buildStatus(reportResult, radarResult, steamResult, warnings, latestReceipt, latestSyncedReceipt);
  const nextActions = buildNextActions(warnings, status);

  return {
    available_dates: availableDates,
    counts,
    files: {
      report: fileHealth("data/reports", selectedDate, reportResult),
      radar: fileHealth("data/radar", selectedDate, radarResult),
      steam_trends: fileHealth("data/steam_trends", selectedDate, steamResult)
    },
    generated_at: new Date().toISOString(),
    import_stats: latestSyncedReceipt?.sync?.import_stats ?? null,
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

function buildCounts(report: DailyReport | null, radar: RadarReport | null, steam: SteamTrendReport | null) {
  const push = Array.isArray(report?.push_pool) ? report.push_pool.length : 0;
  const watch = Array.isArray(report?.watch_pool) ? report.watch_pool.length : 0;
  const drop = Array.isArray(report?.drop_pool) ? report.drop_pool.length : 0;
  const radarItems = Array.isArray(radar?.items) ? radar.items : [];
  const radarCategories: Record<string, number> = {};
  for (const item of radarItems) {
    const category = typeof item.category === "string" ? item.category : "未分类";
    radarCategories[category] = (radarCategories[category] ?? 0) + 1;
  }

  return {
    drop_candidates: drop,
    final_candidates: push + watch + drop,
    push_candidates: push,
    radar_categories: radarCategories,
    radar_items: radarItems.length,
    review_candidates: push + watch,
    steam_crm_candidates: Array.isArray(steam?.crm_candidates) ? steam.crm_candidates.length : 0,
    steam_genre_signals: Array.isArray(steam?.genre_signals) ? steam.genre_signals.length : 0,
    steam_items: Array.isArray(steam?.items) ? steam.items.length : 0,
    steam_market_insights: Array.isArray(steam?.market_insights) ? steam.market_insights.length : 0,
    watch_candidates: watch
  };
}

function buildWarnings(
  report: JsonFetchResult<DailyReport>,
  radar: JsonFetchResult<RadarReport>,
  steam: JsonFetchResult<SteamTrendReport>,
  counts: ReturnType<typeof buildCounts>,
  latestSyncedReceipt: AutomationReceiptSummary | null,
  sourceBreakdown: AutomationDiagnostics["source_breakdown"]
) {
  const warnings: string[] = [];
  if (!report.exists) warnings.push("日报文件缺失：data/reports 没有当天或回退日期文件。");
  if (!radar.exists) warnings.push("行业雷达文件缺失：data/radar 没有对应日期文件。");
  if (!steam.exists) warnings.push("Steam 趋势文件缺失：data/steam_trends 没有对应日期文件。");
  if (!latestSyncedReceipt) warnings.push("未找到 synced=true 的自动化同步 receipt，无法确认 CRM 已同步。");
  if (counts.review_candidates < thresholds.min_review_candidates) {
    warnings.push(`非淘汰候选 ${counts.review_candidates} 条，低于 P0 阈值 ${thresholds.min_review_candidates} 条。`);
  }
  if ((sourceBreakdown.media_bilibili_leads ?? 0) < thresholds.min_media_bilibili_candidates) {
    warnings.push(`国内媒体/B站候选 ${(sourceBreakdown.media_bilibili_leads ?? 0)} 条，低于来源池阈值 ${thresholds.min_media_bilibili_candidates} 条。`);
  }
  if (counts.radar_items < thresholds.min_radar_items) {
    warnings.push(`行业雷达 ${counts.radar_items} 条，低于看板阈值 ${thresholds.min_radar_items} 条。`);
  }
  if (counts.steam_market_insights < thresholds.min_steam_market_insights) {
    warnings.push(`Steam 大盘观察 ${counts.steam_market_insights} 条，低于阈值 ${thresholds.min_steam_market_insights} 条。`);
  }
  if (counts.steam_genre_signals < thresholds.min_steam_genre_signals) {
    warnings.push(`Steam 品类信号 ${counts.steam_genre_signals} 条，低于阈值 ${thresholds.min_steam_genre_signals} 条。`);
  }
  return warnings;
}

function buildStatus(
  report: JsonFetchResult<DailyReport>,
  radar: JsonFetchResult<RadarReport>,
  steam: JsonFetchResult<SteamTrendReport>,
  warnings: string[],
  latestReceipt: AutomationReceiptSummary | null,
  latestSyncedReceipt: AutomationReceiptSummary | null
): DiagnosticsStatus {
  if (!report.exists && !radar.exists && !steam.exists) return "missing";
  if (latestReceipt?.status === "failed") return "failed";
  if (latestReceipt && latestReceipt.sync && latestReceipt.sync.synced === false) return "failed";
  if (warnings.length || !latestSyncedReceipt) return "warning";
  return "healthy";
}

function buildNextActions(warnings: string[], status: DiagnosticsStatus) {
  if (status === "healthy") return ["无需人工介入；继续观察下一次定时日报。"];

  const actions = new Set<string>();
  for (const warning of warnings) {
    if (warning.includes("文件缺失")) actions.add("打开 GitHub Actions 的 Daily online CRM automation，选择 main，点击 Run workflow 补跑。");
    if (warning.includes("同步 receipt")) actions.add("打开 GitHub Actions 的 Daily online CRM automation，选择 main，点击 Run workflow；随后检查 data/automation_runs 当天文件和 CRM 同步返回。");
    if (warning.includes("非淘汰候选") || warning.includes("国内媒体/B站候选")) actions.add("检查 sourcing source breakdown：Steam、B站官方源、国内媒体补充池是否被过滤过多。");
    if (warning.includes("行业雷达")) actions.add("检查 radar 生成步骤是否拿到行业新闻和今日亮点，不要用空看板代替。");
    if (warning.includes("Steam")) actions.add("检查 Steam 趋势生成步骤，Steam 429 时应使用 fallback 而不是中断整个日报。");
  }
  if (!actions.size) actions.add("查看最新 Actions run，定位失败层级。");
  return [...actions];
}

function parseSourceBreakdown(summary: string | null | undefined): AutomationDiagnostics["source_breakdown"] {
  const text = typeof summary === "string" ? summary : "";
  return {
    final_candidates: readNumber(text, /进入日报候选\s*(\d+)\s*条/),
    media_bilibili_leads: readNumber(text, /国内媒体\/B站提取产品线索\s*(\d+)\s*条/),
    official_source_hits: readNumber(text, /官方源命中\s*(\d+)\s*条/),
    raw_summary: text || null,
    steam_enriched: readNumber(text, /富化\s*(\d+)\s*条/),
    steam_scanned: readNumber(text, /扫描\s*Steam\s*候选\s*(\d+)\s*条/i)
  };
}

function readNumber(text: string, pattern: RegExp) {
  const value = text.match(pattern)?.[1];
  return value ? Number(value) : null;
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

function fileHealth<T>(basePath: string, date: string, result: JsonFetchResult<T>): AutomationFileHealth {
  return {
    exists: result.exists,
    path: `${basePath}/${date}.json`,
    source: result.source,
    status: result.status
  };
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
