import * as AjvModule from "ajv";
import * as addFormatsModule from "ajv-formats";
import cors from "cors";
import express from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Bucket = "未处理" | "推进池" | "待评测" | "测试中" | "跟进中" | "观察池" | "淘汰池";
type Stage = "new" | "watch" | "active" | "negotiating" | "won" | "rejected";
type Priority = "P0" | "P1" | "P2" | "P3";
type RegionPriority = "国内优先" | "海外-高视觉" | "海外-强数据" | "其他";

type Lead = {
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

type CrmUser = {
  username: string;
  display_name: string;
  password: string;
  role: string;
  permissions: string[];
};

const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(dirname, "../../..");
const dataPath = path.join(rootDir, "data/leads.json");
const frontendDistPath = path.join(rootDir, "app/frontend/dist");
const leadSchemaPath = path.join(rootDir, "schemas/sourcing_lead.schema.json");
const dailyReportSchemaPath = path.join(rootDir, "schemas/daily_report.schema.json");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const crmUsersJson = process.env.CRM_USERS_JSON;
const crmUsername = process.env.CRM_USERNAME?.trim();
const crmAccessToken = process.env.CRM_ACCESS_TOKEN;
const configuredCrmUsers = parseCrmUsersConfig(crmUsersJson, crmUsername, crmAccessToken);
const hasCrmAuthConfig = Boolean(cleanAuthValue(crmUsersJson) || crmUsername || crmAccessToken);
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
    })
  : null;

const [leadSchema, dailyReportSchema] = await Promise.all([
  readJson(leadSchemaPath),
  readJson(dailyReportSchemaPath)
]);

const Ajv = (AjvModule as { default: any }).default;
const addFormats = (addFormatsModule as { default: any }).default;
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
type ValidatorFn = ((data: unknown) => boolean) & { errors?: unknown };
const validateLead = ajv.compile(leadSchema) as ValidatorFn;
const validateDailyReport = ajv.compile(dailyReportSchema) as ValidatorFn;

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use((req, res, next) => {
  if (!hasCrmAuthConfig || req.path === "/api/health" || req.path === "/api/auth/login" || !req.path.startsWith("/api")) {
    next();
    return;
  }

  if (isValidLocalLogin(req.headers["x-crm-username"], req.headers["x-crm-token"], req.headers.cookie)) {
    next();
    return;
  }

  res.status(401).json({ error: "CRM login required" });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    storage: supabase ? "supabase" : "json",
    version: "v2.4-automation-diagnostics-center",
    env: {
      hasCrmUsersJson: Boolean(crmUsersJson),
      crmUserCount: configuredCrmUsers.length,
      hasCrmUsername: Boolean(crmUsername),
      hasCrmAccessToken: Boolean(crmAccessToken)
    }
  });
});

app.post("/api/auth/login", (req, res) => {
  const username = cleanAuthValue(req.body?.username);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const result = validateLocalLogin(username, password);

  if (!result.ok) {
    res.status(401).json({ error: "账号或密码无效" });
    return;
  }

  res.json({ ok: true, username: result.user.username, display_name: result.user.display_name, role: result.user.role, permissions: result.user.permissions });
});

app.get("/api/leads", async (_req, res, next) => {
  try {
    res.json(await readLeads());
  } catch (error) {
    next(error);
  }
});

app.patch("/api/leads/:id", async (req, res, next) => {
  try {
    const leads = await readLeads();
    const index = leads.findIndex((lead) => lead.id === req.params.id);
    if (index === -1) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    const updated = { ...leads[index], ...req.body, id: leads[index].id };
    assertValidLead(updated);
    leads[index] = updated;
    await writeLeads(leads);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});


app.post("/api/leads/import-daily-report", async (req, res, next) => {
  try {
    const report = req.body;
    assertValidDailyReport(report);
    const result = await mergeIncomingLeads(leadsFromReport(report));
    res.json({ ...result, report_date: report.report_date, summary: report.summary });
  } catch (error) {
    next(error);
  }
});

app.get("/api/export/json", async (_req, res, next) => {
  try {
    const leads = await readLeads();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=sourcing-leads.json");
    res.send(JSON.stringify(leads, null, 2));
  } catch (error) {
    next(error);
  }
});

app.get("/api/export/csv", async (_req, res, next) => {
  try {
    const leads = await readLeads();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=sourcing-leads.csv");
    res.send(toCsv(leads));
  } catch (error) {
    next(error);
  }
});

app.use(express.static(frontendDistPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(500).json({ error: message });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Sourcing CRM listening on http://localhost:${port}`);
});

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readLeads(): Promise<Lead[]> {
  if (supabase) {
    return readLeadsFromSupabase(supabase);
  }

  try {
    const leads = JSON.parse(await readFile(dataPath, "utf8")) as Lead[];
    return leads.map((lead) => normalizeLead(lead));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await writeLeads([]);
      return [];
    }
    throw error;
  }
}

async function writeLeads(leads: Lead[]) {
  if (supabase) {
    await writeLeadsToSupabase(supabase, leads);
    return;
  }

  await mkdir(path.dirname(dataPath), { recursive: true });
  await writeFile(dataPath, `${JSON.stringify(leads, null, 2)}\n`, "utf8");
}

async function readLeadsFromSupabase(client: SupabaseClient): Promise<Lead[]> {
  const { data, error } = await client.from("crm_leads").select("data").order("updated_at", { ascending: false });
  if (error) throw new Error(`Supabase read failed: ${error.message}`);
  return (data ?? []).map((row: { data: Lead }) => normalizeLead(row.data));
}

async function writeLeadsToSupabase(client: SupabaseClient, leads: Lead[]) {
  const rows = leads.map((lead) => ({ id: lead.id, data: lead, updated_at: new Date().toISOString() }));
  if (!rows.length) return;
  const { error } = await client.from("crm_leads").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Supabase write failed: ${error.message}`);
}

async function mergeIncomingLeads(rawLeads: Partial<Lead>[]) {
  const existing = await readLeads();
  const byKey = new Map(existing.flatMap((lead) => leadKeys(lead).map((key) => [key, lead.id] as const)));
  const byId = new Map(existing.map((lead) => [lead.id, lead]));
  let created = 0;
  let updated = 0;
  let dropped = 0;
  const import_stats = {
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
    const incoming = normalizeLead(raw);
    assertValidLead(incoming);
    const matchId = leadKeys(incoming).map((key) => byKey.get(key)).find(Boolean);
    if (matchId && byId.has(matchId)) {
      const current = byId.get(matchId)!;
      const merged = mergeLead(current, incoming);
      byId.set(current.id, merged);
      for (const key of leadKeys(merged)) byKey.set(key, merged.id);
      updated += 1;
      if (incoming.bucket === "淘汰池") import_stats.updated_dropped += 1;
      else if (current.bucket === "未处理") import_stats.updated_unprocessed_visible += 1;
      else if (incoming.bucket === "未处理") import_stats.updated_existing_workflow += 1;
      else import_stats.updated_other += 1;
    } else {
      byId.set(incoming.id, incoming);
      for (const key of leadKeys(incoming)) byKey.set(key, incoming.id);
      created += 1;
      if (incoming.bucket === "未处理") import_stats.created_unprocessed += 1;
      else if (incoming.bucket === "淘汰池") import_stats.created_dropped += 1;
      else import_stats.created_other += 1;
    }
    if (incoming.bucket === "淘汰池") dropped += 1;
  }

  import_stats.visible_unprocessed = import_stats.created_unprocessed + import_stats.updated_unprocessed_visible;
  import_stats.stale_updates = import_stats.updated_existing_workflow;

  const nextLeads = Array.from(byId.values()).sort((a, b) => {
    const bucketOrder: Record<Bucket, number> = { "未处理": 0, "待评测": 1, "测试中": 2, "观察池": 3, "跟进中": 4, "推进池": 5, "淘汰池": 6 };
    return bucketOrder[a.bucket] - bucketOrder[b.bucket] || a.project.localeCompare(b.project, "zh-CN");
  });

  await writeLeads(nextLeads);
  return { created, updated, dropped, total: nextLeads.length, import_stats };
}

function isDailyReport(value: unknown): value is DailyReport {
  return Boolean(value && typeof value === "object" && "report_date" in value && "push_pool" in value && "watch_pool" in value && "drop_pool" in value);
}

function assertValidDailyReport(report: DailyReport) {
  if (!validateDailyReport(report)) throw new Error(ajv.errorsText(validateDailyReport.errors));
}

function assertValidLead(lead: Lead) {
  if (!validateLead(lead)) throw new Error(ajv.errorsText(validateLead.errors));
}

function leadsFromReport(report: DailyReport): Partial<Lead>[] {
  assertValidDailyReport(report);
  return [
    ...report.push_pool.map((lead) => ({ ...lead, bucket: "未处理" as const, stage: "new" as const, review_status: "未处理" as const })),
    ...report.watch_pool.map((lead) => ({ ...lead, bucket: "未处理" as const, stage: "new" as const, review_status: "未处理" as const })),
    ...report.drop_pool.map((lead) => ({ ...lead, bucket: "淘汰池" as const, stage: lead.stage ?? "rejected" }))
  ].map((lead) => ({
    ...lead,
    first_seen: lead.first_seen ?? report.report_date,
    notes: appendText(lead.notes, `导入日报 ${report.report_date}：${report.summary}`)
  }));
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
    bucket: raw.bucket ?? "未处理",
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

function toCsv(leads: Lead[]) {
  const columns: (keyof Lead)[] = ["project", "team", "country", "bucket", "stage", "priority", "genre", "progress", "release_window", "publisher_status", "public_signals", "bilibili_fit", "amplification", "verdict", "next_action", "owner", "due_date", "first_seen"];
  const header = columns.join(",");
  const rows = leads.map((lead) => columns.map((column) => csvCell(lead[column])).join(","));
  return `${header}\n${rows.join("\n")}\n`;
}

function csvCell(value: unknown) {
  if (Array.isArray(value)) return csvCell(value.join(" | "));
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll("\"", "\"\"")}"`;
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
  if (bucket === "未处理") return "new";
  if (bucket === "推进池") return "negotiating";
  if (bucket === "跟进中" || bucket === "测试中") return "active";
  if (bucket === "淘汰池") return "rejected";
  return "watch";
}

function priorityFromBucket(bucket: Bucket | undefined): Priority {
  if (bucket === "推进池" || bucket === "跟进中" || bucket === "测试中") return "P1";
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

function readCookie(header: string | undefined, name: string) {
  if (!header) return null;
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function isValidLocalLogin(rawUsername: string | string[] | undefined, rawToken: string | string[] | undefined, cookieHeader: string | undefined) {
  const submittedUsername = cleanAuthValue(Array.isArray(rawUsername) ? rawUsername[0] : rawUsername) || readCookie(cookieHeader, "crm_username") || "";
  const submittedToken = (Array.isArray(rawToken) ? rawToken[0] : rawToken) || readCookie(cookieHeader, "crm_access_token") || "";
  return validateLocalLogin(submittedUsername, submittedToken).ok;
}

function validateLocalLogin(username: string, password: string): { ok: true; user: CrmUser } | { ok: false } {
  const submittedUsername = cleanAuthValue(username);
  const submittedPassword = cleanAuthValue(password);

  if (cleanAuthValue(crmUsersJson) && !configuredCrmUsers.length) {
    return { ok: false };
  }

  if (configuredCrmUsers.length) {
    const user = configuredCrmUsers.find((item) => authKey(item.username) === authKey(submittedUsername));
    return user && submittedPassword === user.password ? { ok: true, user } : { ok: false };
  }

  const validUsername = crmUsername ? submittedUsername === crmUsername : Boolean(submittedUsername);
  const validPassword = crmAccessToken ? submittedPassword === crmAccessToken : Boolean(submittedPassword);
  if (!validUsername || !validPassword) return { ok: false };

  return {
    ok: true,
    user: {
      username: crmUsername || submittedUsername,
      display_name: displayNameForUsername(crmUsername || submittedUsername),
      password: submittedPassword,
      role: "admin",
      permissions: ["*"]
    }
  };
}

function parseCrmUsersConfig(rawUsers: string | undefined, legacyUsername: string | undefined, legacyPassword: string | undefined) {
  const users = parseCrmUsersJson(rawUsers);
  const cleanLegacyUsername = cleanAuthValue(legacyUsername);
  const cleanLegacyPassword = cleanAuthValue(legacyPassword);
  if (cleanLegacyUsername && cleanLegacyPassword) {
    users.push({ username: cleanLegacyUsername, display_name: displayNameForUsername(cleanLegacyUsername), password: cleanLegacyPassword, role: "admin", permissions: ["*"] });
  }
  return dedupeCrmUsers(users);
}

function parseCrmUsersJson(rawValue: string | null | undefined): CrmUser[] {
  const raw = cleanAuthValue(rawValue);
  if (!raw) return [];

  const direct = parseCrmUsersPayload(raw);
  if (direct.ok) return direct.users;

  const repairedRaw = repairCrmUsersJson(raw);
  if (repairedRaw !== raw) {
    const repaired = parseCrmUsersPayload(repairedRaw);
    if (repaired.ok) return repaired.users;
  }

  return [];
}

function parseCrmUsersPayload(raw: string): { ok: true; users: CrmUser[] } | { ok: false } {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return { ok: true, users: parsed.map(userFromArrayItem).filter(isCrmUser) };
    if (parsed && typeof parsed === "object") return { ok: true, users: Object.entries(parsed).map(userFromObjectEntry).filter(isCrmUser) };
    return { ok: true, users: [] };
  } catch {
    return { ok: false };
  }
}

function repairCrmUsersJson(raw: string) {
  return raw
    .replace(/}\s*(?=\{)/g, "},")
    .replace(/]\s*(?=\{)/g, "]},");
}

function userFromArrayItem(item: unknown): CrmUser | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const username = cleanAuthValue(readString(record.username) ?? readString(record.name));
  const password = cleanAuthValue(readString(record.password) ?? readString(record.token) ?? readString(record.accessToken));
  if (!username || !password) return null;
  const displayName = cleanAuthValue(readString(record.display_name) ?? readString(record.displayName) ?? readString(record.nickname) ?? readString(record.label));
  return {
    username,
    display_name: displayName || displayNameForUsername(username),
    password,
    role: cleanAuthValue(readString(record.role)) || "member",
    permissions: readPermissions(record.permissions)
  };
}

function userFromObjectEntry([username, value]: [string, unknown]): CrmUser | null {
  const cleanUsername = cleanAuthValue(username);
  if (!cleanUsername) return null;

  if (typeof value === "string") {
    const password = cleanAuthValue(value);
    return password ? { username: cleanUsername, display_name: displayNameForUsername(cleanUsername), password, role: "member", permissions: [] } : null;
  }

  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const password = cleanAuthValue(readString(record.password) ?? readString(record.token) ?? readString(record.accessToken));
  if (!password) return null;
  const displayName = cleanAuthValue(readString(record.display_name) ?? readString(record.displayName) ?? readString(record.nickname) ?? readString(record.label));
  return {
    username: cleanUsername,
    display_name: displayName || displayNameForUsername(cleanUsername),
    password,
    role: cleanAuthValue(readString(record.role)) || "member",
    permissions: readPermissions(record.permissions)
  };
}

function isCrmUser(user: CrmUser | null): user is CrmUser {
  return Boolean(user?.username && user.password);
}

function displayNameForUsername(username: string | null | undefined) {
  const cleanUsername = cleanAuthValue(username);
  const configuredNames: Record<string, string> = {
    neo: "Neo",
    neo0109: "Neo",
    jojo: "Jojo",
    nanyuan: "南鸢",
    yuyang: "于老板"
  };
  return configuredNames[cleanUsername.toLowerCase()] ?? cleanUsername;
}

function authKey(value: string | null | undefined) {
  return cleanAuthValue(value).toLowerCase();
}

function dedupeCrmUsers(users: CrmUser[]) {
  const byUsername = new Map<string, CrmUser>();
  for (const user of users) {
    if (!byUsername.has(user.username)) byUsername.set(user.username, user);
  }
  return [...byUsername.values()];
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readPermissions(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map(cleanAuthValue).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(cleanAuthValue).filter(Boolean);
  return [];
}

function cleanAuthValue(value: string | null | undefined) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim();
}
