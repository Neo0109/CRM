import { useEffect } from "react";

export const headerLabel = "Neo's BD Matrix · v1.7.0";

export function HeaderUiRefinement() {
  useEffect(() => {
    const versionLabel = document.querySelector<HTMLElement>(".hero-copy .eyebrow");
    if (versionLabel) versionLabel.textContent = headerLabel;

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
