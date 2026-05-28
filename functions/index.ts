const commit = "68dd9b6";
const assetBase = `https://cdn.jsdelivr.net/gh/Neo0109/CRM@${commit}/app/frontend/dist`;

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
    <title>Sourcing CRM</title>
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
    <link rel="stylesheet" crossorigin href="${assetBase}/assets/index-sI6l8S6y.css" />
    <script type="module" crossorigin src="${assetBase}/assets/index-JSJAObLI.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}
