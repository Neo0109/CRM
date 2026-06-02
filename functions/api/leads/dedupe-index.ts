import { buildLeadDedupeIndex, json, readLeads, requireAutomationAccess, type PagesContext } from "../../_lib/crm";

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const denied = requireAutomationAccess(request, env);
  if (denied) return denied;

  const leads = await readLeads(env);
  return json(buildLeadDedupeIndex(leads));
};
