import { json, validateLoginCredentials, type PagesContext } from "../../_lib/crm";

type LoginPayload = {
  username?: string;
  password?: string;
};

export const onRequestPost = async ({ request, env }: PagesContext) => {
  const payload = (await request.json().catch(() => ({}))) as LoginPayload;
  const result = await validateLoginCredentials(env, payload.username, payload.password);

  if (!result.ok) {
    return json({ error: "账号或密码无效" }, 401);
  }

  return json({
    ok: true,
    username: result.username ?? payload.username?.trim() ?? ""
  });
};
