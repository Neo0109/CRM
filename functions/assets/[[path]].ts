import type { PagesContext } from "../_lib/crm";

const assetBase = "https://cdn.jsdelivr.net/gh/Neo0109/CRM@ec6567dfffad355c071e820f83e00b09175dd6b4/app/frontend/dist/assets";
const assetVersion = "20260602-dashboard-rhythm-v23";

function versionedAsset(fileName: string) {
  return `${assetBase}/${fileName}?v=${assetVersion}`;
}

const assetRedirects = new Map([
  ["index.css", versionedAsset("index.css")],
  ["index.js", versionedAsset("index.js")],
  ["crm-paper-texture-BjGXa_NP.png", `${assetBase}/crm-paper-texture-BjGXa_NP.png`],
  ["bili-crm-dashboard-DIye6pxa.png", `${assetBase}/bili-crm-dashboard-DIye6pxa.png`],
  ["bilibili-game-logo-IUcC7daF.png", `${assetBase}/bilibili-game-logo-IUcC7daF.png`],
  ["matrix-code-rain-CoRfJN-o.jpg", `${assetBase}/matrix-code-rain-CoRfJN-o.jpg`]
]);

export const onRequestGet = async ({ params }: PagesContext) => {
  const pathParam = params.path;
  const fileName = Array.isArray(pathParam) ? pathParam.join("/") : pathParam;
  const redirectTo = assetRedirects.get(fileName);

  if (!redirectTo) return new Response("Asset not found", { status: 404 });
  return Response.redirect(redirectTo, 302);
};
