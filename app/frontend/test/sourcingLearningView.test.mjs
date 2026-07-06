import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildSourcingLearningView } from "../src/sourcingLearningView.ts";

function report(overrides = {}) {
  return {
    generated_at: "2026-07-06T10:00:00.000Z",
    cohort: {
      total_active: 8,
      by_bucket: { "未处理": 2, "待评测": 2, "测试中": 1, "观察池": 1, "跟进中": 1, "推进池": 1 }
    },
    events: {
      total: 12,
      by_action: { drop: 3, evaluation_update: 4, follow: 2, push: 1 }
    },
    outcomes: {
      positive: 3,
      negative: 2,
      intermediate: 5,
      pending: 2
    },
    grade_distribution: { A: 2, "C-": 1, "B+": 1 },
    drop_reasons: [
      { reason: "画面完成度不足", count: 3 },
      { reason: "已有中国合作伙伴", count: 2 },
      { reason: "玩法粗糙", count: 1 }
    ],
    funnel: [
      { bucket: "未处理", count: 2 },
      { bucket: "待评测", count: 2 },
      { bucket: "测试中", count: 1 },
      { bucket: "观察池", count: 1 },
      { bucket: "跟进中", count: 1 },
      { bucket: "推进池", count: 1 },
      { bucket: "淘汰池", count: 4 }
    ],
    signal_summary: {
      by_region: {
        "中国": { total: 4, positive: 3, negative: 1, positive_rate: 0.75, negative_rate: 0.25 },
        "海外": { total: 2, positive: 0, negative: 2, positive_rate: 0, negative_rate: 1 }
      },
      by_gameplay: {
        "Deckbuilder": { total: 3, positive: 2, negative: 1, positive_rate: 0.6667, negative_rate: 0.3333 },
        "叙事解谜": { total: 2, positive: 0, negative: 2, positive_rate: 0, negative_rate: 1 }
      },
      by_progress: {
        "试玩 Demo": { total: 4, positive: 3, negative: 1, positive_rate: 0.75, negative_rate: 0.25 },
        "已发售": { total: 1, positive: 0, negative: 1, positive_rate: 0, negative_rate: 1 }
      }
    },
    recommendations_ready: false,
    learning_note: "当前明确结果样本 5 个，少于 30 个时只展示漏斗和样本积累，不输出强结论。",
    ...overrides
  };
}

describe("buildSourcingLearningView", () => {
  it("marks low-sample reports as accumulation and ranks review evidence without strong conclusions", () => {
    const view = buildSourcingLearningView(report());

    assert.equal(view.sampleStatus.resolvedSamples, 5);
    assert.equal(view.sampleStatus.threshold, 30);
    assert.equal(view.sampleStatus.ready, false);
    assert.match(view.sampleStatus.label, /样本积累中/);
    assert.doesNotMatch(view.sampleStatus.helper, /结论|权重推荐/);

    assert.deepEqual(view.outcomeCards.map((item) => item.key), ["positive", "negative", "intermediate", "pending"]);
    assert.equal(view.positiveSamples.value, 3);
    assert.equal(view.negativeSamples.value, 2);
    assert.deepEqual(view.gradeItems.map((item) => item.label), ["A", "B+", "C-"]);
    assert.deepEqual(view.dropReasonItems.map((item) => item.label), ["画面完成度不足", "已有中国合作伙伴", "玩法粗糙"]);
    assert.equal(view.signalSections.length, 3);
    assert.equal(view.signalSections[0].label, "地区信号");
    assert.equal(view.signalSections[0].items[0].label, "中国");
    assert.match(view.signalSections[0].items[0].summary, /正向 3/);
  });

  it("marks reports with at least 30 resolved samples as directional review ready", () => {
    const view = buildSourcingLearningView(report({
      outcomes: { positive: 18, negative: 12, intermediate: 4, pending: 1 },
      recommendations_ready: true,
      learning_note: "已有 30 个明确结果样本，可以开始输出方向性权重建议。"
    }));

    assert.equal(view.sampleStatus.resolvedSamples, 30);
    assert.equal(view.sampleStatus.ready, true);
    assert.match(view.sampleStatus.label, /可做方向性复盘/);
    assert.match(view.sampleStatus.helper, /方向性复盘/);
  });

  it("keeps empty reports readable and avoids throwing on missing signal summaries", () => {
    const view = buildSourcingLearningView(report({
      outcomes: { positive: 0, negative: 0, intermediate: 0, pending: 0 },
      grade_distribution: {},
      drop_reasons: [],
      signal_summary: undefined,
      learning_note: ""
    }));

    assert.equal(view.sampleStatus.resolvedSamples, 0);
    assert.match(view.sampleStatus.label, /样本积累中/);
    assert.deepEqual(view.gradeItems, []);
    assert.deepEqual(view.dropReasonItems, []);
    assert.ok(view.emptyHints.some((item) => item.includes("继续积累样本")));
    assert.ok(view.signalSections.every((section) => section.items.length === 0));
  });
});
