import { isDailyReport, json, leadsFromReport, mergeIncomingLeads, requireAccess, type Lead, type PagesContext } from "../_lib/crm";

type JsonRecord = Record<string, unknown>;

export const onRequestPost = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    const payload = await request.json();
    const leads = extractLeads(payload);

    if (!leads.length) {
      return json({ error: "没有识别到可导入 leads，请粘贴单条 lead、lead 数组或日报 JSON" }, 400);
    }

    const result = await mergeIncomingLeads(env, leads);
    return json({
      message: `JSON 导入完成：新增 ${result.created}，更新 ${result.updated}，淘汰 ${result.dropped}`,
      imported: leads.length,
      ...result
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "JSON 导入失败" }, 400);
  }
};

function extractLeads(payload: unknown): Partial<Lead>[] {
  const value = unwrapPayload(payload);

  if (isDailyReport(value)) return leadsFromReport(value);

  if (Array.isArray(value)) {
    return value.filter(isLeadRecord).map(toLeadCandidate);
  }

  if (!isRecord(value)) return [];

  if (Array.isArray(value.leads)) {
    return value.leads.filter(isLeadRecord).map(toLeadCandidate);
  }

  if (hasReportPools(value)) {
    return leadsFromReport({
      report_date: typeof value.report_date === "string" ? value.report_date : new Date().toISOString().slice(0, 10),
      summary: typeof value.summary === "string" ? value.summary : "手动 JSON 导入",
      insights: Array.isArray(value.insights) ? value.insights.filter((item): item is string => typeof item === "string") : [],
      push_pool: Array.isArray(value.push_pool) ? value.push_pool.filter(isLeadRecord).map(toLeadCandidate) : [],
      watch_pool: Array.isArray(value.watch_pool) ? value.watch_pool.filter(isLeadRecord).map(toLeadCandidate) : [],
      drop_pool: Array.isArray(value.drop_pool) ? value.drop_pool.filter(isLeadRecord).map(toLeadCandidate) : []
    });
  }

  return isLeadRecord(value) ? [toLeadCandidate(value)] : [];
}

function unwrapPayload(payload: unknown) {
  if (isRecord(payload) && "payload" in payload) return payload.payload;
  return payload;
}

function hasReportPools(value: JsonRecord) {
  return Array.isArray(value.push_pool) || Array.isArray(value.watch_pool) || Array.isArray(value.drop_pool);
}

function isLeadRecord(value: unknown): value is JsonRecord {
  return isRecord(value) && typeof value.project === "string" && value.project.trim().length > 0;
}

function toLeadCandidate(value: JsonRecord): Partial<Lead> {
  return value as Partial<Lead>;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
