import { isDailyReport, json, leadsFromReport, mergeIncomingLeads, requireAccess, type Lead, type PagesContext } from "../../_lib/crm";

export const onRequestPost = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    const payload = await request.json();
    const incoming = isDailyReport(payload) ? leadsFromReport(payload) : payload;
    if (!Array.isArray(incoming)) return json({ error: "Expected a daily report or an array of leads" }, 400);
    return json(await mergeIncomingLeads(env, incoming as Partial<Lead>[]));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
};
