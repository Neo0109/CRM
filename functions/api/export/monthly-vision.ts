import { json, requireAccess, type PagesContext } from "../../_lib/crm";
import { assertMonthlyVisionMonth, monthlyVisionExcelHtml, readMonthlyVisionSheet } from "../../_lib/monthlyVision";
import { readCrmSettings } from "../../_lib/settings";

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? "";
    assertMonthlyVisionMonth(month);

    const envWithExportPassword = env as PagesContext["env"] & { EXCEL_EXPORT_PASSWORD?: string };
    const configuredPassword = envWithExportPassword.EXCEL_EXPORT_PASSWORD ?? (await readCrmSettings(env)).excel_export_password ?? null;
    if (!configuredPassword) return json({ error: "请先在 Cloudflare Pages 的 Variables and Secrets 里配置 EXCEL_EXPORT_PASSWORD" }, 409);

    const submittedPassword = request.headers.get("x-export-password") ?? url.searchParams.get("password");
    if (submittedPassword !== configuredPassword) return json({ error: "Excel 导出密码错误" }, 403);

    const sheet = await readMonthlyVisionSheet(env, month);
    if (!sheet) return json({ error: "该月份尚未保存视野表" }, 404);
    if (sheet.status !== "finalized") return json({ error: "请先确认本月视野表，再导出 Excel" }, 409);

    return new Response(`\ufeff${monthlyVisionExcelHtml(sheet)}`, {
      headers: {
        "Content-Disposition": `attachment; filename=monthly-vision-${month}.xls`,
        "Content-Type": "application/vnd.ms-excel; charset=utf-8"
      }
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
};
