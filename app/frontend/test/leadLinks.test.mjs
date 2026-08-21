import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  applySteamLinkToLead,
  buildLeadLinkShortcuts,
  contactLabel,
  gameLinks,
  linkLabel,
  needsGameLinkTriage,
  normalizeSteamLinkInput,
  visibleContacts
} from "../src/features/leads/leadLinks.ts";
import { resolveLeadSteamTarget } from "../src/leadEvidence.ts";
import { buildLeadEvidenceChips } from "../src/leadTriage.ts";

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
  it("resolves one canonical Steam target from structured fields or evidence text", () => {
    assert.deepEqual(resolveLeadSteamTarget(lead({
      steam_app_id: "3506690",
      links: ["https://store.steampowered.com/app/9999999/Other_Game/"]
    })), {
      appId: "3506690",
      storeUrl: "https://store.steampowered.com/app/3506690/",
      steamDbUrl: "https://steamdb.info/app/3506690/"
    });

    assert.equal(resolveLeadSteamTarget(lead({
      notes: "视频简介：https://steamdb.info/app/3506690/Golden_Swirl_Demo/"
    }))?.storeUrl, "https://store.steampowered.com/app/3506690/");
    assert.equal(resolveLeadSteamTarget(lead({
      links: ["https://store.steampowered.com/about/"]
    })), null);
  });

  it("keeps the verified-Steam badge and direct shortcut as one global invariant", () => {
    const fixtures = [
      lead({ steam_app_id: "3506690" }),
      lead({ notes: "Steam: https://store.steampowered.com/app/3506690/Golden_Swirl_Demo/" }),
      lead({ exposure_trail: "SteamDB https://steamdb.info/app/3506690/" }),
      lead({ contact_methods: [{ type: "Steam", value: "https://steamcommunity.com/app/3506690/discussions/" }] })
    ];

    for (const fixture of fixtures) {
      const verified = buildLeadEvidenceChips(fixture).some((chip) => chip.label === "Steam已验");
      const shortcut = buildLeadLinkShortcuts(fixture).find((item) => item.label === "Steam");
      assert.equal(verified, true);
      assert.equal(shortcut?.href, "https://store.steampowered.com/app/3506690/");
    }
  });

  it("prioritizes Steam before Bilibili after platform dedupe for every link position", () => {
    const steam = "https://store.steampowered.com/app/3506690/Golden_Swirl_Demo/";
    const bilibili = [
      "https://www.bilibili.com/video/BV1first/",
      "https://www.bilibili.com/video/BV1second/"
    ];

    for (let index = 0; index <= bilibili.length; index += 1) {
      const links = [...bilibili];
      links.splice(index, 0, steam);
      assert.deepEqual(
        buildLeadLinkShortcuts(lead({ links })).map(({ label, href }) => ({ label, href })),
        [
          { label: "Steam", href: "https://store.steampowered.com/app/3506690/" },
          { label: "B站", href: bilibili[0] }
        ]
      );
    }
  });

  it("covers the Golden Swirl regression and ignores contact-label collisions", () => {
    const fixture = lead({
      contact_methods: [{ type: "Steam", value: "https://store.steampowered.com/about/" }],
      links: [
        "https://www.bilibili.com/video/BV19qFMzEEHd/",
        "https://www.bilibili.com/video/BV1first/",
        "https://store.steampowered.com/app/3506690/_Golden_Swirl_Demo/",
        "https://steamdb.info/app/3506690/",
        "https://steamcommunity.com/app/3506690/discussions/"
      ]
    });

    assert.deepEqual(buildLeadLinkShortcuts(fixture).map((item) => item.label), ["Steam", "B站"]);
    assert.equal(buildLeadLinkShortcuts(fixture)[0]?.href, "https://store.steampowered.com/app/3506690/");
  });

  it("preserves existing non-Steam source ordering and caps shortcuts after dedupe", () => {
    assert.deepEqual(buildLeadLinkShortcuts(lead({
      links: [
        "https://www.bilibili.com/video/BV1first/",
        "https://www.bilibili.com/video/BV1second/",
        "https://www.taptap.cn/app/12345",
        "https://indienova.com/game/demo"
      ]
    })).map((item) => item.label), ["B站", "www.taptap.cn"]);
  });
});
