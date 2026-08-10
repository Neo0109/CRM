import type { AccessUser } from "./crmUsers";
import type { Lead } from "./leadModel";

export const interactionEventPrefix = "__crm_interaction_event__";
export const interactionChannels = [
  "微信/QQ",
  "Email",
  "电话",
  "会议",
  "Discord",
  "B站",
  "X/Twitter",
  "其他"
] as const;

export type InteractionChannel = (typeof interactionChannels)[number];
export type InteractionActor = Pick<AccessUser, "username" | "display_name" | "role">;
export type InteractionProjectSnapshot = Pick<Lead, "project" | "team" | "owner" | "bucket">;

export type InteractionEvent = {
  id: string;
  type: "crm_interaction_event";
  request_id: string;
  lead_id: string;
  project_snapshot: InteractionProjectSnapshot;
  actor: InteractionActor;
  created_at: string;
  channel: InteractionChannel;
  contact_label: string | null;
  occurred_at: string;
  summary: string;
  next_action: string | null;
  next_follow_up_date: string | null;
  calendar_synced: boolean;
};

export type InteractionMutation = {
  interaction: InteractionEvent;
  lead: Lead;
  lead_changed: boolean;
  calendar_synced: boolean;
};

export type InteractionPageRequest = {
  offset: number;
  limit: number;
};

export class InteractionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InteractionInputError";
  }
}

export function interactionLeadIdFromInput(raw: unknown) {
  const record = objectRecord(raw);
  return requiredText(record.lead_id, "lead_id", 200);
}

export function isInteractionEligibleLead(lead: Lead) {
  return lead.bucket === "跟进中" || lead.bucket === "推进池";
}

export function prepareInteractionMutation(
  raw: unknown,
  lead: Lead,
  actor: AccessUser,
  createdAt = new Date().toISOString()
): InteractionMutation {
  const record = objectRecord(raw);
  const requestId = requiredRequestId(record.request_id);
  const leadId = interactionLeadIdFromInput(record);
  if (leadId !== lead.id) throw new InteractionInputError("Interaction Lead does not match");
  if (!isInteractionEligibleLead(lead)) throw new InteractionInputError("Lead is not eligible for interactions");

  const channel = interactionChannel(record.channel);
  const occurredInput = requiredText(record.occurred_at, "occurred_at", 80);
  const occurredAt = isoTimestamp(occurredInput, "occurred_at");
  const communicationDate = datePrefix(occurredInput, "occurred_at");
  const summary = requiredText(record.summary, "summary", 2000);
  const contactLabel = optionalText(record.contact_label, "contact_label", 120);
  const nextAction = optionalText(record.next_action, "next_action", 500);
  const nextFollowUpDate = optionalDate(record.next_follow_up_date, "next_follow_up_date");

  if (nextFollowUpDate && !nextAction) {
    throw new InteractionInputError("next_action is required with next_follow_up_date");
  }
  if (nextFollowUpDate && nextFollowUpDate < communicationDate) {
    throw new InteractionInputError("next_follow_up_date cannot be before occurred_at");
  }

  const createdAtIso = isoTimestamp(createdAt, "created_at");
  const calendarSynced = Boolean(nextFollowUpDate);
  const leadChanged = Boolean(nextAction);
  let updatedLead = lead;

  if (nextAction && nextFollowUpDate) {
    updatedLead = {
      ...lead,
      next_action: nextAction,
      due_date: nextFollowUpDate,
      calendar_enabled: true,
      follow_up_interval: "custom"
    };
  } else if (nextAction) {
    updatedLead = {
      ...lead,
      next_action: nextAction
    };
  }

  return {
    interaction: {
      id: interactionIdForRequestId(requestId),
      type: "crm_interaction_event",
      request_id: requestId,
      lead_id: lead.id,
      project_snapshot: {
        project: lead.project,
        team: lead.team,
        owner: lead.owner,
        bucket: lead.bucket
      },
      actor: {
        username: actor.username,
        display_name: actor.display_name,
        role: actor.role
      },
      created_at: createdAtIso,
      channel,
      contact_label: contactLabel,
      occurred_at: occurredAt,
      summary,
      next_action: nextAction,
      next_follow_up_date: nextFollowUpDate,
      calendar_synced: calendarSynced
    },
    lead: updatedLead,
    lead_changed: leadChanged,
    calendar_synced: calendarSynced
  };
}

export function interactionIdForRequestId(requestId: string) {
  return `${interactionEventPrefix}${requiredRequestId(requestId)}`;
}

export function parseInteractionPage(input: {
  cursor?: string | null;
  limit?: string | number | null;
}): InteractionPageRequest {
  const limitValue = input.limit === null || input.limit === undefined || input.limit === ""
    ? 50
    : Number(input.limit);
  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100) {
    throw new InteractionInputError("Interaction limit must be between 1 and 100");
  }

  return {
    offset: input.cursor ? decodeInteractionCursor(input.cursor) : 0,
    limit: limitValue
  };
}

export function encodeInteractionCursor(offset: number) {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new InteractionInputError("Invalid interaction cursor");
  }
  const value = offset.toString(36);
  return `v1.${value}.${shortHash(`interaction:${value}`)}`;
}

export function isInteractionEvent(value: unknown): value is InteractionEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<InteractionEvent>;
  return Boolean(
    typeof event.id === "string"
      && event.id.startsWith(interactionEventPrefix)
      && event.type === "crm_interaction_event"
      && typeof event.request_id === "string"
      && typeof event.lead_id === "string"
      && typeof event.created_at === "string"
      && typeof event.occurred_at === "string"
      && typeof event.summary === "string"
      && interactionChannels.includes(event.channel as InteractionChannel)
  );
}

function decodeInteractionCursor(cursor: string) {
  const match = /^v1\.([0-9a-z]+)\.([0-9a-z]+)$/.exec(cursor);
  if (!match || shortHash(`interaction:${match[1]}`) !== match[2]) {
    throw new InteractionInputError("Invalid interaction cursor");
  }
  const offset = Number.parseInt(match[1], 36);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new InteractionInputError("Invalid interaction cursor");
  }
  return offset;
}

function requiredRequestId(value: unknown) {
  const requestId = requiredText(value, "request_id", 128);
  if (requestId.length < 8 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(requestId)) {
    throw new InteractionInputError("Invalid interaction request_id");
  }
  return requestId;
}

function interactionChannel(value: unknown): InteractionChannel {
  if (typeof value !== "string" || !interactionChannels.includes(value as InteractionChannel)) {
    throw new InteractionInputError("Invalid interaction channel");
  }
  return value as InteractionChannel;
}

function requiredText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") throw new InteractionInputError(`${field} is required`);
  const clean = value.trim();
  if (!clean) throw new InteractionInputError(`${field} is required`);
  if (Array.from(clean).length > maxLength) {
    throw new InteractionInputError(`${field} exceeds ${maxLength} characters`);
  }
  return clean;
}

function optionalText(value: unknown, field: string, maxLength: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new InteractionInputError(`Invalid ${field}`);
  const clean = value.trim();
  if (!clean) return null;
  if (Array.from(clean).length > maxLength) {
    throw new InteractionInputError(`${field} exceeds ${maxLength} characters`);
  }
  return clean;
}

function isoTimestamp(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    throw new InteractionInputError(`Invalid ${field}`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new InteractionInputError(`Invalid ${field}`);
  return new Date(timestamp).toISOString();
}

function datePrefix(value: string, field: string) {
  const date = value.slice(0, 10);
  if (!validDateKey(date)) throw new InteractionInputError(`Invalid ${field}`);
  return date;
}

function optionalDate(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !validDateKey(value)) {
    throw new InteractionInputError(`Invalid ${field}`);
  }
  return value;
}

function validDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InteractionInputError("Invalid interaction payload");
  }
  return value as Record<string, unknown>;
}

function shortHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
