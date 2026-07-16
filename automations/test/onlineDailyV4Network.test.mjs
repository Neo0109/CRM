import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultHeaders,
  fetchJson,
  fetchText,
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
  });

  it("parses JSON through the same fetchText boundary", async () => {
    const payload = await fetchJson("https://example.com/data.json", {
      fetchImpl: async () => ({ ok: true, text: async () => "{\"ok\":true,\"count\":2}" })
    });

    assert.deepEqual(payload, { ok: true, count: 2 });
  });
});
