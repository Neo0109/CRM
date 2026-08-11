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

const broadNegatives = [
  fixture.exact_false_positive,
  ...fixture.generic_non_game,
  ...fixture.generic_game_product_no_name,
  ...fixture.malformed_identity,
  ...fixture.marked_domain_reason_precedence
];

const genericProjectDescriptors = [
  "最新消息",
  "行业动态",
  "多款新作",
  "一款新作",
  "新游资讯",
  "研发团队",
  "多个项目",
  "本作",
  "全新作品",
  "游戏新闻",
  "公司新闻",
  "企业动态",
  "开发团队",
  "制作团队",
  "产品消息",
  "官方消息",
  "公告",
  "某游戏",
  "某项目",
  "游戏项目",
  "公司项目",
  "品牌项目",
  "合作项目",
  "发行项目",
  "多款游戏",
  "一款游戏",
  "该作",
  "本项目",
  "全新游戏",
  "官方授权",
  "合作需求",
  "某公司",
  "某团队",
  "某工作室",
  "一家团队",
  "一款产品",
  "一款新游",
  "这款游戏",
  "旗下新作",
  "项目动态",
  "最新 消息",
  "行业 资讯",
  "行业：资讯",
  "全新游戏项目",
  "最新游戏项目",
  "多个游戏项目",
  "一款全新游戏",
  "这款新游戏",
  "某公司项目",
  "公司最新消息",
  "官方最新消息",
  "游戏最新消息",
  "latest game project",
  "company latest news",
  "official game update",
  "new publishing project",
  "development team update",
  "报道称",
  "消息称",
  "官方",
  "开发者",
  "团队",
  "制作组",
  "latest news",
  "industry update",
  "game news",
  "new title",
  "new game",
  "project",
  "development team"
];

const genericProjectPrefixes = [
  "报道称",
  "消息称",
  "官方",
  "开发者",
  "开发团队",
  "团队",
  "制作组"
];

function genericDescriptorItem(descriptor, mode, index) {
  const base = {
    title: "国产独立游戏公布试玩 Demo",
    summary: "报道包含游戏类别与产品事件，但没有具体项目名称。",
    source: "IT之家",
    link: `https://example.test/generic-project-${mode}-${index}`,
    source_quality: 7,
    source_focus: ["china", "technology"],
    candidate_domain_gate: "game_product",
    score: 52
  };
  if (mode === "structured") return { ...base, project_name: descriptor };
  if (mode === "quoted") return { ...base, title: `国产独立游戏《${descriptor}》公布 Demo` };
  return { ...base, title: `国产独立游戏 ${descriptor} 公布 Demo` };
}

describe("broad-media game-product candidate domain", () => {
  it("publishes the exact V7.2.1 machine/default source contract", async () => {
    const rules = await loadDailyRules({ rootDir: new URL("../..", import.meta.url) });
    const defaults = defaultDailyRuleConfig();
    const broadSourceNames = ["IT之家", "证券时报", "澎湃新闻"];

    assert.equal(RULE_VERSION, "sourcing-rules-v7.2.1-media-product-domain");
    assert.equal(rules.rule_version, RULE_VERSION);
    assert.equal(rules.canonical_rules_doc, "docs/SOURCING_RULES_V7_2_1.md");
    assert.equal(
      rules.broad_media_candidate_domain_gate.structured_identity_constraints.platform_ids,
      "positive_numeric"
    );
    assert.deepEqual(
      rules.broad_media_candidate_domain_gate.structured_identity_constraints.game_id_namespaces,
      ["steam", "taptap", "indienova", "kuaibao", "3839"]
    );
    assert.deepEqual(
      rules.broad_media_candidate_domain_gate.structured_identity_constraints.namespaced_game_id_constraints,
      {
        steam: "positive_numeric",
        taptap: "positive_numeric",
        indienova: "concrete_non_reserved_slug",
        kuaibao: "positive_numeric",
        3839: "positive_numeric"
      }
    );
    assert.deepEqual(
      rules.broad_media_candidate_domain_gate.structured_identity_constraints.kuaibao_product_routes,
      ["a", "shouyou", "game", "games", "app", "apps", "product", "products"]
    );
    assert.deepEqual(
      rules.broad_media_candidate_domain_gate.project_name_constraints,
      {
        extraction_order: ["structured_string", "quoted", "explicit_unquoted"],
        normalization: "nfkc_casefold_strip_separators",
        generic_descriptor_policy: "reject_when_entire_normalized_name_segments_into_generic_tokens",
        generic_token_categories: [
          "qualifier_quantifier",
          "organization_team",
          "game_product_project",
          "news_update_message",
          "business_license_publishing",
          "english_equivalent"
        ],
        distinctive_residue_policy: "admit_when_non_generic_residue_remains",
        placeholder_policy: "reject_quantified_and_attribution_descriptors",
        reporting_prefix_policy: "reject_prefix_at_separator_or_end",
        lead_project_binding: "shared_extractor"
      }
    );
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
    const positives = [
      ...fixture.broad_media_positive,
      fixture.structured_identity_positive,
      ...fixture.unquoted_title_positive
    ];
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
      mediaRules.extractGameProductDomainProjectName({
        title: "国产独立游戏 星海远征 公布试玩 Demo"
      }),
      "星海远征"
    );
    assert.equal(
      positiveLeads.find((lead) => lead._mediaItem?.link === "https://example.test/unquoted-starsea-demo")?.project,
      "星海远征",
      "the same pure extractor must feed the stored Lead project for a tagged broad-media item"
    );

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

  it("rejects missing, generic, event-only, and non-string project fields", () => {
    const generic = fixture.generic_game_product_no_name[0];
    const invalidProjectNames = [
      undefined,
      null,
      42,
      { name: "雾港纪事" },
      "undefined",
      "null",
      "unknown",
      "untitled",
      "游戏",
      "项目",
      "新作",
      "Demo",
      "公布试玩 Demo",
      "获批版号",
      "开放商店页愿望单"
    ];

    for (const projectName of invalidProjectNames) {
      assert.equal(
        mediaRules.hasGameProductDomainEvidence({ ...generic, project_name: projectName }),
        false,
        `invalid project field must not qualify: ${String(projectName)}`
      );
    }
    assert.equal(
      mediaRules.hasGameProductDomainEvidence({ ...generic, project_name: "雾港纪事" }),
      true,
      "a concrete structured project name still satisfies the named-project requirement"
    );
    for (const item of fixture.unquoted_title_positive) {
      assert.equal(mediaRules.hasGameProductDomainEvidence(item), true, item.title);
      assert.equal(mediaRules.classifyMediaDisposition(item).kind, "lead_candidate", item.title);
      assert.notEqual(mediaRules.extractGameProductDomainProjectName(item), null, item.title);
    }
    for (const item of fixture.generic_game_product_no_name) {
      assert.equal(mediaRules.extractGameProductDomainProjectName(item), null, item.title);
    }
  });

  it("binds every named semantic admission to one stored Lead project extractor", async () => {
    assert.equal(typeof mediaRules.extractGameProductDomainProjectName, "function");
    assert.equal(
      mediaRules.extractGameProductDomainProjectName(fixture.structured_project_name_positive),
      "雾港纪事"
    );
    const leads = await buildMediaLeadCandidates(
      [fixture.structured_project_name_positive],
      emptyIndex(),
      offlineContext({ enrichMediaLeadsWithSteamContextImpl: async (candidates) => candidates })
    );
    assert.equal(leads.length, 1);
    assert.equal(leads[0].project, "雾港纪事");
  });

  it("rejects wholly generic project descriptors across every name path", async () => {
    const genericItems = [
      ...genericProjectDescriptors.flatMap((descriptor, index) =>
        ["structured", "quoted", "unquoted"].map((mode) =>
          genericDescriptorItem(descriptor, mode, index)
        )
      ),
      ...genericProjectPrefixes.flatMap((prefix, index) =>
        ["structured", "quoted", "unquoted"].map((mode) =>
          genericDescriptorItem(`${prefix} 雾港纪事`, mode, `prefix-${index}`)
        )
      )
    ];

    for (const item of genericItems) {
      assert.equal(
        mediaRules.extractGameProductDomainProjectName(item),
        null,
        `${item.link} must not expose a generic descriptor as a project name`
      );
      assert.equal(mediaRules.hasGameProductDomainEvidence(item), false, item.link);
      assert.deepEqual(mediaRules.classifyMediaDisposition(item), {
        kind: "radar_only",
        reason: "non_game_broad_media"
      }, item.link);
    }

    let enrichmentCalls = 0;
    let secondPassCalls = 0;
    const leads = await buildMediaLeadCandidates(genericItems, emptyIndex(), offlineContext({
      enrichMediaLeadsWithSteamContextImpl: async (candidates) => {
        enrichmentCalls += 1;
        return candidates;
      }
    }));
    const artifact = buildSourcingCandidateArtifact({
      reportDate: "2026-08-11",
      capturedAt: "2026-08-11T12:00:00+08:00",
      ruleVersion: RULE_VERSION,
      mediaSignalsSeen: genericItems.length,
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

    assert.deepEqual(leads, []);
    assert.equal(enrichmentCalls, 0);
    assert.equal(artifact.scan_summary.media_candidates_seen, 0);
    assert.equal(artifact.scan_summary.records_total, 0);
    assert.equal(artifact.scan_summary.formal, 0);
    assert.deepEqual(secondPass.eligible_order, []);
    assert.equal(secondPassCalls, 0);

    const namedItems = [
      {
        ...genericDescriptorItem("星海远征", "structured", "named-structured-cn"),
        title: "国产独立游戏公布试玩 Demo",
        project_name: "星海远征"
      },
      {
        ...genericDescriptorItem("雾港纪事", "unquoted", "named-unquoted-cn"),
        title: "国产独立游戏 雾港纪事 公布 Demo"
      },
      {
        ...genericDescriptorItem("Lost Dream Chronicle", "structured", "named-structured-en"),
        title: "PC game announced Playtest",
        project_name: "Lost Dream Chronicle"
      },
      {
        ...genericDescriptorItem("行业动态模拟器", "structured", "named-generic-word-cn"),
        title: "国产独立游戏公开实机",
        project_name: "行业动态模拟器"
      },
      {
        ...genericDescriptorItem("New Game Chronicle", "structured", "named-generic-word-en"),
        title: "国产游戏开放商店页愿望单",
        project_name: "New Game Chronicle"
      },
      {
        ...genericDescriptorItem("新月计划", "structured", "named-generic-token-fragments-cn"),
        title: "国产独立游戏公布开发日志",
        project_name: "新月计划"
      },
      {
        ...genericDescriptorItem("Project Echo", "structured", "named-generic-token-fragments-en"),
        title: "PC game announced Demo",
        project_name: "Project Echo"
      }
    ];
    const namedLeads = await buildMediaLeadCandidates(namedItems, emptyIndex(), offlineContext({
      enrichMediaLeadsWithSteamContextImpl: async (candidates) => candidates
    }));

    const expectedProjectByLink = new Map(namedItems.map((item) => [
      item.link,
      mediaRules.extractGameProductDomainProjectName(item)
    ]));
    assert.equal(namedLeads.length, namedItems.length);
    for (const lead of namedLeads) {
      assert.equal(lead.project, expectedProjectByLink.get(lead._mediaItem?.link));
    }
  });

  it("accepts only narrow structured IDs and normalized product routes", () => {
    const identityBase = {
      ...fixture.exact_false_positive,
      title: "企业身份字段测试",
      summary: "没有游戏类别或产品事件。",
      link: "https://example.test/identity-field-test"
    };
    const validStructuredIdentity = [
      { steam_app_id: 123456 },
      { steamAppId: "234567" },
      { taptap_app_id: 345678 },
      { taptapAppId: "456789" },
      { game_id: 567890 },
      { gameId: "steam:123456" },
      { game_id: "taptap:345678" },
      { game_id: "indienova:fog-harbor" },
      { game_id: "kuaibao:456789" },
      { game_id: "3839:567890" }
    ];

    for (const identity of validStructuredIdentity) {
      assert.equal(mediaRules.hasGameProductDomainEvidence({ ...identityBase, ...identity }), true);
    }
    for (const item of fixture.normalized_identity_positive) {
      assert.equal(mediaRules.hasGameProductDomainEvidence(item), true, item.links[0]);
      assert.equal(mediaRules.classifyMediaDisposition(item).kind, "lead_candidate", item.links[0]);
    }
    for (const item of fixture.malformed_identity) {
      assert.equal(mediaRules.hasGameProductDomainEvidence(item), false, item.title);
      assert.deepEqual(mediaRules.classifyMediaDisposition(item), {
        kind: "radar_only",
        reason: "non_game_broad_media"
      });
    }
  });

  it("uses one uniform broad-media failure reason before downstream topic taxonomy", () => {
    for (const item of fixture.marked_domain_reason_precedence) {
      assert.equal(mediaRules.hasGameProductDomainEvidence(item), false, item.title);
      assert.deepEqual(mediaRules.classifyMediaDisposition(item), {
        kind: "radar_only",
        reason: "non_game_broad_media"
      }, item.title);
    }
  });

  it("preserves a broad-media gate through non-Bilibili dedupe in both input orders", async () => {
    const marked = {
      ...fixture.generic_game_product_no_name[0],
      summary: "开发者公布试玩安排，但报道没有给出任何具体项目名称。",
      source_focus: ["china", "domestic_sourcing"]
    };
    const unmarked = { ...marked, source: "GameLook" };
    delete unmarked.candidate_domain_gate;

    for (const input of [[marked, unmarked], [unmarked, marked]]) {
      let enrichmentCalls = 0;
      const [merged] = dedupeMediaSignals(input);
      const leads = await buildMediaLeadCandidates(input, emptyIndex(), offlineContext({
        enrichMediaLeadsWithSteamContextImpl: async (candidates) => {
          enrichmentCalls += 1;
          return candidates;
        }
      }));

      assert.equal(merged.candidate_domain_gate, "game_product");
      assert.deepEqual(mediaRules.classifyMediaDisposition(merged), {
        kind: "radar_only",
        reason: "non_game_broad_media"
      });
      assert.deepEqual(leads, []);
      assert.equal(enrichmentCalls, 0);
    }

    const plainPrimary = { ...unmarked, link: "https://example.test/plain-dedupe-control" };
    const plainSecondary = { ...plainPrimary, source: "游戏葡萄" };
    assert.strictEqual(
      dedupeMediaSignals([plainPrimary, plainSecondary])[0],
      plainPrimary,
      "two unmarked non-Bilibili duplicates retain the legacy primary object byte-semantics"
    );
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
      mediaRules.hasGameProductDomainEvidence(fixture.game_vertical_animation_control),
      false,
      "the broad-media domain helper intentionally does not treat PV/category wording alone as sufficient"
    );
    assert.equal(
      mediaRules.classifyMediaDisposition(fixture.game_vertical_animation_control).kind,
      "lead_candidate",
      "untagged game-vertical animation signals must retain the legacy independent-game evidence boundary"
    );
    assert.equal(isProductSourcingSignal(fixture.game_vertical_animation_control), true);
    assert.equal(
      mediaRules.hasGameProductDomainEvidence({
        ...fixture.structured_identity_positive,
        links: ["https://store.steampowered.com/app/4567890/"]
      }),
      true
    );
  });
});
