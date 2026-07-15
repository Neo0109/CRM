import { createOnlyIncomingLeads, json, leadsFromReport, mergeIncomingLeads, requireAccess, type PagesContext } from "../../_lib/crm";

export const onRequestPost = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    const report = (await request.json()) as any;
    if (new URL(request.url).searchParams.get("mode") === "create-only") {
      const result = await createOnlyIncomingLeads(env, leadsFromReport(report));
      return json({ synced: true, ...result, report_date: report.report_date, summary: report.summary });
    }

    const result = await mergeIncomingLeads(env, leadsFromReport(report));
    return json({ ...result, report_date: report.report_date, summary: report.summary });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
};
