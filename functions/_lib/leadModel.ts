export type Bucket = "未处理" | "推进池" | "待评测" | "测试中" | "跟进中" | "观察池" | "淘汰池";
export type Stage = "new" | "watch" | "active" | "negotiating" | "won" | "rejected";
export type Priority = "P0" | "P1" | "P2" | "P3" | null;
export type SourcingLane = "indie_prelaunch" | "china_joint" | "ea_mobile_high_traction" | "china_heat_ops";
export type SourcingRunType = "scheduled" | "initial_backfill";
export type RegionPriority = "国内优先" | "海外-高视觉" | "海外-强数据" | "其他";
export type Region = "中国" | "海外";
export type ReviewStatus = "未处理" | "已查看" | "跟进中" | "已淘汰";
export type ContactType = "微信/QQ" | "Email" | "电话" | "官网" | "Steam" | "Discord" | "B站" | "X/Twitter" | "其他";
export type EvaluationGrade = "S" | "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-";

export type ContactMethod = {
  type: ContactType;
  value: string;
  note?: string | null;
};

export type Lead = {
  id: string;
  project: string;
  steam_app_id: string | null;
  team: string | null;
  team_size: string | null;
  country: string;
  region: Region;
  city: string | null;
  region_priority: RegionPriority;
  bucket: Bucket;
  stage: Stage;
  priority: Priority;
  sourcing_lane: SourcingLane | null;
  sourcing_rule_version: string | null;
  sourcing_run_type: SourcingRunType | null;
  review_status: ReviewStatus;
  reviewed_at: string | null;
  drop_reason: string | null;
  priority_reason: string | null;
  rule_fit: string | null;
  genre: string | null;
  gameplay: string | null;
  progress: string;
  release_window: string | null;
  early_access: boolean;
  narrative_heavy: boolean;
  india_team: boolean;
  publisher_status: string;
  publisher_name: string | null;
  china_capability_occupied: boolean;
  traction_summary: string | null;
  public_signals: string | null;
  contact: string | null;
  contact_methods: ContactMethod[];
  links: string[];
  exposure_trail: string | null;
  bilibili_fit: string;
  amplification: string;
  risks: string | null;
  verdict: string;
  evaluation_grade: EvaluationGrade | null;
  evaluation_result: string | null;
  evaluated_at: string | null;
  next_action: string | null;
  owner: string | null;
  due_date: string | null;
  calendar_enabled: boolean;
  follow_up_interval: string | null;
  first_seen: string;
  notes: string | null;
};

export type ExportLead = Omit<Lead, "priority"> & {
  priority: NonNullable<Priority> | "";
};

export type DailyReport = {
  report_date: string;
  summary: string;
  insights: string[];
  push_pool: Partial<Lead>[];
  watch_pool: Partial<Lead>[];
  drop_pool: Partial<Lead>[];
};

export type ImportStats = {
  created_unprocessed: number;
  created_dropped: number;
  created_other: number;
  updated_unprocessed_visible: number;
  updated_existing_workflow: number;
  updated_dropped: number;
  updated_other: number;
  visible_unprocessed: number;
  stale_updates: number;
};

export type NormalizeLeadOptions = {
  today?: string;
};

export type MergeIncomingLeadSetResult = {
  leads: Lead[];
  created: number;
  updated: number;
  dropped: number;
  total: number;
  import_stats: ImportStats;
};

export type CreateOnlyIncomingLeadSetResult = {
  leads: Lead[];
  created: number;
  skipped_existing: number;
  updated: 0;
  dropped: number;
  total: number;
  import_stats: ImportStats;
};

const bucketValues: Bucket[] = ["未处理", "待评测", "测试中", "观察池", "跟进中", "推进池", "淘汰池"];
const priorityValues: NonNullable<Priority>[] = ["P0", "P1", "P2", "P3"];
const sourcingLaneValues: SourcingLane[] = ["indie_prelaunch", "china_joint", "ea_mobile_high_traction", "china_heat_ops"];
const sourcingRunTypeValues: SourcingRunType[] = ["scheduled", "initial_backfill"];
const reviewStatusValues: ReviewStatus[] = ["未处理", "已查看", "跟进中", "已淘汰"];
const contactTypes: ContactType[] = ["微信/QQ", "Email", "电话", "官网", "Steam", "Discord", "B站", "X/Twitter", "其他"];
const evaluationGrades: EvaluationGrade[] = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"];

export function normalizeLead(raw: Partial<Lead>, options: NormalizeLeadOptions = {}): Lead {
  const project = requiredString(raw.project, "project");
  const firstSeen = raw.first_seen ?? options.today ?? new Date().toISOString().slice(0, 10);
  const country = raw.country ?? "未知";
  const region = raw.region ?? inferRegion(country);
  const bucket = normalizeBucket(raw.bucket);
  const steamAppId = valueOrNull(raw.steam_app_id);
  const links = normalizeLinks(raw.links, steamAppId);
  const contactMethods = normalizeContacts(raw.contact_methods, raw.contact);
  return {
    id: raw.id ?? makeLeadId(project, steamAppId, firstSeen),
    project,
    steam_app_id: steamAppId,
    team: valueOrNull(raw.team),
    team_size: valueOrNull(raw.team_size),
    country,
    region,
    city: valueOrNull(raw.city),
    region_priority: raw.region_priority ?? inferRegionPriority(country, raw.public_signals),
    bucket,
    stage: raw.stage ?? stageFromBucket(bucket),
    priority: normalizePriority(raw.priority, bucket),
    sourcing_lane: normalizeSourcingLane(raw.sourcing_lane),
    sourcing_rule_version: valueOrNull(raw.sourcing_rule_version),
    sourcing_run_type: normalizeSourcingRunType(raw.sourcing_run_type),
    review_status: normalizeReviewStatus(raw.review_status, bucket),
    reviewed_at: valueOrNull(raw.reviewed_at),
    drop_reason: valueOrNull(raw.drop_reason),
    priority_reason: valueOrNull(raw.priority_reason),
    rule_fit: valueOrNull(raw.rule_fit) ?? inferRuleFit(raw, country, links),
    genre: valueOrNull(raw.genre),
    gameplay: valueOrNull(raw.gameplay),
    progress: raw.progress ?? "待补充",
    release_window: valueOrNull(raw.release_window),
    early_access: Boolean(raw.early_access),
    narrative_heavy: Boolean(raw.narrative_heavy),
    india_team: Boolean(raw.india_team),
    publisher_status: raw.publisher_status ?? "待确认",
    publisher_name: valueOrNull(raw.publisher_name),
    china_capability_occupied: Boolean(raw.china_capability_occupied),
    traction_summary: valueOrNull(raw.traction_summary),
    public_signals: valueOrNull(raw.public_signals),
    contact: valueOrNull(raw.contact),
    contact_methods: contactMethods,
    links,
    exposure_trail: valueOrNull(raw.exposure_trail),
    bilibili_fit: raw.bilibili_fit ?? "待评估",
    amplification: raw.amplification ?? "待评估",
    risks: valueOrNull(raw.risks),
    verdict: raw.verdict ?? "待判断",
    evaluation_grade: normalizeEvaluationGrade(raw.evaluation_grade),
    evaluation_result: valueOrNull(raw.evaluation_result),
    evaluated_at: valueOrNull(raw.evaluated_at),
    next_action: valueOrNull(raw.next_action),
    owner: valueOrNull(raw.owner),
    due_date: valueOrNull(raw.due_date),
    calendar_enabled: Boolean(raw.calendar_enabled),
    follow_up_interval: valueOrNull(raw.follow_up_interval),
    first_seen: firstSeen,
    notes: valueOrNull(raw.notes)
  };
}

export function mergeIncomingLeadSet(existing: Lead[], rawLeads: Partial<Lead>[], options: NormalizeLeadOptions = {}): MergeIncomingLeadSetResult {
  const byKey = new Map(existing.flatMap((lead) => leadKeys(lead).map((key) => [key, lead.id] as const)));
  const byId = new Map(existing.map((lead) => [lead.id, lead]));
  let created = 0;
  let updated = 0;
  let dropped = 0;
  const import_stats: ImportStats = {
    created_unprocessed: 0,
    created_dropped: 0,
    created_other: 0,
    updated_unprocessed_visible: 0,
    updated_existing_workflow: 0,
    updated_dropped: 0,
    updated_other: 0,
    visible_unprocessed: 0,
    stale_updates: 0
  };

  for (const raw of rawLeads) {
    const incoming = normalizeLead(raw, options);
    const matchId = leadKeys(incoming).map((key) => byKey.get(key)).find(Boolean);
    if (matchId && byId.has(matchId)) {
      const current = byId.get(matchId)!;
      const merged = mergeLead(current, incoming);
      byId.set(current.id, merged);
      for (const key of leadKeys(merged)) byKey.set(key, merged.id);
      updated += 1;
      trackUpdatedImport(import_stats, current, incoming);
    } else {
      byId.set(incoming.id, incoming);
      for (const key of leadKeys(incoming)) byKey.set(key, incoming.id);
      created += 1;
      trackCreatedImport(import_stats, incoming);
    }
    if (incoming.bucket === "淘汰池") dropped += 1;
  }

  import_stats.visible_unprocessed = import_stats.created_unprocessed + import_stats.updated_unprocessed_visible;
  import_stats.stale_updates = import_stats.updated_existing_workflow;

  const leads = Array.from(byId.values()).sort((a, b) => {
    const bucketOrder: Record<Bucket, number> = { "未处理": 0, "待评测": 1, "测试中": 2, "观察池": 3, "跟进中": 4, "推进池": 5, "淘汰池": 6 };
    return reviewOrder(a.review_status) - reviewOrder(b.review_status)
      || bucketOrder[a.bucket] - bucketOrder[b.bucket]
      || priorityOrder(a.priority) - priorityOrder(b.priority)
      || a.project.localeCompare(b.project, "zh-CN");
  });

  return { leads, created, updated, dropped, total: leads.length, import_stats };
}

export function createOnlyIncomingLeadSet(existing: Lead[], rawLeads: Partial<Lead>[], options: NormalizeLeadOptions = {}): CreateOnlyIncomingLeadSetResult {
  const existingIds = new Set(existing.map((lead) => lead.id));
  const existingKeys = new Set(existing.flatMap((lead) => leadKeys(lead)));
  const leads: Lead[] = [];
  let skipped_existing = 0;
  let dropped = 0;
  const import_stats: ImportStats = {
    created_unprocessed: 0,
    created_dropped: 0,
    created_other: 0,
    updated_unprocessed_visible: 0,
    updated_existing_workflow: 0,
    updated_dropped: 0,
    updated_other: 0,
    visible_unprocessed: 0,
    stale_updates: 0
  };

  for (const raw of rawLeads) {
    const incoming = normalizeLead(raw, options);
    const keys = leadKeys(incoming);
    if (existingIds.has(incoming.id) || keys.some((key) => existingKeys.has(key))) {
      skipped_existing += 1;
      continue;
    }

    leads.push(incoming);
    existingIds.add(incoming.id);
    for (const key of keys) existingKeys.add(key);
    trackCreatedImport(import_stats, incoming);
    if (incoming.bucket === "淘汰池") dropped += 1;
  }

  import_stats.visible_unprocessed = import_stats.created_unprocessed;
  return {
    leads,
    created: leads.length,
    skipped_existing,
    updated: 0,
    dropped,
    total: existing.length + leads.length,
    import_stats
  };
}

export function mergeLead(current: Lead, incoming: Lead): Lead {
  const keepCurrentWorkflow = shouldKeepCurrentWorkflow(current, incoming);
  return normalizeLead({
    ...current,
    ...incoming,
    id: current.id,
    first_seen: current.first_seen,
    bucket: keepCurrentWorkflow ? current.bucket : incoming.bucket,
    stage: keepCurrentWorkflow ? current.stage : incoming.stage,
    priority: current.priority,
    owner: current.owner ?? incoming.owner,
    due_date: current.due_date ?? incoming.due_date,
    calendar_enabled: current.calendar_enabled || incoming.calendar_enabled,
    follow_up_interval: current.follow_up_interval ?? incoming.follow_up_interval,
    review_status: keepCurrentWorkflow ? current.review_status : incoming.review_status,
    reviewed_at: keepCurrentWorkflow ? current.reviewed_at : incoming.reviewed_at,
    drop_reason: current.drop_reason ?? incoming.drop_reason,
    evaluation_grade: current.evaluation_grade ?? incoming.evaluation_grade,
    evaluation_result: current.evaluation_result ?? incoming.evaluation_result,
    evaluated_at: current.evaluated_at ?? incoming.evaluated_at,
    next_action: current.next_action ?? incoming.next_action,
    contact_methods: mergeContactMethods(current.contact_methods, incoming.contact_methods),
    links: mergeStringArrays(current.links, incoming.links),
    notes: mergeNotes(current.notes, incoming.notes)
  });
}

function shouldKeepCurrentWorkflow(current: Lead, incoming: Lead) {
  if (incoming.bucket === "未处理" && incoming.review_status === "未处理" && current.bucket === "未处理") {
    return false;
  }

  if (incoming.bucket === "未处理" && incoming.review_status === "未处理" && current.bucket === "观察池" && current.review_status === "未处理" && !current.reviewed_at) {
    return false;
  }

  return true;
}

export function leadKeys(lead: Lead) {
  const keys = [`project:${normalizeText(lead.project)}`];
  if (lead.steam_app_id) keys.push(`steam:${normalizeText(lead.steam_app_id)}`);
  for (const link of lead.links) keys.push(`link:${normalizeUrl(link)}`);
  return keys;
}

export function buildLeadDedupeIndex(leads: Lead[], options: { generatedAt?: string } = {}) {
  const projects = new Set<string>();
  const steam_app_ids = new Set<string>();
  const links = new Set<string>();
  const keys = new Set<string>();

  for (const lead of leads) {
    if (lead.project) projects.add(normalizeText(lead.project));
    if (lead.steam_app_id) steam_app_ids.add(normalizeText(lead.steam_app_id));
    for (const link of lead.links ?? []) links.add(normalizeUrl(link));
    for (const key of leadKeys(lead)) keys.add(key);
  }

  return {
    generated_at: options.generatedAt ?? new Date().toISOString(),
    total: leads.length,
    projects: [...projects].sort(),
    steam_app_ids: [...steam_app_ids].sort(),
    links: [...links].sort(),
    keys: [...keys].sort()
  };
}

function trackCreatedImport(stats: ImportStats, incoming: Lead) {
  if (incoming.bucket === "未处理" && incoming.review_status === "未处理") {
    stats.created_unprocessed += 1;
  } else if (incoming.bucket === "淘汰池") {
    stats.created_dropped += 1;
  } else {
    stats.created_other += 1;
  }
}

function trackUpdatedImport(stats: ImportStats, current: Lead, incoming: Lead) {
  if (incoming.bucket === "淘汰池") {
    stats.updated_dropped += 1;
  } else if (current.bucket === "未处理" && current.review_status === "未处理") {
    stats.updated_unprocessed_visible += 1;
  } else if (incoming.bucket === "未处理" && incoming.review_status === "未处理") {
    stats.updated_existing_workflow += 1;
  } else {
    stats.updated_other += 1;
  }
}

export function leadsFromReport(report: DailyReport): Partial<Lead>[] {
  if (!report.report_date || !Array.isArray(report.push_pool) || !Array.isArray(report.watch_pool) || !Array.isArray(report.drop_pool)) throw new Error("Invalid daily report");
  return [
    ...report.push_pool.map((lead) => ({ ...lead, bucket: "未处理" as const, stage: "new" as const, review_status: "未处理" as const })),
    ...report.watch_pool.map((lead) => ({ ...lead, bucket: "未处理" as const, stage: "new" as const, review_status: "未处理" as const })),
    ...report.drop_pool.map((lead) => ({ ...lead, bucket: "淘汰池" as const, stage: lead.stage ?? "rejected", review_status: "已淘汰" as const }))
  ].map((lead) => ({
    ...lead,
    first_seen: lead.first_seen ?? report.report_date
  }));
}

export function isDailyReport(value: unknown): value is DailyReport {
  return Boolean(value && typeof value === "object" && "report_date" in value && "push_pool" in value && "watch_pool" in value && "drop_pool" in value);
}

export function leadsForExport(leads: Lead[]): ExportLead[] {
  return leads.map((lead) => ({
    ...lead,
    priority: lead.priority ?? ""
  }));
}

export function toCsv(leads: Lead[]) {
  const columns: (keyof Lead)[] = ["project", "team", "region", "country", "city", "bucket", "stage", "priority", "review_status", "reviewed_at", "drop_reason", "priority_reason", "rule_fit", "genre", "progress", "release_window", "publisher_status", "contact_methods", "links", "bilibili_fit", "amplification", "verdict", "evaluation_grade", "evaluation_result", "evaluated_at", "next_action", "owner", "due_date", "calendar_enabled", "follow_up_interval", "notes", "first_seen"];
  const header = columns.join(",");
  const rows = leads.map((lead) => columns.map((column) => csvCell(lead[column])).join(","));
  return `${header}\n${rows.join("\n")}\n`;
}

function makeLeadId(project: string, steamAppId: string | null | undefined, firstSeen: string) {
  const suffix = steamAppId ? `steam_${steamAppId}` : normalizeText(project).replaceAll(" ", "_");
  return `lead_${suffix}_${firstSeen}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

function inferRegionPriority(country: string | undefined, signals: string | null | undefined): RegionPriority {
  if (isDomestic(country)) return "国内优先";
  const text = `${signals ?? ""}`.toLowerCase();
  if (text.includes("wishlist") || text.includes("愿望单") || text.includes("followers") || text.includes("strong data")) return "海外-强数据";
  if (text.includes("视觉") || text.includes("trailer") || text.includes("art")) return "海外-高视觉";
  return "其他";
}

function inferRegion(country: string | undefined): Region {
  return isDomestic(country) ? "中国" : "海外";
}

function inferRuleFit(raw: Partial<Lead>, country: string, links: string[]) {
  const reasons: string[] = [];
  if (isDomestic(country)) reasons.push("国内项目优先");
  if (raw.early_access) reasons.push("命中排除项：EA");
  if (raw.narrative_heavy) reasons.push("命中排除项：叙事主导");
  if (raw.india_team) reasons.push("命中排除项：印度团队");
  if (raw.china_capability_occupied) reasons.push("中国发行能力可能已占位");
  if (!isDomestic(country) && (raw.region_priority === "海外-高视觉" || raw.region_priority === "海外-强数据")) reasons.push("海外保留条件成立");
  if (!links.length) reasons.push("缺少可验证链接");
  return reasons.length ? reasons.join("；") : "符合基础筛选，待人工复核";
}

function normalizeLinks(value: unknown, steamAppId: string | null) {
  const sourceLinks = Array.isArray(value)
    ? value.filter((link): link is string => typeof link === "string").map((link) => link.trim()).filter(Boolean)
    : [];
  const links = sourceLinks.filter((link) => {
    const linkedSteamAppId = steamAppIdFromLink(link);
    return !linkedSteamAppId || !steamAppId || linkedSteamAppId === steamAppId;
  });

  if (steamAppId) {
    const storeLink = `https://store.steampowered.com/app/${steamAppId}/`;
    const steamDbLink = `https://steamdb.info/app/${steamAppId}/`;
    if (!links.some((link) => normalizeUrl(link) === normalizeUrl(steamDbLink))) links.unshift(steamDbLink);
    if (!links.some((link) => normalizeUrl(link) === normalizeUrl(storeLink))) links.unshift(storeLink);
  }

  const deduped = new Map<string, string>();
  for (const link of links) deduped.set(normalizeUrl(link), link);
  return Array.from(deduped.values());
}

function normalizeContacts(value: unknown, legacyContact: unknown): ContactMethod[] {
  const methods: ContactMethod[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const type = contactTypes.includes(record.type as ContactType) ? record.type as ContactType : "其他";
      const contactValue = typeof record.value === "string" ? record.value.trim() : "";
      if (!contactValue || isGameStoreLink(contactValue)) continue;
      methods.push({ type, value: contactValue, note: valueOrNull(record.note) });
    }
  }

  if (!methods.length && typeof legacyContact === "string" && legacyContact.trim() && !isGameStoreLink(legacyContact)) {
    methods.push({ type: inferContactType(legacyContact), value: legacyContact.trim(), note: "legacy contact" });
  }

  return methods;
}

function inferContactType(value: string): ContactType {
  const lower = value.toLowerCase();
  if (lower.includes("@")) return "Email";
  if (/\+?\d[\d\s-]{6,}/.test(value)) return "电话";
  if (lower.includes("steam")) return "Steam";
  if (lower.includes("discord")) return "Discord";
  if (lower.includes("bilibili") || lower.includes("b23.tv") || lower.includes("space.bilibili")) return "B站";
  if (lower.includes("twitter") || lower.includes("x.com")) return "X/Twitter";
  if (lower.includes("http")) return "官网";
  return "微信/QQ";
}

function isDomestic(country: string | undefined) {
  return Boolean(country && ["中国", "大陆", "香港", "台湾", "澳门", "China", "Hong Kong", "Taiwan", "Macau"].some((token) => country.includes(token)));
}

function normalizeBucket(value: unknown): Bucket {
  return bucketValues.includes(value as Bucket) ? value as Bucket : "未处理";
}

function normalizeReviewStatus(value: unknown, bucket: Bucket): ReviewStatus {
  if (bucket === "未处理") return "未处理";
  if (reviewStatusValues.includes(value as ReviewStatus)) return value as ReviewStatus;
  if (bucket === "跟进中" || bucket === "推进池" || bucket === "测试中") return "跟进中";
  if (bucket === "待评测") return "已查看";
  if (bucket === "淘汰池") return "已淘汰";
  return "未处理";
}

function normalizeEvaluationGrade(value: unknown): EvaluationGrade | null {
  return evaluationGrades.includes(value as EvaluationGrade) ? value as EvaluationGrade : null;
}

function stageFromBucket(bucket: Bucket | undefined): Stage {
  if (bucket === "未处理") return "new";
  if (bucket === "推进池") return "negotiating";
  if (bucket === "跟进中" || bucket === "测试中") return "active";
  if (bucket === "淘汰池") return "rejected";
  if (bucket === "待评测") return "watch";
  return "watch";
}

function priorityFromBucket(bucket: Bucket | undefined): NonNullable<Priority> {
  if (bucket === "推进池" || bucket === "跟进中" || bucket === "测试中") return "P1";
  if (bucket === "待评测" || bucket === "观察池") return "P2";
  if (bucket === "淘汰池") return "P3";
  return "P2";
}

function normalizePriority(value: unknown, bucket: Bucket): Priority {
  if (value === null) return null;
  return priorityValues.includes(value as NonNullable<Priority>) ? value as NonNullable<Priority> : priorityFromBucket(bucket);
}

function normalizeSourcingLane(value: unknown): SourcingLane | null {
  return sourcingLaneValues.includes(value as SourcingLane) ? value as SourcingLane : null;
}

function normalizeSourcingRunType(value: unknown): SourcingRunType | null {
  return sourcingRunTypeValues.includes(value as SourcingRunType) ? value as SourcingRunType : null;
}

function priorityOrder(priority: Priority) {
  if (priority === null) return 4;
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[priority];
}

function reviewOrder(status: ReviewStatus) {
  return { "未处理": 0, "跟进中": 1, "已查看": 2, "已淘汰": 3 }[status];
}

function mergeNotes(current: string | null, incoming: string | null) {
  if (!current) return incoming;
  if (!incoming || current.includes(incoming)) return current;
  return `${current}\n${incoming}`;
}

function mergeStringArrays(current: string[], incoming: string[]) {
  const deduped = new Map<string, string>();
  for (const value of [...current, ...incoming]) {
    if (value) deduped.set(normalizeUrl(value), value);
  }
  return Array.from(deduped.values());
}

function mergeContactMethods(current: ContactMethod[], incoming: ContactMethod[]) {
  const deduped = new Map<string, ContactMethod>();
  for (const method of [...current, ...incoming]) {
    if (!method.value || isGameStoreLink(method.value)) continue;
    const key = `${method.type}:${normalizeText(method.value)}`;
    if (!deduped.has(key)) deduped.set(key, method);
  }
  return Array.from(deduped.values());
}

function csvCell(value: unknown) {
  if (Array.isArray(value)) {
    if (value.every((item) => item && typeof item === "object" && "value" in item)) {
      return csvCell((value as ContactMethod[]).map((item) => `${item.type}:${item.value}${item.note ? ` (${item.note})` : ""}`).join(" | "));
    }
    return csvCell(value.join(" | "));
  }
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function valueOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing required field: ${field}`);
  return value.trim();
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeUrl(value: string) {
  return value.trim().toLowerCase().replace(/\/$/, "");
}

function steamAppIdFromLink(link: string) {
  const match = link.match(/(?:store\.steampowered\.com|steamdb\.info)\/app\/(\d+)/i);
  return match?.[1] ?? null;
}

function isGameStoreLink(value: string) {
  return /(?:store\.steampowered\.com|steamdb\.info)\/app\/\d+/i.test(value);
}
