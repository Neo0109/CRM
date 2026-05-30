const assetBase = "https://cdn.jsdelivr.net/gh/Neo0109/CRM@main/app/frontend/dist";
const assetRedirects = new Map([
  ["/assets/crm-paper-texture-BjGXa_NP.png", `${assetBase}/assets/crm-paper-texture-BjGXa_NP.png`],
  ["/assets/bili-crm-dashboard-DIye6pxa.png", `${assetBase}/assets/bili-crm-dashboard-DIye6pxa.png`]
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
    <title>Sourcing CRM</title>
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
    <link rel="stylesheet" crossorigin href="${assetBase}/assets/index-BUaZ3SJz.css" />
    <script type="module" crossorigin src="${assetBase}/assets/index-jp1SlYhX.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}
