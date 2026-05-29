import { useEffect } from "react";

const stageLabels: Record<string, string> = {
  new: "New",
  watch: "Watch",
  active: "Active",
  negotiating: "Negotiating",
  won: "Won",
  rejected: "Rejected"
};

const ruleLabels: Record<string, string> = {
  "PC Early Access": "PC Early Access（排除）",
  "叙事主导": "叙事主导（排除）",
  "印度团队": "印度团队（排除）",
  "中国能力已占位": "中国能力已占位（降权）"
};

export function DetailUxRefinement() {
  useEffect(() => {
    let frame = 0;

    const applyRefinements = () => {
      frame = 0;
      syncVersionLabel();
      relabelStageOptions();
      clarifyRuleFlags();
      foldRawDueDateField();
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
  if (text.includes("v1.8.9")) return;
  versionLabel.textContent = text.replace(/v\d+\.\d+(?:\.\d+)?(?:-[^\s]+)?/, "v1.8.9");
}

function relabelStageOptions() {
  const options = Array.from(document.querySelectorAll<HTMLOptionElement>("option"));
  for (const option of options) {
    const raw = option.value || (option.textContent ?? "").trim();
    const label = stageLabels[raw];
    if (label && option.textContent !== label) option.textContent = label;
  }
}

function clarifyRuleFlags() {
  const labels = Array.from(document.querySelectorAll<HTMLElement>(".checkbox-field span"));
  let ruleGrid: HTMLElement | null = null;

  for (const label of labels) {
    const normalized = normalizeRuleLabel(label.textContent ?? "");
    const nextLabel = ruleLabels[normalized];
    if (!nextLabel) continue;

    label.textContent = nextLabel;
    label.dataset.ruleFlagLabel = normalized;
    const grid = label.closest(".check-grid") as HTMLElement | null;
    if (grid) ruleGrid = grid;
  }

  if (!ruleGrid || ruleGrid.previousElementSibling?.classList.contains("rule-flag-explainer")) return;

  const explainer = document.createElement("div");
  explainer.className = "rule-flag-explainer";
  explainer.innerHTML = "<strong>排除 / 降权规则</strong><span>用于复核推荐理由和优先级，不是展示标签。</span>";
  ruleGrid.parentElement?.insertBefore(explainer, ruleGrid);
}

function foldRawDueDateField() {
  const detailPanel = document.querySelector<HTMLElement>(".detail-panel");
  if (!detailPanel) return;

  const labels = Array.from(detailPanel.querySelectorAll<HTMLLabelElement>("label.field"));
  for (const label of labels) {
    const title = label.querySelector("span")?.textContent?.trim();
    if (title !== "Due Date") continue;

    label.dataset.rawDueDateField = "hidden";
    const section = label.closest(".form-section") as HTMLElement | null;
    addFollowUpReminderNote(section ?? label.parentElement);
  }
}

function addFollowUpReminderNote(container: Element | null) {
  if (!container || container.querySelector(".followup-reminder-note")) return;

  const note = document.createElement("div");
  note.className = "followup-reminder-note";
  note.innerHTML = "<strong>跟进提醒</strong><span>下次跟进日统一在“日历”里设置；只有主动加入日历的 Lead 才会显示提醒。</span>";
  container.appendChild(note);
}

function normalizeRuleLabel(value: string) {
  return value.trim().replace(/（(?:排除|降权)）$/, "");
}
