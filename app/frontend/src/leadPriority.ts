import type { Priority } from "./types";

export const unlabeledPriority = "未标注" as const;

export type PrioritySelection = NonNullable<Priority> | typeof unlabeledPriority;
export type PriorityFilter = "全部" | PrioritySelection;

export const priorityValues: NonNullable<Priority>[] = ["P0", "P1", "P2", "P3"];
export const prioritySelectionOptions: PrioritySelection[] = [...priorityValues, unlabeledPriority];
export const priorityFilterOptions: PriorityFilter[] = ["全部", ...prioritySelectionOptions];

export function priorityTone(priority: Priority) {
  if (priority === null) return "unlabeled";
  if (priority === "P0" || priority === "P1") return "high";
  if (priority === "P2") return "medium";
  return "low";
}

export function priorityLabel(priority: Priority) {
  if (priority === null) return unlabeledPriority;
  if (priority === "P0" || priority === "P1") return `${priority} 高`;
  if (priority === "P2") return `${priority} 中`;
  return `${priority} 低`;
}

export function prioritySelection(priority: Priority): PrioritySelection {
  return priority ?? unlabeledPriority;
}

export function priorityFromSelection(selection: PrioritySelection): Priority {
  return selection === unlabeledPriority ? null : selection;
}

export function priorityRank(priority: Priority) {
  if (priority === null) return 4;
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[priority];
}
