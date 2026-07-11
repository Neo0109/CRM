import { json, requireAccess, type PagesContext } from "../../_lib/crm";
import { assertMonthlyVisionMonth, monthlyVisionExcelHtml, readMonthlyVisionSheet } from "../../_lib/monthlyVision";
import { readCrmSettings } from "../../_lib/settings";

type ExportInput = {
  month: string;
  password: string | null;
};

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const url = new URL(request.url);
  return exportMonthlyVision(request, env, {
    month: url.searchParams.get("month") ?? "",
    password: request.headers.get("x-export-password") ?? url.searchParams.get("password")
  });
};

export const onRequestPost = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    const form = await request.formData();
    return exportMonthlyVisionResponse(env, {
      month: formValue(form, "month"),
      password: request.headers.get("x-export-password") ?? formValue(form, "password")
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
};

async function exportMonthlyVision(request: Request, env: PagesContext["env"], input: ExportInput) {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    return await exportMonthlyVisionResponse(env, input);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
}

async function exportMonthlyVisionResponse(env: PagesContext["env"], input: ExportInput) {
  assertMonthlyVisionMonth(input.month);
  const envWithExportPassword = env as PagesContext["env"] & { EXCEL_EXPORT_PASSWORD?: string };
  const configuredPassword = envWithExportPassword.EXCEL_EXPORT_PASSWORD ?? (await readCrmSettings(env)).excel_export_password ?? null;
  if (!configuredPassword) return json({ error: "请先在 Cloudflare Pages 的 Variables and Secrets 里配置 EXCEL_EXPORT_PASSWORD" }, 409);
  if (input.password !== configuredPassword) return json({ error: "Excel 导出密码错误" }, 403);

  const sheet = await readMonthlyVisionSheet(env, input.month);
  if (!sheet) return json({ error: "该月份尚未保存视野表" }, 404);
  if (sheet.status !== "finalized") return json({ error: "请先确认本月视野表，再导出 Excel" }, 409);

  return new Response(`\ufeff${monthlyVisionExcelHtml(sheet)}`, {
    headers: {
      "Content-Disposition": `attachment; filename=monthly-vision-${input.month}.xls`,
      "Content-Type": "application/vnd.ms-excel; charset=utf-8"
    }
  });
}

function formValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}
