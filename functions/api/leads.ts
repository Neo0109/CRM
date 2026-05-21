import { json, readLeads, requireAccess, syncReportFromRepository, type PagesContext } from "../_lib/crm";

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    await syncReportFromRepository(env).catch(() => null);
    return json(await readLeads(env));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
};
