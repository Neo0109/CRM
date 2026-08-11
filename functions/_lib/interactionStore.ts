import type { Env } from "./crm";
import {
  encodeInteractionCursor,
  interactionEventPrefix,
  interactionIdForRequestId,
  isInteractionEvent,
  type InteractionEvent,
  type InteractionMutation,
  type InteractionPageRequest
} from "./interactionModel";

type InteractionRow = {
  id?: string | null;
  data?: unknown;
  updated_at?: string | null;
};

export async function readInteractionByRequestId(env: Env, requestId: string): Promise<InteractionEvent | null> {
  const id = interactionIdForRequestId(requestId);
  const rows = await readRows(
    env,
    `/rest/v1/crm_leads?select=id,data&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  const event = rows
    .filter((row) => row.id === id)
    .map((row) => row.data)
    .find(isInteractionEvent);
  return event ?? null;
}

export async function readInteractionPage(
  env: Env,
  leadId: string,
  page: InteractionPageRequest
): Promise<{ interactions: InteractionEvent[]; next_cursor: string | null }> {
  const prefix = encodeURIComponent(`${interactionEventPrefix}*`);
  const encodedLeadId = encodeURIComponent(leadId);
  const rows = await readRows(
    env,
    `/rest/v1/crm_leads?select=id,data,updated_at&id=like.${prefix}&data->>lead_id=eq.${encodedLeadId}&order=updated_at.desc%2Cid.desc&offset=${page.offset}&limit=${page.limit + 1}`
  );
  const events = rows
    .filter((row) => row.id?.startsWith(interactionEventPrefix))
    .map((row) => row.data)
    .filter(isInteractionEvent)
    .filter((event) => event.lead_id === leadId);
  const hasMore = events.length > page.limit;

  return {
    interactions: events.slice(0, page.limit),
    next_cursor: hasMore ? encodeInteractionCursor(page.offset + page.limit) : null
  };
}

export async function writeInteractionMutation(env: Env, mutation: InteractionMutation) {
  const rows: Array<{ id: string; data: unknown; updated_at: string }> = [
    {
      id: mutation.interaction.id,
      data: mutation.interaction,
      updated_at: mutation.interaction.occurred_at
    }
  ];

  if (mutation.lead_changed) {
    rows.push({
      id: mutation.lead.id,
      data: mutation.lead,
      updated_at: mutation.interaction.created_at
    });
  }

  await interactionSupabaseFetch(env, "/rest/v1/crm_leads?on_conflict=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });
}

async function readRows(env: Env, path: string) {
  const response = await interactionSupabaseFetch(env, path);
  const rows = await response.json() as unknown;
  return Array.isArray(rows) ? rows as InteractionRow[] : [];
}

async function interactionSupabaseFetch(env: Env, path: string, init?: RequestInit) {
  const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_URL || !key) throw new Error("Interaction storage is not configured");

  const response = await fetch(`${env.SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...init?.headers
    }
  });
  if (!response.ok) throw new Error("Interaction storage request failed");
  return response;
}
