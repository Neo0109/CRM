import { json, readLeads, requireAccess, syncReportFromRepository, todayInShanghai, type PagesContext } from "../_lib/crm";

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    const today = todayInShanghai();
    const yesterday = offsetDate(today, -1);
    const existingLeads = await readLeads(env);

    if (!hasSyncedReport(existingLeads, yesterday)) {
      await syncReportFromRepository(env, yesterday).catch(() => null);
    }

    await syncReportFromRepository(env, today).catch(() => null);
    return json(await readLeads(env));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
};

function hasSyncedReport(leads: Awaited<ReturnType<typeof readLeads>>, reportDate: string) {
  return leads.some((lead) => lead.first_seen === reportDate || (lead.notes ?? "").includes(`日报 ${reportDate}`));
}

function offsetDate(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return date.toISOString().slice(0, 10);
}
