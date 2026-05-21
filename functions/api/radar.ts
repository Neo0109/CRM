import { json, requireAccess, todayInShanghai, type PagesContext } from "../_lib/crm";

const repoFullName = "Neo0109/CRM";
const branch = "main";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const reportDate = url.searchParams.get("date") ?? todayInShanghai();

  if (!datePattern.test(reportDate)) return json({ error: "Invalid radar date" }, 400);

  const source = `https://raw.githubusercontent.com/${repoFullName}/${branch}/data/radar/${reportDate}.json`;
  const response = await fetch(`${source}?t=${Date.now()}`, { headers: { Accept: "application/json" } });

  if (response.status === 404) {
    return json({
      report_date: reportDate,
      summary: "今日行业雷达尚未写入。每日自动化会把游戏行业新闻、AI 游戏、互联网梗和 B站趋势保存到这里。",
      items: [],
      source
    });
  }

  if (!response.ok) return json({ error: `Radar fetch failed: ${response.status}` }, 502);
  return json({ ...(await response.json()), source });
};
