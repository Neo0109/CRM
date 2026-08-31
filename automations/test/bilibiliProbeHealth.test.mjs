import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectBilibiliProbeSignals } from "../jobs/bilibili_probe.mjs";

function response(status, payload = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 412 ? "Precondition Failed" : "OK",
    async json() {
      return payload;
    }
  };
}

function config(overrides = {}) {
  return {
    schema_version: 1,
    rule_version: "sourcing-rules-v6.4-bili-probe",
    max_video_age_days: 120,
    max_detail_fetches: 0,
    request_concurrency: 1,
    request_batch_delay_ms: 0,
    retry_delays_ms: [1],
    official_uids: [],
    developer_uids: [],
    publisher_uids: [],
    media_uids: [],
    trusted_creator_uids: [],
    keywords: ["国产 策略 Steam"],
    keyword_fallbacks: {},
    required_keywords: [],
    blacklist_uids: [],
    blacklist_bvids: [],
    blacklist_keywords: [],
    generic_collection_patterns: [],
    ...overrides
  };
}

describe("Bilibili probe source health", () => {
  it("retries a 412 response with injected backoff and records source health", async () => {
    let attempts = 0;
    const sleeps = [];
    const result = await collectBilibiliProbeSignals({
      reportDate: "2026-07-10",
      config: config(),
      sleepImpl: async (ms) => sleeps.push(ms),
      fetchImpl: async () => {
        attempts += 1;
        if (attempts === 1) return response(412);
        return response(200, { data: { result: [] } });
      }
    });

    assert.equal(attempts, 2);
    assert.deepEqual(sleeps, [1]);
    assert.equal(result.diagnostics.rate_limit_retries, 1);
    assert.equal(result.diagnostics.source_failures, 0);
    assert.deepEqual(result.diagnostics.source_health["keyword:国产 策略 Steam"], {
      attempts: 1,
      successes: 1,
      failures: 0,
      candidates: 0,
      fallback_uses: 0,
      last_error: null,
      last_outcome: "ok",
      outcome_counts: { ok: 1 }
    });
  });

  it("uses a configured fallback keyword after the primary query exhausts retries", async () => {
    const seenKeywords = [];
    const result = await collectBilibiliProbeSignals({
      reportDate: "2026-07-10",
      config: config({
        retry_delays_ms: [],
        keyword_fallbacks: { "国产 策略 Steam": "国产 策略游戏" }
      }),
      sleepImpl: async () => {},
      fetchImpl: async (url) => {
        const keyword = new URL(url).searchParams.get("keyword");
        seenKeywords.push(keyword);
        if (keyword === "国产 策略 Steam") return response(412);
        return response(200, {
          data: {
            result: [{ bvid: "BVFALLBACK", title: "国产策略游戏 Demo", pubdate: 1783612800 }]
          }
        });
      }
    });

    assert.deepEqual(seenKeywords, ["国产 策略 Steam", "国产 策略游戏"]);
    assert.equal(result.diagnostics.fallback_queries, 1);
    assert.equal(result.diagnostics.source_failures, 0);
    assert.equal(result.diagnostics.keyword_candidates, 1);
    assert.equal(result.diagnostics.source_health["keyword:国产 策略 Steam"].fallback_uses, 1);
  });
});
