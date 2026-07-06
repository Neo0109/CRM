import type { Env } from "./crm";

const settingsRowId = "__crm_settings__";

export type ExtendedCrmSettings = {
  bound_email: string | null;
  excel_export_password: string | null;
  login_password: string | null;
  updated_at: string | null;
};

export type PublicCrmSettings = {
  bound_email: string | null;
  has_excel_export_password: boolean;
  has_login_password: boolean;
  updated_at: string | null;
};

export async function readCrmSettings(env: Env): Promise<ExtendedCrmSettings> {
  const response = await supabaseFetch(env, `/rest/v1/crm_leads?select=id,data&id=eq.${settingsRowId}`);
  const rows = (await response.json()) as { id: string; data: Partial<ExtendedCrmSettings> }[];
  return normalizeSettings(rows[0]?.data ?? {});
}

export function publicCrmSettings(settings: ExtendedCrmSettings): PublicCrmSettings {
  return {
    bound_email: settings.bound_email,
    has_excel_export_password: Boolean(settings.excel_export_password),
    has_login_password: Boolean(settings.login_password),
    updated_at: settings.updated_at
  };
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

function normalizeSettings(raw: Partial<ExtendedCrmSettings>): ExtendedCrmSettings {
  return {
    bound_email: valueOrNull(raw.bound_email),
    excel_export_password: valueOrNull(raw.excel_export_password),
    login_password: valueOrNull(raw.login_password),
    updated_at: valueOrNull(raw.updated_at)
  };
}

function valueOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
