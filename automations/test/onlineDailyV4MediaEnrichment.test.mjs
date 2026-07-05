import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { mediaSignalToLead } from "../jobs/online_daily_v4_media_entities.mjs";
import {
  enrichMediaLeadWithOfficialBilibiliContext,
  enrichMediaLeadWithSteamContext,
  finalizeMediaLeadDecisionFields,
  shouldPreferSteamName
} from "../jobs/online_daily_v4_media_enrichment.mjs";

function diagnostics() {
  return {
    bilibili_official_source_lookups: 0,
    bilibili_official_source_hits: 0,
    media_steam_appids_extracted: 0,
    media_released_routed_to_drop: 0
  };
}

function baseLead(context = {}) {
  return mediaSignalToLead({
    title: "《星环工坊》推荐试玩",
    summary: "UP主：推荐号 国产策略 Demo",
    source: "B站视频-国产游戏试玩",
    link: "https://www.bilibili.com/video/BVRECOMMEND/",
    source_quality: 13,
    source_focus: ["china", "bilibili", "domestic_sourcing"],
    score: 70
  }, "strict", {
    reportDate: "2026-07-05",
    diagnostics: context.diagnostics ?? diagnostics()
  });
}

describe("online daily v4 media enrichment", () => {
  it("prefers official Bilibili candidates and merges Steam/contact evidence", async () => {
    const localDiagnostics = diagnostics();
    const lead = baseLead({ diagnostics: localDiagnostics });

    const enriched = await enrichMediaLeadWithOfficialBilibiliContext(lead, {
      diagnostics: localDiagnostics,
      fetchOfficialBilibiliCandidatesImpl: async () => [{
        title: "《星环工坊》官方PV Steam Demo",
        summary: "UP主：星环工坊官方 联系 hi@example.com https://store.steampowered.com/app/123456/",
        source: "B站视频-国产官方PV",
        link: "https://www.bilibili.com/video/BVOFFICIAL/",
        source_focus: ["china", "bilibili", "domestic_sourcing"],
        score: 95
      }]
    });

    assert.equal(enriched._officialSourceMatched, true);
    assert.equal(enriched._mediaItem.link, "https://www.bilibili.com/video/BVOFFICIAL/");
    assert.equal(enriched.steam_app_id, "123456");
    assert.ok(enriched.links.includes("https://store.steampowered.com/app/123456/"));
    assert.ok(enriched.contact_methods.some((method) => method.type === "Email" && method.value === "hi@example.com"));
    assert.equal(localDiagnostics.bilibili_official_source_lookups, 1);
    assert.equal(localDiagnostics.bilibili_official_source_hits, 1);
    assert.equal(localDiagnostics.media_steam_appids_extracted, 1);
  });

  it("uses injected Steam details to enrich unreleased leads without live network", async () => {
    const localDiagnostics = diagnostics();
    const lead = {
      ...baseLead({ diagnostics: localDiagnostics }),
      project: "国产游戏 Demo",
      steam_app_id: "123456"
    };

    const enriched = await enrichMediaLeadWithSteamContext(lead, {
      reportDate: "2026-07-05",
      diagnostics: localDiagnostics,
      maxOfficialLookups: 0,
      fetchAppDetailsImpl: async () => ({
        name: "Steam 星环工坊",
        developers: ["Shanghai Studio"],
        publishers: ["Example Publisher"],
        genres: [{ description: "Simulation" }],
        categories: [{ description: "Single-player" }],
        release_date: { coming_soon: true, date: "2026 年 12 月 1 日" },
        website: "https://star.example.com",
        support_info: {}
      }),
      collectContactMethodsImpl: async () => [{ type: "官网", value: "https://star.example.com", note: "Steam official website" }]
    });

    assert.equal(enriched.project, "Steam 星环工坊");
    assert.equal(enriched.team, "Shanghai Studio");
    assert.equal(enriched.publisher_name, "Example Publisher");
    assert.equal(enriched.release_window, "2026-12-01");
    assert.ok(enriched.contact_methods.some((method) => method.value === "https://star.example.com"));
    assert.match(enriched.rule_fit, /Steam 交叉验证已建立/);
    assert.equal(shouldPreferSteamName("国产游戏 Demo"), true);
  });

  it("routes released Steam-enriched media leads to drop semantics", async () => {
    const localDiagnostics = diagnostics();
    const lead = {
      ...baseLead({ diagnostics: localDiagnostics }),
      steam_app_id: "123456"
    };

    const enriched = await enrichMediaLeadWithSteamContext(lead, {
      reportDate: "2026-07-05",
      diagnostics: localDiagnostics,
      maxOfficialLookups: 0,
      fetchAppDetailsImpl: async () => ({
        name: "星环工坊",
        developers: ["Shanghai Studio"],
        publishers: [],
        genres: [{ description: "Simulation" }],
        categories: [],
        release_date: { coming_soon: false, date: "2026 年 6 月 1 日" },
        website: "https://star.example.com",
        support_info: {}
      }),
      collectContactMethodsImpl: async () => []
    });

    assert.equal(enriched.bucket, "淘汰池");
    assert.equal(enriched.stage, "rejected");
    assert.equal(enriched.priority, "P3");
    assert.match(enriched.priority_reason, /已发售约34天/);
    assert.equal(localDiagnostics.media_released_routed_to_drop, 1);
  });

  it("keeps decision field finalization in the enrichment module", () => {
    const finalized = finalizeMediaLeadDecisionFields(baseLead(), null, { reportDate: "2026-07-05" });
    assert.match(finalized.priority_reason, /试玩 Demo|待确认|即将发售/);

    const source = readFileSync(new URL("../jobs/online_daily_v4_media_leads.mjs", import.meta.url), "utf8");
    assert.match(source, /online_daily_v4_media_enrichment\.mjs/);
    for (const helperName of [
      "enrichMediaLeadWithSteamContext",
      "enrichMediaLeadWithOfficialBilibiliContext",
      "finalizeMediaLeadDecisionFields",
      "shouldPreferSteamName",
      "mediaLeadToDrop"
    ]) {
      assert.doesNotMatch(source, new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${helperName}\\b`));
    }
  });
});
