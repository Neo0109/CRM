import { readCrmSettings } from "./settings";

type Bucket = "推进池" | "待评测" | "测试中" | "跟进中" | "观察池" | "淘汰池";
type Stage = "new" | "watch" | "active" | "negotiating" | "won" | "rejected";
type Priority = "P0" | "P1" | "P2" | "P3";
type RegionPriority = "国内优先" | "海外-高视觉" | "海外-强数据" | "其他";
type Region = "中国" | "海外";
type ReviewStatus = "未处理" | "已查看" | "跟进中" | "已淘汰";
type ContactType = "微信/QQ" | "Email" | "电话" | "官网" | "Steam" | "Discord" | "B站" | "X/Twitter" | "其他";

type ContactMethod = {
  type: ContactType;
  value: string;
  note?: string | null;
};

const reportRepoFullName = "Neo0109/CRM";
const reportBranch = "main";
const reportDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const bucketValues: Bucket[] = ["待评测", "测试中", "跟进中", "观察池", "推进池", "淘汰池"];
const reviewStatusValues: ReviewStatus[] = ["未处理", "已查看", "跟进中", "已淘汰"];
const contactTypes: ContactType[] = ["微信/QQ", "Email", "电话", "官网", "Steam", "Discord", "B站", "X/Twitter", "其他"];

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  CRM_ACCESS_TOKEN?: string;
  EXCEL_EXPORT_PASSWORD?: string;
  RESEND_API_KEY?: string;
  CRM_FROM_EMAIL?: string;
};

export type PagesContext = {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
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
  review_status: ReviewStatus;
  reviewed_at: string | null;
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
  next_action: string | null;
  owner: string | null;
  due_date: string | null;
  calendar_enabled: boolean;
  follow_up_interval: string | null;
  first_seen: string;
  notes: string | null;
};

type DailyReport = {
  report_date: string;
  summary: string;
  insights: string[];
  push_pool: Partial<Lead>[];
  watch_pool: Partial<Lead>[];
  drop_pool: Partial<Lead>[];
};

export async function requireAccess(request: Request, env: Env) {
  const headerToken = request.headers.get("x-crm-token");
  const cookieToken = readCookie(request.headers.get("cookie"), "crm_access_token");
  const candidateTokens = [env.CRM_ACCESS_TOKEN];

  try {
    const settings = await readCrmSettings(env);
    if (settings.login_password) candidateTokens.push(settings.login_password);
  } catch {
    // Keep the env token usable even if settings storage is unavailable.
  }

  const validTokens = candidateTokens.filter(Boolean);
  if (!validTokens.length) return null;
  if (validTokens.includes(headerToken ?? "") || validTokens.includes(cookieToken ?? "")) return null;
  return json({ error: "CRM access token required" }, 401);
}

export async function readLeads(env: Env): Promise<Lead[]> {
  const response = await supabaseFetch(env, "/rest/v1/crm_leads?select=id,data&order=updated_at.desc");
  const rows = (await response.json()) as { id: string; data: Lead }[];
  return rows.filter((row) => !row.id.startsWith("__crm_")).map((row) => normalizeLead(row.data));
}

export async function writeLeads(env: Env, leads: Lead[]) {
  if (!leads.length) return;
  await supabaseFetch(env, "/rest/v1/crm_leads?on_conflict=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(leads.map((lead) => ({ id: lead.id, data: normalizeLead(lead), updated_at: new Date().toISOString() })))
  });
}

export async function mergeIncomingLeads(env: Env, rawLeads: Partial<Lead>[]) {
  const existing = await readLeads(env);
  const byKey = new Map(existing.flatMap((lead) => leadKeys(lead).map((key) => [key, lead.id] as const)));
  const byId = new Map(existing.map((lead) => [lead.id, lead]));
  let created = 0;
  let updated = 0;
  let dropped = 0;

  for (const raw of rawLeads) {
    const incoming = normalizeLead(raw);
    const matchId = leadKeys(incoming).map((key) => byKey.get(key)).find(Boolean);
    if (matchId && byId.has(matchId)) {
      const current = byId.get(matchId)!;
      const merged = mergeLead(current, incoming);
      byId.set(current.id, merged);
      for (const key of leadKeys(merged)) byKey.set(key, merged.id);
      updated += 1;
    } else {
      byId.set(incoming.id, incoming);
      for (const key of leadKeys(incoming)) byKey.set(key, incoming.id);
      created += 1;
    }
    if (incoming.bucket === "淘汰池") dropped += 1;
  }

  const nextLeads = Array.from(byId.values()).sort((a, b) => {
    const bucketOrder: Record<Bucket, number> = { "待评测": 0, "测试中": 1, "跟进中": 2, "观察池": 3, "推进池": 4, "淘汰池": 5 };
    return reviewOrder(a.review_status) - reviewOrder(b.review_status)
      || bucketOrder[a.bucket] - bucketOrder[b.bucket]
      || priorityOrder(a.priority) - priorityOrder(b.priority)
      || a.project.localeCompare(b.project, "zh-CN");
  });

  await writeLeads(env, nextLeads);
  return { created, updated, dropped, total: nextLeads.length };
}

export function leadsFromReport(report: DailyReport): Partial<Lead>[] {
  if (!report.report_date || !Array.isArray(report.push_pool) || !Array.isArray(report.watch_pool) || !Array.isArray(report.drop_pool)) throw new Error("Invalid daily report");
  return [
    ...report.push_pool.map((lead) => ({ ...lead, bucket: "观察池" as const, stage: "new" as const, review_status: "未处理" as const })),
    ...report.watch_pool.map((lead) => ({ ...lead, bucket: "观察池" as const, stage: "new" as const, review_status: "未处理" as const })),
    ...report.drop_pool.map((lead) => ({ ...lead, bucket: "淘汰池" as const, stage: lead.stage ?? "rejected", review_status: "已淘汰" as const }))
  ].map((lead) => ({
    ...lead,
    first_seen: lead.first_seen ?? report.report_date,
    notes: appendText(lead.notes, `导入日报 ${report.report_date}：${report.summary}`)
  }));
}

export async function syncReportFromRepository(env: Env, reportDate = todayInShanghai()) {
  if (!reportDatePattern.test(reportDate)) throw new Error("Invalid report date");

  const source = `https://raw.githubusercontent.com/${reportRepoFullName}/${reportBranch}/data/reports/${reportDate}.json`;
  const response = await fetch(`${source}?t=${Date.now()}`, {
    headers: { Accept: "application/json" }
  });

  if (response.status === 404) return { synced: false, report_date: reportDate, reason: "report_not_found", source };
  if (!response.ok) throw new Error(`Report fetch failed: ${response.status}`);

  const report = (await response.json()) as DailyReport;
  const result = await mergeIncomingLeads(env, leadsFromReport(report));
  return {
    synced: true,
    ...result,
    report_date: report.report_date,
    summary: report.summary,
    source
  };
}

export function todayInShanghai() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function isDailyReport(value: unknown): value is DailyReport {
  return Boolean(value && typeof value === "object" && "report_date" in value && "push_pool" in value && "watch_pool" in value && "drop_pool" in value);
}

export function toCsv(leads: Lead[]) {
  const columns: (keyof Lead)[] = ["project", "team", "region", "country", "city", "bucket", "stage", "priority", "review_status", "reviewed_at", "priority_reason", "rule_fit", "genre", "progress", "release_window", "publisher_status", "contact_methods", "links", "bilibili_fit", "amplification", "verdict", "next_action", "owner", "due_date", "calendar_enabled", "follow_up_interval", "notes", "first_seen"];
  const header = columns.join(",");
  const rows = leads.map((lead) => columns.map((column) => csvCell(lead[column])).join(","));
  return `${header}\n${rows.join("\n")}\n`;
}

export function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
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

function normalizeLead(raw: Partial<Lead>): Lead {
  const project = requiredString(raw.project, "project");
  const firstSeen = raw.first_seen ?? new Date().toISOString().slice(0, 10);
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
    priority: raw.priority ?? priorityFromBucket(bucket),
    review_status: normalizeReviewStatus(raw.review_status, bucket),
    reviewed_at: valueOrNull(raw.reviewed_at),
    priority_reason: valueOrNull(raw.priority_reason) ?? inferPriorityReason(raw),
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
    next_action: valueOrNull(raw.next_action),
    owner: valueOrNull(raw.owner),
    due_date: valueOrNull(raw.due_date),
    calendar_enabled: Boolean(raw.calendar_enabled),
    follow_up_interval: valueOrNull(raw.follow_up_interval),
    first_seen: firstSeen,
    notes: valueOrNull(raw.notes)
  };
}

function mergeLead(current: Lead, incoming: Lead): Lead {
  const manuallyRouted = current.review_status !== "未处理" || (current.bucket !== "观察池" && current.bucket !== incoming.bucket);
  return normalizeLead({
    ...current,
    ...incoming,
    id: current.id,
    first_seen: current.first_seen,
    bucket: manuallyRouted ? current.bucket : incoming.bucket,
    stage: manuallyRouted ? current.stage : incoming.stage,
    owner: current.owner ?? incoming.owner,
    due_date: current.due_date ?? incoming.due_date,
    calendar_enabled: current.calendar_enabled || incoming.calendar_enabled,
    follow_up_interval: current.follow_up_interval ?? incoming.follow_up_interval,
    review_status: current.review_status,
    reviewed_at: current.reviewed_at,
    contact_methods: mergeContactMethods(current.contact_methods, incoming.contact_methods),
    links: mergeStringArrays(current.links, incoming.links),
    notes: mergeNotes(current.notes, incoming.notes)
  });
}

function leadKeys(lead: Lead) {
  const keys = [`project:${normalizeText(lead.project)}`];
  if (lead.steam_app_id) keys.push(`steam:${normalizeText(lead.steam_app_id)}`);
  for (const link of lead.links) keys.push(`link:${normalizeUrl(link)}`);
  return keys;
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

function inferPriorityReason(raw: Partial<Lead>) {
  if (raw.priority_reason) return raw.priority_reason;
  if (raw.bucket === "推进池" || raw.bucket === "跟进中" || raw.bucket === "测试中") return raw.traction_summary ?? raw.verdict ?? "进入重点处理队列，需要优先 review";
  if (raw.bucket === "待评测") return raw.traction_summary ?? raw.verdict ?? "已进入提测队列，等待产品验证";
  if (raw.bucket === "淘汰池") return raw.risks ?? raw.verdict ?? "触发淘汰规则";
  return raw.traction_summary ?? raw.public_signals ?? "等待更强公开信号";
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
  return bucketValues.includes(value as Bucket) ? value as Bucket : "观察池";
}

function normalizeReviewStatus(value: unknown, bucket: Bucket): ReviewStatus {
  if (reviewStatusValues.includes(value as ReviewStatus)) return value as ReviewStatus;
  if (bucket === "跟进中" || bucket === "推进池" || bucket === "测试中") return "跟进中";
  if (bucket === "待评测") return "已查看";
  if (bucket === "淘汰池") return "已淘汰";
  return "未处理";
}

function stageFromBucket(bucket: Bucket | undefined): Stage {
  if (bucket === "推进池") return "negotiating";
  if (bucket === "跟进中" || bucket === "测试中") return "active";
  if (bucket === "淘汰池") return "rejected";
  if (bucket === "待评测") return "watch";
  return "watch";
}

function priorityFromBucket(bucket: Bucket | undefined): Priority {
  if (bucket === "推进池" || bucket === "跟进中" || bucket === "测试中") return "P1";
  if (bucket === "待评测" || bucket === "观察池") return "P2";
  if (bucket === "淘汰池") return "P3";
  return "P2";
}

function priorityOrder(priority: Priority) {
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

function appendText(current: string | null | undefined, next: string) {
  return current ? `${current}\n${next}` : next;
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

function readCookie(header: string | null, name: string) {
  if (!header) return null;
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
