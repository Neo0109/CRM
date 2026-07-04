import { hasEvidenceIssue, needsActionAttention } from "../../leadTriage";
import type { Bucket, Lead, Region, ReviewStatus, Stage } from "../../types";
import { needsGameLinkTriage } from "./leadLinks";

export type LeadFilters = {
  query: string;
  bucket: "全部" | Bucket;
  region: "全部" | Region;
  stage: "全部" | Stage;
  owner: string;
  city: string;
  releaseWindow: string;
  reviewStatus: "全部" | ReviewStatus;
  evidenceIssues: boolean;
  missingLinks: boolean;
  needsAction: boolean;
};

export type DashboardStats = {
  total: number;
  unread: number;
  evaluation: number;
  testing: number;
  push: number;
  follow: number;
  watch: number;
  drop: number;
  missingLinks: number;
};

export const emptyLeadFilters: LeadFilters = {
  query: "",
  bucket: "全部",
  region: "全部",
  stage: "全部",
  owner: "",
  city: "",
  releaseWindow: "",
  reviewStatus: "全部",
  evidenceIssues: false,
  missingLinks: false,
  needsAction: false
};

export function filterLeads(leads: Lead[], filters: LeadFilters, now = new Date()) {
  return leads.filter((lead) => {
    const contacts = lead.contact_methods.map((method) => `${method.type} ${method.value} ${method.note ?? ""}`).join(" ");
    const haystack = [
      lead.project,
      lead.team,
      lead.genre,
      lead.gameplay,
      lead.progress,
      lead.publisher_status,
      lead.priority_reason,
      lead.rule_fit,
      lead.evaluation_grade,
      lead.evaluation_result,
      lead.next_action,
      lead.notes,
      lead.country,
      lead.city,
      contacts
    ].filter(Boolean).join(" ").toLowerCase();
    const queryMatch = !filters.query || haystack.includes(filters.query.toLowerCase());
    const bucketMatch = filters.bucket === "全部" || lead.bucket === filters.bucket;
    const regionMatch = filters.region === "全部" || lead.region === filters.region;
    const stageMatch = filters.stage === "全部" || lead.stage === filters.stage;
    const ownerMatch = !filters.owner || (lead.owner ?? "").toLowerCase().includes(filters.owner.toLowerCase());
    const cityMatch = !filters.city || [lead.city, lead.country].filter(Boolean).join(" ").toLowerCase().includes(filters.city.toLowerCase());
    const releaseMatch = !filters.releaseWindow || (lead.release_window ?? "").toLowerCase().includes(filters.releaseWindow.toLowerCase());
    const reviewMatch = filters.reviewStatus === "全部" || lead.review_status === filters.reviewStatus;
    const evidenceMatch = !filters.evidenceIssues || hasEvidenceIssue(lead, now);
    const missingLinkMatch = !filters.missingLinks || needsGameLinkTriage(lead);
    const actionMatch = !filters.needsAction || needsActionAttention(lead, now);
    return queryMatch && bucketMatch && regionMatch && stageMatch && ownerMatch && cityMatch && releaseMatch && reviewMatch && evidenceMatch && missingLinkMatch && actionMatch;
  });
}

export function buildDashboardStats(leads: Lead[]): DashboardStats {
  return {
    total: leads.length,
    unread: leads.filter((lead) => lead.bucket === "未处理" || lead.review_status === "未处理").length,
    evaluation: leads.filter((lead) => lead.bucket === "待评测").length,
    testing: leads.filter((lead) => lead.bucket === "测试中").length,
    push: leads.filter((lead) => lead.bucket === "推进池").length,
    follow: leads.filter((lead) => lead.bucket === "跟进中").length,
    watch: leads.filter((lead) => lead.bucket === "观察池").length,
    drop: leads.filter((lead) => lead.bucket === "淘汰池").length,
    missingLinks: leads.filter(needsGameLinkTriage).length
  };
}
