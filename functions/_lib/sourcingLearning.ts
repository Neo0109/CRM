import type { CrmUser, Env, Lead } from "./crm";

export const decisionEventPrefix = "__crm_decision_event__";

export type DecisionActor = Pick<CrmUser, "username" | "display_name" | "role">;
export type DecisionAction = "evaluate" | "testing" | "follow" | "watch" | "push" | "drop" | "evaluation_update" | "drop_reason_update" | "decision_update";
export type DecisionOutcome = "positive" | "negative" | "intermediate" | "pending";

export type DecisionSnapshot = Pick<
  Lead,
  | "bucket"
  | "stage"
  | "review_status"
  | "priority"
  | "evaluation_grade"
  | "evaluation_result"
  | "evaluated_at"
  | "next_action"
  | "owner"
  | "due_date"
  | "drop_reason"
>;

export type DecisionEvent = {
  id: string;
  type: "sourcing_decision_event";
  action: DecisionAction;
  occurred_at: string;
  lead_id: string;
  project: string;
  actor: DecisionActor;
  changed_fields: (keyof DecisionSnapshot)[];
  before: DecisionSnapshot;
  after: DecisionSnapshot;
  snapshot: {
    project: string;
    country: string;
    region: string;
    region_priority: string;
    genre: string | null;
    gameplay: string | null;
    progress: string;
    publisher_status: string;
    source: {
      steam_app_id: string | null;
      contact_types: string[];
      link_domains: string[];
    };
    features: {
      has_steam: boolean;
      has_bilibili_source: boolean;
      has_reachable_contact: boolean;
      has_official_signal: boolean;
      is_domestic: boolean;
    };
  };
};

export type SourcingLearningReport = {
  generated_at: string;
  cohort: {
    total_active: number;
    by_bucket: Record<string, number>;
  };
  events: {
    total: number;
    by_action: Record<string, number>;
  };
  outcomes: {
    positive: number;
    negative: number;
    intermediate: number;
    pending: number;
  };
  grade_distribution: Record<string, number>;
  drop_reasons: { reason: string; count: number }[];
  funnel: { bucket: string; count: number }[];
  signal_summary: {
    by_region: Record<string, SignalStats>;
    by_gameplay: Record<string, SignalStats>;
    by_progress: Record<string, SignalStats>;
  };
  recommendations_ready: boolean;
  learning_note: string;
};

export type SignalStats = {
  total: number;
  positive: number;
  negative: number;
  positive_rate: number;
  negative_rate: number;
};

const activeLearningBuckets = ["未处理", "待评测", "测试中", "观察池", "跟进中", "推进池"];
const funnelBuckets = ["未处理", "待评测", "测试中", "观察池", "跟进中", "推进池", "淘汰池"];
const positiveGrades = new Set(["S", "A+", "A", "A-", "B+"]);
const negativeGrades = new Set(["C+", "C", "C-"]);
const trackedDecisionFields: (keyof DecisionSnapshot)[] = [
  "bucket",
  "stage",
  "review_status",
  "priority",
  "evaluation_grade",
  "evaluation_result",
  "evaluated_at",
  "drop_reason",
  "owner",
  "due_date",
  "next_action"
];

export function buildDecisionEvent(before: Lead, after: Lead, actor: DecisionActor, occurredAt = new Date().toISOString()): DecisionEvent | null {
  const beforeSnapshot = decisionSnapshot(before);
  const afterSnapshot = decisionSnapshot(after);
  const changedFields = trackedDecisionFields.filter((field) => !sameValue(beforeSnapshot[field], afterSnapshot[field]));

  if (!changedFields.length) return null;

  return {
    id: makeEventId(after.id, occurredAt, changedFields),
    type: "sourcing_decision_event",
    action: classifyAction(before, after, changedFields),
    occurred_at: occurredAt,
    lead_id: after.id,
    project: after.project,
    actor,
    changed_fields: changedFields,
    before: beforeSnapshot,
    after: afterSnapshot,
    snapshot: leadSnapshot(after)
  };
}

export async function writeDecisionEvent(env: Env, event: DecisionEvent) {
  await supabaseFetch(env, "/rest/v1/crm_leads?on_conflict=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify([{ id: event.id, data: event, updated_at: event.occurred_at }])
  });
}

export async function readDecisionEvents(env: Env, limit = 5000): Promise<DecisionEvent[]> {
  const prefix = encodeURIComponent(`${decisionEventPrefix}*`);
  const response = await supabaseFetch(env, `/rest/v1/crm_leads?select=id,data&id=like.${prefix}&order=updated_at.desc&limit=${limit}`);
  const rows = (await response.json()) as { id: string; data: DecisionEvent }[];
  return rows
    .filter((row) => row.id.startsWith(decisionEventPrefix) && row.data?.type === "sourcing_decision_event")
    .map((row) => row.data);
}

export function buildSourcingLearningReport(leads: Lead[], events: DecisionEvent[], generatedAt = new Date().toISOString()): SourcingLearningReport {
  const activeLeads = leads.filter((lead) => activeLearningBuckets.includes(lead.bucket));
  const byBucket = Object.fromEntries(funnelBuckets.map((bucket) => [bucket, 0]));
  for (const lead of activeLeads) byBucket[lead.bucket] = (byBucket[lead.bucket] ?? 0) + 1;

  const byAction: Record<string, number> = {};
  for (const event of events) byAction[event.action] = (byAction[event.action] ?? 0) + 1;

  const latestByLead = latestEventsByLead(events);
  const outcomes = { positive: 0, negative: 0, intermediate: 0, pending: 0 };
  const gradeDistribution: Record<string, number> = {};
  const dropReasons = new Map<string, number>();
  const byRegion = new Map<string, SignalCounter>();
  const byGameplay = new Map<string, SignalCounter>();
  const byProgress = new Map<string, SignalCounter>();

  for (const event of latestByLead.values()) {
    const outcome = classifyOutcome(event);
    outcomes[outcome] += 1;
    if (event.after.evaluation_grade) {
      gradeDistribution[event.after.evaluation_grade] = (gradeDistribution[event.after.evaluation_grade] ?? 0) + 1;
    }
    if (outcome === "negative" && event.after.drop_reason) {
      dropReasons.set(event.after.drop_reason, (dropReasons.get(event.after.drop_reason) ?? 0) + 1);
    }
    addSignal(byRegion, event.snapshot.region, outcome);
    addSignal(byGameplay, event.snapshot.gameplay ?? event.snapshot.genre ?? "未标注", outcome);
    addSignal(byProgress, event.snapshot.progress || "待补充", outcome);
  }

  const resolvedSamples = outcomes.positive + outcomes.negative;
  return {
    generated_at: generatedAt,
    cohort: {
      total_active: activeLeads.length,
      by_bucket: byBucket
    },
    events: {
      total: events.length,
      by_action: byAction
    },
    outcomes,
    grade_distribution: gradeDistribution,
    drop_reasons: [...dropReasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, "zh-CN")),
    funnel: funnelBuckets.map((bucket) => ({ bucket, count: leads.filter((lead) => lead.bucket === bucket).length })),
    signal_summary: {
      by_region: toSignalStats(byRegion),
      by_gameplay: toSignalStats(byGameplay),
      by_progress: toSignalStats(byProgress)
    },
    recommendations_ready: resolvedSamples >= 30,
    learning_note: resolvedSamples >= 30
      ? `已有 ${resolvedSamples} 个明确结果样本，可以开始输出方向性权重建议。`
      : `当前明确结果样本 ${resolvedSamples} 个，少于 30 个时只展示漏斗和样本积累，不输出强结论。`
  };
}

function decisionSnapshot(lead: Lead): DecisionSnapshot {
  return {
    bucket: lead.bucket,
    stage: lead.stage,
    review_status: lead.review_status,
    priority: lead.priority,
    evaluation_grade: lead.evaluation_grade,
    evaluation_result: lead.evaluation_result,
    evaluated_at: lead.evaluated_at,
    drop_reason: lead.drop_reason ?? null,
    owner: lead.owner,
    due_date: lead.due_date,
    next_action: lead.next_action
  };
}

function classifyAction(before: Lead, after: Lead, changedFields: (keyof DecisionSnapshot)[]): DecisionAction {
  if (before.bucket !== after.bucket) {
    if (after.bucket === "待评测") return "evaluate";
    if (after.bucket === "测试中") return "testing";
    if (after.bucket === "跟进中") return "follow";
    if (after.bucket === "观察池") return "watch";
    if (after.bucket === "推进池") return "push";
    if (after.bucket === "淘汰池") return "drop";
  }
  if (changedFields.includes("evaluation_grade") || changedFields.includes("evaluation_result")) return "evaluation_update";
  if (changedFields.includes("drop_reason")) return "drop_reason_update";
  return "decision_update";
}

function classifyOutcome(event: DecisionEvent): DecisionOutcome {
  if (event.after.bucket === "推进池" || event.after.bucket === "跟进中" || positiveGrades.has(event.after.evaluation_grade ?? "")) return "positive";
  if (event.after.bucket === "淘汰池" || negativeGrades.has(event.after.evaluation_grade ?? "")) return "negative";
  if (["待评测", "测试中", "观察池"].includes(event.after.bucket)) return "intermediate";
  return "pending";
}

function latestEventsByLead(events: DecisionEvent[]) {
  const latest = new Map<string, DecisionEvent>();
  for (const event of [...events].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at))) {
    latest.set(event.lead_id, event);
  }
  return latest;
}

type SignalCounter = { total: number; positive: number; negative: number };

function addSignal(map: Map<string, SignalCounter>, rawKey: string, outcome: DecisionOutcome) {
  const key = rawKey?.trim() || "未标注";
  const current = map.get(key) ?? { total: 0, positive: 0, negative: 0 };
  current.total += 1;
  if (outcome === "positive") current.positive += 1;
  if (outcome === "negative") current.negative += 1;
  map.set(key, current);
}

function toSignalStats(map: Map<string, SignalCounter>): Record<string, SignalStats> {
  return Object.fromEntries([...map.entries()].map(([key, value]) => [key, {
    total: value.total,
    positive: value.positive,
    negative: value.negative,
    positive_rate: rate(value.positive, value.total),
    negative_rate: rate(value.negative, value.total)
  }]));
}

function rate(count: number, total: number) {
  return total ? Number((count / total).toFixed(4)) : 0;
}

function leadSnapshot(lead: Lead): DecisionEvent["snapshot"] {
  const contactTypes = lead.contact_methods.map((method) => method.type);
  const linkDomains = lead.links.map(domainFromUrl).filter((domain): domain is string => Boolean(domain));
  const evidenceText = [
    lead.exposure_trail,
    lead.rule_fit,
    lead.priority_reason,
    lead.public_signals,
    ...lead.contact_methods.map((method) => `${method.type} ${method.note ?? ""} ${method.value}`),
    ...lead.links
  ].filter(Boolean).join(" ");
  return {
    project: lead.project,
    country: lead.country,
    region: lead.region,
    region_priority: lead.region_priority,
    genre: lead.genre,
    gameplay: lead.gameplay,
    progress: lead.progress,
    publisher_status: lead.publisher_status,
    source: {
      steam_app_id: lead.steam_app_id,
      contact_types: [...new Set(contactTypes)],
      link_domains: [...new Set(linkDomains)]
    },
    features: {
      has_steam: Boolean(lead.steam_app_id || lead.links.some((link) => /steampowered\.com|steamdb\.info/i.test(link))),
      has_bilibili_source: /bilibili\.com|B站|哔哩|官方号/i.test(evidenceText),
      has_reachable_contact: lead.contact_methods.some((method) => !["Steam"].includes(method.type) && method.value.trim()),
      has_official_signal: /官方|开发者|发行商|官网|工作室/i.test(evidenceText),
      is_domestic: lead.region === "中国" || /中国|大陆|台湾|香港|澳门/.test(lead.country)
    }
  };
}

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function makeEventId(leadId: string, occurredAt: string, changedFields: (keyof DecisionSnapshot)[]) {
  const cleanTime = occurredAt.replace(/[^0-9]/g, "").slice(0, 17);
  const cleanLead = leadId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
  const hash = shortHash(`${leadId}:${occurredAt}:${changedFields.join(",")}`);
  return `${decisionEventPrefix}${cleanTime}_${cleanLead}_${hash}`.slice(0, 180);
}

function shortHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function domainFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function supabaseFetch(env: Env, path: string, init?: RequestInit) {
  const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [!env.SUPABASE_URL ? "SUPABASE_URL" : null, !key ? "SUPABASE_SECRET_KEY" : null].filter(Boolean);
  if (missing.length) throw new Error(`Missing Supabase environment variables: ${missing.join(", ")}`);
  const response = await fetch(`${env.SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...init?.headers
    }
  });
  if (!response.ok) throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
  return response;
}
