import { json, mergeIncomingLeads, requireAccess, todayInShanghai, type PagesContext } from "../_lib/crm";
import {
  buildAiLead,
  buildManualLead,
  buildSteamLead,
  extractLeadAssistantSignals,
  normalizeAssistantInput,
  type AssistantLead,
  type LeadAssistantPayload
} from "../_lib/leadAssistantModel";
import { fetchSteamAppDetails } from "../_lib/leadAssistantSteam";
import { extractLeadsWithVision } from "../_lib/leadAssistantVision";

export const onRequestPost = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  try {
    const payload = await request.json() as LeadAssistantPayload;
    const { attachments, imageAttachments, text } = normalizeAssistantInput(payload);

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
      const signals = extractLeadAssistantSignals(text);
      for (const steamAppId of signals.steamAppIds) {
        const details = await fetchSteamAppDetails(steamAppId);
        if (details?.type && details.type !== "game") {
          skipped.push(`${steamAppId}: ${details.type}`);
          continue;
        }
        leads.push(buildSteamLead({
          steamAppId,
          details,
          text,
          links: signals.links,
          contacts: signals.contacts,
          attachments,
          today
        }));
      }

      if (!leads.length && !imageAttachments.length && text) {
        leads.push(buildManualLead({
          text,
          links: signals.links,
          contacts: signals.contacts,
          attachments,
          today
        }));
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
