import type { PagesContext } from "./_lib/crm";

const stylesheetFile = "index.css";
const scriptFile = "index.js";
const assetVersion = "20260821-steam-direct-link-button-v281";

function versionedAsset(fileName: string) {
  return `/assets/${fileName}?v=${assetVersion}`;
}

type EnvWithAssets = PagesContext["env"] & {
  ASSETS?: {
    fetch(input: Request | string | URL): Promise<Response>;
  };
};

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/assets/")) {
    const assets = (env as EnvWithAssets).ASSETS;
    if (!assets) return new Response("Asset binding not available", { status: 503 });
    const response = await assets.fetch(request);
    if (!url.pathname.startsWith("/assets/index.")) return response;

    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  return new Response(renderHtml(), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8"
    }
  });
};

function renderHtml() {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>BD 决策工作台</title>
    <link rel="stylesheet" crossorigin href="${versionedAsset(stylesheetFile)}" />
    <style>
      .hero-copy .eyebrow { font-size: 0 !important; line-height: 1.4 !important; }
      .hero-copy .eyebrow::after {
        content: attr(data-brand-label) !important;
        color: #006da8;
        display: inline-block;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0;
      }
    </style>
    <script type="module" crossorigin src="${versionedAsset(scriptFile)}"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}
