import { json, readLeads, syncReportFromRepository, todayInShanghai, type PagesContext } from "../../_lib/crm";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const onRequestGet = syncReport;
export const onRequestPost = syncReport;

async function syncReport({ request, env }: PagesContext) {
  const url = new URL(request.url);
  const reportDate = url.searchParams.get("date") ?? todayInShanghai();
  const force = url.searchParams.get("force") === "1";

  if (!datePattern.test(reportDate)) {
    return json({ synced: false, error: "Invalid report date" }, 400);
  }

  try {
    if (!force) {
      const existingLeads = await readLeads(env);
      if (hasSyncedReport(existingLeads, reportDate)) {
        return json({
          synced: false,
          report_date: reportDate,
          created: 0,
          updated: 0,
          dropped: 0,
          reason: "already_synced"
        });
      }
    }

    return json(await syncReportFromRepository(env, reportDate));
  } catch (error) {
    return json({ synced: false, report_date: reportDate, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}

function hasSyncedReport(leads: Awaited<ReturnType<typeof readLeads>>, reportDate: string) {
  return leads.some((lead) => lead.first_seen === reportDate || (lead.notes ?? "").includes(`日报 ${reportDate}`));
}