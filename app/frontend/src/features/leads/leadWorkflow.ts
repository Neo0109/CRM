import type { Bucket, Lead, Stage } from "../../types";

export type QuickActionSpec = {
  key: "evaluate" | "testing" | "follow" | "push" | "watch" | "drop";
  label: string;
  compactLabel: string;
  title: string;
  tone: "evaluate" | "testing" | "follow" | "watch" | "drop" | "push";
  patch: Partial<Lead>;
};

type QuickActionOptions = {
  missingLinksMode?: boolean;
  now?: Date;
};

export function buildQuickActionSpecs(lead: Lead, options: QuickActionOptions = {}): QuickActionSpec[] {
  const now = options.now ?? new Date();
  const reviewed_at = now.toISOString();
  const isUnread = lead.review_status === "未处理";
  const evaluate: QuickActionSpec = {
    key: "evaluate",
    label: "待评测",
    compactLabel: "测",
    title: "进入待评测队列，由同事提测",
    tone: "evaluate",
    patch: { bucket: "待评测", stage: "watch", review_status: "已查看", reviewed_at }
  };
  const testing: QuickActionSpec = {
    key: "testing",
    label: "测试中",
    compactLabel: "试",
    title: "提测完成，进入测试中；默认两周后提醒",
    tone: "testing",
    patch: { bucket: "测试中", stage: "active", ...reviewPatchForBucket("测试中", now) }
  };
  const follow: QuickActionSpec = {
    key: "follow",
    label: lead.bucket === "淘汰池" ? "放入跟进" : "跟进",
    compactLabel: "跟",
    title: lead.bucket === "淘汰池" ? "从淘汰池恢复到跟进中" : "移入跟进中",
    tone: "follow",
    patch: { bucket: "跟进中", stage: "active", review_status: "跟进中", reviewed_at }
  };
  const push: QuickActionSpec = {
    key: "push",
    label: "推进中",
    compactLabel: "推",
    title: "运营测试通过，进入推进池做深入商务洽谈",
    tone: "push",
    patch: { bucket: "推进池", stage: "negotiating", review_status: "跟进中", reviewed_at }
  };
  const watch: QuickActionSpec = {
    key: "watch",
    label: lead.bucket === "淘汰池" ? "放入观察" : "观望",
    compactLabel: "观",
    title: lead.bucket === "淘汰池" ? "从淘汰池恢复到观察池" : "转入观察池",
    tone: "watch",
    patch: { bucket: "观察池", stage: "watch", review_status: "已查看", reviewed_at }
  };
  const drop: QuickActionSpec = {
    key: "drop",
    label: "淘汰",
    compactLabel: "淘",
    title: "移入淘汰池",
    tone: "drop",
    patch: { bucket: "淘汰池", stage: "rejected", review_status: "已淘汰", reviewed_at }
  };

  if (isUnread) return [evaluate, watch, drop];
  if (lead.bucket === "待评测") return [testing, watch, drop];
  if (lead.bucket === "测试中") return [follow, watch, drop];
  if (lead.bucket === "观察池") return [evaluate, follow, drop];
  if (lead.bucket === "淘汰池") return [watch, evaluate];
  if (lead.bucket === "跟进中") return [watch, evaluate, drop];
  if (lead.bucket === "推进池") return [follow, watch, drop];
  if (options.missingLinksMode) return [evaluate, follow, watch, drop];
  return [evaluate, drop];
}

export function reviewPatchForBucket(bucket: Bucket, now = new Date()): Partial<Lead> {
  const reviewed_at = now.toISOString();
  if (bucket === "未处理") return { review_status: "未处理", reviewed_at: null };
  if (bucket === "推进池") return { review_status: "跟进中", reviewed_at };
  if (bucket === "跟进中") return { review_status: "跟进中", reviewed_at };
  if (bucket === "测试中") return { review_status: "跟进中", reviewed_at, due_date: addDaysIso(14, now), calendar_enabled: true };
  if (bucket === "待评测") return { review_status: "已查看", reviewed_at };
  if (bucket === "淘汰池") return { review_status: "已淘汰", reviewed_at };
  return { review_status: "已查看", reviewed_at };
}

export function stageFromBucket(bucket: Bucket): Stage {
  if (bucket === "未处理") return "new";
  if (bucket === "推进池") return "negotiating";
  if (bucket === "跟进中" || bucket === "测试中") return "active";
  if (bucket === "淘汰池") return "rejected";
  return "watch";
}

export function isTestingOverdue(lead: Lead, now = new Date()) {
  return lead.bucket === "测试中" && Boolean(lead.due_date) && lead.due_date! < todayIso(now);
}

function addDaysIso(days: number, now: Date) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayIso(now: Date) {
  return now.toISOString().slice(0, 10);
}
