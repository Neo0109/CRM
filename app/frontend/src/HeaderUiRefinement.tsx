import { useEffect } from "react";

const displayVersion = "v1.6.2";

export function HeaderUiRefinement() {
  useEffect(() => {
    function applyHeaderRefinement() {
      const versionLabel = document.querySelector<HTMLElement>(".hero-copy .eyebrow");
      if (versionLabel) versionLabel.textContent = `B站游戏发行 BD · ${displayVersion}`;

      document.querySelectorAll<HTMLButtonElement>(".topbar .actions .tab-button").forEach((button) => {
        if (!button.textContent?.includes("设置")) return;
        button.hidden = true;
        button.style.display = "none";
        button.setAttribute("aria-hidden", "true");
        button.setAttribute("tabindex", "-1");
      });
    }

    applyHeaderRefinement();
    const observer = new MutationObserver(applyHeaderRefinement);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
