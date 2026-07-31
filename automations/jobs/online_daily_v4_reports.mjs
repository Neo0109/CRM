import { buildBilibiliFit, hardDropReason } from "./online_daily_v4_decision.mjs";
import { classifyMediaDisposition } from "./online_daily_v4_media_rules.mjs";
import {
  categoryForMediaSignal,
  isBilibiliSignal,
  isMetaBilibiliTrend,
  mediaTopicFamily,
  normalizeDisplayText,
  normalizeText
} from "./online_daily_v4_dedupe.mjs";
import { V73_OBTAINABLE_EVIDENCE_RULE_VERSION } from "./online_daily_v7_3_obtainable_evidence.mjs";

export function buildDailyReport({
  pools,
  rawCount,
  enrichedCount,
  mediaLeadCount,
  reportDate,
  ruleVersion,
  diagnostics
}) {
  const probe = diagnostics.bilibili_probe ?? {};
  const indieCount = pools.push.filter((lead) => lead.sourcing_lane === "indie_prelaunch").length;
  const chinaJointCount = pools.push.filter((lead) => lead.sourcing_lane === "china_joint").length;
  const v73Active = ruleVersion === V73_OBTAINABLE_EVIDENCE_RULE_VERSION;
  const ruleLabel = v73Active ? "V7.3" : "V7.2";
  return {
    report_date: reportDate,
    summary: `Sourcing ${ruleLabel} 严格准入：扫描 Steam 候选 ${rawCount} 条、富化 ${enrichedCount} 条，另从媒体/B站提取产品线索 ${mediaLeadCount} 条；B站探头候选 ${probe.raw_candidates ?? 0} 条、最终 ${probe.final_candidates ?? 0} 条、官方源命中 ${diagnostics.bilibili_official_source_hits} 条；完整通过 indie_prelaunch ${indieCount} 条、china_joint ${chinaJointCount} 条，合计进入 push_pool ${pools.push.length} 条，其余只保留在候选审计。`,
    insights: v73Active ? [
      "V7.3面向B站商务负责人执行可获得证据版 indie_prelaunch，并保留独立 china_joint 通道；只有完整通过其中一条不可绕过准入链的项目才发布为正式Lead。",
      "每个可review项目必须说明玩法循环、公开数据、优势、短板、B站内容/社区赋能方式和下一步测试/BD动作。",
      "国内媒体和B站捕捉到的具体产品继续参与扫描与证据校验；缺少任一强制证据时只进入候选审计。",
      "行业雷达必须来自真实媒体、厂商、法院/公司公告或可核验社区信号，不能用内部规则说明冒充行业新闻。",
      "Steam趋势必须输出大盘观察：近期冒头品类、活动/窗口、发行商新品、数据样本和BD含义，不能把日报规则贴到趋势页。",
      "官方 Demo/Playtest 与官方实机属于同一可获得证据族，任一成立只满足该证据门，不能覆盖合作窗口、独立质量、商务入口或B站价值门。",
      "B站视频线索通过探头配置优先扫描官方号/开发者号/发行商号，补读简介，提取Steam/官网/联系方式，交叉验证是否已发售，并和历史CRM记录去重。",
      "B站/媒体字段必须保持决策台可读：Steam链接写入links，玩法写标签，进度写短状态，下一步动作和备注默认留给人工。",
      "indie_prelaunch 海外项目不再把显式中国合作表述设为强制门；仍须独立公开质量证据、非Steam商务入口和具体中国/B站价值。",
      "已发售或EA项目不能进入 indie_prelaunch；只有数据门、中国需求和成熟中国伙伴占位门全部通过时才可进入 china_joint。",
      "有效lead必须回答三件事：窗口是否还在、权益空间是否还在、B站是否能把中国区盘子做大。",
      "自动日报只把完整合格项目写入未处理 push_pool，priority 保持为空；不自动写入观察池/待评测/跟进池/推进池。",
      "正式Lead为0既不失败也不标记degraded；来源扫描异常、结构损坏、资格与push数量不一致、写入失败或同步失败仍然阻断。"
    ] : [
      "V7.2面向B站商务负责人并行执行 indie_prelaunch 与 china_joint；只有完整通过其中一条不可绕过准入链的项目才发布为正式Lead。",
      "每个可review项目必须说明玩法循环、公开数据、优势、短板、B站内容/社区赋能方式和下一步测试/BD动作。",
      "国内媒体和B站捕捉到的具体产品继续参与扫描与证据校验；缺少任一强制证据时只进入候选审计。",
      "行业雷达必须来自真实媒体、厂商、法院/公司公告或可核验社区信号，不能用内部规则说明冒充行业新闻。",
      "Steam趋势必须输出大盘观察：近期冒头品类、活动/窗口、发行商新品、数据样本和BD含义，不能把日报规则贴到趋势页。",
      "Demo/试玩只能证明 indie_prelaunch 可测试，不能覆盖该通道的合作窗口；china_joint 另行执行数据门、中国需求和伙伴占位门。",
      "B站视频线索通过探头配置优先扫描官方号/开发者号/发行商号，补读简介，提取Steam/官网/联系方式，交叉验证是否已发售，并和历史CRM记录去重。",
      "B站/媒体字段必须保持决策台可读：Steam链接写入links，玩法写标签，进度写短状态，下一步动作和备注默认留给人工。",
      "indie_prelaunch 海外项目仍需明确中国需求；china_joint 则必须满足锁定数据路径，并确认当前中国合作需求。",
      "已发售或EA项目不能进入 indie_prelaunch；只有数据门、中国需求和成熟中国伙伴占位门全部通过时才可进入 china_joint。",
      "有效lead必须回答三件事：窗口是否还在、权益空间是否还在、B站是否能把中国区盘子做大。",
      "自动日报只把完整合格项目写入未处理 push_pool，priority 保持为空；不自动写入观察池/待评测/跟进池/推进池。",
      "正式Lead为0既不失败也不标记degraded；来源扫描异常、结构损坏、资格与push数量不一致、写入失败或同步失败仍然阻断。"
    ],
    push_pool: pools.push,
    watch_pool: pools.watch,
    drop_pool: pools.drop
  };
}

export function buildRadarReport({ candidates, pools, industrySignals, reportDate, capturedAt, mediaSignalToRadarItem: toRadarItem = mediaSignalToRadarItem }) {
  const genres = summarizeGenres(candidates);
  const mediaItems = industrySignals.slice(0, 14).map((item, index) => toRadarItem(item, index, { reportDate, capturedAt }));
  if (!candidates.length) {
    return {
      report_date: reportDate,
      summary: `Sourcing V7.2 行业雷达：今日选入 ${industrySignals.length} 条中外媒体/社区信号。Steam 抓取未返回候选，雷达不再用内部扫描状态凑数。`,
      items: mediaItems
    };
  }

  const bilibiliSignal = radarItem(
    { reportDate, capturedAt },
    "bilibili_bd_lens",
    "B站趋势",
    `今日Steam候选中值得人工复核的方向：${genres.slice(0, 4).join("、") || "待观察"}`,
    `样本高频不等于推荐。扫描候选只有完整通过V7.2任一业务通道准入门才发布为正式Lead。`,
    "中",
    "CRM Online Scan",
    "https://store.steampowered.com/search/?filter=popularcomingsoon",
    "这是给BD选品的背景信号，不是新闻，也不直接进入推进池。",
    `本卡片只提供行业方向观察；未完整通过准入门的项目只保留在候选审计。`
  );
  return {
    report_date: reportDate,
    summary: `Sourcing V7.2 行业雷达：今日选入 ${industrySignals.length} 条中外媒体/社区信号，另扫描 Steam 候选 ${candidates.length} 个。行业新闻只放宏观大事件；具体游戏、IP、公司/法律八卦和好玩线索统一进入今日亮点。`,
    items: [...mediaItems, bilibiliSignal]
  };
}

export function buildSteamTrendReport({ candidates, pools, reportDate, capturedAt }) {
  const context = { reportDate, capturedAt };
  if (!candidates.length && (pools.push.length || pools.watch.length)) {
    return buildSteamUnavailableFallbackTrendReport(pools, context);
  }

  const marketInsights = buildSteamMarketInsights(candidates, pools, context);
  const genreSignals = ensureMinimumSteamGenreSignals(buildSteamGenreSignals(candidates, context), context);
  const focusGenres = genreSignals.slice(0, 3).map((signal) => signal.genre.replace(/（.+$/, ""));
  const steamSamples = selectSteamTrendSamples(candidates);
  const steamItems = steamSamples.map((candidate) => ({
    id: `steam_trend_${reportDate.replaceAll("-", "_")}_${candidate.appId}`,
    title: candidate.title,
    steam_app_id: candidate.appId,
    rank_bucket: candidate.source,
    signal: buildV5SteamSignal(candidate, context),
    source: "Steam Store / AppDetails",
    links: [candidate.storeUrl, candidate.steamDbUrl],
    bilibili_fit: buildBilibiliFit(candidate),
    reason: buildV5TrendReason(candidate),
    auto_import: pools.push.some((lead) => String(lead.steam_app_id ?? "") === String(candidate.appId ?? "")),
    captured_at: capturedAt
  }));
  const mediaFallbackItems = steamItems.length >= 8
    ? []
    : buildFallbackSteamTrendItems([...pools.push, ...pools.watch], steamItems.length, 12 - steamItems.length, context);
  const diagnosticFallbackItems = buildSteamDiagnosticTrendItems({
    existingCount: steamItems.length + mediaFallbackItems.length,
    marketInsights,
    genreSignals,
    candidates
  }, context);
  return {
    report_date: reportDate,
    summary: `Steam大盘V7.2严格准入：扫描 ${candidates.length} 个候选，输出 ${marketInsights.length} 条大盘观察和 ${genreSignals.length} 个品类信号。今日重点看 ${focusGenres.join("、") || "Demo/新品窗口"}；只有完整通过任一业务通道准入门的项目进入正式Lead池。`,
    market_insights: marketInsights,
    genre_signals: genreSignals,
    items: [...steamItems, ...mediaFallbackItems, ...diagnosticFallbackItems].slice(0, 12),
    crm_candidates: [...pools.push, ...pools.watch.slice(0, 8)]
  };
}

function buildSteamUnavailableFallbackTrendReport(pools, context) {
  const reviewLeads = [...pools.push, ...pools.watch];
  const genreSignals = ensureMinimumSteamGenreSignals(buildFallbackGenreSignals(reviewLeads, context), context);
  const marketInsights = [
    steamInsight(
      context,
      "steam_fetch_unavailable",
      "Steam 抓取不可用：不能让日报断档",
      "本次 Steam Search/AppDetails 没有返回有效候选。日报应透明标记源异常，并用国内媒体/B站候选保持 BD review 队列。",
      "高",
      "Steam Store fetch status",
      "https://store.steampowered.com/search/?filter=popularcomingsoon",
      "稍后补跑 Steam；当前先 review 国内媒体/B站候选，能测就测，不成立就淘汰。"
    ),
    steamInsight(
      context,
      "domestic_media_backup",
      `国内媒体/B站保底：${reviewLeads.length} 个可 review 候选`,
      "这些候选来自媒体/B站原始链接，不要求先有 Steam AppID。它们的价值是扩大国内产品发现，先判断玩法、题材、视频表达和可测性。",
      "中",
      "Domestic media / Bilibili discovery",
      "https://search.bilibili.com/all?keyword=%E5%9B%BD%E4%BA%A7%E6%B8%B8%E6%88%8F%20%E8%AF%95%E7%8E%A9%20Demo",
      "先打开原始链接做产品判断；通过首测后再补 Steam、官网、联系人和商务窗口。"
    ),
    steamInsight(
      context,
      "source_resilience",
      "源韧性：Steam 不是单点故障",
      "当 Steam 暂时不可用时，日报仍应从国内游戏媒体、B站视频、TapTap/indienova、官方开发者动态里产出可操作线索。",
      "中",
      "Domestic discovery source mix",
      "https://www.gamelook.com.cn/",
      "后续持续扩展国内源；正式Lead数量不作为交付健康门，来源与结构完整性继续阻断。"
    )
  ];
  const fallbackItems = buildFallbackSteamTrendItems(reviewLeads, 0, 12, context);
  const diagnosticItems = buildSteamDiagnosticTrendItems({
    existingCount: fallbackItems.length,
    marketInsights,
    genreSignals,
    candidates: []
  }, context);

  return {
    report_date: context.reportDate,
    summary: `Steam大盘V7.2严格准入：本次 Steam 抓取未返回有效候选，使用 ${reviewLeads.length} 个已通过准入的媒体/B站项目做保底观察，避免日报因单一源失败而断档。`,
    market_insights: marketInsights,
    genre_signals: genreSignals,
    items: [...fallbackItems, ...diagnosticItems].slice(0, 12),
    crm_candidates: reviewLeads.slice(0, 12)
  };
}

function buildFallbackSteamTrendItems(reviewLeads, offset, limit, context) {
  return reviewLeads.slice(0, limit).map((lead, index) => ({
    id: `steam_trend_${context.reportDate.replaceAll("-", "_")}_fallback_${offset + index + 1}`,
    title: lead.project,
    steam_app_id: lead.steam_app_id ?? null,
    rank_bucket: "Domestic media/Bilibili fallback",
    signal: [
      "Steam Store 本次抓取没有返回有效候选，日报使用国内媒体/B站产品线索保持发现不中断。",
      `原始信号：${lead.public_signals ?? lead.progress ?? "媒体/B站线索"}`,
      `产品观察：${lead.gameplay ?? lead.priority_reason ?? "待打开原始链接确认玩法和内容钩子"}`
    ].join("\n"),
    source: lead.public_signals?.split(" / ")[0] ?? "Domestic media/Bilibili",
    links: lead.links ?? [],
    bilibili_fit: lead.bilibili_fit ?? "先看视频/原文能否提炼成B站选题、试玩或发行前内容资产。",
    reason: lead.priority_reason ?? "Steam 不可用时的国内发现保底候选；先做人工首轮 review。",
    auto_import: true,
    captured_at: context.capturedAt
  }));
}

function buildSteamDiagnosticTrendItems({ existingCount, marketInsights, genreSignals, candidates }, context) {
  const needed = Math.max(0, 8 - existingCount);
  if (!needed) return [];
  const sourceCards = [
    ...marketInsights.map((insight) => ({
      title: insight.title,
      signal: insight.summary,
      source: insight.source,
      links: [insight.link].filter(Boolean),
      bilibili_fit: insight.suggested_action,
      reason: "Steam 大盘观察补位卡片；用于保留趋势诊断，不作为 CRM lead 自动入库。"
    })),
    ...genreSignals.map((signal) => ({
      title: signal.genre,
      signal: `${signal.signal}\n${signal.why_it_matters}`,
      source: "Steam tag / genre signal",
      links: signal.links ?? [],
      bilibili_fit: signal.bd_action,
      reason: "Steam 品类信号补位卡片；用于提醒 BD 看品类变化，不作为 CRM lead 自动入库。"
    })),
    {
      title: "Steam 样本质量诊断",
      signal: `本次 Steam 候选 ${candidates.length} 个；继续记录去重、已上线和证据缺口诊断，但不按正式Lead数量判定失败。`,
      source: "CRM automation diagnostics",
      links: ["https://steamdb.info/charts/"],
      bilibili_fit: "用诊断判断是否需要扩展国内媒体/B站官方源，不直接占用人工 lead 队列。",
      reason: "自动化稳定护栏：趋势低量时补充诊断，不制造伪 lead。"
    },
    {
      title: "国内来源池补强",
      signal: "当 Steam 或单个媒体源异常时，日报应继续使用 B站官方号、开发者动态、TapTap、indienova 和国内媒体补齐高质量候选。",
      source: "CRM automation diagnostics",
      links: ["https://www.taptap.cn/", "https://indienova.com/"],
      bilibili_fit: "优先找官方号和开发者号，避免推荐 UP 的旧视频或泛娱乐内容污染 lead。",
      reason: "自动化稳定护栏：来源池低量时给出下一步诊断，不制造伪 lead。"
    },
    {
      title: "去重与发售状态交叉验证",
      signal: "B站/媒体线索应抽取 Steam AppID、来源链接和项目名去重；正式上线或历史已录入的项目不再进入新的未处理队列。",
      source: "CRM automation diagnostics",
      links: ["https://store.steampowered.com/search/"],
      bilibili_fit: "把低量原因拆成已上线、重复、过期和来源失败，方便判断是规则过严还是来源池不足。",
      reason: "自动化稳定护栏：保留判断过程，避免为了数量降低 sourcing 质量。"
    },
    {
      title: "BD 可执行样本优先",
      signal: "日报正式Lead只来自完整通过V7.2任一业务通道准入门的项目；其余扫描结果保留在候选审计，日报、Radar与Steam Trends继续生成。",
      source: "CRM automation diagnostics",
      links: ["https://github.com/Neo0109/CRM/actions"],
      bilibili_fit: "不要让诊断卡片进入 CRM lead；它只解释自动化状态，帮助决定是否补跑或扩源。",
      reason: "自动化稳定护栏：来源、结构、写入和同步失败仍阻断，Lead数量不参与隔离期健康判断。"
    }
  ];

  return sourceCards.slice(0, needed).map((item, index) => ({
    id: `steam_trend_${context.reportDate.replaceAll("-", "_")}_diagnostic_${index + 1}`,
    title: item.title,
    steam_app_id: null,
    rank_bucket: "Steam diagnostics fallback",
    signal: item.signal,
    source: item.source,
    links: item.links,
    bilibili_fit: item.bilibili_fit,
    reason: item.reason,
    auto_import: false,
    captured_at: context.capturedAt
  }));
}

function buildFallbackGenreSignals(leads, context) {
  const clusters = [
    ["Roguelike / Deckbuilder", /rogue|肉鸽|卡牌|构筑|deck|card/i, "构筑和单局反馈适合B站挑战、攻略和流派复盘。", "优先确认是否有可测Demo和差异化构筑。"],
    ["Strategy / Tactical", /策略|战棋|回合|strategy|tactical|三国|战争/i, "策略题材适合长线讲解和核心用户沉淀。", "看前10分钟是否能讲清核心决策和视频看点。"],
    ["Simulation / Management", /模拟|经营|管理|建造|simulation|management|tycoon/i, "经营模拟适合系列化视频和长期连载。", "看成长曲线、失败反馈和题材新鲜度。"],
    ["Action / Visual Hook", /动作|射击|战斗|boss|平台|action|shooter|combat/i, "强操作或强视觉更容易通过PV/实机建立第一印象。", "看打击反馈、角色辨识度和可剪素材。"],
    ["Domestic Discovery", /国产|国风|武侠|修仙|山海|中国|国内|b站|bilibili|taptap|indienova/i, "国内信号代表沟通效率、文化适配和签约概率更高。", "先测/先看内容，通过后再补商务触点。"]
  ];
  const signals = clusters.map(([genre, pattern, why, action]) => {
    const matched = leads.filter((lead) => pattern.test(`${lead.project} ${lead.genre} ${lead.gameplay} ${lead.priority_reason} ${lead.public_signals}`));
    return {
      id: `steam_genre_${context.reportDate.replaceAll("-", "_")}_fallback_${normalizeText(genre).replace(/[^a-z0-9]+/g, "_")}`,
      genre: `${genre}（${matched.length}/${leads.length}）`,
      signal: `${matched.length} 个国内媒体/B站候选命中；代表样本：${matched.slice(0, 3).map((lead) => lead.project).join("、") || "待打开原始链接确认"}。`,
      why_it_matters: why,
      bd_action: action,
      links: matched.flatMap((lead) => lead.links ?? []).slice(0, 3)
    };
  }).filter((signal) => !/^.+（0\//.test(signal.genre));

  while (signals.length < 3 && leads[signals.length]) {
    const lead = leads[signals.length];
    signals.push({
      id: `steam_genre_${context.reportDate.replaceAll("-", "_")}_fallback_product_${signals.length + 1}`,
      genre: `国内产品线索（${signals.length + 1}/${leads.length}）`,
      signal: `代表样本：${lead.project}。`,
      why_it_matters: "Steam 不可用时，用国内媒体/B站具体产品保持 BD review 节奏。",
      bd_action: "先打开原始链接判断玩法和视频表达；不成立直接淘汰。",
      links: lead.links ?? []
    });
  }

  return ensureMinimumSteamGenreSignals(signals, context).slice(0, 5);
}

function ensureMinimumSteamGenreSignals(signals, context) {
  const fallbackSignals = [
    {
      id: `steam_genre_${context.reportDate.replaceAll("-", "_")}_diagnostic_source_mix`,
      genre: "Source Mix / 国内来源池",
      signal: "Steam 趋势样本偏低时，必须同时检查 B站官方号、国内媒体、TapTap、indienova 和开发者动态。",
      why_it_matters: "Sourcing 的目标不是凑数量，而是保证 BD 能看到可判断的产品信号和来源缺口。",
      bd_action: "优先补官方源和可验证链接；推荐 UP 视频只作为辅助，不直接替代官方来源。",
      links: ["https://www.taptap.cn/", "https://indienova.com/"]
    },
    {
      id: `steam_genre_${context.reportDate.replaceAll("-", "_")}_diagnostic_cross_check`,
      genre: "Verification / 交叉验证",
      signal: "B站/媒体线索需要抽取 Steam AppID 或官方链接，并检查是否已上线、过期或历史已录入。",
      why_it_matters: "这能减少旧视频、已上线项目和重复项目进入未处理队列，保持人工 review 效率。",
      bd_action: "先验证发售状态和历史去重，再决定是否进入未处理 inbox。",
      links: ["https://store.steampowered.com/search/"]
    },
    {
      id: `steam_genre_${context.reportDate.replaceAll("-", "_")}_diagnostic_steam_window`,
      genre: "Steam Window / Demo与活动窗口",
      signal: "即将发售、Demo、EA 和官方活动窗口仍是 Steam 大盘里最可执行的 BD 信号。",
      why_it_matters: "这些状态更接近测试、内容预判和商务触达，而不是泛泛的品类热度。",
      bd_action: "国内开发者 Demo 优先；海外项目必须同时看 PC 数据验证和手游化可能。",
      links: ["https://store.steampowered.com/sale/nextfest", "https://steamdb.info/charts/"]
    }
  ];
  const existingIds = new Set(signals.map((signal) => signal.id));
  for (const signal of fallbackSignals) {
    if (signals.length >= 3) break;
    if (!existingIds.has(signal.id)) signals.push(signal);
  }
  return signals;
}

export function mediaSignalToRadarItem(item, index, context) {
  const title = normalizeDisplayText(item.title);
  const id = `media_${index}_${normalizeText(title).replace(/[^a-z0-9]+/g, "_").slice(0, 36)}`;
  if (classifyMediaDisposition(item).reason === "non_game_animation_series") {
    const cleaned = normalizeDisplayText([item.summary, item.title].filter(Boolean).join(" "));
    return radarItem(
      context,
      id,
      "B站趋势",
      title,
      `非游戏动画/IP观察：${cleaned.slice(0, 90)}。这是动画内容节点，不作为游戏产品线索。`,
      item.score >= 25 ? "高" : "中",
      item.source,
      item.link,
      "非游戏动画/IP观察只用于关注内容热度和IP节点，不进入游戏Lead。",
      "观察播出节奏、角色/IP热度与B站讨论；只有后续出现独立游戏商店页等可验证游戏证据时再评估。"
    );
  }

  return radarItem(
    context,
    id,
    categoryForMediaSignal(item),
    title,
    conciseMediaSummary(item),
    item.score >= 25 ? "高" : "中",
    item.source,
    item.link,
    relevanceForMediaSignal(item),
    actionForMediaSignal(item)
  );
}

function conciseMediaSummary(item) {
  const text = [item.summary, item.title].filter(Boolean).join(" ");
  const cleaned = normalizeDisplayText(text);
  const family = mediaTopicFamily(item);
  if (isBilibiliSignal(item) && !isMetaBilibiliTrend(item)) return `今日亮点：${cleaned.slice(0, 90)}。先看画面、玩法、评论和UP主表达，判断能否变成选题、试玩或潜在线索。`;
  if (isMetaBilibiliTrend(item)) return `B站趋势：${cleaned.slice(0, 90)}。重点看内容风向、UP主扩散和社区情绪变化。`;
  if (family === "product_ip") return `今日亮点：${cleaned.slice(0, 90)}。重点看它是否能变成B站选题、试玩推荐、IP节点或潜在线索。`;
  if (family === "business_legal") return `今日亮点：${cleaned.slice(0, 90)}。把公司/IP/法律/资本八卦当成BD尽调和窗口判断线索。`;
  if (family === "platform_market") return `行业新闻：${cleaned.slice(0, 90)}。重点看平台、渠道、政策或市场节奏是否改变发行打法。`;
  if (family === "creator_community") return `社区/创作者信号：${cleaned.slice(0, 80)}。重点看B站内容打法、达人合作和话题扩散。`;
  if (family === "ai_production") return `AI/工具链信号：${cleaned.slice(0, 80)}。重点看研发效率、素材风险、内容供给质量和平台合规。`;
  return cleaned.slice(0, 120);
}

function relevanceForMediaSignal(item) {
  const family = mediaTopicFamily(item);
  if (isBilibiliSignal(item) && !isMetaBilibiliTrend(item)) return "今日亮点用于把具体视频、试玩、PV和产品讨论转成B站商务可判断的线索。";
  if (isMetaBilibiliTrend(item)) return "B站趋势用于判断内容生态、UP主扩散和玩家话题是否正在改变。";
  if (family === "product_ip") return "今日亮点用于发现具体游戏、IP节点、好玩内容或可转化成B站选题的线索。";
  if (family === "business_legal") return "今日亮点中的八卦/公司事件用于辅助BD判断合作方可信度、权属风险和窗口变化。";
  if (family === "platform_market") return "行业新闻用于判断平台流量规则、渠道窗口、监管和发行资源配置是否变化。";
  if (family === "creator_community") return "对B站商务的价值在于判断是否能形成UP主选题、直播节点和社区扩散。";
  if (family === "ai_production") return "对BD判断的价值在于理解供给侧变化、研发效率和内容合规风险。";
  return "用于判断游戏行业外部环境、发行节奏和内容平台可介入窗口。";
}

function actionForMediaSignal(item) {
  const family = mediaTopicFamily(item);
  if (isBilibiliSignal(item) && !isMetaBilibiliTrend(item)) return "打开视频看实机、弹幕、评论和UP主结论；像产品线索的进入人工review，泛娱乐内容只做趋势观察。";
  if (isMetaBilibiliTrend(item)) return "记录正在扩散的内容形式、UP主类型和玩家争议点，供选品与内容合作复用。";
  if (family === "product_ip") return "点开原文看画面、玩法、热度和社区反应；值得玩的线索转入人工review或专题观察。";
  if (family === "business_legal") return "记录关键人、权属、诉讼、公司变化和发行占位，必要时进入合作方尽调。";
  if (family === "platform_market") return "提炼宏观变化对选品、上线窗口、渠道资源和内容投放的影响。";
  if (family === "creator_community") return "观察B站/YouTube/Twitch等内容扩散，筛选可合作达人和可复制选题。";
  if (family === "ai_production") return "关注产品是否涉及AI披露、素材争议、产能变化或平台合规风险。";
  return "只保留有BD启发的媒体信号；无业务动作的普通新闻不进雷达。";
}

function buildSteamMarketInsights(candidates, pools, context) {
  const clusters = buildSteamGenreSignals(candidates, context);
  const domestic = candidates.filter((candidate) => candidate.region === "中国");
  const demoCandidates = candidates.filter((candidate) => candidate.hasDemoSignal || /Demo|Next Fest|试玩|新品节/i.test(candidate.source));
  const strongDataCandidates = candidates.filter((candidate) => candidate.strongData || candidate.validatedPcHit || candidate.recommendationCount >= 500);
  const publisherRows = topPublishers(candidates);
  const upcomingLink = "https://store.steampowered.com/search/?filter=popularcomingsoon";
  const nextFestLink = "https://store.steampowered.com/sale/nextfest";
  const chartsLink = "https://steamdb.info/charts/";
  const topSellersLink = "https://store.steampowered.com/search/?filter=topsellers";

  return [
    steamInsight(
      context,
      "category_risers",
      `近期冒头品类：${clusters.slice(0, 3).map((item) => item.genre.replace(/（.+$/, "")).join("、") || "待观察"}`,
      clusters.length
        ? `样本中 ${clusters.slice(0, 4).map((item) => item.genre).join("、")} 最集中。重点不是标签热闹，而是这些品类是否有清晰循环、可剪视频看点和B站讨论空间。`
        : "今日 Steam 样本没有形成稳定品类聚类，先观察新品窗口和榜单波动。",
      "高",
      "Steam Store / AppDetails scan",
      upcomingLink,
      "优先打开头部样本看玩法循环和视频素材；只把能被UP主讲清楚、测得出差异的项目放进人工复核。"
    ),
    steamInsight(
      context,
      "demo_window",
      `Demo/活动窗口：${demoCandidates.length} 个候选带试玩或新品节信号`,
      `其中国内相关 ${demoCandidates.filter((candidate) => candidate.region === "中国").length} 个。Demo、Next Fest、热门即将推出比普通标签更接近可执行窗口，适合安排运营测试和内容预判。`,
      demoCandidates.length >= 8 ? "高" : "中",
      "Steam Demo / Next Fest / Upcoming",
      nextFestLink,
      "先测游戏，再决定商务；国内Demo优先排期，海外Demo必须同时看PC数据和手游化角度。"
    ),
    steamInsight(
      context,
      "publisher_slate",
      `发行商新品：${publisherRows.length ? publisherRows.slice(0, 4).map(([name, count]) => `${name}(${count})`).join("、") : "待确认"}`,
      publisherRows.length
        ? `今日样本里这些发行/开发主体重复出现。重复出现不等于可签，反而要判断是否已被成熟发行商占位、是否仍有中国区权益空间。`
        : "今日样本的发行商信息较分散，需要依靠单品质量和联系方式继续判断。",
      publisherRows.length ? "中" : "低",
      "Steam publisher/developer fields",
      topSellersLink,
      "对成熟发行商占位项目降低BD优先级；对国内自研或发行结构未明项目，测试通过后再补联系方式。"
    ),
    steamInsight(
      context,
      "data_quality",
      `数据面：${strongDataCandidates.length} 个样本有公开热度或强素材信号`,
      `扫描样本 ${candidates.length} 个，国内 ${domestic.length} 个，推荐数/口碑/强数据命中 ${strongDataCandidates.length} 个，素材充足样本 ${candidates.filter((candidate) => candidate.screenshotCount >= 6 || candidate.movieCount >= 1).length} 个。`,
      strongDataCandidates.length >= 8 ? "高" : "中",
      "Steam recommendations / media assets / SteamDB",
      chartsLink,
      "缺数据的项目不急着商务推进；先补公开视频、试玩反馈、愿望单/评论/社区证据，再决定进入跟进。"
    )
  ];
}

function buildSteamGenreSignals(candidates, context) {
  const clusters = [
    {
      genre: "Roguelike / Deckbuilder",
      pattern: /rogue|roguelike|deck|card|卡牌|构筑|肉鸽/i,
      why: "机制清晰、单局反馈强，适合B站做挑战、构筑分享、直播切片和攻略复盘。",
      action: "优先看是否有差异化机制、局外成长和可复播内容；只保留能被视频讲清楚的项目。",
      links: ["https://store.steampowered.com/tags/en/Roguelike/", "https://store.steampowered.com/tags/en/Deckbuilding/"]
    },
    {
      genre: "Strategy / Tactical",
      pattern: /strategy|tactical|turn|battle|war|策略|战棋|回合|战争|塔防/i,
      why: "策略品类容易形成长线讨论、攻略内容和核心用户沉淀，但上手门槛会影响破圈。",
      action: "看Demo是否能在前10分钟讲清核心决策；国内题材和强视觉反馈优先。",
      links: ["https://store.steampowered.com/tags/en/Strategy/", "https://store.steampowered.com/tags/en/Turn-Based%20Tactics/"]
    },
    {
      genre: "Simulation / Management",
      pattern: /simulation|management|tycoon|city builder|colony|simulator|模拟|经营|建造|管理/i,
      why: "经营模拟适合系列化视频、直播养成和社群二创，若主题独特可放大B站内容价值。",
      action: "优先筛选题材新、目标明确、可展示成长曲线的项目；纯数值堆叠谨慎。",
      links: ["https://store.steampowered.com/tags/en/Simulation/", "https://store.steampowered.com/tags/en/Management/"]
    },
    {
      genre: "Co-op / Multiplayer",
      pattern: /co-op|multiplayer|online co-op|party|pvp|多人|合作|联机|派对|对战/i,
      why: "多人协作/对抗天然适合直播和UP主联动，但服务器、匹配和运营成本要提前判断。",
      action: "看是否能形成多人节目效果；没有稳定测试和社区节奏的项目不急着推进商务。",
      links: ["https://store.steampowered.com/tags/en/Co-op/", "https://store.steampowered.com/tags/en/Multiplayer/"]
    },
    {
      genre: "Survival / Sandbox",
      pattern: /survival|sandbox|craft|open world|生存|沙盒|开放世界|建造/i,
      why: "生存沙盒容易产生长视频和社区服务器玩法，但内容体量、更新节奏和差异化很关键。",
      action: "看首测是否有明确生存压力、社交目标和长期内容；素材不足先观察。",
      links: ["https://store.steampowered.com/tags/en/Survival/", "https://store.steampowered.com/tags/en/Sandbox/"]
    },
    {
      genre: "Action / Visual Hook",
      pattern: /action|shooter|boss|combat|platformer|动作|射击|战斗|Boss|平台跳跃/i,
      why: "动作和强视觉项目更容易在B站首曝/PV/实机演示里被快速理解。",
      action: "优先看打击反馈、镜头语言、角色辨识度和Demo观感；普通动作壳不占用复核名额。",
      links: ["https://store.steampowered.com/tags/en/Action/", "https://store.steampowered.com/tags/en/Shooter/"]
    }
  ];

  return clusters
    .map((cluster) => {
      const matched = candidates.filter((candidate) => cluster.pattern.test(candidateGenreText(candidate)));
      const examples = matched.slice(0, 3).map((candidate) => candidate.title).join("、");
      return {
        ...cluster,
        count: matched.length,
        examples
      };
    })
    .filter((cluster) => cluster.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((cluster) => ({
      id: `steam_genre_${context.reportDate.replaceAll("-", "_")}_${normalizeText(cluster.genre).replace(/[^a-z0-9]+/g, "_")}`,
      genre: `${cluster.genre}（${cluster.count}/${candidates.length}）`,
      signal: `${cluster.count} 个候选命中；代表样本：${cluster.examples || "待打开Steam页确认"}。`,
      why_it_matters: cluster.why,
      bd_action: cluster.action,
      links: cluster.links
    }));
}

function selectSteamTrendSamples(candidates) {
  const selected = [];
  const seen = new Set();
  const validCandidates = candidates.filter((candidate) => !hardDropReason(candidate));
  for (const predicate of [
    (candidate) => candidate.region === "中国" && candidate.hasDemoSignal,
    (candidate) => candidate.region === "中国" && candidate.score >= 80,
    (candidate) => candidate.strongData || candidate.validatedPcHit,
    (candidate) => candidate.hasDemoSignal,
    () => true
  ]) {
    for (const candidate of validCandidates) {
      if (selected.length >= 12) return selected;
      if (seen.has(candidate.appId) || !predicate(candidate)) continue;
      selected.push(candidate);
      seen.add(candidate.appId);
    }
  }
  return selected;
}

function topPublishers(candidates) {
  const counts = new Map();
  for (const candidate of candidates) {
    const names = [...candidate.publishers, ...candidate.developers].filter(Boolean).slice(0, 2);
    for (const name of names) {
      if (/unknown|tbd|待确认/i.test(name)) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6);
}

function candidateGenreText(candidate) {
  return [
    candidate.title,
    candidate.shortDescription,
    ...(candidate.genres ?? []),
    ...(candidate.categories ?? []),
    candidate.source
  ].join(" ");
}

function describeSteamCluster(candidate, context) {
  const signal = buildSteamGenreSignals([candidate], context)[0]?.genre.replace(/（.+$/, "");
  if (signal) return signal;
  if (candidate.region === "中国") return "国内前置样本";
  if (candidate.validatedPcHit) return "海外PC数据样本";
  return "普通Upcoming样本";
}

function buildV5SteamSignal(candidate, context) {
  return [
    `大盘位置：${describeSteamCluster(candidate, context)}；来源 ${candidate.source}；发售窗口 ${candidate.releaseDate}。`,
    `公开数据：推荐数 ${candidate.recommendationCount || "无公开"}；素材 ${candidate.screenshotCount}图/${candidate.movieCount}视频；${candidate.hasDemoSignal ? "有Demo/试玩窗口" : "暂无明确Demo信号"}。`,
    `产品观察：${candidate.shortDescription || candidate.genres.join(" / ") || "待打开Steam页确认玩法循环"}。`,
    `BD判断：优势 ${buildProductStrength(candidate)}；风险 ${buildProductWeakness(candidate)}。`
  ].join("\n");
}

function buildV5TrendReason(candidate) {
  if (candidate.alreadyReleased) return "不建议推进：Steam 显示已发售，已错过前置BD窗口，只可作为市场复盘。";
  if (candidate.releaseTooSoon) return "不建议推进：距发售不足60天，合作窗口过近，只作为市场背景。";
  if (candidate.earlyAccess) return "不建议推进：Early Access命中排除项。";
  if (candidate.publisherOccupied) return "不建议推进：成熟发行商可能已占位。";
  if (candidate.region === "中国") return `B站赋能：${buildBilibiliFit(candidate)} BD动作：先做实机/运营测试；测试不成立直接淘汰，测试成立再补联系人、官网和商务窗口。`;
  return `B站赋能：${buildBilibiliFit(candidate)} BD动作：${candidate.score >= 58 ? "优先确认中国区权益、联系方式、中文计划和Demo/愿望单数据。" : "先看PC数据和手游化角度，证据不足就不占用BD队列。"}`;
}

function buildProductStrength(candidate) {
  const strengths = [];
  if (candidate.strongGameplay) strengths.push("玩法具备机制表达空间");
  if (candidate.highVisual) strengths.push("截图/视频素材较完整");
  if (candidate.strongData) strengths.push("存在公开数据或榜单信号");
  if (candidate.region === "中国") strengths.push("国内项目，沟通效率和文化适配优先");
  if (candidate.region === "中国" && candidate.hasDemoSignal) strengths.push("国内开发者Demo/试玩信号，适合优先提测");
  if (candidate.region === "海外" && candidate.validatedPcHit && candidate.mobileAdaptationPotential) strengths.push("海外PC数据已验证，可从手游化/移动端改编角度观察");
  if (candidate.contactMethods.length) strengths.push("有可尝试联系入口");
  return strengths.join("；") || "目前只有基础Steam曝光，优势待复核";
}

function buildProductWeakness(candidate) {
  const weaknesses = [];
  if (typeof candidate.daysToRelease !== "number") weaknesses.push("发售窗口不精确");
  if (!candidate.strongData) weaknesses.push("缺愿望单/口碑/社区强数据");
  if (!candidate.highVisual) weaknesses.push("视觉素材不足，内容转化需验证");
  if (candidate.alreadyReleased) weaknesses.push("已发售，前置BD窗口已过");
  if (candidate.releaseTooSoon) weaknesses.push("发售过近");
  if (candidate.region === "海外" && !candidate.validatedPcHit) weaknesses.push("海外项目缺少PC爆款数据验证");
  if (candidate.region === "海外" && !candidate.mobileAdaptationPotential) weaknesses.push("海外项目缺少手游化角度");
  if (candidate.publisherOccupied) weaknesses.push("发行可能已占位");
  return weaknesses.join("；") || "主要风险在团队地区、发行结构和中国区权益空间";
}

function radarItem(context, id, category, title, summary, heat, source, link, relevance, suggestedAction) {
  return { id: `radar_${context.reportDate.replaceAll("-", "_")}_${id}`, category, title, summary, heat, source, link, relevance, suggested_action: suggestedAction, captured_at: context.capturedAt };
}

function steamInsight(context, id, title, summary, signalLevel, source, link, suggestedAction) {
  return { id: `steam_macro_${context.reportDate.replaceAll("-", "_")}_${id}`, title, summary, signal_level: signalLevel, source, link, suggested_action: suggestedAction, captured_at: context.capturedAt };
}

function summarizeGenres(candidates) {
  const counts = new Map();
  for (const candidate of candidates) for (const genre of candidate.genres.slice(0, 4)) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([genre]) => genre);
}
