import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildFollowUpQueue } from "../src/followUpQueue.ts";

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
    bucket: "跟进中",
    stage: "active",
    priority: "P1",
    review_status: "跟进中",
    reviewed_at: null,
    drop_reason: null,
    priority_reason: null,
    rule_fit: null,
    genre: "Card/Deckbuilder",
    gameplay: "Card/Deckbuilder",
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
    next_action: "推进商务",
    owner: "Neo",
    due_date: "2026-07-20",
    calendar_enabled: true,
    follow_up_interval: null,
    first_seen: "2026-07-01",
    notes: null,
    ...overrides
  };
}

function reasonKeys(item) {
  return item.reasons.map((reason) => reason.key);
}

describe("buildFollowUpQueue", () => {
  it("builds a weekly work queue with stable follow-up reasons", () => {
    const queue = buildFollowUpQueue([
      lead({ id: "overdue", project: "Overdue Test", bucket: "测试中", due_date: "2026-07-01", calendar_enabled: true }),
      lead({ id: "due-soon", project: "Due Soon", bucket: "推进池", due_date: "2026-07-08", calendar_enabled: true }),
      lead({ id: "missing-action", project: "No Action", bucket: "跟进中", next_action: null, due_date: null, calendar_enabled: false }),
      lead({ id: "missing-owner", project: "No Owner", bucket: "待评测", owner: null, due_date: null, calendar_enabled: false }),
      lead({ id: "not-calendar", project: "No Calendar", bucket: "跟进中", due_date: "2026-07-10", calendar_enabled: false })
    ], { now: new Date("2026-07-06T00:00:00+08:00"), horizonDays: 7 });

    assert.equal(queue.count, 5);
    assert.deepEqual(queue.items.map((item) => item.lead.id), ["overdue", "due-soon", "not-calendar", "missing-action", "missing-owner"]);
    assert.deepEqual(reasonKeys(queue.items[0]), ["overdue"]);
    assert.deepEqual(reasonKeys(queue.items[1]), ["due-soon"]);
    assert.deepEqual(reasonKeys(queue.items[2]), ["due-soon", "not-in-calendar"]);
    assert.deepEqual(reasonKeys(queue.items[3]), ["missing-next-action"]);
    assert.deepEqual(reasonKeys(queue.items[4]), ["missing-owner"]);
  });

  it("excludes dropped, inactive, and already healthy active leads", () => {
    const queue = buildFollowUpQueue([
      lead({ id: "drop", bucket: "淘汰池", stage: "rejected", review_status: "已淘汰", due_date: "2026-07-05" }),
      lead({ id: "watch", bucket: "观察池", stage: "watch", due_date: "2026-07-08", calendar_enabled: false }),
      lead({ id: "healthy", bucket: "推进池", owner: "Neo", next_action: "等合同反馈", due_date: "2026-08-01", calendar_enabled: true })
    ], { now: new Date("2026-07-06T00:00:00+08:00"), horizonDays: 7 });

    assert.equal(queue.count, 0);
    assert.deepEqual(queue.items, []);
  });

  it("sorts overdue and near-term work before missing-field cleanup with priority as a tie-breaker", () => {
    const queue = buildFollowUpQueue([
      lead({ id: "p2-missing", bucket: "跟进中", priority: "P2", next_action: null, due_date: null }),
      lead({ id: "p0-missing", bucket: "跟进中", priority: "P0", next_action: null, due_date: null }),
      lead({ id: "due-later", bucket: "推进池", priority: "P0", due_date: "2026-07-12", calendar_enabled: true }),
      lead({ id: "due-earlier", bucket: "推进池", priority: "P3", due_date: "2026-07-07", calendar_enabled: true }),
      lead({ id: "overdue-test", bucket: "测试中", priority: "P3", due_date: "2026-07-01", calendar_enabled: true })
    ], { now: new Date("2026-07-06T00:00:00+08:00"), horizonDays: 7 });

    assert.deepEqual(queue.items.map((item) => item.lead.id), ["overdue-test", "due-earlier", "due-later", "p0-missing", "p2-missing"]);
  });
});
