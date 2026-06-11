import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDecisionEvent,
  buildSourcingLearningReport,
  decisionEventPrefix
} from "../functions/_lib/sourcingLearning.ts";

function lead(overrides = {}) {
  return {
    id: "lead-learning-1",
    project: "Demo Game",
    steam_app_id: "123456",
    team: "Demo Studio",
    team_size: null,
    country: "中国",
    region: "中国",
    city: null,
    region_priority: "国内优先",
    bucket: "未处理",
    stage: "new",
    priority: "P1",
    review_status: "未处理",
    reviewed_at: null,
    priority_reason: "卡牌构筑玩法清晰，适合B站视频拆解。",
    rule_fit: "国内项目优先。",
    genre: "Card/Deckbuilder",
    gameplay: "Card/Deckbuilder / RPG",
    progress: "试玩 Demo",
    release_window: "2026 Q3",
    early_access: false,
    narrative_heavy: false,
    india_team: false,
    publisher_status: "自研自发",
    publisher_name: null,
    china_capability_occupied: false,
    traction_summary: null,
    public_signals: null,
    contact: null,
    contact_methods: [{ type: "B站", value: "https://space.bilibili.com/123", note: "官方号" }],
    links: ["https://store.steampowered.com/app/123456/"],
    exposure_trail: "B站官方号 Demo PV",
    bilibili_fit: "适合视频切片传播",
    amplification: "",
    risks: null,
    verdict: "",
    evaluation_grade: null,
    evaluation_result: null,
    evaluated_at: null,
    next_action: null,
    owner: null,
    due_date: null,
    calendar_enabled: false,
    follow_up_interval: null,
    first_seen: "2026-06-10",
    notes: null,
    drop_reason: null,
    ...overrides
  };
}

const actor = {
  username: "neo",
  display_name: "Neo",
  role: "admin"
};

describe("sourcing learning decision events", () => {
  it("captures evaluation grade, evaluation conclusion, drop reason, and bucket movement in one event", () => {
    const before = lead({ bucket: "测试中", stage: "active", review_status: "跟进中" });
    const after = lead({
      bucket: "淘汰池",
      stage: "rejected",
      review_status: "已淘汰",
      evaluation_grade: "C",
      evaluation_result: "实机节奏弱，核心循环不够支撑长期内容。",
      evaluated_at: "2026-06-10T10:00:00.000Z",
      drop_reason: "玩法粗糙"
    });

    const event = buildDecisionEvent(before, after, actor, "2026-06-10T10:05:00.000Z");

    assert.ok(event);
    assert.ok(event.id.startsWith(decisionEventPrefix));
    assert.equal(event.action, "drop");
    assert.deepEqual(event.changed_fields.sort(), ["bucket", "drop_reason", "evaluation_grade", "evaluation_result", "evaluated_at", "review_status", "stage"].sort());
    assert.equal(event.before.bucket, "测试中");
    assert.equal(event.after.bucket, "淘汰池");
    assert.equal(event.after.evaluation_grade, "C");
    assert.equal(event.after.evaluation_result, "实机节奏弱，核心循环不够支撑长期内容。");
    assert.equal(event.after.drop_reason, "玩法粗糙");
    assert.equal(event.snapshot.project, "Demo Game");
    assert.equal(event.snapshot.features.has_steam, true);
    assert.equal(event.snapshot.features.has_bilibili_source, true);
  });

  it("does not emit an event when no tracked learning field changed", () => {
    const before = lead({ priority_reason: "旧理由" });
    const after = lead({ priority_reason: "旧理由", notes: "只改备注" });

    assert.equal(buildDecisionEvent(before, after, actor, "2026-06-10T10:05:00.000Z"), null);
  });

  it("learns from evaluation grade and one-line evaluation even when the bucket does not change", () => {
    const before = lead({ bucket: "测试中", evaluation_grade: null, evaluation_result: null });
    const after = lead({
      bucket: "测试中",
      evaluation_grade: "A-",
      evaluation_result: "实机节奏和题材表达都适合B站内容放大，可进入商务复盘。",
      evaluated_at: "2026-06-10T12:00:00.000Z"
    });

    const event = buildDecisionEvent(before, after, actor, "2026-06-10T12:05:00.000Z");

    assert.ok(event);
    assert.equal(event.action, "evaluation_update");
    assert.deepEqual(event.changed_fields.sort(), ["evaluation_grade", "evaluation_result", "evaluated_at"].sort());

    const report = buildSourcingLearningReport([after], [event], "2026-06-10T13:00:00.000Z");
    assert.equal(report.outcomes.positive, 1);
    assert.equal(report.grade_distribution["A-"], 1);
  });
});

describe("buildSourcingLearningReport", () => {
  it("includes active non-dropped leads as the current learning cohort and excludes historical dropped leads", () => {
    const report = buildSourcingLearningReport([
      lead({ id: "unprocessed", bucket: "未处理" }),
      lead({ id: "queue", bucket: "待评测" }),
      lead({ id: "testing", bucket: "测试中" }),
      lead({ id: "watch", bucket: "观察池" }),
      lead({ id: "follow", bucket: "跟进中" }),
      lead({ id: "push", bucket: "推进池" }),
      lead({ id: "old-drop", bucket: "淘汰池", stage: "rejected", review_status: "已淘汰" })
    ], [], "2026-06-10T10:00:00.000Z");

    assert.equal(report.cohort.total_active, 6);
    assert.equal(report.cohort.by_bucket["未处理"], 1);
    assert.equal(report.cohort.by_bucket["待评测"], 1);
    assert.equal(report.cohort.by_bucket["测试中"], 1);
    assert.equal(report.cohort.by_bucket["淘汰池"] ?? 0, 0);
  });

  it("learns from rating results, final bucket movement, and drop reasons without making strong conclusions below threshold", () => {
    const positive = buildDecisionEvent(
      lead({ id: "positive", bucket: "测试中" }),
      lead({ id: "positive", bucket: "推进池", stage: "negotiating", evaluation_grade: "A", evaluation_result: "留存和内容传播潜力都不错。" }),
      actor,
      "2026-06-10T10:00:00.000Z"
    );
    const negative = buildDecisionEvent(
      lead({ id: "negative", bucket: "未处理" }),
      lead({ id: "negative", bucket: "淘汰池", stage: "rejected", review_status: "已淘汰", evaluation_grade: "C-", evaluation_result: "画面完成度不足。", drop_reason: "画面差" }),
      actor,
      "2026-06-10T11:00:00.000Z"
    );

    const report = buildSourcingLearningReport([lead({ id: "positive", bucket: "推进池" }), lead({ id: "negative", bucket: "淘汰池" })], [positive, negative].filter(Boolean), "2026-06-10T12:00:00.000Z");

    assert.equal(report.events.total, 2);
    assert.equal(report.outcomes.positive, 1);
    assert.equal(report.outcomes.negative, 1);
    assert.equal(report.grade_distribution.A, 1);
    assert.equal(report.grade_distribution["C-"], 1);
    assert.equal(report.drop_reasons.find((item) => item.reason === "画面差")?.count, 1);
    assert.equal(report.recommendations_ready, false);
    assert.match(report.learning_note, /30/);
  });

  it("prioritizes final rejection over a positive evaluation grade", () => {
    const rejectedAfterGoodTest = buildDecisionEvent(
      lead({ id: "rejected-positive-grade", bucket: "测试中" }),
      lead({
        id: "rejected-positive-grade",
        bucket: "淘汰池",
        stage: "rejected",
        review_status: "已淘汰",
        evaluation_grade: "A",
        evaluation_result: "测试表现不错，但确认已有中国合作伙伴，不能继续推进。",
        drop_reason: "有中国合作伙伴"
      }),
      actor,
      "2026-06-10T12:30:00.000Z"
    );

    const report = buildSourcingLearningReport([], [rejectedAfterGoodTest].filter(Boolean), "2026-06-10T13:00:00.000Z");

    assert.equal(report.outcomes.positive, 0);
    assert.equal(report.outcomes.negative, 1);
    assert.equal(report.grade_distribution.A, 1);
    assert.equal(report.drop_reasons.find((item) => item.reason === "有中国合作伙伴")?.count, 1);
  });
});
