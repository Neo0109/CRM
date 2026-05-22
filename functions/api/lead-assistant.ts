import { json, mergeIncomingLeads, requireAccess, todayInShanghai, type Lead, type PagesContext } from "../_lib/crm";

type AttachmentMeta = {
  name?: string;
  type?: string;
  size?: number;
  source?: "paste" | "upload" | string;
  data_url?: string;
};

type LeadAssistantPayload = {
  text?: string;
  keywords?: string[];
  attachments?: AttachmentMeta[];
};

type SteamAppData = {
  type?: string;
  name?: string;
  developers?: string[];
  publishers?: string[];
  genres?: { description?: string }[];
  short_description?: string;
  release_date?: { coming_soon?: boolean; date?: string };
  website?: string;
};

type SteamAppResponse = Record<string, { success?: boolean; data?: SteamAppData }>;

type AssistantLead = Partial<Lead>;

export const onRequestPost = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    const payload = (await request.json()) as LeadAssistantPayload;
    const text = normalizeInputText(payload);
    const attachments = Array.isArray(payload.attachments) ? payload.attachments.filter((item) => item?.name || item?.type || item?.data_url) : [];

    if (!text && !attachments.length) {
      return json({ error: "请输入关键词、线索说明、Steam 链接，或直接粘贴截图" }, 400);
    }

    const steamAppIds = extractSteamAppIds(text);
    const contacts = extractContactMethods(text);
    const links = extractLinks(text);
    const today = todayInShanghai();
    const skipped: string[] = [];
    const leads: AssistantLead[] = [];

    for (const steamAppId of steamAppIds) {
      const details = await fetchSteamAppDetails(steamAppId);
      if (details?.type && details.type !== "game") {
        skipped.push(`${steamAppId}: ${details.type}`);
        continue;
      }

      leads.push(buildSteamLead({ steamAppId, details, text, links, contacts, attachments, today }));
    }

    if (!leads.length && (text || attachments.length)) {
      leads.push(buildManualLead({ text, links, contacts, attachments, today }));
    }

    const result = leads.length ? await mergeIncomingLeads(env, leads) : { created: 0, updated: 0, dropped: 0, total: 0 };
    return json({
      message: leads.length ? "线索助手已写入 CRM" : "没有可写入的候选",
      created: result.created,
      updated: result.updated,
      dropped: result.dropped,
      total: result.total,
      skipped,
      leads
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
};

function normalizeInputText(payload: LeadAssistantPayload) {
  const parts = [payload.text, ...(Array.isArray(payload.keywords) ? payload.keywords : [])]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
  return parts.join("\n");
}

function buildSteamLead({ steamAppId, details, text, links, contacts, attachments, today }: {
  steamAppId: string;
  details: SteamAppData | null;
  text: string;
  links: string[];
  contacts: Lead["contact_methods"];
  attachments: AttachmentMeta[];
  today: string;
}): AssistantLead {
  const project = details?.name ?? inferProjectName(text) ?? `Steam App ${steamAppId}`;
  const releaseText = details?.release_date?.coming_soon ? `即将推出${details.release_date.date ? `：${details.release_date.date}` : ""}` : details?.release_date?.date ?? null;
  const publisherName = firstValue(details?.publishers);
  const developerName = firstValue(details?.developers);
  const country = inferCountry(text);
  const regionPriority = inferRegionPriority(text, country);
  const storeLink = `https://store.steampowered.com/app/${steamAppId}/`;
  const steamDbLink = `https://steamdb.info/app/${steamAppId}/`;
  const leadLinks = uniqueLinks([storeLink, steamDbLink, details?.website, ...links]);
  const contactMethods = ensureContactMethods(contacts, steamAppId, leadLinks);

  return {
    project,
    steam_app_id: steamAppId,
    team: developerName,
    country,
    city: inferCity(text),
    region_priority: regionPriority,
    bucket: "观察池",
    stage: "watch",
    priority: inferPriority(text, regionPriority),
    review_status: "未处理",
    genre: (details?.genres ?? []).map((genre) => genre.description).filter((value): value is string => Boolean(value)).join(" / ") || null,
    gameplay: details?.short_description ?? null,
    progress: releaseText ?? "线索助手录入，待确认进度",
    release_window: releaseText,
    early_access: /early access|抢先体验|ea\b/i.test(text),
    narrative_heavy: /叙事|剧情驱动|story rich|narrative/i.test(text),
    india_team: /印度|india|indian/i.test(text),
    publisher_status: publisherName ? `Steam 显示发行商：${publisherName}` : "待确认发行结构",
    publisher_name: publisherName,
    china_capability_occupied: /中国能力已占位|国内发行已定|腾讯|网易|心动|bilibili|哔哩哔哩/i.test(text),
    contact: contactMethods[0]?.value ?? null,
    contact_methods: contactMethods,
    links: leadLinks,
    bilibili_fit: inferBilibiliFit(text),
    amplification: "线索助手录入，待评估内容放大方式",
    priority_reason: inferPriorityReason(text, regionPriority),
    rule_fit: inferRuleFit(text, country, steamAppId),
    verdict: "线索助手录入，待人工复核",
    next_action: contactMethods.length ? "检查联系人并判断是否推进" : "补联系人并复核 Steam 页面",
    first_seen: today,
    notes: assistantNotes(text, attachments)
  };
}

function buildManualLead({ text, links, contacts, attachments, today }: {
  text: string;
  links: string[];
  contacts: Lead["contact_methods"];
  attachments: AttachmentMeta[];
  today: string;
}): AssistantLead {
  const project = inferProjectName(text) ?? `手动线索 ${today}`;
  const country = inferCountry(text);
  const regionPriority = inferRegionPriority(text, country);
  const hasGameLink = links.some(isGameLink);
  const contactMethods = ensureContactMethods(contacts, null, links);

  return {
    project,
    country,
    city: inferCity(text),
    region_priority: regionPriority,
    bucket: "观察池",
    stage: "watch",
    priority: inferPriority(text, regionPriority),
    review_status: "未处理",
    progress: hasGameLink ? "线索助手录入，待复核页面信息" : "线索助手录入，待补 Steam/官网信息",
    publisher_status: "待确认发行结构",
    contact: contactMethods[0]?.value ?? null,
    contact_methods: contactMethods,
    links,
    bilibili_fit: inferBilibiliFit(text),
    amplification: "线索助手录入，待评估内容放大方式",
    priority_reason: inferPriorityReason(text, regionPriority),
    rule_fit: hasGameLink ? "有可验证游戏链接，待人工复核" : "缺少 Steam/SteamDB 链接，需要补充可验证页面",
    verdict: "线索助手录入，待人工复核",
    next_action: hasGameLink ? "打开链接复核画面和发行结构" : "补充 Steam/官网链接后再判断",
    first_seen: today,
    notes: assistantNotes(text, attachments)
  };
}

async function fetchSteamAppDetails(steamAppId: string) {
  try {
    const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${steamAppId}&cc=us&l=schinese`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as SteamAppResponse;
    const entry = payload[steamAppId];
    return entry?.success ? entry.data ?? null : null;
  } catch {
    return null;
  }
}

function extractSteamAppIds(text: string) {
  const ids = new Set<string>();
  for (const match of text.matchAll(/(?:store\.steampowered\.com|steamdb\.info)\/app\/(\d+)/gi)) ids.add(match[1]);
  for (const match of text.matchAll(/(?:steam\s*app\s*id|appid|app_id)[:：\s#]*(\d{3,})/gi)) ids.add(match[1]);
  return Array.from(ids);
}

function extractLinks(text: string) {
  const matches = text.match(/https?:\/\/[^\s)）]+/gi) ?? [];
  return uniqueLinks(matches.map((link) => link.replace(/[，。；;,.]+$/, "")));
}

function extractContactMethods(text: string): Lead["contact_methods"] {
  const methods: Lead["contact_methods"] = [];
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  for (const email of emails) methods.push({ type: "Email", value: email });

  for (const match of text.matchAll(/(?:电话|手机|tel|phone|mobile)[:：\s]*([+]?\d[\d\s-]{7,}\d)/gi)) {
    methods.push({ type: "电话", value: match[1].trim() });
  }

  for (const match of text.matchAll(/(?:微信|wechat|wx|QQ|qq)[:：\s]*([A-Za-z0-9_\-.]{4,})/gi)) {
    methods.push({ type: "微信/QQ", value: match[1] });
  }

  for (const match of text.matchAll(/(?:discord)[:：\s]*([A-Za-z0-9_.#-]{3,})/gi)) {
    methods.push({ type: "Discord", value: match[1] });
  }

  return dedupeContacts(methods.filter((method) => !isGameLink(method.value)));
}

function ensureContactMethods(contacts: Lead["contact_methods"], steamAppId: string | null, links: string[]) {
  const methods = [...contacts];
  if (!methods.length && steamAppId) {
    methods.push({
      type: "Steam",
      value: `https://steamcommunity.com/app/${steamAppId}/discussions/`,
      note: "线索助手自动补充的 Steam 社区联系入口"
    });
  }

  if (!methods.length) {
    const website = links.find((link) => isHttpLink(link) && !isGameLink(link));
    if (website) methods.push({ type: "官网", value: website, note: "线索助手从输入链接中提取" });
  }

  return dedupeContacts(methods.filter((method) => method.value && !isGameLink(method.value)));
}

function inferProjectName(text: string) {
  const labeled = text.match(/(?:项目|游戏|名称|project|game)[:：]\s*([^\n，。]+)/i)?.[1]?.trim();
  if (labeled) return labeled.slice(0, 80);
  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean);
  if (!firstLine) return null;
  return firstLine.replace(/^[-*#\s]+/, "").slice(0, 80);
}

function inferCountry(text: string) {
  if (/中国|国内|国产|大陆|上海|北京|广州|深圳|成都|杭州|武汉|厦门|苏州|南京|重庆|西安/i.test(text)) return "中国";
  if (/日本|japan/i.test(text)) return "日本";
  if (/韩国|korea/i.test(text)) return "韩国";
  if (/美国|usa|united states/i.test(text)) return "美国";
  if (/英国|uk|united kingdom/i.test(text)) return "英国";
  if (/法国|france/i.test(text)) return "法国";
  if (/德国|germany/i.test(text)) return "德国";
  return "未知";
}

function inferCity(text: string) {
  const cities = ["上海", "北京", "广州", "深圳", "成都", "杭州", "武汉", "厦门", "苏州", "南京", "重庆", "西安"];
  return cities.find((city) => text.includes(city)) ?? null;
}

function inferRegionPriority(text: string, country: string): NonNullable<AssistantLead["region_priority"]> {
  if (country === "中国") return "国内优先";
  if (/wishlist|愿望单|销量|在线|峰值|viral|爆火|强数据/i.test(text)) return "海外-强数据";
  if (/高视觉|美术|画面|trailer|visual|art|cute|cozy/i.test(text)) return "海外-高视觉";
  return "其他";
}

function inferPriority(text: string, regionPriority: NonNullable<AssistantLead["region_priority"]>): NonNullable<AssistantLead["priority"]> {
  if (/P0|马上|高优|强推|必须看|爆/i.test(text)) return "P0";
  if (regionPriority === "国内优先" || regionPriority === "海外-强数据") return "P1";
  if (regionPriority === "海外-高视觉") return "P2";
  return "P2";
}

function inferBilibiliFit(text: string) {
  if (/二创|主播|UP|直播|挑战|教程|攻略|整活|梗|mod|多人/i.test(text)) return "有内容放大线索，适合进一步评估 B站传播点";
  return "待评估：线索助手录入，需要补充 B站适配判断";
}

function inferPriorityReason(text: string, regionPriority: NonNullable<AssistantLead["region_priority"]>) {
  if (/wishlist|愿望单|销量|在线|峰值|爆火|viral/i.test(text)) return "文本中出现公开强数据或热度异动信号";
  if (regionPriority === "国内优先") return "国内项目优先，值得进入观察池复核";
  if (regionPriority === "海外-高视觉") return "海外项目疑似具备高视觉/内容传播潜力";
  return "用户通过线索助手主动提交，待补充强信号";
}

function inferRuleFit(text: string, country: string, steamAppId: string) {
  const reasons = [`已补 Steam/SteamDB 主体链接：${steamAppId}`];
  if (country === "中国") reasons.push("国内项目优先");
  if (/early access|抢先体验|ea\b/i.test(text)) reasons.push("注意：疑似 EA，需要人工复核是否淘汰");
  if (/叙事|剧情驱动|story rich|narrative/i.test(text)) reasons.push("注意：可能叙事主导");
  if (/印度|india|indian/i.test(text)) reasons.push("注意：可能印度团队");
  return reasons.join("；");
}

function assistantNotes(text: string, attachments: AttachmentMeta[]) {
  const body = text.trim() || "仅提交截图，待补充文字线索";
  const attachmentText = attachments.length
    ? `\n截图：${attachments.map((item, index) => {
      const source = item.source === "paste" ? "粘贴" : "上传";
      const name = item.name || `截图 ${index + 1}`;
      const size = typeof item.size === "number" ? formatBytes(item.size) : null;
      return [source, name, item.type, size].filter(Boolean).join(" / ");
    }).join("；")}`
    : "";
  return `线索助手输入：\n${body}${attachmentText}`.trim();
}

function uniqueLinks(values: (string | null | undefined)[]) {
  const deduped = new Map<string, string>();
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    deduped.set(trimmed.toLowerCase().replace(/\/$/, ""), trimmed);
  }
  return Array.from(deduped.values());
}

function dedupeContacts(values: Lead["contact_methods"]) {
  const deduped = new Map<string, Lead["contact_methods"][number]>();
  for (const value of values) deduped.set(`${value.type}:${value.value.toLowerCase()}`, value);
  return Array.from(deduped.values());
}

function firstValue(values: string[] | undefined) {
  return values?.find((value) => value.trim()) ?? null;
}

function isHttpLink(value: string) {
  return /^https?:\/\//i.test(value);
}

function isGameLink(value: string) {
  return /(?:store\.steampowered\.com|steamdb\.info)\/app\/\d+/i.test(value);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
