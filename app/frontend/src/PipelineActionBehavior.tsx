import { useEffect } from "react";
import { fetchLeads, updateLead } from "./api";
import type { Bucket, Lead } from "./types";

type PipelineAction = "follow" | "watch" | "drop" | "push" | "seen";

type ActionSpec = {
  action: PipelineAction;
  label: string;
  compactLabel: string;
  title: string;
  tone: "follow" | "watch" | "drop" | "push" | "seen";
};

const customHandledActions: PipelineAction[] = ["watch", "push"];

export function PipelineActionBehavior() {
  useEffect(() => {
    let frame = 0;
    let leads: Lead[] = [];
    let loadingLeads = false;

    const loadLeads = async () => {
      if (loadingLeads) return;
      loadingLeads = true;
      try {
        leads = await fetchLeads();
        scheduleApply();
      } catch {
        // Keep native app behavior if the enhancer cannot load data.
      } finally {
        loadingLeads = false;
      }
    };

    const apply = () => {
      frame = 0;
      if (!leads.length) {
        void loadLeads();
        return;
      }

      for (const block of Array.from(document.querySelectorAll<HTMLElement>(".quick-actions"))) {
        const lead = resolveLead(block, leads);
        if (!lead) continue;
        configureActionBlock(block, lead);
      }
    };

    function scheduleApply() {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    }

    const handleClick = async (event: MouseEvent) => {
      const target = event.target as Element | null;
      const button = target?.closest<HTMLButtonElement>(".quick-button[data-pipeline-action]");
      if (!button) return;

      const action = button.dataset.pipelineAction as PipelineAction | undefined;
      const leadId = button.dataset.pipelineLeadId;
      if (!action || !leadId || !customHandledActions.includes(action)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      try {
        button.disabled = true;
        const updated = await updateLead(leadId, patchForAction(action));
        leads = leads.map((lead) => lead.id === updated.id ? updated : lead);
        markActionApplied(button, updated);
        scheduleApply();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "操作保存失败");
      } finally {
        button.disabled = false;
      }
    };

    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("click", handleClick, true);
    void loadLeads();
    scheduleApply();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return null;
}

function configureActionBlock(block: HTMLElement, lead: Lead) {
  const buttons = Array.from(block.querySelectorAll<HTMLButtonElement>(".quick-button"));
  const [primary, secondary, seen] = buttons;
  const specs = actionSpecsForBucket(lead.bucket);

  configureButton(primary, lead, specs[0], block.classList.contains("compact"));
  configureButton(secondary, lead, specs[1], block.classList.contains("compact"));

  if (seen) {
    if (lead.review_status === "未处理") {
      configureButton(seen, lead, { action: "seen", label: "已看", compactLabel: "看", title: "标记已看", tone: "seen" }, block.classList.contains("compact"));
      seen.hidden = false;
    } else {
      seen.hidden = true;
    }
  }
}

function configureButton(button: HTMLButtonElement | undefined, lead: Lead, spec: ActionSpec, compact: boolean) {
  if (!button) return;
  button.hidden = false;
  button.disabled = false;
  button.dataset.pipelineAction = spec.action;
  button.dataset.pipelineLeadId = lead.id;
  button.dataset.pipelineActionLabel = compact ? spec.compactLabel : spec.label;
  button.title = spec.title;
  button.setAttribute("aria-label", spec.title);
  button.classList.remove("follow", "watch", "drop", "push", "seen");
  button.classList.add(spec.tone);

  const span = button.querySelector<HTMLSpanElement>("span");
  if (span) span.textContent = spec.label;
}

function actionSpecsForBucket(bucket: Bucket): [ActionSpec, ActionSpec] {
  if (bucket === "淘汰池") {
    return [
      { action: "follow", label: "放入跟进", compactLabel: "跟", title: "从淘汰池恢复到跟进中", tone: "follow" },
      { action: "watch", label: "放入观察", compactLabel: "观", title: "从淘汰池恢复到观察池", tone: "watch" }
    ];
  }

  if (bucket === "跟进中") {
    return [
      { action: "watch", label: "转观察", compactLabel: "观", title: "转入观察池", tone: "watch" },
      { action: "drop", label: "淘汰", compactLabel: "淘", title: "移入淘汰池", tone: "drop" }
    ];
  }

  if (bucket === "推进池") {
    return [
      { action: "follow", label: "退回跟进", compactLabel: "跟", title: "退回跟进中", tone: "follow" },
      { action: "drop", label: "淘汰", compactLabel: "淘", title: "移入淘汰池", tone: "drop" }
    ];
  }

  return [
    { action: "follow", label: "跟进", compactLabel: "跟", title: "移入跟进中", tone: "follow" },
    { action: "drop", label: "淘汰", compactLabel: "淘", title: "移入淘汰池", tone: "drop" }
  ];
}

function patchForAction(action: PipelineAction): Partial<Lead> {
  const reviewed_at = new Date().toISOString();
  if (action === "follow") return { bucket: "跟进中", stage: "active", review_status: "跟进中", reviewed_at };
  if (action === "watch") return { bucket: "观察池", stage: "watch", review_status: "已查看", reviewed_at };
  if (action === "drop") return { bucket: "淘汰池", stage: "rejected", review_status: "已淘汰", reviewed_at };
  if (action === "push") return { bucket: "推进池", stage: "active", review_status: "跟进中", reviewed_at };
  return { review_status: "已查看", reviewed_at };
}

function resolveLead(block: HTMLElement, leads: Lead[]) {
  const row = block.closest("tr");
  const project = row
    ? row.querySelector(".project-cell strong")?.textContent?.trim()
    : document.querySelector(".detail-head h2")?.textContent?.trim();
  if (!project) return null;

  const exact = leads.filter((lead) => lead.project === project);
  if (exact.length === 1) return exact[0];

  const bucketText = row
    ? row.querySelector(".project-cell small")?.textContent ?? ""
    : document.querySelector(".detail-head .eyebrow")?.textContent ?? "";
  return exact.find((lead) => bucketText.includes(lead.bucket)) ?? exact[0] ?? null;
}

function markActionApplied(button: HTMLButtonElement, updated: Lead) {
  const row = button.closest<HTMLTableRowElement>("tr");
  if (row) {
    row.dataset.pipelineMoved = updated.bucket;
    const statusLine = row.querySelector<HTMLElement>(".project-cell small");
    if (statusLine) statusLine.textContent = `${updated.priority} · ${updated.bucket} · ${updated.review_status}`;
    const activeBucketFilter = document.querySelector<HTMLSelectElement>(".filters select")?.value ?? "全部";
    if (activeBucketFilter !== "全部" && activeBucketFilter !== updated.bucket) row.hidden = true;
  }

  const detailEyebrow = document.querySelector<HTMLElement>(".detail-head .eyebrow");
  if (detailEyebrow?.textContent?.includes(updated.project) || !row) {
    detailEyebrow.textContent = `${updated.bucket} · ${updated.priority} · ${updated.review_status}`;
  }
}
