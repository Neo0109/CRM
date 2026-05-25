import { useEffect } from "react";

export function ReviewQueueBehavior() {
  useEffect(() => {
    let frame = 0;
    ensureMissingLinksDetailStyle();

    const applyQueueVisibility = () => {
      frame = 0;
      const table = document.querySelector<HTMLTableElement>(".lead-table");
      const bucketSelect = document.querySelector<HTMLSelectElement>(".filters select");
      if (!table || !bucketSelect) return;

      const missingLinksOnly = isMissingLinksMetricActive();
      const queueOnly = shouldUseDefaultReviewQueue(bucketSelect);
      const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
      let firstVisibleRow: HTMLTableRowElement | null = null;
      let selectedRowHidden = false;
      let visibleMissingLinkRows = 0;

      for (const row of rows) {
        const statusLine = row.querySelector(".project-cell small")?.textContent ?? "";
        if (!statusLine) {
          row.hidden = false;
          continue;
        }

        const isUnhandled = statusLine.includes("未处理");
        const isDropped = statusLine.includes("淘汰池") || statusLine.includes("已淘汰");
        const shouldHide = (queueOnly && !isUnhandled) || (missingLinksOnly && isDropped);
        row.hidden = shouldHide;

        if (!shouldHide && !firstVisibleRow) firstVisibleRow = row;
        if (!shouldHide && missingLinksOnly) visibleMissingLinkRows += 1;
        if (shouldHide && row.classList.contains("selected-row")) selectedRowHidden = true;
      }

      if (missingLinksOnly) {
        syncActiveMetricCount(visibleMissingLinkRows);
        syncMissingLinksDetailState(visibleMissingLinkRows === 0);
      } else {
        syncMissingLinksDetailState(false);
      }

      if (selectedRowHidden && firstVisibleRow) firstVisibleRow.click();
    };

    const scheduleApply = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(applyQueueVisibility);
    };

    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("change", scheduleApply, true);
    document.addEventListener("click", scheduleApply, true);
    scheduleApply();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("change", scheduleApply, true);
      document.removeEventListener("click", scheduleApply, true);
    };
  }, []);

  return null;
}

function shouldUseDefaultReviewQueue(bucketSelect: HTMLSelectElement) {
  if (bucketSelect.value !== "全部") return false;

  const activeMetricLabels = activeMetricLabelsFromPage();
  const hasSpecialMetric = activeMetricLabels.some((label) => !label.includes("未处理"));
  if (hasSpecialMetric) return false;

  const textFiltersHaveValue = Array.from(document.querySelectorAll<HTMLInputElement>(".filters input"))
    .some((input) => input.value.trim().length > 0);
  if (textFiltersHaveValue) return false;

  const selects = Array.from(document.querySelectorAll<HTMLSelectElement>(".filters select"));
  const nonBucketFilterChanged = selects
    .filter((select) => select !== bucketSelect)
    .some((select) => select.value !== "全部");

  return !nonBucketFilterChanged;
}

function isMissingLinksMetricActive() {
  return activeMetricLabelsFromPage().some((label) => label.includes("缺链接"));
}

function activeMetricLabelsFromPage() {
  return Array.from(document.querySelectorAll<HTMLElement>(".metric.active span"))
    .map((metric) => metric.textContent?.trim() ?? "")
    .filter(Boolean);
}

function syncActiveMetricCount(value: number) {
  const activeMetric = Array.from(document.querySelectorAll<HTMLElement>(".metric.active"))
    .find((metric) => metric.querySelector("span")?.textContent?.includes("缺链接"));
  const count = activeMetric?.querySelector("strong");
  if (count) count.textContent = String(value);
}

function syncMissingLinksDetailState(empty: boolean) {
  const panel = document.querySelector<HTMLElement>(".detail-panel");
  if (!panel) return;

  const existing = panel.querySelector(".missing-links-empty-state");
  if (!empty) {
    panel.removeAttribute("data-missing-links-empty");
    existing?.remove();
    return;
  }

  panel.setAttribute("data-missing-links-empty", "true");
  if (existing) return;

  const placeholder = document.createElement("div");
  placeholder.className = "missing-links-empty-state";
  placeholder.innerHTML = "<strong>暂无缺链接 lead</strong><span>补完链接或移入淘汰池后，这里不会再显示已处理项目。</span>";
  panel.appendChild(placeholder);
}

function ensureMissingLinksDetailStyle() {
  if (document.getElementById("missing-links-empty-style")) return;

  const style = document.createElement("style");
  style.id = "missing-links-empty-style";
  style.textContent = `
    .detail-panel[data-missing-links-empty="true"] > :not(.missing-links-empty-state) {
      display: none !important;
    }

    .missing-links-empty-state {
      min-height: 240px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 8px;
      color: #53657d;
      text-align: center;
    }

    .missing-links-empty-state strong {
      color: #132238;
      font-size: 18px;
    }
  `;
  document.head.appendChild(style);
}