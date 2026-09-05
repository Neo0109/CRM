import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import * as admission from "../jobs/online_daily_v7_indie_admission.mjs";
import { enrichSteamCandidate } from "../jobs/online_daily_v4_steam_source.mjs";
import { evaluateSteamNearPassReview } from "../jobs/online_daily_v7_2_near_pass_review.mjs";
import { buildPools } from "../jobs/online_daily_v4_decision.mjs";
import { buildSourcingCandidateArtifact } from "../jobs/online_daily_v4_candidate_audit.mjs";
import { buildDailyReport } from "../jobs/online_daily_v4_reports.mjs";
import { RULE_VERSION } from "../jobs/online_daily_v4_rules.mjs";

const samples = JSON.parse(readFileSync(new URL("./fixtures/v723-official-gameplay.json", import.meta.url)));
const reportDate = "2026-09-06";
const derive = (input) => {
  assert.equal(typeof admission.deriveOfficialGameplayChinaBilibiliValue, "function");
  return admission.deriveOfficialGameplayChinaBilibiliValue(input);
};
const detailsFor = (body, short = "") => ({
  steam_appid: 9900700, type: "game", name: "Fixture",
  short_description: short, about_the_game: body,
  genres: [{ description: "Action" }], categories: [{ description: "Single-player" }]
});
const context = { reportDate, collectContactMethodsImpl: async () => [], scoreCandidateImpl: () => 0 };
const candidateFor = (details) => ({ appId: String(details.steam_appid), title: details.name, source: "Steam upcoming", tags: [], release: "Coming soon" });

describe("V7.2.3 official gameplay content value", () => {
  it("fills the five frozen official samples in both production English and Chinese without altering input", async () => {
    assert.equal(samples.length, 10);
    for (const sample of samples) {
      const before = JSON.stringify(sample);
      const value = derive(sample);
      assert.ok(value, sample.appId + " " + sample.language);
      assert.doesNotMatch(value, /好玩|畅销|合作意愿|市场表现|中国需求已/);
      const enriched = await enrichSteamCandidate(candidateFor(sample.details), sample.details, context);
      const legacy = admission.deriveConcreteChinaBilibiliValue(enriched.genres.join(" ") + " " + enriched.categories.join(" "));
      assert.equal(legacy, null, "frozen Steam baseline lacks value: " + sample.appId);
      assert.equal(enriched.chinaBilibiliValue, value);
      const withoutFallback = { ...enriched, chinaBilibiliValue: legacy };
      const oldEvidence = admission.steamIndieAdmissionEvidence(withoutFallback);
      const newEvidence = admission.steamIndieAdmissionEvidence(enriched);
      assert.equal(oldEvidence.china_bilibili_value, null);
      assert.deepEqual({ ...newEvidence, china_bilibili_value: null }, oldEvidence);
      assert.equal(admission.evaluateSteamIndiePrelaunchAdmission(enriched).qualified, false,
        "content text alone must not qualify a sample");
      assert.equal(JSON.stringify(sample), before);
    }
  });

  it("recognizes concrete action/result pairs, including HTML headings and entities", () => {
    const positives = [
      ["In Fixture, perfect parry attacks generate energy to unleash a finisher.", /连招教学/],
      ["<h2>Co-op kitchen</h2><p>Players coordinate cooking and carry ingredients to complete customer orders.</p>", /组队/],
      ["<p>经营工厂：分配工人并连接生产线，提高资源产出。</p>", /机制讲解/],
      ["<p>Deckbuilding: combine cards and spend mana to trigger chained attacks.</p>", /流派复盘/],
      ["<p>利用物理摆荡抓取物体，越过障碍并破解谜题。</p>", /技巧展示/],
      ["<h2>Ki combat</h2><p>Perfect parry &amp; combo attacks generate energy to unleash a finisher.</p>", /连招教学/],
      ["<p>Survival shooter: collect ammunition and upgrade weapons to survive enemy waves.</p>", /战斗攻略/]
    ];
    for (const [body, expected] of positives) assert.match(derive({ appId: "9900700", details: detailsFor(body) }), expected);
  });

  it("rejects vague, promotional, negated, comparative and unrelated text", () => {
    const negatives = [
      "国产动作游戏，精美画面，爽快连招，华丽战斗！",
      "Action physics combat deckbuilding co-op survival shooter.",
      "A masterpiece with amazing combat and beautiful physics.",
      "A cooperative action game where players defeat bosses.",
      "多人协作游戏，协作挑战，击败强大的Boss。",
      "Combine cards without triggering attacks.",
      "Players fail to combine cards to trigger attacks.",
      "Try combining cards, but fail to trigger attacks.",
      "Players avoid combining cards to trigger attacks.",
      "It is impossible to combine cards to trigger attacks.",
      "格挡不破防。",
      "In Street Fighter, perfect parry attacks generate energy to unleash a finisher. This game is a walking simulator.",
      "In Street Fighter players combine attacks to unleash combos.",
      "Perfect parries do not generate energy.",
      "Perfect parries don’t generate energy.",
      "连段攻击不会提高内力，也不触发反击。",
      "组合卡牌并不产生伤害。",
      "Collect ammunition and upgrade weapons, but these upgrades never make you stronger.",
      "本作没有连段和格挡，也不能消耗内力释放剑招。",
      "Physics swinging cannot be used to solve puzzles.",
      "This game does not let players combine cards to trigger attacks.",
      "No co-op cooking or carrying ingredients to complete orders.",
      "Unlike Other Game, where you parry attacks to gain energy, this game is a walking simulator.",
      "类似《其他游戏》：连段攻击获得内力，消耗内力释放剑招。",
      "Like Dark Souls, perfect parry attacks generate energy to unleash a finisher.",
      "<p>In <a href=\"https://store.steampowered.com/app/123/\">another title</a>, perfect parry generates energy to unleash a finisher.</p>",
      "<blockquote>Review: combine attacks to unleash combos.</blockquote>",
      "<p>连段和取消。</p><p>经营画廊获得收益。</p>",
      "<p>第三人称射击。</p><p>收集服装，改变外观。</p>",
      "<p>Card game.</p><p>Walk through a gallery to learn its history.</p>",
      "<script>Perfect parry generates energy to unleash a finisher.</script>",
      "<p>Wishlist now!</p><img alt='Perfect parry generates energy to unleash a finisher.'>"
    ];
    for (const body of negatives) assert.equal(derive({ appId: "9900700", details: detailsFor(body) }), null, body);
  });

  it("requires a bound official full-game details object and ignores nonofficial fields", () => {
    const good = detailsFor("Perfect parry and combo attacks generate energy to unleash a finisher.");
    for (const input of [
      {}, { appId: "9900700" }, { appId: "123", details: good },
      { appId: "9900700", details: { ...good, steam_appid: undefined } },
      { appId: "9900700", details: { ...good, type: "demo" } },
      { appId: "9900700", details: { ...good, type: "dlc" } },
      { appId: "9900700", details: { ...good, fullgame: { appid: 123 } } },
      { appId: "9900700", details: { ...good, type: undefined } },
      { appId: "9900700", details: { ...detailsFor(""), recommendation: good.about_the_game, tags: [good.about_the_game] } }
    ]) assert.equal(derive(input), null);
    assert.equal(admission.mediaIndieAdmissionEvidence({
      steam_app_id: "9900700", project: "Fixture",
      _mediaItem: { summary: good.about_the_game },
      _steamEntityResolution: { details: detailsFor("") }
    }).china_bilibili_value, null);
  });

  it("shares the fallback across Steam/media while preserving explicit and legacy results", async () => {
    const details = detailsFor("<p>Perfect parry and combo attacks generate energy to unleash a finisher.</p>");
    const raw = candidateFor(details);
    const steam = await enrichSteamCandidate(raw, details, context);
    const media = { project: details.name, steam_app_id: raw.appId, _steamEntityResolution: { details } };
    assert.equal(admission.mediaIndieAdmissionEvidence(media).china_bilibili_value, steam.chinaBilibiliValue);
    assert.equal(admission.mediaIndieAdmissionEvidence({ ...media, steam_app_id: "123" }).china_bilibili_value, null);
    assert.equal((await enrichSteamCandidate({ ...raw, chinaBilibiliValue: "Existing verified content hook" }, details, context)).chinaBilibiliValue, "Existing verified content hook");
    assert.equal(admission.mediaIndieAdmissionEvidence({ ...media, chinaBilibiliValue: "Existing verified content hook" }).china_bilibili_value, "Existing verified content hook");
    assert.equal(admission.mediaIndieAdmissionEvidence({ ...media, _indieAdmissionEvidence: { china_bilibili_value: "Reviewed override" } }).china_bilibili_value, "Reviewed override");
    const strategy = { ...details, genres: [{ description: "Strategy" }] };
    assert.equal((await enrichSteamCandidate(raw, strategy, context)).chinaBilibiliValue, admission.deriveConcreteChinaBilibiliValue("Strategy"));
  });

  it("cannot compensate for hard failures or two soft gaps after filling value", async () => {
    const base = await completeCandidate();
    assert.equal(evaluateSteamNearPassReview(base).eligible, true);
    assert.equal(admission.evaluateSteamIndiePrelaunchAdmission(base).qualified, false);
    for (const patch of [
      { officialDemoEvidence: [], officialGameplayEvidence: [] },
      { daysToRelease: 30, releaseDate: "2026-10-06" },
      { alreadyReleased: true }, { earlyAccess: true },
      { publisherOccupied: true }, { narrativeHeavy: true }, { indiaTeam: true },
      { region: "未知" }, { region: "海外", chinaDemandEvidence: null },
      { contactMethods: [] }
    ]) {
      const item = { ...base, ...patch };
      assert.equal(evaluateSteamNearPassReview(item).eligible, false, JSON.stringify(patch));
      assert.equal(buildPools([item], [], { reportDate }).push.length, 0, JSON.stringify(patch));
    }
  });

  it("keeps strict Leads unlimited, review capped at three, cross-source dedupe and audit/report parity", async () => {
    const base = await completeCandidate();
    const make = (id, strict) => ({
      ...base, appId: String(id), title: "Fixture " + id,
      storeUrl: "https://store.steampowered.com/app/" + id + "/",
      qualityProofs: strict ? [{ type: "verified_public_data", value: "600 recommendations" }] : []
    });
    const strict = Array.from({ length: 7 }, (_, i) => make(9900710 + i, true));
    const review = Array.from({ length: 5 }, (_, i) => make(9900720 + i, false));
    const media = [{
      project: strict[0].title, steam_app_id: strict[0].appId,
      _indieAdmissionEvidence: admission.steamIndieAdmissionEvidence(strict[0])
    }];
    const enriched = [...strict, ...review, { ...review[0] }];
    const pools = buildPools(enriched, media, { reportDate });
    assert.equal(pools.strict_formal_count, 7);
    assert.equal(pools.near_pass_review_count, 3);
    assert.equal(pools.push.length, 10);
    assert.equal(new Set(pools.push.map(x => x.steam_app_id)).size, 10);
    assert.deepEqual(pools.push.slice(0, 7).map(x => x.steam_app_id).sort(), strict.map(x => x.appId).sort());
    const audit = buildSourcingCandidateArtifact({
      reportDate, capturedAt: reportDate + "T08:00:00+08:00", ruleVersion: RULE_VERSION,
      rawSteamCandidates: enriched, enrichedSteamCandidates: enriched,
      mediaLeads: media, candidatePools: pools, publishedPools: pools
    });
    assert.equal(audit.scan_summary.push_pool_count, 10);
    assert.equal(audit.scan_summary.strict_formal_count + audit.scan_summary.near_pass_review_count, 10);
    const report = buildDailyReport({ pools, rawCount: enriched.length, enrichedCount: enriched.length,
      mediaLeadCount: media.length, reportDate, diagnostics: { bilibili_probe: {} } });
    assert.equal(report.push_pool.length, 10);
    assert.match(report.summary, /严格正式共 7 条/);
    assert.match(report.summary, /near-pass 人工复核 3 条/);
  });
});

// Synthetic admission evidence isolates the fallback from unrelated geography/contact classifiers.
// These fixtures are not claims that the five live samples qualify or should be imported.
async function completeCandidate() {
  const details = detailsFor("<p>Perfect parry and combo attacks generate energy to unleash a finisher.</p>");
  return {
    ...await enrichSteamCandidate(candidateFor(details), details, context),
    region: "中国", daysToRelease: 180, releaseDate: "2027-03-05",
    officialDemoEvidence: [{ type: "steam_demo", url: "https://store.steampowered.com/app/9900701/" }],
    officialGameplayEvidence: [{ type: "official_gameplay", url: "https://example.com/gameplay" }],
    contactMethods: [{ type: "website", value: "https://example.com" }],
    qualityProofs: []
  };
}
