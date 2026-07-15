import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeByAppId, dedupeMediaSignals, selectDiverseMediaSignals } from "../jobs/online_daily_v4_dedupe.mjs";
import { buildPools, scoreCandidate } from "../jobs/online_daily_v4_decision.mjs";
import { validateDailyVolume } from "../jobs/online_daily_v4_volume.mjs";
import { evaluateSteamIndiePrelaunchAdmission, INDIE_PRELAUNCH_RULE_VERSION } from "../jobs/online_daily_v7_indie_admission.mjs";

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

  it("interleaves every qualified media and Steam lead, sets nullable provenance, and strips private fields", () => {
    const pools = buildPools(
      [
        candidate({
          appId: "100",
          title: "Steam Push",
          score: -500,
          _indieAdmissionEvidence: qualifiedEvidence({ project: "Steam Push", steam_app_id: "100", dedupe_key: "steam:100" })
        }),
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
        mediaLead({
          project: "Media Push",
          steam_app_id: "300",
          _class: "push",
          _indieAdmissionEvidence: qualifiedEvidence({ project: "Media Push", steam_app_id: "300", dedupe_key: "steam:300" })
        }),
        mediaLead({ project: "Media Watch", _class: "watch", priority: "P2" }),
        mediaLead({ project: "Media Drop", _class: "drop", bucket: "淘汰池", stage: "rejected", priority: "P3" })
      ],
      { reportDate: "2026-07-04" }
    );

    assert.deepEqual(pools.push.map((lead) => lead.project), ["Media Push", "Steam Push"]);
    assert.equal(pools.new_qualified_count, 2);
    assert.deepEqual(pools.watch, []);
    assert.deepEqual(pools.drop, []);
    assert.equal(pools.push[0].bucket, "未处理");
    assert.equal(pools.push[0].stage, "new");
    assert.equal(pools.push[0].priority, null);
    assert.equal(pools.push[0].sourcing_lane, "indie_prelaunch");
    assert.equal(pools.push[0].sourcing_rule_version, INDIE_PRELAUNCH_RULE_VERSION);
    assert.equal("_class" in pools.push[0], false);
    assert.equal("_indieAdmission" in pools.push[1], false);
    assert.equal(pools.push[1].id, "lead_steam_100_2026-07-04");
    assert.equal(pools.push[1].first_seen, "2026-07-04");
  });

  it("keeps a domestic demo launching within 60 days out of every formal report pool", () => {
    const nearLaunch = candidate({
      appId: "300",
      title: "Near Launch Domestic Demo",
      releaseTooSoon: true,
      releaseDate: "2026-07-20",
      daysToRelease: 16,
      score: 140,
      officialDemoEvidence: [{ type: "steam_demo", value: "official demo" }],
      officialGameplayEvidence: [{ type: "steam_gameplay", value: "official gameplay" }],
      qualityProofs: [{ type: "public_quality", value: "verified" }]
    });
    const pools = buildPools([nearLaunch], [], { reportDate: "2026-07-04" });
    const admission = evaluateSteamIndiePrelaunchAdmission(nearLaunch);

    assert.equal(pools.push.some((lead) => lead.project === "Near Launch Domestic Demo"), false);
    assert.equal(pools.watch.some((lead) => lead.project === "Near Launch Domestic Demo"), false);
    assert.equal(pools.drop.some((lead) => lead.project === "Near Launch Domestic Demo"), false);
    assert.equal(admission.disposition, "excluded");
    assert.match(admission.exclusion_reasons.join("\n"), /60 days or fewer/);
  });
});

function qualifiedEvidence(overrides = {}) {
  return {
    project: "Qualified",
    steam_app_id: "100",
    dedupe_key: "steam:100",
    region: "domestic",
    release_state: "prelaunch",
    release_window: "over_60",
    early_access_state: "no",
    publisher_occupancy: "clear",
    narrative_state: "no",
    india_team_state: "no",
    official_demo_evidence: [{ type: "steam_demo", value: "official demo" }],
    official_gameplay_evidence: [{ type: "official_gameplay", value: "official gameplay" }],
    quality_proofs: [{ type: "public_quality", value: "verified quality" }],
    business_entrypoints: [{ type: "Email", value: "bd@example.com" }],
    china_bilibili_value: "系统型玩法可形成机制讲解、效率挑战和长期栏目，并以简中本地化承接B站社区反馈。",
    china_demand: null,
    ...overrides
  };
}

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

  it("does not degrade health when formal Lead volume is below the historical target", () => {
    const result = validateDailyVolume({
      pools: {
        push: Array.from({ length: 13 }, (_, index) => mediaLead({ project: `Push ${index}` })),
        watch: [],
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
      newQualifiedCount: 13
    });

    assert.equal(result.ok, true);
    assert.equal(result.degraded, false);
    assert.equal(result.reviewCount, 13);
    assert.equal(result.rawCandidateCount, 202);
    assert.equal(result.enrichedCandidateCount, 90);
    assert.equal(result.mediaLeadCount, 11);
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.warnings, []);
  });

  it("keeps domestic media conversion volume diagnostic-only", () => {
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
      newQualifiedCount: 18
    });

    assert.equal(result.ok, true);
    assert.equal(result.degraded, false);
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.warnings, []);
  });

  it("passes when qualified and push counts match", () => {
    const result = validateDailyVolume({
      pools: {
        push: Array.from({ length: 18 }, (_, index) => mediaLead({ project: `Push ${index}` })),
        watch: [],
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
      newQualifiedCount: 18
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
