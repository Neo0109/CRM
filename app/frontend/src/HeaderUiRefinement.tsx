import { useEffect } from "react";

const displayVersion = "v1.6.2";
const versionText = `B站游戏发行 BD · ${displayVersion}`;

export function HeaderUiRefinement() {
  useEffect(() => {
    function applyHeaderRefinement() {
      const versionLabel = document.querySelector<HTMLElement>(".hero-copy .eyebrow");
      if (versionLabel && versionLabel.textContent !== versionText) {
        versionLabel.textContent = versionText;
      }

      document.querySelectorAll<HTMLButtonElement>(".topbar .actions .tab-button").forEach((button) => {
        if (!button.textContent?.includes("设置")) return;
        if (button.hidden && button.style.display === "none") return;
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
