import { readLeads, requireAccess, type Lead, type PagesContext } from "../../_lib/crm";
import { assertMonthlyVisionMonth, monthlyVisionExcelHtml, readMonthlyVisionSheet } from "../../_lib/monthlyVision";
import { readCrmSettings } from "../../_lib/settings";

const columns: { key: keyof Lead | "contacts" | "game_links"; label: string }[] = [
  { key: "project", label: "项目" },
  { key: "team", label: "团队" },
  { key: "region", label: "地区" },
  { key: "country", label: "国家/地区" },
  { key: "city", label: "城市" },
  { key: "bucket", label: "池子" },
  { key: "stage", label: "阶段" },
  { key: "priority", label: "优先级" },
  { key: "review_status", label: "处理状态" },
  { key: "priority_reason", label: "优先原因" },
  { key: "rule_fit", label: "规则判断" },
  { key: "genre", label: "类型" },
  { key: "gameplay", label: "玩法" },
  { key: "progress", label: "进度" },
  { key: "release_window", label: "发售窗口" },
  { key: "publisher_status", label: "发行结构" },
  { key: "publisher_name", label: "发行商" },
  { key: "contacts", label: "联系方式" },
  { key: "game_links", label: "Steam/SteamDB" },
  { key: "bilibili_fit", label: "B站适配" },
  { key: "amplification", label: "放大作用" },
  { key: "risks", label: "风险" },
  { key: "verdict", label: "结论" },
  { key: "evaluation_grade", label: "评测评级" },
  { key: "evaluation_result", label: "评测内容" },
  { key: "evaluated_at", label: "评测时间" },
  { key: "next_action", label: "下一步" },
  { key: "owner", label: "Owner" },
  { key: "due_date", label: "Due Date" },
  { key: "notes", label: "备注" },
  { key: "first_seen", label: "首次发现" }
];

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    const envWithExportPassword = env as PagesContext["env"] & { EXCEL_EXPORT_PASSWORD?: string };
    const configuredPassword = envWithExportPassword.EXCEL_EXPORT_PASSWORD ?? (await readCrmSettings(env)).excel_export_password ?? null;
    if (!configuredPassword) return jsonResponse({ error: "请先在 Cloudflare Pages 的 Variables and Secrets 里配置 EXCEL_EXPORT_PASSWORD" }, 409);

    const url = new URL(request.url);
    const submittedPassword = request.headers.get("x-export-password") ?? url.searchParams.get("password");
    if (submittedPassword !== configuredPassword) return jsonResponse({ error: "Excel 导出密码错误" }, 403);

    if (url.searchParams.get("scope") === "monthly-vision") {
      const month = url.searchParams.get("month") ?? "";
      assertMonthlyVisionMonth(month);
      const sheet = await readMonthlyVisionSheet(env, month);
      if (!sheet) return jsonResponse({ error: "该月份尚未保存视野表" }, 404);
      if (sheet.status !== "finalized") return jsonResponse({ error: "请先确认本月视野表，再导出 Excel" }, 409);
      return excelResponse(monthlyVisionExcelHtml(sheet), `monthly-vision-${month}.xls`);
    }

    return excelResponse(
      toExcelHtml(await readLeads(env)),
      `sourcing-crm-leads-${new Date().toISOString().slice(0, 10)}.xls`
    );
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
};

function toExcelHtml(leads: Lead[]) {
  const header = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const rows = leads.map((lead) => `<tr>${columns.map((column) => `<td>${escapeHtml(cellValue(lead, column.key))}</td>`).join("")}</tr>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:Arial,"Microsoft YaHei",sans-serif;font-size:12px}th,td{border:1px solid #d0d7de;padding:6px 8px;vertical-align:top;white-space:pre-wrap}th{background:#f6f8fa;font-weight:700}</style></head><body><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function cellValue(lead: Lead, key: keyof Lead | "contacts" | "game_links") {
  if (key === "contacts") return lead.contact_methods.map((method) => `${method.type}: ${method.value}${method.note ? ` (${method.note})` : ""}`).join(" | ");
  if (key === "game_links") return lead.links.filter((link) => /(?:store\.steampowered\.com|steamdb\.info)\/app\/\d+/i.test(link)).join(" | ");
  const value = lead[key];
  if (Array.isArray(value)) return value.join(" | ");
  return value === null || value === undefined ? "" : String(value);
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function excelResponse(html: string, filename: string) {
  return new Response(`\ufeff${html}`, {
    headers: {
      "Content-Disposition": `attachment; filename=${filename}`,
      "Content-Type": "application/vnd.ms-excel; charset=utf-8"
    }
  });
}

function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
