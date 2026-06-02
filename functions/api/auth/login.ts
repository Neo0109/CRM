import { json, validateLoginCredentials, type PagesContext } from "../../_lib/crm";

type LoginPayload = {
  username?: string;
  password?: string;
};

export const onRequestPost = async ({ request, env }: PagesContext) => {
  const payload = (await request.json().catch(() => ({}))) as LoginPayload;
  const result = await validateLoginCredentials(env, payload.username, payload.password);

  if (!result.ok) {
    if (result.reason === "invalid_user_config") {
      return json({ error: "账号配置无效：请检查 Cloudflare 的 CRM_USERS_JSON 是否为有效 JSON" }, 503);
    }
    return json({ error: "账号或密码无效" }, 401);
  }

  return json({
    ok: true,
    username: result.username ?? payload.username?.trim() ?? "",
    display_name: result.display_name ?? result.username ?? payload.username?.trim() ?? "",
    role: result.role ?? "member",
    permissions: result.permissions ?? []
  });
};
