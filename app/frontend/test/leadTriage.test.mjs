import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildDecisionTriage, buildLeadEvidenceChips } from "../src/leadTriage.ts";

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
    first_seen: "2026-06-07",
    notes: null,
    ...overrides
  };
}

function labels(chips) {
  return chips.map((chip) => chip.label);
}

describe("buildLeadEvidenceChips", () => {
  it("shows risk chips for missing Steam, launched, duplicate, stale, and unofficial leads", () => {
    const chips = buildLeadEvidenceChips(lead({
      progress: "正式上线",
      rule_fit: "疑似历史重复录入，推荐 UP 视频来自 2025-01-01，暂未找到官方号。",
      contact_methods: [{ type: "B站", value: "https://www.bilibili.com/video/BV1example" }],
      links: ["https://www.bilibili.com/video/BV1example"]
    }), new Date("2026-06-07T00:00:00+08:00"));

    assert.deepEqual(labels(chips).filter((label) => ["缺Steam", "已上线", "疑似重复", "来源偏旧", "非官方", "缺触达"].includes(label)).sort(), ["已上线", "来源偏旧", "疑似重复", "缺Steam", "缺触达", "非官方"].sort());
  });

  it("only shows verified Steam when a canonical app target can be resolved", () => {
    const textAppChips = buildLeadEvidenceChips(lead({
      notes: "Steam 商店：https://store.steampowered.com/app/3506690/Golden_Swirl_Demo/"
    }));
    const genericSteamChips = buildLeadEvidenceChips(lead({
      links: ["https://store.steampowered.com/about/"]
    }));

    assert.equal(labels(textAppChips).includes("Steam已验"), true);
    assert.equal(labels(genericSteamChips).includes("Steam已验"), false);
    assert.equal(labels(genericSteamChips).includes("缺Steam"), true);
  });

  it("shows positive chips for official source, verified Steam, and reachable contacts", () => {
    const chips = buildLeadEvidenceChips(lead({
      steam_app_id: "2921670",
      exposure_trail: "B站官方号发布 Demo PV，开发者主页同步 Steam 商店。",
      links: ["https://store.steampowered.com/app/2921670/Demo_Game/"],
      contact_methods: [
        { type: "官网", value: "https://demo.example.com" },
        { type: "Email", value: "bd@demo.example.com" }
      ]
    }), new Date("2026-06-07T00:00:00+08:00"));

    assert.deepEqual(labels(chips).filter((label) => ["官方源", "Steam已验", "可触达"].includes(label)), ["官方源", "Steam已验", "可触达"]);
  });
});

describe("buildDecisionTriage", () => {
  it("counts only non-dropped unprocessed leads as today's new leads", () => {
    const triage = buildDecisionTriage([
      lead({ id: "new-1", bucket: "未处理", review_status: "未处理" }),
      lead({ id: "drop-1", bucket: "淘汰池", stage: "rejected", review_status: "已淘汰" }),
      lead({ id: "follow-1", bucket: "跟进中", review_status: "跟进中" })
    ], new Date("2026-06-07T00:00:00+08:00"));

    assert.equal(triage.lanes.find((lane) => lane.key === "today")?.count, 1);
    assert.deepEqual(triage.lanes.find((lane) => lane.key === "today")?.leads.map((item) => item.id), ["new-1"]);
  });

  it("excludes dropped leads from evidence issue triage", () => {
    const triage = buildDecisionTriage([
      lead({ id: "needs-evidence", bucket: "未处理", links: [], contact_methods: [] }),
      lead({ id: "dropped-evidence", bucket: "淘汰池", stage: "rejected", review_status: "已淘汰", links: [], contact_methods: [] })
    ], new Date("2026-06-07T00:00:00+08:00"));

    assert.equal(triage.lanes.find((lane) => lane.key === "evidence")?.count, 1);
    assert.deepEqual(triage.lanes.find((lane) => lane.key === "evidence")?.leads.map((item) => item.id), ["needs-evidence"]);
  });

  it("finds active leads that need owner, next action, or due-date attention", () => {
    const triage = buildDecisionTriage([
      lead({ id: "missing-action", bucket: "跟进中", review_status: "跟进中", owner: null, next_action: null }),
      lead({ id: "due-soon", bucket: "测试中", review_status: "跟进中", owner: "Neo", next_action: "等 Demo Key", due_date: "2026-06-09" }),
      lead({ id: "clean-active", bucket: "推进池", review_status: "跟进中", owner: "Neo", next_action: "推进商务", due_date: "2026-06-30" })
    ], new Date("2026-06-07T00:00:00+08:00"));

    assert.equal(triage.lanes.find((lane) => lane.key === "action")?.count, 2);
    assert.deepEqual(triage.lanes.find((lane) => lane.key === "action")?.leads.map((item) => item.id), ["due-soon", "missing-action"]);
  });
});
