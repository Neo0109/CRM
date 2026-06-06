import type { ContactMethod, ContactType, Lead } from "./types";

export type LeadEvidenceStatus = "证据完整" | "待复核" | "高风险" | "不足以判断";
export type LeadEvidenceTone = "complete" | "review" | "risk" | "unknown";

export type LeadEvidenceFlag = {
  label: string;
  tone: LeadEvidenceTone;
};

export type LeadEvidenceRow = {
  label: string;
  value: string;
  tone: LeadEvidenceTone;
};

export type LeadEvidenceLink = {
  label: string;
  url: string;
};

export type LeadEvidence = {
  status: LeadEvidenceStatus;
  tone: LeadEvidenceTone;
  summary: string;
  flags: LeadEvidenceFlag[];
  rows: LeadEvidenceRow[];
  links: LeadEvidenceLink[];
};

const officialSourcePattern = /(官方号|官方账号|开发者|开发组|发行商|官网|开发日志|制作组|工作室)/i;
const negativeOfficialPattern = /(未找到官方|暂未找到官方|非官方|不是官方|官方.*待确认|官方.*未确认)/i;
const mediaSourcePattern = /(媒体|GameRes|游资网|indienova|TapTap|篝火营地|机核|游戏葡萄|陀螺|IGN|Gematsu|GamesPress)/i;
const recommenderPattern = /(推荐\s*UP|UP主|实况主|主播|测评|试玩推荐|个人推荐)/i;
const duplicatePattern = /(重复|已录入|历史|sourcing过|曾经\s*sourcing|命中.*历史|疑似.*重复)/i;
const launchedPattern = /(正式上线|已经上线|已上线|已发售|正式发售|released)/i;
const demoPattern = /(试玩\s*Demo|Demo|Playtest|免费试玩|试玩版)/i;
const demoAvailabilityPattern = /(试玩\s*Demo|Demo|Playtest|免费试玩|试玩版)[^。；，,\n]{0,18}(已上线|上线|可下载|开放|发布)/i;
const earlyAccessPattern = /(\bEarly Access\b|\bEA\b|抢先体验)/i;
const upcomingPattern = /(即将发售|Coming soon|未上线|计划.*发售|预计.*发售|将于.*发售)/i;
const oldDatePattern = /\b(20\d{2})[-/.年](0?[1-9]|1[0-2])[-/.月](0?[1-9]|[12]\d|3[01])日?\b/g;

export function buildLeadEvidence(lead: Lead, now = new Date()): LeadEvidence {
  const text = collectEvidenceText(lead);
  const sourceText = collectSourceText(lead);
  const links = collectLinks(lead, text);
  const steamLinks = links.filter((link) => isSteamLink(link));
  const bilibiliLinks = links.filter((link) => isBilibiliLink(link));
  const officialWebsiteLinks = collectOfficialWebsiteLinks(lead.contact_methods);
  const externalLinks = links.filter((link) => isExternalSourceLink(link, officialWebsiteLinks));
  const tapTapLinks = links.filter((link) => /taptap\.(cn|io|com)/i.test(link));
  const directContacts = visibleContacts(lead.contact_methods);
  const hasSteam = Boolean(lead.steam_app_id) || steamLinks.length > 0;
  const hasBilibili = bilibiliLinks.length > 0 || /B站|bilibili/i.test(text);
  const hasOfficialSource = (officialSourcePattern.test(sourceText) && !negativeOfficialPattern.test(sourceText)) || officialWebsiteLinks.length > 0;
  const hasMediaSource = mediaSourcePattern.test(text);
  const hasRecommenderSource = recommenderPattern.test(text);
  const hasWebsite = officialWebsiteLinks.length > 0 || hasContactType(directContacts, "官网");
  const hasEmail = hasContactType(directContacts, "Email");
  const hasDirectContact = directContacts.some((method) => ["微信/QQ", "Email", "电话", "官网"].includes(method.type));
  const hasOnlySourceContact = directContacts.length > 0 && directContacts.every((method) => ["Steam", "B站"].includes(method.type));
  const steamState = inferSteamState(lead, text);
  const isLaunched = steamState === "正式上线";
  const isDuplicate = duplicatePattern.test(text);
  const staleDate = findStaleDate(text, now);
  const lacksSteam = !hasSteam;
  const lacksOfficialTouch = !hasWebsite && !hasEmail && !hasDirectContact && !hasOfficialSource;
  const lacksCoreEvidence = lacksSteam && !hasWebsite && !hasOfficialSource;

  const flags: LeadEvidenceFlag[] = [];
  if (isLaunched) flags.push({ label: "已正式上线", tone: "risk" });
  if (isDuplicate) flags.push({ label: "疑似重复", tone: "risk" });
  if (staleDate) flags.push({ label: "来源偏旧", tone: "risk" });
  if (lacksSteam) flags.push({ label: "缺 Steam/AppID", tone: "unknown" });
  if (lacksOfficialTouch) flags.push({ label: "缺官方触达", tone: "unknown" });
  if (hasRecommenderSource && !hasOfficialSource) flags.push({ label: "非官方来源", tone: "review" });
  if (hasOnlySourceContact) flags.push({ label: "触达较弱", tone: "review" });

  const hasRisk = flags.some((flag) => flag.tone === "risk");
  const status: LeadEvidenceStatus = hasRisk
    ? "高风险"
    : lacksCoreEvidence
      ? "不足以判断"
      : hasSteam && (hasOfficialSource || hasDirectContact || hasWebsite) && !lacksOfficialTouch
        ? "证据完整"
        : "待复核";

  const tone = statusTone(status);
  const rows: LeadEvidenceRow[] = [
    { label: "来源链", value: sourceSummary({ hasOfficialSource, hasMediaSource, hasRecommenderSource, hasBilibili, hasSteam }), tone: hasOfficialSource ? "complete" : hasRecommenderSource ? "review" : "unknown" },
    { label: "时效性", value: staleDate ? `发现旧日期 ${staleDate}，需复核是否仍有 BD 价值` : `CRM 首见 ${lead.first_seen || "待确认"}`, tone: staleDate ? "risk" : "complete" },
    { label: "Steam 交叉验证", value: hasSteam ? `AppID ${lead.steam_app_id ?? extractSteamAppId(steamLinks[0]) ?? "待确认"} · ${steamState}` : "未发现 Steam/AppID", tone: isLaunched ? "risk" : hasSteam ? "complete" : "unknown" },
    { label: "去重检查", value: isDuplicate ? "字段中出现重复/历史录入信号" : "未发现重复证据（仅基于当前字段）", tone: isDuplicate ? "risk" : "complete" },
    { label: "触达完整度", value: contactSummary({ directContacts, hasWebsite, hasEmail, hasDirectContact, hasOnlySourceContact }), tone: lacksOfficialTouch ? "unknown" : hasOnlySourceContact ? "review" : "complete" }
  ];

  return {
    status,
    tone,
    summary: evidenceSummary(status, { isLaunched, isDuplicate, staleDate, lacksCoreEvidence, hasSteam, hasOfficialSource, hasDirectContact }),
    flags: flags.length > 0 ? flags : [{ label: "无明显证据风险", tone: "complete" }],
    rows,
    links: buildEvidenceLinks({ steamLinks, bilibiliLinks, websiteLinks: officialWebsiteLinks, tapTapLinks, externalLinks })
  };
}

function statusTone(status: LeadEvidenceStatus): LeadEvidenceTone {
  if (status === "证据完整") return "complete";
  if (status === "高风险") return "risk";
  if (status === "不足以判断") return "unknown";
  return "review";
}

function collectEvidenceText(lead: Lead) {
  return [
    lead.project,
    lead.team,
    lead.priority_reason,
    lead.rule_fit,
    lead.gameplay,
    lead.progress,
    lead.release_window,
    lead.publisher_status,
    lead.publisher_name,
    lead.traction_summary,
    lead.public_signals,
    lead.exposure_trail,
    lead.bilibili_fit,
    lead.amplification,
    lead.risks,
    lead.verdict,
    lead.notes,
    lead.contact,
    ...lead.links,
    ...lead.contact_methods.flatMap((method) => [method.type, method.value, method.note])
  ].filter(Boolean).join(" ");
}

function collectSourceText(lead: Lead) {
  return [
    lead.priority_reason,
    lead.rule_fit,
    lead.progress,
    lead.publisher_status,
    lead.traction_summary,
    lead.public_signals,
    lead.exposure_trail,
    lead.bilibili_fit,
    lead.amplification,
    lead.risks,
    lead.verdict,
    lead.notes,
    lead.contact,
    ...lead.links,
    ...lead.contact_methods.flatMap((method) => [method.type, method.value, method.note])
  ].filter(Boolean).join(" ");
}

function collectLinks(lead: Lead, text: string) {
  const detectedLinks = text.match(/https?:\/\/[^\s"'，。；、)）]+/g) ?? [];
  return Array.from(new Set([...lead.links, ...lead.contact_methods.map((method) => method.value), ...detectedLinks].map((link) => link.trim()).filter((link) => /^https?:\/\//i.test(link))));
}

function visibleContacts(methods: ContactMethod[]) {
  return methods.filter((method) => method.value.trim());
}

function collectOfficialWebsiteLinks(methods: ContactMethod[]) {
  return Array.from(new Set(methods
    .filter((method) => method.type === "官网")
    .map((method) => method.value.trim())
    .filter((value) => /^https?:\/\//i.test(value))));
}

function hasContactType(methods: ContactMethod[], type: ContactType) {
  return methods.some((method) => method.type === type && method.value.trim());
}

function isSteamLink(link: string) {
  return /(store\.steampowered\.com|steamcommunity\.com|steamdb\.info)/i.test(link);
}

function isBilibiliLink(link: string) {
  return /(bilibili\.com|b23\.tv)/i.test(link);
}

function isExternalSourceLink(link: string, officialWebsiteLinks: string[]) {
  return /^https?:\/\//i.test(link) && !officialWebsiteLinks.includes(link) && !isSteamLink(link) && !isBilibiliLink(link) && !/discord\.gg|discord\.com|taptap\.(cn|io|com)/i.test(link);
}

function extractSteamAppId(link: string | undefined) {
  return link?.match(/\/app\/(\d+)/i)?.[1] ?? null;
}

function inferSteamState(lead: Lead, text: string) {
  const merged = `${lead.progress} ${text}`;
  if (demoAvailabilityPattern.test(merged)) return "试玩 Demo";
  if (earlyAccessPattern.test(merged)) return "EA";
  if (upcomingPattern.test(merged)) return "即将发售";
  if (launchedPattern.test(merged)) return "正式上线";
  if (demoPattern.test(merged)) return "试玩 Demo";
  return "未知";
}

function findStaleDate(text: string, now: Date) {
  const dates: string[] = [];
  for (const match of text.matchAll(oldDatePattern)) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    const ageDays = Math.floor((now.getTime() - parsed.getTime()) / 86400000);
    if (ageDays > 180) dates.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return dates[0] ?? null;
}

function sourceSummary(input: { hasOfficialSource: boolean; hasMediaSource: boolean; hasRecommenderSource: boolean; hasBilibili: boolean; hasSteam: boolean }) {
  if (input.hasOfficialSource) return "官方/开发者/发行商信号已出现";
  if (input.hasMediaSource) return "媒体/社区来源，需回查官方链路";
  if (input.hasRecommenderSource) return "推荐 UP 或个人内容来源，需官方复核";
  if (input.hasBilibili) return "B站线索，官方身份待确认";
  if (input.hasSteam) return "Steam 来源，需补团队和联系方式";
  return "来源待确认";
}

function contactSummary(input: { directContacts: ContactMethod[]; hasWebsite: boolean; hasEmail: boolean; hasDirectContact: boolean; hasOnlySourceContact: boolean }) {
  if (input.hasWebsite && input.hasEmail) return "官网 + Email 可触达";
  if (input.hasEmail) return "Email 可触达";
  if (input.hasWebsite) return "官网可回查";
  if (input.hasDirectContact) return "已有直接联系方式";
  if (input.hasOnlySourceContact) return "仅 Steam/B站来源链接，商务触达较弱";
  if (input.directContacts.length > 0) return "联系方式需人工复核";
  return "缺少有效联系方式";
}

function evidenceSummary(status: LeadEvidenceStatus, input: { isLaunched: boolean; isDuplicate: boolean; staleDate: string | null; lacksCoreEvidence: boolean; hasSteam: boolean; hasOfficialSource: boolean; hasDirectContact: boolean }) {
  if (status === "高风险") {
    if (input.isLaunched) return "发现已上线信号，进入人工 review 前应先确认是否仍有发行价值。";
    if (input.isDuplicate) return "发现重复或历史录入信号，先核对 CRM 历史记录。";
    if (input.staleDate) return "来源时间偏旧，需确认是否仍是有效新线索。";
    return "存在明显证据风险，先复核再投入 BD 时间。";
  }
  if (status === "不足以判断") return "缺少 Steam/AppID、官网或官方来源，当前信息不足以支撑判断。";
  if (status === "证据完整") return "核心来源、Steam/链接和触达信息较完整，可进入人工判断。";
  if (!input.hasSteam) return "缺少 Steam/AppID 交叉验证，先补核心链接。";
  if (!input.hasOfficialSource && !input.hasDirectContact) return "来源身份或商务触达仍待确认。";
  return "证据基本可读，但仍有关键项需要人工复核。";
}

function buildEvidenceLinks(input: { steamLinks: string[]; bilibiliLinks: string[]; websiteLinks: string[]; tapTapLinks: string[]; externalLinks: string[] }) {
  const candidates: LeadEvidenceLink[] = [
    ...input.steamLinks.map((url) => ({ label: /steamdb/i.test(url) ? "SteamDB" : "Steam", url })),
    ...input.bilibiliLinks.map((url) => ({ label: "B站", url })),
    ...input.websiteLinks.map((url) => ({ label: "官网", url })),
    ...input.tapTapLinks.map((url) => ({ label: "TapTap", url })),
    ...input.externalLinks.map((url) => ({ label: "外部来源", url }))
  ];
  return candidates.slice(0, 5);
}
