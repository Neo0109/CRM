type Bucket = "推进池" | "观察池" | "淘汰池";
type Stage = "new" | "watch" | "active" | "negotiating" | "won" | "rejected";
type Priority = "P0" | "P1" | "P2" | "P3";
type RegionPriority = "国内优先" | "海外-高视觉" | "海外-强数据" | "其他";

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  CRM_ACCESS_TOKEN?: string;
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
  region_priority: RegionPriority;
  bucket: Bucket;
  stage: Stage;
  priority: Priority;
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
  links: string[];
  exposure_trail: string | null;
  bilibili_fit: string;
  amplification: string;
  risks: string | null;
  verdict: string;
  next_action: string | null;
  owner: string | null;
  due_date: string | null;
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
  if (!env.CRM_ACCESS_TOKEN) return null;
  const headerToken = request.headers.get("x-crm-token");
  const cookieToken = readCookie(request.headers.get("cookie"), "crm_access_token");
  if (headerToken === env.CRM_ACCESS_TOKEN || cookieToken === env.CRM_ACCESS_TOKEN) return null;
  return json({ error: "CRM access token required" }, 401);
}

export async function readLeads(env: Env): Promise<Lead[]> {
  const response = await supabaseFetch(env, "/rest/v1/crm_leads?select=data&order=updated_at.desc");
  const rows = (await response.json()) as { data: Lead }[];
  return rows.map((row) => normalizeLead(row.data));
}

export async function writeLeads(env: Env, leads: Lead[]) {
  if (!leads.length) return;
  await supabaseFetch(env, "/rest/v1/crm_leads?on_conflict=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(leads.map((lead) => ({ id: lead.id, data: lead, updated_at: new Date().toISOString() })))
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
    const bucketOrder: Record<Bucket, number> = { "推进池": 0, "观察池": 1, "淘汰池": 2 };
    return bucketOrder[a.bucket] - bucketOrder[b.bucket] || a.project.localeCompare(b.project, "zh-CN");
  });

  await writeLeads(env, nextLeads);
  return { created, updated, dropped, total: nextLeads.length };
}

export function leadsFromReport(report: DailyReport): Partial<Lead>[] {
  if (!report.report_date || !Array.isArray(report.push_pool) || !Array.isArray(report.watch_pool) || !Array.isArray(report.drop_pool)) throw new Error("Invalid daily report");
  return [
    ...report.push_pool.map((lead) => ({ ...lead, bucket: "推进池" as const })),
    ...report.watch_pool.map((lead) => ({ ...lead, bucket: "观察池" as const })),
    ...report.drop_pool.map((lead) => ({ ...lead, bucket: "淘汰池" as const, stage: lead.stage ?? "rejected" }))
  ].map((lead) => ({
    ...lead,
    first_seen: lead.first_seen ?? report.report_date,
    notes: appendText(lead.notes, `导入日报 ${report.report_date}：${report.summary}`)
  }));
}

export function isDailyReport(value: unknown): value is DailyReport {
  return Boolean(value && typeof value === "object" && "report_date" in value && "push_pool" in value && "watch_pool" in value && "drop_pool" in value);
}

export function toCsv(leads: Lead[]) {
  const columns: (keyof Lead)[] = ["project", "team", "country", "bucket", "stage", "priority", "genre", "progress", "release_window", "publisher_status", "public_signals", "bilibili_fit", "amplification", "verdict", "next_action", "owner", "due_date", "first_seen"];
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
  return {
    id: raw.id ?? makeLeadId(project, raw.steam_app_id, firstSeen),
    project,
    steam_app_id: valueOrNull(raw.steam_app_id),
    team: valueOrNull(raw.team),
    team_size: valueOrNull(raw.team_size),
    country: raw.country ?? "未知",
    region_priority: raw.region_priority ?? inferRegionPriority(raw.country, raw.public_signals),
    bucket: raw.bucket ?? "观察池",
    stage: raw.stage ?? stageFromBucket(raw.bucket),
    priority: raw.priority ?? priorityFromBucket(raw.bucket),
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
    links: Array.isArray(raw.links) ? raw.links.filter(Boolean) : [],
    exposure_trail: valueOrNull(raw.exposure_trail),
    bilibili_fit: raw.bilibili_fit ?? "待评估",
    amplification: raw.amplification ?? "待评估",
    risks: valueOrNull(raw.risks),
    verdict: raw.verdict ?? "待判断",
    next_action: valueOrNull(raw.next_action),
    owner: valueOrNull(raw.owner),
    due_date: valueOrNull(raw.due_date),
    first_seen: firstSeen,
    notes: valueOrNull(raw.notes)
  };
}

function mergeLead(current: Lead, incoming: Lead): Lead {
  return { ...current, ...incoming, id: current.id, first_seen: current.first_seen, notes: mergeNotes(current.notes, incoming.notes) };
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

function isDomestic(country: string | undefined) {
  return Boolean(country && ["中国", "大陆", "香港", "台湾", "澳门"].some((token) => country.includes(token)));
}

function stageFromBucket(bucket: Bucket | undefined): Stage {
  if (bucket === "推进池") return "active";
  if (bucket === "淘汰池") return "rejected";
  return "watch";
}

function priorityFromBucket(bucket: Bucket | undefined): Priority {
  if (bucket === "推进池") return "P1";
  if (bucket === "淘汰池") return "P3";
  return "P2";
}

function mergeNotes(current: string | null, incoming: string | null) {
  if (!current) return incoming;
  if (!incoming || current.includes(incoming)) return current;
  return `${current}\n${incoming}`;
}

function appendText(current: string | null | undefined, next: string) {
  return current ? `${current}\n${next}` : next;
}

function csvCell(value: unknown) {
  if (Array.isArray(value)) return csvCell(value.join(" | "));
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

function readCookie(header: string | null, name: string) {
  if (!header) return null;
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
