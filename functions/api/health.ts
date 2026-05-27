import { json, type PagesContext } from "../_lib/crm";

export const onRequestGet = async ({ env }: PagesContext) => {
  const hasSupabaseUrl = Boolean(env.SUPABASE_URL);
  const hasSupabaseSecret = Boolean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
  const hasOpenAiApiKey = Boolean((env as PagesContext["env"] & { OPENAI_API_KEY?: string }).OPENAI_API_KEY);
  const hasExcelExportPassword = Boolean((env as PagesContext["env"] & { EXCEL_EXPORT_PASSWORD?: string }).EXCEL_EXPORT_PASSWORD);

  return json({
    ok: true,
    version: "v1.7.3-radar-context-gate",
    storage: hasSupabaseUrl && hasSupabaseSecret ? "supabase" : "missing",
    env: {
      hasSupabaseUrl,
      hasSupabaseSecret,
      hasCrmAccessToken: Boolean(env.CRM_ACCESS_TOKEN),
      hasOpenAiApiKey,
      hasExcelExportPassword
    }
  });
};
