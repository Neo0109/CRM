import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildSourcingLearningView } from "../src/sourcingLearningView.ts";

function precisionStats(overrides = {}) {
  return {
    sample_count: 0,
    resolved_samples: 0,
    excluded_samples: 0,
    positive: 0,
    negative: 0,
    precision: null,
    target: null,
    provisional: true,
    target_met: null,
    status: "provisional",
    recommended_action: "collect_more_resolved_samples",
    automatic_rule_changes_allowed: false,
    ...overrides
  };
}

function report(overrides = {}) {
  const base = {
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
    precision: {
      target: 0.8,
      minimum_resolved_samples: 30,
      denominator: {
        included_outcomes: ["positive", "negative"],
        excluded_outcomes: ["intermediate", "pending"],
        excluded_states: ["未处理", "观察中", "未完成评测"]
      },
      cohorts: {
        regular: precisionStats({ sample_count: 7, resolved_samples: 5, excluded_samples: 2, positive: 3, negative: 2, precision: 0.6, target: 0.8 }),
        ea_mobile_high_traction: precisionStats({ sample_count: 2, resolved_samples: 1, excluded_samples: 1, positive: 1, precision: 1 }),
        china_heat_ops: precisionStats({ sample_count: 1, resolved_samples: 1, negative: 1, precision: 0 }),
        initial_backfill: precisionStats({ sample_count: 2, resolved_samples: 1, excluded_samples: 1, positive: 1, precision: 1 }),
        unclassified: precisionStats()
      },
      regular_by_rule_version: {},
      guardrails: {
        automatic_rule_changes_allowed: false,
        below_target_action: "tighten_misclassification_rules",
        forbidden_quantity_controls: ["daily_recommendation_cap", "minimum_recommendation_count", "qualified_lead_truncation", "backfill"]
      }
    },
    recommendations_ready: false,
    learning_note: "常规通道已解决样本 5 个，少于 30 个，结果为 provisional。"
  };
  return {
    ...base,
    ...overrides,
    precision: {
      ...base.precision,
      ...overrides.precision,
      cohorts: {
        ...base.precision.cohorts,
        ...overrides.precision?.cohorts
      }
    }
  };
}

describe("buildSourcingLearningView", () => {
  it("marks low-sample reports as accumulation and ranks review evidence without strong conclusions", () => {
    const view = buildSourcingLearningView(report());

    assert.equal(view.sampleStatus.resolvedSamples, 5);
    assert.equal(view.sampleStatus.threshold, 30);
    assert.equal(view.sampleStatus.ready, false);
    assert.match(view.sampleStatus.label, /provisional/);
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
    assert.deepEqual(view.cohortItems.map((item) => item.key), ["regular", "ea_mobile_high_traction", "china_heat_ops", "initial_backfill", "unclassified"]);
    assert.equal(view.cohortItems[0].label, "常规 Sourcing");
    assert.equal(view.cohortItems[0].precisionLabel, "60%");
    assert.equal(view.cohortItems[0].provisional, true);
    assert.equal(view.cohortItems[3].label, "initial_backfill");
  });

  it("marks reports with at least 30 resolved samples as directional review ready", () => {
    const view = buildSourcingLearningView(report({
      outcomes: { positive: 18, negative: 12, intermediate: 4, pending: 1 },
      precision: {
        cohorts: {
          regular: precisionStats({
            sample_count: 35,
            resolved_samples: 30,
            excluded_samples: 5,
            positive: 24,
            negative: 6,
            precision: 0.8,
            target: 0.8,
            provisional: false,
            target_met: true,
            status: "meets_target",
            recommended_action: "monitor"
          })
        }
      },
      recommendations_ready: true,
      learning_note: "常规通道精度达到目标。"
    }));

    assert.equal(view.sampleStatus.resolvedSamples, 30);
    assert.equal(view.sampleStatus.ready, true);
    assert.match(view.sampleStatus.label, /精度达标/);
    assert.match(view.sampleStatus.helper, /80%/);
  });

  it("tells reviewers to tighten misclassification rules when a mature regular cohort misses target", () => {
    const view = buildSourcingLearningView(report({
      precision: {
        cohorts: {
          regular: precisionStats({
            sample_count: 34,
            resolved_samples: 30,
            excluded_samples: 4,
            positive: 23,
            negative: 7,
            precision: 0.7667,
            target: 0.8,
            provisional: false,
            target_met: false,
            status: "below_target",
            recommended_action: "tighten_misclassification_rules"
          })
        }
      }
    }));

    assert.equal(view.sampleStatus.ready, true);
    assert.match(view.sampleStatus.label, /收紧误判规则/);
    assert.match(view.sampleStatus.helper, /不使用数量控制/);
    assert.equal(view.cohortItems[0].tone, "fail");
  });

  it("keeps empty reports readable and avoids throwing on missing signal summaries", () => {
    const view = buildSourcingLearningView(report({
      outcomes: { positive: 0, negative: 0, intermediate: 0, pending: 0 },
      precision: {
        cohorts: {
          regular: precisionStats()
        }
      },
      grade_distribution: {},
      drop_reasons: [],
      signal_summary: undefined,
      learning_note: ""
    }));

    assert.equal(view.sampleStatus.resolvedSamples, 0);
    assert.match(view.sampleStatus.label, /provisional/);
    assert.deepEqual(view.gradeItems, []);
    assert.deepEqual(view.dropReasonItems, []);
    assert.ok(view.emptyHints.some((item) => item.includes("继续积累样本")));
    assert.ok(view.signalSections.every((section) => section.items.length === 0));
  });
});
