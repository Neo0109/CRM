import assert from "node:assert/strict";
import { buildAutomationDiagnostics } from "../functions/_lib/automationDiagnostics";

type JsonValue = Record<string, unknown> | unknown[];

function jsonResponse(payload: JsonValue, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status
  });
}

function fetchMock(routes: Record<string, JsonValue | 404>) {
  return async (input: string | URL | Request) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const key = url.split("?")[0];
    if (!(key in routes)) return jsonResponse({ error: `missing ${key}` }, 404);
    const value = routes[key];
    if (value === 404) return jsonResponse({ error: "not found" }, 404);
    return jsonResponse(value);
  };
}

function listEntry(name: string) {
  return { name, type: "file" };
}

const base = "https://raw.githubusercontent.com/Neo0109/CRM/main";
const api = "https://api.github.com/repos/Neo0109/CRM/contents";

async function testHealthyDiagnostics() {
  const report = {
    report_date: "2026-06-04",
    summary: "Sourcing V6.2线上自动化：扫描 Steam 候选 219 条、富化 90 条，另从国内媒体/B站提取产品线索 17 条；进入日报候选 29 条；推荐优先复核 3 条、普通复核 15 条、淘汰 11 条。非淘汰项目统一进入未处理 inbox。",
    insights: ["规则正常"],
    push_pool: Array.from({ length: 3 }, (_, index) => ({ id: `push-${index}` })),
    watch_pool: Array.from({ length: 15 }, (_, index) => ({ id: `watch-${index}` })),
    drop_pool: Array.from({ length: 11 }, (_, index) => ({ id: `drop-${index}` }))
  };
  const radar = {
    report_date: "2026-06-04",
    summary: "行业雷达",
    items: Array.from({ length: 10 }, (_, index) => ({ id: `radar-${index}`, category: index % 2 ? "今日亮点" : "行业新闻" }))
  };
  const steam = {
    report_date: "2026-06-04",
    summary: "Steam 趋势",
    market_insights: Array.from({ length: 3 }, (_, index) => ({ id: `market-${index}` })),
    genre_signals: Array.from({ length: 5 }, (_, index) => ({ id: `genre-${index}` })),
    items: Array.from({ length: 8 }, (_, index) => ({ id: `steam-${index}` }))
  };
  const receipt = {
    report_date: "2026-06-04",
    slot: "morning",
    status: "success",
    run_url: "https://github.com/Neo0109/CRM/actions/runs/1",
    captured_at: "2026-06-04T02:30:00.000Z",
    sync_response: JSON.stringify({
      synced: true,
      created: 18,
      updated: 2,
      dropped: 11,
      total: 300,
      import_stats: {
        created_unprocessed: 18,
        created_dropped: 11,
        visible_unprocessed: 18
      },
      summary: report.summary
    })
  };

  const diagnostics = await buildAutomationDiagnostics("2026-06-04", {
    fetchFn: fetchMock({
      [`${api}/data/reports`]: [listEntry("2026-06-04.json")],
      [`${api}/data/automation_runs`]: [listEntry("2026-06-04-morning.json")],
      [`${base}/data/reports/2026-06-04.json`]: report,
      [`${base}/data/radar/2026-06-04.json`]: radar,
      [`${base}/data/steam_trends/2026-06-04.json`]: steam,
      [`${base}/data/automation_runs/2026-06-04-morning.json`]: receipt
    }),
    today: "2026-06-04"
  });

  assert.equal(diagnostics.status, "healthy");
  assert.equal(diagnostics.counts.review_candidates, 18);
  assert.equal(diagnostics.counts.final_candidates, 29);
  assert.equal(diagnostics.source_breakdown.steam_scanned, 219);
  assert.equal(diagnostics.source_breakdown.media_bilibili_leads, 17);
  assert.equal(diagnostics.latest_synced_receipt?.sync?.created, 18);
  assert.equal(diagnostics.business_acceptance?.status, "pass");
  assert.equal(diagnostics.business_acceptance?.primary_issue, null);
  assert.ok(diagnostics.business_acceptance?.verdict.includes("业务可用"));
  assert.deepEqual(diagnostics.warnings, []);
}

async function testLowVolumeWarning() {
  const report = {
    report_date: "2026-06-04",
    summary: "Sourcing V6.2线上自动化：扫描 Steam 候选 20 条、富化 3 条，另从国内媒体/B站提取产品线索 1 条；进入日报候选 1 条；推荐优先复核 1 条、普通复核 0 条、淘汰 0 条。",
    insights: [],
    push_pool: [{ id: "one" }],
    watch_pool: [],
    drop_pool: []
  };

  const diagnostics = await buildAutomationDiagnostics("2026-06-04", {
    fetchFn: fetchMock({
      [`${api}/data/reports`]: [listEntry("2026-06-04.json")],
      [`${api}/data/automation_runs`]: [],
      [`${base}/data/reports/2026-06-04.json`]: report,
      [`${base}/data/radar/2026-06-04.json`]: { report_date: "2026-06-04", items: [] },
      [`${base}/data/steam_trends/2026-06-04.json`]: { report_date: "2026-06-04", market_insights: [], genre_signals: [], items: [] }
    }),
    today: "2026-06-04"
  });

  assert.equal(diagnostics.status, "warning");
  assert.equal(diagnostics.counts.review_candidates, 1);
  assert.ok(diagnostics.warnings.some((warning) => warning.includes("非淘汰候选")));
  assert.ok(diagnostics.warnings.some((warning) => warning.includes("同步 receipt")));
  assert.ok(diagnostics.next_actions.some((action) => action.includes("Run workflow")));
  assert.equal(diagnostics.business_acceptance?.status, "needs_attention");
  assert.ok(diagnostics.business_acceptance?.root_causes.some((cause) => cause.category === "sync"));
  assert.ok(diagnostics.business_acceptance?.root_causes.some((cause) => cause.category === "source_pool"));
  assert.ok(diagnostics.business_acceptance?.recommended_actions.some((action) => action.includes("GitHub Actions")));
}

async function testLowReviewCandidatesClassifiesSourcePoolWhenSynced() {
  const report = {
    report_date: "2026-06-04",
    summary: "Sourcing V6.2线上自动化：扫描 Steam 候选 205 条、富化 90 条，另从国内媒体/B站提取产品线索 5 条；进入日报候选 20 条；推荐优先复核 2 条、普通复核 10 条、淘汰 8 条。",
    insights: [],
    push_pool: Array.from({ length: 2 }, (_, index) => ({ id: `push-${index}` })),
    watch_pool: Array.from({ length: 10 }, (_, index) => ({ id: `watch-${index}` })),
    drop_pool: Array.from({ length: 8 }, (_, index) => ({ id: `drop-${index}` }))
  };
  const receipt = {
    report_date: "2026-06-04",
    slot: "morning",
    status: "success",
    captured_at: "2026-06-04T02:30:00.000Z",
    sync_response: JSON.stringify({
      synced: true,
      created: 12,
      updated: 0,
      dropped: 8,
      total: 320,
      import_stats: {
        created_unprocessed: 12,
        visible_unprocessed: 12
      }
    })
  };

  const diagnostics = await buildAutomationDiagnostics("2026-06-04", {
    fetchFn: fetchMock({
      [`${api}/data/reports`]: [listEntry("2026-06-04.json")],
      [`${api}/data/automation_runs`]: [listEntry("2026-06-04-morning.json")],
      [`${base}/data/reports/2026-06-04.json`]: report,
      [`${base}/data/radar/2026-06-04.json`]: {
        report_date: "2026-06-04",
        items: Array.from({ length: 10 }, (_, index) => ({ id: `radar-${index}`, category: "行业新闻" }))
      },
      [`${base}/data/steam_trends/2026-06-04.json`]: {
        report_date: "2026-06-04",
        market_insights: Array.from({ length: 3 }, (_, index) => ({ id: `market-${index}` })),
        genre_signals: Array.from({ length: 3 }, (_, index) => ({ id: `genre-${index}` }))
      },
      [`${base}/data/automation_runs/2026-06-04-morning.json`]: receipt
    }),
    today: "2026-06-04"
  });

  assert.equal(diagnostics.business_acceptance?.status, "needs_attention");
  assert.equal(diagnostics.business_acceptance?.primary_issue, "非淘汰候选不足");
  assert.ok(diagnostics.business_acceptance?.root_causes.some((cause) => cause.category === "source_pool" && cause.evidence.includes("12 / 18")));
  assert.ok(diagnostics.business_acceptance?.metrics.some((metric) => metric.key === "media_bilibili_candidates" && metric.status === "warn"));
}

async function testMissingArtifactsFailBusinessAcceptance() {
  const diagnostics = await buildAutomationDiagnostics("2026-06-04", {
    fetchFn: fetchMock({
      [`${api}/data/reports`]: [],
      [`${api}/data/automation_runs`]: []
    }),
    today: "2026-06-04"
  });

  assert.equal(diagnostics.status, "missing");
  assert.equal(diagnostics.business_acceptance?.status, "fail");
  assert.equal(diagnostics.business_acceptance?.primary_issue, "核心文件缺失");
  assert.ok(diagnostics.business_acceptance?.root_causes.some((cause) => cause.category === "files"));
}

async function main() {
  await testHealthyDiagnostics();
  await testLowVolumeWarning();
  await testLowReviewCandidatesClassifiesSourcePoolWhenSynced();
  await testMissingArtifactsFailBusinessAcceptance();
  console.log("automation diagnostics tests passed");
}

void main();
