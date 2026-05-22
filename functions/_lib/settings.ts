import type { Env } from "./crm";

const settingsRowId = "__crm_settings__";
const verificationTtlMs = 10 * 60 * 1000;

export type ExtendedCrmSettings = {
  bound_email: string | null;
  excel_export_password: string | null;
  login_password: string | null;
  verification_code: string | null;
  verification_expires_at: string | null;
  verification_purpose: string | null;
  updated_at: string | null;
};

export type PublicCrmSettings = {
  bound_email: string | null;
  has_excel_export_password: boolean;
  has_login_password: boolean;
  updated_at: string | null;
};

export type VerificationPurpose = "settings_change";

export async function readCrmSettings(env: Env): Promise<ExtendedCrmSettings> {
  const response = await supabaseFetch(env, `/rest/v1/crm_leads?select=id,data&id=eq.${settingsRowId}`);
  const rows = (await response.json()) as { id: string; data: Partial<ExtendedCrmSettings> }[];
  return normalizeSettings(rows[0]?.data ?? {});
}

export async function writeCrmSettings(env: Env, patch: Partial<ExtendedCrmSettings>) {
  const current = await readCrmSettings(env);
  const next = normalizeSettings({ ...current, ...patch, updated_at: new Date().toISOString() });
  await supabaseFetch(env, "/rest/v1/crm_leads?on_conflict=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify([{ id: settingsRowId, data: next, updated_at: new Date().toISOString() }])
  });
  return next;
}

export function publicCrmSettings(settings: ExtendedCrmSettings): PublicCrmSettings {
  return {
    bound_email: settings.bound_email,
    has_excel_export_password: Boolean(settings.excel_export_password),
    has_login_password: Boolean(settings.login_password),
    updated_at: settings.updated_at
  };
}

export async function createSettingsVerification(env: Env, purpose: VerificationPurpose = "settings_change") {
  const settings = await readCrmSettings(env);
  if (!settings.bound_email) throw new Error("请先绑定邮箱");

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + verificationTtlMs).toISOString();
  const nextSettings = await writeCrmSettings(env, {
    verification_code: code,
    verification_expires_at: expiresAt,
    verification_purpose: purpose
  });
  const delivery = await sendVerificationEmail(env, settings.bound_email, code);

  return {
    email: maskEmail(settings.bound_email),
    sent: delivery === "sent",
    delivery,
    expires_at: nextSettings.verification_expires_at
  };
}

export async function verifySettingsCode(env: Env, code: string | null | undefined, purpose: VerificationPurpose = "settings_change") {
  const settings = await readCrmSettings(env);
  const cleanCode = typeof code === "string" ? code.trim() : "";
  if (!cleanCode || !settings.verification_code || !settings.verification_expires_at) return false;
  if (settings.verification_purpose !== purpose) return false;
  if (Date.parse(settings.verification_expires_at) < Date.now()) return false;
  if (settings.verification_code !== cleanCode) return false;

  await writeCrmSettings(env, {
    verification_code: null,
    verification_expires_at: null,
    verification_purpose: null
  });
  return true;
}

async function sendVerificationEmail(env: Env & { RESEND_API_KEY?: string; CRM_FROM_EMAIL?: string }, to: string, code: string) {
  if (!env.RESEND_API_KEY || !env.CRM_FROM_EMAIL) return "not_configured" as const;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.CRM_FROM_EMAIL,
      to,
      subject: "Sourcing CRM 验证码",
      text: `你的 Sourcing CRM 验证码是 ${code}，10 分钟内有效。`
    })
  });

  if (!response.ok) throw new Error(`邮件发送失败：${response.status} ${await response.text()}`);
  return "sent" as const;
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
    verification_code: valueOrNull(raw.verification_code),
    verification_expires_at: valueOrNull(raw.verification_expires_at),
    verification_purpose: valueOrNull(raw.verification_purpose),
    updated_at: valueOrNull(raw.updated_at)
  };
}

function valueOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
}
