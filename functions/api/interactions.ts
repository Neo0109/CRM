import {
  InteractionInputError,
  interactionLeadIdFromInput,
  isInteractionEligibleLead,
  parseInteractionPage,
  prepareInteractionMutation
} from "../_lib/interactionModel";
import {
  readInteractionByRequestId,
  readInteractionPage,
  writeInteractionMutation
} from "../_lib/interactionStore";
import {
  getAccessUser,
  json,
  readLeads,
  type PagesContext
} from "../_lib/crm";

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const actor = await getAccessUser(request, env);
  if (!actor) return json({ error: "CRM login required" }, 401);

  try {
    const url = new URL(request.url);
    const leadId = interactionLeadIdFromInput({
      lead_id: url.searchParams.get("lead_id")
    });
    const page = parseInteractionPage({
      cursor: url.searchParams.get("cursor"),
      limit: url.searchParams.get("limit")
    });
    const leads = await readLeads(env);
    if (!leads.some((lead) => lead.id === leadId)) {
      return json({ error: "Lead not found" }, 404);
    }

    return json(await readInteractionPage(env, leadId, page));
  } catch (error) {
    if (error instanceof InteractionInputError) {
      return json({ error: error.message }, 400);
    }
    return json({ error: "Failed to load interactions" }, 500);
  }
};

export const onRequestPost = async ({ request, env }: PagesContext) => {
  const actor = await getAccessUser(request, env);
  if (!actor) return json({ error: "CRM login required" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid interaction payload" }, 400);
  }

  try {
    const leadId = interactionLeadIdFromInput(body);
    const leads = await readLeads(env);
    const lead = leads.find((candidate) => candidate.id === leadId);
    if (!lead) return json({ error: "Lead not found" }, 404);
    if (!isInteractionEligibleLead(lead)) {
      return json({ error: "Lead is no longer in an interaction-enabled pool" }, 409);
    }

    const mutation = prepareInteractionMutation(body, lead, actor);
    const existing = await readInteractionByRequestId(env, mutation.interaction.request_id);
    if (existing) {
      if (existing.lead_id !== lead.id) {
        return json({ error: "request_id is already used for another Lead" }, 409);
      }
      return json({
        interaction: existing,
        lead,
        calendar_synced: existing.calendar_synced
      });
    }

    await writeInteractionMutation(env, mutation);
    return json({
      interaction: mutation.interaction,
      lead: mutation.lead,
      calendar_synced: mutation.calendar_synced
    }, 201);
  } catch (error) {
    if (error instanceof InteractionInputError) {
      return json({ error: error.message }, 400);
    }
    return json({ error: "Failed to save interaction" }, 500);
  }
};
