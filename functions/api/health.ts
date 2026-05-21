import { json, type PagesContext } from "../_lib/crm";

export const onRequestGet = async ({ env }: PagesContext) => {
  return json({ ok: true, storage: env.SUPABASE_URL ? "supabase" : "missing" });
};
