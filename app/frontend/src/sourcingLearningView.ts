import type { SourcingLearningReport, SourcingLearningSignalStats, SourcingPrecisionCohortKey, SourcingPrecisionStats } from "./types";

type OutcomeKey = "positive" | "negative" | "intermediate" | "pending";
type Tone = "pass" | "fail" | "warn" | "unknown";

export type LearningViewMetric = {
  key: OutcomeKey;
  label: string;
  value: number;
  helper: string;
  tone: Tone;
};

export type LearningViewListItem = {
  label: string;
  count: number;
  helper?: string;
};

export type LearningSignalItem = {
  label: string;
  total: number;
  positive: number;
  negative: number;
  positiveRate: number;
  negativeRate: number;
  summary: string;
  tone: Tone;
};

export type LearningSignalSection = {
  key: "region" | "gameplay" | "progress";
  label: string;
  items: LearningSignalItem[];
};

export type LearningCohortItem = {
  key: SourcingPrecisionCohortKey;
  label: string;
  resolvedSamples: number;
  excludedSamples: number;
  positive: number;
  negative: number;
  precisionLabel: string;
  provisional: boolean;
  helper: string;
  tone: Tone;
};

export type SourcingLearningView = {
  sampleStatus: {
    ready: boolean;
    resolvedSamples: number;
    threshold: number;
    label: string;
    helper: string;
  };
  outcomeCards: LearningViewMetric[];
  positiveSamples: LearningViewMetric;
  negativeSamples: LearningViewMetric;
  gradeItems: LearningViewListItem[];
  dropReasonItems: LearningViewListItem[];
  cohortItems: LearningCohortItem[];
  signalSections: LearningSignalSection[];
  emptyHints: string[];
};

const sampleThreshold = 30;
const gradeOrder = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"];
const cohortOrder: { key: SourcingPrecisionCohortKey; label: string }[] = [
  { key: "regular", label: "常规 Sourcing" },
  { key: "ea_mobile_high_traction", label: "EA 高热" },
  { key: "china_heat_ops", label: "中文热度" },
  { key: "initial_backfill", label: "initial_backfill" },
  { key: "unclassified", label: "未分类旧样本" }
];

export function buildSourcingLearningView(report: SourcingLearningReport): SourcingLearningView {
  const regular = report.precision.cohorts.regular;
  const resolvedSamples = regular.resolved_samples;
  const ready = !regular.provisional;
  const outcomeCards: LearningViewMetric[] = [
    { key: "positive", label: "正向样本", value: report.outcomes.positive, helper: "待评测/测试/跟进/推进或 B+ 以上", tone: "pass" },
    { key: "negative", label: "负向样本", value: report.outcomes.negative, helper: "淘汰或 C+ 以下", tone: "fail" },
    { key: "intermediate", label: "观察样本", value: report.outcomes.intermediate, helper: "观察中，不进入精度分母", tone: "warn" },
    { key: "pending", label: "待定样本", value: report.outcomes.pending, helper: "未处理/未完成评测，不进入分母", tone: "unknown" }
  ];

  const cohortItems = cohortOrder.map(({ key, label }) => buildCohortItem(key, label, report.precision.cohorts[key]));

  const gradeItems = Object.entries(report.grade_distribution)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => gradeRank(a.label) - gradeRank(b.label) || b.count - a.count || a.label.localeCompare(b.label, "zh-CN"))
    .slice(0, 8);

  const dropReasonItems = report.drop_reasons
    .map((item) => ({ label: item.reason, count: item.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"))
    .slice(0, 6);

  const signalSections: LearningSignalSection[] = [
    buildSignalSection("region", "地区信号", report.signal_summary?.by_region ?? {}),
    buildSignalSection("gameplay", "玩法信号", report.signal_summary?.by_gameplay ?? {}),
    buildSignalSection("progress", "进度信号", report.signal_summary?.by_progress ?? {})
  ];

  return {
    sampleStatus: {
      ready,
      resolvedSamples,
      threshold: report.precision.minimum_resolved_samples ?? sampleThreshold,
      label: sampleStatusLabel(regular),
      helper: sampleStatusHelper(regular, report.precision.minimum_resolved_samples ?? sampleThreshold)
    },
    outcomeCards,
    positiveSamples: outcomeCards[0],
    negativeSamples: outcomeCards[1],
    gradeItems,
    dropReasonItems,
    cohortItems,
    signalSections,
    emptyHints: buildEmptyHints({ gradeItems, dropReasonItems, signalSections })
  };
}

function buildCohortItem(key: SourcingPrecisionCohortKey, label: string, stats: SourcingPrecisionStats): LearningCohortItem {
  return {
    key,
    label,
    resolvedSamples: stats.resolved_samples,
    excludedSamples: stats.excluded_samples,
    positive: stats.positive,
    negative: stats.negative,
    precisionLabel: formatPrecision(stats.precision),
    provisional: stats.provisional,
    helper: cohortHelper(key, stats),
    tone: cohortTone(stats)
  };
}

function sampleStatusLabel(regular: SourcingPrecisionStats) {
  if (regular.provisional) return "常规通道 provisional";
  if (regular.status === "below_target") return "常规通道需收紧误判规则";
  return "常规通道精度达标";
}

function sampleStatusHelper(regular: SourcingPrecisionStats, threshold: number) {
  if (regular.provisional) {
    return `常规通道已解决 ${regular.resolved_samples}/${threshold}，provisional；继续积累，不自动修改生产规则。`;
  }
  if (regular.status === "below_target") {
    return `常规通道精度 ${formatPrecision(regular.precision)}，低于 ${formatPrecision(regular.target)}；定位并收紧误判规则，不使用数量控制。`;
  }
  return `常规通道精度 ${formatPrecision(regular.precision)}，达到 ${formatPrecision(regular.target)} 目标；继续监测且不自动修改生产规则。`;
}

function cohortHelper(key: SourcingPrecisionCohortKey, stats: SourcingPrecisionStats) {
  const base = `已解决 ${stats.resolved_samples} · 正向 ${stats.positive} · 负向 ${stats.negative} · 排除 ${stats.excluded_samples}`;
  if (key === "regular" && stats.status === "below_target") return `${base} · 收紧误判规则，不使用数量控制`;
  if (stats.provisional) return `${base} · provisional`;
  if (key === "regular") return `${base} · 80% 目标${stats.target_met ? "达标" : "未达标"}`;
  return `${base} · 独立观察`;
}

function cohortTone(stats: SourcingPrecisionStats): Tone {
  if (stats.status === "below_target") return "fail";
  if (stats.status === "meets_target") return "pass";
  if (stats.provisional) return "warn";
  return "unknown";
}

function formatPrecision(value: number | null) {
  return value === null ? "—" : `${Number((value * 100).toFixed(2))}%`;
}

function buildSignalSection(
  key: LearningSignalSection["key"],
  label: string,
  values: Record<string, SourcingLearningSignalStats>
): LearningSignalSection {
  return {
    key,
    label,
    items: Object.entries(values)
      .map(([signalLabel, stats]) => ({
        label: signalLabel,
        total: stats.total,
        positive: stats.positive,
        negative: stats.negative,
        positiveRate: stats.positive_rate,
        negativeRate: stats.negative_rate,
        summary: `样本 ${stats.total} · 正向 ${stats.positive} · 负向 ${stats.negative}`,
        tone: signalTone(stats)
      }))
      .sort((a, b) => b.total - a.total || b.positive - a.positive || b.negative - a.negative || a.label.localeCompare(b.label, "zh-CN"))
      .slice(0, 5)
  };
}

function signalTone(stats: SourcingLearningSignalStats): Tone {
  if (stats.negative > stats.positive && stats.negative > 0) return "fail";
  if (stats.positive > stats.negative && stats.positive > 0) return "pass";
  return "unknown";
}

function gradeRank(grade: string) {
  const index = gradeOrder.indexOf(grade);
  return index === -1 ? gradeOrder.length : index;
}

function buildEmptyHints({ dropReasonItems, gradeItems, signalSections }: {
  dropReasonItems: LearningViewListItem[];
  gradeItems: LearningViewListItem[];
  signalSections: LearningSignalSection[];
}) {
  const hints: string[] = [];
  if (!gradeItems.length) hints.push("继续积累样本：完成评测评级后这里会显示评分分布。");
  if (!dropReasonItems.length) hints.push("继续积累样本：淘汰时补充原因，后续才能复盘噪音来源。");
  if (signalSections.every((section) => section.items.length === 0)) hints.push("继续积累样本：人工决策事件会形成地区、玩法和进度信号复盘。");
  return hints;
}
