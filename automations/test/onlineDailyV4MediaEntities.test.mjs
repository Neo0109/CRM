import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  collectMediaContactMethods,
  collectMediaVerificationLinks,
  extractMediaProjectName,
  inferContactTypeFromLink,
  inferMediaGenre,
  isDomesticMediaRescueSignal,
  isExpandedDomesticProductSignal,
  isGenericMediaProjectName,
  isProductSourcingSignal,
  isUnusableMediaProjectName,
  mediaLeadScore,
  mediaSignalToLead
} from "../jobs/online_daily_v4_media_entities.mjs";

function diagnostics() {
  return {
    media_steam_appids_extracted: 0,
    media_released_routed_to_drop: 0
  };
}

describe("online daily v4 media entity extraction", () => {
  it("extracts concrete project names and rejects generic media placeholders", () => {
    assert.equal(extractMediaProjectName("【官方】《星环工坊》Steam Demo PV"), "星环工坊");
    assert.equal(extractMediaProjectName("试玩：回声工厂 Demo丨B站"), "回声工厂 Demo");
    assert.equal(extractMediaProjectName("   "), "媒体/B站发现线索");

    assert.equal(isGenericMediaProjectName("国产游戏"), true);
    assert.equal(isGenericMediaProjectName("星环工坊"), false);
    assert.equal(isUnusableMediaProjectName("国产游戏 Demo 上线"), true);
    assert.equal(isUnusableMediaProjectName("星环工坊"), false);
  });

  it("classifies strict, expanded, and rescue media signals without accepting tutorial topics", () => {
    const official = {
      title: "《星环工坊》官方PV Steam Demo",
      summary: "UP主：星环工坊官方 Steam商店页 https://store.steampowered.com/app/123456/",
      source: "B站视频-国产官方PV",
      link: "https://www.bilibili.com/video/BVOFFICIAL/",
      source_quality: 15,
      source_focus: ["china", "bilibili", "domestic_sourcing"],
      score: 88
    };
    const expanded = {
      title: "回声工厂 Steam Demo 公布",
      summary: "国产独立团队公开试玩版本和商店页",
      source: "indienova",
      link: "https://example.com/news",
      source_quality: 12,
      source_focus: ["china"],
      score: 62
    };
    const rescue = {
      title: "《幽径小队》开发日志：Steam 试玩开放",
      summary: "国内团队公布国风肉鸽 Demo 与官网",
      source: "开发者社区",
      link: "https://example.com/devlog",
      source_quality: 8,
      source_focus: ["china"],
      score: 38
    };
    const tutorial = {
      title: "如何报名 Steam 新品节并提升愿望单",
      summary: "开发经验分享，不是新产品线索",
      source: "B站视频-国产游戏试玩",
      link: "https://www.bilibili.com/video/BVTUTORIAL/",
      source_focus: ["china", "bilibili", "domestic_sourcing"],
      score: 90
    };

    assert.equal(isProductSourcingSignal(official), true);
    assert.equal(isProductSourcingSignal(tutorial), false);
    assert.equal(isExpandedDomesticProductSignal(expanded), true);
    assert.equal(isDomesticMediaRescueSignal(rescue), true);
  });

  it("rejects Steam store operations content without a concrete project or normalized app link", () => {
    const operationsItems = [
      {
        title: "Steam商店页装修和过审：从入门到入土",
        summary: "独立游戏开发经验和商店页面优化教程",
        source: "B站视频-国产商店页愿望单",
        link: "https://www.bilibili.com/video/BVSTOREOPS/",
        source_focus: ["china", "bilibili", "domestic_sourcing"],
        score: 90
      },
      {
        title: "关于解谜独立游戏Steam商店页终于上线",
        summary: "分享商店页过审和愿望单运营经验",
        source: "B站视频-国产商店页愿望单",
        link: "https://www.bilibili.com/video/BVSTORELIVE/",
        source_focus: ["china", "bilibili", "domestic_sourcing"],
        score: 90
      }
    ];

    for (const item of operationsItems) {
      assert.equal(isProductSourcingSignal(item), false);
      assert.equal(isExpandedDomesticProductSignal(item), false);
      assert.equal(isDomesticMediaRescueSignal(item), false);
    }
  });

  it("normalizes verification links and contact methods without turning Steam app pages into contacts", () => {
    const item = {
      title: "《星环工坊》官方PV Steam Demo",
      summary: "UP主：星环工坊官方 联系 hi@example.com https://discord.gg/star https://x.com/starstudio",
      source: "B站视频-国产官方PV",
      link: "https://www.bilibili.com/video/BVOFFICIAL/",
      source_focus: ["china", "bilibili", "domestic_sourcing"]
    };
    const extractedLinks = [
      "https://store.steampowered.com/app/123456/",
      "https://steamdb.info/app/123456/",
      "https://star.example.com/",
      "https://discord.gg/star",
      "https://x.com/starstudio"
    ];

    const links = collectMediaVerificationLinks(item.link, extractedLinks, "123456");
    assert.equal(links.filter((link) => link.includes("/app/123456")).length, 2);
    assert.ok(links.includes("https://star.example.com/"));

    const contacts = collectMediaContactMethods(item, item.link, extractedLinks);
    assert.ok(contacts.some((method) => method.type === "B站"));
    assert.ok(contacts.some((method) => method.type === "Email" && method.value === "hi@example.com"));
    assert.ok(contacts.some((method) => method.type === "Discord"));
    assert.ok(contacts.some((method) => method.type === "X/Twitter"));
    assert.ok(contacts.some((method) => method.type === "官网" && method.value === "https://star.example.com/"));
    assert.equal(contacts.some((method) => /steampowered|steamdb/.test(method.value)), false);

    assert.equal(inferContactTypeFromLink("https://store.steampowered.com/app/123456/"), null);
    assert.equal(inferContactTypeFromLink("https://studio.example.com"), "官网");
  });

  it("builds stable CRM leads from media signals and routes released products to drop", () => {
    const localDiagnostics = diagnostics();
    const item = {
      title: "《星环工坊》官方PV Steam Demo",
      summary: "UP主：星环工坊官方 联系 hi@example.com https://store.steampowered.com/app/123456/",
      source: "B站视频-国产官方PV",
      link: "https://www.bilibili.com/video/BVOFFICIAL/",
      source_quality: 15,
      source_focus: ["china", "bilibili", "domestic_sourcing"],
      score: 88
    };

    const lead = mediaSignalToLead(item, "strict", {
      reportDate: "2026-07-05",
      diagnostics: localDiagnostics
    });

    assert.equal(lead.id, "lead_media_20260705_1gghai2");
    assert.equal(lead.project, "星环工坊");
    assert.equal(lead.bucket, "未处理");
    assert.equal(lead.stage, "new");
    assert.equal(lead.steam_app_id, "123456");
    assert.equal(lead.region, "中国");
    assert.match(lead.traction_summary, /B站视频\/搜索语境/);
    assert.equal(localDiagnostics.media_steam_appids_extracted, 1);
    assert.ok(mediaLeadScore(item) > 100);
    assert.match(inferMediaGenre({ title: "国风肉鸽卡牌", summary: "合作多人策略" }), /Roguelike/);

    const dropLead = mediaSignalToLead({ ...item, title: "《星环工坊》现已发售", summary: "现已发售" }, "strict", {
      reportDate: "2026-07-05",
      diagnostics: localDiagnostics
    });
    assert.equal(dropLead.bucket, "淘汰池");
    assert.equal(dropLead.stage, "rejected");
    assert.equal(localDiagnostics.media_released_routed_to_drop, 1);
  });

  it("keeps media_leads as orchestration instead of declaring entity helpers inline", () => {
    const source = readFileSync(new URL("../jobs/online_daily_v4_media_leads.mjs", import.meta.url), "utf8");
    assert.match(source, /online_daily_v4_media_entities\.mjs/);
    for (const helperName of [
      "extractMediaProjectName",
      "collectMediaContactMethods",
      "collectMediaVerificationLinks",
      "inferContactTypeFromLink",
      "inferMediaGenre",
      "mediaSignalToLead",
      "mediaLeadScore"
    ]) {
      assert.doesNotMatch(source, new RegExp(`(?:export\\s+)?function\\s+${helperName}\\b`));
    }
  });
});
