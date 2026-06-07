import { buildLeadEvidence, type LeadEvidenceFlag, type LeadEvidenceTone } from "./leadEvidence";
import type { Bucket, Lead, ReviewStatus } from "./types";

export type EvidenceChipTone = LeadEvidenceTone;

export type EvidenceChip = {
  label: string;
  tone: EvidenceChipTone;
};

export type TriageFilter = {
  bucket?: "全部" | Bucket;
  evidenceIssues?: boolean;
  needsAction?: boolean;
  reviewStatus?: "全部" | ReviewStatus;
};

export type TriageLane = {
  key: "today" | "evidence" | "action";
  kicker: string;
  title: string;
  description: string;
  count: number;
  filter: TriageFilter;
  leads: Lead[];
  empty: string;
};

export type DecisionTriage = {
  lanes: TriageLane[];
};

const activeActionBuckets: Bucket[] = ["待评测", "测试中", "跟进中", "推进池"];

const flagLabelMap: Record<string, EvidenceChip> = {
  "已正式上线": { label: "已上线", tone: "risk" },
  "疑似重复": { label: "疑似重复", tone: "risk" },
  "来源偏旧": { label: "来源偏旧", tone: "risk" },
  "缺 Steam/AppID": { label: "缺Steam", tone: "unknown" },
  "缺官方触达": { label: "缺触达", tone: "unknown" },
  "非官方来源": { label: "非官方", tone: "review" }
};

export function buildLeadEvidenceChips(lead: Lead, now = new Date()): EvidenceChip[] {
  const evidence = buildLeadEvidence(lead, now);
  const chips: EvidenceChip[] = [];

  for (const flag of evidence.flags) {
    const mapped = mapFlagToChip(flag);
    if (mapped) chips.push(mapped);
  }

  const sourceRow = evidence.rows.find((row) => row.label === "来源链");
  const steamRow = evidence.rows.find((row) => row.label === "Steam 交叉验证");
  const contactRow = evidence.rows.find((row) => row.label === "触达完整度");

  if (sourceRow?.tone === "complete") chips.push({ label: "官方源", tone: "complete" });
  if (steamRow && steamRow.tone !== "unknown" && !chips.some((chip) => chip.label === "缺Steam")) {
    chips.push({ label: "Steam已验", tone: steamRow.tone });
  }
  if (contactRow?.tone === "complete") chips.push({ label: "可触达", tone: "complete" });

  return dedupeChips(chips);
}

export function buildDecisionTriage(leads: Lead[], now = new Date()): DecisionTriage {
  const activeLeads = leads.filter((lead) => !isDroppedLead(lead));
  const todayLeads = activeLeads
    .filter((lead) => lead.bucket === "未处理")
    .sort(sortByTriagePriority);
  const evidenceLeads = activeLeads
    .filter((lead) => hasEvidenceIssue(lead, now))
    .sort((a, b) => evidenceIssueScore(b, now) - evidenceIssueScore(a, now) || sortByTriagePriority(a, b));
  const actionLeads = activeLeads
    .filter((lead) => activeActionBuckets.includes(lead.bucket) && needsActionAttention(lead, now))
    .sort((a, b) => actionAttentionScore(b, now) - actionAttentionScore(a, now) || sortByTriagePriority(a, b));

  return {
    lanes: [
      {
        key: "today",
        kicker: "TODAY INBOX",
        title: "今日新线索",
        description: "日报新进只进未处理，先粗判：提测、观察或淘汰。",
        count: todayLeads.length,
        filter: { bucket: "未处理" },
        leads: todayLeads.slice(0, 3),
        empty: "今天没有新的未处理 lead。"
      },
      {
        key: "evidence",
        kicker: "EVIDENCE",
        title: "证据不足",
        description: "先看缺 Steam、缺触达、来源偏旧、已上线或疑似重复的项目。",
        count: evidenceLeads.length,
        filter: { evidenceIssues: true },
        leads: evidenceLeads.slice(0, 3),
        empty: "当前没有明显证据风险。"
      },
      {
        key: "action",
        kicker: "NEXT MOVE",
        title: "需要动作",
        description: "测试中、跟进中和推进池里缺下一步、缺 owner 或临近到期的项目。",
        count: actionLeads.length,
        filter: { needsAction: true },
        leads: actionLeads.slice(0, 3),
        empty: "当前没有需要立刻推进的动作。"
      }
    ]
  };
}

export function hasEvidenceIssue(lead: Lead, now = new Date()) {
  if (isDroppedLead(lead)) return false;
  const evidence = buildLeadEvidence(lead, now);
  return evidence.status !== "证据完整" || evidence.flags.some((flag) => flag.tone !== "complete");
}

export function needsActionAttention(lead: Lead, now = new Date()) {
  if (!activeActionBuckets.includes(lead.bucket) || isDroppedLead(lead)) return false;
  return isTestingOverdue(lead, now) || isDueSoon(lead.due_date, now) || !lead.next_action || !lead.owner;
}

function mapFlagToChip(flag: LeadEvidenceFlag) {
  return flagLabelMap[flag.label] ?? null;
}

function dedupeChips(chips: EvidenceChip[]) {
  const seen = new Set<string>();
  return chips.filter((chip) => {
    if (seen.has(chip.label)) return false;
    seen.add(chip.label);
    return true;
  });
}

function isDroppedLead(lead: Lead) {
  return lead.bucket === "淘汰池" || lead.review_status === "已淘汰" || lead.stage === "rejected";
}

function evidenceIssueScore(lead: Lead, now: Date) {
  const chips = buildLeadEvidenceChips(lead, now);
  return chips.reduce((score, chip) => {
    if (chip.tone === "risk") return score + 4;
    if (chip.tone === "unknown") return score + 2;
    if (chip.tone === "review") return score + 1;
    return score;
  }, 0);
}

function actionAttentionScore(lead: Lead, now: Date) {
  return Number(isTestingOverdue(lead, now)) * 5
    + Number(isDueSoon(lead.due_date, now)) * 4
    + Number(!lead.next_action) * 2
    + Number(!lead.owner);
}

function sortByTriagePriority(a: Lead, b: Lead) {
  const domesticScore = Number(b.region === "中国") - Number(a.region === "中国");
  return domesticScore || priorityScore(a.priority) - priorityScore(b.priority) || dateScore(b.first_seen) - dateScore(a.first_seen) || a.project.localeCompare(b.project, "zh-CN");
}

function priorityScore(priority: Lead["priority"]) {
  if (priority === "P0") return 0;
  if (priority === "P1") return 1;
  if (priority === "P2") return 2;
  return 3;
}

function dateScore(value: string | null) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isTestingOverdue(lead: Lead, now: Date) {
  return lead.bucket === "测试中" && Boolean(lead.due_date) && startOfShanghaiDay(lead.due_date!) < startOfShanghaiDay(now);
}

function isDueSoon(value: string | null, now: Date) {
  if (!value) return false;
  const due = startOfShanghaiDay(value);
  const today = startOfShanghaiDay(now);
  const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= 7;
}

function startOfShanghaiDay(value: string | Date) {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00+08:00`) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return new Date(`${year}-${month}-${day}T00:00:00+08:00`);
}
