import type { PagesContext } from "../_lib/crm";

const assetBase = "https://cdn.jsdelivr.net/gh/Neo0109/CRM@main/app/frontend/dist/assets";

const assetRedirects = new Map([
  ["crm-paper-texture-BjGXa_NP.png", `${assetBase}/crm-paper-texture-BjGXa_NP.png`],
  ["bili-crm-dashboard-DIye6pxa.png", `${assetBase}/bili-crm-dashboard-DIye6pxa.png`]
]);

export const onRequestGet = async ({ params }: PagesContext) => {
  const pathParam = params.path;
  const fileName = Array.isArray(pathParam) ? pathParam.join("/") : pathParam;
  const redirectTo = assetRedirects.get(fileName);

  if (!redirectTo) return new Response("Asset not found", { status: 404 });
  return Response.redirect(redirectTo, 302);
};
