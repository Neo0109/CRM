#!/usr/bin/env node
// Explicit read-only GitHub Actions smoke, separate from fixed-fixture tests.
// No generator imports, no report writes, no credentials or CRM requests.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseRadarFeedItems, parseChuappRadarItems, readRadarArticleMetadata } from "../automations/jobs/online_daily_v4_radar.mjs";
import { fetchText } from "../automations/jobs/online_daily_v4_network.mjs";
const rules = JSON.parse(await readFile(new URL("../automations/rules/daily-report.json", import.meta.url), "utf8"));
let failures = 0;
for (const source of rules.radar_sources) {
  try {
    const body = await fetchText(source.url, { timeoutMs: 12000 });
    const items = source.type === "chuapp_page" ? parseChuappRadarItems(body, source) : parseRadarFeedItems(body, source);
    assert.ok(items.length > 0, "source has no parseable article entries");
    const example = items[0];
    const meta = source.type === "chuapp_page" ? readRadarArticleMetadata(await fetchText(example.link, { timeoutMs: 12000 })) : example;
    assert.ok(Number.isFinite(Date.parse(meta.published_at)), "source sample lacks a publication date");
    assert.ok(meta.summary || items.some(item => item.summary), "source has no extractable publisher summaries");
    console.log(JSON.stringify({ source: source.name, status: "ok", articles: items.length, example: example.link, published_at: meta.published_at, publisher_summary_present: Boolean(meta.summary || example.summary) }));
  } catch (error) {
    failures++;
    console.error(JSON.stringify({ source: source.name, status: "failed", reason: error.message }));
  }
}
assert.equal(failures, 0, "all Radar-only sources must pass before activation");
