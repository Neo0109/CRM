import { useEffect } from "react";

const STEAM_COMMUNITY_APP_PATTERN = /steamcommunity\.com\/app\/(\d+)/i;

export function SteamStoreLinkBehavior() {
  useEffect(() => {
    let frame = 0;

    const rewriteSteamLinks = () => {
      frame = 0;
      const anchors = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="steamcommunity.com/app/"]')
      );

      for (const anchor of anchors) {
        const appId = steamAppIdFromCommunityUrl(anchor.href);
        if (!appId) continue;

        const storeUrl = `https://store.steampowered.com/app/${appId}/`;
        anchor.href = storeUrl;
        anchor.title = storeUrl;
        anchor.setAttribute("aria-label", "Open Steam store page");
        anchor.dataset.normalizedSteamStore = "true";

        const label = anchor.querySelector<HTMLElement>(".chip-label");
        if (label && /Steam/i.test(label.textContent ?? "")) {
          label.textContent = "Steam";
        }
      }
    };

    const scheduleRewrite = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(rewriteSteamLinks);
    };

    const observer = new MutationObserver(scheduleRewrite);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["href"],
      childList: true,
      subtree: true
    });

    scheduleRewrite();

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}

function steamAppIdFromCommunityUrl(value: string) {
  try {
    const url = new URL(value);
    if (!/steamcommunity\.com$/i.test(url.hostname)) return null;
    const match = url.pathname.match(/^\/app\/(\d+)/i);
    return match?.[1] ?? null;
  } catch {
    const match = value.match(STEAM_COMMUNITY_APP_PATTERN);
    return match?.[1] ?? null;
  }
}
