import { json, mergeIncomingLeads, requireAccess, todayInShanghai, type Lead, type PagesContext } from "../_lib/crm";

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
  const reportDate = url.searchParams.get("date") ?? todayInShanghai();
  if (!datePattern.test(reportDate)) return json({ error: "Invalid Steam trends date" }, 400);

  const source = `https://raw.githubusercontent.com/${repoFullName}/${branch}/data/steam_trends/${reportDate}.json`;
  const response = await fetch(`${source}?t=${Date.now()}`, { headers: { Accept: "application/json" } });

  if (response.status === 404) {
    return json({
      report_date: reportDate,
      summary: "今日 Steam 趋势尚未写入。每日自动化会把新品、Demo、愿望单/热度异动和适合 CRM 的候选保存到这里。",
      items: [],
      crm_candidates: [],
      sync_result: null,
      source
    });
  }

  if (!response.ok) return json({ error: `Steam trends fetch failed: ${response.status}` }, 502);

  const report = (await response.json()) as SteamTrendReport;
  const candidates = Array.isArray(report.crm_candidates) ? report.crm_candidates : [];
  const sync_result = candidates.length ? await mergeIncomingLeads(env, candidates) : null;
  return json({ ...report, sync_result, source });
};
