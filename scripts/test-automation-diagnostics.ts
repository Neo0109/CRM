import assert from "node:assert/strict";
import { buildAutomationDiagnostics } from "../functions/_lib/automationDiagnostics";
import {
  buildBusinessAcceptance,
  buildCounts,
  buildFileHealth,
  buildNextActions,
  buildStatus,
  buildWarnings,
  parseSourceBreakdown
} from "../functions/_lib/automationDiagnosticsModel";

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

function fetchResult<T>(data: T | null, exists = true, status = exists ? 200 : 404) {
  return {
    data,
    exists,
    source: exists ? "mock://artifact.json" : "mock://missing.json",
    status
  };
}

function receiptSummary(name: string, status: string, sync: Record<string, unknown> | null) {
  return {
    attempts: null,
    captured_at: null,
    event_name: null,
    event_schedule: null,
    generated_changed: null,
    name,
    report_date: null,
    run_number: null,
    run_url: null,
    slot: null,
    status,
    sync
  };
}

const base = "https://raw.githubusercontent.com/Neo0109/CRM/main";
const api = "https://api.github.com/repos/Neo0109/CRM/contents";

function testModelParsesSourceBreakdownAndCountsArtifacts() {
  const sourceBreakdown = parseSourceBreakdown("Sourcing V6.2线上自动化：扫描 Steam 候选 219 条、富化 90 条，官方源命中 6 条，另从国内媒体/B站提取产品线索 17 条；进入日报候选 29 条。");
  assert.equal(sourceBreakdown.steam_scanned, 219);
  assert.equal(sourceBreakdown.steam_enriched, 90);
  assert.equal(sourceBreakdown.official_source_hits, 6);
  assert.equal(sourceBreakdown.media_bilibili_leads, 17);
  assert.equal(sourceBreakdown.final_candidates, 29);
  assert.equal(parseSourceBreakdown(null).raw_summary, null);

  const counts = buildCounts(
    {
      push_pool: [{ id: "push" }],
      watch_pool: [{ id: "watch-1" }, { id: "watch-2" }],
      drop_pool: [{ id: "drop" }]
    },
    {
      items: [{ category: "行业新闻" }, { category: "今日亮点" }, { category: 42 }]
    },
    {
      crm_candidates: [{ id: "crm" }],
      genre_signals: [{ id: "genre" }],
      items: [{ id: "steam-1" }, { id: "steam-2" }],
      market_insights: [{ id: "market" }]
    }
  );

  assert.equal(counts.push_candidates, 1);
  assert.equal(counts.watch_candidates, 2);
  assert.equal(counts.review_candidates, 3);
  assert.equal(counts.drop_candidates, 1);
  assert.equal(counts.final_candidates, 4);
  assert.deepEqual(counts.radar_categories, { "今日亮点": 1, "行业新闻": 1, "未分类": 1 });
  assert.equal(counts.steam_crm_candidates, 1);
  assert.equal(counts.steam_items, 2);
}

function testModelBuildsWarningsStatusAndActions() {
  const counts = buildCounts(
    { push_pool: [{ id: "one" }], watch_pool: [], drop_pool: [] },
    { items: [] },
    { market_insights: [], genre_signals: [], items: [] }
  );
  const warnings = buildWarnings({
    counts,
    latestSyncedReceipt: null,
    radarResult: fetchResult(null, false),
    reportResult: fetchResult({ push_pool: [{ id: "one" }], watch_pool: [], drop_pool: [] }),
    sourceBreakdown: parseSourceBreakdown("国内媒体/B站提取产品线索 1 条；进入日报候选 1 条。"),
    steamResult: fetchResult(null, false)
  });
  const status = buildStatus({
    latestReceipt: null,
    latestSyncedReceipt: null,
    radarResult: fetchResult(null, false),
    reportResult: fetchResult({}),
    steamResult: fetchResult(null, false),
    warnings
  });
  const actions = buildNextActions(warnings, status);

  assert.equal(status, "warning");
  assert.ok(warnings.some((warning) => warning.includes("行业雷达文件缺失")));
  assert.ok(warnings.some((warning) => warning.includes("Steam 趋势文件缺失")));
  assert.ok(warnings.some((warning) => warning.includes("非淘汰候选 1 条")));
  assert.ok(actions.some((action) => action.includes("Run workflow")));
  assert.ok(actions.some((action) => action.includes("source breakdown")));

  const missingStatus = buildStatus({
    latestReceipt: null,
    latestSyncedReceipt: null,
    radarResult: fetchResult(null, false),
    reportResult: fetchResult(null, false),
    steamResult: fetchResult(null, false),
    warnings
  });
  assert.equal(missingStatus, "missing");

  const failedStatus = buildStatus({
    latestReceipt: receiptSummary("2026-06-04-morning.json", "success", { synced: false }),
    latestSyncedReceipt: null,
    radarResult: fetchResult({}),
    reportResult: fetchResult({}),
    steamResult: fetchResult({}),
    warnings: []
  });
  assert.equal(failedStatus, "failed");
}

function testModelBuildsBusinessAcceptanceAndFileHealth() {
  const files = {
    report: buildFileHealth("data/reports", "2026-06-04", fetchResult({})),
    radar: buildFileHealth("data/radar", "2026-06-04", fetchResult({ items: [] })),
    steam_trends: buildFileHealth("data/steam_trends", "2026-06-04", fetchResult(null, false))
  };
  const counts = buildCounts(
    {
      push_pool: Array.from({ length: 2 }, (_, index) => ({ id: `push-${index}` })),
      watch_pool: Array.from({ length: 10 }, (_, index) => ({ id: `watch-${index}` })),
      drop_pool: Array.from({ length: 8 }, (_, index) => ({ id: `drop-${index}` }))
    },
    { items: Array.from({ length: 4 }, (_, index) => ({ id: `radar-${index}`, category: "行业新闻" })) },
    { market_insights: [{ id: "market" }], genre_signals: [{ id: "genre" }] }
  );
  const acceptance = buildBusinessAcceptance({
    counts,
    files,
    importStats: { created_unprocessed: 3, visible_unprocessed: 3 },
    latestReceipt: receiptSummary("2026-06-04-morning.json", "success", { synced: false }),
    latestSyncedReceipt: null,
    sourceBreakdown: parseSourceBreakdown("国内媒体/B站提取产品线索 5 条；进入日报候选 20 条。")
  });

  assert.equal(files.steam_trends.exists, false);
  assert.equal(files.steam_trends.path, "data/steam_trends/2026-06-04.json");
  assert.equal(acceptance.status, "fail");
  assert.equal(acceptance.primary_issue, "核心文件缺失");
  assert.ok(acceptance.root_causes.some((cause) => cause.category === "files"));
  assert.ok(acceptance.root_causes.some((cause) => cause.category === "sync"));
  assert.ok(acceptance.root_causes.some((cause) => cause.category === "import_quality"));
  assert.ok(acceptance.recommended_actions.some((action) => action.includes("Daily online CRM automation")));

  const passCounts = buildCounts(
    {
      push_pool: Array.from({ length: 4 }, (_, index) => ({ id: `push-${index}` })),
      watch_pool: Array.from({ length: 16 }, (_, index) => ({ id: `watch-${index}` })),
      drop_pool: Array.from({ length: 8 }, (_, index) => ({ id: `drop-${index}` }))
    },
    { items: Array.from({ length: 9 }, (_, index) => ({ id: `radar-${index}`, category: "今日亮点" })) },
    {
      genre_signals: Array.from({ length: 3 }, (_, index) => ({ id: `genre-${index}` })),
      market_insights: Array.from({ length: 3 }, (_, index) => ({ id: `market-${index}` }))
    }
  );
  const passAcceptance = buildBusinessAcceptance({
    counts: passCounts,
    files: {
      report: buildFileHealth("data/reports", "2026-06-04", fetchResult({})),
      radar: buildFileHealth("data/radar", "2026-06-04", fetchResult({})),
      steam_trends: buildFileHealth("data/steam_trends", "2026-06-04", fetchResult({}))
    },
    importStats: { created_unprocessed: 8, visible_unprocessed: 8 },
    latestReceipt: receiptSummary("2026-06-04-morning.json", "success", { synced: true }),
    latestSyncedReceipt: receiptSummary("2026-06-04-morning.json", "success", { synced: true }),
    sourceBreakdown: parseSourceBreakdown("国内媒体/B站提取产品线索 12 条；进入日报候选 28 条。")
  });

  assert.equal(passAcceptance.status, "pass");
  assert.equal(passAcceptance.primary_issue, null);
  assert.deepEqual(passAcceptance.recommended_actions, ["无需人工介入；继续观察下一次定时日报。"]);
}

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
  testModelParsesSourceBreakdownAndCountsArtifacts();
  testModelBuildsWarningsStatusAndActions();
  testModelBuildsBusinessAcceptanceAndFileHealth();
  await testHealthyDiagnostics();
  await testLowVolumeWarning();
  await testLowReviewCandidatesClassifiesSourcePoolWhenSynced();
  await testMissingArtifactsFailBusinessAcceptance();
  console.log("automation diagnostics tests passed");
}

void main();
