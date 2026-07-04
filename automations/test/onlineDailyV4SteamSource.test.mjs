import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSteamCandidateTasks,
  enrichSteamCandidate,
  fetchAppDetails,
  fetchSteamSearch,
  parseMaybeJsonHtml,
  parseSteamSearchHtml
} from "../jobs/online_daily_v4_steam_source.mjs";

describe("online daily v4 Steam source pipeline", () => {
  it("parses Steam search JSON/HTML into stable candidate shape", () => {
    const html = `
      <a href="https://store.steampowered.com/app/123456/Test_Game/" data-ds-appid="123456">
        <span class="title">Test &amp; Game</span>
        <div class="search_released">Coming soon</div>
        <div class="search_reviewscore">Very Positive</div>
        <span class="top_tag">Strategy</span>
        <span class="top_tag">Simulation</span>
      </a>
    `;

    assert.equal(parseMaybeJsonHtml(JSON.stringify({ results_html: html })), html);
    assert.deepEqual(parseSteamSearchHtml(html, "Steam Test Source"), [{
      appId: "123456",
      title: "Test & Game",
      release: "Coming soon",
      reviewText: "Very Positive",
      tags: ["Strategy", "Simulation"],
      source: "Steam Test Source",
      sourceIndex: 0,
      href: "https://store.steampowered.com/app/123456/"
    }]);
  });

  it("falls back from Steam result JSON to the search page and tags domestic discovery queries", async () => {
    const urls = [];
    const candidates = await fetchSteamSearch("popularcomingsoon", "Steam CN Domestic Demo Keyword", [], {
      cc: "cn",
      l: "schinese",
      domesticLens: true,
      query: "国产 Demo",
      fetchTextImpl: async (url) => {
        urls.push(url);
        if (url.includes("/search/results/")) return "{\"results_html\":\"\"}";
        return `
          <a href="/app/222222/Domestic_Demo/" data-ds-appid="222222">
            <span class="title">国产 Demo</span>
          </a>
        `;
      },
      logger: { warn: () => {} }
    });

    assert.equal(urls.length, 2);
    assert.equal(candidates[0].appId, "222222");
    assert.equal(candidates[0].domesticLens, true);
    assert.equal(candidates[0].domesticQuery, true);
  });

  it("fetches AppDetails with non-game filtering and retry on throttling", async () => {
    let calls = 0;
    const details = await fetchAppDetails("123", {
      sleepImpl: async () => {},
      fetchJsonImpl: async () => {
        calls += 1;
        if (calls === 1) throw new Error("429 Too Many Requests");
        return { 123: { success: true, data: { type: "game", name: "Retry Game" } } };
      },
      logger: { warn: () => {} }
    });
    assert.equal(details.name, "Retry Game");
    assert.equal(calls, 2);

    const nonGame = await fetchAppDetails("456", {
      fetchJsonImpl: async () => ({ 456: { success: true, data: { type: "dlc", name: "DLC" } } }),
      logger: { warn: () => {} }
    });
    assert.equal(nonGame, null);
  });

  it("enriches Steam candidates without live network and keeps contact fallback", async () => {
    const lead = await enrichSteamCandidate(
      {
        appId: "123456",
        title: "Fallback Title",
        source: "Steam CN Domestic Demo Keyword",
        release: "Coming soon",
        reviewText: "Very Positive",
        tags: ["Strategy"],
        domesticLens: true,
        domesticQuery: true
      },
      {
        name: "国产策略 Demo",
        type: "game",
        developers: ["Shanghai Studio"],
        publishers: [],
        genres: [{ description: "Strategy" }],
        categories: [{ description: "Single-player" }],
        release_date: { coming_soon: true, date: "2026 年 9 月 1 日" },
        short_description: "A strategy game with demo.",
        screenshots: [{}, {}, {}, {}],
        movies: [{}],
        recommendations: { total: 800 },
        support_info: { email: "support@example.com", url: "" },
        website: "https://example.com"
      },
      {
        reportDate: "2026-07-05",
        contactsFromWebsiteImpl: async () => [],
        scoreCandidateImpl: () => 120
      }
    );

    assert.equal(lead.title, "国产策略 Demo");
    assert.equal(lead.storeUrl, "https://store.steampowered.com/app/123456/");
    assert.equal(lead.steamDbUrl, "https://steamdb.info/app/123456/");
    assert.equal(lead.country, "中国（待确认）");
    assert.equal(lead.alreadyReleased, false);
    assert.equal(lead.score, 120);
    assert.ok(lead.contactMethods.some((method) => method.type === "Steam"));
    assert.ok(lead.contactMethods.some((method) => method.type === "Email"));
  });

  it("builds the same Steam source task fanout used by the daily orchestrator", () => {
    const tasks = buildSteamCandidateTasks({
      fetchSteamSearchImpl: async () => [],
      fetchFeaturedCategoriesImpl: async () => []
    });

    assert.equal(tasks.length, 20);
    assert.equal(typeof tasks[0], "function");
  });
});
