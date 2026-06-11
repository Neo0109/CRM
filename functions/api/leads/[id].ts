import { buildDecisionEvent, writeDecisionEvent } from "../../_lib/sourcingLearning";
import { getAccessUser, json, readLeads, writeLeads, type Lead, type PagesContext } from "../../_lib/crm";

export const onRequestPatch = async ({ request, env, params }: PagesContext) => {
  const actor = await getAccessUser(request, env);
  if (!actor) return json({ error: "CRM login required" }, 401);

  try {
    const id = String(params.id);
    const patch = (await request.json()) as Partial<Lead>;
    const leads = await readLeads(env);
    const index = leads.findIndex((lead) => lead.id === id);

    if (index === -1) return json({ error: "Lead not found" }, 404);

    const before = leads[index];
    const updated = { ...before, ...patch, id: before.id, first_seen: before.first_seen };
    const learningEvent = buildDecisionEvent(before, updated, actor);
    leads[index] = updated;
    await writeLeads(env, leads);
    if (learningEvent) {
      try {
        await writeDecisionEvent(env, learningEvent);
      } catch (error) {
        console.warn("Failed to write sourcing learning event", error);
      }
    }
    return json(updated);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
};
