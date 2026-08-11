import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { after, describe, it } from "node:test";

import { buildSourcingCandidateArtifact } from "../jobs/online_daily_v4_candidate_audit.mjs";
import {
  dedupeMediaSignals,
  selectDiverseMediaSignals,
  sourceTaggedItem
} from "../jobs/online_daily_v4_dedupe.mjs";
import {
  isChinaJointMediaSourcingSignal,
  isDomesticMediaRescueSignal,
  isExpandedDomesticProductSignal,
  isProductSourcingSignal
} from "../jobs/online_daily_v4_media_entities.mjs";
import {
  buildMediaLeadCandidates,
  partitionMediaLeadSourceItems
} from "../jobs/online_daily_v4_media_leads.mjs";
import * as mediaRules from "../jobs/online_daily_v4_media_rules.mjs";
import { mediaSignalToRadarItem } from "../jobs/online_daily_v4_reports.mjs";
import {
  defaultDailyRuleConfig,
  loadDailyRules,
  RULE_VERSION
} from "../jobs/online_daily_v4_rules.mjs";
import { runV73TargetedCandidateSecondPasses } from "../jobs/online_daily_v7_3_second_pass_orchestrator.mjs";

const fixture = JSON.parse(readFileSync(
  new URL("./fixtures/broad-media-game-product-domain.json", import.meta.url),
  "utf8"
));
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error("broad-media domain-gate test network sentinel: live access is forbidden");
};
after(() => {
  globalThis.fetch = originalFetch;
});

function emptyIndex() {
  return {
    projects: new Set(),
    projectLooseKeys: new Set(),
    steamAppIds: new Set(),
    links: new Set(),
    keys: new Set()
  };
}

function diagnostics() {
  return {
    media_non_product_filtered: 0,
    media_expanded_product_candidates: 0,
    media_rescue_product_candidates: 0,
    media_duplicate_filtered: 0,
    media_steam_appids_extracted: 0,
    media_released_routed_to_drop: 0,
    media_radar_only: 0,
    media_rejected: 0,
    media_exact_steam_lookup_attempts: 0,
    media_exact_steam_lookup_hits: 0,
    steam_links_detected: 0,
    steam_evidence_materialized: 0,
    steam_demo_parent_converted: 0,
    steam_evidence_released_filtered: 0,
    steam_evidence_duplicate_merged: 0,
    steam_evidence_lost: 0
  };
}

function offlineContext(overrides = {}) {
  return {
    reportDate: "2026-08-11",
    diagnostics: diagnostics(),
    maxOfficialLookups: 0,
    maxExactSteamLookups: 0,
    sleepImpl: async () => {},
    fetchOfficialBilibiliCandidatesImpl: async () => {
      throw new Error("broad-media negatives must not enter official enrichment");
    },
    fetchSteamExactTitleCandidatesImpl: async () => {
      throw new Error("broad-media negatives must not enter exact-title enrichment");
    },
    fetchAppDetailsImpl: async () => {
      throw new Error("broad-media test must not call Steam AppDetails");
    },
    collectContactMethodsImpl: async () => [],
    ...overrides
  };
}

const broadNegatives = [fixture.exact_false_positive, ...fixture.generic_non_game];

describe("broad-media game-product candidate domain", () => {
  it("publishes the exact V7.2.1 machine/default source contract", async () => {
    const rules = await loadDailyRules({ rootDir: new URL("../..", import.meta.url) });
    const defaults = defaultDailyRuleConfig();
    const broadSourceNames = ["IT之家", "证券时报", "澎湃新闻"];

    assert.equal(RULE_VERSION, "sourcing-rules-v7.2.1-media-product-domain");
    assert.equal(rules.rule_version, RULE_VERSION);
    assert.equal(rules.canonical_rules_doc, "docs/SOURCING_RULES_V7_2_1.md");
    for (const name of broadSourceNames) {
      assert.equal(
        rules.media_sources.find((source) => source.name === name)?.candidate_domain_gate,
        "game_product"
      );
      const defaultSource = defaults.mediaSources.find((source) => source.name === name);
      assert.equal(defaultSource?.candidate_domain_gate, "game_product");
      assert.equal(
        sourceTaggedItem({ title: "fixture", link: "https://example.test" }, defaultSource).candidate_domain_gate,
        "game_product"
      );
    }

    const canonicalUrl = new URL("../../docs/SOURCING_RULES_V7_2_1.md", import.meta.url);
    assert.equal(existsSync(canonicalUrl), true);
    const canonical = readFileSync(canonicalUrl, "utf8");
    const current = readFileSync(new URL("../../docs/SOURCING_RULES_CURRENT.md", import.meta.url), "utf8");
    assert.match(canonical, /non_game_broad_media/);
    assert.match(canonical, /candidate_domain_gate.*game_product/);
    assert.match(current, /SOURCING_RULES_V7_2_1\.md/);
  });

  it("keeps exact Chevrolet and generic company news Radar-only with one stable reason", () => {
    assert.equal(typeof mediaRules.hasGameProductDomainEvidence, "function");
    assert.equal(typeof mediaRules.isGameProductCandidateDomainSource, "function");

    for (const item of broadNegatives) {
      assert.deepEqual(mediaRules.classifyMediaDisposition(item), {
        kind: "radar_only",
        reason: "non_game_broad_media"
      });
      assert.equal(mediaRules.hasGameProductDomainEvidence(item), false);
      assert.equal(isProductSourcingSignal(item), false);
      assert.equal(isChinaJointMediaSourcingSignal(item), false);
      assert.equal(isExpandedDomesticProductSignal(item), false);
      assert.equal(isDomesticMediaRescueSignal(item), false);
    }
  });

  it("admits only structured identity or concrete project + category + product event on broad media", async () => {
    const positives = [...fixture.broad_media_positive, fixture.structured_identity_positive];
    for (const item of positives) {
      assert.equal(mediaRules.hasGameProductDomainEvidence(item), true, item.title);
      assert.equal(mediaRules.classifyMediaDisposition(item).kind, "lead_candidate", item.title);
      assert.equal(isExpandedDomesticProductSignal(item), true, item.title);
    }
    const positiveLeads = await buildMediaLeadCandidates(positives, emptyIndex(), offlineContext({
      enrichMediaLeadsWithSteamContextImpl: async (leads) => leads
    }));
    assert.equal(positiveLeads.length, positives.length);

    assert.equal(
      mediaRules.hasGameProductDomainEvidence({
        ...fixture.exact_false_positive,
        summary: "B站 官方 授权 发行 合作 需求 上线"
      }),
      false
    );
    assert.equal(mediaRules.classifyMediaDisposition(fixture.game_vertical_control).kind, "lead_candidate");
    assert.equal(isProductSourcingSignal(fixture.game_vertical_control), true);
  });

  it("keeps failed broad media in Radar but out of candidate, enrichment, audit, second pass, and formal Lead", async () => {
    let enrichmentCalls = 0;
    let secondPassCalls = 0;
    const context = offlineContext({
      enrichMediaLeadsWithSteamContextImpl: async () => {
        enrichmentCalls += 1;
        return [];
      }
    });
    const radarSignals = selectDiverseMediaSignals(broadNegatives, 14);
    const radarCard = mediaSignalToRadarItem(fixture.exact_false_positive, 0, {
      reportDate: "2026-08-11",
      capturedAt: "2026-08-11T12:00:00+08:00"
    });
    const leads = await buildMediaLeadCandidates(broadNegatives, emptyIndex(), context);
    const artifact = buildSourcingCandidateArtifact({
      reportDate: "2026-08-11",
      capturedAt: "2026-08-11T12:00:00+08:00",
      ruleVersion: RULE_VERSION,
      mediaSignalsSeen: broadNegatives.length,
      mediaCandidates: leads,
      candidatePools: { push: [], watch: [], drop: [] },
      publishedPools: { push: [], watch: [], drop: [] }
    });
    const secondPass = await runV73TargetedCandidateSecondPasses({
      steamCandidates: [],
      mediaCandidates: leads,
      candidateStates: new Map(),
      capturedAt: "2026-08-11T12:00:00+08:00",
      fetchEvidence: async () => {
        secondPassCalls += 1;
        return {};
      }
    });

    assert.ok(radarSignals.includes(fixture.exact_false_positive));
    assert.match(`${radarCard.summary} ${radarCard.relevance} ${radarCard.suggested_action}`, /非游戏|Radar|雷达/);
    assert.deepEqual(leads, []);
    assert.equal(enrichmentCalls, 0);
    assert.equal(artifact.scan_summary.media_signals_seen, broadNegatives.length);
    assert.equal(artifact.scan_summary.media_candidates_seen, 0);
    assert.equal(artifact.scan_summary.records_total, 0);
    assert.equal(artifact.scan_summary.formal, 0);
    assert.deepEqual(secondPass.eligible_order, []);
    assert.equal(secondPassCalls, 0);
  });

  it("processes a strict/expanded overlap once before enrichment", async () => {
    let enrichmentCalls = 0;
    let enrichmentInputCount = 0;
    const context = offlineContext({
      enrichMediaLeadsWithSteamContextImpl: async (leads) => {
        enrichmentCalls += 1;
        enrichmentInputCount += leads.length;
        return leads;
      }
    });
    const leads = await buildMediaLeadCandidates(
      [fixture.overlap_positive, fixture.overlap_positive],
      emptyIndex(),
      context
    );

    assert.equal(isProductSourcingSignal(fixture.overlap_positive), false);
    assert.equal(isChinaJointMediaSourcingSignal(fixture.overlap_positive), true);
    assert.equal(isExpandedDomesticProductSignal(fixture.overlap_positive), true);
    assert.equal(enrichmentCalls, 1);
    assert.equal(enrichmentInputCount, 1);
    assert.equal(leads.length, 1);
    assert.equal(context.diagnostics.media_expanded_product_candidates, 0);
  });

  it("partitions strict, expanded, and rescue items into disjoint bounded lanes", () => {
    const expandedAndRescue = Array.from({ length: 49 }, (_, index) => ({
      ...fixture.broad_media_positive[1],
      title: `国产独立游戏《雾港纪事${index + 1}》公开 Demo`,
      link: `https://example.test/fog-harbor-demo-${index + 1}`
    }));
    const deduped = dedupeMediaSignals([
      fixture.overlap_positive,
      fixture.overlap_positive,
      ...expandedAndRescue
    ]);
    const lanes = partitionMediaLeadSourceItems(deduped);
    const allLaneItems = [...lanes.strict, ...lanes.expanded, ...lanes.rescue];

    assert.equal(deduped.length, 50);
    assert.equal(lanes.strict.length, 1);
    assert.equal(lanes.expanded.length, 48);
    assert.equal(lanes.rescue.length, 1);
    assert.equal(new Set(allLaneItems).size, allLaneItems.length);
    assert.equal(allLaneItems.length, deduped.length);
  });

  it("regresses animation filtering and normalized Steam identity", () => {
    assert.deepEqual(mediaRules.classifyMediaDisposition(fixture.animation_control), {
      kind: "radar_only",
      reason: "non_game_animation_series"
    });
    assert.equal(
      mediaRules.hasGameProductDomainEvidence({
        ...fixture.structured_identity_positive,
        links: ["https://store.steampowered.com/app/4567890/"]
      }),
      true
    );
  });
});
