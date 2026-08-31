import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifySourceError,
  defaultHeaders,
  fetchJson,
  fetchText,
  sourceOutcomeForHttpStatus,
  shouldUseCurlFallback
} from "../jobs/online_daily_v4_network.mjs";

describe("online daily v4 network boundary", () => {
  it("adds Bilibili browser headers while keeping a stable CRM user agent", async () => {
    const calls = [];
    const text = await fetchText("https://api.bilibili.com/x/web-interface/search/type", {
      accept: "application/json",
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return { ok: true, text: async () => "ok" };
      }
    });

    assert.equal(text, "ok");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.headers.Accept, "application/json");
    assert.match(calls[0].options.headers["User-Agent"], /SourcingCRM/);
    assert.equal(calls[0].options.headers.Referer, "https://search.bilibili.com/");
    assert.equal(calls[0].options.headers.Origin, "https://search.bilibili.com");
    assert.match(defaultHeaders("text/html")["User-Agent"], /SourcingCRM/);
  });

  it("uses curl fallback for Steam network failures but not for 429 throttles", async () => {
    const warnings = [];
    const steamText = await fetchText("https://store.steampowered.com/search/results/?term=demo", {
      accept: "text/html",
      fetchImpl: async () => {
        const error = new Error("fetch failed");
        error.cause = { code: "ECONNRESET" };
        throw error;
      },
      execFileImpl: async (binary, args) => {
        assert.equal(binary, "curl");
        assert.ok(args.includes("--retry"));
        return { stdout: "<html>fallback</html>" };
      },
      logger: { warn: (message) => warnings.push(message) }
    });

    assert.equal(steamText, "<html>fallback</html>");
    assert.equal(warnings.length, 1);
    assert.equal(shouldUseCurlFallback(new Error("429 Too Many Requests")), false);

    await assert.rejects(
      () => fetchText("https://store.steampowered.com/search/results/?term=demo", {
        fetchImpl: async () => ({ ok: false, status: 429, statusText: "Too Many Requests", text: async () => "" }),
        execFileImpl: async () => {
          throw new Error("should not run curl fallback for 429");
        }
      }),
      /429 Too Many Requests/
    );
  });

  it("preserves HTTP status and parses Retry-After for rate-limit policy", async () => {
    let captured;
    await assert.rejects(
      () => fetchText("https://store.steampowered.com/search/results/?term=demo", {
        fetchImpl: async () => ({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          headers: { get: (name) => name.toLowerCase() === "retry-after" ? "7" : null },
          text: async () => ""
        })
      }),
      (error) => {
        captured = error;
        return /429 Too Many Requests/.test(error.message);
      }
    );

    assert.equal(captured.status, 429);
    assert.equal(captured.retryAfterMs, 7000);
    assert.equal(captured.sourceOutcome, "rate_limited");
  });

  it("classifies payment, access, rate-limit, upstream, and network failures", () => {
    assert.equal(sourceOutcomeForHttpStatus(402), "payment_required");
    assert.equal(sourceOutcomeForHttpStatus(403), "forbidden");
    assert.equal(sourceOutcomeForHttpStatus(412), "rate_limited");
    assert.equal(sourceOutcomeForHttpStatus(429), "rate_limited");
    assert.equal(sourceOutcomeForHttpStatus(503), "upstream_error");
    assert.equal(classifySourceError(new Error("fetch failed: ECONNRESET")), "network_error");
  });

  it("does not invoke Steam curl fallback for 402 or 403 responses", async () => {
    for (const status of [402, 403]) {
      let curlCalls = 0;
      await assert.rejects(
        () => fetchText("https://store.steampowered.com/search/results/?term=demo", {
          fetchImpl: async () => ({
            ok: false,
            status,
            statusText: status === 402 ? "Payment Required" : "Forbidden",
            headers: { get: () => null },
            text: async () => ""
          }),
          execFileImpl: async () => {
            curlCalls += 1;
            return { stdout: "" };
          }
        }),
        (error) => error.status === status
      );
      assert.equal(curlCalls, 0);
    }
  });

  it("rejects Cloudflare challenge responses even when the HTTP status is 200", async () => {
    for (const response of [
      {
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === "cf-mitigated" ? "challenge" : name.toLowerCase() === "content-type" ? "text/html" : null },
        text: async () => "<html><title>Just a moment...</title></html>"
      },
      {
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === "content-type" ? "text/html; charset=UTF-8" : null },
        text: async () => "<!doctype html><script src=\"/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1\"></script>"
      }
    ]) {
      await assert.rejects(
        () => fetchText("https://example.com/feed", { fetchImpl: async () => response }),
        (error) => error.sourceOutcome === "challenge" && error.provider === "cloudflare"
      );
    }
  });

  it("classifies a successful HTTP response with invalid JSON as parse mismatch", async () => {
    await assert.rejects(
      () => fetchJson("https://example.com/data.json", {
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          text: async () => "<html>not json</html>"
        })
      }),
      (error) => error.sourceOutcome === "parse_mismatch"
    );
  });

  it("parses JSON through the same fetchText boundary", async () => {
    const payload = await fetchJson("https://example.com/data.json", {
      fetchImpl: async () => ({ ok: true, text: async () => "{\"ok\":true,\"count\":2}" })
    });

    assert.deepEqual(payload, { ok: true, count: 2 });
  });
});
