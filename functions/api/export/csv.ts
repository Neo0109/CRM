import { readLeads, requireAccess, toCsv, type PagesContext } from "../../_lib/crm";

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    return new Response(toCsv(await readLeads(env)), {
      headers: {
        "Content-Disposition": "attachment; filename=sourcing-leads.csv",
        "Content-Type": "text/csv; charset=utf-8"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
};
