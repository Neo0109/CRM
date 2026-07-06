import { json, requireAccess, type PagesContext } from "../_lib/crm";

export const onRequestPost = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  return json({
    error: "CRM online settings changes are disabled. Manage account and password settings in Cloudflare Variables/Secrets."
  }, 405);
};
