import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  choosePreferredBilibiliSignal,
  deriveMediaDecisionFields,
  formatMediaGameplay,
  formatMediaProgress,
  normalizeMediaLinks,
  steamAppIdFromLinks
} from "../automations/jobs/sourcing_v6_3_quality.mjs";

const recommendationVideo = {
  title: "误入仙途，当堆叠大陆遇上国风修仙《卡牌仙宗》demo试玩",
  link: "https://www.bilibili.com/video/BV1t6Z2BXEK3/",
  summary: "推荐UP试玩视频 UP主：猫猫乙",
  source: "B站视频-国风修仙游戏"
};

const officialVideo = {
  title: "修仙宗门模拟经营《卡牌仙宗》首曝PV！发展宗门征服修仙世界",
  link: "https://www.bilibili.com/video/BV1V7GJzdEEm/",
  summary: "《卡牌仙宗》Steam商店页：https://store.steampowered.com/app/3612130/_/ QQ群：608164898 UP主：卡牌仙宗",
  source: "B站官方复核"
};

const preferred = choosePreferredBilibiliSignal(recommendationVideo, [officialVideo], "卡牌仙宗");
assert.equal(preferred.link, officialVideo.link, "official/developer Bilibili source should beat recommendation UP videos");

const linkText = "《卡牌修真：九宫幻境录》Steam商店页：https://store.steampowered.com/app/2921670 欢迎加入愿望单";
const links = normalizeMediaLinks(["https://www.bilibili.com/video/BVdemo/", linkText]);
assert.equal(steamAppIdFromLinks(links), "2921670", "Steam AppID should be extracted from Bilibili descriptions");
assert.ok(links.includes("https://store.steampowered.com/app/2921670/"), "normalized Steam store link should be written to links");
assert.ok(links.includes("https://steamdb.info/app/2921670/"), "SteamDB link should be added for verification");

const unreleasedDetails = {
  release_date: { coming_soon: true, date: "Coming soon" },
  genres: [{ description: "RPG" }, { description: "Strategy" }, { description: "Indie" }],
  categories: [{ description: "Single-player" }],
  demos: [{ appid: 2921671 }]
};
const gameplay = formatMediaGameplay({ title: "卡牌修真：九宫幻境录", summary: linkText, genre: "Card/Deckbuilder / RPG", details: unreleasedDetails });
assert.equal(gameplay, "Card/Deckbuilder / RPG / Strategy / Indie", "gameplay should be compact tags, not copied long descriptions");
assert.ok(!/https?:\/\//.test(gameplay), "gameplay must not contain raw URLs");
assert.equal(formatMediaProgress({ details: unreleasedDetails, sourceText: linkText }), "试玩 Demo", "Demo signals should become a short progress status");

const releasedDetails = {
  release_date: { coming_soon: false, date: "Apr 23, 2026" },
  genres: [{ description: "Casual" }]
};
assert.equal(formatMediaProgress({ details: releasedDetails, sourceText: "", reportDate: "2026-06-04" }), "正式上线", "released Steam apps should be marked as formally launched");

const fields = deriveMediaDecisionFields({
  title: "卡牌修真：九宫幻境录",
  source: "B站官方视频",
  confidence: "strict",
  score: 61,
  steamAppId: "2921670",
  progress: "试玩 Demo",
  gameplay,
  alreadyReleased: false,
  officialSourceMatched: true
});
assert.equal(fields.priority_reason, null, "priority_reason is a human-owned field and should stay empty by default");
assert.match(`${fields.rule_fit} ${fields.risks} ${fields.bilibili_fit}`, /玩法|B站|签约|官方|Steam|权益空间/, "rule fields should keep BD-decision evidence without filling human notes");
assert.equal(fields.verdict, "", "verdict should stay empty by default; human evaluation_result owns the conclusion");
assert.equal(fields.next_action, null, "next_action should default empty for human BD input");
assert.equal(fields.notes, null, "notes should default empty unless there is important extra evidence");

const onlineDailySource = readFileSync(new URL("../automations/jobs/online_daily_v4.mjs", import.meta.url), "utf8");
assert.doesNotMatch(onlineDailySource, /V6保底|低置信度国内保底|打开 Steam\/原始链接快速判断|补入未处理首轮 review/, "review backfill must not write automation bookkeeping into lead fields");
assert.match(onlineDailySource, /online_daily_v4_sourcing_rules_v6_8_quality_quarantine/, "online generator should publish the V6.8 quality quarantine generator identity");
assert.match(onlineDailySource, /quality_quarantine:\s*isQualityQuarantineRule\(sourcingRuleVersion\)/, "online generator should publish V6.8 quality quarantine diagnostics");

console.log(JSON.stringify({ ok: true, checked: "sourcing-v6.8-quality-quarantine" }, null, 2));
