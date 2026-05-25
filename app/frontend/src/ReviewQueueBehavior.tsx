import { useEffect } from "react";

export function ReviewQueueBehavior() {
  useEffect(() => {
    let frame = 0;

    const applyQueueVisibility = () => {
      frame = 0;
      const table = document.querySelector<HTMLTableElement>(".lead-table");
      const bucketSelect = document.querySelector<HTMLSelectElement>(".filters select");
      if (!table || !bucketSelect) return;

      const queueOnly = bucketSelect.value === "全部";
      const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
      let firstVisibleRow: HTMLTableRowElement | null = null;
      let selectedRowHidden = false;

      for (const row of rows) {
        if (!row.querySelector(".project-cell")) {
          row.hidden = false;
          continue;
        }

        const isUnhandled = row.textContent?.includes("未处理") ?? false;
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
