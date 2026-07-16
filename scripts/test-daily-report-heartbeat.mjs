import assert from "node:assert/strict";
import { test } from "node:test";

import {
  dispatchWatchdog,
  inspectDailyArtifacts,
  runHeartbeat,
  shanghaiDate,
} from "../cloudflare/daily-report-heartbeat/worker.mjs";

const env = { GITHUB_TOKEN: "test-token" };

test("shanghaiDate formats the Asia/Shanghai calendar day", () => {
  assert.equal(shanghaiDate(new Date("2026-07-08T16:30:00Z")), "2026-07-09");
});

test("healthy artifacts suppress dispatch", async () => {
  const fetches = [];
  const fetchFn = async (url, init = {}) => {
    fetches.push({ url, method: init.method ?? "GET" });
    if (init.method === "HEAD") return new Response(null, { status: 200 });
    if (url.includes("/data/reports/2026-07-09.json")) return reportJson({ push: 2, watch: 0 });
    if (url.includes("/data/sourcing_candidates/2026-07-09.json")) return sourcingCandidatesJson({ qualified: 2 });
    if (url.includes("/contents/data/automation_runs")) {
      return json([
        { type: "file", name: "2026-07-09-watchdog.json", download_url: "https://example.test/receipt.json" },
      ]);
    }
    return json({
      status: "success",
      slot: "watchdog",
      sync_response: JSON.stringify({ synced: true }),
    });
  };

  const result = await inspectDailyArtifacts({ env, date: "2026-07-09", fetchFn });

  assert.equal(result.ok, true);
  assert.equal(result.needsDispatch, false);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.report.review, 2);
  assert.equal(fetches.filter((call) => call.method === "HEAD").length, 4);
});

test("missing files and receipt request watchdog dispatch", async () => {
  const fetchFn = async (url, init = {}) => {
    if (init.method === "HEAD") return new Response(null, { status: 404 });
    if (url.includes("/contents/data/automation_runs")) return json([]);
    throw new Error(`unexpected fetch ${url}`);
  };

  const result = await inspectDailyArtifacts({ env, date: "2026-07-09", fetchFn });

  assert.equal(result.ok, false);
  assert.equal(result.needsDispatch, true);
  assert.deepEqual(result.reasons, ["missing files: report, radar, steam_trends, sourcing_candidates", "no successful synced receipt"]);
});

test("zero-formal report stays healthy and does not dispatch after a successful sync", async () => {
  const fetchFn = async (url, init = {}) => {
    if (init.method === "HEAD") return new Response(null, { status: 200 });
    if (url.includes("/data/reports/2026-07-09.json")) return reportJson({ push: 0, watch: 0 });
    if (url.includes("/data/sourcing_candidates/2026-07-09.json")) return sourcingCandidatesJson({ qualified: 0 });
    if (url.includes("/contents/data/automation_runs")) {
      return json([
        { type: "file", name: "2026-07-09-morning.json", download_url: "https://example.test/receipt.json" },
      ]);
    }
    return json({
      status: "success",
      sync_response: JSON.stringify({ synced: true }),
    });
  };

  const result = await inspectDailyArtifacts({ env, date: "2026-07-09", fetchFn });

  assert.equal(result.ok, true);
  assert.equal(result.degraded, false);
  assert.equal(result.needsDispatch, false);
  assert.equal(result.report.review, 0);
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.warnings, []);
});

test("V7 qualified/push mismatch requests watchdog dispatch", async () => {
  const fetchFn = async (url, init = {}) => {
    if (init.method === "HEAD") return new Response(null, { status: 200 });
    if (url.includes("/data/reports/2026-07-09.json")) return reportJson({ push: 1, watch: 0 });
    if (url.includes("/data/sourcing_candidates/2026-07-09.json")) return sourcingCandidatesJson({ qualified: 2 });
    if (url.includes("/contents/data/automation_runs")) {
      return json([
        { type: "file", name: "2026-07-09-morning.json", download_url: "https://example.test/receipt.json" },
      ]);
    }
    return json({ status: "success", sync_response: JSON.stringify({ synced: true }) });
  };

  const result = await inspectDailyArtifacts({ env, date: "2026-07-09", fetchFn });

  assert.equal(result.ok, false);
  assert.equal(result.needsDispatch, true);
  assert.match(result.reasons.join("\n"), /recorded push_pool_count=2, report push_pool=1/);
});

test("status unknown receipt is not success evidence", async () => {
  const fetchFn = async (url, init = {}) => {
    if (init.method === "HEAD") return new Response(null, { status: 200 });
    if (url.includes("/data/reports/2026-07-09.json")) return reportJson({ push: 1, watch: 0 });
    if (url.includes("/data/sourcing_candidates/2026-07-09.json")) return sourcingCandidatesJson({ qualified: 1 });
    if (url.includes("/contents/data/automation_runs")) {
      return json([
        { type: "file", name: "2026-07-09-watchdog.json", download_url: "https://example.test/receipt.json" },
      ]);
    }
    return json({
      status: "unknown",
      sync_response: "",
    });
  };

  const result = await inspectDailyArtifacts({ env, date: "2026-07-09", fetchFn });

  assert.equal(result.ok, false);
  assert.equal(result.needsDispatch, true);
  assert.deepEqual(result.reasons, ["no successful synced receipt"]);
});

test("dispatchWatchdog calls workflow_dispatch with force", async () => {
  let request = null;
  const fetchFn = async (url, init = {}) => {
    request = { url, init };
    return new Response(null, { status: 204 });
  };

  const result = await dispatchWatchdog({ env, date: "2026-07-09", fetchFn });

  assert.equal(result.ok, true);
  assert.equal(request.url, "https://api.github.com/repos/Neo0109/CRM/actions/workflows/daily-report-watchdog.yml/dispatches");
  assert.equal(request.init.method, "POST");
  assert.deepEqual(JSON.parse(request.init.body), {
    ref: "main",
    inputs: { date: "2026-07-09", force: "true" },
  });
});

test("runHeartbeat dispatches only when unhealthy and not dry-run", async () => {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ?? "" });
    if (init.method === "HEAD") return new Response(null, { status: 404 });
    if (url.includes("/contents/data/automation_runs")) return json([]);
    if (url.endsWith("/dispatches")) return new Response(null, { status: 204 });
    throw new Error(`unexpected fetch ${url}`);
  };

  const result = await runHeartbeat({ env, date: "2026-07-09", fetchFn });

  assert.equal(result.dispatched, true);
  assert.ok(calls.some((call) => call.url.endsWith("/dispatches") && call.method === "POST"));
});

test("runHeartbeat derives the report date from the provided time", async () => {
  const seenDates = [];
  const fetchFn = async (url, init = {}) => {
    if (init.method === "HEAD") {
      const match = url.match(/\/(\d{4}-\d{2}-\d{2})\.json$/);
      if (match) seenDates.push(match[1]);
      return new Response(null, { status: 200 });
    }
    if (url.includes("/data/reports/2026-07-09.json")) return reportJson({ push: 1, watch: 0 });
    if (url.includes("/data/sourcing_candidates/2026-07-09.json")) return sourcingCandidatesJson({ qualified: 1 });
    if (url.includes("/contents/data/automation_runs")) {
      return json([
        { type: "file", name: "2026-07-09-watchdog.json", download_url: "https://example.test/receipt.json" },
      ]);
    }
    return json({
      status: "success",
      sync_response: JSON.stringify({ synced: true }),
    });
  };

  const result = await runHeartbeat({
    env,
    now: new Date("2026-07-08T16:30:00Z"),
    dryRun: true,
    fetchFn,
  });

  assert.equal(result.date, "2026-07-09");
  assert.deepEqual([...new Set(seenDates)], ["2026-07-09"]);
});

function json(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function reportJson({ push, watch }) {
  return json({
    report_date: "2026-07-09",
    push_pool: Array.from({ length: push }, (_, index) => ({ project: `Push ${index}` })),
    watch_pool: Array.from({ length: watch }, (_, index) => ({ project: `Watch ${index}` })),
    drop_pool: [],
  });
}

function sourcingCandidatesJson({ qualified }) {
  return json({
    report_date: "2026-07-09",
    sourcing_rule_version: "sourcing-rules-v7.2-china-joint",
    scan_summary: {
      new_qualified_count: qualified,
      push_pool_count: qualified,
    },
    candidates: [],
  });
}
