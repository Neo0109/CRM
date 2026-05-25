import { json, mergeIncomingLeads, requireAccess, todayInShanghai, type Lead, type PagesContext } from "../_lib/crm";
import { fetchHistoricalJson } from "../_lib/reportHistory";

const repoFullName = "Neo0109/CRM";
const branch = "main";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

type SteamTrendReport = {
  report_date: string;
  summary: string;
  items: unknown[];
  crm_candidates?: Partial<Lead>[];
};

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const reportDate = url.searchParams.get("date");
  if (reportDate && !datePattern.test(reportDate)) return json({ error: "Invalid Steam trends date" }, 400);

  try {
    const result = await fetchHistoricalJson<SteamTrendReport & Record<string, unknown>>(reportDate, {
      basePath: "data/steam_trends",
      branch,
      fallbackSummary: "暂无 Steam 趋势历史数据。每日自动化写入后，这里会保留最近一次有效内容并支持回看。",
      repoFullName,
      today: todayInShanghai()
    });

    const report = result.report as SteamTrendReport;
    const candidates = Array.isArray(report.crm_candidates) ? report.crm_candidates : [];
    const shouldSyncCandidates = candidates.length > 0 && !url.searchParams.has("date") && url.searchParams.get("sync") !== "0";
    const sync_result = shouldSyncCandidates ? await mergeIncomingLeads(env, candidates) : null;
    return json({
      ...report,
      available_dates: result.available_dates,
      is_fallback: result.is_fallback,
      requested_date: result.requested_date,
      sync_result,
      source: result.source
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "invalid_date") return json({ error: "Invalid Steam trends date" }, 400);
    if (message.startsWith("fetch_failed:")) return json({ error: `Steam trends fetch failed: ${message.split(":")[1]}` }, 502);
    return json({ error: "Steam trends fetch failed" }, 502);
  }
};
