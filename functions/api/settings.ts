import { json, requireAccess, type PagesContext } from "../_lib/crm";
import { publicCrmSettings, readCrmSettings } from "../_lib/settings";

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

  return settingsMutationDisabledResponse();
};

function settingsMutationDisabledResponse() {
  return new Response(
    JSON.stringify({
      error: "CRM settings are managed in Cloudflare Variables/Secrets. Online settings changes are disabled."
    }),
    {
      status: 405,
      headers: {
        "Allow": "GET",
        "Content-Type": "application/json; charset=utf-8"
      }
    }
  );
}
