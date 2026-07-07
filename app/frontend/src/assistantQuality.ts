import type { Lead, LeadAssistantAttachment, LeadAssistantResult } from "./types";

export type AssistantDraftReadiness = "strong" | "usable" | "thin";
export type AssistantMissingField = "project" | "game-link" | "contact";

export type AssistantDraftAnalysis = {
  readiness: AssistantDraftReadiness;
  signals: {
    projectName: string | null;
    steamAppIds: string[];
    gameLinks: string[];
    websiteLinks: string[];
    contacts: string[];
    screenshots: number;
  };
  missing: AssistantMissingField[];
  suggestions: string[];
};

export type AssistantResultGroupKey = "needs-review" | "ready" | "skipped";

export type AssistantResultGroupItem = {
  project: string;
  summary: string;
  suggestions: string[];
  reviewTarget?: AssistantResultReviewTarget;
};

export type AssistantResultReviewTarget = {
  leadId?: string;
  project: string;
  steamAppId?: string;
};

export type AssistantResultGroup = {
  key: AssistantResultGroupKey;
  title: string;
  tone: "warning" | "success" | "muted";
  items: AssistantResultGroupItem[];
};

type AssistantDraftInput = {
  text: string;
  attachments: LeadAssistantAttachment[];
};

export function analyzeAssistantDraft({ text, attachments }: AssistantDraftInput): AssistantDraftAnalysis {
  const links = extractLinks(text);
  const steamAppIds = extractSteamAppIds(text, links);
  const websiteLinks = links.filter((link) => isHttpLink(link) && !isSteamAppLink(link));
  const gameLinks = links.filter((link) => isSteamAppLink(link) || !isNonGameUtilityLink(link));
  const contacts = extractContacts(text);
  const projectName = inferProjectName(text);
  const screenshots = attachments.filter((item) => isImageAttachment(item)).length;

  const missing: AssistantMissingField[] = [];
  if (!projectName) missing.push("project");
  if (!gameLinks.length && !steamAppIds.length) missing.push("game-link");
  if (!contacts.length) missing.push("contact");

  const readiness: AssistantDraftReadiness = missing.length === 0
    ? "strong"
    : missing.length <= 1 && (projectName || gameLinks.length || steamAppIds.length || websiteLinks.length)
      ? "usable"
      : "thin";

  return {
    readiness,
    signals: {
      projectName,
      steamAppIds,
      gameLinks,
      websiteLinks,
      contacts,
      screenshots
    },
    missing,
    suggestions: buildDraftSuggestions({ missing, readiness, screenshots })
  };
}

export function buildAssistantResultHints(result: LeadAssistantResult): string[] {
  const hints: string[] = [];
  const groups = buildAssistantResultGroups(result);

  const skippedGroup = groups.find((group) => group.key === "skipped");
  if (skippedGroup) hints.push(`跳过 ${skippedGroup.items.length} 条：优先检查是否为 DLC、原声、工具或缺少可验证游戏主体。`);

  for (const group of groups) {
    if (group.key === "skipped") continue;
    for (const item of group.items) hints.push(`${item.project}：${item.suggestions.join("；")}。`);
  }

  if (!hints.length && result.created + result.updated > 0) {
    hints.push("已写入 CRM：建议回到 Leads Review 复核优先级、Owner 和下一步动作。");
  }

  return hints;
}

export function buildAssistantResultGroups(result: LeadAssistantResult): AssistantResultGroup[] {
  const needsReview: AssistantResultGroupItem[] = [];
  const ready: AssistantResultGroupItem[] = [];
  const skipped: AssistantResultGroupItem[] = result.skipped.map((item) => ({
    project: item,
    summary: "未写入 CRM",
    suggestions: ["优先检查是否为 DLC、原声、工具或缺少可验证游戏主体。"]
  }));

  for (const lead of result.leads) {
    const project = lead.project?.trim() || "未命名线索";
    const suggestions = leadResultSuggestions(lead);
    const item: AssistantResultGroupItem = {
      project,
      summary: leadResultSummary(lead),
      suggestions: suggestions.length ? suggestions : ["已具备 Steam/联系方式，可进入 Leads Review 复核。"],
      reviewTarget: leadResultReviewTarget(lead, project)
    };

    if (suggestions.length) needsReview.push(item);
    else ready.push(item);
  }

  return [
    buildGroup("needs-review", "需要补充", "warning", needsReview),
    buildGroup("ready", "可复核线索", "success", ready),
    buildGroup("skipped", "跳过项", "muted", skipped)
  ].filter((group) => group.items.length > 0);
}

export function readinessLabel(readiness: AssistantDraftReadiness) {
  if (readiness === "strong") return "信息较完整";
  if (readiness === "usable") return "可提交，仍建议补充";
  return "信息偏薄";
}

function buildDraftSuggestions({ missing, readiness, screenshots }: {
  missing: AssistantMissingField[];
  readiness: AssistantDraftReadiness;
  screenshots: number;
}) {
  if (readiness === "strong") return ["信息较完整，可以提交；写入后仍建议在 Leads Review 里复核优先级和下一步。"];

  const suggestions: string[] = [];
  if (missing.includes("project")) suggestions.push("补一句项目名，能减少截图或链接被写成泛化线索。");
  if (missing.includes("game-link")) suggestions.push("补 Steam、SteamDB 或官网链接，便于去重和验证游戏主体。");
  if (missing.includes("contact")) suggestions.push("补联系方式：Email、微信、Discord、官网联系页或 Steam 社区入口。");
  if (screenshots > 0 && missing.length) suggestions.push("截图可保留上下文，但文字里补关键信息会更稳。");
  return suggestions;
}

function leadResultSuggestions(lead: Partial<Lead>) {
  const suggestions: string[] = [];
  const needsSteam = !hasSteamEvidence(lead) && mentionsMissingSteam(lead);
  const needsContact = !hasContactEvidence(lead);
  const needsPublisherReview = /待确认发行结构|待人工复核|待确认/i.test(lead.publisher_status ?? "");

  if (needsSteam) suggestions.push("补 Steam/SteamDB 或官网主体链接");
  if (needsContact) suggestions.push("补充可触达联系方式");
  if (needsPublisherReview) suggestions.push("复核发行结构");
  return suggestions;
}

function leadResultSummary(lead: Partial<Lead>) {
  const priority = lead.priority ?? "P2";
  const bucket = lead.bucket ?? "观察池";
  const reason = lead.priority_reason ?? "待复核";
  return `${priority} · ${bucket} · ${reason}`;
}

function leadResultReviewTarget(lead: Partial<Lead>, project: string): AssistantResultReviewTarget {
  return {
    leadId: cleanOptionalValue(lead.id),
    project,
    steamAppId: cleanOptionalValue(lead.steam_app_id)
  };
}

function buildGroup(
  key: AssistantResultGroupKey,
  title: AssistantResultGroup["title"],
  tone: AssistantResultGroup["tone"],
  items: AssistantResultGroupItem[]
): AssistantResultGroup {
  return { key, title, tone, items };
}

function cleanOptionalValue(value: string | null | undefined) {
  const clean = value?.trim();
  return clean || undefined;
}

function extractSteamAppIds(text: string, links: string[]) {
  const ids = new Set<string>();
  for (const link of links) {
    const match = link.match(/(?:store\.steampowered\.com|steamdb\.info|steamcommunity\.com)\/app\/(\d+)/i);
    if (match?.[1]) ids.add(match[1]);
  }
  for (const match of text.matchAll(/(?:steam\s*app\s*id|appid|app_id)[:：\s#]*(\d{3,})/gi)) ids.add(match[1]);
  return Array.from(ids);
}

function extractLinks(text: string) {
  const matches = text.match(/https?:\/\/[^\s)）]+/gi) ?? [];
  return unique(matches.map((link) => link.replace(/[，。；;,.、]+$/, "")));
}

function extractContacts(text: string) {
  const contacts: string[] = [];
  for (const email of text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []) contacts.push(`Email: ${email}`);
  for (const match of text.matchAll(/(?:电话|手机|tel|phone|mobile)[:：\s]*([+]?\d[\d\s-]{7,}\d)/gi)) contacts.push(`电话: ${match[1].trim()}`);
  for (const match of text.matchAll(/(?:微信|wechat|wx|QQ|qq)[:：\s]*([A-Za-z0-9_\-.]{4,})/gi)) contacts.push(`微信/QQ: ${match[1]}`);
  for (const match of text.matchAll(/(?:discord)[:：\s]*([A-Za-z0-9_.#-]{3,})/gi)) contacts.push(`Discord: ${match[1]}`);
  return unique(contacts.filter((contact) => !isSteamAppLink(contact)));
}

function inferProjectName(text: string) {
  const labeled = text.match(/(?:项目|游戏|名称|project|game)[:：]\s*([^\n，。]+)/i)?.[1]?.trim();
  if (labeled) return labeled.slice(0, 80);

  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean);
  if (!firstLine || /^https?:\/\//i.test(firstLine)) return null;
  return firstLine.replace(/^[-*#\s]+/, "").slice(0, 80);
}

function hasSteamEvidence(lead: Partial<Lead>) {
  return Boolean(lead.steam_app_id || lead.links?.some((link) => isSteamAppLink(link)));
}

function hasContactEvidence(lead: Partial<Lead>) {
  return Boolean(lead.contact || lead.contact_methods?.some((method) => method.value));
}

function mentionsMissingSteam(lead: Partial<Lead>) {
  const text = `${lead.rule_fit ?? ""}\n${lead.next_action ?? ""}\n${lead.progress ?? ""}`;
  return /缺少 Steam|补 Steam|SteamDB|可验证页面|待补 Steam/i.test(text);
}

function isImageAttachment(item: LeadAssistantAttachment) {
  return /^image\//i.test(item.type ?? "") || /^data:image\//i.test(item.data_url ?? "");
}

function isSteamAppLink(value: string) {
  return /(?:store\.steampowered\.com|steamdb\.info|steamcommunity\.com)\/app\/\d+/i.test(value);
}

function isHttpLink(value: string) {
  return /^https?:\/\//i.test(value);
}

function isNonGameUtilityLink(value: string) {
  return /(?:discord\.gg|discord\.com|x\.com|twitter\.com|t\.me|mailto:)/i.test(value);
}

function unique(values: string[]) {
  const seen = new Map<string, string>();
  for (const value of values) {
    const clean = value.trim();
    if (!clean) continue;
    seen.set(clean.toLowerCase().replace(/\/$/, ""), clean);
  }
  return Array.from(seen.values());
}
