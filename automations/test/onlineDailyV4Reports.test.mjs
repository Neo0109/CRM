import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDailyReport, buildRadarReport, buildSteamTrendReport } from "../jobs/online_daily_v4_reports.mjs";

function lead(overrides = {}) {
  return {
    id: "lead-demo",
    project: "Demo Game",
    steam_app_id: null,
    bucket: "未处理",
    stage: "new",
    priority: "P2",
    sourcing_lane: "indie_prelaunch",
    links: ["https://www.bilibili.com/video/BVdemo/"],
    contact_methods: [],
    gameplay: "Strategy",
    progress: "试玩 Demo",
    priority_reason: "国内媒体/B站候选",
    public_signals: "B站官方复核 / BVdemo",
    bilibili_fit: "适合视频化测试",
    ...overrides
  };
}

describe("online daily v4 report builders", () => {
  it("builds the daily report with stable counts and pool payloads", () => {
    const pools = {
      push: [lead({ project: "Push Game", priority: "P1" })],
      watch: [lead({ project: "Watch Game" })],
      drop: [lead({ project: "Drop Game", bucket: "淘汰池", stage: "rejected", priority: "P3" })]
    };

    const report = buildDailyReport({
      pools,
      rawCount: 5,
      enrichedCount: 4,
      mediaLeadCount: 2,
      reportDate: "2026-07-04",
      diagnostics: { bilibili_official_source_hits: 1 }
    });

    assert.equal(report.report_date, "2026-07-04");
    assert.match(report.summary, /扫描 Steam 候选 5 条、富化 4 条/);
    assert.match(report.summary, /媒体\/B站提取产品线索 2 条；B站探头候选 0 条、最终 0 条、官方源命中 1 条/);
    assert.equal(report.push_pool, pools.push);
    assert.equal(report.watch_pool, pools.watch);
    assert.equal(report.drop_pool, pools.drop);
    assert.ok(report.insights.length >= 10);
  });

  it("includes Bilibili probe diagnostics in V7 report summaries without changing lead payloads", () => {
    const pools = {
      push: [lead({ project: "Push Game", priority_reason: "保持人工可读", notes: null })],
      watch: [],
      drop: []
    };

    const report = buildDailyReport({
      pools,
      rawCount: 5,
      enrichedCount: 4,
      mediaLeadCount: 2,
      reportDate: "2026-07-05",
      diagnostics: {
        bilibili_official_source_hits: 2,
        bilibili_probe: {
          raw_candidates: 12,
          final_candidates: 3
        }
      }
    });

    assert.equal(report.report_date, "2026-07-05");
    assert.match(report.summary, /Sourcing V7\.2\.2/);
    assert.match(report.summary, /B站探头候选 12 条、最终 3 条、官方源命中 2 条/);
    assert.equal(report.push_pool[0].priority_reason, "保持人工可读");
    assert.equal(report.push_pool[0].notes, null);
    assert.doesNotMatch(JSON.stringify(report.push_pool), /sourcing-rules-v6\.5|B站探头候选|final_candidates/);
  });

  it("builds radar reports from external media signals without internal scan filler when Steam is empty", () => {
    const report = buildRadarReport({
      candidates: [],
      pools: { push: [], watch: [], drop: [] },
      industrySignals: [{ title: "行业信号", source: "GameLook", link: "https://example.com/news" }],
      reportDate: "2026-07-04",
      capturedAt: "2026-07-04T12:00:00+08:00",
      mediaSignalToRadarItem: (item, index) => ({
        id: `radar_media_${index}`,
        category: "行业新闻",
        title: item.title,
        source: item.source,
        link: item.link,
        captured_at: "2026-07-04T12:00:00+08:00"
      })
    });

    assert.equal(report.report_date, "2026-07-04");
    assert.match(report.summary, /今日选入 1 条中外媒体\/社区信号/);
    assert.deepEqual(report.items.map((item) => item.id), ["radar_media_0"]);
  });

  it("builds fallback Steam trends from review leads when Steam candidates are unavailable", () => {
    const report = buildSteamTrendReport({
      candidates: [],
      pools: {
        push: [lead({ project: "Push Fallback", priority: "P1" })],
        watch: [lead({ project: "Watch Fallback" })],
        drop: []
      },
      reportDate: "2026-07-04",
      capturedAt: "2026-07-04T12:00:00+08:00"
    });

    assert.equal(report.report_date, "2026-07-04");
    assert.match(report.summary, /Steam 抓取未返回有效候选/);
    assert.equal(report.market_insights.length, 3);
    assert.ok(report.genre_signals.length >= 3);
    assert.equal(report.items.length, 8);
    assert.deepEqual(report.crm_candidates.map((item) => item.project), ["Push Fallback", "Watch Fallback"]);
    assert.ok(report.items.every((item) => item.captured_at === "2026-07-04T12:00:00+08:00"));
  });
});
