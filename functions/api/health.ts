import { json, type PagesContext } from "../_lib/crm";

export const onRequestGet = async ({ env }: PagesContext) => {
  const hasSupabaseUrl = Boolean(env.SUPABASE_URL);
  const hasSupabaseSecret = Boolean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

  return json({
    ok: true,
    storage: hasSupabaseUrl && hasSupabaseSecret ? "supabase" : "missing",
    env: {
      hasSupabaseUrl,
      hasSupabaseSecret,
      hasCrmAccessToken: Boolean(env.CRM_ACCESS_TOKEN)
    }
  });
};
