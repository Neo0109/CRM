const assetBase = "https://cdn.jsdelivr.net/gh/Neo0109/CRM@433a081/app/frontend/dist";
const stylesheetFile = "index.css";
const scriptFile = "index.js";
const assetVersion = "20260601-multi-user-login-v1";

function versionedAsset(fileName: string) {
  return `${assetBase}/assets/${fileName}?v=${assetVersion}`;
}

const assetRedirects = new Map([
  ["/assets/crm-paper-texture-BjGXa_NP.png", `${assetBase}/assets/crm-paper-texture-BjGXa_NP.png`],
  ["/assets/bili-crm-dashboard-DIye6pxa.png", `${assetBase}/assets/bili-crm-dashboard-DIye6pxa.png`],
  [`/assets/${stylesheetFile}`, versionedAsset(stylesheetFile)],
  [`/assets/${scriptFile}`, versionedAsset(scriptFile)]
]);

export const onRequestGet = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const redirectTo = assetRedirects.get(url.pathname);
  if (redirectTo) return Response.redirect(redirectTo, 302);

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
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
    <link rel="stylesheet" crossorigin href="${versionedAsset(stylesheetFile)}" />
    <script type="module" crossorigin src="${versionedAsset(scriptFile)}"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}
