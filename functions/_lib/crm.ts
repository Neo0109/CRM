import { readCrmSettings } from "./settings";
import {
  authKey,
  buildConfiguredUsers,
  cleanAuthValue,
  displayNameForUsername,
  type AccessUser
} from "./crmUsers";
import {
  createOnlyIncomingLeadSet,
  leadsFromReport,
  mergeIncomingLeadSet,
  normalizeLead,
  type DailyReport,
  type Lead
} from "./leadModel";

export {
  parseCrmUsersJson,
  parseCrmUsersJsonWithDiagnostics
} from "./crmUsers";
export type {
  AccessUser,
  CrmUser,
  CrmUsersParseResult,
  CrmUsersParseStatus
} from "./crmUsers";
export {
  buildLeadDedupeIndex,
  isDailyReport,
  leadsFromReport,
  toCsv
} from "./leadModel";
export type { Lead } from "./leadModel";

const reportRepoFullName = "Neo0109/CRM";
const reportBranch = "main";
const reportDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  CRM_USERS_JSON?: string;
  CRM_USERNAME?: string;
  CRM_ACCESS_TOKEN?: string;
  CRM_AUTOMATION_TOKEN?: string;
  EXCEL_EXPORT_PASSWORD?: string;
  RESEND_API_KEY?: string;
  CRM_FROM_EMAIL?: string;
};

export type PagesContext = {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
};

export async function requireAccess(request: Request, env: Env) {
  const user = await getAccessUser(request, env);
  if (user) return null;
  return json({ error: "CRM login required" }, 401);
}

export async function getAccessUser(request: Request, env: Env): Promise<AccessUser | null> {
  const headerToken = request.headers.get("x-crm-token");
  const cookieToken = readCookie(request.headers.get("cookie"), "crm_access_token");
  const headerUsername = request.headers.get("x-crm-username");
  const cookieUsername = readCookie(request.headers.get("cookie"), "crm_username");
  const result = await validateLoginCredentials(env, headerUsername ?? cookieUsername, headerToken ?? cookieToken, false);

  if (!result.ok) return null;
  return {
    username: result.username ?? "",
    display_name: result.display_name ?? displayNameForUsername(result.username),
    role: result.role ?? "member",
    permissions: result.permissions ?? []
  };
}

export function requireAutomationAccess(request: Request, env: Env) {
  const configuredToken = cleanAuthValue(env.CRM_AUTOMATION_TOKEN);
  if (!configuredToken) return json({ error: "CRM automation token is not configured" }, 503);

  const url = new URL(request.url);
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  const submittedToken = cleanAuthValue(
    bearerToken
      ?? request.headers.get("x-crm-automation-token")
      ?? url.searchParams.get("token")
  );

  if (submittedToken === configuredToken) return null;
  return json({ error: "CRM automation token required" }, 401);
}

export async function validateLoginCredentials(env: Env, username: string | null | undefined, password: string | null | undefined, requireUsername = true) {
  const hasUsersJson = Boolean(cleanAuthValue(env.CRM_USERS_JSON));
  const configuredUsers = await readConfiguredUsers(env);
  const configuredUsername = cleanAuthValue(env.CRM_USERNAME);
  const submittedUsername = cleanAuthValue(username);
  const submittedPassword = cleanAuthValue(password);

  if (hasUsersJson && !configuredUsers.length) {
    return { ok: false, reason: "invalid_user_config" as const };
  }

  if (configuredUsers.length) {
    const matchedUser = configuredUsers.find((user) => authKey(user.username) === authKey(submittedUsername));

    if (!submittedUsername || !matchedUser) {
      return { ok: false, reason: "invalid_username" as const };
    }

    if (submittedPassword !== matchedUser.password) {
      return { ok: false, reason: "invalid_password" as const };
    }

    return {
      ok: true,
      reason: "ok" as const,
      username: matchedUser.username,
      display_name: matchedUser.display_name,
      role: matchedUser.role,
      permissions: matchedUser.permissions
    };
  }

  const validPasswords = await readAccessPasswords(env);

  if (configuredUsername && submittedUsername !== configuredUsername) {
    return { ok: false, reason: "invalid_username" as const };
  }

  if (requireUsername && !configuredUsername && !submittedUsername) {
    return { ok: false, reason: "missing_username" as const };
  }

  if (!validPasswords.length) {
    return {
      ok: !requireUsername || Boolean(submittedUsername),
      reason: "no_password_configured" as const,
      username: configuredUsername || submittedUsername,
      display_name: displayNameForUsername(configuredUsername || submittedUsername),
      role: "admin",
      permissions: ["*"]
    };
  }

  if (!validPasswords.includes(submittedPassword)) {
    return { ok: false, reason: "invalid_password" as const };
  }

  return {
    ok: true,
    reason: "ok" as const,
    username: configuredUsername || submittedUsername,
    display_name: displayNameForUsername(configuredUsername || submittedUsername),
    role: "admin",
    permissions: ["*"]
  };
}

async function readAccessPasswords(env: Env) {
  const candidateTokens = [env.CRM_ACCESS_TOKEN];
  try {
    const settings = await readCrmSettings(env);
    if (settings.login_password) candidateTokens.push(settings.login_password);
  } catch {
    // Keep the env token usable even if settings storage is unavailable.
  }

  return candidateTokens.map(cleanAuthValue).filter(Boolean);
}

async function readConfiguredUsers(env: Env) {
  const legacyUsername = cleanAuthValue(env.CRM_USERNAME);
  const legacyPassword = cleanAuthValue(env.CRM_ACCESS_TOKEN);
  let settingsPassword = "";

  if (legacyUsername && !legacyPassword) {
    try {
      settingsPassword = cleanAuthValue((await readCrmSettings(env)).login_password);
    } catch {
      // Login should still work from env-only credentials if settings storage is unavailable.
    }
  }

  return buildConfiguredUsers({
    rawUsers: env.CRM_USERS_JSON,
    legacyUsername,
    legacyPassword,
    settingsPassword
  });
}

export async function readLeads(env: Env): Promise<Lead[]> {
  const response = await supabaseFetch(env, "/rest/v1/crm_leads?select=id,data&order=updated_at.desc");
  const rows = (await response.json()) as { id: string; data: Lead }[];
  return rows.filter((row) => !isSystemLeadRow(row)).map((row) => normalizeLead(row.data));
}

function isSystemLeadRow(row: { id?: string | null; data?: Partial<Lead> & { type?: string } | null }) {
  return Boolean(
    row.id?.startsWith("__crm_")
      || row.data?.id?.startsWith("__crm_")
      || row.data?.type === "sourcing_decision_event"
  );
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

async function writeNewLeads(env: Env, leads: Lead[]) {
  if (!leads.length) return;
  await supabaseFetch(env, "/rest/v1/crm_leads?on_conflict=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal"
    },
    body: JSON.stringify(leads.map((lead) => ({ id: lead.id, data: normalizeLead(lead), updated_at: new Date().toISOString() })))
  });
}

export async function mergeIncomingLeads(env: Env, rawLeads: Partial<Lead>[]) {
  const existing = await readLeads(env);
  const { leads, ...result } = mergeIncomingLeadSet(existing, rawLeads);
  await writeLeads(env, leads);
  return result;
}

export async function createOnlyIncomingLeads(env: Env, rawLeads: Partial<Lead>[]) {
  const existing = await readLeads(env);
  const { leads, ...result } = createOnlyIncomingLeadSet(existing, rawLeads);
  await writeNewLeads(env, leads);
  return result;
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

function readCookie(header: string | null, name: string) {
  if (!header) return null;
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
