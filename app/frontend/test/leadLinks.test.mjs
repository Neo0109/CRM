import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  applySteamLinkToLead,
  contactLabel,
  gameLinks,
  linkLabel,
  needsGameLinkTriage,
  normalizeSteamLinkInput,
  visibleContacts
} from "../src/features/leads/leadLinks.ts";

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

describe("lead link helpers", () => {
  it("normalizes Steam AppID, store URL, SteamDB URL, and community URL inputs", () => {
    assert.deepEqual(normalizeSteamLinkInput("2921670"), {
      appId: "2921670",
      storeUrl: "https://store.steampowered.com/app/2921670/",
      steamDbUrl: "https://steamdb.info/app/2921670/"
    });
    assert.equal(normalizeSteamLinkInput("https://store.steampowered.com/app/2921670/Demo_Game/")?.appId, "2921670");
    assert.equal(normalizeSteamLinkInput("https://steamdb.info/app/2921670/")?.appId, "2921670");
    assert.equal(normalizeSteamLinkInput("https://steamcommunity.com/app/2921670/discussions/")?.appId, "2921670");
    assert.equal(normalizeSteamLinkInput("not a steam link"), null);
  });

  it("applies Steam links without duplicating existing store or SteamDB URLs", () => {
    const next = applySteamLinkToLead(lead({
      links: [
        "https://steamdb.info/app/2921670",
        "https://example.com/presskit"
      ]
    }), normalizeSteamLinkInput("https://store.steampowered.com/app/2921670/Demo_Game/"));

    assert.equal(next.steam_app_id, "2921670");
    assert.deepEqual(next.links, [
      "https://store.steampowered.com/app/2921670/",
      "https://steamdb.info/app/2921670/",
      "https://example.com/presskit"
    ]);
  });

  it("separates contact chips from game/source links and ignores dropped leads for missing-link triage", () => {
    const sourceLinks = [
      "https://store.steampowered.com/app/2921670/",
      "https://www.bilibili.com/video/BV1example/",
      "https://example.com/presskit"
    ];
    const contacts = [
      { type: "Email", value: "bd@example.com" },
      { type: "Steam", value: "https://store.steampowered.com/app/2921670/" }
    ];

    assert.deepEqual(visibleContacts(contacts), [{ type: "Email", value: "bd@example.com" }]);
    assert.deepEqual(gameLinks(sourceLinks), sourceLinks.slice(0, 2));
    assert.equal(needsGameLinkTriage(lead({ links: [] })), true);
    assert.equal(needsGameLinkTriage(lead({ links: sourceLinks })), false);
    assert.equal(needsGameLinkTriage(lead({ bucket: "淘汰池", stage: "rejected", review_status: "已淘汰", links: [] })), false);
  });

  it("keeps contact and link labels stable for table chips", () => {
    assert.equal(contactLabel({ type: "Email", value: "bd@example.com" }), "Email");
    assert.equal(contactLabel({ type: "微信/QQ", value: "NeoBD" }), "微信/QQ");
    assert.equal(contactLabel({ type: "Steam", value: "https://steamcommunity.com/app/2921670/discussions/" }), "Steam");
    assert.equal(contactLabel({ type: "B站", value: "https://space.bilibili.com/123" }), "B站");
    assert.equal(linkLabel("https://store.steampowered.com/app/2921670/"), "Steam");
    assert.equal(linkLabel("https://steamdb.info/app/2921670/"), "SteamDB");
    assert.equal(linkLabel("https://example.com/presskit"), "example.com");
  });
});
