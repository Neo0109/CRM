import type { Lead, MonthlyVisionItem } from "./types";

export function currentShanghaiMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function monthlyVisionMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  return `${year} 年 ${Number(monthNumber)} 月`;
}

export function monthlyVisionItemFromLead(lead: Lead): MonthlyVisionItem {
  return {
    lead_id: lead.id,
    project: lead.project.trim(),
    developer: lead.team?.trim() ?? "",
    contacts: lead.contact_methods
      .map((method) => {
        const value = method.value.trim();
        if (!value) return "";
        const note = method.note?.trim();
        return `${method.type}: ${value}${note ? ` (${note})` : ""}`;
      })
      .filter(Boolean)
      .join("\n")
  };
}

export function availableMonthlyVisionLeads(leads: Lead[], items: MonthlyVisionItem[]) {
  const selectedIds = new Set(items.map((item) => item.lead_id));
  return leads
    .filter((lead) => lead.bucket !== "淘汰池" && !selectedIds.has(lead.id))
    .sort((a, b) => a.project.localeCompare(b.project, "zh-CN"));
}

export function sortMonthlyVisionItems(items: MonthlyVisionItem[]) {
  return [...items].sort((a, b) => a.project.localeCompare(b.project, "zh-CN"));
}

export function monthlyVisionValidationErrors(items: MonthlyVisionItem[]) {
  const errors: string[] = [];
  if (!items.length) errors.push("视野表至少需要一个项目");
  for (const item of items) {
    const label = item.project.trim() || item.lead_id;
    if (!item.project.trim()) errors.push(`${label}：缺少项目名称`);
    if (!item.developer.trim()) errors.push(`${label}：缺少研发团队`);
    if (!item.contacts.trim()) errors.push(`${label}：缺少联系方式`);
  }

  const seen = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const item of items) {
    if (seen.has(item.lead_id)) duplicateIds.add(item.lead_id);
    seen.add(item.lead_id);
  }
  for (const id of duplicateIds) errors.push(`存在重复项目：${id}`);
  return errors;
}
