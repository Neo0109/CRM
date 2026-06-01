import { json, parseCrmUsersJson, type PagesContext } from "../_lib/crm";

export const onRequestGet = async ({ env }: PagesContext) => {
  const hasSupabaseUrl = Boolean(env.SUPABASE_URL);
  const hasSupabaseSecret = Boolean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
  const hasOpenAiApiKey = Boolean((env as PagesContext["env"] & { OPENAI_API_KEY?: string }).OPENAI_API_KEY);
  const hasExcelExportPassword = Boolean((env as PagesContext["env"] & { EXCEL_EXPORT_PASSWORD?: string }).EXCEL_EXPORT_PASSWORD);
  const crmUserCount = parseCrmUsersJson(env.CRM_USERS_JSON).length + (env.CRM_USERNAME && env.CRM_ACCESS_TOKEN ? 1 : 0);

  return json({
    ok: true,
    version: "v2.0-bd-efficiency-workflow",
    storage: hasSupabaseUrl && hasSupabaseSecret ? "supabase" : "missing",
    env: {
      hasSupabaseUrl,
      hasSupabaseSecret,
      hasCrmUsersJson: Boolean(env.CRM_USERS_JSON),
      crmUserCount,
      hasCrmUsername: Boolean(env.CRM_USERNAME),
      hasCrmAccessToken: Boolean(env.CRM_ACCESS_TOKEN),
      hasOpenAiApiKey,
      hasExcelExportPassword
    }
  });
};
