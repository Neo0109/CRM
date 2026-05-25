import { useEffect } from "react";

export function ReviewQueueBehavior() {
  useEffect(() => {
    let frame = 0;

    const applyQueueVisibility = () => {
      frame = 0;
      const table = document.querySelector<HTMLTableElement>(".lead-table");
      const bucketSelect = document.querySelector<HTMLSelectElement>(".filters select");
      if (!table || !bucketSelect) return;

      const queueOnly = shouldUseDefaultReviewQueue(bucketSelect);
      const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
      let firstVisibleRow: HTMLTableRowElement | null = null;
      let selectedRowHidden = false;

      for (const row of rows) {
        const statusLine = row.querySelector(".project-cell small")?.textContent ?? "";
        if (!statusLine) {
          row.hidden = false;
          continue;
        }

        const isUnhandled = statusLine.includes("未处理");
        const shouldHide = queueOnly && !isUnhandled;
        row.hidden = shouldHide;

        if (!shouldHide && !firstVisibleRow) firstVisibleRow = row;
        if (shouldHide && row.classList.contains("selected-row")) selectedRowHidden = true;
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

  const activeMetricLabels = Array.from(document.querySelectorAll<HTMLElement>(".metric.active span"))
    .map((metric) => metric.textContent?.trim() ?? "")
    .filter(Boolean);
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
