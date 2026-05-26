import { useEffect } from "react";

const displayVersion = "v1.6.2";
const versionText = `B站游戏发行 BD · ${displayVersion}`;

export function HeaderUiRefinement() {
  useEffect(() => {
    const versionLabel = document.querySelector<HTMLElement>(".hero-copy .eyebrow");
    if (versionLabel) versionLabel.textContent = versionText;

    document.querySelectorAll<HTMLButtonElement>(".topbar .actions .tab-button").forEach((button) => {
      if (!button.textContent?.includes("设置")) return;
      button.hidden = true;
      button.style.display = "none";
      button.setAttribute("aria-hidden", "true");
      button.setAttribute("tabindex", "-1");
    });
  }, []);

  return null;
}
