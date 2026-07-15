import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSteamCandidateTasks,
  enrichSteamCandidate,
  fetchAppDetails,
  fetchSteamSearch,
  parseMaybeJsonHtml,
  parseSteamSearchHtml,
  prioritizeSteamCandidatesForReview
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

  it("projects only explicit official Demo/gameplay and verified public-quality evidence", async () => {
    const lead = await enrichSteamCandidate(
      {
        appId: "234567",
        title: "Evidence Game",
        source: "Steam Popular Upcoming",
        release: "Coming soon",
        reviewText: "",
        tags: ["Strategy"],
        domesticLens: false,
        domesticQuery: false
      },
      {
        name: "Evidence Game",
        type: "game",
        developers: ["Evidence Studio"],
        publishers: [],
        genres: [{ description: "Strategy" }],
        categories: [{ description: "Single-player" }],
        release_date: { coming_soon: true, date: "2027 年 1 月 1 日" },
        short_description: "A systems-heavy strategy game seeking a Chinese publishing and localization partner for China.",
        screenshots: Array.from({ length: 12 }, () => ({})),
        movies: [
          { name: "Cinematic Trailer", webm: { max: "https://cdn.example/cinematic.webm" } },
          { name: "Official Gameplay Trailer", webm: { max: "https://cdn.example/gameplay.webm" } }
        ],
        demos: [{ appid: 234568, description: "Evidence Game Demo" }],
        recommendations: { total: 1200 },
        support_info: { email: "publishing@evidence.example", url: "" },
        website: "https://evidence.example"
      },
      {
        reportDate: "2026-07-16",
        contactsFromWebsiteImpl: async () => [],
        scoreCandidateImpl: () => 1
      }
    );

    assert.deepEqual(lead.officialDemoEvidence.map((item) => item.type), ["steam_demo"]);
    assert.deepEqual(lead.officialGameplayEvidence.map((item) => item.value), ["Official Gameplay Trailer"]);
    assert.deepEqual(lead.qualityProofs.map((item) => item.type), ["steam_recommendations_500_plus"]);
    assert.match(lead.chinaBilibiliValue, /机制讲解|效率挑战/);
    assert.match(lead.chinaDemandEvidence, /Chinese publishing and localization partner for China/i);
  });

  it("does not turn screenshot count or a generic cinematic trailer into official gameplay evidence", async () => {
    const lead = await enrichSteamCandidate(
      {
        appId: "345678",
        title: "Metadata Only",
        source: "Steam CN Strategy Upcoming",
        release: "Coming soon",
        reviewText: "",
        tags: ["Strategy"],
        domesticLens: true,
        domesticQuery: true
      },
      {
        name: "Metadata Only",
        type: "game",
        developers: ["Metadata Studio"],
        publishers: [],
        genres: [{ description: "Strategy" }],
        categories: [{ description: "Single-player" }],
        release_date: { coming_soon: true, date: "2027 年 1 月 1 日" },
        short_description: "A strategy game.",
        screenshots: Array.from({ length: 40 }, () => ({})),
        movies: [{ name: "Announcement Trailer", mp4: { max: "https://cdn.example/announcement.mp4" } }],
        demos: [],
        recommendations: { total: 0 },
        support_info: { email: "", url: "" },
        website: ""
      },
      {
        reportDate: "2026-07-16",
        contactsFromWebsiteImpl: async () => [],
        scoreCandidateImpl: () => 9999
      }
    );

    assert.deepEqual(lead.officialDemoEvidence, []);
    assert.deepEqual(lead.officialGameplayEvidence, []);
    assert.deepEqual(lead.qualityProofs, []);
    assert.equal(lead.chinaDemandEvidence, null);
  });

  it("builds the same Steam source task fanout used by the daily orchestrator", () => {
    const tasks = buildSteamCandidateTasks({
      fetchSteamSearchImpl: async () => [],
      fetchFeaturedCategoriesImpl: async () => []
    });

    assert.equal(tasks.length, 20);
    assert.equal(typeof tasks[0], "function");
  });

  it("prioritizes Steam candidates with usable review windows before enrichment", () => {
    const prioritized = prioritizeSteamCandidatesForReview([
      {
        appId: "1",
        title: "Near Window",
        source: "Steam CN Domestic Demo Keyword",
        release: "2026 年 7 月 20 日",
        sourceIndex: 0,
        domesticLens: true,
        domesticQuery: true
      },
      {
        appId: "2",
        title: "Healthy Domestic Window",
        source: "Steam CN Domestic Demo Keyword",
        release: "2026 年 10 月 20 日",
        sourceIndex: 1,
        domesticLens: true,
        domesticQuery: true
      },
      {
        appId: "3",
        title: "Already Released",
        source: "Steam Popular Upcoming",
        release: "2026 年 6 月 1 日",
        sourceIndex: 2
      },
      {
        appId: "4",
        title: "Unknown Coming Soon",
        source: "Steam CN Indie Keyword Upcoming",
        release: "Coming soon",
        sourceIndex: 3,
        domesticLens: true,
        domesticQuery: true
      }
    ], { reportDate: "2026-07-09" });

    assert.deepEqual(prioritized.map((candidate) => candidate.appId), ["2", "4", "1", "3"]);
  });
});
