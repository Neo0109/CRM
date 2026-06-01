const assetBase = "https://cdn.jsdelivr.net/gh/Neo0109/CRM@main/app/frontend/dist";
const stylesheetFile = "index.css";
const scriptFile = "index.js";
const assetVersion = "20260601-login-page-v1";

function versionedAsset(fileName: string) {
  return `${assetBase}/assets/${fileName}?v=${assetVersion}`;
}

export const onRequestGet = async () => new Response(renderHtml(), {
  headers: {
    "Cache-Control": "no-store",
    "Content-Type": "text/html; charset=utf-8"
  }
});

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
