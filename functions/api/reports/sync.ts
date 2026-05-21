import { json, leadsFromReport, mergeIncomingLeads, type PagesContext } from "../../_lib/crm";

const repoFullName = "Neo0109/CRM";
const branch = "main";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const onRequestGet = syncReport;
export const onRequestPost = syncReport;

async function syncReport({ request, env }: PagesContext) {
  const url = new URL(request.url);
  const reportDate = url.searchParams.get("date") ?? todayInShanghai();

  if (!datePattern.test(reportDate)) {
    return json({ synced: false, error: "Invalid report date" }, 400);
  }

  const source = `https://raw.githubusercontent.com/${repoFullName}/${branch}/data/reports/${reportDate}.json`;
  const response = await fetch(`${source}?t=${Date.now()}`, {
    headers: { Accept: "application/json" }
  });

  if (response.status === 404) {
    return json({ synced: false, report_date: reportDate, reason: "report_not_found", source });
  }

  if (!response.ok) {
    return json({ synced: false, report_date: reportDate, error: `Report fetch failed: ${response.status}` }, 502);
  }

  try {
    const report = (await response.json()) as any;
    const result = await mergeIncomingLeads(env, leadsFromReport(report));
    return json({
      synced: true,
      ...result,
      report_date: report.report_date,
      summary: report.summary,
      source
    });
  } catch (error) {
    return json({ synced: false, report_date: reportDate, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}

function todayInShanghai() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
