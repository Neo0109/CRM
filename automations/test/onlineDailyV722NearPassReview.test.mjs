import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildSourcingCandidateArtifact } from "../jobs/online_daily_v4_candidate_audit.mjs";
import { buildPools } from "../jobs/online_daily_v4_decision.mjs";
import { buildDailyReport } from "../jobs/online_daily_v4_reports.mjs";
import { REGULAR_SOURCING_RULE_VERSION } from "../jobs/online_daily_v7_2_regular_admission.mjs";

const nearPassModuleUrl = new URL("../jobs/online_daily_v7_2_near_pass_review.mjs", import.meta.url);
const nearPass = existsSync(nearPassModuleUrl) ? await import(nearPassModuleUrl) : {};
const indieFixture = JSON.parse(readFileSync(new URL("./fixtures/v7-indie-admission.json", import.meta.url), "utf8"));
const jointFixture = JSON.parse(readFileSync(new URL("./fixtures/v7-2-china-joint-admission.json", import.meta.url), "utf8"));
const reportDate = "2026-08-14";

const expectedCopy = {
  independent_quality_proof: {
    label: "独立质量证明",
    rule_fit: "Near-pass 人工复核：唯一缺失 gate=independent_quality_proof（独立质量证明）；其余硬性条件已通过。",
    risks: "Near-pass 唯一缺口：independent_quality_proof（独立质量证明）；需在首轮试玩/筛选中核验。"
  },
  overseas_china_demand: {
    label: "海外项目中国需求证明",
    rule_fit: "Near-pass 人工复核：唯一缺失 gate=overseas_china_demand（海外项目中国需求证明）；其余硬性条件已通过。",
    risks: "Near-pass 唯一缺口：overseas_china_demand（海外项目中国需求证明）；需在首轮试玩/筛选中核验。"
  },
  traction_or_proven_team_event: {
    label: "市场牵引或成熟团队事件",
    rule_fit: "Near-pass 人工复核：唯一缺失 gate=traction_or_proven_team_event（市场牵引或成熟团队事件）；其余硬性条件已通过。",
    risks: "Near-pass 唯一缺口：traction_or_proven_team_event（市场牵引或成熟团队事件）；需在首轮试玩/筛选中核验。"
  }
};

const expectedVerdict = "仅供首轮试玩/筛选，不代表正式商务推进，试玩不成立直接淘汰。";

describe("V7.2.2 bounded near-pass review publication", () => {
  it("exposes a pure eligibility contract and the exact active rule version", () => {
    assert.equal(REGULAR_SOURCING_RULE_VERSION, "sourcing-rules-v7.2.3-official-gameplay-value");
    assert.equal(nearPass.NEAR_PASS_REVIEW_LIMIT, 3);
    assert.deepEqual(nearPass.NEAR_PASS_GAP_LABELS, Object.fromEntries(
      Object.entries(expectedCopy).map(([gate, copy]) => [gate, copy.label])
    ));
    assert.equal(typeof nearPass.evaluateSteamNearPassReview, "function");
    assert.equal(typeof nearPass.evaluateMediaNearPassReview, "function");
    assert.equal(typeof nearPass.compareNearPassReviews, "function");
  });

  it("publishes live-shape steam:3473430 as a domestic quality-gap review Lead with exact warning copy", () => {
    const candidate = indieCandidate({
      appId: "3473430",
      title: "爱与机器人维修技术",
      region: "中国",
      qualityProofs: [],
      score: 92
    });
    const result = nearPass.evaluateSteamNearPassReview(candidate);
    const mediaResult = nearPass.evaluateMediaNearPassReview({
      project: candidate.title,
      steam_app_id: candidate.appId,
      region: candidate.region,
      media_score: 93,
      _indieAdmissionEvidence: candidate._indieAdmissionEvidence
    });
    const pools = buildPools([candidate], [], { reportDate });

    assert.deepEqual(pick(result, ["eligible", "gap_id", "sourcing_lane", "dedupe_key"]), {
      eligible: true,
      gap_id: "independent_quality_proof",
      sourcing_lane: "indie_prelaunch",
      dedupe_key: "steam:3473430"
    });
    assert.deepEqual(pick(mediaResult, ["eligible", "gap_id", "sourcing_lane", "dedupe_key", "source_type"]), {
      eligible: true,
      gap_id: "independent_quality_proof",
      sourcing_lane: "indie_prelaunch",
      dedupe_key: "steam:3473430",
      source_type: "media"
    });
    assert.equal(pools.strict_formal_count, 0);
    assert.equal(pools.near_pass_review_count, 1);
    assert.equal(pools.new_qualified_count, 1);
    assert.equal(pools.push.length, 1);
    assertReviewLead(pools.push[0], "independent_quality_proof", "indie_prelaunch");
    assert.equal(pools.push[0].steam_app_id, "3473430");
  });

  it("keeps live-shape steam:4868360 out because narrative/no-playable hard gates fail", () => {
    const candidate = indieCandidate({
      appId: "4868360",
      title: "Wind Tiger Cloud Dragon",
      region: "海外",
      narrativeHeavy: true,
      officialDemoEvidence: [],
      officialGameplayEvidence: [],
      qualityProofs: [],
      chinaDemandEvidence: null
    });
    const result = nearPass.evaluateSteamNearPassReview(candidate);
    const pools = buildPools([candidate], [], { reportDate });

    assert.equal(result.eligible, false);
    assert.ok(result.rejection_reasons.includes("non_narrative_product"));
    assert.ok(result.rejection_reasons.includes("official_demo_or_playtest_or_gameplay"));
    assert.equal(pools.push.length, 0);
    assert.equal(pools.near_pass_review_count, 0);
  });

  it("accepts exactly one allowed indie soft gap and rejects zero or two soft gaps", () => {
    const qualityGap = indieCandidate({ appId: "8800001", qualityProofs: [] });
    const demandGap = indieCandidate({
      appId: "8800002",
      region: "海外",
      qualityProofs: qualityProof("8800002"),
      chinaDemandEvidence: null
    });
    const twoGaps = indieCandidate({
      appId: "8800003",
      region: "海外",
      qualityProofs: [],
      chinaDemandEvidence: null
    });
    const noGaps = indieCandidate({ appId: "8800004", qualityProofs: qualityProof("8800004") });
    const demoOnly = indieCandidate({ appId: "8800005", qualityProofs: [], officialGameplayEvidence: [] });
    const gameplayOnly = indieCandidate({ appId: "8800006", qualityProofs: [], officialDemoEvidence: [] });

    assert.equal(nearPass.evaluateSteamNearPassReview(qualityGap).gap_id, "independent_quality_proof");
    assert.equal(nearPass.evaluateSteamNearPassReview(demandGap).gap_id, "overseas_china_demand");
    assert.equal(nearPass.evaluateSteamNearPassReview(twoGaps).eligible, false);
    assert.equal(nearPass.evaluateSteamNearPassReview(noGaps).eligible, false);
    assert.equal(nearPass.evaluateSteamNearPassReview(demoOnly).eligible, true);
    assert.equal(nearPass.evaluateSteamNearPassReview(gameplayOnly).eligible, true);
  });

  it("rejects unknown-region candidates with both quality and China-demand gates missing", () => {
    const result = nearPass.evaluateSteamNearPassReview(indieCandidate({
      appId: "8800007",
      region: "未知",
      qualityProofs: [],
      chinaDemandEvidence: null
    }));

    assert.equal(result.eligible, false);
    assert.ok(result.rejection_reasons.includes("region_unknown"));
  });

  it("rejects unknown-region candidates rather than treating China demand as an overseas-only near-pass gap", () => {
    const result = nearPass.evaluateSteamNearPassReview(indieCandidate({
      appId: "8800008",
      region: "未知",
      qualityProofs: qualityProof("8800008"),
      chinaDemandEvidence: null
    }));

    assert.equal(result.eligible, false);
    assert.ok(result.rejection_reasons.includes("region_unknown"));
  });

  it("rejects every locked indie hard-gate failure", () => {
    const failures = [
      ["steam_identity", { appId: null }],
      ["stable_dedupe", { appId: "8800102", dedupeKey: "project:unstable" }],
      ["prelaunch_window", { appId: "8800103", releaseWindow: "too_soon" }],
      ["non_early_access", { appId: "8800104", earlyAccess: true }],
      ["publisher_china_capacity_clear", { appId: "8800105", publisherOccupied: true }],
      ["non_narrative_product", { appId: "8800106", narrativeHeavy: true }],
      ["non_india_team", { appId: "8800107", indiaTeam: true }],
      ["official_demo_or_playtest_or_gameplay", { appId: "8800108", officialDemoEvidence: [], officialGameplayEvidence: [] }],
      ["non_steam_business_entry", { appId: "8800109", contactMethods: [{ type: "Steam", value: "https://steamcommunity.com/app/8800109" }] }],
      ["concrete_china_bilibili_value", { appId: "8800110", chinaBilibiliValue: null, genres: ["Adventure"], categories: ["Single-player"] }]
    ];

    for (const [reason, patch] of failures) {
      const result = nearPass.evaluateSteamNearPassReview(indieCandidate({ qualityProofs: [], ...patch }));
      assert.equal(result.eligible, false, reason);
      assert.ok(result.rejection_reasons.includes(reason), `${reason}: ${JSON.stringify(result)}`);
    }
  });

  it("accepts a traction-only china_joint gap and rejects each review-only hard requirement", () => {
    const base = jointCandidate({ appId: "8810001" });
    const accepted = nearPass.evaluateSteamNearPassReview(base);
    assert.deepEqual(pick(accepted, ["eligible", "gap_id", "sourcing_lane"]), {
      eligible: true,
      gap_id: "traction_or_proven_team_event",
      sourcing_lane: "china_joint"
    });

    const failures = [
      ["steam_identity", { appId: null }],
      ["stable_dedupe", { appId: "8810002", dedupeKey: "project:unstable" }],
      ["current_china_opportunity", { appId: "8810003", chinaOpportunityState: "absent", chinaOpportunityEvidence: [] }],
      ["mature_china_partner_clear", { appId: "8810004", chinaPartnerOccupied: true }],
      ["current_official_product_event", { appId: "8810005", currentOfficialProductEvents: [] }],
      ["official_demo_or_playtest_or_gameplay", { appId: "8810006", officialDemoEvidence: [], officialGameplayEvidence: [] }],
      ["non_steam_business_entry", { appId: "8810007", contactMethods: [{ type: "Steam", value: "https://steamcommunity.com/app/8810007" }] }]
    ];
    for (const [reason, patch] of failures) {
      const result = nearPass.evaluateSteamNearPassReview(jointCandidate(patch));
      assert.equal(result.eligible, false, reason);
      assert.ok(result.rejection_reasons.includes(reason), `${reason}: ${JSON.stringify(result)}`);
    }
  });

  it("keeps all strict formal Leads first and unlimited, then dedupes/sorts/caps review Leads at three", () => {
    const formal = Array.from({ length: 5 }, (_, index) => indieCandidate({
      appId: String(8820000 + index),
      title: `Formal ${index}`,
      qualityProofs: qualityProof(String(8820000 + index))
    }));
    const review = [
      indieCandidate({ appId: "8820105", title: "Demand Overseas", region: "海外", qualityProofs: qualityProof("8820105"), chinaDemandEvidence: null, score: 999 }),
      jointCandidate({ appId: "8820106", title: "Traction Domestic", region: "中国", score: 999 }),
      indieCandidate({ appId: "8820103", title: "Quality Overseas", region: "海外", qualityProofs: [], score: 900 }),
      indieCandidate({ appId: "8820102", title: "Quality Domestic No Event", region: "中国", qualityProofs: [], score: 1000, source: "Steam discovery fixture" }),
      indieCandidate({ appId: "8820101", title: "Quality Domestic Higher", region: "中国", qualityProofs: [], score: 20 }),
      indieCandidate({ appId: "8820101", title: "Duplicate Lower", region: "中国", qualityProofs: [], score: -100 })
    ];
    const duplicateFormal = indieCandidate({ appId: "8820000", title: "Formal duplicate near pass", qualityProofs: [] });
    const pools = buildPools([...formal, ...review, duplicateFormal], [], { reportDate });

    assert.equal(pools.strict_formal_count, 5);
    assert.equal(pools.near_pass_review_count, 3);
    assert.equal(pools.push.length, 8);
    assert.equal(pools.new_qualified_count, pools.push.length);
    assert.deepEqual(pools.push.slice(0, 5).map((lead) => lead.project), formal.map((item) => item.title));
    assert.deepEqual(pools.push.slice(5).map((lead) => lead.steam_app_id), ["8820101", "8820102", "8820103"]);
    assert.equal(new Set(pools.push.map((lead) => lead.steam_app_id)).size, pools.push.length);
  });

  it("records publication tier and count parity only in the candidate audit, not the Lead payload", () => {
    const formal = indieCandidate({ appId: "8830001", qualityProofs: qualityProof("8830001") });
    const review = indieCandidate({ appId: "8830002", qualityProofs: [] });
    const unpublished = indieCandidate({ appId: "8830003", qualityProofs: [], officialDemoEvidence: [], officialGameplayEvidence: [] });
    const enriched = [formal, review, unpublished];
    const pools = buildPools(enriched, [], { reportDate });
    const artifact = buildSourcingCandidateArtifact({
      reportDate,
      capturedAt: `${reportDate}T08:00:00+08:00`,
      ruleVersion: REGULAR_SOURCING_RULE_VERSION,
      rawSteamCandidates: enriched,
      enrichedSteamCandidates: enriched,
      candidatePools: pools,
      publishedPools: pools
    });

    assert.equal(pools.push.some((lead) => "publication_tier" in lead), false);
    assert.ok(pools.push.every((lead) => Object.keys(lead).every((key) => !key.startsWith("_"))));
    assert.equal(artifact.scan_summary.strict_formal_count, 1);
    assert.equal(artifact.scan_summary.near_pass_review_count, 1);
    assert.equal(artifact.scan_summary.new_qualified_count, 2);
    assert.equal(artifact.scan_summary.push_pool_count, 2);
    assert.equal(
      artifact.scan_summary.strict_formal_count + artifact.scan_summary.near_pass_review_count,
      artifact.scan_summary.push_pool_count
    );
    assert.equal(artifact.candidates.find((item) => item.steam_app_id === "8830001").publication_tier, "strict_formal");
    assert.equal(artifact.candidates.find((item) => item.steam_app_id === "8830002").publication_tier, "near_pass_review");
    assert.equal(artifact.candidates.find((item) => item.steam_app_id === "8830002").sourcing_lane, "indie_prelaunch");
    assert.equal(artifact.candidates.find((item) => item.steam_app_id === "8830003").publication_tier, null);
    assert.throws(() => buildSourcingCandidateArtifact({
      reportDate,
      capturedAt: `${reportDate}T08:00:00+08:00`,
      ruleVersion: REGULAR_SOURCING_RULE_VERSION,
      rawSteamCandidates: enriched,
      enrichedSteamCandidates: enriched,
      candidatePools: pools,
      publishedPools: { ...pools, near_pass_review_count: 0 }
    }), /SOURCING_PUBLICATION_TIER_PARITY_MISMATCH/);

    const report = buildDailyReport({
      pools,
      rawCount: enriched.length,
      enrichedCount: enriched.length,
      mediaLeadCount: 0,
      reportDate,
      diagnostics: { bilibili_probe: {}, bilibili_official_source_hits: 0 }
    });
    assert.match(report.summary, /严格正式共 1 条/);
    assert.match(report.summary, /near-pass 人工复核 1 条/);
    assert.equal("strict_formal_count" in report, false);
    assert.equal("near_pass_review_count" in report, false);

    const schema = JSON.parse(readFileSync(new URL("../../schemas/sourcing_candidates.schema.json", import.meta.url), "utf8"));
    assert.ok(schema.$defs.scanSummary.properties.strict_formal_count);
    assert.ok(schema.$defs.scanSummary.properties.near_pass_review_count);
    assert.deepEqual(schema.$defs.candidate.properties.publication_tier.enum, ["strict_formal", "near_pass_review", null]);
  });
});

function indieCandidate(overrides = {}) {
  const appId = overrides.appId === undefined ? "8890001" : overrides.appId;
  const region = overrides.region ?? "中国";
  const releaseWindow = overrides.releaseWindow ?? "over_60";
  const demo = overrides.officialDemoEvidence ?? [{ type: "steam_demo", url: `https://store.steampowered.com/app/${appId}/` }];
  const gameplay = overrides.officialGameplayEvidence ?? [{ type: "official_gameplay_video", url: `https://studio.example/${appId}/gameplay` }];
  const quality = overrides.qualityProofs ?? [];
  const contacts = overrides.contactMethods ?? [{ type: "Email", value: `bd+${appId}@studio.example` }];
  const bilibili = Object.prototype.hasOwnProperty.call(overrides, "chinaBilibiliValue")
    ? overrides.chinaBilibiliValue
    : indieFixture.qualified_base.china_bilibili_value;
  const demand = Object.prototype.hasOwnProperty.call(overrides, "chinaDemandEvidence")
    ? overrides.chinaDemandEvidence
    : region === "海外" ? "The studio is currently seeking a China publishing partner." : null;
  const dedupeKey = overrides.dedupeKey ?? (appId ? `steam:${appId}` : null);
  return steamCandidateBase({
    appId,
    title: overrides.title ?? `Indie ${appId}`,
    region,
    source: overrides.source ?? "Steam current product event fixture",
    score: overrides.score ?? 0,
    earlyAccess: overrides.earlyAccess ?? false,
    publisherOccupied: overrides.publisherOccupied ?? false,
    narrativeHeavy: overrides.narrativeHeavy ?? false,
    indiaTeam: overrides.indiaTeam ?? false,
    contactMethods: contacts,
    genres: overrides.genres ?? ["Strategy", "Simulation"],
    categories: overrides.categories ?? ["Single-player"],
    _indieAdmissionEvidence: {
      ...indieFixture.qualified_base,
      project: overrides.title ?? `Indie ${appId}`,
      steam_app_id: appId,
      dedupe_key: dedupeKey,
      region: region === "海外" ? "overseas" : region === "中国" ? "domestic" : "unknown",
      release_state: "prelaunch",
      release_window: releaseWindow,
      early_access_state: overrides.earlyAccess ? "yes" : "no",
      publisher_occupancy: overrides.publisherOccupied ? "occupied" : "clear",
      narrative_state: overrides.narrativeHeavy ? "yes" : "no",
      india_team_state: overrides.indiaTeam ? "yes" : "no",
      official_demo_evidence: demo,
      official_gameplay_evidence: gameplay,
      quality_proofs: quality,
      business_entrypoints: contacts,
      china_bilibili_value: bilibili,
      china_demand: demand
    }
  });
}

function jointCandidate(overrides = {}) {
  const appId = overrides.appId === undefined ? "8891001" : overrides.appId;
  const title = overrides.title ?? `Joint ${appId}`;
  const region = overrides.region ?? "中国";
  const contacts = overrides.contactMethods ?? [{ type: "Email", value: `bd+${appId}@joint.example` }];
  const event = overrides.currentOfficialProductEvents ?? [{
    type: "official_gameplay_reveal",
    value: "Current official gameplay reveal",
    url: `https://joint.example/${appId}/event`,
    official: true,
    current: true
  }];
  const opportunities = overrides.chinaOpportunityEvidence ?? [{
    type: "china_publishing",
    value: "The studio is currently seeking a China publishing partner.",
    url: `https://joint.example/${appId}/china`,
    current: true,
    official: true
  }];
  const demo = overrides.officialDemoEvidence ?? [{ type: "steam_demo", url: `https://store.steampowered.com/app/${appId}/` }];
  const gameplay = overrides.officialGameplayEvidence ?? [{ type: "official_gameplay_video", url: `https://joint.example/${appId}/gameplay` }];
  const dedupeKey = overrides.dedupeKey ?? (appId ? `steam:${appId}` : null);
  return steamCandidateBase({
    appId,
    title,
    region,
    score: overrides.score ?? 0,
    contactMethods: contacts,
    chinaPartnerOccupied: overrides.chinaPartnerOccupied ?? false,
    _indieAdmissionEvidence: {
      ...indieFixture.qualified_base,
      project: title,
      steam_app_id: appId,
      dedupe_key: dedupeKey,
      region: region === "海外" ? "overseas" : "domestic",
      release_state: "released",
      release_window: "too_soon",
      official_demo_evidence: demo,
      official_gameplay_evidence: gameplay,
      quality_proofs: [],
      business_entrypoints: contacts
    },
    _chinaJointAdmissionEvidence: {
      ...jointFixture.china_joint_base,
      project: title,
      steam_app_id: appId,
      dedupe_key: dedupeKey,
      recommendation_count: 100,
      review_rating: "positive",
      verified_major_title_records: [],
      current_official_product_events: event,
      china_opportunities: opportunities,
      china_opportunity_state: overrides.chinaOpportunityState ?? (opportunities.length ? "present" : "absent"),
      china_partner_occupancy: overrides.chinaPartnerOccupied ? "occupied" : "clear"
    }
  });
}

function steamCandidateBase(overrides) {
  return {
    appId: overrides.appId,
    title: overrides.title,
    source: overrides.source ?? "Steam current product event fixture",
    score: overrides.score ?? 0,
    genres: overrides.genres ?? ["Strategy", "Simulation"],
    categories: overrides.categories ?? ["Single-player"],
    developers: ["Fixture Studio"],
    publishers: [],
    country: overrides.region === "海外" ? "海外" : "中国（待确认）",
    region: overrides.region,
    releaseDate: "2027-01-01",
    daysToRelease: 169,
    alreadyReleased: false,
    releaseTooSoon: false,
    comingSoon: true,
    earlyAccess: false,
    publisherOccupied: false,
    chinaPartnerOccupied: false,
    narrativeHeavy: false,
    indiaTeam: false,
    strongGameplay: true,
    highVisual: true,
    strongData: false,
    validatedPcHit: false,
    mobileAdaptationPotential: false,
    hasDemoSignal: true,
    hasDetails: true,
    contactMethods: [],
    storeUrl: overrides.appId ? `https://store.steampowered.com/app/${overrides.appId}/` : null,
    steamDbUrl: overrides.appId ? `https://steamdb.info/app/${overrides.appId}/` : null,
    website: "https://fixture-studio.example",
    shortDescription: "A systems-heavy strategy game.",
    recommendationCount: 100,
    screenshotCount: 6,
    movieCount: 1,
    ...overrides
  };
}

function qualityProof(appId) {
  return [{
    type: "verified_public_traction",
    value: "1200 Steam recommendations",
    url: `https://store.steampowered.com/app/${appId}/`
  }];
}

function assertReviewLead(lead, gapId, lane) {
  assert.equal(lead.bucket, "未处理");
  assert.equal(lead.stage, "new");
  assert.equal(lead.priority, null);
  assert.equal(lead.sourcing_lane, lane);
  assert.equal(lead.rule_fit, expectedCopy[gapId].rule_fit);
  assert.match(lead.risks, new RegExp(expectedCopy[gapId].risks.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(lead.verdict, expectedVerdict);
}

function pick(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, value?.[key]]));
}
