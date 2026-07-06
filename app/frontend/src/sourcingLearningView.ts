import type { SourcingLearningReport, SourcingLearningSignalStats } from "./types";

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
  signalSections: LearningSignalSection[];
  emptyHints: string[];
};

const sampleThreshold = 30;
const gradeOrder = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"];

export function buildSourcingLearningView(report: SourcingLearningReport): SourcingLearningView {
  const resolvedSamples = report.outcomes.positive + report.outcomes.negative;
  const ready = resolvedSamples >= sampleThreshold || report.recommendations_ready;
  const outcomeCards: LearningViewMetric[] = [
    { key: "positive", label: "正向样本", value: report.outcomes.positive, helper: "跟进/推进或高评级", tone: "pass" },
    { key: "negative", label: "负向样本", value: report.outcomes.negative, helper: "淘汰或低评级", tone: "fail" },
    { key: "intermediate", label: "中间状态", value: report.outcomes.intermediate, helper: "待评测/测试/观察", tone: "warn" },
    { key: "pending", label: "待定样本", value: report.outcomes.pending, helper: "未形成明确结果", tone: "unknown" }
  ];

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
      threshold: sampleThreshold,
      label: ready ? "可做方向性复盘" : "样本积累中",
      helper: ready
        ? `已有 ${resolvedSamples} 个明确结果样本，可做方向性复盘。`
        : `当前明确结果样本 ${resolvedSamples}/${sampleThreshold}，先看分布和重复模式。`
    },
    outcomeCards,
    positiveSamples: outcomeCards[0],
    negativeSamples: outcomeCards[1],
    gradeItems,
    dropReasonItems,
    signalSections,
    emptyHints: buildEmptyHints({ gradeItems, dropReasonItems, signalSections })
  };
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
