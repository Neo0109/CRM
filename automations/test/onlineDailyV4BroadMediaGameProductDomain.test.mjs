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
const domesticCompanyNames = [
  "网易", "腾讯", "字节", "字节跳动", "朝夕光年", "巨人", "西山居", "莉莉丝", "心动", "鹰角",
  "米哈游", "散爆", "库洛", "叠纸", "沐瞳", "灵犀", "祖龙", "完美世界", "中手游",
  "B站游戏", "哔哩哔哩游戏"
];
const organizationRoleTokens = [
  "旗下", "互娱", "娱乐", "互动", "数字", "文化", "信息", "软件", "传媒", "网络", "游戏", "科技",
  "股份", "控股", "事业群", "事业部", "部门", "中心"
];
const organizationTerminalRoleSuffixes = [
  "研发中心", "工作室群", "事业群", "事业部", "业务部", "实验室", "研究院", "项目组", "工作室",
  "制作组", "部门", "中心", "团队", "公司", "集团", "企业", "厂商", "股份", "控股"
];
const organizationOnlyProjectDescriptors = domesticCompanyNames.flatMap((name) => [
  name,
  ...organizationRoleTokens.map((role) => `${name}${role}`),
  `${name}旗下游戏`,
  `${name}互娱科技`
]);
const knownCompanyTerminalRoleDescriptors = [
  "网易雷火事业群",
  "网易伏羲实验室",
  "腾讯光子工作室群",
  "腾讯天美工作室群",
  "腾讯魔方工作室群",
  "字节游戏业务部",
  "心动TapTap事业部",
  "库洛上海研发中心",
  "叠纸百面千相项目组"
];
const genericCountProjectDescriptors = [
  "一批",
  "一系列",
  "若干批",
  "第十款",
  "第10个",
  "约10款",
  "近十款",
  "超10款",
  "超过10款",
  "逾十款",
  "至少10款",
  "至多十个",
  "最多3部",
  "共十项",
  "合计10款",
  "累计十款",
  "数十款",
  "上百款",
  "上千款",
  "10余款",
  "十多款",
  "百来款",
  "近百款",
  "约百款",
  "逾百款",
  "超百款",
  "至少上百款",
  "成百上千款",
  "若干款",
  "几十款",
  "十几款",
  "10款以上",
  "百款左右",
  "大约十款",
  "不下10款",
  "不少于十款",
  "十款以下",
  "十款以内",
  "十款上下",
  "十款起",
  "十款余",
  "若干批"
];

const genericQuantityOperatorTokens = [
  "累计", "整整", "一共",
  "总", "共", "合", "计", "多", "达", "高", "大", "约", "有", "莫", "将", "近", "接", "差",
  "不", "超", "过", "足", "满", "低", "少", "小", "于", "仅", "逾", "好", "至", "最", "下",
  "到", "上", "数", "第", "乎", "致", "概", "出", "止", "只"
];
const genericQuantityRangeConnectors = ["至", "到"];
const genericVagueQuantityTokens = ["少量", "大量", "海量", "一众", "大批", "一些", "少数", "多数"];

const quantityOperatorProjectDescriptors = [
  // Totals.
  "共计10款", "总计十款", "总共10款", "合共十款", "累计达10款", "合计达十款",
  // Magnitude.
  "多达10款", "高达十款", "达10款", "成千上万款",
  // Approximation.
  "约有10款", "大约有十款", "约莫10款", "将近十款", "接近10款", "差不多十款", "近乎10款",
  "大致十款", "大概10款", "好几款",
  // Comparison.
  "不足10款", "不到十款", "不满10款", "不超过十款", "不多于10款", "少于十款", "低于10款",
  "小于十款", "多于10款", "高于十款", "不低于10款", "超出十款", "不止10款",
  // Only.
  "仅10款", "仅有十款", "只有10款", "只10款",
  // Ranges.
  "十至二十款", "十到二十款", "10至20款", "10到20款"
];

const vagueQuantityProjectDescriptors = genericVagueQuantityTokens.map((token) => `${token}游戏`);

const numericProjectNameControls = [
  "纪元10：余烬", "第七史诗", "十字军之王", "百分百鲜橙汁", "好久不见", "两点之间"
];

const mediaSourceProjectDescriptors = [
  "央视新闻", "新华社", "游戏日报", "证券时报", "北京电视台", "中央广播", "中国通讯社",
  "游戏媒体", "中国新闻网", "产业资讯", "第一财经", "中国证券报", "南方周末", "经济观察报"
];

const documentRoleQualifiers = [
  "投资", "战略", "隐私", "安全", "技术", "管理", "征求", "保密", "补充", "框架", "联合", "整改",
  "用户", "数据", "信息", "网络", "内容", "平台", "开发", "运营", "推广", "营销", "合规", "治理",
  "保护", "指导", "实施", "试行", "暂行", "自律", "服务", "使用", "授权", "发行", "合作", "许可",
  "采购", "和解", "联运", "商务", "退款", "审核", "处理", "反馈"
];
const shortDocumentRoleDescriptors = [
  "服务协议", "和解协议", "采购协议", "联运协议", "商务协议", "投资协议", "战略协议",
  "隐私政策", "安全政策", "退款政策", "内容政策", "安全规范", "技术规范", "技术标准", "安全标准",
  "审核标准", "管理办法", "实施办法", "暂行办法", "处理办法", "征求意见", "审核意见", "反馈意见"
];

const genericProjectDescriptors = [
  "原创",
  "自研",
  "知名",
  "头部",
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
  "IT之家消息",
  "IT之家报道",
  "据报道",
  "数据显示",
  "报告显示",
  "业内人士称",
  "公司宣布",
  "官方透露",
  "机构指出",
  "团队表示",
  "手游市场",
  "PC游戏平台",
  "console game market",
  "国产游戏产业",
  "网络游戏市场",
  "手游生态",
  "PC游戏赛道",
  "国产游戏板块",
  "网络游戏领域",
  "独立游戏品类",
  "mobile game ecosystem",
  "PC game sector",
  "console game category",
  "indie game field",
  "mobile game segment",
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
  "某上市公司",
  "雪佛兰",
  "星河公司",
  "未来集团",
  "山海工作室",
  "游戏日报",
  ...mediaSourceProjectDescriptors,
  ...organizationOnlyProjectDescriptors,
  ...knownCompanyTerminalRoleDescriptors,
  "两款",
  "三款",
  "十款",
  "10款",
  ...genericCountProjectDescriptors,
  ...quantityOperatorProjectDescriptors,
  ...vagueQuantityProjectDescriptors,
  "证券时报",
  "网络游戏管理办法",
  "未成年人保护条例",
  "手游测试规范",
  "合作备忘录",
  "2026中国游戏产业白皮书",
  "关于促进网络游戏高质量发展的若干意见",
  "游戏产业自律倡议",
  "国产游戏发展要点",
  "网络游戏管理决定",
  "游戏产业发展规划",
  "网络游戏治理纲要",
  "关于游戏产业发展的指导意见",
  "保密协议",
  "补充协议",
  "框架协议",
  "联合声明",
  "整改通知",
  "用户公约",
  ...shortDocumentRoleDescriptors,
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

const roleClosureNegativeItems = [
  ...shortDocumentRoleDescriptors,
  ...knownCompanyTerminalRoleDescriptors
].flatMap((descriptor, index) =>
  ["structured", "quoted", "unquoted"].map((mode) =>
    genericDescriptorItem(descriptor, mode, `role-closure-${index}`)
  )
);

const roleClosurePositiveNames = [
  "逆光协议", "灵魂协议", "深空协议", "星际协议",
  "莉莉丝深空计划", "腾讯极光计划", "网易射雕", "米哈游原神"
];
const roleClosurePositiveItems = roleClosurePositiveNames.flatMap((project, index) =>
  ["structured", "quoted", "unquoted"].map((mode) => {
    const item = genericDescriptorItem(project, mode, `role-closure-positive-${index}`);
    return {
      ...item,
      ...(mode === "structured"
        ? { title: `国产独立游戏公布试玩 Demo fixture-${index + 1}` }
        : {}),
      expectedProject: project
    };
  })
);

const quantityGrammarNegativeItems = [
  ...quantityOperatorProjectDescriptors,
  ...vagueQuantityProjectDescriptors
].flatMap((descriptor, index) =>
  ["structured", "quoted", "unquoted"].map((mode) =>
    genericDescriptorItem(descriptor, mode, `quantity-closure-${index}`)
  )
);

const quantityGrammarPositiveItems = numericProjectNameControls.flatMap((project, index) =>
  ["structured", "quoted", "unquoted"].map((mode) => {
    const item = genericDescriptorItem(project, mode, `quantity-positive-${index}`);
    return {
      ...item,
      ...(mode === "structured"
        ? { title: `国产独立游戏公布试玩 Demo numeric-control-${index + 1}` }
        : {}),
      expectedProject: project
    };
  })
);

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
  "第十款手游 官方最新消息 公布 Demo",
  "数十款国产手游 一家开发团队最新更新 开启 Playtest",
  "约10款独立游戏 公司最新消息 开放测试",
  "超过10款手游 多个游戏项目 公布实机",
  "一批手游 官方最新消息 公布 Demo",
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

const attributionNoNameTitles = [
  "IT之家消息 国产手游公布 Demo",
  "IT之家报道 国产手游开放 Playtest",
  "据报道 国产手游公开实机",
  "数据显示 国产手游公布 Demo",
  "报告显示 国产手游开放测试",
  "业内人士称 国产手游公布 Demo",
  "公司宣布 国产手游开放 Playtest",
  "官方透露 国产手游公开实机",
  "机构指出 国产手游公布 Demo",
  "团队表示 国产手游开放测试"
];

const attributionNoNameItems = attributionNoNameTitles.map((title, index) => broadQaItem(
  title,
  `attribution-before-category-${index + 1}`
));

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
  ["星海远征 国产手游预计公布 Demo", "星海远征"],
  ["星海远征 国产手游今日将开放测试", "星海远征"],
  ["星海远征 国产手游将发布实机", "星海远征"],
  ["星海远征 国产手游将会开放 Playtest", "星海远征"],
  ["星海远征 国产手游计划于公布 Demo", "星海远征"],
  ["星海远征 国产手游有望开放测试", "星海远征"],
  ["星海远征 国产手游宣布将公布 Demo", "星海远征"],
  ["星海远征 国产手游即将于公布 Demo", "星海远征"],
  ["星海远征 国产手游拟于开放 Playtest", "星海远征"],
  ["星海远征 国产手游计划在发布实机", "星海远征"],
  ["星海远征 国产手游宣布将在公布 Demo", "星海远征"],
  ["星海远征 国产手游计划将在公布 Demo", "星海远征"],
  ["星海远征 国产手游有望于开放 Playtest", "星海远征"],
  ["星海远征 国产手游拟在发布实机", "星海远征"],
  ["星海远征 国产手游宣布计划开放 Demo", "星海远征"],
  ["Project Echo mobile game announces Demo", "Project Echo"],
  ["Aether Echo PC game officially reveals Demo", "Aether Echo"],
  ["Project Echo console game launches Playtest", "Project Echo"],
  ["Project Echo mobile game will announce Demo", "Project Echo"],
  ["Project Echo mobile game shall reveal Demo", "Project Echo"],
  ["Project Echo mobile game plans to launch Playtest", "Project Echo"],
  ["Project Echo mobile game is set to reveal Demo", "Project Echo"],
  ["Project Echo mobile game expected to launch Playtest", "Project Echo"],
  ["Project Echo mobile game plans on launching Demo", "Project Echo"],
  ["Project Echo mobile game is expected to reveal Demo", "Project Echo"],
  ["Project Echo mobile game is going to announce Demo", "Project Echo"],
  ["Project Echo mobile game will be launching Demo", "Project Echo"],
  ["Project Echo mobile game scheduled to launch Playtest", "Project Echo"],
  ["国产手游新作 星海远征公布 Demo", "星海远征"],
  ["国产手游新作星海远征公布 Demo", "星海远征"],
  ["手游 星海远征 今日公布 Demo", "星海远征"],
  ["国产手游 星海远征 预计公布 Demo", "星海远征"],
  ["国产手游 星海远征 今日将开放 Playtest", "星海远征"],
  ["国产手游 星海远征 即将于公布 Demo", "星海远征"],
  ["国产手游 星海远征 拟于开放 Playtest", "星海远征"],
  ["国产手游 星海远征 计划在发布实机", "星海远征"],
  ["国产手游 星海远征 宣布将在公布 Demo", "星海远征"],
  ["国产手游 星海远征 计划将在公布 Demo", "星海远征"],
  ["国产手游 星海远征 有望于开放 Playtest", "星海远征"],
  ["国产手游 星海远征 拟在发布实机", "星海远征"],
  ["国产手游 星海远征 宣布计划开放 Demo", "星海远征"],
  ["mobile game Project Echo announces Demo", "Project Echo"],
  ["mobile game Project Echo will announce Demo", "Project Echo"],
  ["mobile game Project Echo is set to reveal Demo", "Project Echo"],
  ["mobile game Project Echo plans on launching Demo", "Project Echo"],
  ["mobile game Project Echo is expected to reveal Demo", "Project Echo"],
  ["mobile game Project Echo is going to announce Demo", "Project Echo"],
  ["mobile game Project Echo will be launching Demo", "Project Echo"],
  ["mobile game Project Echo scheduled to launch Playtest", "Project Echo"],
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

function broadQaItem(title, slug, overrides = {}) {
  return {
    title,
    summary: "固定离线 QA fixture，只验证 broad-media game-product domain gate。",
    source: "IT之家",
    link: `https://example.test/${slug}`,
    source_quality: 7,
    source_focus: ["china", "technology"],
    candidate_domain_gate: "game_product",
    score: 52,
    ...overrides
  };
}

const lexicalBoundaryNegativeItems = [
  broadQaItem("Project Echo NPC game announces Demo", "category-boundary-npc-game"),
  broadQaItem("Project Echo automobile game announces Demo", "category-boundary-automobile-game"),
  broadQaItem("云端游戏公布 Demo", "category-boundary-cloud-end-game", { project_name: "星海远征" }),
  broadQaItem("终端游戏开放 Playtest", "category-boundary-terminal-end-game", { project_name: "星海远征" }),
  broadQaItem("高端游戏公开实机", "category-boundary-high-end-game", { project_name: "星海远征" })
];

const exactQaBlockingRows = [
  broadQaItem("国产手游 原创 公布 Demo", "qa-exact-generic-original"),
  broadQaItem("莉莉丝旗下 国产手游 公布 Demo", "qa-exact-company-affiliation"),
  broadQaItem("国产手游《游戏日报》报道 Demo", "qa-exact-source-only-quote"),
  broadQaItem("国产手游预计公布 Demo", "qa-exact-expected-connector"),
  broadQaItem(
    "国产手游《关于促进网络游戏高质量发展的若干意见》公布 Demo",
    "qa-exact-document-opinion"
  ),
  broadQaItem("Project Echo NPC game announces Demo", "qa-exact-lexical-boundary")
];

const roleGrammarQaBlockingRows = [
  broadQaItem("国产手游 上百款 公布 Demo", "qa-role-count-hundreds"),
  broadQaItem("国产手游 10余款 公布 Demo", "qa-role-count-ten-plus"),
  broadQaItem("国产手游 灵犀互娱 公布 Demo", "qa-role-company-lingxi-entertainment"),
  broadQaItem("国产手游 祖龙娱乐 公布 Demo", "qa-role-company-zulong-entertainment"),
  broadQaItem("国产手游《央视新闻》报道 Demo", "qa-role-media-cctv-news"),
  broadQaItem(
    "国产手游《关于游戏产业发展的指导意见》公布 Demo",
    "qa-role-document-guidance-opinion"
  )
];

const countGrammarQaBlockingRows = [
  broadQaItem("国产手游 若干款 公布 Demo", "qa-count-indefinite"),
  broadQaItem("国产手游 几十款 公布 Demo", "qa-count-tens"),
  broadQaItem("国产手游 十几款 公布 Demo", "qa-count-teen-approximation"),
  broadQaItem("国产手游 10款以上 公布 Demo", "qa-count-at-least-postfix"),
  broadQaItem("国产手游 百款左右 公布 Demo", "qa-count-around-postfix"),
  broadQaItem("国产手游 大约十款 公布 Demo", "qa-count-about-prefix"),
  broadQaItem("国产手游 不下10款 公布 Demo", "qa-count-not-less-than-prefix")
];

const expandedRoleQaBlockingRows = [
  broadQaItem("国产手游 若干款 公布 Demo", "qa-material-count-indefinite"),
  broadQaItem("国产手游 百款左右 公布 Demo", "qa-material-count-postfix"),
  broadQaItem("国产手游《保密协议》公布 Demo", "qa-material-short-document"),
  broadQaItem("国产手游《第一财经》报道 Demo", "qa-material-media-role"),
  broadQaItem("国产手游 莉莉丝科技股份 公布 Demo", "qa-material-company-role"),
  broadQaItem("国产手游生态公布 Demo", "qa-material-category-tail-role")
];

async function observeBroadMediaCandidatePaths(items) {
  let enrichmentCalls = 0;
  let secondPassCalls = 0;
  const leads = await buildMediaLeadCandidates(
    items,
    emptyIndex(),
    offlineContext({
      enrichMediaLeadsWithSteamContextImpl: async (candidates) => {
        enrichmentCalls += candidates.length;
        return candidates;
      }
    })
  );
  const artifact = buildSourcingCandidateArtifact({
    reportDate: "2026-08-11",
    capturedAt: "2026-08-11T12:00:00+08:00",
    ruleVersion: RULE_VERSION,
    mediaSignalsSeen: items.length,
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
  return {
    extractedProjects: items.map((item) => mediaRules.extractGameProductDomainProjectName(item)),
    evidence: items.map((item) => mediaRules.hasGameProductDomainEvidence(item)),
    dispositions: items.map((item) => mediaRules.classifyMediaDisposition(item)),
    leadProjects: leads.map((lead) => lead.project),
    enrichmentCalls,
    auditCandidates: artifact.scan_summary.media_candidates_seen,
    auditRecords: artifact.scan_summary.records_total,
    formalRecords: artifact.scan_summary.formal,
    secondPassEligible: secondPass.eligible_order,
    secondPassCalls
  };
}

function expectedZeroCandidatePaths(items) {
  return {
    extractedProjects: items.map(() => null),
    evidence: items.map(() => false),
    dispositions: items.map(() => ({ kind: "radar_only", reason: "non_game_broad_media" })),
    leadProjects: [],
    enrichmentCalls: 0,
    auditCandidates: 0,
    auditRecords: 0,
    formalRecords: 0,
    secondPassEligible: [],
    secondPassCalls: 0
  };
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
    assert.equal(
      rules.broad_media_candidate_domain_gate.structured_identity_constraints.url_trailing_delimiter_policy,
      "strip_prose_delimiters_before_strict_route_validation"
    );
    assert.deepEqual(
      rules.broad_media_candidate_domain_gate.project_name_constraints,
      {
        extraction_order: ["structured_string", "quoted", "explicit_unquoted"],
        normalization: "nfkc_casefold_strip_separators",
        explicit_category_matching: "shared_lexical_start_scanner_longest_first_vocabulary_no_bare_game",
        category_lexical_start_policy: "start_separator_or_complete_approved_prefix",
        english_category_boundary_policy: "unicode_letter_number_boundaries",
        explicit_category_vocabulary: [
          "模拟经营游戏", "客户端游戏", "移动端游戏", "二次元游戏", "独立游戏", "网络游戏",
          "电子游戏", "手机游戏", "主机游戏", "电脑游戏", "单机游戏", "国产游戏", "移动游戏",
          "小游戏", "网页游戏", "策略游戏", "卡牌游戏", "武侠游戏", "肉鸽游戏", "Steam游戏",
          "掌机游戏", "ARPG游戏", "PC游戏", "VR游戏", "手游", "端游",
          "mobile game", "pc game", "console game"
        ],
        category_prefix_modifier_policy: "consume_region_promotion_genre_platform_and_generic_count_modifiers",
        generic_count_policy: "repeatable_quantity_operator_sequence_plus_numeric_or_range_core_with_classifier_and_approximation",
        generic_quantity_operator_policy: "repeatable_curated_operator_token_sequence",
        generic_quantity_operator_tokens: genericQuantityOperatorTokens,
        generic_count_numeral_cores: ["arabic", "chinese_including_几", "若干"],
        generic_count_range_connectors: genericQuantityRangeConnectors,
        generic_count_pre_classifier_suffixes: ["余", "多", "来"],
        generic_count_post_classifier_suffixes: ["以上", "以下", "以内", "左右", "上下", "起", "余"],
        generic_count_magnitude_quantifiers: ["成百上千", "成千上万"],
        generic_count_classifiers: ["款", "个", "部", "项", "批"],
        generic_batch_quantifiers: ["一批", "一系列", "若干批"],
        generic_vague_quantity_tokens: genericVagueQuantityTokens,
        generic_vague_quantity_policy: "segment_quantifier_token_plus_game_product_or_project_noun",
        generic_descriptor_policy: "reject_when_entire_normalized_name_segments_into_generic_tokens",
        generic_token_categories: [
          "qualifier_quantifier",
          "organization_team",
          "game_product_project",
          "market_platform_industry",
          "news_update_message",
          "business_license_publishing",
          "english_equivalent"
        ],
        distinctive_residue_policy: "admit_when_non_generic_residue_remains",
        placeholder_policy: "reject_quantified_and_attribution_descriptors",
        generic_project_qualifiers: ["原创", "自研", "知名", "头部"],
        domestic_company_vocabulary_source: "shared_runtime_helper",
        domestic_company_vocabulary: domesticCompanyNames,
        organization_affiliation_tokens: organizationRoleTokens,
        organization_terminal_role_suffixes: organizationTerminalRoleSuffixes,
        organization_terminal_role_policy: "reject_known_company_prefix_with_explicit_terminal_organization_role",
        organization_only_policy: "reject_known_platform_publisher_or_organization_suffix_shape",
        media_source_entity_policy: "reject_known_source_or_bounded_media_role_suffix",
        media_source_role_suffixes: [
          "新闻", "日报", "时报", "周报", "晚报", "电视台", "广播", "通讯社", "媒体", "新闻网", "资讯",
          "财经", "证券报", "周末", "观察报"
        ],
        media_source_bare_report_policy: "reject_only_known_media_report_shape_not_arbitrary_name_suffix",
        attribution_role_policy: "reject_bounded_source_or_attribution_phrase_suffix",
        attribution_role_suffixes: ["消息", "报道", "显示", "称", "宣布", "透露", "指出", "表示"],
        generic_role_nouns: [
          "市场", "平台", "产业", "生态", "赛道", "板块", "领域", "品类",
          "market", "platform", "industry", "ecosystem", "sector", "category", "field", "segment"
        ],
        bilibili_alias_policy: "normalize_and_segment_as_insufficient_platform_terms",
        reporting_prefix_policy: "reject_prefix_at_separator_or_end",
        quoted_entity_policy: "structured_first_then_first_role_valid_project_quote_with_later_event",
        document_role_suffixes: [
          "办法", "条例", "规范", "白皮书", "报告", "备忘录", "协议", "通知", "指南", "政策", "规定",
          "细则", "标准", "方案", "公约", "声明", "通报", "意见", "倡议", "要点", "决定", "规划", "纲要"
        ],
        document_role_qualifiers: documentRoleQualifiers,
        document_role_policy: "reject_role_suffix_with_bounded_length_or_fully_segmentable_generic_qualifier",
        unquoted_slot_framing_policy: "strip_name_introducers_and_event_connectors_within_category_event_slot",
        glued_category_first_policy: "strip_new_work_introducer_only_within_category_event_slot",
        event_connector_policy: "strip_bounded_chinese_english_temporal_announcement_phrases",
        lead_project_binding: "shared_extractor"
      }
    );
    assert.deepEqual(mediaRules.DOMESTIC_GAME_COMPANY_NAMES, domesticCompanyNames);
    assert.equal(typeof mediaRules.isMediaSourceEntity, "function");
    assert.equal(mediaRules.isMediaSourceEntity("央视新闻"), true);
    assert.equal(mediaRules.isMediaSourceEntity("新闻大亨"), false);
    const mediaEntitiesSource = readFileSync(
      new URL("../jobs/online_daily_v4_media_entities.mjs", import.meta.url),
      "utf8"
    );
    assert.match(mediaEntitiesSource, /const domesticCompanySignal = hasDomesticGameCompanySignal\(text\);/);
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
        ...genericDescriptorItem("莉莉丝深空计划", "structured", "named-company-residue-cn"),
        title: "国产手游 莉莉丝深空计划 公布试玩 Demo",
        project_name: "莉莉丝深空计划"
      },
      {
        ...genericDescriptorItem("原创之海", "structured", "named-generic-qualifier-residue-cn"),
        title: "国产独立游戏 原创之海 开放测试",
        project_name: "原创之海"
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
      },
      {
        ...genericDescriptorItem("第七史诗", "structured", "named-count-prefix-residue-cn"),
        title: "国产手游 第七史诗 公布 Demo",
        project_name: "第七史诗"
      },
      {
        ...genericDescriptorItem("余烬10", "structured", "named-count-suffix-residue-cn"),
        title: "国产手游 余烬10 公布 Demo",
        project_name: "余烬10"
      },
      {
        ...genericDescriptorItem("灵犀互娱：星火", "structured", "named-company-role-residue-cn"),
        title: "国产手游 灵犀互娱：星火 公布 Demo",
        project_name: "灵犀互娱：星火"
      },
      {
        ...genericDescriptorItem("新闻大亨", "structured", "named-media-word-residue-cn"),
        title: "国产手游 新闻大亨 公布 Demo",
        project_name: "新闻大亨"
      },
      {
        ...genericDescriptorItem("财经大亨", "structured", "named-media-finance-residue-cn"),
        title: "国产手游 财经大亨 公布 Demo",
        project_name: "财经大亨"
      },
      {
        ...genericDescriptorItem("南方周末物语", "structured", "named-media-weekly-residue-cn"),
        title: "国产手游 南方周末物语 公布 Demo",
        project_name: "南方周末物语"
      },
      {
        ...genericDescriptorItem("规划师传奇", "structured", "named-document-word-residue-cn"),
        title: "国产手游 规划师传奇 公布 Demo",
        project_name: "规划师传奇"
      },
      {
        ...genericDescriptorItem("生态迷城", "structured", "named-ecosystem-role-residue-cn"),
        title: "国产手游 生态迷城 公布 Demo",
        project_name: "生态迷城"
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

  it("rejects bounded attribution prose before a category and across every name path", async () => {
    for (const item of attributionNoNameItems) {
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
      attributionNoNameItems,
      emptyIndex(),
      offlineContext({
        enrichMediaLeadsWithSteamContextImpl: async (candidates) => {
          enrichmentCalls += candidates.length;
          return candidates;
        }
      })
    );
    const artifact = buildSourcingCandidateArtifact({
      reportDate: "2026-08-11",
      capturedAt: "2026-08-11T12:00:00+08:00",
      ruleVersion: RULE_VERSION,
      mediaSignalsSeen: attributionNoNameItems.length,
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
    assert.equal(artifact.scan_summary.records_total, 0);
    assert.equal(artifact.scan_summary.formal, 0);
    assert.deepEqual(secondPass.eligible_order, []);
    assert.equal(secondPassCalls, 0);
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

  it("requires a lexical category start instead of matching category substrings", async () => {
    const evidence = lexicalBoundaryNegativeItems.map((item) =>
      mediaRules.hasGameProductDomainEvidence(item)
    );
    const dispositions = lexicalBoundaryNegativeItems.map((item) =>
      mediaRules.classifyMediaDisposition(item)
    );
    let enrichmentCalls = 0;
    let secondPassCalls = 0;
    const leads = await buildMediaLeadCandidates(
      lexicalBoundaryNegativeItems,
      emptyIndex(),
      offlineContext({
        enrichMediaLeadsWithSteamContextImpl: async (candidates) => {
          enrichmentCalls += candidates.length;
          return candidates;
        }
      })
    );
    const artifact = buildSourcingCandidateArtifact({
      reportDate: "2026-08-11",
      capturedAt: "2026-08-11T12:00:00+08:00",
      ruleVersion: RULE_VERSION,
      mediaSignalsSeen: lexicalBoundaryNegativeItems.length,
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

    assert.deepEqual({
      evidence,
      dispositions,
      leadProjects: leads.map((lead) => lead.project),
      enrichmentCalls,
      auditRecords: artifact.scan_summary.records_total,
      formalRecords: artifact.scan_summary.formal,
      secondPassEligible: secondPass.eligible_order,
      secondPassCalls
    }, {
      evidence: lexicalBoundaryNegativeItems.map(() => false),
      dispositions: lexicalBoundaryNegativeItems.map(() => ({
        kind: "radar_only",
        reason: "non_game_broad_media"
      })),
      leadProjects: [],
      enrichmentCalls: 0,
      auditRecords: 0,
      formalRecords: 0,
      secondPassEligible: [],
      secondPassCalls: 0
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
    const projectThenSourceQuote = {
      ...multiQuote,
      title: "《星海远征》国产手游《游戏日报》报道 Demo",
      summary: "项目实体在前，靠近事件的第二个书名号实体只是媒体来源。",
      link: "https://example.test/project-then-source-quote-binding"
    };
    const projectThenMediaRoleQuotes = [
      {
        ...multiQuote,
        title: "《星海远征》国产手游《央视新闻》报道 Demo",
        link: "https://example.test/project-then-cctv-news-quote"
      },
      {
        ...multiQuote,
        title: "《星海远征》国产手游《界面新闻》报道 Demo",
        link: "https://example.test/project-then-jiemian-news-quote"
      },
      {
        ...multiQuote,
        title: "《星海远征》国产手游《关于游戏产业发展的指导意见》公布 Demo",
        link: "https://example.test/project-then-policy-quote"
      },
      {
        ...multiQuote,
        title: "《星海远征》国产手游《雾港纪事》公布 Demo",
        link: "https://example.test/first-role-valid-project-quote"
      },
      ...[
        "保密协议", "投资协议", "战略协议", "第一财经", "中国证券报", "南方周末", "经济观察报"
      ].map((role, index) => ({
        ...multiQuote,
        title: `《星海远征》国产手游《${role}》公布 Demo`,
        link: `https://example.test/project-then-expanded-role-quote-${index + 1}`
      }))
    ];
    assert.equal(mediaRules.extractGameProductDomainProjectName(multiQuote), "星海远征");
    assert.equal(mediaRules.extractGameProductDomainProjectName(projectThenSourceQuote), "星海远征");
    for (const item of projectThenMediaRoleQuotes) {
      assert.equal(mediaRules.extractGameProductDomainProjectName(item), "星海远征", item.title);
    }
    const positiveLeads = await buildMediaLeadCandidates(
      [multiQuote, projectThenSourceQuote, ...projectThenMediaRoleQuotes],
      emptyIndex(),
      offlineContext({ enrichMediaLeadsWithSteamContextImpl: async (candidates) => candidates })
    );
    assert.equal(
      positiveLeads.length,
      2 + projectThenMediaRoleQuotes.length
    );
    assert.deepEqual(new Set(positiveLeads.map((lead) => lead.project)), new Set(["星海远征"]));

    const documentDescriptors = [
      "网络游戏管理办法",
      "未成年人保护条例",
      "手游测试规范",
      "合作备忘录",
      "2026中国游戏产业白皮书",
      "关于促进网络游戏高质量发展的若干意见",
      "游戏产业自律倡议",
      "国产游戏发展要点",
      "网络游戏管理决定",
      "游戏产业发展规划",
      "网络游戏治理纲要",
      "保密协议",
      "补充协议",
      "框架协议",
      "联合声明",
      "整改通知",
      "用户公约",
      ...shortDocumentRoleDescriptors
    ];
    const documentItems = documentDescriptors.flatMap((descriptor, index) => [
      {
        ...multiQuote,
        title: `国产手游《${descriptor}》公布 Demo`,
        link: `https://example.test/quoted-document-${index + 1}`
      },
      {
        ...multiQuote,
        title: "国产手游公布 Demo",
        project_name: descriptor,
        link: `https://example.test/structured-document-${index + 1}`
      }
    ]);
    documentItems.push({
      ...multiQuote,
      title: "国产手游《游戏日报》公布 Demo",
      link: "https://example.test/quoted-source-only"
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

  it("keeps the six exact QA reproductions out of every candidate path", async () => {
    const extractedProjects = exactQaBlockingRows.map((item) =>
      mediaRules.extractGameProductDomainProjectName(item)
    );
    const evidence = exactQaBlockingRows.map((item) =>
      mediaRules.hasGameProductDomainEvidence(item)
    );
    const dispositions = exactQaBlockingRows.map((item) =>
      mediaRules.classifyMediaDisposition(item)
    );
    let enrichmentCalls = 0;
    let secondPassCalls = 0;
    const leads = await buildMediaLeadCandidates(
      exactQaBlockingRows,
      emptyIndex(),
      offlineContext({
        enrichMediaLeadsWithSteamContextImpl: async (candidates) => {
          enrichmentCalls += candidates.length;
          return candidates;
        }
      })
    );
    const artifact = buildSourcingCandidateArtifact({
      reportDate: "2026-08-11",
      capturedAt: "2026-08-11T12:00:00+08:00",
      ruleVersion: RULE_VERSION,
      mediaSignalsSeen: exactQaBlockingRows.length,
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

    assert.deepEqual({
      extractedProjects,
      evidence,
      dispositions,
      leadProjects: leads.map((lead) => lead.project),
      enrichmentCalls,
      auditCandidates: artifact.scan_summary.media_candidates_seen,
      auditRecords: artifact.scan_summary.records_total,
      formalRecords: artifact.scan_summary.formal,
      secondPassEligible: secondPass.eligible_order,
      secondPassCalls
    }, {
      extractedProjects: exactQaBlockingRows.map(() => null),
      evidence: exactQaBlockingRows.map(() => false),
      dispositions: exactQaBlockingRows.map(() => ({
        kind: "radar_only",
        reason: "non_game_broad_media"
      })),
      leadProjects: [],
      enrichmentCalls: 0,
      auditCandidates: 0,
      auditRecords: 0,
      formalRecords: 0,
      secondPassEligible: [],
      secondPassCalls: 0
    });
  });

  it("keeps count, company-role, media-source, and document-role QA rows out of every candidate path", async () => {
    const extractedProjects = roleGrammarQaBlockingRows.map((item) =>
      mediaRules.extractGameProductDomainProjectName(item)
    );
    const evidence = roleGrammarQaBlockingRows.map((item) =>
      mediaRules.hasGameProductDomainEvidence(item)
    );
    const dispositions = roleGrammarQaBlockingRows.map((item) =>
      mediaRules.classifyMediaDisposition(item)
    );
    let enrichmentCalls = 0;
    let secondPassCalls = 0;
    const leads = await buildMediaLeadCandidates(
      roleGrammarQaBlockingRows,
      emptyIndex(),
      offlineContext({
        enrichMediaLeadsWithSteamContextImpl: async (candidates) => {
          enrichmentCalls += candidates.length;
          return candidates;
        }
      })
    );
    const artifact = buildSourcingCandidateArtifact({
      reportDate: "2026-08-11",
      capturedAt: "2026-08-11T12:00:00+08:00",
      ruleVersion: RULE_VERSION,
      mediaSignalsSeen: roleGrammarQaBlockingRows.length,
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

    assert.deepEqual({
      extractedProjects,
      evidence,
      dispositions,
      leadProjects: leads.map((lead) => lead.project),
      enrichmentCalls,
      auditCandidates: artifact.scan_summary.media_candidates_seen,
      auditRecords: artifact.scan_summary.records_total,
      formalRecords: artifact.scan_summary.formal,
      secondPassEligible: secondPass.eligible_order,
      secondPassCalls
    }, {
      extractedProjects: roleGrammarQaBlockingRows.map(() => null),
      evidence: roleGrammarQaBlockingRows.map(() => false),
      dispositions: roleGrammarQaBlockingRows.map(() => ({
        kind: "radar_only",
        reason: "non_game_broad_media"
      })),
      leadProjects: [],
      enrichmentCalls: 0,
      auditCandidates: 0,
      auditRecords: 0,
      formalRecords: 0,
      secondPassEligible: [],
      secondPassCalls: 0
    });
  });

  it("closes short document and known-company terminal roles across every candidate path", async () => {
    assert.deepEqual(
      await observeBroadMediaCandidatePaths(roleClosureNegativeItems),
      expectedZeroCandidatePaths(roleClosureNegativeItems)
    );
  });

  it("retains distinctive document and company product names across every name path", async () => {
    const expectedProjects = roleClosurePositiveItems.map((item) => item.expectedProject);
    for (const item of roleClosurePositiveItems) {
      assert.equal(
        mediaRules.extractGameProductDomainProjectName(item),
        item.expectedProject,
        item.link
      );
      assert.equal(mediaRules.hasGameProductDomainEvidence(item), true, item.link);
      assert.deepEqual(mediaRules.classifyMediaDisposition(item), {
        kind: "lead_candidate",
        reason: null
      }, item.link);
    }

    let enrichmentCalls = 0;
    const leads = await buildMediaLeadCandidates(
      roleClosurePositiveItems,
      emptyIndex(),
      offlineContext({
        enrichMediaLeadsWithSteamContextImpl: async (candidates) => {
          enrichmentCalls += candidates.length;
          return candidates;
        }
      })
    );
    assert.equal(leads.length, roleClosurePositiveItems.length);
    assert.equal(enrichmentCalls, roleClosurePositiveItems.length);
    assert.deepEqual(
      leads.map((lead) => lead.project),
      expectedProjects
    );
  });

  it("consumes the complete generic count phrase before every candidate path", async () => {
    assert.deepEqual(
      await observeBroadMediaCandidatePaths(countGrammarQaBlockingRows),
      expectedZeroCandidatePaths(countGrammarQaBlockingRows)
    );
  });

  it("closes repeatable quantity operators, ranges, and vague quantifiers across every candidate path", async () => {
    assert.deepEqual(
      await observeBroadMediaCandidatePaths(quantityGrammarNegativeItems),
      expectedZeroCandidatePaths(quantityGrammarNegativeItems)
    );
  });

  it("retains numeric project titles across every name path", async () => {
    for (const item of quantityGrammarPositiveItems) {
      assert.equal(
        mediaRules.extractGameProductDomainProjectName(item),
        item.expectedProject,
        item.link
      );
      assert.equal(mediaRules.hasGameProductDomainEvidence(item), true, item.link);
      assert.deepEqual(mediaRules.classifyMediaDisposition(item), {
        kind: "lead_candidate",
        reason: null
      }, item.link);
    }

    let enrichmentCalls = 0;
    const leads = await buildMediaLeadCandidates(
      quantityGrammarPositiveItems,
      emptyIndex(),
      offlineContext({
        enrichMediaLeadsWithSteamContextImpl: async (candidates) => {
          enrichmentCalls += candidates.length;
          return candidates;
        }
      })
    );
    assert.equal(leads.length, quantityGrammarPositiveItems.length);
    assert.equal(enrichmentCalls, quantityGrammarPositiveItems.length);
    assert.deepEqual(
      leads.map((lead) => lead.project),
      quantityGrammarPositiveItems.map((item) => item.expectedProject)
    );
  });

  it("keeps the expanded six-row role materiality fixture out of every candidate path", async () => {
    assert.deepEqual(
      await observeBroadMediaCandidatePaths(expandedRoleQaBlockingRows),
      expectedZeroCandidatePaths(expandedRoleQaBlockingRows)
    );
  });

  it("keeps the material connector row eligible while binding only the concrete project", async () => {
    const item = broadQaItem(
      "国产手游 星海远征 计划将在公布 Demo",
      "qa-material-positive-connector"
    );
    const observed = await observeBroadMediaCandidatePaths([item]);
    assert.deepEqual(observed, {
      extractedProjects: ["星海远征"],
      evidence: [true],
      dispositions: [{ kind: "lead_candidate", reason: null }],
      leadProjects: ["星海远征"],
      enrichmentCalls: 1,
      auditCandidates: 1,
      auditRecords: 1,
      formalRecords: 0,
      secondPassEligible: [],
      secondPassCalls: 0
    });
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
