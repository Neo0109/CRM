import type { Lead } from "../../types";

export type LeadReviewTarget = {
  requestId?: number;
  leadId?: string | null;
  project?: string | null;
  steamAppId?: string | null;
  source?: "assistant";
};

export type ResolvedLeadReviewTarget = {
  lead: Lead | null;
  query: string;
};

export function resolveLeadReviewTarget(leads: Lead[], target: LeadReviewTarget): ResolvedLeadReviewTarget {
  const leadId = cleanValue(target.leadId);
  const steamAppId = cleanValue(target.steamAppId);
  const project = cleanValue(target.project);
  const projectKey = normalizeProject(project);

  const lead = (leadId ? leads.find((item) => item.id === leadId) : null)
    ?? (steamAppId ? leads.find((item) => cleanValue(item.steam_app_id) === steamAppId) : null)
    ?? (projectKey ? leads.find((item) => normalizeProject(item.project) === projectKey) : null)
    ?? null;

  return {
    lead,
    query: project || steamAppId || leadId || ""
  };
}

function cleanValue(value: string | null | undefined) {
  const clean = value?.trim();
  return clean || "";
}

function normalizeProject(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
