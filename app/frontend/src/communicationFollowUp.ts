import { priorityRank } from "./leadPriority";
import type {
  InteractionChannel,
  InteractionCreateInput,
  InteractionDraft,
  InteractionEvent,
  InteractionPage,
  Lead
} from "./types";

export const communicationBuckets = ["跟进中", "推进池"] as const;
export const communicationChannels: InteractionChannel[] = [
  "微信/QQ",
  "Email",
  "电话",
  "会议",
  "Discord",
  "B站",
  "X/Twitter",
  "其他"
];

export type CommunicationPoolFilter = "all" | (typeof communicationBuckets)[number];
export type CommunicationDueFilter = "all" | "overdue" | "today" | "next-7-days" | "missing" | "future";
export type CommunicationFollowUpStatus = Exclude<CommunicationDueFilter, "all">;

export type CommunicationFilters = {
  query: string;
  owner: string;
  pool: CommunicationPoolFilter;
  due: CommunicationDueFilter;
};

export type InteractionDraftErrors = Partial<Record<keyof InteractionDraft, string>>;

export type PendingInteractionRequest = {
  requestId: string;
  fingerprint: string;
};

const statusLabels: Record<CommunicationFollowUpStatus, string> = {
  overdue: "已逾期",
  today: "今日到期",
  "next-7-days": "7天内",
  missing: "缺下一步或日期",
  future: "未来提醒"
};

export function isCommunicationLead(lead: Lead) {
  return communicationBuckets.some((bucket) => lead.bucket === bucket);
}

export function communicationOwners(leads: Lead[]) {
  return [...new Set(leads
    .filter(isCommunicationLead)
    .map((lead) => cleanText(lead.owner))
    .filter((owner): owner is string => Boolean(owner)))]
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
}

export function filterCommunicationLeads(
  leads: Lead[],
  filters: CommunicationFilters,
  now = new Date()
) {
  const today = shanghaiDateKey(now);
  const horizon = addDateKeyDays(today, 7);
  const query = filters.query.trim().toLocaleLowerCase("zh-CN");

  return leads
    .filter(isCommunicationLead)
    .filter((lead) => filters.owner === "all" || cleanText(lead.owner) === filters.owner)
    .filter((lead) => filters.pool === "all" || lead.bucket === filters.pool)
    .filter((lead) => matchesDueFilter(lead, filters.due, today, horizon))
    .filter((lead) => !query || searchableLeadText(lead).includes(query))
    .sort((left, right) => compareCommunicationLeads(left, right, today, horizon));
}

export function communicationStatusForLead(lead: Lead, now = new Date()): CommunicationFollowUpStatus {
  const today = shanghaiDateKey(now);
  return communicationStatusForDateKeys(lead, today, addDateKeyDays(today, 7));
}

export function communicationStatusLabel(status: CommunicationFollowUpStatus) {
  return statusLabels[status];
}

export function communicationDueText(lead: Pick<Lead, "due_date" | "next_action">, now = new Date()) {
  const today = shanghaiDateKey(now);
  if (!lead.due_date) return "尚未设置跟进日期";
  const days = dateKeyDistance(today, lead.due_date);
  if (days < 0) return `${lead.due_date} · 逾期 ${Math.abs(days)} 天`;
  if (days === 0) return `${lead.due_date} · 今天`;
  if (days <= 7) return `${lead.due_date} · ${days} 天后`;
  return `${lead.due_date} · 未来提醒`;
}

export function newInteractionDraft(now = new Date()): InteractionDraft {
  return {
    channel: "微信/QQ",
    contact_label: "",
    occurred_at: shanghaiDateTimeLocal(now),
    summary: "",
    next_action: "",
    next_follow_up_date: ""
  };
}

export function validateInteractionDraft(draft: InteractionDraft): InteractionDraftErrors {
  const errors: InteractionDraftErrors = {};
  const contactLabel = draft.contact_label.trim();
  const summary = draft.summary.trim();
  const nextAction = draft.next_action.trim();

  if (!communicationChannels.includes(draft.channel)) errors.channel = "请选择有效的沟通渠道";
  if (!validDateTimeLocal(draft.occurred_at)) errors.occurred_at = "请选择有效的沟通时间";
  if (characterCount(contactLabel) > 120) errors.contact_label = "沟通对象不能超过 120 字";
  if (!summary) errors.summary = "请填写沟通摘要";
  if (characterCount(summary) > 2000) errors.summary = "沟通摘要不能超过 2000 字";
  if (characterCount(nextAction) > 500) errors.next_action = "下一步动作不能超过 500 字";

  if (draft.next_follow_up_date) {
    if (!validDateKey(draft.next_follow_up_date)) {
      errors.next_follow_up_date = "请选择有效的下次跟进日期";
    } else if (!nextAction) {
      errors.next_action = "设置下次跟进日期时必须填写下一步动作";
    } else if (validDateTimeLocal(draft.occurred_at)
      && draft.next_follow_up_date < draft.occurred_at.slice(0, 10)) {
      errors.next_follow_up_date = "下次跟进日期不能早于沟通日期";
    }
  }

  return errors;
}

export function buildInteractionInput(
  leadId: string,
  requestId: string,
  draft: InteractionDraft
): InteractionCreateInput {
  const errors = validateInteractionDraft(draft);
  if (Object.keys(errors).length) throw new Error("Invalid interaction draft");

  return {
    request_id: requestId,
    lead_id: leadId,
    channel: draft.channel,
    contact_label: cleanText(draft.contact_label),
    occurred_at: new Date(`${draft.occurred_at}:00+08:00`).toISOString(),
    summary: draft.summary.trim(),
    next_action: cleanText(draft.next_action),
    next_follow_up_date: draft.next_follow_up_date || null
  };
}

export function createInteractionRequestId(now = Date.now(), randomValue = Math.random()) {
  const random = Math.floor(randomValue * Number.MAX_SAFE_INTEGER).toString(36);
  return `web-${now.toString(36)}-${random}`;
}

export function resolveInteractionRequest(
  pending: PendingInteractionRequest | undefined,
  leadId: string,
  draft: InteractionDraft,
  createRequestId: () => string = createInteractionRequestId
): PendingInteractionRequest {
  const { request_id: _requestId, ...payload } = buildInteractionInput(
    leadId,
    "request-fingerprint",
    draft
  );
  const fingerprint = JSON.stringify(payload);
  if (pending?.fingerprint === fingerprint) return pending;
  return { requestId: createRequestId(), fingerprint };
}

export function mergeInteractionPage(
  current: InteractionEvent[],
  page: Pick<InteractionPage, "interactions">
) {
  const byId = new Map<string, InteractionEvent>();
  for (const interaction of [...current, ...page.interactions]) byId.set(interaction.id, interaction);
  return [...byId.values()].sort((left, right) => (
    right.occurred_at.localeCompare(left.occurred_at)
      || right.created_at.localeCompare(left.created_at)
  ));
}

export function shouldCommitTimelineResponse(
  requestId: number,
  currentRequestId: number,
  leadId: string,
  currentLeadId: string | null
) {
  return requestId === currentRequestId && leadId === currentLeadId;
}

export function interactionOccurredDate(draft: Pick<InteractionDraft, "occurred_at">) {
  return validDateTimeLocal(draft.occurred_at) ? draft.occurred_at.slice(0, 10) : "";
}

function compareCommunicationLeads(left: Lead, right: Lead, today: string, horizon: string) {
  const leftStatus = communicationStatusForDateKeys(left, today, horizon);
  const rightStatus = communicationStatusForDateKeys(right, today, horizon);
  return statusRank(leftStatus) - statusRank(rightStatus)
    || dueDateRank(left).localeCompare(dueDateRank(right))
    || priorityRank(left.priority) - priorityRank(right.priority)
    || left.project.localeCompare(right.project, "zh-CN");
}

function communicationStatusForDateKeys(lead: Lead, today: string, horizon: string): CommunicationFollowUpStatus {
  if (lead.due_date && lead.due_date < today) return "overdue";
  if (lead.due_date === today) return "today";
  if (lead.due_date && lead.due_date > today && lead.due_date <= horizon) return "next-7-days";
  if (!cleanText(lead.next_action) || !lead.due_date) return "missing";
  return "future";
}

function matchesDueFilter(lead: Lead, filter: CommunicationDueFilter, today: string, horizon: string) {
  if (filter === "all") return true;
  if (filter === "missing") return !cleanText(lead.next_action) || !lead.due_date;
  if (filter === "overdue") return Boolean(lead.due_date && lead.due_date < today);
  if (filter === "today") return lead.due_date === today;
  if (filter === "next-7-days") return Boolean(lead.due_date && lead.due_date > today && lead.due_date <= horizon);
  return Boolean(lead.due_date && lead.due_date > horizon);
}

function searchableLeadText(lead: Lead) {
  return [
    lead.project,
    lead.team,
    lead.owner,
    lead.next_action,
    lead.contact,
    ...lead.contact_methods.flatMap((contact) => [contact.type, contact.value, contact.note])
  ].filter(Boolean).join(" ").toLocaleLowerCase("zh-CN");
}

function statusRank(status: CommunicationFollowUpStatus) {
  return ["overdue", "today", "next-7-days", "missing", "future"].indexOf(status);
}

function dueDateRank(lead: Lead) {
  return lead.due_date ?? "9999-12-31";
}

function cleanText(value: string | null | undefined) {
  const clean = value?.trim() ?? "";
  return clean || null;
}

function characterCount(value: string) {
  return Array.from(value).length;
}

function validDateTimeLocal(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}:00+08:00`);
  return Number.isFinite(timestamp);
}

function validDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function shanghaiDateTimeLocal(value: Date) {
  const parts = shanghaiParts(value, true);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function shanghaiDateKey(value: Date) {
  const parts = shanghaiParts(value, false);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shanghaiParts(value: Date, includeTime: boolean) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", hour12: false, minute: "2-digit" } : {}),
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric"
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes, fallback: string) => (
    parts.find((item) => item.type === type)?.value ?? fallback
  );
  return {
    year: part("year", "1970"),
    month: part("month", "01"),
    day: part("day", "01"),
    hour: part("hour", "00") === "24" ? "00" : part("hour", "00"),
    minute: part("minute", "00")
  };
}

function addDateKeyDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric"
  }).format(date);
}

function dateKeyDistance(start: string, end: string) {
  const startTime = new Date(`${start}T00:00:00+08:00`).getTime();
  const endTime = new Date(`${end}T00:00:00+08:00`).getTime();
  return Math.round((endTime - startTime) / 86400000);
}
