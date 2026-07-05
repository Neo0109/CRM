import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchMediaSource,
  fetchMediaSignals,
  isStaleMediaSignal,
  mediaSources,
  parseBilibiliVideoSearch,
  parseFeedItems,
  scoreMediaSignal
} from "../jobs/online_daily_v4_media_sources.mjs";
import {
  buildMediaLeadCandidates,
  hasAlreadyReleasedMediaText,
  isOfficialOrDeveloperBilibiliSignal,
  mediaSignalToLead
} from "../jobs/online_daily_v4_media_leads.mjs";

function diagnostics() {
  return {
    source_failures: 0,
    media_signals_raw: 0,
    media_stale_filtered: 0,
    media_banned_filtered: 0,
    media_low_score_filtered: 0,
    media_non_product_filtered: 0,
    media_expanded_product_candidates: 0,
    media_rescue_product_candidates: 0,
    media_duplicate_filtered: 0,
    media_steam_appids_extracted: 0,
    media_released_routed_to_drop: 0,
    bilibili_official_source_lookups: 0,
    bilibili_official_source_hits: 0,
    low_volume_warnings: []
  };
}

function emptyIndex() {
  return {
    projects: new Set(),
    projectLooseKeys: new Set(),
    steamAppIds: new Set(),
    links: new Set(),
    keys: new Set()
  };
}

describe("online daily v4 media source parsing", () => {
  it("parses Bilibili search JSON and feed XML without live network", () => {
    const source = { name: "B站视频-国产游戏试玩", url: "https://example.com", quality: 13, focus: ["china", "bilibili", "domestic_sourcing"] };
    const bilibiliItems = parseBilibiliVideoSearch(JSON.stringify({
      data: {
        result: [{
          bvid: "BV123",
          title: "<em class=\"keyword\">国产</em>策略 Demo",
          description: "Steam: https://store.steampowered.com/app/123456/",
          author: "开发者官方",
          pubdate: 1783200000
        }]
      }
    }), source);

    assert.equal(bilibiliItems.length, 1);
    assert.equal(bilibiliItems[0].title, "国产 策略 Demo");
    assert.equal(bilibiliItems[0].link, "https://www.bilibili.com/video/BV123/");
    assert.match(bilibiliItems[0].summary, /UP主：开发者官方/);

    const feedItems = parseFeedItems(`
      <rss><channel><item>
        <title><![CDATA[《星环工坊》公开 Demo]]></title>
        <link>https://example.com/news</link>
        <description><![CDATA[国产模拟经营新作]]></description>
        <pubDate>Sun, 05 Jul 2026 10:00:00 GMT</pubDate>
      </item></channel></rss>
    `, { name: "GameLook", url: "https://example.com/feed", quality: 16, focus: ["china", "domestic_sourcing"] });

    assert.equal(feedItems[0].title, "《星环工坊》公开 Demo");
    assert.equal(feedItems[0].link, "https://example.com/news");
  });

  it("uses Bilibili fallback page only when the JSON source fails", async () => {
    const localDiagnostics = diagnostics();
    const items = await fetchMediaSource({
      name: "B站视频-国产游戏试玩",
      url: "https://api.example.test/search",
      fallbackUrl: "https://search.example.test/all",
      type: "bilibili_video_search",
      quality: 13,
      focus: ["china", "bilibili", "domestic_sourcing"]
    }, {
      diagnostics: localDiagnostics,
      fetchTextImpl: async (url) => {
        if (url.includes("api.example")) throw new Error("api down");
        return "<a href=\"https://www.bilibili.com/video/BVFALLBACK/\">《回声工厂》试玩 Demo</a>";
      },
      logger: { warn: () => {} }
    });

    assert.equal(localDiagnostics.source_failures, 0);
    assert.equal(items[0].bvid, "BVFALLBACK");
  });

  it("scores official/developer Bilibili signals above generic topics", () => {
    const official = {
      title: "《星环工坊》官方PV Steam Demo",
      summary: "UP主：星环工坊官方 Steam商店页",
      source: "B站视频-国产官方PV",
      link: "https://www.bilibili.com/video/BVOFFICIAL/",
      source_quality: 15,
      source_focus: ["china", "bilibili", "domestic_sourcing"]
    };

    assert.equal(isOfficialOrDeveloperBilibiliSignal(official), true);
    assert.ok(scoreMediaSignal(official) > 40);
    assert.equal(hasAlreadyReleasedMediaText("Demo 已上线，商店页已上线"), false);
    assert.equal(hasAlreadyReleasedMediaText("现已发售，首发优惠"), true);
  });

  it("builds media leads with Steam/AppID links, contacts, release-drop routing, and diagnostics", () => {
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
    assert.ok(lead.links.includes("https://store.steampowered.com/app/123456/"));
    assert.ok(lead.links.includes("https://steamdb.info/app/123456/"));
    assert.ok(lead.contact_methods.some((method) => method.type === "B站"));
    assert.ok(lead.contact_methods.some((method) => method.type === "Email"));
    assert.equal(localDiagnostics.media_steam_appids_extracted, 1);

    const dropLead = mediaSignalToLead({ ...item, title: "《星环工坊》现已发售", summary: "现已发售" }, "strict", {
      reportDate: "2026-07-05",
      diagnostics: localDiagnostics
    });
    assert.equal(dropLead.bucket, "淘汰池");
    assert.equal(dropLead.stage, "rejected");
    assert.equal(localDiagnostics.media_released_routed_to_drop, 1);
  });

  it("dedupes against existing index and enriches media leads through injected Steam details", async () => {
    const localDiagnostics = diagnostics();
    const leads = await buildMediaLeadCandidates([
      {
        title: "《星环工坊》官方PV Steam Demo",
        summary: "UP主：星环工坊官方 https://store.steampowered.com/app/123456/",
        source: "B站视频-国产官方PV",
        link: "https://www.bilibili.com/video/BVOFFICIAL/",
        source_quality: 15,
        source_focus: ["china", "bilibili", "domestic_sourcing"],
        score: 88
      },
      {
        title: "《旧项目》官方PV Steam Demo",
        summary: "UP主：旧项目官方",
        source: "B站视频-国产官方PV",
        link: "https://www.bilibili.com/video/BVOLD/",
        source_quality: 15,
        source_focus: ["china", "bilibili", "domestic_sourcing"],
        score: 88
      }
    ], {
      ...emptyIndex(),
      projects: new Set(["旧项目"])
    }, {
      reportDate: "2026-07-05",
      diagnostics: localDiagnostics,
      maxOfficialLookups: 0,
      sleepImpl: async () => {},
      fetchAppDetailsImpl: async () => ({
        name: "Steam 星环工坊",
        developers: ["Shanghai Studio"],
        publishers: [],
        genres: [{ description: "Simulation" }],
        categories: [],
        release_date: { coming_soon: true, date: "2026 年 12 月 1 日" },
        website: "https://example.com",
        support_info: {}
      }),
      collectContactMethodsImpl: async () => [{ type: "官网", value: "https://example.com", note: "Steam official website" }]
    });

    assert.equal(leads.length, 1);
    assert.equal(leads[0].project, "星环工坊");
    assert.equal(leads[0].release_window, "2026-12-01");
    assert.ok(leads[0].contact_methods.some((method) => method.value === "https://example.com"));
    assert.equal(localDiagnostics.media_duplicate_filtered, 1);
  });

  it("keeps source list date-filtered and non-empty", () => {
    assert.ok(mediaSources("2026-07-05").length > 30);
  });

  it("builds media sources from rule config and filters inactive configured sources", () => {
    const sources = mediaSources("2026-07-05", {
      mediaSources: [
        { name: "Expired", url: "https://expired.example.com", type: "page", quality: 1, focus: [], activeUntil: "2026-07-01" },
        { name: "B站视频-配置测试", type: "bilibili_video_search", url: "https://api.example.test/search", fallbackUrl: "https://search.example.test/all", quality: 15, focus: ["china", "bilibili"] }
      ]
    });

    assert.deepEqual(sources, [
      { name: "B站视频-配置测试", type: "bilibili_video_search", url: "https://api.example.test/search", fallbackUrl: "https://search.example.test/all", quality: 15, focus: ["china", "bilibili"] }
    ]);
  });

  it("uses rule quality gates for low-score and stale Bilibili filtering", async () => {
    const localDiagnostics = diagnostics();
    const items = await fetchMediaSignals({
      diagnostics: localDiagnostics,
      reportDate: "2026-07-05",
      mediaSourcesImpl: () => [{ name: "Configured Source", url: "https://example.test", type: "page", quality: 5, focus: ["china"] }],
      fetchMediaSourceImpl: async () => [{
        title: "国产新作公布 Steam Demo",
        summary: "国产团队公开试玩版本",
        source: "Configured Source",
        link: "https://example.test/news",
        source_quality: 5,
        source_focus: ["china"]
      }],
      collectBilibiliProbeSignalsImpl: async () => ({ signals: [], diagnostics: { source_failures: 0, official_source_hits: 0 } }),
      ruleConfig: {
        mediaQualityGates: {
          lowScoreThreshold: 90,
          maxBilibiliLeadAgeDays: 10
        }
      }
    });

    assert.equal(items.length, 0);
    assert.equal(localDiagnostics.media_low_score_filtered, 1);
    assert.equal(isStaleMediaSignal({
      title: "旧视频",
      source: "B站视频-国产游戏试玩",
      link: "https://www.bilibili.com/video/BVOLD/",
      published_at: "2026-06-01T00:00:00.000Z"
    }, {
      reportDate: "2026-07-05",
      ruleConfig: {
        mediaQualityGates: {
          maxBilibiliLeadAgeDays: 10
        }
      }
    }), true);
  });
});
