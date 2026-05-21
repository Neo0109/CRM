import type { CrmSettings, ImportResult, Lead, RadarReport, SettingsPatch, SettingsVerification, SteamTrendReport } from "./types";

const tokenKey = "sourcing-crm-access-token";

type SyncResult = ImportResult & {
  synced: boolean;
  report_date?: string;
  summary?: string;
  reason?: string;
  source?: string;
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-crm-token": token } : {}),
      ...options?.headers
    },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(payload.error ?? response.statusText);
  }

  return response.json() as Promise<T>;
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

export function syncLatestReport(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return request<SyncResult>(`/api/reports/sync${query}`, { method: "POST" });
}

export function importJson(payload: unknown) {
  return request<ImportResult>("/api/leads/import", {
    method: "POST",
    body: JSON.stringify(payload)
  });
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

export function saveAccessToken(token: string) {
  window.localStorage.setItem(tokenKey, token);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `crm_access_token=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function clearAccessToken() {
  window.localStorage.removeItem(tokenKey);
  document.cookie = "crm_access_token=; Path=/; Max-Age=0; SameSite=Lax";
}
