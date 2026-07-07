import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildLeadReviewChecklist } from "../src/features/leads/leadReviewChecklist.ts";

function lead(overrides = {}) {
  return {
    id: "lead-1",
    project: "Lunar Garden",
    steam_app_id: null,
    team: "Lunar Studio",
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
    priority_reason: "玩法有传播点",
    rule_fit: "缺少 Steam/SteamDB 链接，需要补充可验证页面",
    genre: "Adventure",
    gameplay: "Exploration",
    progress: "Demo",
    release_window: null,
    early_access: false,
    narrative_heavy: false,
    india_team: false,
    publisher_status: "待确认发行结构",
    publisher_name: null,
    china_capability_occupied: false,
    traction_summary: null,
    public_signals: null,
    contact: null,
    contact_methods: [],
    links: [],
    exposure_trail: null,
    bilibili_fit: "适合内容传播",
    amplification: "可通过实机放大",
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
    first_seen: "2026-07-07",
    notes: null,
    ...overrides
  };
}

describe("lead review checklist", () => {
  it("summarizes assistant review gaps from existing lead fields", () => {
    const checklist = buildLeadReviewChecklist(lead());

    assert.deepEqual(checklist.map((item) => item.key), [
      "missing-game-link",
      "missing-contact",
      "publisher-review",
      "missing-owner",
      "missing-next-action",
      "missing-due-date"
    ]);
    assert.ok(checklist.some((item) => item.label === "补 Steam/官网主体链接"));
    assert.ok(checklist.some((item) => item.label === "补可触达联系方式"));
    assert.ok(checklist.some((item) => item.label === "复核发行结构"));
  });

  it("returns a stable ready item when the assistant-imported lead is already complete enough", () => {
    const checklist = buildLeadReviewChecklist(lead({
      steam_app_id: "444444",
      links: ["https://store.steampowered.com/app/444444/"],
      contact_methods: [{ type: "Email", value: "bd@lunar.example" }],
      publisher_status: "自研自发",
      owner: "Neo",
      next_action: "评估 Demo 质量后决定是否推进",
      due_date: "2026-07-14"
    }));

    assert.deepEqual(checklist, [{
      key: "ready",
      label: "可进入常规优先级复核",
      detail: "基础链接、联系方式和跟进字段相对完整，重点判断优先级和是否推进。"
    }]);
  });
});
