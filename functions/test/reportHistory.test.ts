import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fetchHistoricalJson } from "../_lib/reportHistory";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("report history fetching", () => {
  it("falls back to the latest available prior report when today has not been generated", async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);

      if (url.startsWith("https://api.github.com/repos/Neo0109/CRM/contents/data/radar")) {
        return Response.json([
          { name: "2026-07-06.json", type: "file" },
          { name: "2026-07-05.json", type: "file" },
          { name: "README.md", type: "file" }
        ]);
      }

      if (url.startsWith("https://raw.githubusercontent.com/Neo0109/CRM/main/data/radar/2026-07-06.json")) {
        return Response.json({
          report_date: "2026-07-06",
          summary: "Radar history is available",
          items: [{ id: "radar-1", category: "行业新闻" }]
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const result = await fetchHistoricalJson("2026-07-07", {
      basePath: "data/radar",
      branch: "main",
      fallbackSummary: "fallback",
      repoFullName: "Neo0109/CRM",
      today: "2026-07-07"
    });

    assert.equal(result.requested_date, "2026-07-07");
    assert.equal(result.report.report_date, "2026-07-06");
    assert.equal(result.is_fallback, true);
    assert.deepEqual(result.available_dates, ["2026-07-06", "2026-07-05"]);
    assert.match(result.source, /data\/radar\/2026-07-06\.json$/);
    assert.equal(calls.some((url) => url.includes("2026-07-07.json")), false);
  });

  it("returns an explicit empty fallback report when no history files are available", async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://api.github.com/repos/Neo0109/CRM/contents/data/steam_trends")) {
        return Response.json([]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const result = await fetchHistoricalJson("2026-07-07", {
      basePath: "data/steam_trends",
      branch: "main",
      fallbackSummary: "No Steam history yet",
      repoFullName: "Neo0109/CRM",
      today: "2026-07-07"
    });

    assert.deepEqual(result.available_dates, []);
    assert.equal(result.is_fallback, false);
    assert.equal(result.requested_date, "2026-07-07");
    assert.deepEqual(result.report, {
      report_date: "2026-07-07",
      summary: "No Steam history yet",
      items: []
    });
  });
});
