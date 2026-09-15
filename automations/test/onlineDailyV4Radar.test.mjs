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

test("global network deadline stops new requests even when individual timeout is larger", async () => {
  const { collectRadarEdition } = await module();
  let calls = 0; let active = 0;
  const result = await collectRadarEdition({
    mediaSignals: [item(0)], history: [], reportDate, capturedAt, budgetMs: 20, requestTimeoutMs: 1000, concurrency: 1,
    ruleConfig: { radarDiversity: config, radarSources: [1, 2].map(n => ({ name: "Slow " + n, url: "https://slow.test/" + n, type: "feed" })) },
    fetchTextImpl: async (url, { signal }) => {
      calls++; active++;
      try { await new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })); }
      finally { active--; }
    }
  });
  assert.equal(calls, 1);
  assert.equal(active, 0);
  assert.equal(result.diagnostics.budget_exhausted, true);
  assert.ok(result.diagnostics.elapsed_ms < 250);
  assert.equal(result.signals.length, 1);
});

test("history loading ignores absent days, diagnoses malformed days and never reads today", async () => {
  const { loadRadarHistory } = await module();
  const paths = [];
  const result = await loadRadarHistory({ rootDir: "/fixture", reportDate, readFileImpl: async file => {
    paths.push(file);
    if (file.endsWith("2026-09-05.json")) return JSON.stringify({ report_date: "2026-09-05", items: [item(0)] });
    if (file.endsWith("2026-09-04.json")) return "{broken";
    throw Object.assign(new Error("missing"), { code: "ENOENT" });
  } });
  assert.equal(paths.length, 7);
  assert.ok(paths.every(p => !p.endsWith(reportDate + ".json")));
  assert.equal(result.reports.length, 1);
  assert.deepEqual(result.warnings, ["2026-09-04"]);
});

test("72-hour boundary is inclusive and oversized serializer counts only emitted cards", async () => {
  const { curateRadarSignals } = await module();
  const result = curateRadarSignals([item(0, { published_at: "2026-09-03T12:00:00+08:00" }), item(1, { published_at: "2026-09-03T11:59:59+08:00" })],
    { reportDate, capturedAt, diversity: config });
  assert.equal(result.signals.length, 1);
  const report = buildRadarReport({ candidates: [], pools: { push: [], watch: [] }, industrySignals: Array.from({length: 50}, (_, i) => item(i)), reportDate, capturedAt });
  assert.equal(report.items.length, 40);
  assert.match(report.summary, /40 条/);
  assert.doesNotMatch(report.summary, /50 条/);
});

test("Radar feeds retain whitespace-wrapped CDATA summaries and exclude non-game GamesRadar sections", async () => {
  const { parseRadarFeedItems } = await module();
  const source = { name: "GamesRadar+", type: "feed", url: "https://www.gamesradar.com/feeds.xml", quality: 10 };
  const xml = '<rss><channel><item><title>\n <![CDATA[Game studio interview]]>\n </title>' +
    '<link>https://www.gamesradar.com/games/rpg/studio-interview/</link>' +
    '<description>\n <![CDATA[The publisher explains its handcrafted game world.]]>\n </description>' +
    '<pubDate>Sat, 05 Sep 2026 15:08:49 +0000</pubDate></item>' +
    '<item><title>New television show announced</title><link>https://www.gamesradar.com/entertainment/tv/new-show/</link><description>TV update</description></item></channel></rss>';
  const items = parseRadarFeedItems(xml, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Game studio interview");
  assert.equal(items[0].summary, "The publisher explains its handcrafted game world.");
});


test("production acceptance excludes unrelated broad-media stories without losing game or engine news", async () => {
  const { curateRadarSignals } = await module();
  const articles = [
    item(0, { source: "IT之家", title: "央视曝光幽灵外卖乱象：无资质商家花500元就能上线外卖平台", summary: "外卖平台商家资质与网络餐饮监管。" }),
    item(1, { source: "IT之家", title: "Kimi、MiniMax等即将在天猫开店，开售Token", summary: "大模型厂商入驻天猫官方旗舰店。" }),
    item(2, { source: "证券时报", title: "新消费公司融资并购，品牌版权授权上线", summary: "消费市场投资与商店平台。" }),
    item(3, { source: "IT之家", title: "索尼澄清2028年PlayStation光盘产量下降10%", summary: "游戏光盘制造政策变化。" }),
    item(4, { source: "IT之家", title: "Unreal Engine开发工具发布新渲染功能", summary: "开发技术更新。" }),
    item(5, { source: "证券时报", title: "米哈游公布公司业务进展", summary: "公司与发行投资动态。" })
  ];
  const result = curateRadarSignals(articles, { reportDate, capturedAt, diversity: config });
  assert.deepEqual(new Set(result.signals.map(x => x.title)), new Set(articles.slice(3).map(x => x.title)));
  assert.equal(result.diagnostics.unrelated, 3);
});

test("production acceptance merges bracketed and unquoted Demo videos across upload dates", async () => {
  const { curateRadarSignals } = await module();
  const video = (i, title, published_at = "2026-09-05T09:00:00+08:00") =>
    item(i, { title, source: "B站视频-" + i, link: "https://www.bilibili.com/video/BVaccept" + i, published_at });
  const duplicate = [
    video(0, "新游 试玩 ——零境入侵 demo"),
    video(1, "【零境入侵】 Demo试玩 —— 这 游戏 完成度还是挺高的", "2026-09-06T09:00:00+08:00"),
    video(2, "《零境入侵》公开测试开启")
  ];
  const result = curateRadarSignals(duplicate, { reportDate, capturedAt, diversity: config });
  assert.equal(result.signals.length, 2);
  assert.equal(result.diagnostics.duplicate_event, 1);
  const history = [{ report_date: "2026-09-05", items: [duplicate[1]] }];
  assert.equal(curateRadarSignals([duplicate[0]], { reportDate, capturedAt, diversity: config, history }).signals.length, 0);
  const distinct = [video(3, "【零境入侵】Demo试玩 v1.0"), video(4, "零境入侵 Demo试玩 v2.0"), video(5, "《星河远征》Demo试玩")];
  assert.equal(curateRadarSignals(distinct, { reportDate, capturedAt, diversity: config }).signals.length, 3);
});


test("editorial relevance is independent of publisher name, Lead scores and template prose", async () => {
  const { assessRadarRelevance } = await import("../jobs/online_daily_v4_radar_editorial.mjs");
  const cases = [
    ["Dan Harmon reveals leprechaun lore for his new TV show", "An interview about the television series.", "Polygon", 0],
    ["荣耀笔记本升级 YOYO Claw 悬浮球，提供编码能力", "通用办公系统功能。", "IT之家", 0],
    ["A fantasy RPG review", "Turn-based party combat and a branching quest system.", "Unknown", 3],
    ["独立游戏开发日志：新增采集系统", "展示玩家采集、制作和资源消耗。", "B站视频", 3],
    ["Unreal Engine renderer update", "The game engine adds shader debugging tools.", "Unknown", 3],
    ["RTX laptop launch", "This general purpose computer is on sale.", "PC Gamer", 0],
    ["Gaming monitor latency tested", "Input lag measured in PC games.", "PC Gamer", 2],
    ["普通公司访谈", "媒体报道。重点看平台、渠道、政策或市场节奏是否改变发行打法。", "GamesIndustry.biz", 0]
  ];
  for (const [title, summary, source, level] of cases)
    assert.equal(assessRadarRelevance({ title, summary, source, score: 999 }).level, level, title);
});

test("Radar ranks direct game content ahead of indirect hardware and ignores inherited Lead score", async () => {
  const { curateRadarSignals } = await module();
  const input = [
    item(1, {title:"Gaming monitor latency tested", summary:"Tests in PC games.",score:999}),
    item(2, {title:"New RPG demo review",summary:"A tactical game demo with party combat.",score:-100,published_at:"2026-09-04T12:00:00+08:00"}),
    item(3, {title:"Television star interview",summary:"A new drama series interview.",source:"Polygon",score:999})
  ];
  const result=curateRadarSignals(input,{reportDate,capturedAt,diversity:{...config,targets:[]}});
  assert.deepEqual(result.signals.map(x=>x.title),[input[1].title,input[0].title]);
});

test("confirmed multilingual events prefer domestic articles, preserve distinct progress and honor caps", async () => {
  const { curateRadarSignals } = await module();
  const editorial={ entity_aliases:[{id:"wow",names:["World of Warcraft","魔兽世界"]}] };
  const foreign=item(0,{source:"Foreign",title:"World of Warcraft sequel is unlikely",summary:"Developers confirm there are no plans for a direct sequel.",source_focus:["global"],link:"https://foreign.test/news/wow"});
  const chinese=item(1,{source:"国内甲",title:"《魔兽世界》开发者称不会推出直接续作",summary:"开发团队表示目前没有直接续作的计划，现有游戏将继续更新。",source_focus:["china"],original_links:[foreign.link]});
  const invalid={...chinese,link:"https://cn.test/invalid",published_at:"",source:"失效国内"};
  const short={...chinese,title:"《魔兽世界》续作消息",summary:"详见原文",source:"简讯",link:"https://cn.test/short"};
  const other=item(2,{source:"国内乙",title:"《魔兽世界》补丁12.1上线",summary:"这次更新为游戏加入新的副本和战斗系统。",source_focus:["china"]});
  const result=curateRadarSignals([foreign,chinese,invalid,short,other],{reportDate,capturedAt,diversity:{...config,targets:[]},editorial});
  assert.ok(result.signals.some(x=>x.link===chinese.link));
  assert.ok(!result.signals.some(x=>x.link===foreign.link||x.link===short.link));
  assert.ok(result.signals.some(x=>x.link===other.link));
  assert.equal(result.diagnostics.domestic_replacements,1);
  const history=[{report_date:"2026-09-05",items:[foreign]}];
  assert.equal(curateRadarSignals([chinese],{reportDate,capturedAt,diversity:config,editorial,history}).signals.length,0);
  assert.equal(curateRadarSignals([chinese],{reportDate,capturedAt,diversity:config,editorial,history:[{report_date:reportDate,items:[foreign]}]}).signals.length,1);
});

test("event identity distinguishes versions and reviews and does not merge a company alone", async () => {
  const { sameRadarEvent } = await import("../jobs/online_daily_v4_radar_editorial.mjs");
  const editorial={entity_aliases:[{id:"wow",names:["World of Warcraft","魔兽世界"]}]};
  const a={title:"World of Warcraft patch 12.1 released",summary:"The game update adds a new dungeon."};
  assert.equal(sameRadarEvent(a,{title:"《魔兽世界》12.2补丁上线",summary:"新的游戏副本。"},editorial),false);
  assert.equal(sameRadarEvent(a,{title:"《魔兽世界》12.1补丁上线",summary:"该游戏更新加入新的副本。"},editorial),true);
  assert.equal(sameRadarEvent({title:"World of Warcraft review",summary:"Great combat."},{title:"《魔兽世界》评测",summary:"战斗体验很差。"},editorial),false);
  assert.equal(sameRadarEvent({title:"Blizzard studio layoffs",summary:"A game company reduces staff."},{title:"Blizzard announces a new game",summary:"A new RPG announced."},editorial),false);
});

test("domestic publisher identity comes from registered source or host, never the story country", async () => {
  const { radarPublisherRegion } = await import("../jobs/online_daily_v4_radar_editorial.mjs");
  const sources=[{name:"国内刊物",url:"https://cn.test/feed",focus:["china"]},{name:"Foreign",url:"https://global.test/rss",focus:["global"]}];
  assert.equal(radarPublisherRegion({source:"Foreign",title:"中国腾讯国内游戏新闻",link:"https://global.test/story"},sources),"global");
  assert.equal(radarPublisherRegion({source:"国内刊物",title:"Blizzard reveals a game",link:"https://cn.test/story"},sources),"china");
  assert.equal(radarPublisherRegion({source:"renamed",link:"https://cn.test/story"},sources),"china");
});

test("event representatives try another domestic publisher then foreign when media caps fill", async () => {
  const { curateRadarSignals }=await module();
  const signals=[];
  for(let i=0;i<4;i++){
    const en=item(i*3,{source:"Foreign "+i,source_focus:["global"],title:"Game project "+i+" launch announced",summary:"The new action game launches on 2026-10-"+(10+i)+".",link:"https://foreign.test/story/"+i});
    signals.push(en,item(i*3+1,{source:"国内甲",source_focus:["china"],title:"《游戏"+i+"》宣布发售",summary:"动作游戏确认在2026-10-"+(10+i)+"发售，发行安排已经正式确认。",original_links:[en.link]}));
    if(i===3)signals.push(item(50,{source:"国内乙",source_focus:["china"],title:"《游戏3》公布发售安排",summary:"动作游戏将在2026-10-13发售，发行安排已经正式确认。",original_links:[en.link]}));
  }
  const opts={reportDate,capturedAt,diversity:{...config,targets:[]}};
  const selected=curateRadarSignals(signals,opts).signals;
  assert.equal(selected.length,4);
  assert.equal(selected.filter(x=>x.source==="国内甲").length,3);
  assert.ok(selected.some(x=>x.source==="国内乙"));
  const withoutBackup=signals.filter(x=>x.source!=="国内乙");
  assert.equal(curateRadarSignals(withoutBackup,opts).signals.filter(x=>x.source.startsWith("Foreign")).length,1);
});

test("collector exposes an independent pre-Lead-filter snapshot without changing its returned input", async () => {
  const { fetchMediaSignals }=await import("../jobs/online_daily_v4_media_sources.mjs");
  let snapshot;
  const input={title:"A small RPG review",summary:"A game with tactical turn-based combat.",source:"Tiny",source_quality:0,source_focus:[],link:"https://tiny.test/review",published_at:"2026-09-06"};
  const context={reportDate,mediaSourcesImpl:()=>[{}],fetchMediaSourceImpl:async()=>[input],collectBilibiliProbeSignalsImpl:async()=>({signals:[],diagnostics:{source_failures:0,official_source_hits:0}}),sleepImpl:async()=>{}};
  const before=await fetchMediaSignals({...context,diagnostics:{}});
  const after=await fetchMediaSignals({...context,diagnostics:{},onRadarSnapshot:items=>{snapshot=items;items[0].summary="consumer mutation";}});
  assert.deepEqual(after,before);
  assert.equal(input.summary,"A game with tactical turn-based combat.");
  assert.equal(snapshot.length,1);
  assert.ok(!before.some(x=>x.title===input.title));
});

test("domestic article metadata is prioritized and retains explicit original source links", async () => {
  const { collectRadarEdition,readRadarArticleMetadata }=await module();
  const html='<article><p>据 <a href="https://foreign.test/news/game">原文报道</a>，该游戏将推出新副本。</p></article><meta name="description" content="游戏开发团队宣布新副本和测试计划。"><meta property="article:published_time" content="2026-09-06T09:00:00+08:00">';
  assert.deepEqual(readRadarArticleMetadata(html).original_links,["https://foreign.test/news/game"]);
  const calls=[];
  await collectRadarEdition({mediaSignals:[item(0,{source_focus:["global"],published_at:"",score:999}),item(1,{source_focus:["china"],published_at:"",score:0})],reportDate,capturedAt,ruleConfig:{radarDiversity:{...config,targets:[]},radarSources:[]},concurrency:1,fetchTextImpl:async url=>{calls.push(url);return html;}});
  assert.equal(calls[0],item(1).link);
});
