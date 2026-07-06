import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { analyzeAssistantDraft, buildAssistantResultHints } from "../src/assistantQuality.ts";

describe("assistant quality helpers", () => {
  it("recognizes a strong draft with project, game links, contacts, and screenshot evidence", () => {
    const analysis = analyzeAssistantDraft({
      text: `
        项目：星海工坊
        Steam: https://store.steampowered.com/app/123456/Star_Workshop/
        SteamDB https://steamdb.info/app/123456/
        官网 https://starworkshop.example.com/press
        联系邮箱 bd@starworkshop.example.com 微信 star_bd Discord star#1234
      `,
      attachments: [{ name: "steam-page.png", type: "image/png", size: 2048, source: "paste", data_url: "data:image/png;base64,AAA" }]
    });

    assert.equal(analysis.readiness, "strong");
    assert.equal(analysis.signals.projectName, "星海工坊");
    assert.deepEqual(analysis.signals.steamAppIds, ["123456"]);
    assert.ok(analysis.signals.gameLinks.includes("https://store.steampowered.com/app/123456/Star_Workshop/"));
    assert.ok(analysis.signals.websiteLinks.includes("https://starworkshop.example.com/press"));
    assert.ok(analysis.signals.contacts.some((contact) => contact.includes("bd@starworkshop.example.com")));
    assert.equal(analysis.signals.screenshots, 1);
    assert.deepEqual(analysis.missing, []);
    assert.ok(analysis.suggestions.some((item) => item.includes("可以提交")));
  });

  it("keeps weak screenshot-only or plain-text drafts actionable without blocking submission", () => {
    const screenshotOnly = analyzeAssistantDraft({
      text: "",
      attachments: [{ name: "chat.png", type: "image/png", size: 4096, source: "paste", data_url: "data:image/png;base64,BBB" }]
    });

    assert.equal(screenshotOnly.readiness, "thin");
    assert.deepEqual(screenshotOnly.missing, ["project", "game-link", "contact"]);
    assert.ok(screenshotOnly.suggestions.some((item) => item.includes("项目名")));
    assert.ok(screenshotOnly.suggestions.some((item) => item.includes("Steam")));
    assert.ok(screenshotOnly.suggestions.some((item) => item.includes("联系方式")));

    const websiteOnly = analyzeAssistantDraft({
      text: "项目：Lunar Garden\n官网 https://lunargarden.example.com/contact",
      attachments: []
    });

    assert.equal(websiteOnly.readiness, "usable");
    assert.deepEqual(websiteOnly.missing, ["contact"]);
    assert.ok(websiteOnly.suggestions.some((item) => item.includes("联系方式")));
    assert.ok(!websiteOnly.missing.includes("game-link"));
  });

  it("builds post-submit hints from skipped items and weak imported lead fields", () => {
    const hints = buildAssistantResultHints({
      created: 1,
      updated: 1,
      dropped: 0,
      total: 2,
      message: "线索助手已写入 CRM",
      skipped: ["666666: music"],
      leads: [
        {
          project: "Lunar Garden",
          links: ["https://lunargarden.example.com/contact"],
          contact_methods: [],
          publisher_status: "待确认发行结构",
          next_action: "补充 Steam/官网链接后再判断",
          rule_fit: "缺少 Steam/SteamDB 链接，需要补充可验证页面"
        },
        {
          project: "Cloud Runner",
          steam_app_id: "444444",
          links: ["https://store.steampowered.com/app/444444/"],
          contact_methods: [{ type: "Steam", value: "https://steamcommunity.com/app/444444/discussions/" }],
          publisher_status: "Steam 显示发行商：Cloud Publisher"
        }
      ]
    });

    assert.ok(hints.some((hint) => hint.includes("跳过 1 条")));
    assert.ok(hints.some((hint) => hint.includes("Lunar Garden") && hint.includes("Steam")));
    assert.ok(hints.some((hint) => hint.includes("Lunar Garden") && hint.includes("联系方式")));
    assert.ok(hints.some((hint) => hint.includes("Lunar Garden") && hint.includes("发行结构")));
    assert.ok(hints.some((hint) => hint.includes("Cloud Runner") && hint.includes("已具备")));
  });
});
