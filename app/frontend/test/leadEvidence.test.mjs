import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildLeadEvidence } from "../src/leadEvidence.ts";

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
    next_action: null,
    owner: null,
    due_date: null,
    calendar_enabled: false,
    follow_up_interval: null,
    first_seen: "2026-06-03",
    notes: null,
    ...overrides
  };
}

describe("buildLeadEvidence", () => {
  it("marks official Steam leads with contact as complete evidence", () => {
    const evidence = buildLeadEvidence(lead({
      steam_app_id: "2921670",
      contact_methods: [
        { type: "官网", value: "https://demo.example.com" },
        { type: "Email", value: "bd@demo.example.com" }
      ],
      links: ["https://store.steampowered.com/app/2921670/Demo_Game/"],
      exposure_trail: "B站官方号发布 Demo PV，开发者主页同步 Steam 商店。"
    }), new Date("2026-06-06T00:00:00+08:00"));

    assert.equal(evidence.status, "证据完整");
    assert.equal(evidence.rows.find((row) => row.label === "Steam 交叉验证")?.value.includes("试玩 Demo"), true);
  });

  it("marks Bilibili-only leads without Steam or official contact as insufficient", () => {
    const evidence = buildLeadEvidence(lead({
      contact_methods: [{ type: "B站", value: "https://www.bilibili.com/video/BV1example" }],
      links: ["https://www.bilibili.com/video/BV1example"],
      exposure_trail: "推荐 UP 视频，暂未找到官方号、Steam 或官网。"
    }), new Date("2026-06-06T00:00:00+08:00"));

    assert.equal(evidence.status, "不足以判断");
    assert.equal(evidence.flags.some((flag) => flag.label === "缺 Steam/AppID"), true);
    assert.equal(evidence.flags.some((flag) => flag.label === "缺官方触达"), true);
  });

  it("marks launched or duplicate leads as high risk", () => {
    const evidence = buildLeadEvidence(lead({
      steam_app_id: "3612130",
      progress: "正式上线",
      rule_fit: "疑似历史重复录入，Steam 页面显示已正式上线。",
      links: ["https://store.steampowered.com/app/3612130/"],
      contact_methods: [{ type: "Steam", value: "https://store.steampowered.com/app/3612130/" }]
    }), new Date("2026-06-06T00:00:00+08:00"));

    assert.equal(evidence.status, "高风险");
    assert.equal(evidence.flags.some((flag) => flag.label === "已正式上线"), true);
    assert.equal(evidence.flags.some((flag) => flag.label === "疑似重复"), true);
  });
});
