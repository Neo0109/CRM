import type { PagesContext } from "../_lib/crm";

const assetBase = "https://cdn.jsdelivr.net/gh/Neo0109/CRM@main/app/frontend/dist/assets";
const assetVersion = "20260601-login-page-v1";

function versionedAsset(fileName: string) {
  return `${assetBase}/${fileName}?v=${assetVersion}`;
}

const assetRedirects = new Map([
  ["index.css", versionedAsset("index.css")],
  ["index.js", versionedAsset("index.js")],
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
