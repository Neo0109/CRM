import { buildSourcingLearningReport, readDecisionEvents } from "../_lib/sourcingLearning";
import { json, readLeads, requireAccess, type PagesContext } from "../_lib/crm";

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    const [leads, events] = await Promise.all([
      readLeads(env),
      readDecisionEvents(env)
    ]);

    return json(buildSourcingLearningReport(leads, events));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Sourcing learning failed" }, 500);
  }
};
