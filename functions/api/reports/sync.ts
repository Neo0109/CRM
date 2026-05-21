import { json, syncReportFromRepository, todayInShanghai, type PagesContext } from "../../_lib/crm";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const onRequestGet = syncReport;
export const onRequestPost = syncReport;

async function syncReport({ request, env }: PagesContext) {
  const url = new URL(request.url);
  const reportDate = url.searchParams.get("date") ?? todayInShanghai();

  if (!datePattern.test(reportDate)) {
    return json({ synced: false, error: "Invalid report date" }, 400);
  }

  try {
    return json(await syncReportFromRepository(env, reportDate));
  } catch (error) {
    return json({ synced: false, report_date: reportDate, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
