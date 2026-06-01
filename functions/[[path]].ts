const assetBase = "https://cdn.jsdelivr.net/gh/Neo0109/CRM@7fb27d1da7213f38b96d3532a5f7cc1f2e29f8f8/app/frontend/dist";
const stylesheetFile = "index.css";
const scriptFile = "index.js";
const assetVersion = "20260602-sidebar-rhythm-v22";
const brandLabel = "Neo's BD Matrix · v2.2";

function versionedAsset(fileName: string) {
  return `${assetBase}/assets/${fileName}?v=${assetVersion}`;
}

const assetRedirects = new Map([
  ["/assets/crm-paper-texture-BjGXa_NP.png", `${assetBase}/assets/crm-paper-texture-BjGXa_NP.png`],
  ["/assets/bili-crm-dashboard-DIye6pxa.png", `${assetBase}/assets/bili-crm-dashboard-DIye6pxa.png`],
  ["/assets/bilibili-game-logo-IUcC7daF.png", `${assetBase}/assets/bilibili-game-logo-IUcC7daF.png`],
  ["/assets/matrix-code-rain-CoRfJN-o.jpg", `${assetBase}/assets/matrix-code-rain-CoRfJN-o.jpg`],
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
    <script>
      (() => {
        const label = ${JSON.stringify(brandLabel)};
        const apply = () => {
          const node = document.querySelector(".hero-copy .eyebrow");
          if (!node) return;
          node.setAttribute("data-brand-label", label);
          if (node.textContent !== label) node.textContent = label;
        };
        apply();
        new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}
