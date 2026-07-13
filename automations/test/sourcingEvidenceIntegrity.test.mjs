import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectBilibiliProbeSignals } from "../jobs/bilibili_probe.mjs";
import {
  enforceLeadSteamEvidence,
  extractBilibiliEvidence
} from "../jobs/bilibili_evidence.mjs";
import { dedupeMediaSignals } from "../jobs/online_daily_v4_dedupe.mjs";
import {
  chooseExactSteamTitleCandidate,
  enrichMediaLeadWithOfficialBilibiliContext
} from "../jobs/online_daily_v4_media_enrichment.mjs";
import {
  isDomesticMediaRescueSignal,
  isExpandedDomesticProductSignal,
  isProductSourcingSignal,
  mediaSignalToLead
} from "../jobs/online_daily_v4_media_entities.mjs";
import { buildMediaLeadCandidates } from "../jobs/online_daily_v4_media_leads.mjs";
import { classifyMediaDisposition } from "../jobs/online_daily_v4_media_rules.mjs";
import { mediaSignalToRadarItem } from "../jobs/online_daily_v4_reports.mjs";
import {
  enrichBilibiliVideoSignal,
  parseBilibiliSearchPage,
  parseBilibiliVideoSearch
} from "../jobs/online_daily_v4_media_sources.mjs";

function okJson(value) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    async json() {
      return value;
    }
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

function diagnostics() {
  return {
    source_failures: 0,
    media_non_product_filtered: 0,
    media_expanded_product_candidates: 0,
    media_rescue_product_candidates: 0,
    media_duplicate_filtered: 0,
    media_steam_appids_extracted: 0,
    media_released_routed_to_drop: 0,
    media_radar_only: 0,
    media_rejected: 0,
    media_exact_steam_lookup_attempts: 0,
    media_exact_steam_lookup_hits: 0,
    steam_links_detected: 0,
    steam_evidence_materialized: 0,
    steam_demo_parent_converted: 0,
    steam_evidence_released_filtered: 0,
    steam_evidence_duplicate_merged: 0,
    steam_evidence_lost: 0
  };
}

function nonGameAnimationSignals() {
  return [
    {
      title: "高影胤霆携手对抗佛爷！《谷围南亭 第二季》粤语版概念PV公开",
      summary: "《谷围南亭第二季》动画粤语版概念PV公开，第二季角色与配音阵容亮相。",
      description: "国产动画第二季宣传片。",
      owner_name: "wuhu动画人空间",
      tags: ["动画", "国漫", "第二季"],
      source: "B站视频-国产二游新作",
      link: "https://www.bilibili.com/video/BV15v7K6sE93/",
      source_quality: 12,
      source_focus: ["china", "bilibili", "creator", "domestic_sourcing"],
      score: 68
    },
    {
      title: "《谷围南亭第二季》粤语版PV同步上线",
      summary: "国漫剧集第二季粤语版PV上线，介绍声优和播出信息。",
      dynamic: "动画第二季即将开播。",
      owner_name: "国漫爆料官",
      tags: ["动漫", "番剧", "粤语版"],
      source: "B站视频-国产二游新作",
      link: "https://www.bilibili.com/video/BV1fs7P6WEei/",
      source_quality: 12,
      source_focus: ["china", "bilibili", "creator", "domestic_sourcing"],
      score: 68
    }
  ];
}

function probeConfig() {
  return {
    schema_version: 1,
    rule_version: "sourcing-rules-v6.6-evidence-integrity",
    max_video_age_days: 120,
    max_detail_fetches: 10,
    request_concurrency: 1,
    request_batch_delay_ms: 0,
    retry_delays_ms: [],
    official_uids: [],
    developer_uids: [],
    publisher_uids: [],
    media_uids: [],
    trusted_creator_uids: [],
    keywords: ["404幸存者 开发日志"],
    keyword_fallbacks: {},
    required_keywords: ["开发日志", "Demo", "Steam"],
    blacklist_uids: [],
    blacklist_bvids: [],
    blacklist_keywords: [],
    generic_collection_patterns: []
  };
}

function probeFetch() {
  const published = Math.floor(Date.parse("2026-07-01T00:00:00+08:00") / 1000);
  return async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname.includes("/x/web-interface/search/type")) {
      return okJson({
        data: {
          result: [{
            bvid: "BV404SURVIVOR",
            title: "谁懂啊!末日生存被墙挡着被丧尸偷了八百次,这次终于治好了!【404幸存者 开发日志 5】",
            description: "制作了墙体隐藏功能，修改了光影和鼠标中键视角旋转。",
            pubdate: published,
            mid: "404",
            author: "404幸存者开发组"
          }]
        }
      });
    }
    if (parsed.pathname.includes("/x/web-interface/view")) {
      return okJson({
        data: {
          bvid: "BV404SURVIVOR",
          title: "谁懂啊!末日生存被墙挡着被丧尸偷了八百次,这次终于治好了!【404幸存者 开发日志 5】",
          desc: "目前 Steam Demo 已上线：https://store.steampowered.com/app/4039970/ ，正式版仍在持续开发。",
          dynamic: "欢迎留言反馈",
          pubdate: published,
          owner: { mid: 404, name: "404幸存者开发组" },
          stat: { view: 1200, like: 80 },
          tag: [{ tag_name: "国产独立游戏" }, { tag_name: "开发日志" }]
        }
      });
    }
    return okJson({ data: {} });
  };
}

function steamDetails(appId) {
  if (String(appId) === "4039970") {
    return {
      type: "demo",
      name: "404幸存者 Demo",
      fullgame: { appid: "4038790", name: "404幸存者" },
      developers: ["404 Studio"],
      publishers: [],
      release_date: { coming_soon: false, date: "Mar 6, 2026" },
      support_info: {}
    };
  }
  if (String(appId) === "4038790") {
    return {
      type: "game",
      name: "404幸存者",
      developers: ["404 Studio"],
      publishers: [],
      genres: [{ description: "Survival" }],
      categories: [{ description: "Single-player" }],
      release_date: { coming_soon: true, date: "Q3 2026" },
      support_info: {}
    };
  }
  return null;
}

describe("sourcing evidence integrity", () => {
  it("extracts Steam, website, email, and source URLs from complete Bilibili detail evidence", () => {
    const evidence = extractBilibiliEvidence({
      title: "《404幸存者》开发日志",
      link: "https://www.bilibili.com/video/BV404SURVIVOR/",
      summary: "Demo https://store.steampowered.com/app/4039970/ 官网 https://404.example.com 联系 bd@404.example.com"
    });

    assert.equal(evidence.steam_app_id, "4039970");
    assert.deepEqual(evidence.steam_app_ids, ["4039970"]);
    assert.ok(evidence.urls.includes("https://store.steampowered.com/app/4039970/"));
    assert.ok(evidence.urls.includes("https://steamdb.info/app/4039970/"));
    assert.ok(evidence.website_urls.includes("https://404.example.com"));
    assert.deepEqual(evidence.emails, ["bd@404.example.com"]);
    assert.deepEqual(evidence.source_urls, ["https://www.bilibili.com/video/BV404SURVIVOR/"]);
  });

  it("turns the exact 404 survivor detail-only Demo URL into one canonical full-game Lead", async () => {
    const result = await collectBilibiliProbeSignals({
      reportDate: "2026-07-13",
      config: probeConfig(),
      fetchImpl: probeFetch(),
      sleepImpl: async () => {}
    });

    assert.equal(result.signals.length, 1);
    assert.equal(result.signals[0].bilibili_evidence.steam_app_id, "4039970");
    assert.ok(result.signals[0].bilibili_evidence.urls.includes("https://store.steampowered.com/app/4039970/"));

    const secondVideo = {
      ...result.signals[0],
      bvid: "BV404SECOND",
      link: "https://www.bilibili.com/video/BV404SECOND/",
      source: "B站探头-可信UP",
      source_quality: 500,
      bilibili_evidence: extractBilibiliEvidence({
        ...result.signals[0],
        bvid: "BV404SECOND",
        link: "https://www.bilibili.com/video/BV404SECOND/"
      })
    };
    const localDiagnostics = diagnostics();
    const leads = await buildMediaLeadCandidates(
      dedupeMediaSignals([secondVideo, result.signals[0]]),
      emptyIndex(),
      {
        reportDate: "2026-07-13",
        diagnostics: localDiagnostics,
        maxOfficialLookups: 0,
        sleepImpl: async () => {},
        fetchAppDetailsImpl: async (appId) => steamDetails(appId),
        collectContactMethodsImpl: async () => []
      }
    );

    assert.equal(leads.length, 1);
    assert.equal(leads[0].project, "404幸存者");
    assert.equal(leads[0].steam_app_id, "4038790");
    assert.ok(leads[0].links.includes("https://www.bilibili.com/video/BV404SURVIVOR/"));
    assert.ok(leads[0].links.includes("https://www.bilibili.com/video/BV404SECOND/"));
    assert.ok(leads[0].links.includes("https://store.steampowered.com/app/4038790/"));
    assert.ok(leads[0].links.includes("https://steamdb.info/app/4038790/"));
    assert.equal(leads[0].progress, "Demo 可玩、正式版未发售");
    assert.equal(localDiagnostics.steam_links_detected, 2);
    assert.equal(localDiagnostics.steam_evidence_duplicate_merged, 1);
    assert.equal(localDiagnostics.steam_demo_parent_converted, 1);
    assert.equal(localDiagnostics.steam_evidence_lost, 0);
    assert.equal(localDiagnostics.steam_evidence_accounting_ok, true);
  });

  it("attaches the same evidence shape to video API and HTML fallback detail paths", async () => {
    const source = {
      name: "B站视频-证据测试",
      url: "https://example.test",
      quality: 15,
      focus: ["china", "bilibili", "domestic_sourcing"]
    };
    const apiItem = parseBilibiliVideoSearch(JSON.stringify({
      data: {
        result: [{
          bvid: "BVAPI",
          title: "《星环工坊》Demo",
          description: "搜索摘要没有链接",
          author: "星环工坊官方"
        }]
      }
    }), source)[0];
    const htmlItem = parseBilibiliSearchPage(
      '<a href="https://www.bilibili.com/video/BVHTML/">《星环工坊》开发日志 Demo</a>',
      source
    )[0];
    const fetchJsonImpl = async (url) => {
      const bvid = new URL(url).searchParams.get("bvid");
      return {
        data: {
          bvid,
          title: "《星环工坊》开发日志 Demo",
          desc: "Steam https://store.steampowered.com/app/123456/",
          owner: { name: "星环工坊官方" }
        }
      };
    };

    const apiEnriched = await enrichBilibiliVideoSignal(apiItem, { fetchJsonImpl });
    const htmlEnriched = await enrichBilibiliVideoSignal(htmlItem, { fetchJsonImpl });
    assert.equal(apiEnriched.bilibili_evidence.steam_app_id, "123456");
    assert.equal(htmlEnriched.bilibili_evidence.steam_app_id, "123456");
  });

  it("uses structured official-source evidence instead of reparsing display fields", async () => {
    const localDiagnostics = diagnostics();
    const base = mediaSignalToLead({
      title: "《星环工坊》推荐试玩",
      summary: "国产策略 Demo",
      source: "B站视频-国产游戏试玩",
      link: "https://www.bilibili.com/video/BVREC/",
      source_focus: ["china", "bilibili", "domestic_sourcing"],
      score: 70
    }, "strict", { reportDate: "2026-07-13", diagnostics: localDiagnostics });

    const enriched = await enrichMediaLeadWithOfficialBilibiliContext(base, {
      diagnostics: localDiagnostics,
      fetchOfficialBilibiliCandidatesImpl: async () => [{
        title: "《星环工坊》官方PV",
        summary: "完整详情",
        source: "B站视频-国产官方PV",
        link: "https://www.bilibili.com/video/BVOFFICIAL/",
        score: 95,
        bilibili_evidence: extractBilibiliEvidence({
          link: "https://www.bilibili.com/video/BVOFFICIAL/",
          summary: "Steam https://store.steampowered.com/app/123456/"
        })
      }]
    });

    assert.equal(enriched.steam_app_id, "123456");
    assert.ok(enriched.links.includes("https://steamdb.info/app/123456/"));
    assert.equal(enriched._bilibiliEvidence.steam_app_id, "123456");
  });

  it("merges original and official Bilibili evidence without losing either source", async () => {
    const localDiagnostics = diagnostics();
    const base = mediaSignalToLead({
      title: "《星环工坊》Demo 开发日志",
      summary: "Steam https://store.steampowered.com/app/123456/",
      source: "B站视频-国产游戏试玩",
      link: "https://www.bilibili.com/video/BVREC/",
      source_focus: ["china", "bilibili", "domestic_sourcing"],
      score: 70
    }, "strict", { reportDate: "2026-07-13", diagnostics: localDiagnostics });

    const enriched = await enrichMediaLeadWithOfficialBilibiliContext(base, {
      diagnostics: localDiagnostics,
      fetchOfficialBilibiliCandidatesImpl: async () => [{
        title: "《星环工坊》官方PV",
        summary: "Steam https://store.steampowered.com/app/123456/",
        source: "B站视频-国产官方PV",
        link: "https://www.bilibili.com/video/BVOFFICIAL/",
        score: 95
      }]
    });

    assert.deepEqual(enriched._bilibiliEvidence.source_urls, [
      "https://www.bilibili.com/video/BVOFFICIAL/",
      "https://www.bilibili.com/video/BVREC/"
    ]);
    assert.equal(enriched._bilibiliEvidence.steam_app_id, "123456");
    assert.equal(localDiagnostics.steam_links_detected, 2);
    assert.equal(localDiagnostics.steam_evidence_duplicate_merged, 1);
  });

  it("keeps merged Bilibili evidence when a non-Bilibili article is the primary signal", () => {
    const bili = {
      title: "《星环工坊》Demo 首曝",
      summary: "Steam https://store.steampowered.com/app/123456/",
      source: "B站视频-国产游戏试玩",
      link: "https://www.bilibili.com/video/BVKEEP/",
      source_quality: 50,
      bilibili_evidence: extractBilibiliEvidence({
        link: "https://www.bilibili.com/video/BVKEEP/",
        summary: "Steam https://store.steampowered.com/app/123456/"
      })
    };
    const article = {
      title: "《星环工坊》Demo 首曝",
      summary: "国内团队公布试玩。",
      source: "国内游戏媒体",
      link: "https://example.test/starloop",
      source_quality: 100,
      source_focus: ["china", "domestic_sourcing"],
      score: 80
    };

    const [merged] = dedupeMediaSignals([bili, article]);
    const lead = mediaSignalToLead(merged, "strict", {
      reportDate: "2026-07-13",
      diagnostics: diagnostics()
    });

    assert.equal(lead.steam_app_id, "123456");
    assert.ok(lead.links.includes("https://www.bilibili.com/video/BVKEEP/"));
    assert.ok(lead.links.includes("https://steamdb.info/app/123456/"));
  });

  it("self-heals a missing Lead link and rejects unresolved ambiguous Steam evidence", () => {
    const localDiagnostics = diagnostics();
    const evidence = extractBilibiliEvidence({
      link: "https://www.bilibili.com/video/BVFIX/",
      summary: "Steam https://store.steampowered.com/app/123456/"
    });
    const healed = enforceLeadSteamEvidence({
      project: "星环工坊",
      steam_app_id: null,
      links: ["https://www.bilibili.com/video/BVFIX/"],
      _bilibiliEvidence: evidence,
      _steamEvidencePrimary: 1
    }, localDiagnostics);

    assert.equal(healed.valid, true);
    assert.equal(healed.lead.steam_app_id, "123456");
    assert.ok(healed.lead.links.includes("https://store.steampowered.com/app/123456/"));
    assert.ok(healed.lead.links.includes("https://steamdb.info/app/123456/"));

    const ambiguous = enforceLeadSteamEvidence({
      project: "模糊项目",
      links: ["https://www.bilibili.com/video/BVAMBIGUOUS/"],
      _steamEvidencePrimary: 1,
      _bilibiliEvidence: {
        source_url: "https://www.bilibili.com/video/BVAMBIGUOUS/",
        source_urls: ["https://www.bilibili.com/video/BVAMBIGUOUS/"],
        urls: [
          "https://store.steampowered.com/app/111111/",
          "https://store.steampowered.com/app/222222/"
        ],
        steam_app_id: "111111",
        steam_app_ids: ["111111", "222222"],
        website_urls: [],
        emails: [],
        contact_urls: []
      }
    }, localDiagnostics);

    assert.equal(ambiguous.valid, false);
    assert.equal(localDiagnostics.steam_evidence_lost, 1);
  });

  it("keeps the exact non-game animation season signals in Radar and out of every Lead path", async () => {
    const localDiagnostics = diagnostics();
    let officialLookups = 0;
    let exactSteamLookups = 0;

    for (const [index, item] of nonGameAnimationSignals().entries()) {
      assert.deepEqual(classifyMediaDisposition(item), {
        kind: "radar_only",
        reason: "non_game_animation_series"
      });
      assert.equal(isProductSourcingSignal(item), false);
      assert.equal(isExpandedDomesticProductSignal(item), false);
      assert.equal(isDomesticMediaRescueSignal(item), false);

      const radarItem = mediaSignalToRadarItem(item, index, {
        reportDate: "2026-07-13",
        capturedAt: "2026-07-13T10:00:00+08:00"
      });
      assert.equal(radarItem.category, "B站趋势");
      assert.match(`${radarItem.summary} ${radarItem.relevance} ${radarItem.suggested_action}`, /非游戏动画|IP观察/);
      assert.doesNotMatch(`${radarItem.summary} ${radarItem.relevance} ${radarItem.suggested_action}`, /试玩/);
    }

    const leads = await buildMediaLeadCandidates(nonGameAnimationSignals(), emptyIndex(), {
      reportDate: "2026-07-13",
      diagnostics: localDiagnostics,
      maxOfficialLookups: 4,
      maxExactSteamLookups: 4,
      sleepImpl: async () => {},
      fetchOfficialBilibiliCandidatesImpl: async () => {
        officialLookups += 1;
        return [];
      },
      fetchSteamExactTitleCandidatesImpl: async () => {
        exactSteamLookups += 1;
        return [];
      },
      collectContactMethodsImpl: async () => []
    });

    assert.deepEqual(leads, []);
    assert.equal(officialLookups, 0);
    assert.equal(exactSteamLookups, 0);
    assert.equal(localDiagnostics.media_radar_only, 2);
  });

  it("keeps an animation-styled indie game with independent Steam evidence eligible", () => {
    const item = {
      title: "《南亭异闻》国漫风独立游戏官方PV",
      summary: "国产独立游戏 Steam Demo 已上线：https://store.steampowered.com/app/4567890/",
      description: "开发团队展示实机玩法和测试计划。",
      owner_name: "南亭异闻开发组",
      tags: ["国产独立游戏", "Steam", "Demo", "国漫风"],
      source: "B站视频-国产二游新作",
      link: "https://www.bilibili.com/video/BVGAMECONTROL/",
      source_quality: 12,
      source_focus: ["china", "bilibili", "creator", "domestic_sourcing"],
      score: 68
    };

    assert.equal(classifyMediaDisposition(item).kind, "lead_candidate");
    assert.equal(isProductSourcingSignal(item), true);
  });

  it("routes film-script approval to radar but keeps qualified game licence approval actionable", () => {
    const deathStranding = {
      title: "《死亡搁浅》电影最新进展：剧本初稿过审，小岛秀夫担任制片人",
      summary: "电影项目与演员导演消息",
      source: "IT之家",
      link: "https://www.ithome.com/0/961/120.htm",
      source_focus: ["china", "domestic_sourcing"]
    };
    const realLicence = {
      title: "国产新作《山海工坊》获批版号",
      summary: "国家新闻出版署网络游戏审批信息已公布，开发团队同步公开 Steam Demo。",
      source: "游戏媒体",
      link: "https://example.test/licence",
      source_focus: ["china", "domestic_sourcing"]
    };

    assert.equal(classifyMediaDisposition(deathStranding).kind, "radar_only");
    assert.equal(classifyMediaDisposition(realLicence).kind, "lead_candidate");
  });

  it("exact-title checks Duckov and keeps released or publisher-occupied games out of Leads", async () => {
    const localDiagnostics = diagnostics();
    const leads = await buildMediaLeadCandidates([{
      title: "《逃离鸭科夫》开发团队分享 Steam 实机",
      summary: "国产独立游戏开发团队分享制作过程。",
      source: "国内游戏媒体",
      link: "https://example.test/duckov",
      source_quality: 16,
      source_focus: ["china", "domestic_sourcing"],
      score: 90
    }], emptyIndex(), {
      reportDate: "2026-07-13",
      diagnostics: localDiagnostics,
      maxOfficialLookups: 0,
      maxExactSteamLookups: 4,
      sleepImpl: async () => {},
      fetchSteamExactTitleCandidatesImpl: async () => [{
        appId: "3167020",
        title: "逃离鸭科夫",
        release: "Oct 16, 2025"
      }],
      fetchAppDetailsImpl: async () => ({
        type: "game",
        name: "Escape From Duckov",
        developers: ["Team Soda"],
        publishers: ["bilibili"],
        release_date: { coming_soon: false, date: "Oct 16, 2025" },
        support_info: {}
      }),
      collectContactMethodsImpl: async () => []
    });

    assert.deepEqual(leads, []);
    assert.equal(localDiagnostics.media_exact_steam_lookup_attempts, 1);
    assert.equal(localDiagnostics.media_exact_steam_lookup_hits, 1);
    assert.equal(localDiagnostics.steam_evidence_lost, 0);
    assert.ok(localDiagnostics.media_released_routed_to_drop >= 1);
  });

  it("does not bind a single inexact Steam search result", () => {
    assert.equal(
      chooseExactSteamTitleCandidate("逃离鸭科夫", [{ appId: "3167020", title: "Duck Escape" }]),
      null
    );
  });

  it("does not bind an ambiguous exact-title Steam search", async () => {
    const localDiagnostics = diagnostics();
    const leads = await buildMediaLeadCandidates([{
      title: "《回声》国产独立游戏 Steam 实机",
      summary: "国内团队公布开发日志和试玩计划。",
      source: "国内游戏媒体",
      link: "https://example.test/echo",
      source_quality: 16,
      source_focus: ["china", "domestic_sourcing"],
      score: 90
    }], emptyIndex(), {
      reportDate: "2026-07-13",
      diagnostics: localDiagnostics,
      maxOfficialLookups: 0,
      maxExactSteamLookups: 4,
      sleepImpl: async () => {},
      fetchSteamExactTitleCandidatesImpl: async () => [
        { appId: "1", title: "Echo" },
        { appId: "2", title: "Echoes" }
      ]
    });

    assert.equal(leads.length, 1);
    assert.equal(leads[0].steam_app_id, null);
    assert.equal(localDiagnostics.media_exact_steam_lookup_hits, 0);
  });
});
