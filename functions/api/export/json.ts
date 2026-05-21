import { readLeads, requireAccess, type PagesContext } from "../../_lib/crm";

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    return new Response(JSON.stringify(await readLeads(env), null, 2), {
      headers: {
        "Content-Disposition": "attachment; filename=sourcing-leads.json",
        "Content-Type": "application/json; charset=utf-8"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
};
