import { json, requireAccess, type PagesContext } from "../_lib/crm";
import { buildAutomationDiagnostics } from "../_lib/automationDiagnostics";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const reportDate = url.searchParams.get("date");
  if (reportDate && !datePattern.test(reportDate)) return json({ error: "Invalid diagnostics date" }, 400);

  try {
    const diagnostics = await buildAutomationDiagnostics(reportDate);
    return json(diagnostics);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "invalid_date") return json({ error: "Invalid diagnostics date" }, 400);
    return json({ error: "Automation diagnostics failed" }, 502);
  }
};
