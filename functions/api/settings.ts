import { json, requireAccess, type PagesContext } from "../_lib/crm";
import { publicCrmSettings, readCrmSettings, verifySettingsCode, writeCrmSettings, type ExtendedCrmSettings } from "../_lib/settings";

type SettingsPayload = Partial<Pick<ExtendedCrmSettings, "bound_email" | "excel_export_password" | "login_password">> & {
  verification_code?: string | null;
};

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    return json(publicCrmSettings(await readCrmSettings(env)));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
};

export const onRequestPatch = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    const payload = (await request.json()) as SettingsPayload;
    const current = await readCrmSettings(env);
    const patch: SettingsPayload = {};

    const hasBoundEmail = "bound_email" in payload;
    const hasExcelPassword = "excel_export_password" in payload;
    const hasLoginPassword = "login_password" in payload;
    const nextBoundEmail = hasBoundEmail ? cleanValue(payload.bound_email) : current.bound_email;
    const nextExcelPassword = hasExcelPassword ? cleanValue(payload.excel_export_password) : current.excel_export_password;
    const nextLoginPassword = hasLoginPassword ? cleanValue(payload.login_password) : current.login_password;
    const changingPassword = (hasExcelPassword && nextExcelPassword !== current.excel_export_password) || (hasLoginPassword && nextLoginPassword !== current.login_password);

    if (changingPassword && !nextBoundEmail) return json({ error: "请先绑定邮箱，再修改密码" }, 400);
    if (changingPassword && current.bound_email) {
      const verified = await verifySettingsCode(env, payload.verification_code, "settings_change");
      if (!verified) return json({ error: "验证码无效或已过期" }, 403);
    }

    if (hasBoundEmail) patch.bound_email = nextBoundEmail;
    if (hasExcelPassword) patch.excel_export_password = nextExcelPassword;
    if (hasLoginPassword) patch.login_password = nextLoginPassword;

    const nextSettings = await writeCrmSettings(env, patch);
    return json(publicCrmSettings(nextSettings));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
};

function cleanValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
