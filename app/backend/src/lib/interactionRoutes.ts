import type { Express, Request, Response } from "express";
import {
  InteractionInputError,
  interactionLeadIdFromInput,
  isInteractionEligibleLead,
  parseInteractionPage,
  prepareInteractionMutation,
  type InteractionEvent,
  type InteractionPageRequest
} from "../../../../functions/_lib/interactionModel.js";
import type { BackendLead } from "./backendLeadModel.js";
import type { BackendAccessUser } from "./backendUsers.js";

type InteractionRepository = {
  readPage(leadId: string, page: InteractionPageRequest): Promise<{
    interactions: InteractionEvent[];
    next_cursor: string | null;
  }>;
  findByRequestId(requestId: string): Promise<InteractionEvent | null>;
  append(interaction: InteractionEvent): Promise<{
    interaction: InteractionEvent;
    created: boolean;
  }>;
};

export type BackendInteractionRouteDependencies = {
  interactionRepository: InteractionRepository;
  readLeads(): Promise<BackendLead[]>;
  writeLeads(leads: BackendLead[]): Promise<void>;
  assertValidLead(lead: BackendLead): void;
  resolveActor(request: Request): BackendAccessUser | null;
};

export function registerBackendInteractionRoutes(
  app: Express,
  dependencies: BackendInteractionRouteDependencies
) {
  const handlers = createBackendInteractionHandlers(dependencies);
  app.get("/api/interactions", handlers.get);
  app.post("/api/interactions", handlers.post);
}

export function createBackendInteractionHandlers(
  dependencies: BackendInteractionRouteDependencies
) {
  return {
    get: async (request: Request, response: Response) => {
      const actor = dependencies.resolveActor(request);
      if (!actor) {
        response.status(401).json({ error: "CRM login required" });
        return;
      }

      try {
        const leadId = interactionLeadIdFromInput({
          lead_id: firstQueryValue(request.query.lead_id)
        });
        const page = parseInteractionPage({
          cursor: firstQueryValue(request.query.cursor),
          limit: firstQueryValue(request.query.limit)
        });
        const leads = await dependencies.readLeads();
        if (!leads.some((lead) => lead.id === leadId)) {
          response.status(404).json({ error: "Lead not found" });
          return;
        }

        response.json(await dependencies.interactionRepository.readPage(leadId, page));
      } catch (error) {
        respondInteractionError(response, error, "Failed to load interactions");
      }
    },

    post: async (request: Request, response: Response) => {
      const actor = dependencies.resolveActor(request);
      if (!actor) {
        response.status(401).json({ error: "CRM login required" });
        return;
      }

      try {
        const leadId = interactionLeadIdFromInput(request.body);
        const leads = await dependencies.readLeads();
        const index = leads.findIndex((lead) => lead.id === leadId);
        if (index === -1) {
          response.status(404).json({ error: "Lead not found" });
          return;
        }

        const lead = leads[index];
        if (!isInteractionEligibleLead(lead)) {
          response.status(409).json({ error: "Lead is no longer in an interaction-enabled pool" });
          return;
        }

        const mutation = prepareInteractionMutation(request.body, lead, actor);
        const existing = await dependencies.interactionRepository.findByRequestId(
          mutation.interaction.request_id
        );
        if (existing) {
          if (existing.lead_id !== lead.id) {
            response.status(409).json({ error: "request_id is already used for another Lead" });
            return;
          }
          response.json({
            interaction: existing,
            lead,
            calendar_synced: existing.calendar_synced
          });
          return;
        }

        if (mutation.lead_changed) {
          dependencies.assertValidLead(mutation.lead);
          leads[index] = mutation.lead;
          await dependencies.writeLeads(leads);
        }

        const stored = await dependencies.interactionRepository.append(mutation.interaction);
        response.status(stored.created ? 201 : 200).json({
          interaction: stored.interaction,
          lead: mutation.lead,
          calendar_synced: stored.interaction.calendar_synced
        });
      } catch (error) {
        respondInteractionError(response, error, "Failed to save interaction");
      }
    }
  };
}

function respondInteractionError(response: Response, error: unknown, fallback: string) {
  if (error instanceof InteractionInputError) {
    response.status(400).json({ error: error.message });
    return;
  }
  response.status(500).json({ error: fallback });
}

function firstQueryValue(value: unknown) {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
  return typeof value === "string" ? value : null;
}
