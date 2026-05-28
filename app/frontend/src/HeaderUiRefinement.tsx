import { useEffect } from "react";

export const headerLabel = "Neo's BD Matrix · v1.8.1";

function moveBefore(container: Element, beforeLabel: string, afterLabel: string) {
  const items = Array.from(container.children);
  const beforeItem = items.find((item) => item.textContent?.includes(beforeLabel));
  const afterItem = items.find((item) => item.textContent?.includes(afterLabel));
  if (!beforeItem || !afterItem || beforeItem.nextElementSibling === afterItem) return;
  container.insertBefore(beforeItem, afterItem);
}

function refineBucketOrder() {
  const metricStrip = document.querySelector(".metric-strip");
  if (metricStrip) moveBefore(metricStrip, "观察池", "跟进中");

  document.querySelectorAll<HTMLLabelElement>(".filters label").forEach((label) => {
    if (!label.textContent?.includes("池子")) return;
    const select = label.querySelector("select");
    if (select) moveBefore(select, "观察池", "跟进中");
  });
}

export function HeaderUiRefinement() {
  useEffect(() => {
    const apply = () => {
      const versionLabel = document.querySelector<HTMLElement>(".hero-copy .eyebrow");
      if (versionLabel) versionLabel.textContent = headerLabel;

      document.querySelectorAll<HTMLButtonElement>(".topbar .actions .tab-button").forEach((button) => {
        if (!button.textContent?.includes("设置")) return;
        button.hidden = true;
        button.style.display = "none";
        button.setAttribute("aria-hidden", "true");
        button.setAttribute("tabindex", "-1");
      });

      refineBucketOrder();
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
