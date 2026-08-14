import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildDailyRuleConfig,
  defaultDailyRuleConfig,
  loadDailyRules,
  mediaSourceConfigFromRules,
  qualityGateConfigFromRules,
  radarDiversityConfigFromRules,
  RULE_VERSION,
  validateDailyRules
} from "../jobs/online_daily_v4_rules.mjs";

const rootDir = new URL("../..", import.meta.url);
const generatorPath = "automations/jobs/online_daily_v4.mjs";
const validRuleHeader = {
  schema_version: 1,
  rule_version: RULE_VERSION,
  active_rules_doc: "docs/SOURCING_RULES_CURRENT.md",
  compatible_generators: [generatorPath]
};

describe("online daily v4 rule config", () => {
  it("exposes the locked V7.2 regular-lane rule version", () => {
    assert.equal(RULE_VERSION, "sourcing-rules-v7.2.2-near-pass-review");
  });

  it("loads the current daily rules into machine-readable runtime config", async () => {
    const rules = await loadDailyRules({ rootDir });
    assert.doesNotThrow(() => validateDailyRules(rules));
    assert.ok(Array.isArray(rules.media_sources));
    assert.ok(rules.media_quality_gates);
    assert.ok(rules.radar_diversity);
    assert.equal(rules.rule_version, RULE_VERSION);

    const config = buildDailyRuleConfig(rules);
    assert.ok(config.mediaSources.length > 30);
    assert.deepEqual(
      config.mediaSources.find((source) => source.name === "GameLook"),
      {
        name: "GameLook",
        url: "http://www.gamelook.com.cn/feed",
        type: "feed",
        quality: 16,
        focus: ["china", "business", "domestic_sourcing"]
      }
    );

    const bilibiliSource = config.mediaSources.find((source) => source.name === "B站视频-国产游戏试玩");
    assert.ok(bilibiliSource.url.startsWith("https://api.bilibili.com/x/web-interface/search/type?"));
    assert.match(bilibiliSource.url, /keyword=.*%E5%9B%BD%E4%BA%A7%E6%B8%B8%E6%88%8F/);
    assert.ok(bilibiliSource.fallbackUrl.startsWith("https://search.bilibili.com/all?"));

    assert.equal(config.mediaSources.find((source) => source.name === "手游那点事").active, false);
    assert.equal(config.mediaSources.find((source) => source.name === "GamesBeat").active, false);
    assert.equal(config.mediaSources.find((source) => source.name === "澎湃新闻").active, false);
    assert.equal(config.mediaSources.find((source) => source.name === "游戏茶馆").url, "https://www.youxichaguan.com/");

    assert.equal(config.mediaQualityGates.maxBilibiliLeadAgeDays, 120);
    assert.equal(config.mediaQualityGates.lowScoreThreshold, 12);
    assert.equal(config.radarDiversity.limit, 14);
    assert.equal(config.radarDiversity.sourceCap, 2);
    assert.deepEqual(config.radarDiversity.targets[0], { category: "行业新闻", region: "china", count: 2 });
  });

  it("throws clear validation errors for incompatible rule files", () => {
    assert.throws(() => validateDailyRules({ ...validRuleHeader, schema_version: 2 }), /Unsupported daily report rule schema: 2/);
    assert.throws(() => validateDailyRules({ ...validRuleHeader, rule_version: "old" }), /Unsupported daily report rule version: old/);
    assert.throws(() => validateDailyRules({ ...validRuleHeader, compatible_generators: ["legacy.mjs"] }), /not marked compatible/);
    assert.throws(() => validateDailyRules({ ...validRuleHeader, active_rules_doc: "docs/OLD.md" }), /Unexpected active rules doc/);
  });

  it("keeps fallback defaults when optional machine-readable fields are absent", () => {
    const config = buildDailyRuleConfig(validRuleHeader);
    const defaults = defaultDailyRuleConfig();

    assert.equal(config.mediaSources.length, defaults.mediaSources.length);
    assert.equal(config.mediaQualityGates.maxBilibiliLeadAgeDays, 120);
    assert.equal(config.mediaQualityGates.lowScoreThreshold, 12);
    assert.deepEqual(config.radarDiversity, defaults.radarDiversity);
  });

  it("normalizes source, quality gate, and radar diversity config into runtime shape", () => {
    const customRules = {
      ...validRuleHeader,
      media_sources: [
        {
          name: "Custom Feed",
          url: "https://example.com/rss.xml",
          type: "feed",
          quality: 9,
          focus: ["global"],
          active: false,
          disabled_reason: "persistent 403",
          active_until: "2026-07-31"
        },
        {
          name: "B站视频-测试",
          type: "bilibili_video_search",
          query: "国产 测试 Demo",
          fallback_query: "国产 测试",
          quality: 15,
          focus: ["china", "bilibili"]
        }
      ],
      media_quality_gates: {
        max_bilibili_lead_age_days: 30,
        media_low_score_threshold: 18,
        probe_config: "custom-probe.json"
      },
      radar_diversity: {
        limit: 6,
        source_cap: 1,
        family_cap: 2,
        region_cap: 3,
        targets: [
          { category: "今日亮点", region: "china", count: 2 },
          { categories: ["B站趋势", "新梗热点"], count: 1 }
        ]
      }
    };

    assert.deepEqual(mediaSourceConfigFromRules(customRules)[0], {
      name: "Custom Feed",
      url: "https://example.com/rss.xml",
      type: "feed",
      quality: 9,
      focus: ["global"],
      active: false,
      disabledReason: "persistent 403",
      activeUntil: "2026-07-31"
    });
    assert.match(mediaSourceConfigFromRules(customRules)[1].url, /keyword=.*%E5%9B%BD%E4%BA%A7/);
    assert.match(mediaSourceConfigFromRules(customRules)[1].fallbackUrl, /keyword=.*%E5%9B%BD%E4%BA%A7/);
    assert.deepEqual(qualityGateConfigFromRules(customRules), {
      maxBilibiliLeadAgeDays: 30,
      lowScoreThreshold: 18,
      probeConfig: "custom-probe.json"
    });
    assert.deepEqual(radarDiversityConfigFromRules(customRules), {
      limit: 6,
      sourceCap: 1,
      familyCap: 2,
      regionCap: 3,
      targets: [
        { category: "今日亮点", region: "china", count: 2 },
        { categories: ["B站趋势", "新梗热点"], count: 1 }
      ]
    });
  });

  it("uses one exported rule version in both the loader and runner", () => {
    const runnerSource = readFileSync(new URL("../jobs/online_daily_runner.mjs", import.meta.url), "utf8");

    assert.match(
      runnerSource,
      /import\s+\{\s*RULE_VERSION\s*\}\s+from\s+"\.\/online_daily_v4_rules\.mjs"/
    );
    assert.match(runnerSource, /value\.rule_version\s*!==\s*RULE_VERSION/);
    assert.doesNotMatch(runnerSource, /sourcing-rules-v\d/);
  });

  it("keeps the daily orchestrator wired to the validated rule config", () => {
    const source = readFileSync(new URL("../jobs/online_daily_v4.mjs", import.meta.url), "utf8");

    assert.match(source, /loadDailyRules/);
    assert.match(source, /buildDailyRuleConfig/);
    assert.match(source, /ruleConfig/);
    assert.match(
      source,
      /selectDiverseMediaSignals\(dedupeMediaSignals\(mediaSignals\),\s*ruleConfig\.radarDiversity\.limit,\s*ruleConfig\.radarDiversity\)/s
    );
  });
});
