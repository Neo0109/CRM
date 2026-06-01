const assetBase = "https://cdn.jsdelivr.net/gh/Neo0109/CRM@e75ab01b869face0dcc54ee4f881c5bcf3a0f84c/app/frontend/dist";
const stylesheetFile = "index.css";
const scriptFile = "index.js";
const assetVersion = "20260602-daily-philosophy-hero";
const brandLabel = "Neo's BD Matrix · v2.1";

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
