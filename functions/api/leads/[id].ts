import { json, readLeads, requireAccess, writeLeads, type Lead, type PagesContext } from "../../_lib/crm";

export const onRequestPatch = async ({ request, env, params }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    const id = String(params.id);
    const patch = (await request.json()) as Partial<Lead>;
    const leads = await readLeads(env);
    const index = leads.findIndex((lead) => lead.id === id);

    if (index === -1) return json({ error: "Lead not found" }, 404);

    const updated = { ...leads[index], ...patch, id: leads[index].id, first_seen: leads[index].first_seen };
    leads[index] = updated;
    await writeLeads(env, leads);
    return json(updated);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
};
