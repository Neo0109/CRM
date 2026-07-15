import { buildLeadEvidence, type LeadEvidenceFlag, type LeadEvidenceTone } from "./leadEvidence";
import { buildFollowUpQueue } from "./followUpQueue";
import { priorityRank } from "./leadPriority";
import type { Bucket, Lead, ReviewStatus } from "./types";

export type EvidenceChipTone = LeadEvidenceTone;

export type EvidenceChip = {
  label: string;
  tone: EvidenceChipTone;
};

export type TriageFilter = {
  bucket?: "全部" | Bucket;
  evidenceIssues?: boolean;
  missingLinks?: boolean;
  needsAction?: boolean;
  reviewStatus?: "全部" | ReviewStatus;
};

export type BucketNavigationItem = {
  key: Bucket | "缺链接";
  label: string;
  count: number;
  tone: "unread" | "evaluation" | "testing" | "watch" | "follow" | "push" | "drop" | "missing";
  filter: TriageFilter;
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

const bucketNavigationConfig: Omit<BucketNavigationItem, "count">[] = [
  { key: "未处理", label: "未处理", tone: "unread", filter: { bucket: "未处理" } },
  { key: "待评测", label: "待评测", tone: "evaluation", filter: { bucket: "待评测" } },
  { key: "测试中", label: "测试中", tone: "testing", filter: { bucket: "测试中" } },
  { key: "观察池", label: "观察池", tone: "watch", filter: { bucket: "观察池" } },
  { key: "跟进中", label: "跟进中", tone: "follow", filter: { bucket: "跟进中" } },
  { key: "推进池", label: "推进池", tone: "push", filter: { bucket: "推进池" } },
  { key: "淘汰池", label: "淘汰池", tone: "drop", filter: { bucket: "淘汰池" } },
  { key: "缺链接", label: "缺链接", tone: "missing", filter: { missingLinks: true } }
];

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
  const followUpQueue = buildFollowUpQueue(activeLeads, { now });
  const todayLeads = activeLeads
    .filter((lead) => lead.bucket === "未处理")
    .sort(sortByTriagePriority);
  const evidenceLeads = activeLeads
    .filter((lead) => hasEvidenceIssue(lead, now))
    .sort((a, b) => evidenceIssueScore(b, now) - evidenceIssueScore(a, now) || sortByTriagePriority(a, b));
  const actionLeads = followUpQueue.items.map((item) => item.lead);

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
        title: "证据不足复核",
        description: "先看缺 Steam、缺触达、来源偏旧、已上线或疑似重复的项目。",
        count: evidenceLeads.length,
        filter: { evidenceIssues: true },
        leads: evidenceLeads.slice(0, 3),
        empty: "当前没有明显证据风险。"
      },
      {
        key: "action",
        kicker: "NEXT MOVE",
        title: "本周待办",
        description: "把逾期、7天内到期、缺下一步、缺 owner 和未加入日历的项目集中处理。",
        count: followUpQueue.count,
        filter: { needsAction: true },
        leads: actionLeads.slice(0, 3),
        empty: "当前没有需要立刻推进的待办。"
      }
    ]
  };
}

export function buildBucketNavigation(leads: Lead[]): BucketNavigationItem[] {
  return bucketNavigationConfig.map((item) => ({
    ...item,
    count: item.key === "缺链接"
      ? leads.filter(needsGameLinkTriage).length
      : leads.filter((lead) => lead.bucket === item.key).length
  }));
}

export function hasEvidenceIssue(lead: Lead, now = new Date()) {
  if (isDroppedLead(lead)) return false;
  const evidence = buildLeadEvidence(lead, now);
  return evidence.status !== "证据完整" || evidence.flags.some((flag) => flag.tone !== "complete");
}

function needsGameLinkTriage(lead: Lead) {
  if (isDroppedLead(lead)) return false;
  return !lead.links.some((link) => isGameLink(link));
}

function isGameLink(value: string) {
  return /store\.steampowered\.com\/app\/\d+|steamdb\.info\/app\/\d+|steamcommunity\.com\/app\/\d+|bilibili\.com\/video\/|space\.bilibili\.com|taptap\.cn|indienova\.com|gamespress\.com/i.test(value);
}

export function needsActionAttention(lead: Lead, now = new Date()) {
  if (isDroppedLead(lead)) return false;
  return buildFollowUpQueue([lead], { now }).count > 0;
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

function sortByTriagePriority(a: Lead, b: Lead) {
  const domesticScore = Number(b.region === "中国") - Number(a.region === "中国");
  return domesticScore || priorityRank(a.priority) - priorityRank(b.priority) || dateScore(b.first_seen) - dateScore(a.first_seen) || a.project.localeCompare(b.project, "zh-CN");
}

function dateScore(value: string | null) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
