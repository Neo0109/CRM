import { json, publicSettings, readSettings, requireAccess, writeSettings, type CrmSettings, type PagesContext } from "../_lib/crm";

type SettingsPatch = Partial<Pick<CrmSettings, "bound_email" | "excel_export_password" | "login_password">>;

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    return json(publicSettings(await readSettings(env)));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
};

export const onRequestPatch = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    const payload = (await request.json()) as SettingsPatch;
    const patch: SettingsPatch = {};

    if ("bound_email" in payload) patch.bound_email = cleanValue(payload.bound_email);
    if ("excel_export_password" in payload) patch.excel_export_password = cleanValue(payload.excel_export_password);
    if ("login_password" in payload) patch.login_password = cleanValue(payload.login_password);

    const nextSettings = await writeSettings(env, patch);
    return json(publicSettings(nextSettings));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
};

function cleanValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
