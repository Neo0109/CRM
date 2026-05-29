import { json, mergeIncomingLeads, requireAccess, todayInShanghai, type Lead, type PagesContext } from "../_lib/crm";

type ContactMethod = Lead["contact_methods"][number];
type AssistantLead = Partial<Lead>;
type AssistantPriority = NonNullable<AssistantLead["priority"]>;
type AssistantRegionPriority = NonNullable<AssistantLead["region_priority"]>;
type AssistantBucket = NonNullable<AssistantLead["bucket"]>;

type AttachmentMeta = {
  name?: string;
  type?: string;
  size?: number;
  source?: "paste" | "upload" | "camera" | string;
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

type AiContactMethod = {
  type?: string | null;
  value?: string | null;
  note?: string | null;
};

type AiExtractedLead = {
  project?: string | null;
  steam_app_id?: string | null;
  team?: string | null;
  team_size?: string | null;
  country?: string | null;
  city?: string | null;
  region_priority?: string | null;
  bucket?: string | null;
  priority?: string | null;
  genre?: string | null;
  gameplay?: string | null;
  progress?: string | null;
  release_window?: string | null;
  publisher_status?: string | null;
  publisher_name?: string | null;
  traction_summary?: string | null;
  public_signals?: string | null;
  contact?: string | null;
  contact_methods?: AiContactMethod[];
  links?: string[];
  exposure_trail?: string | null;
  bilibili_fit?: string | null;
  amplification?: string | null;
  risks?: string | null;
  verdict?: string | null;
  next_action?: string | null;
  priority_reason?: string | null;
  rule_fit?: string | null;
  notes?: string | null;
};

type AiExtractionResult = {
  ocr_text?: string;
  search_summary?: string;
  skipped?: string[];
  leads?: AiExtractedLead[];
};

const contactTypes: ContactMethod["type"][] = ["微信/QQ", "Email", "电话", "官网", "Steam", "Discord", "B站", "X/Twitter", "其他"];
const priorityValues: AssistantPriority[] = ["P0", "P1", "P2", "P3"];
const regionPriorityValues: AssistantRegionPriority[] = ["国内优先", "海外-高视觉", "海外-强数据", "其他"];
const bucketValues: AssistantBucket[] = ["未处理", "待评测", "测试中", "跟进中", "观察池", "推进池", "淘汰池"];
const openAiResponsesUrl = "https://api.openai.com/v1/responses";
const defaultVisionModel = "gpt-4.1-mini";

export const onRequestPost = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    const payload = (await request.json()) as LeadAssistantPayload;
    const text = normalizeInputText(payload);
    const attachments = Array.isArray(payload.attachments) ? payload.attachments.filter((item) => item?.name || item?.type || item?.data_url) : [];
    const imageAttachments = attachments.filter(hasImageDataUrl).slice(0, 6);

    if (!text && !attachments.length) {
      return json({ error: "请输入关键词、线索说明、Steam 链接，或直接粘贴截图" }, 400);
    }

    const today = todayInShanghai();
    const leads: AssistantLead[] = [];
    const skipped: string[] = [];

    if (imageAttachments.length) {
      const aiResult = await extractLeadsWithVision(env, text, imageAttachments);
      skipped.push(...(aiResult.skipped ?? []));
      for (const extractedLead of aiResult.leads ?? []) {
        const lead = await buildAiLead(extractedLead, {
          text,
          attachments,
          ocrText: aiResult.ocr_text,
          searchSummary: aiResult.search_summary,
          today
        });
        if (lead) leads.push(lead);
        else skipped.push(`${extractedLead.project ?? "未命名截图线索"}: AI 未找到可验证游戏链接或项目名`);
      }
    }

    if (!leads.length) {
      const links = extractLinks(text);
      const contacts = extractContactMethods(text);
      const steamAppIds = extractSteamAppIds(text);
      for (const steamAppId of steamAppIds) {
        const details = await fetchSteamAppDetails(steamAppId);
        if (details?.type && details.type !== "game") {
          skipped.push(`${steamAppId}: ${details.type}`);
          continue;
        }
        leads.push(buildSteamLead({ steamAppId, details, text, links, contacts, attachments, today }));
      }

      if (!leads.length && !imageAttachments.length && text) {
        leads.push(buildManualLead({ text, links, contacts, attachments, today }));
      }
    }

    const result = leads.length ? await mergeIncomingLeads(env, leads) : { created: 0, updated: 0, dropped: 0, total: 0 };
    return json({
      message: leads.length ? "线索助手已写入 CRM" : "AI 没有识别到可写入的候选，请补一条项目名或 Steam 链接后重试",
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

async function extractLeadsWithVision(env: PagesContext["env"], text: string, attachments: AttachmentMeta[]): Promise<AiExtractionResult> {
  const config = openAiConfig(env);
  if (!config.apiKey) throw new Error("缺少 OPENAI_API_KEY，无法进行截图 OCR / 视觉识别");

  const userText = text.trim() || "用户只提交了截图，请先 OCR 读图，再根据截图中的游戏名、团队名、Steam 页面、社媒、新闻标题或商店信息联网查找对应游戏线索。";
  const attachmentSummary = attachments.map((item, index) => `${index + 1}. ${item.name ?? "截图"} / ${item.type ?? "image"} / ${typeof item.size === "number" ? formatBytes(item.size) : "unknown size"} / ${item.source ?? "unknown"}`).join("\n");
  const content = [
    {
      type: "input_text",
      text: `${visionPrompt()}\n\n用户补充文字：\n${userText}\n\n截图列表：\n${attachmentSummary}`
    },
    ...attachments.map((item) => ({ type: "input_image", image_url: item.data_url ?? "", detail: "high" }))
  ];

  const response = await callOpenAi(config.apiKey, config.model, content, "web_search");
  const finalResponse = response.ok ? response : await callOpenAi(config.apiKey, config.model, content, "web_search_preview");
  if (!finalResponse.ok) throw new Error(`OpenAI 视觉识别失败：${finalResponse.status} ${finalResponse.details}`);

  const outputText = responseOutputText(finalResponse.payload);
  if (!outputText) throw new Error("OpenAI 视觉识别没有返回可解析文本");

  try {
    return JSON.parse(outputText) as AiExtractionResult;
  } catch {
    throw new Error(`OpenAI 视觉识别返回的 JSON 无法解析：${outputText.slice(0, 400)}`);
  }
}

async function callOpenAi(apiKey: string, model: string, content: Record<string, unknown>[], toolType: "web_search" | "web_search_preview") {
  const response = await fetch(openAiResponsesUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
      tools: [{ type: toolType }],
      tool_choice: "auto",
      text: {
        format: {
          type: "json_schema",
          name: "crm_lead_vision_extraction",
          strict: false,
          schema: aiExtractionSchema()
        }
      },
      store: false,
      max_output_tokens: 6000
    })
  });

  if (!response.ok) return { ok: false as const, status: response.status, details: await response.text() };
  return { ok: true as const, payload: await response.json() };
}

function visionPrompt() {
  return `你是 B站游戏发行 BD 的线索识别助手。你需要完成 OCR、视觉理解、网页搜索和 CRM 结构化录入准备。

任务：
1. 读取用户粘贴/拍照/上传的截图，提取可见文字、游戏名、团队名、Steam AppID、官网、社媒、联系方式、新闻来源和截图上下文。
2. 使用 web_search 顺藤摸瓜查找对应游戏：优先 Steam 页面、SteamDB、官网/presskit、发行商官网、Discord、X/Twitter、B站、新闻稿。
3. 只输出游戏本体，不要 DLC、原声带、工具、非游戏软件。
4. 每条 lead 必须尽量有 Steam 链接或一个能看画面/背景的官方链接。
5. contact_methods 不能空。优先真实邮箱、电话、官网 contact/presskit、Discord、X/Twitter、B站；如果找不到直接商务联系方式，至少放 Steam 社区讨论区、开发者页、发行商页、官网或社媒入口。不要把 Steam 商店 app 页面或 SteamDB app 页面放进 contact_methods，它们只放 links。
6. 不要编造邮箱、电话、微信号。找不到就用真实可访问的社区/官网/社媒入口。
7. 按 B站游戏发行 BD 规则判断 priority_reason、rule_fit、bilibili_fit、amplification、risks、verdict、next_action。

输出必须是 JSON：
{
  "ocr_text": "截图中读到的关键文字",
  "search_summary": "你查到了什么，哪些来源最关键",
  "skipped": ["跳过原因"],
  "leads": [ ... ]
}`;
}

function aiExtractionSchema() {
  const nullableString = { type: ["string", "null"] };
  return {
    type: "object",
    additionalProperties: false,
    required: ["ocr_text", "search_summary", "skipped", "leads"],
    properties: {
      ocr_text: { type: "string" },
      search_summary: { type: "string" },
      skipped: { type: "array", items: { type: "string" } },
      leads: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            project: nullableString,
            steam_app_id: nullableString,
            team: nullableString,
            team_size: nullableString,
            country: nullableString,
            city: nullableString,
            region_priority: nullableString,
            bucket: nullableString,
            priority: nullableString,
            genre: nullableString,
            gameplay: nullableString,
            progress: nullableString,
            release_window: nullableString,
            publisher_status: nullableString,
            publisher_name: nullableString,
            traction_summary: nullableString,
            public_signals: nullableString,
            contact: nullableString,
            contact_methods: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  type: nullableString,
                  value: nullableString,
                  note: nullableString
                }
              }
            },
            links: { type: "array", items: { type: "string" } },
            exposure_trail: nullableString,
            bilibili_fit: nullableString,
            amplification: nullableString,
            risks: nullableString,
            verdict: nullableString,
            next_action: nullableString,
            priority_reason: nullableString,
            rule_fit: nullableString,
            notes: nullableString
          }
        }
      }
    }
  };
}

async function buildAiLead(raw: AiExtractedLead, context: { text: string; attachments: AttachmentMeta[]; ocrText?: string; searchSummary?: string; today: string }): Promise<AssistantLead | null> {
  const rawLinks = uniqueLinks(raw.links ?? []);
  const steamAppId = valueOrNull(raw.steam_app_id) ?? steamAppIdFromLinks(rawLinks);
  const details = steamAppId ? await fetchSteamAppDetails(steamAppId) : null;
  if (details?.type && details.type !== "game") return null;

  const project = valueOrNull(raw.project) ?? details?.name ?? null;
  if (!project) return null;

  const allText = `${context.text}\n${context.ocrText ?? ""}\n${context.searchSummary ?? ""}\n${raw.notes ?? ""}`;
  const country = valueOrNull(raw.country) ?? inferCountry(allText);
  const regionPriority = normalizeRegionPriority(raw.region_priority, allText, country);
  const releaseText = valueOrNull(raw.release_window) ?? releaseWindowFromSteam(details);
  const links = uniqueLinks([
    ...(steamAppId ? [`https://store.steampowered.com/app/${steamAppId}/`, `https://steamdb.info/app/${steamAppId}/`] : []),
    details?.website,
    ...rawLinks
  ]);
  const contacts = ensureContactMethods(normalizeAiContacts(raw.contact_methods ?? [], raw.contact), steamAppId, links);

  return {
    project,
    steam_app_id: steamAppId,
    team: valueOrNull(raw.team) ?? firstValue(details?.developers),
    team_size: valueOrNull(raw.team_size),
    country,
    city: valueOrNull(raw.city) ?? inferCity(allText),
    region_priority: regionPriority,
    bucket: normalizeBucket(raw.bucket),
    stage: stageFromBucket(normalizeBucket(raw.bucket)),
    priority: normalizePriority(raw.priority, regionPriority),
    review_status: "未处理",
    genre: valueOrNull(raw.genre) ?? steamGenres(details),
    gameplay: valueOrNull(raw.gameplay) ?? details?.short_description ?? null,
    progress: valueOrNull(raw.progress) ?? releaseText ?? "AI 视觉识别录入，待确认进度",
    release_window: releaseText,
    early_access: /early access|抢先体验|ea\b/i.test(`${allText}\n${raw.progress ?? ""}`),
    narrative_heavy: /叙事|剧情驱动|story rich|narrative/i.test(`${allText}\n${raw.genre ?? ""}`),
    india_team: /印度|india|indian/i.test(`${country}\n${allText}`),
    publisher_status: valueOrNull(raw.publisher_status) ?? (firstValue(details?.publishers) ? `Steam 显示发行商：${firstValue(details?.publishers)}` : "AI 视觉识别录入，待确认发行结构"),
    publisher_name: valueOrNull(raw.publisher_name) ?? firstValue(details?.publishers),
    china_capability_occupied: /中国能力已占位|国内发行已定|腾讯|网易|心动|bilibili|哔哩哔哩/i.test(`${allText}\n${raw.publisher_status ?? ""}`),
    traction_summary: valueOrNull(raw.traction_summary),
    public_signals: valueOrNull(raw.public_signals) ?? valueOrNull(context.searchSummary),
    contact: contacts[0]?.value ?? null,
    contact_methods: contacts,
    links,
    exposure_trail: valueOrNull(raw.exposure_trail) ?? "AI 视觉识别截图 + web_search 补全",
    bilibili_fit: valueOrNull(raw.bilibili_fit) ?? inferBilibiliFit(allText),
    amplification: valueOrNull(raw.amplification) ?? "AI 视觉识别录入，待评估内容放大方式",
    risks: valueOrNull(raw.risks),
    verdict: valueOrNull(raw.verdict) ?? "AI 视觉识别录入，待人工复核",
    next_action: valueOrNull(raw.next_action) ?? "打开链接复核画面、联系方式和发行结构",
    priority_reason: valueOrNull(raw.priority_reason) ?? inferPriorityReason(allText, regionPriority),
    rule_fit: valueOrNull(raw.rule_fit) ?? (steamAppId ? inferRuleFit(allText, country, steamAppId) : "AI 已识别截图线索，待补 Steam/SteamDB 主体链接"),
    first_seen: context.today,
    notes: assistantNotes(`${context.text}\n\nOCR：${context.ocrText ?? ""}\n\nAI 检索：${context.searchSummary ?? ""}\n\nAI 备注：${raw.notes ?? ""}`.trim(), context.attachments)
  };
}

function buildSteamLead({ steamAppId, details, text, links, contacts, attachments, today }: {
  steamAppId: string;
  details: SteamAppData | null;
  text: string;
  links: string[];
  contacts: ContactMethod[];
  attachments: AttachmentMeta[];
  today: string;
}): AssistantLead {
  const project = details?.name ?? inferProjectName(text) ?? `Steam App ${steamAppId}`;
  const country = inferCountry(text);
  const regionPriority = inferRegionPriority(text, country);
  const leadLinks = uniqueLinks([`https://store.steampowered.com/app/${steamAppId}/`, `https://steamdb.info/app/${steamAppId}/`, details?.website, ...links]);
  const contactMethods = ensureContactMethods(contacts, steamAppId, leadLinks);
  const releaseText = releaseWindowFromSteam(details);

  return {
    project,
    steam_app_id: steamAppId,
    team: firstValue(details?.developers),
    country,
    city: inferCity(text),
    region_priority: regionPriority,
    bucket: "未处理",
    stage: "new",
    priority: inferPriority(text, regionPriority),
    review_status: "未处理",
    genre: steamGenres(details),
    gameplay: details?.short_description ?? null,
    progress: releaseText ?? "线索助手录入，待确认进度",
    release_window: releaseText,
    early_access: /early access|抢先体验|ea\b/i.test(text),
    narrative_heavy: /叙事|剧情驱动|story rich|narrative/i.test(text),
    india_team: /印度|india|indian/i.test(text),
    publisher_status: firstValue(details?.publishers) ? `Steam 显示发行商：${firstValue(details?.publishers)}` : "待确认发行结构",
    publisher_name: firstValue(details?.publishers),
    china_capability_occupied: /中国能力已占位|国内发行已定|腾讯|网易|心动|bilibili|哔哩哔哩/i.test(text),
    contact: contactMethods[0]?.value ?? null,
    contact_methods: contactMethods,
    links: leadLinks,
    bilibili_fit: inferBilibiliFit(text),
    amplification: "线索助手录入，待评估内容放大方式",
    priority_reason: inferPriorityReason(text, regionPriority),
    rule_fit: inferRuleFit(text, country, steamAppId),
    verdict: "线索助手录入，待人工复核",
    next_action: "检查联系人并判断是否推进",
    first_seen: today,
    notes: assistantNotes(text, attachments)
  };
}

function buildManualLead({ text, links, contacts, attachments, today }: {
  text: string;
  links: string[];
  contacts: ContactMethod[];
  attachments: AttachmentMeta[];
  today: string;
}): AssistantLead {
  const project = inferProjectName(text) ?? `手动线索 ${today}`;
  const country = inferCountry(text);
  const regionPriority = inferRegionPriority(text, country);
  const contactMethods = ensureContactMethods(contacts, null, links);
  const hasGameLink = links.some(isGameStoreLink);

  return {
    project,
    country,
    city: inferCity(text),
    region_priority: regionPriority,
    bucket: "未处理",
    stage: "new",
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

function extractContactMethods(text: string): ContactMethod[] {
  const methods: ContactMethod[] = [];
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

  return dedupeContacts(methods.filter((method) => !isGameStoreLink(method.value)));
}

function normalizeAiContacts(values: AiContactMethod[], fallbackContact: string | null | undefined): ContactMethod[] {
  const methods: ContactMethod[] = [];
  for (const value of values) {
    const contactValue = valueOrNull(value.value);
    if (!contactValue || isGameStoreLink(contactValue)) continue;
    methods.push({ type: normalizeContactType(value.type, contactValue), value: contactValue, note: valueOrNull(value.note) });
  }

  const fallback = valueOrNull(fallbackContact);
  if (fallback && !isGameStoreLink(fallback)) methods.push({ type: normalizeContactType(null, fallback), value: fallback, note: "AI fallback contact" });
  return dedupeContacts(methods);
}

function ensureContactMethods(contacts: ContactMethod[], steamAppId: string | null, links: string[]) {
  const methods = [...contacts];
  if (!methods.length && steamAppId) {
    methods.push({
      type: "Steam",
      value: `https://steamcommunity.com/app/${steamAppId}/discussions/`,
      note: "线索助手自动补充的 Steam 社区联系入口"
    });
  }

  if (!methods.length) {
    const website = links.find((link) => isHttpLink(link) && !isGameStoreLink(link));
    if (website) methods.push({ type: "官网", value: website, note: "线索助手从输入链接中提取" });
  }

  return dedupeContacts(methods.filter((method) => method.value && !isGameStoreLink(method.value)));
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

function inferRegionPriority(text: string, country: string): AssistantRegionPriority {
  if (country === "中国") return "国内优先";
  if (/wishlist|愿望单|销量|在线|峰值|viral|爆火|强数据/i.test(text)) return "海外-强数据";
  if (/高视觉|美术|画面|trailer|visual|art|cute|cozy/i.test(text)) return "海外-高视觉";
  return "其他";
}

function normalizeRegionPriority(value: string | null | undefined, text: string, country: string): AssistantRegionPriority {
  return regionPriorityValues.includes(value as AssistantRegionPriority) ? value as AssistantRegionPriority : inferRegionPriority(text, country);
}

function normalizeBucket(value: string | null | undefined): AssistantBucket {
  return bucketValues.includes(value as AssistantBucket) ? value as AssistantBucket : "未处理";
}

function stageFromBucket(bucket: AssistantBucket): Lead["stage"] {
  if (bucket === "未处理") return "new";
  if (bucket === "推进池") return "negotiating";
  if (bucket === "跟进中" || bucket === "测试中") return "active";
  if (bucket === "淘汰池") return "rejected";
  return "watch";
}

function inferPriority(text: string, regionPriority: AssistantRegionPriority): AssistantPriority {
  if (/P0|马上|高优|强推|必须看|爆/i.test(text)) return "P0";
  if (regionPriority === "国内优先" || regionPriority === "海外-强数据") return "P1";
  if (regionPriority === "海外-高视觉") return "P2";
  return "P2";
}

function normalizePriority(value: string | null | undefined, regionPriority: AssistantRegionPriority): AssistantPriority {
  return priorityValues.includes(value as AssistantPriority) ? value as AssistantPriority : inferPriority("", regionPriority);
}

function inferBilibiliFit(text: string) {
  if (/二创|主播|UP|直播|挑战|教程|攻略|整活|梗|mod|多人/i.test(text)) return "有内容放大线索，适合进一步评估 B站传播点";
  return "待评估：线索助手录入，需要补充 B站适配判断";
}

function inferPriorityReason(text: string, regionPriority: AssistantRegionPriority) {
  if (/wishlist|愿望单|销量|在线|峰值|爆火|viral/i.test(text)) return "文本中出现公开强数据或热度异动信号";
  if (regionPriority === "国内优先") return "国内项目优先，值得进入未处理 inbox 复核";
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
      const source = item.source === "paste" ? "粘贴" : item.source === "camera" ? "拍照" : "上传";
      const name = item.name || `截图 ${index + 1}`;
      const size = typeof item.size === "number" ? formatBytes(item.size) : null;
      return [source, name, item.type, size].filter(Boolean).join(" / ");
    }).join("；")}`
    : "";
  return `线索助手输入：\n${body}${attachmentText}`.trim();
}

function openAiConfig(env: PagesContext["env"]) {
  const openAiEnv = env as PagesContext["env"] & { OPENAI_API_KEY?: string; OPENAI_VISION_MODEL?: string };
  return {
    apiKey: openAiEnv.OPENAI_API_KEY,
    model: openAiEnv.OPENAI_VISION_MODEL ?? defaultVisionModel
  };
}

function responseOutputText(payload: unknown) {
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;

  const chunks: string[] = [];
  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const itemRecord = item as Record<string, unknown>;
    const content = Array.isArray(itemRecord.content) ? itemRecord.content : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const partRecord = part as Record<string, unknown>;
      if (typeof partRecord.text === "string") chunks.push(partRecord.text);
      if (typeof partRecord.output_text === "string") chunks.push(partRecord.output_text);
    }
  }
  return chunks.join("\n");
}

function hasImageDataUrl(item: AttachmentMeta) {
  return typeof item.data_url === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(item.data_url);
}

function valueOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function steamAppIdFromLinks(links: string[]) {
  for (const link of links) {
    const match = link.match(/(?:store\.steampowered\.com|steamdb\.info)\/app\/(\d+)/i);
    if (match?.[1]) return match[1];
  }
  return null;
}

function normalizeContactType(type: string | null | undefined, value: string): ContactMethod["type"] {
  if (contactTypes.includes(type as ContactMethod["type"])) return type as ContactMethod["type"];
  const lower = value.toLowerCase();
  if (lower.includes("@")) return "Email";
  if (/\+?\d[\d\s-]{6,}/.test(value)) return "电话";
  if (lower.includes("steam")) return "Steam";
  if (lower.includes("discord")) return "Discord";
  if (lower.includes("bilibili") || lower.includes("b23.tv")) return "B站";
  if (lower.includes("twitter") || lower.includes("x.com")) return "X/Twitter";
  if (lower.startsWith("http")) return "官网";
  return "其他";
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

function dedupeContacts(values: ContactMethod[]) {
  const deduped = new Map<string, ContactMethod>();
  for (const value of values) deduped.set(`${value.type}:${value.value.toLowerCase()}`, value);
  return Array.from(deduped.values());
}

function firstValue(values: string[] | undefined) {
  return values?.find((value) => value.trim()) ?? null;
}

function steamGenres(details: SteamAppData | null) {
  const genres = (details?.genres ?? []).map((genre) => genre.description).filter((value): value is string => Boolean(value));
  return genres.join(" / ") || null;
}

function releaseWindowFromSteam(details: SteamAppData | null) {
  if (!details?.release_date) return null;
  if (details.release_date.coming_soon) return `即将推出${details.release_date.date ? `：${details.release_date.date}` : ""}`;
  return details.release_date.date ?? null;
}

function isHttpLink(value: string) {
  return /^https?:\/\//i.test(value);
}

function isGameStoreLink(value: string) {
  return /(?:store\.steampowered\.com|steamdb\.info)\/app\/\d+/i.test(value);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
