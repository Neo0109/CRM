import { getAccessUser, json, readLeads, type PagesContext } from "../_lib/crm";
import {
  assertMonthlyVisionMonth,
  buildGeneratedMonthlyVisionSheet,
  buildSavedMonthlyVisionSheet,
  normalizeMonthlyVisionItems,
  readMonthlyVisionSheet,
  validateFinalizedMonthlyVisionItems,
  writeMonthlyVisionSheet,
  type MonthlyVisionStatus
} from "../_lib/monthlyVision";

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const actor = await getAccessUser(request, env);
  if (!actor) return json({ error: "CRM login required" }, 401);

  try {
    const month = requestedMonth(request);
    const stored = await readMonthlyVisionSheet(env, month);
    if (stored) return json({ source: "stored", sheet: stored });
    return json({ source: "generated", sheet: buildGeneratedMonthlyVisionSheet(await readLeads(env), month) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
};

export const onRequestPut = async ({ request, env }: PagesContext) => {
  const actor = await getAccessUser(request, env);
  if (!actor) return json({ error: "CRM login required" }, 401);

  try {
    const month = requestedMonth(request);
    const body = await request.json() as { status?: unknown; items?: unknown };
    const status = requestedStatus(body.status);
    const items = normalizeMonthlyVisionItems(body.items);
    const leads = await readLeads(env);
    const leadIds = new Set(leads.map((lead) => lead.id));
    const missingLead = items.find((item) => !leadIds.has(item.lead_id));
    if (missingLead) return json({ error: `${missingLead.project || missingLead.lead_id} 已不在 CRM 中，请移除后重试` }, 409);

    if (status === "finalized") {
      const errors = validateFinalizedMonthlyVisionItems(items);
      if (errors.length) return json({ error: "视野表尚未完整", validation_errors: errors }, 422);
    }

    const existing = await readMonthlyVisionSheet(env, month);
    const displayName = actor.display_name || actor.username;
    const sheet = buildSavedMonthlyVisionSheet({ month, status, items, existing, actor: displayName });
    await writeMonthlyVisionSheet(env, sheet);
    return json(sheet);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
};

function requestedMonth(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  assertMonthlyVisionMonth(month);
  return month;
}

function requestedStatus(value: unknown): MonthlyVisionStatus {
  if (value === "draft" || value === "finalized") return value;
  throw new Error("状态必须为 draft 或 finalized");
}
