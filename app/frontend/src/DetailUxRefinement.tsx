import { useEffect } from "react";
import { productVersion, productVersionLabel } from "./productVersion";

const stageLabels: Record<string, string> = {
  new: "New",
  watch: "Watch",
  active: "Active",
  negotiating: "Negotiating",
  won: "Won",
  rejected: "Rejected"
};

export function DetailUxRefinement() {
  useEffect(() => {
    let frame = 0;

    const applyRefinements = () => {
      frame = 0;
      syncVersionLabel();
      relabelStageOptions();
    };

    const scheduleRefinements = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(applyRefinements);
    };

    const observer = new MutationObserver(scheduleRefinements);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("change", scheduleRefinements, true);
    scheduleRefinements();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("change", scheduleRefinements, true);
    };
  }, []);

  return null;
}

function syncVersionLabel() {
  const versionLabel = document.querySelector<HTMLElement>(".hero-copy .eyebrow");
  if (!versionLabel) return;

  const text = versionLabel.textContent ?? "";
  versionLabel.dataset.brandLabel = productVersionLabel;
  if (text.includes(productVersion)) return;
  versionLabel.textContent = text.replace(/v\d+\.\d+(?:\.\d+)?(?:-[^\s]+)?/, productVersion);
}

function relabelStageOptions() {
  const options = Array.from(document.querySelectorAll<HTMLOptionElement>("option"));
  for (const option of options) {
    const raw = option.value || (option.textContent ?? "").trim();
    const label = stageLabels[raw];
    if (label && option.textContent !== label) option.textContent = label;
  }
}
