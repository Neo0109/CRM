import type { ContactMethod, Lead } from "./leadModel";
import type { Env } from "./crm";

export const monthlyVisionRowPrefix = "__crm_monthly_vision__";
export const activeMonthlyVisionBuckets = ["待评测", "测试中", "跟进中", "推进池"] as const;

export type MonthlyVisionStatus = "draft" | "finalized";

export type MonthlyVisionItem = {
  lead_id: string;
  project: string;
  developer: string;
  contacts: string;
};

export type MonthlyVisionSheet = {
  type: "monthly_vision_sheet";
  month: string;
  status: MonthlyVisionStatus;
  items: MonthlyVisionItem[];
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  updated_by: string | null;
  finalized_by: string | null;
};

export function monthlyVisionRowId(month: string) {
  assertMonthlyVisionMonth(month);
  return `${monthlyVisionRowPrefix}${month}`;
}

export function assertMonthlyVisionMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("月份格式必须为 YYYY-MM");
}

export function buildGeneratedMonthlyVisionSheet(leads: Lead[], month: string, generatedAt = new Date().toISOString()): MonthlyVisionSheet {
  assertMonthlyVisionMonth(month);
  return {
    type: "monthly_vision_sheet",
    month,
    status: "draft",
    items: leads
      .filter((lead) => activeMonthlyVisionBuckets.includes(lead.bucket as typeof activeMonthlyVisionBuckets[number]))
      .map(monthlyVisionItemFromLead)
      .sort(compareMonthlyVisionItems),
    created_at: generatedAt,
    updated_at: generatedAt,
    finalized_at: null,
    updated_by: null,
    finalized_by: null
  };
}

export function monthlyVisionItemFromLead(lead: Lead): MonthlyVisionItem {
  return {
    lead_id: lead.id,
    project: lead.project.trim(),
    developer: lead.team?.trim() ?? "",
    contacts: formatMonthlyVisionContacts(lead.contact_methods)
  };
}

export function formatMonthlyVisionContacts(methods: ContactMethod[]) {
  return methods
    .map((method) => {
      const value = method.value.trim();
      if (!value) return "";
      const note = method.note?.trim();
      return `${method.type}: ${value}${note ? ` (${note})` : ""}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function normalizeMonthlyVisionItems(value: unknown): MonthlyVisionItem[] {
  if (!Array.isArray(value)) throw new Error("视野表项目必须为数组");
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`第 ${index + 1} 行格式无效`);
    const record = item as Record<string, unknown>;
    const leadId = cleanString(record.lead_id);
    if (!leadId) throw new Error(`第 ${index + 1} 行缺少 Lead ID`);
    return {
      lead_id: leadId,
      project: cleanString(record.project),
      developer: cleanString(record.developer),
      contacts: cleanString(record.contacts, true)
    };
  }).sort(compareMonthlyVisionItems);
}

export function validateFinalizedMonthlyVisionItems(items: MonthlyVisionItem[]) {
  const errors: string[] = [];
  if (!items.length) errors.push("视野表至少需要一个项目");
  for (const item of items) {
    const label = item.project || item.lead_id;
    if (!item.project) errors.push(`${label}：缺少项目名称`);
    if (!item.developer) errors.push(`${label}：缺少研发团队`);
    if (!item.contacts) errors.push(`${label}：缺少联系方式`);
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (seen.has(item.lead_id)) duplicates.add(item.lead_id);
    seen.add(item.lead_id);
  }
  for (const id of duplicates) errors.push(`存在重复项目：${id}`);
  return errors;
}

export function normalizeStoredMonthlyVisionSheet(value: unknown, month: string): MonthlyVisionSheet | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type !== "monthly_vision_sheet" || record.month !== month) return null;
  const status = record.status === "finalized" ? "finalized" : "draft";
  const now = new Date().toISOString();
  return {
    type: "monthly_vision_sheet",
    month,
    status,
    items: normalizeMonthlyVisionItems(record.items),
    created_at: cleanString(record.created_at) || now,
    updated_at: cleanString(record.updated_at) || now,
    finalized_at: status === "finalized" ? cleanString(record.finalized_at) || null : null,
    updated_by: cleanString(record.updated_by) || null,
    finalized_by: status === "finalized" ? cleanString(record.finalized_by) || null : null
  };
}

export function buildSavedMonthlyVisionSheet(input: {
  month: string;
  status: MonthlyVisionStatus;
  items: MonthlyVisionItem[];
  existing: MonthlyVisionSheet | null;
  actor: string;
  now?: string;
}): MonthlyVisionSheet {
  assertMonthlyVisionMonth(input.month);
  const now = input.now ?? new Date().toISOString();
  return {
    type: "monthly_vision_sheet",
    month: input.month,
    status: input.status,
    items: [...input.items].sort(compareMonthlyVisionItems),
    created_at: input.existing?.created_at ?? now,
    updated_at: now,
    finalized_at: input.status === "finalized" ? now : null,
    updated_by: input.actor,
    finalized_by: input.status === "finalized" ? input.actor : null
  };
}

export async function readMonthlyVisionSheet(env: Env, month: string): Promise<MonthlyVisionSheet | null> {
  const id = monthlyVisionRowId(month);
  const response = await supabaseFetch(env, `/rest/v1/crm_leads?select=id,data&id=eq.${encodeURIComponent(id)}`);
  const rows = (await response.json()) as { id: string; data: unknown }[];
  const row = rows.find((item) => item.id === id);
  return normalizeStoredMonthlyVisionSheet(row?.data, month);
}

export async function writeMonthlyVisionSheet(env: Env, sheet: MonthlyVisionSheet) {
  await supabaseFetch(env, "/rest/v1/crm_leads?on_conflict=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify([{ id: monthlyVisionRowId(sheet.month), data: sheet, updated_at: sheet.updated_at }])
  });
}

export function monthlyVisionExcelHtml(sheet: MonthlyVisionSheet) {
  const header = ["项目名称", "研发团队", "联系方式"].map((label) => `<th>${label}</th>`).join("");
  const rows = sheet.items.map((item) => `<tr><td>${escapeHtml(item.project)}</td><td>${escapeHtml(item.developer)}</td><td>${escapeHtml(item.contacts)}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:Arial,"Microsoft YaHei",sans-serif;font-size:12px}th,td{border:1px solid #d0d7de;padding:6px 8px;vertical-align:top;white-space:pre-wrap}th{background:#f6f8fa;font-weight:700}</style></head><body><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function compareMonthlyVisionItems(a: MonthlyVisionItem, b: MonthlyVisionItem) {
  return a.project.localeCompare(b.project, "zh-CN");
}

function cleanString(value: unknown, preserveNewlines = false) {
  if (typeof value !== "string") return "";
  const normalized = preserveNewlines ? value.replace(/\r\n?/g, "\n") : value;
  return normalized.trim();
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
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
