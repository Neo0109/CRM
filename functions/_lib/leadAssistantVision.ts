import type { Env } from "./crm";
import type { AiExtractionResult, AttachmentMeta } from "./leadAssistantModel";

const openAiResponsesUrl = "https://api.openai.com/v1/responses";
const defaultVisionModel = "gpt-4.1-mini";

export async function extractLeadsWithVision(env: Env, text: string, attachments: AttachmentMeta[]): Promise<AiExtractionResult> {
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

function openAiConfig(env: Env) {
  const openAiEnv = env as Env & { OPENAI_API_KEY?: string; OPENAI_VISION_MODEL?: string };
  return {
    apiKey: openAiEnv.OPENAI_API_KEY,
    model: openAiEnv.OPENAI_VISION_MODEL ?? defaultVisionModel
  };
}

export function responseOutputText(payload: unknown) {
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

export function hasImageDataUrl(item: AttachmentMeta) {
  return typeof item.data_url === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(item.data_url);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
