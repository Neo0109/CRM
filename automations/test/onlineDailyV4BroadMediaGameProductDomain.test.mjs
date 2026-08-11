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

const broadPlatformAliases = ["B站", "哔哩哔哩", "bilibili", "Bili Bili", "B·站"];
const insufficientPlatformTerms = ["官方", "授权", "发行", "合作", "需求", "上线"];

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
  "国产",
  "中国",
  "国人",
  "国内",
  "海外",
  "进口",
  "全球",
  "亚洲",
  "本土",
  "首款",
  "热门",
  "精品",
  "重磅",
  "年度新游",
  "二次元",
  "武侠",
  "卡牌",
  "策略",
  "肉鸽",
  "模拟经营",
  "移动",
  "PC",
  "神秘新作",
  "重磅新作",
  "年度力作",
  "未命名新作",
  "尚未命名项目",
  "代号项目",
  "备受期待作品",
  "腾讯",
  "网易",
  "米哈游",
  "字节跳动",
  "某上市公司",
  "雪佛兰",
  "星河公司",
  "未来集团",
  "山海工作室",
  "两款",
  "三款",
  "十款",
  "10款",
  "证券时报",
  "网络游戏管理办法",
  "未成年人保护条例",
  "手游测试规范",
  "合作备忘录",
  "2026中国游戏产业白皮书",
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
  "development team",
  ...broadPlatformAliases,
  ...broadPlatformAliases.flatMap((alias) => insufficientPlatformTerms.flatMap((term) => [
    `${alias}${term}`,
    `${term}${alias}`,
    `${alias}·${term}`,
    `${term}：${alias}`
  ]))
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

const modifierNoNameTitles = [
  "国产手游 一家开发团队最新更新 开启 Playtest",
  "国产端游 官方最新消息 公布 Demo",
  "中国手游 多个游戏项目 开放测试",
  "国人端游 公司最新消息 公布实机",
  "国内手游 一款全新游戏 开启 Playtest",
  "海外独立游戏 官方最新消息 公布 Demo",
  "进口网络游戏 一家开发团队最新更新 开放测试",
  "首款手游 一家开发团队最新更新 开启 Playtest",
  "热门独立游戏 官方最新消息 公布 Demo",
  "多款国产手游 公司最新消息 开放测试",
  "海外网络游戏 多个游戏项目 公布实机",
  "二次元手游 官方最新消息 公布 Demo",
  "武侠手游 一家开发团队最新更新 开启 Playtest",
  "卡牌手游 公司最新消息 开放测试",
  "策略手游 多个游戏项目 公布实机",
  "肉鸽手游 官方最新消息 公布 Demo",
  "模拟经营手游 一家开发团队最新更新 开启 Playtest",
  "移动手游 公司最新消息 开放测试",
  "PC手游 多个游戏项目 公布实机",
  "腾讯手游 官方最新消息 公布 Demo",
  "网易手游 一家开发团队最新更新 开启 Playtest",
  "米哈游手游 公司最新消息 开放测试",
  "字节跳动手游 多个游戏项目 公布实机",
  "某上市公司手游 官方最新消息 公布 Demo",
  "雪佛兰手游 一家开发团队最新更新 开启 Playtest",
  "两款手游 官方最新消息 公布 Demo",
  "三款国产手游 一家开发团队最新更新 开启 Playtest",
  "十款独立游戏 公司最新消息 开放测试",
  "10款手游 多个游戏项目 公布实机",
  ...broadPlatformAliases.flatMap((alias) => insufficientPlatformTerms.flatMap((term) => [
    `${alias}${term}手游 多个游戏项目 公布 Demo`,
    `${term}：${alias}手游 一家开发团队最新更新 开启 Playtest`
  ]))
];

const modifierNoNameItems = modifierNoNameTitles.map((title, index) => ({
  title,
  summary: "报道包含地区修饰、游戏类别和产品事件，但没有具体项目名称。",
  source: "IT之家",
  link: `https://example.test/category-modifier-${index + 1}`,
  source_quality: 7,
  source_focus: ["china", "technology"],
  candidate_domain_gate: "game_product",
  score: 52
}));

const explicitGameCategoryBindings = [
  "PC游戏",
  "移动游戏",
  "小游戏",
  "网页游戏",
  "VR游戏",
  "ARPG游戏",
  "二次元游戏",
  "策略游戏",
  "模拟经营游戏",
  "Steam游戏",
  "掌机游戏",
  "客户端游戏",
  "移动端游戏"
];

const connectorBindingCases = [
  ["星海远征 国产独立游戏正式公布 Demo", "星海远征"],
  ["星海远征 国产独立游戏即将开启 Playtest", "星海远征"],
  ["星海远征 国产独立游戏今日发布实机", "星海远征"],
  ["Project Echo mobile game announces Demo", "Project Echo"],
  ["Aether Echo PC game officially reveals Demo", "Aether Echo"],
  ["Project Echo console game launches Playtest", "Project Echo"],
  ["国产手游新作 星海远征公布 Demo", "星海远征"],
  ["手游 星海远征 今日公布 Demo", "星海远征"],
  ["mobile game Project Echo announces Demo", "Project Echo"],
  ["PC game Aether Echo officially reveals Demo", "Aether Echo"],
  ...explicitGameCategoryBindings.map((category) => [
    `星海远征 ${category} 公布 Demo`,
    "星海远征"
  ])
].map(([title, expectedProject], index) => ({
  item: {
    title,
    summary: "固定离线 fixture，用于验证无引号项目名与事件连接词的边界。",
    source: "IT之家",
    link: `https://example.test/unquoted-event-framing-${index + 1}`,
    source_quality: 7,
    source_focus: ["china", "technology"],
    candidate_domain_gate: "game_product",
    score: 52
  },
  expectedProject
}));

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
    assert.equal(
      rules.broad_media_candidate_domain_gate.structured_identity_constraints.url_trailing_delimiter_policy,
      "strip_prose_delimiters_before_strict_route_validation"
    );
    assert.deepEqual(
      rules.broad_media_candidate_domain_gate.project_name_constraints,
      {
        extraction_order: ["structured_string", "quoted", "explicit_unquoted"],
        normalization: "nfkc_casefold_strip_separators",
        explicit_category_matching: "shared_longest_first_vocabulary_no_bare_game",
        explicit_category_vocabulary: [
          "模拟经营游戏", "客户端游戏", "移动端游戏", "二次元游戏", "独立游戏", "网络游戏",
          "电子游戏", "手机游戏", "主机游戏", "电脑游戏", "单机游戏", "国产游戏", "移动游戏",
          "小游戏", "网页游戏", "策略游戏", "卡牌游戏", "武侠游戏", "肉鸽游戏", "Steam游戏",
          "掌机游戏", "ARPG游戏", "PC游戏", "VR游戏", "手游", "端游",
          "mobile game", "pc game", "console game"
        ],
        category_prefix_modifier_policy: "consume_region_promotion_genre_platform_and_generic_count_modifiers",
        generic_count_policy: "arabic_or_chinese_numeral_plus_classifier",
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
        organization_only_policy: "reject_known_platform_publisher_or_organization_suffix_shape",
        bilibili_alias_policy: "normalize_and_segment_as_insufficient_platform_terms",
        reporting_prefix_policy: "reject_prefix_at_separator_or_end",
        quoted_entity_policy: "structured_first_then_event_bound_non_document_quote",
        unquoted_slot_framing_policy: "strip_name_introducers_and_event_connectors_within_category_event_slot",
        lead_project_binding: "shared_extractor"
      }
    );
    assert.equal(
      rules.broad_media_candidate_domain_gate.dedupe_component_policy,
      "transitive_shared_key_component_with_conservative_gate_precedence"
    );
    assert.deepEqual(
      rules.broad_media_candidate_domain_gate.insufficient_platform_aliases,
      ["B站", "哔哩哔哩", "bilibili", "Bili Bili", "B·站"]
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
      },
      {
        ...genericDescriptorItem("代号：鸢", "unquoted", "named-codename-residue-cn"),
        title: "国产手游 代号：鸢 公布 Demo"
      },
      {
        ...genericDescriptorItem("神秘海域", "structured", "named-placeholder-residue-cn"),
        title: "国产独立游戏开放测试",
        project_name: "神秘海域"
      },
      {
        ...genericDescriptorItem("中国式家长", "structured", "named-region-residue-cn"),
        title: "国产手游公布试玩 Demo",
        project_name: "中国式家长"
      },
      {
        ...genericDescriptorItem("上海之夏", "structured", "named-place-residue-cn"),
        title: "国产端游公开实机",
        project_name: "上海之夏"
      },
      {
        ...genericDescriptorItem("腾讯极光计划", "structured", "named-brand-residue-cn"),
        title: "国产网络游戏公布开发日志",
        project_name: "腾讯极光计划"
      },
      {
        ...genericDescriptorItem("武侠乂", "structured", "named-genre-residue-wuxia"),
        title: "国产手游开放测试",
        project_name: "武侠乂"
      },
      {
        ...genericDescriptorItem("卡牌迷境", "structured", "named-genre-residue-card"),
        title: "国产端游公布 Demo",
        project_name: "卡牌迷境"
      },
      {
        ...genericDescriptorItem("策略之王", "structured", "named-genre-residue-strategy"),
        title: "国产游戏公开实机",
        project_name: "策略之王"
      },
      {
        ...genericDescriptorItem("肉鸽地牢", "structured", "named-genre-residue-roguelike"),
        title: "国产独立游戏开启 Playtest",
        project_name: "肉鸽地牢"
      },
      {
        ...genericDescriptorItem("模拟经营物语", "structured", "named-genre-residue-sim"),
        title: "国产手游开放商店页愿望单",
        project_name: "模拟经营物语"
      },
      {
        ...genericDescriptorItem("移动迷城", "structured", "named-platform-residue-mobile"),
        title: "国产端游公布试玩 Demo",
        project_name: "移动迷城"
      },
      {
        ...genericDescriptorItem("PC小队", "structured", "named-platform-residue-pc"),
        title: "国产主机游戏公布首曝",
        project_name: "PC小队"
      },
      {
        ...genericDescriptorItem("纪元10：余烬", "structured", "named-numeric-residue-cn"),
        title: "国产网络游戏开放测试",
        project_name: "纪元10：余烬"
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

  it("consumes category modifiers without losing valid before-category project names", async () => {
    for (const item of modifierNoNameItems) {
      assert.equal(mediaRules.extractGameProductDomainProjectName(item), null, item.title);
      assert.equal(mediaRules.hasGameProductDomainEvidence(item), false, item.title);
      assert.deepEqual(mediaRules.classifyMediaDisposition(item), {
        kind: "radar_only",
        reason: "non_game_broad_media"
      }, item.title);
    }

    let enrichmentCalls = 0;
    let secondPassCalls = 0;
    const leads = await buildMediaLeadCandidates(
      modifierNoNameItems,
      emptyIndex(),
      offlineContext({
        enrichMediaLeadsWithSteamContextImpl: async (candidates) => {
          enrichmentCalls += 1;
          return candidates;
        }
      })
    );
    const artifact = buildSourcingCandidateArtifact({
      reportDate: "2026-08-11",
      capturedAt: "2026-08-11T12:00:00+08:00",
      ruleVersion: RULE_VERSION,
      mediaSignalsSeen: modifierNoNameItems.length,
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

    const beforeCategoryNamedItems = [
      {
        ...modifierNoNameItems[0],
        title: "星海远征 国产手游开启 Playtest",
        link: "https://example.test/starsea-before-domestic-mobile-category"
      },
      {
        ...modifierNoNameItems[5],
        title: "雾港纪事 海外独立游戏开放 Demo",
        link: "https://example.test/fog-harbor-before-overseas-indie-category"
      }
    ];
    const namedLeads = await buildMediaLeadCandidates(
      beforeCategoryNamedItems,
      emptyIndex(),
      offlineContext({ enrichMediaLeadsWithSteamContextImpl: async (candidates) => candidates })
    );

    assert.deepEqual(
      beforeCategoryNamedItems.map((item) => mediaRules.extractGameProductDomainProjectName(item)),
      ["星海远征", "雾港纪事"]
    );
    assert.equal(namedLeads.length, 2);
    assert.deepEqual(new Set(namedLeads.map((lead) => lead.project)), new Set(["星海远征", "雾港纪事"]));
  });

  it("strips only unquoted name-slot framing and binds both category orders exactly", async () => {
    for (const { item, expectedProject } of connectorBindingCases) {
      assert.equal(mediaRules.extractGameProductDomainProjectName(item), expectedProject, item.title);
      assert.equal(mediaRules.hasGameProductDomainEvidence(item), true, item.title);
      assert.equal(mediaRules.classifyMediaDisposition(item).kind, "lead_candidate", item.title);

      const leads = await buildMediaLeadCandidates(
        [item],
        emptyIndex(),
        offlineContext({ enrichMediaLeadsWithSteamContextImpl: async (candidates) => candidates })
      );
      assert.equal(leads.length, 1, item.title);
      assert.equal(leads[0].project, expectedProject, item.title);
    }

    const arbitraryGameNoun = {
      ...connectorBindingCases[0].item,
      title: "星海远征 游戏 公布 Demo",
      link: "https://example.test/arbitrary-game-noun-is-not-category"
    };
    assert.equal(mediaRules.extractGameProductDomainProjectName(arbitraryGameNoun), null);
    assert.equal(mediaRules.hasGameProductDomainEvidence(arbitraryGameNoun), false);
    assert.deepEqual(mediaRules.classifyMediaDisposition(arbitraryGameNoun), {
      kind: "radar_only",
      reason: "non_game_broad_media"
    });
  });

  it("selects the project quote while excluding source and document entities", async () => {
    const multiQuote = {
      title: "《证券时报》：国产手游《星海远征》公布 Demo",
      summary: "固定离线 fixture，首个书名号实体是来源，第二个才是项目。",
      source: "IT之家",
      link: "https://example.test/multi-quote-project-binding",
      source_quality: 7,
      source_focus: ["china", "technology"],
      candidate_domain_gate: "game_product",
      score: 52
    };
    assert.equal(mediaRules.extractGameProductDomainProjectName(multiQuote), "星海远征");
    const positiveLeads = await buildMediaLeadCandidates(
      [multiQuote],
      emptyIndex(),
      offlineContext({ enrichMediaLeadsWithSteamContextImpl: async (candidates) => candidates })
    );
    assert.equal(positiveLeads.length, 1);
    assert.equal(positiveLeads[0].project, "星海远征");

    const documentItems = [
      "《网络游戏管理办法》明确手游测试规范",
      "《未成年人保护条例》要求国产手游测试整改",
      "《合作备忘录》涉及手游 Playtest 需求",
      "《2026中国游戏产业白皮书》：国产手游 Demo 数量增长"
    ].map((title, index) => ({
      ...multiQuote,
      title,
      link: `https://example.test/quoted-document-${index + 1}`
    }));
    documentItems.push({
      ...multiQuote,
      title: "国产手游公布 Demo",
      project_name: "网络游戏管理办法",
      link: "https://example.test/structured-document-project"
    });

    for (const item of documentItems) {
      assert.equal(mediaRules.extractGameProductDomainProjectName(item), null, item.title);
      assert.equal(mediaRules.hasGameProductDomainEvidence(item), false, item.title);
      assert.deepEqual(mediaRules.classifyMediaDisposition(item), {
        kind: "radar_only",
        reason: "non_game_broad_media"
      }, item.title);
    }

    let enrichmentCalls = 0;
    let secondPassCalls = 0;
    const leads = await buildMediaLeadCandidates(documentItems, emptyIndex(), offlineContext({
      enrichMediaLeadsWithSteamContextImpl: async (candidates) => {
        enrichmentCalls += 1;
        return candidates;
      }
    }));
    const artifact = buildSourcingCandidateArtifact({
      reportDate: "2026-08-11",
      capturedAt: "2026-08-11T12:00:00+08:00",
      ruleVersion: RULE_VERSION,
      mediaSignalsSeen: documentItems.length,
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
    const punctuatedProductUrls = [
      "https://store.steampowered.com/app/123456,",
      "https://store.steampowered.com/app/123456.",
      "https://www.taptap.cn/app/234567;",
      "https://steamdb.info/app/345678:",
      "https://store.steampowered.com/app/456789),",
      "https://www.taptap.cn/game/567890).",
      "https://indienova.com/g/Lost%20Dream%20Chronicle】"
    ];
    for (const url of punctuatedProductUrls) {
      const item = { ...identityBase, links: [url] };
      assert.equal(mediaRules.hasGameProductDomainEvidence(item), true, url);
      assert.equal(mediaRules.classifyMediaDisposition(item).kind, "lead_candidate", url);
    }
    const punctuatedReservedUrls = [
      "https://indienova.com/g/news.",
      "https://indienova.com/g/groups.",
      "https://indienova.com/g/search."
    ];
    for (const url of punctuatedReservedUrls) {
      const item = { ...identityBase, links: [url] };
      assert.equal(mediaRules.hasGameProductDomainEvidence(item), false, url);
      assert.deepEqual(mediaRules.classifyMediaDisposition(item), {
        kind: "radar_only",
        reason: "non_game_broad_media"
      }, url);
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

  it("collapses transitive dedupe bridges into one conservatively marked component", async () => {
    const bridgeA = {
      title: "官方B站国产游戏 公布 Demo",
      summary: "通用平台与产品措辞，没有具体项目名。",
      source: "GameLook",
      link: "https://gamelook.com.cn/article/bridge-a",
      source_quality: 8,
      source_focus: ["china", "product"],
      score: 52
    };
    const bridgeB = {
      ...bridgeA,
      title: "国产游戏 官方B站 公布 Demo",
      source: "IT之家",
      link: "https://www.ithome.com/bridge-b",
      candidate_domain_gate: "game_product"
    };
    const bridgeC = {
      ...bridgeA,
      source: "游戏葡萄",
      link: bridgeB.link
    };
    const inputOrders = [
      [bridgeA, bridgeB, bridgeC],
      [bridgeA, bridgeC, bridgeB],
      [bridgeB, bridgeA, bridgeC],
      [bridgeB, bridgeC, bridgeA],
      [bridgeC, bridgeA, bridgeB],
      [bridgeC, bridgeB, bridgeA]
    ];

    for (const input of inputOrders) {
      let enrichmentCalls = 0;
      const deduped = dedupeMediaSignals(input);
      const lanes = partitionMediaLeadSourceItems(deduped);
      const leads = await buildMediaLeadCandidates(input, emptyIndex(), offlineContext({
        enrichMediaLeadsWithSteamContextImpl: async (candidates) => {
          enrichmentCalls += 1;
          return candidates;
        }
      }));

      assert.equal(deduped.length, 1);
      assert.equal(deduped[0].candidate_domain_gate, "game_product");
      assert.deepEqual(mediaRules.classifyMediaDisposition(deduped[0]), {
        kind: "radar_only",
        reason: "non_game_broad_media"
      });
      assert.deepEqual(lanes, { strict: [], expanded: [], rescue: [] });
      assert.deepEqual(leads, []);
      assert.equal(enrichmentCalls, 0);
    }
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
