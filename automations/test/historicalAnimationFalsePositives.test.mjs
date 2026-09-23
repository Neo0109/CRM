import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPools } from "../jobs/online_daily_v4_decision.mjs";
import {
  isDomesticMediaRescueSignal,
  isExpandedDomesticProductSignal,
  isProductSourcingSignal,
  mediaSignalToLead
} from "../jobs/online_daily_v4_media_entities.mjs";
import { buildMediaLeadCandidates } from "../jobs/online_daily_v4_media_leads.mjs";
import { classifyMediaDisposition } from "../jobs/online_daily_v4_media_rules.mjs";
import { mediaSignalToRadarItem } from "../jobs/online_daily_v4_reports.mjs";
import { evaluateMediaRegularAdmission } from "../jobs/online_daily_v7_2_regular_admission.mjs";

// Selected fields from the immutable, generated Lead reports, not original
// Bilibili video metadata or current CRM records:
// https://github.com/Neo0109/CRM/blob/2306a0d51729fe7dd9b5bfb8e0cb04e3cab013c1/data/reports/2026-06-22.json
// https://github.com/Neo0109/CRM/blob/067e9b7eebece8ab587216788b259f14c82773a3/data/reports/2026-06-24.json
// The June 22 daily report was subsequently overwritten by another generation.
const historicalLeads = [
  {
    "id": "lead_media_20260622_yc7g1q",
    "project": "紫川3",
    "steam_app_id": null,
    "priority": "P1",
    "priority_reason": "媒体 / B站待确认 + 待确认；优先看玩法循环、收入 upside、B站内容放大和团队签约窗口。",
    "rule_fit": "待确认；B站来源待复核；适合由 BD 先判断产品质量、B站适配和签约概率。",
    "genre": "媒体 / B站待确认",
    "gameplay": "媒体 / B站待确认",
    "progress": "待确认",
    "release_window": null,
    "early_access": false,
    "narrative_heavy": false,
    "india_team": false,
    "publisher_status": "媒体/B站信号，发行结构待确认",
    "publisher_name": null,
    "china_capability_occupied": false,
    "traction_summary": "B站视频-国产二游新作 分数 100；B站视频/搜索语境；需要人工确认是否有可测版本、商店页或官方账号。",
    "public_signals": "B站视频-国产二游新作 / https://www.bilibili.com/video/BV1867w6vEzf/",
    "links": [
      "https://www.bilibili.com/video/BV1867w6vEzf/"
    ],
    "bilibili_fit": "重点看实机/PV可剪辑点、弹幕评论反馈和UP主表达，判断是否能转化为试玩、直播或发行前种草。",
    "first_seen": "2026-06-22"
  },
  {
    "id": "lead_media_20260624_u1qx2i",
    "project": "斩神第二季",
    "steam_app_id": null,
    "priority": "P1",
    "priority_reason": "媒体 / B站待确认 + 待确认；优先看玩法循环、收入 upside、B站内容放大和团队签约窗口。",
    "rule_fit": "待确认；B站来源待复核；适合由 BD 先判断产品质量、B站适配和签约概率。",
    "genre": "媒体 / B站待确认",
    "gameplay": "媒体 / B站待确认",
    "progress": "待确认",
    "release_window": null,
    "early_access": false,
    "narrative_heavy": false,
    "india_team": false,
    "publisher_status": "媒体/B站信号，发行结构待确认",
    "publisher_name": null,
    "china_capability_occupied": false,
    "traction_summary": "B站视频-国产二游新作 分数 100；B站视频/搜索语境；需要人工确认是否有可测版本、商店页或官方账号。",
    "public_signals": "B站视频-国产二游新作 / https://www.bilibili.com/video/BV1dXj96WEyD/",
    "links": [
      "https://www.bilibili.com/video/BV1dXj96WEyD/"
    ],
    "bilibili_fit": "重点看实机/PV可剪辑点、弹幕评论反馈和UP主表达，判断是否能转化为试玩、直播或发行前种草。",
    "first_seen": "2026-06-24"
  }
];

function titleOnlySignal(lead) {
  // Use the retained project name as input. The report does not preserve the
  // original video title, description, uploader or tags.
  return {
    title: lead.project,
    source: "B站视频-国产二游新作",
    source_focus: ["china", "bilibili", "creator", "domestic_sourcing"],
    score: 100,
    link: lead.links[0]
  };
}

function emptyIndex() {
  return {
    projects: new Set(), projectLooseKeys: new Set(), steamAppIds: new Set(),
    links: new Set(), keys: new Set()
  };
}

async function assertAnimationStaysOutsideLeads(item) {
  assert.deepEqual(classifyMediaDisposition(item), {
    kind: "radar_only", reason: "non_game_animation_series"
  });
  assert.equal(isProductSourcingSignal(item), false);
  assert.equal(isExpandedDomesticProductSignal(item), false);
  assert.equal(isDomesticMediaRescueSignal(item), false);
  const radar = mediaSignalToRadarItem(item, 0, {
    reportDate: "2026-09-23", capturedAt: "2026-09-23T10:00:00+08:00"
  });
  assert.equal(radar.category, "B站趋势");
  assert.match(radar.relevance + " " + radar.suggested_action, /非游戏动画|IP观察/);
  const diagnostics = {};
  const leads = await buildMediaLeadCandidates([item], emptyIndex(), {
    reportDate: "2026-09-23", diagnostics,
    enrichMediaLeadsWithSteamContextImpl: async () => {
      assert.fail("Animation signals must be filtered before any enrichment");
    }
  });
  assert.deepEqual(leads, []);
  assert.equal(diagnostics.media_radar_only, 1);
}

describe("historical animation false-positive regression", () => {
  it("keeps the retained 斩神第二季 season name outside every Lead candidate path", async () => {
    await assertAnimationStaysOutsideLeads(titleOnlySignal(historicalLeads[1]));
  });

  it("keeps 紫川3 outside Leads when explicit animation context is available", async () => {
    // Constructed context for the existing animation gate, NOT a reconstruction
    // of BV1867w6vEzf metadata. Do not treat these words as historical evidence.
    await assertAnimationStaysOutsideLeads({
      ...titleOnlySignal(historicalLeads[0]),
      summary: "《紫川3》国产动画宣传PV，动画剧集角色亮相。",
      tags: ["动画", "国漫", "PV"]
    });
  });

  it("does not equate the bare 紫川3 candidate classification with formal admission", () => {
    const signal = titleOnlySignal(historicalLeads[0]);
    assert.equal(classifyMediaDisposition(signal).kind, "lead_candidate");
    const lead = mediaSignalToLead(signal, "strict", {
      reportDate: "2026-09-23", diagnostics: {}
    });
    assert.equal(evaluateMediaRegularAdmission(lead).qualified, false);
    const pools = buildPools([], [lead], { reportDate: "2026-09-23" });
    assert.deepEqual(pools.push, []);
    assert.equal(pools.strict_formal_count, 0);
    assert.equal(pools.near_pass_review_count, 0);
  });

  it("does not promote historical P1 and boilerplate recommendations into current formal Leads", () => {
    for (const lead of historicalLeads) {
      assert.equal(lead.priority, "P1");
      assert.equal(evaluateMediaRegularAdmission(lead).qualified, false);
    }
    const pools = buildPools([], historicalLeads, { reportDate: "2026-09-23" });
    assert.deepEqual(pools.push, []);
    assert.equal(pools.strict_formal_count, 0);
    assert.equal(pools.near_pass_review_count, 0);
  });

  it("retains an animation-styled game with independent Steam evidence as a game candidate", async () => {
    // Synthetic positive control. Candidate eligibility still requires the
    // separate formal-admission gates before publication.
    const item = {
      title: "《南亭异闻》国漫风独立游戏官方PV",
      summary: "国产独立游戏 Steam Demo：https://store.steampowered.com/app/4567890/",
      description: "开发团队展示实机玩法和测试计划。",
      tags: ["国产独立游戏", "Steam", "Demo", "国漫风"],
      source: "B站视频-国产二游新作",
      source_focus: ["china", "bilibili", "creator", "domestic_sourcing"],
      link: "https://example.test/animation-styled-game",
      score: 100
    };
    assert.equal(classifyMediaDisposition(item).kind, "lead_candidate");
    assert.equal(isProductSourcingSignal(item), true);
    const leads = await buildMediaLeadCandidates([item], emptyIndex(), {
      reportDate: "2026-09-23", diagnostics: {},
      maxOfficialLookups: 0, maxExactSteamLookups: 0,
      sleepImpl: async () => {},
      fetchAppDetailsImpl: async (appId) => {
        assert.equal(String(appId), "4567890");
        return {
          type: "game", name: "南亭异闻",
          developers: ["南亭异闻开发组"], publishers: [],
          genres: [{ description: "Strategy" }],
          categories: [{ description: "Single-player" }],
          release_date: { coming_soon: true, date: "Coming soon" },
          support_info: {}
        };
      },
      collectContactMethodsImpl: async () => []
    });
    assert.equal(leads.length, 1);
    assert.equal(leads[0].project, "南亭异闻");
    assert.equal(leads[0].steam_app_id, "4567890");
  });
});
