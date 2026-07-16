import type { CrmUser, Env, Lead } from "./crm";

export const decisionEventPrefix = "__crm_decision_event__";

export type DecisionActor = Pick<CrmUser, "username" | "display_name" | "role">;
export type DecisionAction = "evaluate" | "testing" | "follow" | "watch" | "push" | "drop" | "evaluation_update" | "drop_reason_update" | "decision_update";
export type DecisionOutcome = "positive" | "negative" | "intermediate" | "pending";
export type SourcingPrecisionCohortKey = "regular" | "ea_mobile_high_traction" | "china_heat_ops" | "initial_backfill" | "unclassified";
export type SourcingPrecisionStatus = "provisional" | "meets_target" | "below_target" | "observational";
export type SourcingPrecisionAction = "collect_more_resolved_samples" | "monitor" | "tighten_misclassification_rules" | "observe_separately";

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
    sourcing_lane: Lead["sourcing_lane"];
    sourcing_rule_version: string | null;
    sourcing_run_type: Lead["sourcing_run_type"];
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
  precision: {
    target: number;
    minimum_resolved_samples: number;
    denominator: {
      included_outcomes: ["positive", "negative"];
      excluded_outcomes: ["intermediate", "pending"];
      excluded_states: ["未处理", "观察中", "未完成评测"];
    };
    cohorts: Record<SourcingPrecisionCohortKey, SourcingPrecisionStats>;
    regular_by_rule_version: Record<string, SourcingPrecisionStats>;
    guardrails: {
      automatic_rule_changes_allowed: false;
      below_target_action: "tighten_misclassification_rules";
      forbidden_quantity_controls: [
        "daily_recommendation_cap",
        "minimum_recommendation_count",
        "qualified_lead_truncation",
        "backfill"
      ];
    };
  };
  recommendations_ready: boolean;
  learning_note: string;
};

export type SourcingPrecisionStats = {
  sample_count: number;
  resolved_samples: number;
  excluded_samples: number;
  positive: number;
  negative: number;
  precision: number | null;
  target: number | null;
  provisional: boolean;
  target_met: boolean | null;
  status: SourcingPrecisionStatus;
  recommended_action: SourcingPrecisionAction;
  automatic_rule_changes_allowed: false;
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
const positiveBuckets = new Set(["待评测", "测试中", "跟进中", "推进池"]);
const positiveGrades = new Set(["S", "A+", "A", "A-", "B+"]);
const negativeGrades = new Set(["C+", "C", "C-"]);
const regularSourcingLanes = new Set(["indie_prelaunch", "china_joint"]);
const precisionCohortKeys: SourcingPrecisionCohortKey[] = ["regular", "ea_mobile_high_traction", "china_heat_ops", "initial_backfill", "unclassified"];
const regularPrecisionTarget = 0.8;
const minimumResolvedSamples = 30;
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
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
  const cohortCounters = newPrecisionCohortCounters();
  const regularRuleCounters = new Map<string, PrecisionCounter>();

  for (const event of latestByLead.values()) {
    const outcome = classifyOutcome(event);
    const provenance = decisionProvenance(event, leadsById.get(event.lead_id));
    const cohort = precisionCohort(provenance.sourcing_lane, provenance.sourcing_run_type);
    outcomes[outcome] += 1;
    addPrecisionSample(cohortCounters[cohort], outcome);
    if (cohort === "regular") {
      const ruleVersion = provenance.sourcing_rule_version ?? "unclassified";
      const counter = regularRuleCounters.get(ruleVersion) ?? newPrecisionCounter();
      addPrecisionSample(counter, outcome);
      regularRuleCounters.set(ruleVersion, counter);
    }
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

  const precision = buildPrecisionReport(cohortCounters, regularRuleCounters);
  const regularPrecision = precision.cohorts.regular;
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
    precision,
    recommendations_ready: !regularPrecision.provisional,
    learning_note: precisionLearningNote(regularPrecision)
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
  if (
    event.after.bucket === "淘汰池"
    || event.after.stage === "rejected"
    || event.after.review_status === "已淘汰"
    || negativeGrades.has(event.after.evaluation_grade ?? "")
  ) return "negative";
  if (positiveBuckets.has(event.after.bucket) || positiveGrades.has(event.after.evaluation_grade ?? "")) return "positive";
  if (event.after.bucket === "观察池") return "intermediate";
  return "pending";
}

function decisionProvenance(event: DecisionEvent, lead: Lead | undefined) {
  return {
    sourcing_lane: event.snapshot.sourcing_lane ?? lead?.sourcing_lane ?? null,
    sourcing_rule_version: event.snapshot.sourcing_rule_version ?? lead?.sourcing_rule_version ?? null,
    sourcing_run_type: event.snapshot.sourcing_run_type ?? lead?.sourcing_run_type ?? null
  };
}

function precisionCohort(
  sourcingLane: Lead["sourcing_lane"] | undefined,
  sourcingRunType: Lead["sourcing_run_type"] | undefined
): SourcingPrecisionCohortKey {
  if (sourcingRunType === "initial_backfill") return "initial_backfill";
  if (sourcingLane === "ea_mobile_high_traction") return "ea_mobile_high_traction";
  if (sourcingLane === "china_heat_ops") return "china_heat_ops";
  if (sourcingLane && regularSourcingLanes.has(sourcingLane)) return "regular";
  return "unclassified";
}

type PrecisionCounter = {
  sample_count: number;
  positive: number;
  negative: number;
  excluded: number;
};

function newPrecisionCounter(): PrecisionCounter {
  return { sample_count: 0, positive: 0, negative: 0, excluded: 0 };
}

function newPrecisionCohortCounters(): Record<SourcingPrecisionCohortKey, PrecisionCounter> {
  return Object.fromEntries(precisionCohortKeys.map((key) => [key, newPrecisionCounter()])) as Record<SourcingPrecisionCohortKey, PrecisionCounter>;
}

function addPrecisionSample(counter: PrecisionCounter, outcome: DecisionOutcome) {
  counter.sample_count += 1;
  if (outcome === "positive") counter.positive += 1;
  else if (outcome === "negative") counter.negative += 1;
  else counter.excluded += 1;
}

function buildPrecisionReport(
  cohortCounters: Record<SourcingPrecisionCohortKey, PrecisionCounter>,
  regularRuleCounters: Map<string, PrecisionCounter>
): SourcingLearningReport["precision"] {
  const cohorts = Object.fromEntries(precisionCohortKeys.map((key) => [
    key,
    precisionStats(cohortCounters[key], key === "regular" ? regularPrecisionTarget : null)
  ])) as Record<SourcingPrecisionCohortKey, SourcingPrecisionStats>;
  const regularByRuleVersion = Object.fromEntries([...regularRuleCounters.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ruleVersion, counter]) => [ruleVersion, precisionStats(counter, regularPrecisionTarget)]));

  return {
    target: regularPrecisionTarget,
    minimum_resolved_samples: minimumResolvedSamples,
    denominator: {
      included_outcomes: ["positive", "negative"],
      excluded_outcomes: ["intermediate", "pending"],
      excluded_states: ["未处理", "观察中", "未完成评测"]
    },
    cohorts,
    regular_by_rule_version: regularByRuleVersion,
    guardrails: {
      automatic_rule_changes_allowed: false,
      below_target_action: "tighten_misclassification_rules",
      forbidden_quantity_controls: [
        "daily_recommendation_cap",
        "minimum_recommendation_count",
        "qualified_lead_truncation",
        "backfill"
      ]
    }
  };
}

function precisionStats(counter: PrecisionCounter, target: number | null): SourcingPrecisionStats {
  const resolvedSamples = counter.positive + counter.negative;
  const provisional = resolvedSamples < minimumResolvedSamples;
  const precision = resolvedSamples ? rate(counter.positive, resolvedSamples) : null;
  const targetMet = target === null || provisional || precision === null ? null : precision >= target;
  const status: SourcingPrecisionStatus = provisional
    ? "provisional"
    : target === null
      ? "observational"
      : targetMet
        ? "meets_target"
        : "below_target";
  const recommendedAction: SourcingPrecisionAction = provisional
    ? "collect_more_resolved_samples"
    : target === null
      ? "observe_separately"
      : targetMet
        ? "monitor"
        : "tighten_misclassification_rules";

  return {
    sample_count: counter.sample_count,
    resolved_samples: resolvedSamples,
    excluded_samples: counter.excluded,
    positive: counter.positive,
    negative: counter.negative,
    precision,
    target,
    provisional,
    target_met: targetMet,
    status,
    recommended_action: recommendedAction,
    automatic_rule_changes_allowed: false
  };
}

function precisionLearningNote(regular: SourcingPrecisionStats) {
  if (regular.provisional) {
    return `常规通道已解决样本 ${regular.resolved_samples} 个，少于 ${minimumResolvedSamples} 个，结果为 provisional；只积累样本，不自动修改生产规则。`;
  }
  if (regular.target_met === false) {
    return `常规通道精度 ${percent(regular.precision)}，低于 ${percent(regularPrecisionTarget)}；应定位并收紧产生误判的规则，不得设置推荐上限、最低数量、截断或 backfill。`;
  }
  return `常规通道精度 ${percent(regular.precision)}，达到 ${percent(regularPrecisionTarget)} 目标；继续监测且不自动修改生产规则。`;
}

function percent(value: number | null) {
  return value === null ? "暂无" : `${Number((value * 100).toFixed(2))}%`;
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
    sourcing_lane: lead.sourcing_lane,
    sourcing_rule_version: lead.sourcing_rule_version,
    sourcing_run_type: lead.sourcing_run_type,
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
