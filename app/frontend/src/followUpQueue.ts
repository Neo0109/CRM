import { priorityRank } from "./leadPriority";
import type { Bucket, Lead } from "./types";

export type FollowUpReasonKey = "overdue" | "due-soon" | "missing-next-action" | "missing-owner" | "not-in-calendar";

export type FollowUpReason = {
  key: FollowUpReasonKey;
  label: string;
  tone: "risk" | "review" | "unknown";
};

export type FollowUpQueueItem = {
  lead: Lead;
  reasons: FollowUpReason[];
  dueDate: string | null;
  daysUntilDue: number | null;
  owner: string | null;
  nextAction: string | null;
};

export type FollowUpQueue = {
  count: number;
  horizonDays: number;
  items: FollowUpQueueItem[];
};

type BuildFollowUpQueueOptions = {
  now?: Date;
  horizonDays?: number;
};

const activeFollowUpBuckets: Bucket[] = ["待评测", "测试中", "跟进中", "推进池"];
const reasonMeta: Record<FollowUpReasonKey, FollowUpReason> = {
  "overdue": { key: "overdue", label: "已逾期", tone: "risk" },
  "due-soon": { key: "due-soon", label: "7天内", tone: "review" },
  "missing-next-action": { key: "missing-next-action", label: "缺下一步", tone: "unknown" },
  "missing-owner": { key: "missing-owner", label: "缺Owner", tone: "unknown" },
  "not-in-calendar": { key: "not-in-calendar", label: "未入日历", tone: "review" }
};

export function buildFollowUpQueue(leads: Lead[], options: BuildFollowUpQueueOptions = {}): FollowUpQueue {
  const now = options.now ?? new Date();
  const horizonDays = options.horizonDays ?? 7;
  const items = leads
    .filter(isFollowUpCandidate)
    .map((lead) => buildFollowUpItem(lead, now, horizonDays))
    .filter((item): item is FollowUpQueueItem => Boolean(item))
    .sort(compareFollowUpItems);

  return {
    count: items.length,
    horizonDays,
    items
  };
}

export function followUpReasonLabel(key: FollowUpReasonKey) {
  return reasonMeta[key].label;
}

export function formatFollowUpSummary(item: FollowUpQueueItem) {
  return [
    item.dueDate ? dueText(item) : null,
    item.owner ? `Owner ${item.owner}` : "缺 Owner",
    item.nextAction || "缺下一步动作"
  ].filter(Boolean).join(" · ");
}

function buildFollowUpItem(lead: Lead, now: Date, horizonDays: number): FollowUpQueueItem | null {
  const daysUntilDue = lead.due_date ? daysBetween(startOfShanghaiDay(now), startOfShanghaiDay(lead.due_date)) : null;
  const reasons: FollowUpReason[] = [];

  if (daysUntilDue !== null && daysUntilDue < 0) reasons.push(reasonMeta.overdue);
  if (daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= horizonDays) reasons.push(reasonMeta["due-soon"]);
  if (!cleanValue(lead.next_action)) reasons.push(reasonMeta["missing-next-action"]);
  if (!cleanValue(lead.owner)) reasons.push(reasonMeta["missing-owner"]);
  if (lead.due_date && !lead.calendar_enabled && daysUntilDue !== null && daysUntilDue <= horizonDays) {
    reasons.push(reasonMeta["not-in-calendar"]);
  }

  if (!reasons.length) return null;
  return {
    lead,
    reasons,
    dueDate: lead.due_date,
    daysUntilDue,
    owner: cleanValue(lead.owner),
    nextAction: cleanValue(lead.next_action)
  };
}

function isFollowUpCandidate(lead: Lead) {
  if (!activeFollowUpBuckets.includes(lead.bucket)) return false;
  if (lead.bucket === "淘汰池" || lead.stage === "rejected" || lead.review_status === "已淘汰") return false;
  return true;
}

function compareFollowUpItems(a: FollowUpQueueItem, b: FollowUpQueueItem) {
  return reasonRank(a) - reasonRank(b)
    || dueRank(a) - dueRank(b)
    || priorityRank(a.lead.priority) - priorityRank(b.lead.priority)
    || a.lead.project.localeCompare(b.lead.project, "zh-CN");
}

function reasonRank(item: FollowUpQueueItem) {
  if (hasReason(item, "overdue")) return 0;
  if (hasReason(item, "due-soon")) return 1;
  if (hasReason(item, "missing-next-action")) return 2;
  if (hasReason(item, "missing-owner")) return 3;
  if (hasReason(item, "not-in-calendar")) return 4;
  return 9;
}

function hasReason(item: FollowUpQueueItem, key: FollowUpReasonKey) {
  return item.reasons.some((reason) => reason.key === key);
}

function dueRank(item: FollowUpQueueItem) {
  if (item.daysUntilDue === null) return Number.POSITIVE_INFINITY;
  return item.daysUntilDue;
}

function cleanValue(value: string | null) {
  const clean = value?.trim() ?? "";
  return clean || null;
}

function dueText(item: FollowUpQueueItem) {
  if (!item.dueDate || item.daysUntilDue === null) return null;
  if (item.daysUntilDue < 0) return `${item.dueDate} 逾期 ${Math.abs(item.daysUntilDue)} 天`;
  if (item.daysUntilDue === 0) return `${item.dueDate} 今天到期`;
  return `${item.dueDate} · ${item.daysUntilDue} 天后`;
}

function daysBetween(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function startOfShanghaiDay(value: string | Date) {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00+08:00`) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return new Date(`${year}-${month}-${day}T00:00:00+08:00`);
}
