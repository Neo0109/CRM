import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildRadarReport, buildDailyReport, buildSteamTrendReport } from "../jobs/online_daily_v4_reports.mjs";
import { selectDiverseMediaSignals, mediaRegion, mediaTopicFamily } from "../jobs/online_daily_v4_dedupe.mjs";
import { buildDailyRuleConfig } from "../jobs/online_daily_v4_rules.mjs";

const reportDate = "2026-09-06";
const capturedAt = "2026-09-06T12:00:00+08:00";
const config = { limit: 40, sourceCap: 3, familyCap: 12, regionCap: 24, bilibiliCap: 3,
  targets: [{ region: "china", count: 16 }, { region: "global", count: 16 }] };
const families = ["Publisher acquisition", "Sequel announced", "Community creator", "Generative AI", "Market analysis"];
function item(i, extra = {}) {
  return { title: families[i % 5] + " project " + i, summary: "Official game industry report with verified details.",
    link: "https://media" + Math.floor(i / 2) + ".test/news/" + i, source: "Media " + Math.floor(i / 2),
    source_focus: [i % 2 ? "china" : "global"], source_quality: 15, score: 30,
    published_at: "2026-09-06T09:00:00+08:00", ...extra };
}
const module = () => import("../jobs/online_daily_v4_radar.mjs");

test("Radar serializes 40 external cards and counts the internal card separately", () => {
  const signals = Array.from({ length: 40 }, (_, i) => item(i));
  const report = buildRadarReport({ candidates: [], pools: { push: [], watch: [] }, industrySignals: signals, reportDate, capturedAt });
  assert.equal(report.items.length, 40);
  assert.match(report.summary, /40 条/);
  const withSteam = buildRadarReport({ candidates: [{ genres: ["Indie"] }], pools: { push: [], watch: [] }, industrySignals: signals, reportDate, capturedAt });
  assert.equal(withSteam.items.length, 41);
  assert.equal(withSteam.items.filter(x => x.source === "CRM Online Scan").length, 1);
  assert.match(withSteam.summary, /40 条/);
});

test("all selector loops honor the external limit and never bypass caps to fill", () => {
  const signals = Array.from({ length: 100 }, (_, i) => item(i));
  const selected = selectDiverseMediaSignals(signals, 40, config);
  assert.equal(selected.length, 40);
  const overshoot = selectDiverseMediaSignals(signals, 2, { ...config, targets: [{ count: 2 }, { count: 2 }] });
  assert.equal(overshoot.length, 2);
  const scarce = selectDiverseMediaSignals(signals.map(x => ({ ...x, source: "One" })), 40, config);
  assert.equal(scarce.length, 3);
  for (const key of [x => x.source, mediaRegion, mediaTopicFamily]) {
    const counts = selected.reduce((map, x) => map.set(key(x), (map.get(key(x)) || 0) + 1), new Map());
    const limit = key === mediaRegion ? 24 : key === mediaTopicFamily ? 12 : 3;
    assert.ok([...counts.values()].every(n => n <= limit));
  }
});

test("Bilibili keyword feeds share one platform cap", () => {
  const signals = Array.from({ length: 30 }, (_, i) => item(i, { source: "B站视频-" + i, link: "https://www.bilibili.com/video/BV" + i, source_focus: ["china"] }));
  assert.equal(selectDiverseMediaSignals(signals, 40, config).length, 3);
});

test("freshness prefers 24h, permits 72h, rejects old, unknown and future publication", async () => {
  const { curateRadarSignals } = await module();
  const result = curateRadarSignals([
    item(0, { score: 100, published_at: "2026-09-04T09:00:00+08:00" }),
    item(1, { score: 20 }), item(2, { published_at: "2026-09-01" }),
    item(3, { published_at: "" }), item(4, { published_at: "2026-09-07T12:00:00+08:00" })
  ], { reportDate, capturedAt, diversity: config });
  assert.deepEqual(result.signals.map(x => x.title), [item(1).title, item(0).title]);
  assert.equal(result.diagnostics.unknown_date, 1);
});

test("seven-day history suppresses normalized URLs or titles, but not the same day", async () => {
  const { curateRadarSignals } = await module();
  const history = [
    { report_date: "2026-09-05", items: [item(0, { link: item(0).link + "?utm_source=mail" }), item(1, { link: "https://other.test/story/1" })] },
    { report_date: reportDate, items: [item(2)] },
    { report_date: "2026-08-29", items: [item(3)] }
  ];
  const input = Array.from({ length: 4 }, (_, i) => item(i));
  const options = { reportDate, capturedAt, diversity: config, history };
  assert.deepEqual(curateRadarSignals(input, options).signals.map(x => x.title), [item(2).title, item(3).title]);
  assert.deepEqual(curateRadarSignals(input, options), curateRadarSignals(input, options));
});

test("same-product same-event videos merge while distinct product events remain", async () => {
  const { curateRadarSignals } = await module();
  const videos = [
    item(0, { title: "《星河远征》2026科隆实机演示", source: "B站探头-关键词", link: "https://www.bilibili.com/video/BV1" }),
    item(1, { title: "开发者展示《星河远征》科隆2026实机演示", source: "B站视频-实机", link: "https://www.bilibili.com/video/BV2" }),
    item(2, { title: "《星河远征》公开测试开启", source: "B站视频-测试", link: "https://www.bilibili.com/video/BV3" })
  ];
  const result = curateRadarSignals(videos, { reportDate, capturedAt, diversity: config });
  assert.equal(result.signals.length, 2);
  assert.equal(result.diagnostics.duplicate_event, 1);
});

test("article metadata supports JSON-LD, meta attribute order, and dated time elements", async () => {
  const { readRadarArticleMetadata, parseChuappRadarItems } = await module();
  const html = '<meta content="媒体提供的准确摘要" name="description"><script type="application/ld+json">' +
    JSON.stringify({ "@graph": [{ "@type": "NewsArticle", headline: "游戏行业新动态", datePublished: "2026-09-06T09:00:00+08:00" }] }) + "</script>";
  const result = readRadarArticleMetadata(html);
  assert.equal(result.summary, "媒体提供的准确摘要");
  assert.equal(result.published_at, "2026-09-06T09:00:00+08:00");
  assert.equal(readRadarArticleMetadata('<time datetime="2026-09-05T08:00:00+08:00">昨天</time>').published_at, "2026-09-05T08:00:00+08:00");
  assert.equal(readRadarArticleMetadata('<span class="fn-right friendly_time" data-time="1788577200">2026年09月05日 11时00分</span>').published_at, "2026-09-05T03:00:00.000Z");
  const links = parseChuappRadarItems('<a href="/category/news">新闻栏目导航页面</a><a href="/article/300001.html">国产游戏开发者采访记录</a><a href="/article/300001.html">同一个文章标题的重复链接</a>');
  assert.equal(links.length, 1);
  assert.match(links[0].link, /\/article\/300001\.html$/);
});

test("navigation and generic sale filler never occupy Radar slots", async () => {
  const { curateRadarSignals } = await module();
  const result = curateRadarSignals([
    item(0, { link: "https://indienova.com/column/43", title: "周末游戏视频集锦" }),
    item(1, { title: "Steam discount sale 90% off best deals" }),
    item(2)
  ], { reportDate, capturedAt, diversity: config });
  assert.deepEqual(result.signals.map(x => x.title), [item(2).title]);
});

test("Radar-only collection does not mutate shared media or Lead/Steam output", async () => {
  const { collectRadarEdition } = await module();
  const rules = JSON.parse(readFileSync(new URL("../rules/daily-report.json", import.meta.url)));
  const before = buildDailyRuleConfig(rules);
  const shared = [item(0)];
  const snapshot = JSON.stringify(shared);
  const pools = { push: [], watch: [], drop: [] };
  const args = { pools, rawCount: 0, enrichedCount: 0, mediaLeadCount: 0, reportDate, diagnostics: {} };
  const daily = buildDailyReport(args);
  const steam = buildSteamTrendReport({ candidates: [], pools, reportDate, capturedAt });
  const result = await collectRadarEdition({ mediaSignals: shared, history: [], reportDate, capturedAt,
    ruleConfig: { radarDiversity: config, radarSources: [{ name: "Extra", type: "feed", url: "https://extra.test/feed", quality: 20, focus: ["global"] }] },
    fetchTextImpl: async () => '<rss><channel><item><title>New publisher funding round confirmed</title><link>https://extra.test/news/funding</link><description>Games studio receives funding.</description><pubDate>Sun, 06 Sep 2026 03:00:00 GMT</pubDate></item></channel></rss>'
  });
  assert.equal(result.signals.length, 2);
  assert.equal(JSON.stringify(shared), snapshot);
  assert.deepEqual(buildDailyReport(args), daily);
  assert.deepEqual(buildSteamTrendReport({ candidates: [], pools, reportDate, capturedAt }), steam);
  for (const name of ["AUTOMATON WEST", "GamesRadar+"]) assert.ok(!before.mediaSources.some(x => x.name === name));
});

test("unknown dates are enriched, failures isolated, and the total deadline is enforced", async () => {
  const { collectRadarEdition } = await module();
  let active = 0; let maximum = 0;
  const result = await collectRadarEdition({
    mediaSignals: Array.from({ length: 6 }, (_, i) => item(i, { published_at: "" })), history: [], reportDate, capturedAt,
    ruleConfig: { radarDiversity: config, radarSources: [] }, budgetMs: 50, requestTimeoutMs: 15, concurrency: 2,
    fetchTextImpl: async (url, options) => {
      active++; maximum = Math.max(maximum, active);
      try {
        if (url.endsWith("/0")) return '<meta property="article:published_time" content="2026-09-06T09:00:00+08:00">';
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 500);
          options.signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("aborted")); }, { once: true });
        });
        return "";
      } finally { active--; }
    }
  });
  assert.ok(maximum <= 2);
  assert.equal(active, 0);
  assert.equal(result.signals.length, 1);
  assert.ok(result.diagnostics.request_failures > 0);
  assert.ok(result.diagnostics.elapsed_ms < 250);
});
