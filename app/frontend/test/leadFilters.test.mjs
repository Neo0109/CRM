import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildDashboardStats, emptyLeadFilters, filterLeads, hasExplicitLeadFilters, shouldUseDefaultReviewQueue } from "../src/features/leads/leadFilters.ts";

function lead(overrides = {}) {
  return {
    id: "lead-1",
    project: "Demo Game",
    steam_app_id: null,
    team: "Demo Studio",
    team_size: null,
    country: "中国",
    region: "中国",
    city: "上海",
    region_priority: "国内优先",
    bucket: "未处理",
    stage: "new",
    priority: "P1",
    review_status: "未处理",
    reviewed_at: null,
    drop_reason: null,
    priority_reason: "卡牌构筑玩法清晰",
    rule_fit: null,
    genre: "Card",
    gameplay: "Deckbuilder",
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

function filters(patch = {}) {
  return { ...emptyLeadFilters, ...patch };
}

describe("lead filters", () => {
  const now = new Date("2026-07-04T00:00:00+08:00");

  it("matches query text across project, team, notes, location, and contacts", () => {
    const leads = [
      lead({ id: "project", project: "Solar Punk" }),
      lead({ id: "contact", project: "Other", team: "Hidden Studio", contact_methods: [{ type: "Email", value: "bd@solar.example", note: "producer" }] }),
      lead({ id: "miss", project: "Ocean Game", team: "Blue Team" })
    ];

    assert.deepEqual(filterLeads(leads, filters({ query: "solar" }), now).map((item) => item.id), ["project", "contact"]);
  });

  it("applies bucket, region, stage, owner, review, city, and release window filters together", () => {
    const leads = [
      lead({ id: "match", bucket: "测试中", stage: "active", region: "中国", owner: "Neo", review_status: "跟进中", city: "上海", release_window: "2026 Q3" }),
      lead({ id: "wrong-owner", bucket: "测试中", stage: "active", region: "中国", owner: "Jojo", review_status: "跟进中", city: "上海", release_window: "2026 Q3" }),
      lead({ id: "wrong-stage", bucket: "测试中", stage: "watch", region: "中国", owner: "Neo", review_status: "跟进中", city: "上海", release_window: "2026 Q3" })
    ];

    assert.deepEqual(filterLeads(leads, filters({
      bucket: "测试中",
      stage: "active",
      region: "中国",
      owner: "neo",
      reviewStatus: "跟进中",
      city: "上海",
      releaseWindow: "q3"
    }), now).map((item) => item.id), ["match"]);
  });

  it("filters evidence issues, missing links, and action-needed leads without surfacing dropped records", () => {
    const leads = [
      lead({ id: "needs-evidence", links: [], contact_methods: [] }),
      lead({ id: "dropped-missing", bucket: "淘汰池", stage: "rejected", review_status: "已淘汰", links: [], contact_methods: [] }),
      lead({ id: "needs-action", bucket: "测试中", stage: "active", review_status: "跟进中", owner: "Neo", next_action: "等 Demo", due_date: "2026-07-05", links: ["https://store.steampowered.com/app/2921670/"] }),
      lead({ id: "clean", bucket: "推进池", stage: "negotiating", review_status: "跟进中", owner: "Neo", next_action: "推进商务", due_date: "2026-08-01", links: ["https://store.steampowered.com/app/2921671/"], contact_methods: [{ type: "Email", value: "bd@example.com" }] })
    ];

    assert.deepEqual(filterLeads(leads, filters({ evidenceIssues: true }), now).map((item) => item.id), ["needs-evidence", "needs-action"]);
    assert.deepEqual(filterLeads(leads, filters({ missingLinks: true }), now).map((item) => item.id), ["needs-evidence"]);
    assert.deepEqual(filterLeads(leads, filters({ needsAction: true }), now).map((item) => item.id), ["needs-action"]);
  });

  it("uses a default review queue only when no explicit filters are active", () => {
    const leads = [
      lead({ id: "bucket-unhandled", bucket: "未处理", review_status: "已查看" }),
      lead({ id: "review-unhandled", bucket: "待评测", review_status: "未处理" }),
      lead({ id: "active", bucket: "测试中", review_status: "跟进中" })
    ];

    assert.equal(hasExplicitLeadFilters(filters()), false);
    assert.equal(shouldUseDefaultReviewQueue(leads, filters()), true);
    assert.deepEqual(filterLeads(leads, filters(), now).map((item) => item.id), ["bucket-unhandled", "review-unhandled"]);

    assert.equal(hasExplicitLeadFilters(filters({ query: "demo" })), true);
    assert.equal(shouldUseDefaultReviewQueue(leads, filters({ query: "demo" })), false);
    assert.deepEqual(filterLeads(leads, filters({ query: "demo" }), now).map((item) => item.id), ["bucket-unhandled", "review-unhandled", "active"]);
  });

  it("shows all matching leads when the default queue has no unhandled items", () => {
    const leads = [
      lead({ id: "testing", bucket: "测试中", review_status: "跟进中" }),
      lead({ id: "push", bucket: "推进池", review_status: "跟进中" })
    ];

    assert.equal(shouldUseDefaultReviewQueue(leads, filters()), false);
    assert.deepEqual(filterLeads(leads, filters(), now).map((item) => item.id), ["testing", "push"]);
  });

  it("builds dashboard stats from the same lead model as the view", () => {
    const stats = buildDashboardStats([
      lead({ id: "unread", bucket: "未处理", review_status: "未处理" }),
      lead({ id: "evaluation", bucket: "待评测", review_status: "已查看" }),
      lead({ id: "testing", bucket: "测试中", review_status: "跟进中" }),
      lead({ id: "follow", bucket: "跟进中", review_status: "跟进中" }),
      lead({ id: "watch", bucket: "观察池", review_status: "已查看" }),
      lead({ id: "push", bucket: "推进池", review_status: "跟进中" }),
      lead({ id: "drop", bucket: "淘汰池", stage: "rejected", review_status: "已淘汰" })
    ]);

    assert.deepEqual(stats, {
      total: 7,
      unread: 1,
      evaluation: 1,
      testing: 1,
      push: 1,
      follow: 1,
      watch: 1,
      drop: 1,
      missingLinks: 6
    });
  });
});
