import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildQuickActionSpecs, reviewPatchForBucket, stageFromBucket } from "../src/features/leads/leadWorkflow.ts";

function lead(overrides = {}) {
  return {
    id: "lead-1",
    project: "Demo Game",
    steam_app_id: null,
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
    drop_reason: null,
    priority_reason: null,
    rule_fit: null,
    genre: "Card",
    gameplay: "Deckbuilder",
    progress: "试玩 Demo",
    release_window: null,
    early_access: false,
    narrative_heavy: false,
    india_team: false,
    publisher_status: "自研自发",
    publisher_name: null,
    china_capability_occupied: false,
    traction_summary: null,
    public_signals: null,
    contact: null,
    contact_methods: [],
    links: [],
    exposure_trail: null,
    bilibili_fit: "适合视频传播",
    amplification: "可通过实机内容放大",
    risks: null,
    verdict: "待判断",
    evaluation_grade: null,
    evaluation_result: null,
    evaluated_at: null,
    next_action: null,
    owner: null,
    due_date: null,
    calendar_enabled: false,
    follow_up_interval: null,
    first_seen: "2026-07-04",
    notes: null,
    ...overrides
  };
}

describe("lead workflow helpers", () => {
  it("maps CRM buckets to stable workflow stages", () => {
    assert.equal(stageFromBucket("未处理"), "new");
    assert.equal(stageFromBucket("待评测"), "watch");
    assert.equal(stageFromBucket("观察池"), "watch");
    assert.equal(stageFromBucket("测试中"), "active");
    assert.equal(stageFromBucket("跟进中"), "active");
    assert.equal(stageFromBucket("推进池"), "negotiating");
    assert.equal(stageFromBucket("淘汰池"), "rejected");
  });

  it("builds deterministic review patches and a 14 day testing due date", () => {
    const now = new Date("2026-07-04T10:30:00+08:00");

    assert.deepEqual(reviewPatchForBucket("未处理", now), { review_status: "未处理", reviewed_at: null });
    assert.deepEqual(reviewPatchForBucket("待评测", now), { review_status: "已查看", reviewed_at: now.toISOString() });
    assert.deepEqual(reviewPatchForBucket("观察池", now), { review_status: "已查看", reviewed_at: now.toISOString() });
    assert.deepEqual(reviewPatchForBucket("跟进中", now), { review_status: "跟进中", reviewed_at: now.toISOString() });
    assert.deepEqual(reviewPatchForBucket("推进池", now), { review_status: "跟进中", reviewed_at: now.toISOString() });
    assert.deepEqual(reviewPatchForBucket("淘汰池", now), { review_status: "已淘汰", reviewed_at: now.toISOString() });
    assert.deepEqual(reviewPatchForBucket("测试中", now), {
      review_status: "跟进中",
      reviewed_at: now.toISOString(),
      due_date: "2026-07-18",
      calendar_enabled: true
    });
  });

  it("keeps quick action options stable across review buckets", () => {
    const now = new Date("2026-07-04T10:30:00+08:00");

    assert.deepEqual(buildQuickActionSpecs(lead(), { now }).map((spec) => spec.key), ["evaluate", "watch", "drop"]);
    assert.deepEqual(buildQuickActionSpecs(lead({ bucket: "待评测", review_status: "已查看" }), { now }).map((spec) => spec.key), ["testing", "watch", "drop"]);
    assert.deepEqual(buildQuickActionSpecs(lead({ bucket: "测试中", review_status: "跟进中" }), { now }).map((spec) => spec.key), ["follow", "watch", "drop"]);
    assert.deepEqual(buildQuickActionSpecs(lead({ bucket: "观察池", review_status: "已查看" }), { now }).map((spec) => spec.key), ["evaluate", "follow", "drop"]);
    assert.deepEqual(buildQuickActionSpecs(lead({ bucket: "淘汰池", review_status: "已淘汰" }), { now }).map((spec) => spec.key), ["watch", "evaluate"]);
    assert.deepEqual(buildQuickActionSpecs(lead({ bucket: "未处理", review_status: "已查看" }), { missingLinksMode: true, now }).map((spec) => spec.key), ["evaluate", "follow", "watch", "drop"]);
  });

  it("builds action patches from the pure workflow helper", () => {
    const now = new Date("2026-07-04T10:30:00+08:00");
    const specs = buildQuickActionSpecs(lead({ bucket: "待评测", review_status: "已查看" }), { now });
    const testing = specs.find((spec) => spec.key === "testing");

    assert.ok(testing);
    assert.deepEqual(testing.patch, {
      bucket: "测试中",
      stage: "active",
      review_status: "跟进中",
      reviewed_at: now.toISOString(),
      due_date: "2026-07-18",
      calendar_enabled: true
    });
  });
});
