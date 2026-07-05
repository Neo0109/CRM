import {
  isDailyReport as canonicalIsDailyReport,
  leadKeys as canonicalLeadKeys,
  leadsFromReport as canonicalLeadsFromReport,
  mergeIncomingLeadSet as canonicalMergeIncomingLeadSet,
  mergeLead as canonicalMergeLead,
  normalizeLead as canonicalNormalizeLead,
  toCsv as canonicalToCsv,
  type Bucket,
  type ContactMethod,
  type ContactType,
  type DailyReport,
  type EvaluationGrade,
  type ImportStats,
  type Lead,
  type MergeIncomingLeadSetResult,
  type NormalizeLeadOptions,
  type Priority,
  type Region,
  type RegionPriority,
  type ReviewStatus,
  type Stage
} from "../../../../functions/_lib/leadModel.js";

export type BackendBucket = Bucket;
export type BackendStage = Stage;
export type BackendPriority = Priority;
export type BackendRegionPriority = RegionPriority;
export type BackendRegion = Region;
export type BackendReviewStatus = ReviewStatus;
export type BackendContactType = ContactType;
export type BackendEvaluationGrade = EvaluationGrade;
export type BackendContactMethod = ContactMethod;
export type BackendLead = Lead;
export type BackendDailyReport = DailyReport;
export type BackendNormalizeLeadOptions = NormalizeLeadOptions;
export type BackendImportStats = ImportStats;
export type BackendMergeIncomingLeadsResult = MergeIncomingLeadSetResult;

export const normalizeBackendLead = canonicalNormalizeLead as (
  raw: Partial<BackendLead>,
  options?: BackendNormalizeLeadOptions
) => BackendLead;

export const mergeBackendIncomingLeads = canonicalMergeIncomingLeadSet as (
  existing: BackendLead[],
  rawLeads: Partial<BackendLead>[],
  options?: BackendNormalizeLeadOptions
) => BackendMergeIncomingLeadsResult;

export const mergeBackendLead = canonicalMergeLead as (
  current: BackendLead,
  incoming: BackendLead
) => BackendLead;

export const backendLeadKeys = canonicalLeadKeys as (lead: BackendLead) => string[];

export const backendLeadsFromReport = canonicalLeadsFromReport as (
  report: BackendDailyReport
) => Partial<BackendLead>[];

export const isBackendDailyReport = canonicalIsDailyReport as (
  value: unknown
) => value is BackendDailyReport;

export const backendToCsv = canonicalToCsv as (leads: BackendLead[]) => string;

export function isBackendSystemLeadRow(row: { id?: string | null; data?: (Partial<BackendLead> & { type?: string }) | null }) {
  return Boolean(
    row.id?.startsWith("__crm_")
      || row.data?.id?.startsWith("__crm_")
      || row.data?.type === "sourcing_decision_event"
  );
}
