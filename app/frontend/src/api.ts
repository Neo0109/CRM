import type { AutomationDiagnostics, CrmSettings, ImportResult, Lead, LeadAssistantPayload, LeadAssistantResult, MonthlyVisionItem, MonthlyVisionResponse, MonthlyVisionSheet, MonthlyVisionStatus, RadarReport, SourcingLearningReport, SteamTrendReport, WeeklyReport } from "./types";

const tokenKey = "sourcing-crm-access-token";
const usernameKey = "sourcing-crm-username";
const displayNameKey = "sourcing-crm-display-name";
const displayNameUsernameKey = "sourcing-crm-display-name-username";
const requestTimeoutMs = 15000;

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
  display_name?: string;
  role?: string;
  permissions?: string[];
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const username = getAccessUsername();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  const response = await fetch(url, {
    ...options,
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...(username ? { "x-crm-username": username } : {}),
      ...(token ? { "x-crm-token": token } : {}),
      ...options?.headers
    }
  }).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("请求超时，请退出登录后重新进入，或清除浏览器网站数据后重试");
    }
    throw error;
  }).finally(() => {
    window.clearTimeout(timeout);
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
  saveAccessCredentials(result.username || payload.username, payload.password, result.display_name);
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

export function fetchAutomationDiagnostics(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return request<AutomationDiagnostics>(`/api/automation-diagnostics${query}`);
}

export function fetchSourcingLearning() {
  return request<SourcingLearningReport>("/api/sourcing-learning");
}

export function fetchSettings() {
  return request<CrmSettings>("/api/settings");
}

export function fetchMonthlyVision(month: string) {
  return request<MonthlyVisionResponse>(`/api/monthly-vision?month=${encodeURIComponent(month)}`);
}

export function saveMonthlyVision(month: string, status: MonthlyVisionStatus, items: MonthlyVisionItem[]) {
  return request<MonthlyVisionSheet>(`/api/monthly-vision?month=${encodeURIComponent(month)}`, {
    method: "PUT",
    body: JSON.stringify({ status, items })
  });
}

export async function downloadMonthlyVisionExcel(month: string, password: string) {
  const token = getAccessToken();
  const username = getAccessUsername();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  const response = await fetch(`/api/export/monthly-vision?month=${encodeURIComponent(month)}`, {
    signal: controller.signal,
    headers: {
      ...(username ? { "x-crm-username": username } : {}),
      ...(token ? { "x-crm-token": token } : {}),
      "x-export-password": password
    }
  }).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Excel 导出请求超时，请稍后重试");
    }
    throw error;
  }).finally(() => {
    window.clearTimeout(timeout);
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(payload.error ?? response.statusText);
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `monthly-vision-${month}.xls`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
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

export function syncLatestReport(date?: string, force = false) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (force) params.set("force", "1");
  const query = params.toString() ? `?${params.toString()}` : "";
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

export function getAccessDisplayName() {
  const username = getAccessUsername();
  const savedDisplayName = window.localStorage.getItem(displayNameKey) ?? "";
  const displayNameSavedFor = window.localStorage.getItem(displayNameUsernameKey) ?? "";
  const mappedDisplayName = displayNameForUsername(username);

  if (savedDisplayName && displayNameSavedFor === username) return savedDisplayName;
  if (savedDisplayName && !displayNameSavedFor && !isStaleNeoDisplayName(username, savedDisplayName)) return savedDisplayName;
  return mappedDisplayName;
}

export function hasSavedCredentials() {
  return Boolean(getAccessUsername() && getAccessToken());
}

export function saveAccessCredentials(username: string, token: string, displayName?: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const cleanUsername = username.trim();
  const cleanDisplayName = (displayName ?? "").trim() || displayNameForUsername(cleanUsername);
  window.localStorage.setItem(usernameKey, cleanUsername);
  window.localStorage.setItem(displayNameUsernameKey, cleanUsername);
  window.localStorage.setItem(displayNameKey, cleanDisplayName);
  window.localStorage.setItem(tokenKey, token);
  document.cookie = `crm_username=${encodeURIComponent(cleanUsername)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  document.cookie = `crm_access_token=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function saveAccessToken(token: string) {
  saveAccessCredentials(getAccessUsername(), token, getAccessDisplayName());
}

export function clearAccessToken() {
  window.localStorage.removeItem(usernameKey);
  window.localStorage.removeItem(displayNameUsernameKey);
  window.localStorage.removeItem(displayNameKey);
  window.localStorage.removeItem(tokenKey);
  document.cookie = "crm_username=; Path=/; Max-Age=0; SameSite=Lax";
  document.cookie = "crm_access_token=; Path=/; Max-Age=0; SameSite=Lax";
}

function displayNameForUsername(username: string) {
  const names: Record<string, string> = {
    neo: "Neo",
    neo0109: "Neo",
    jojo: "Jojo",
    nanyuan: "南鸢",
    yuyang: "于老板"
  };
  return names[username.trim().toLowerCase()] ?? username.trim();
}

function isStaleNeoDisplayName(username: string, displayName: string) {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername || cleanUsername === "neo" || cleanUsername === "neo0109") return false;
  return displayName.trim().toLowerCase() === "neo";
}
