import type { PagesContext } from "../_lib/crm";

type EnvWithAssets = PagesContext["env"] & {
  ASSETS?: {
    fetch(input: Request | string | URL): Promise<Response>;
  };
};

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const assets = (env as EnvWithAssets).ASSETS;
  if (!assets) return new Response("Asset binding not available", { status: 503 });

  const url = new URL(request.url);
  const response = await assets.fetch(request);
  if (!response.ok) return response;

  const headers = new Headers(response.headers);
  if (url.pathname.startsWith("/assets/index.")) {
    headers.set("Cache-Control", "no-store");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};
