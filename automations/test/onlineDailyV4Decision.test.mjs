import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeByAppId, dedupeMediaSignals, selectDiverseMediaSignals } from "../jobs/online_daily_v4_dedupe.mjs";
import { buildPools, scoreCandidate } from "../jobs/online_daily_v4_decision.mjs";
import { validateDailyVolume } from "../jobs/online_daily_v4_volume.mjs";

function candidate(overrides = {}) {
  return {
    appId: "100",
    title: "Steam Push",
    source: "Steam CN Demo/Next Fest Upcoming",
    domesticLens: true,
    domesticQuery: true,
    domestic: true,
    hasDemoSignal: true,
    strongGameplay: true,
    highVisual: true,
    strongData: true,
    validatedPcHit: true,
    mobileAdaptationPotential: true,
    comingSoon: true,
    hasDetails: true,
    contactCount: 1,
    alreadyReleased: false,
    releaseTooSoon: false,
    publisherOccupied: false,
    earlyAccess: false,
    narrativeHeavy: false,
    indiaTeam: false,
    score: 92,
    genres: ["Strategy", "Simulation"],
    categories: ["Single-player"],
    developers: ["Demo Studio"],
    publishers: [],
    country: "中国",
    region: "中国",
    releaseDate: "Coming soon",
    daysToRelease: 120,
    contactMethods: [{ type: "官网", value: "https://demo.example.com", note: "Official site" }],
    storeUrl: "https://store.steampowered.com/app/100/",
    steamDbUrl: "https://steamdb.info/app/100/",
    website: "https://demo.example.com",
    shortDescription: "A systems-heavy strategy demo.",
    recommendationCount: 120,
    screenshotCount: 6,
    movieCount: 1,
    ...overrides
  };
}

function mediaLead(overrides = {}) {
  return {
    _class: "push",
    project: "Media Push",
    steam_app_id: null,
    bucket: "未处理",
    stage: "new",
    priority: "P1",
    links: ["https://www.bilibili.com/video/BVdemo/"],
    contact_methods: [],
    progress: "试玩 Demo",
    gameplay: "Strategy",
    public_signals: "B站官方复核 / BVdemo",
    ...overrides
  };
}

describe("online daily v4 decision helpers", () => {
  it("scores domestic demo leads above overseas leads without PC validation and applies hard penalties", () => {
    const domesticDemoScore = scoreCandidate(candidate());
    const overseasUnvalidatedScore = scoreCandidate(candidate({
      source: "Steam Popular Upcoming",
      domesticLens: false,
      domesticQuery: false,
      domestic: false,
      hasDemoSignal: false,
      strongGameplay: false,
      highVisual: false,
      strongData: false,
      validatedPcHit: false,
      mobileAdaptationPotential: false,
      contactCount: 0
    }));
    const penalizedScore = scoreCandidate(candidate({
      alreadyReleased: true,
      earlyAccess: true,
      publisherOccupied: true,
      narrativeHeavy: true,
      indiaTeam: true
    }));

    assert.ok(domesticDemoScore > 100);
    assert.ok(overseasUnvalidatedScore < domesticDemoScore - 80);
    assert.ok(penalizedScore < 0);
  });

  it("interleaves media and Steam leads, keeps pool states stable, and strips private fields", () => {
    const pools = buildPools(
      [
        candidate({ appId: "100", title: "Steam Push", score: 92 }),
        candidate({
          appId: "200",
          title: "Steam Drop",
          score: -40,
          alreadyReleased: true,
          storeUrl: "https://store.steampowered.com/app/200/",
          steamDbUrl: "https://steamdb.info/app/200/"
        })
      ],
      [
        mediaLead({ project: "Media Push", _class: "push" }),
        mediaLead({ project: "Media Watch", _class: "watch", priority: "P2" }),
        mediaLead({ project: "Media Drop", _class: "drop", bucket: "淘汰池", stage: "rejected", priority: "P3" })
      ],
      { reportDate: "2026-07-04", minReviewLeads: 2, minReviewBackfillScore: 18 }
    );

    assert.deepEqual(pools.push.map((lead) => lead.project), ["Media Push", "Steam Push"]);
    assert.equal(pools.push[0].bucket, "未处理");
    assert.equal(pools.push[0].stage, "new");
    assert.equal(pools.drop[0].bucket, "淘汰池");
    assert.equal(pools.drop[0].stage, "rejected");
    assert.equal("_class" in pools.push[0], false);
    assert.equal("_reviewBackfill" in pools.push[1], false);
    assert.equal(pools.push[1].id, "lead_steam_100_2026-07-04");
    assert.equal(pools.push[1].first_seen, "2026-07-04");
  });

  it("routes domestic demo candidates launching within 60 days to drop instead of review", () => {
    const pools = buildPools([
      candidate({
        appId: "300",
        title: "Near Launch Domestic Demo",
        releaseTooSoon: true,
        releaseDate: "2026-07-20",
        daysToRelease: 16,
        score: 140
      })
    ], [], { reportDate: "2026-07-04", minReviewLeads: 1, minReviewBackfillScore: 8 });

    assert.equal(pools.push.some((lead) => lead.project === "Near Launch Domestic Demo"), false);
    assert.equal(pools.watch.some((lead) => lead.project === "Near Launch Domestic Demo"), false);
    assert.equal(pools.drop[0].project, "Near Launch Domestic Demo");
    assert.equal(pools.drop[0].drop_reason, "窗口不合适");
    assert.equal(pools.drop[0].priority_reason, null);
    assert.match(`${pools.drop[0].rule_fit} ${pools.drop[0].risks}`, /不足60天|窗口不合适/);
  });
});

describe("online daily v4 volume and dedupe helpers", () => {
  function baseDiagnostics(overrides = {}) {
    return {
      media_signals_raw: 18,
      media_stale_filtered: 2,
      media_banned_filtered: 1,
      media_low_score_filtered: 3,
      media_non_product_filtered: 4,
      media_duplicate_filtered: 5,
      bilibili_official_source_hits: 1,
      media_expanded_product_candidates: 6,
      media_rescue_product_candidates: 7,
      media_released_routed_to_drop: 8,
      ...overrides
    };
  }

  it("publishes degraded diagnostics when review volume is below the quality target", () => {
    const warnings = [];
    const result = validateDailyVolume({
      pools: {
        push: Array.from({ length: 8 }, (_, index) => mediaLead({ project: `Push ${index}` })),
        watch: Array.from({ length: 5 }, (_, index) => mediaLead({ project: `Watch ${index}` })),
        drop: []
      },
      mediaSignals: Array.from({ length: 18 }, (_, index) => ({
        title: `domestic ${index}`,
        source_focus: ["domestic_sourcing"]
      })),
      mediaLeadCandidates: Array.from({ length: 11 }, (_, index) => mediaLead({ project: `Media ${index}` })),
      rawCandidateCount: 202,
      enrichedCandidateCount: 90,
      diagnostics: baseDiagnostics({ media_signals_raw: 624 }),
      minReviewLeads: 18,
      minMediaLeadsWhenHealthy: 10,
      logger: { warn: (message) => warnings.push(message) }
    });

    assert.equal(result.ok, false);
    assert.equal(result.degraded, true);
    assert.equal(result.reviewCount, 13);
    assert.equal(result.rawCandidateCount, 202);
    assert.equal(result.enrichedCandidateCount, 90);
    assert.equal(result.mediaLeadCount, 11);
    assert.deepEqual(result.issues.map((issue) => issue.code), ["review_leads_low"]);
    assert.match(result.warnings[0], /push\+watch=13, expected >= 18/);
    assert.deepEqual(warnings, result.warnings);
  });

  it("reports domestic media under-conversion without blocking publication", () => {
    const result = validateDailyVolume({
      pools: { push: Array.from({ length: 18 }, (_, index) => mediaLead({ project: `Push ${index}` })), watch: [], drop: [] },
      mediaSignals: Array.from({ length: 18 }, (_, index) => ({
        title: `domestic ${index}`,
        source_focus: ["bilibili"]
      })),
      mediaLeadCandidates: [mediaLead()],
      rawCandidateCount: 40,
      enrichedCandidateCount: 20,
      diagnostics: baseDiagnostics({ media_signals_raw: 18 }),
      minReviewLeads: 18,
      minMediaLeadsWhenHealthy: 10,
      logger: { warn: () => {} }
    });

    assert.equal(result.ok, false);
    assert.equal(result.degraded, true);
    assert.deepEqual(result.issues.map((issue) => issue.code), ["domestic_media_leads_low"]);
    assert.match(result.warnings[0], /Domestic media\/Bilibili lead extraction low/);
  });

  it("passes when review and media conversion volume meet production thresholds", () => {
    const result = validateDailyVolume({
      pools: {
        push: Array.from({ length: 10 }, (_, index) => mediaLead({ project: `Push ${index}` })),
        watch: Array.from({ length: 8 }, (_, index) => mediaLead({ project: `Watch ${index}` })),
        drop: []
      },
      mediaSignals: Array.from({ length: 18 }, (_, index) => ({
        title: `domestic ${index}`,
        source_focus: ["domestic_sourcing"]
      })),
      mediaLeadCandidates: Array.from({ length: 10 }, (_, index) => mediaLead({ project: `Media ${index}` })),
      rawCandidateCount: 80,
      enrichedCandidateCount: 40,
      diagnostics: baseDiagnostics({ media_signals_raw: 18 }),
      minReviewLeads: 18,
      minMediaLeadsWhenHealthy: 10,
      logger: { warn: () => { throw new Error("unexpected low-volume warning"); } }
    });

    assert.equal(result.ok, true);
    assert.equal(result.degraded, false);
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.reviewCount, 18);
    assert.equal(result.domesticSignalCount, 18);
    assert.equal(result.mediaLeadCount, 10);
  });

  it("deduplicates Steam app IDs by source priority and media signals by title", () => {
    assert.deepEqual(dedupeByAppId([
      { appId: 123, source: "Steam Popular Upcoming", title: "Plain" },
      { appId: "123", source: "Steam CN Demo Keyword", title: "国产 Demo", domesticQuery: true }
    ]), [
      { appId: "123", source: "Steam CN Demo Keyword", title: "国产 Demo", domesticQuery: true }
    ]);

    assert.deepEqual(dedupeMediaSignals([
      { title: " 国产试玩 Demo ", source: "A" },
      { title: "国产试玩 Demo", source: "B" },
      { title: "Another", source: "C" }
    ]), [
      { title: " 国产试玩 Demo ", source: "A" },
      { title: "Another", source: "C" }
    ]);
  });

  it("deduplicates probe media signals by BVID, link, and Steam AppID while keeping official sources", () => {
    const official = {
      title: "九宫幻境录 官方PV",
      source: "B站探头-官方源",
      link: "https://www.bilibili.com/video/BVOFFICIAL/",
      source_quality: 1000,
      bilibili_probe: {
        source_kind: "official",
        steam_app_id: "2921670"
      }
    };
    const creatorDuplicate = {
      title: "九宫幻境录 Demo 试玩",
      source: "B站探头-可信UP",
      link: "https://www.bilibili.com/video/BVREC/",
      source_quality: 500,
      bilibili_probe: {
        source_kind: "trusted_creator",
        steam_app_id: "2921670"
      }
    };
    const linkDuplicate = {
      title: "另一个标题",
      source: "B站探头-关键词",
      link: "https://www.bilibili.com/video/BVOFFICIAL/",
      source_quality: 100,
      bilibili_probe: {
        source_kind: "keyword",
        steam_app_id: null
      }
    };
    const other = {
      title: "另一款国产策略 Demo",
      source: "B站探头-开发者源",
      link: "https://www.bilibili.com/video/BVDEV/",
      source_quality: 900,
      bilibili_probe: {
        source_kind: "developer",
        steam_app_id: "3000000"
      }
    };

    const deduped = dedupeMediaSignals([creatorDuplicate, linkDuplicate, other, official]);
    assert.deepEqual(deduped.map(({ bilibili_evidence, ...item }) => item), [official, other]);
    assert.deepEqual(deduped[0].bilibili_evidence.source_urls, [
      "https://www.bilibili.com/video/BVOFFICIAL/",
      "https://www.bilibili.com/video/BVREC/"
    ]);
  });

  it("selects radar signals with configured diversity caps and limit", () => {
    const signals = [
      { title: "国产策略新作公布 Demo", summary: "国产团队公开 Steam 试玩", source: "Source A", source_focus: ["china"] },
      { title: "国产模拟新作公布 Demo", summary: "国产团队公开 Steam 试玩", source: "Source A", source_focus: ["china"] },
      { title: "国产动作新作公布 Demo", summary: "国产团队公开 Steam 试玩", source: "Source B", source_focus: ["china"] },
      { title: "国产解谜新作公布 Demo", summary: "国产团队公开 Steam 试玩", source: "Source C", source_focus: ["china"] }
    ];
    const diversity = {
      limit: 3,
      sourceCap: 1,
      familyCap: 4,
      regionCap: 8,
      targets: [{ category: "今日亮点", region: "china", count: 3 }]
    };

    assert.deepEqual(
      selectDiverseMediaSignals(signals, undefined, diversity).map((item) => item.source),
      ["Source A", "Source B", "Source C"]
    );
  });
});
