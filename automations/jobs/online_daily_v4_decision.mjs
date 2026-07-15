import { normalizeDisplayText, normalizeText, normalizeUrl } from "./online_daily_v4_dedupe.mjs";
import {
  deriveConcreteChinaBilibiliValue,
  evaluateMediaIndiePrelaunchAdmission,
  evaluateSteamIndiePrelaunchAdmission,
  INDIE_PRELAUNCH_RULE_VERSION
} from "./online_daily_v7_indie_admission.mjs";

export function scoreCandidate(input) {
  let score = 0;
  if (input.source.includes("Upcoming")) score += 24;
  if (input.source.includes("Demo") || input.source.includes("Next Fest")) score += 14;
  if (input.source.includes("Featured Coming")) score += 10;
  if (input.source.includes("CN") || input.domesticLens) score += 6;
  if (input.domesticQuery) score += 18;
  if (input.domestic) score += 30;
  if (input.domestic && input.hasDemoSignal) score += 22;
  if (input.strongGameplay) score += 18;
  if (input.highVisual) score += 12;
  if (input.strongData) score += 14;
  if (!input.domestic) score -= 10;
  if (!input.domestic && input.validatedPcHit) score += 22;
  if (!input.domestic && input.mobileAdaptationPotential) score += 10;
  if (input.comingSoon) score += 6;
  if (input.hasDetails) score += 5;
  if (input.contactCount) score += 4;
  if (input.alreadyReleased) score -= 80;
  if (input.releaseTooSoon) score -= input.domestic ? 4 : 30;
  if (input.publisherOccupied) score -= 24;
  if (input.earlyAccess) score -= input.domestic ? 12 : 50;
  if (input.narrativeHeavy) score -= 35;
  if (input.indiaTeam) score -= 50;
  return score;
}

export function buildPools(candidates, mediaLeads = [], options = {}) {
  const context = {
    reportDate: options.reportDate ?? new Date().toISOString().slice(0, 10)
  };
  const steamLeads = candidates
    .map((candidate) => toLead(candidate, context))
    .filter((lead) => lead._indieAdmission.qualified);
  const qualifiedMediaLeads = mediaLeads
    .map((lead) => toQualifiedMediaLead(lead))
    .filter((lead) => lead._indieAdmission.qualified);
  const used = new Set();
  const mediaPush = selectUniqueLeads(qualifiedMediaLeads, used);
  const steamPush = selectUniqueLeads(steamLeads, used);
  const push = interleaveLeads(mediaPush, steamPush).map(stripPrivate);
  return {
    push,
    watch: [],
    drop: [],
    new_qualified_count: push.length
  };
}

function interleaveLeads(primary, secondary) {
  const out = [];
  const maxLength = Math.max(primary.length, secondary.length);
  for (let index = 0; index < maxLength; index += 1) {
    if (primary[index]) out.push(primary[index]);
    if (secondary[index]) out.push(secondary[index]);
  }
  return out;
}

function selectUniqueLeads(leads, used) {
  const selected = [];
  for (const lead of leads) {
    const key = poolLeadKey(lead);
    if (used.has(key)) continue;
    selected.push(lead);
    used.add(key);
  }
  return selected;
}

function poolLeadKey(lead) {
  if (lead.steam_app_id) return `steam:${lead.steam_app_id}`;
  const looseKey = looseChineseProjectKey(lead.project);
  return `project:${looseKey || normalizeText(lead.project)}`;
}

function looseChineseProjectKey(value) {
  const hanChars = [...normalizeDisplayText(value)].filter((char) => /\p{Script=Han}/u.test(char));
  if (hanChars.length < 6 || hanChars.length > 24) return null;
  return `han:${hanChars.sort().join("")}`;
}

function toLead(candidate, context) {
  const admission = evaluateSteamIndiePrelaunchAdmission(candidate);
  const genre = candidate.genres.join(" / ") || null;
  return {
    _class: admission.qualified ? "push" : "candidate",
    _indieAdmission: admission,
    id: `lead_steam_${candidate.appId}_${context.reportDate}`,
    project: candidate.title,
    steam_app_id: candidate.appId,
    team: candidate.developers[0] ?? null,
    team_size: null,
    country: candidate.country,
    region: candidate.region,
    city: null,
    region_priority: candidate.region === "中国" ? "国内优先" : candidate.validatedPcHit && candidate.mobileAdaptationPotential ? "海外-强数据" : "其他",
    bucket: "未处理",
    stage: "new",
    priority: null,
    sourcing_lane: "indie_prelaunch",
    sourcing_rule_version: INDIE_PRELAUNCH_RULE_VERSION,
    sourcing_run_type: "scheduled",
    drop_reason: null,
    priority_reason: null,
    rule_fit: admission.qualified
      ? "V7.0 独立游戏前置发行全部准入门已通过；排序只影响阅读顺序，不影响推荐资格。"
      : admissionFailureText(admission),
    genre,
    gameplay: candidate.shortDescription || `${genre ?? "玩法待复核"}。需要打开 Steam 页面确认实机画面、玩法循环、Demo/愿望单信号和中文计划。`,
    progress: `Steam ${candidate.source}；发售窗口：${candidate.releaseDate}${candidate.hasDemoSignal ? "；Demo/试玩信号需优先复核" : ""}`,
    release_window: candidate.releaseDate,
    early_access: candidate.earlyAccess,
    narrative_heavy: candidate.narrativeHeavy,
    india_team: candidate.indiaTeam,
    publisher_status: buildPublisherStatus(candidate),
    publisher_name: candidate.publishers[0] ?? null,
    china_capability_occupied: candidate.publisherOccupied,
    traction_summary: buildTractionSummary(candidate),
    public_signals: `${candidate.source} / Steam App ${candidate.appId}`,
    contact: candidate.contactMethods.map((method) => `${method.type}: ${method.value}`).join("；"),
    contact_methods: candidate.contactMethods,
    links: [candidate.storeUrl, candidate.steamDbUrl, candidate.website].filter(Boolean),
    exposure_trail: buildExposureTrail(candidate, context.reportDate),
    bilibili_fit: admission.evidence.china_bilibili_value ?? buildBilibiliFit(candidate),
    amplification: buildAmplification(candidate),
    risks: admission.qualified ? buildRisks(candidate, null) : admissionFailureText(admission),
    verdict: admission.qualified ? "符合 V7.0 indie_prelaunch 正式准入；建议按人工优先级流程评估并触达。" : "",
    next_action: null,
    owner: null,
    due_date: null,
    first_seen: context.reportDate,
    notes: null
  };
}

function toQualifiedMediaLead(lead) {
  const admission = evaluateMediaIndiePrelaunchAdmission(lead);
  return {
    ...lead,
    _class: admission.qualified ? "push" : "candidate",
    _indieAdmission: admission,
    bucket: "未处理",
    stage: "new",
    priority: null,
    sourcing_lane: "indie_prelaunch",
    sourcing_rule_version: INDIE_PRELAUNCH_RULE_VERSION,
    sourcing_run_type: "scheduled",
    drop_reason: null,
    priority_reason: null,
    rule_fit: admission.qualified
      ? "V7.0 独立游戏前置发行全部准入门已通过；排序只影响阅读顺序，不影响推荐资格。"
      : admissionFailureText(admission),
    bilibili_fit: admission.evidence.china_bilibili_value ?? lead.bilibili_fit,
    risks: admission.qualified ? lead.risks : admissionFailureText(admission),
    verdict: admission.qualified ? "符合 V7.0 indie_prelaunch 正式准入；建议按人工优先级流程评估并触达。" : "",
    next_action: null,
    notes: null
  };
}

export function hardDropReason(candidate) {
  const admission = evaluateSteamIndiePrelaunchAdmission(candidate);
  return admission.disposition === "excluded" ? admission.exclusion_reasons.join("；") : null;
}

function releaseWindowText(candidate) {
  if (typeof candidate.daysToRelease !== "number") return "窗口待确认";
  if (candidate.daysToRelease < 0) return `已发售约${Math.abs(candidate.daysToRelease)}天`;
  return `距发售约${candidate.daysToRelease}天`;
}

function buildRuleFit(candidate, dropReason, className) {
  const parts = [];
  if (candidate.region === "中国") parts.push("国内项目优先");
  if (candidate.region === "中国" && candidate.hasDemoSignal) parts.push("国内开发者Demo测试提权");
  if (candidate.region === "海外" && candidate.validatedPcHit && candidate.mobileAdaptationPotential) parts.push("海外PC爆款验证 + 手游化角度成立");
  if (candidate.strongGameplay) parts.push("玩法具备内容化潜力");
  if (typeof candidate.daysToRelease === "number") parts.push(releaseWindowText(candidate));
  if (className === "push") parts.push("窗口仍在，允许优先触达");
  if (dropReason) parts.push(dropReason);
  if (!parts.length) parts.push("基础入口成立，待人工复核");
  return parts.join("；");
}

function buildPublisherStatus(candidate) {
  if (!candidate.publishers.length) return "发行结构待确认";
  return `${candidate.publishers.join(" / ")}；${candidate.publisherOccupied ? "成熟发行商可能已占位" : "未见成熟中国发行能力占位"}`;
}

function buildTractionSummary(candidate) {
  const signals = [candidate.source];
  if (candidate.highVisual) signals.push("素材/截图/视频可验证");
  if (candidate.hasDemoSignal) signals.push("Demo/试玩信号");
  if (candidate.strongData) signals.push("存在强公开数据信号");
  if (candidate.strongGameplay) signals.push("玩法具备内容化空间");
  return `${signals.join("；")}。`;
}

function buildExposureTrail(candidate, reportDate) {
  return `最早自动捕捉：${candidate.source}（${reportDate}）。待反查：Steam News、SteamDB、GamesPress、YouTube trailer、B站、indienova、官网/Discord。目标是确认是否仍处在最佳BD窗口。`;
}

function buildRisks(candidate, dropReason) {
  if (dropReason) return dropReason;
  const risks = [];
  if (typeof candidate.daysToRelease !== "number") risks.push("发售窗口未精确");
  if (!candidate.strongData) risks.push("缺少愿望单/口碑/社区强数据");
  if (candidate.region === "海外" && !candidate.validatedPcHit) risks.push("海外项目缺少PC爆款验证");
  if (candidate.region === "海外" && !candidate.mobileAdaptationPotential) risks.push("海外项目缺少手游化角度");
  if (!candidate.developers.length) risks.push("团队信息待确认");
  if (!candidate.contactMethods.length) risks.push("联系入口待确认");
  return risks.length ? risks.join("；") : "需要人工确认团队地区、中文计划、发行占位和商务合作意愿。";
}

function admissionFailureText(admission) {
  const missing = admission.missing_evidence.length
    ? `缺少证据：${admission.missing_evidence.join("、")}`
    : null;
  const excluded = admission.exclusion_reasons.length
    ? `排除原因：${admission.exclusion_reasons.join("；")}`
    : null;
  return [missing, excluded].filter(Boolean).join("；") || "未通过 V7.0 独立游戏前置发行准入。";
}

function buildVerdict(className, dropReason) {
  if (className === "push") return "符合V6重点复核标准，建议先测游戏；测试成立后再确认中国区合作窗口与开发者真实需求";
  if (className === "drop") return `${dropReason}，暂不投入BD时间`;
  return "方向可看但还不够商务推进，先进入未处理 inbox；测试/观察不成立就直接淘汰";
}

function dropReasonLabel(candidate, dropReason) {
  if (!dropReason) return null;
  if (candidate.releaseTooSoon) return "窗口不合适";
  if (candidate.alreadyReleased) return "已上线";
  return null;
}

export function buildBilibiliFit(candidate) {
  const text = `${candidate.genres.join(" ")} ${candidate.categories.join(" ")}`;
  const concreteValue = deriveConcreteChinaBilibiliValue(text);
  if (concreteValue) return concreteValue;
  if (candidate.highVisual) return "画面素材较完整，适合先做视觉向短内容和愿望单转化测试。";
  return "需要先看 Steam 页面素材，确认是否能被标题化、切片化和讲解化。";
}

function buildAmplification(candidate) {
  const text = `${candidate.genres.join(" ")} ${candidate.categories.join(" ")}`;
  if (/roguelike|deckbuilder|card game|tactical/i.test(text)) return "可围绕构筑、流派、挑战路线做栏目化内容。";
  if (/simulation|management|automation|city builder|factory/i.test(text)) return "可做新手指南、效率对比、失败案例和长期连载。";
  if (/co-op|multiplayer/i.test(text)) return "可做多人首测、主播局和社交传播节点。";
  return "先用实机素材验证点击和完播，再决定是否推进商务触达。";
}

export function stripPrivate(lead) {
  return Object.fromEntries(Object.entries(lead).filter(([key]) => !key.startsWith("_") && key !== "media_score"));
}
