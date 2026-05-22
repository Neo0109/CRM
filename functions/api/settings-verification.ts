import { json, requireAccess, type PagesContext } from "../_lib/crm";
import { createSettingsVerification } from "../_lib/settings";

export const onRequestPost = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    const result = await createSettingsVerification(env, "settings_change");
    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
};
