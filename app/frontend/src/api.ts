import type { CrmSettings, ImportResult, Lead, LeadAssistantPayload, LeadAssistantResult, RadarReport, SettingsPatch, SettingsVerification, SteamTrendReport, WeeklyReport } from "./types";

const tokenKey = "sourcing-crm-access-token";
const usernameKey = "sourcing-crm-username";

type SyncResult = ImportResult & {
  synced: boolean;
  report_date?: string;
  summary?: string;
  reason?: string;
  source?: string;
};

export type ImportJsonResult = ImportResult & {
  message: string;
  imported: number;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginResult = {
  ok: boolean;
  username: string;
  role?: string;
  permissions?: string[];
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const username = getAccessUsername();
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(username ? { "x-crm-username": username } : {}),
      ...(token ? { "x-crm-token": token } : {}),
      ...options?.headers
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(payload.error ?? response.statusText);
  }

  return response.json() as Promise<T>;
}

export async function loginToCrm(payload: LoginPayload) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);

  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: controller.signal
  }).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("登录请求超时，请刷新页面或清除 Safari 网站数据后重试");
    }
    throw error;
  }).finally(() => {
    window.clearTimeout(timeout);
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error ?? "登录失败");
  }

  const result = await response.json() as LoginResult;
  saveAccessCredentials(result.username || payload.username, payload.password);
  return result;
}

export function fetchLeads() {
  return request<Lead[]>("/api/leads");
}

export function fetchRadar(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return request<RadarReport>(`/api/radar${query}`);
}

export function fetchSteamTrends(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return request<SteamTrendReport>(`/api/steam-trends${query}`);
}

export function fetchWeeklyReport(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return request<WeeklyReport>(`/api/reports/weekly${query}`);
}

export function fetchSettings() {
  return request<CrmSettings>("/api/settings");
}

export function saveSettings(patch: SettingsPatch) {
  return request<CrmSettings>("/api/settings", {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
}

export function sendSettingsVerification() {
  return request<SettingsVerification>("/api/settings-verification", { method: "POST" });
}

export function runLeadAssistant(payload: LeadAssistantPayload) {
  return request<LeadAssistantResult>("/api/lead-assistant", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function importJsonLeads(payload: unknown) {
  return request<ImportJsonResult>("/api/import-json", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function syncLatestReport(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return request<SyncResult>(`/api/reports/sync${query}`, { method: "POST" });
}

export function updateLead(id: string, patch: Partial<Lead>) {
  return request<Lead>(`/api/leads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
}

export function excelExportUrl(password: string) {
  return `/api/export/excel?password=${encodeURIComponent(password)}`;
}

export function getAccessToken() {
  return window.localStorage.getItem(tokenKey) ?? "";
}

export function getAccessUsername() {
  return window.localStorage.getItem(usernameKey) ?? "";
}

export function hasSavedCredentials() {
  return Boolean(getAccessToken());
}

export function saveAccessCredentials(username: string, token: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  window.localStorage.setItem(usernameKey, username.trim());
  window.localStorage.setItem(tokenKey, token);
  document.cookie = `crm_username=${encodeURIComponent(username.trim())}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  document.cookie = `crm_access_token=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function saveAccessToken(token: string) {
  saveAccessCredentials(getAccessUsername(), token);
}

export function clearAccessToken() {
  window.localStorage.removeItem(usernameKey);
  window.localStorage.removeItem(tokenKey);
  document.cookie = "crm_username=; Path=/; Max-Age=0; SameSite=Lax";
  document.cookie = "crm_access_token=; Path=/; Max-Age=0; SameSite=Lax";
}
