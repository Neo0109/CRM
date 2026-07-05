import {
  choosePreferredBilibiliSignal,
  deriveMediaDecisionFields,
  formatMediaGameplay,
  formatMediaProgress,
  normalizeMediaLinks as normalizeMediaLinksV63,
  steamAppIdFromLinks as steamAppIdFromLinksV63
} from "./sourcing_v6_3_quality.mjs";
import { normalizeDisplayText } from "./online_daily_v4_dedupe.mjs";
import { collectContactMethods, fetchAppDetails } from "./online_daily_v4_steam_source.mjs";
import { fetchOfficialBilibiliCandidates } from "./online_daily_v4_media_sources.mjs";
import { collectMediaContactMethods, isGenericMediaProjectName, isUnusableMediaProjectName } from "./online_daily_v4_media_entities.mjs";
import { daysUntil, mergeContactMethods, mergeLinks, normalizeReleaseDate, sleep } from "./online_daily_v4_source_utils.mjs";

export async function enrichMediaLeadsWithSteamContext(leads, context = {}) {
  const enriched = [];
  const chunkSize = context.mediaLeadEnrichChunkSize ?? 2;
  const sleepImpl = context.sleepImpl ?? sleep;
  for (let index = 0; index < leads.length; index += chunkSize) {
    const chunk = leads.slice(index, index + chunkSize);
    const results = await Promise.all(chunk.map((lead) => enrichMediaLeadWithSteamContext(lead, context)));
    enriched.push(...results);
    if (index + chunkSize < leads.length) await sleepImpl(600);
  }
  return enriched;
}

export async function enrichMediaLeadWithSteamContext(lead, context = {}) {
  const diagnostics = context.diagnostics ?? {};
  const officialLead = await enrichMediaLeadWithOfficialBilibiliContext(lead, context);
  if (!officialLead.steam_app_id) return finalizeMediaLeadDecisionFields(officialLead, null, context);

  const fetchAppDetailsImpl = context.fetchAppDetailsImpl ?? ((appId) => fetchAppDetails(appId, context));
  const collectContactMethodsImpl = context.collectContactMethodsImpl ?? ((details, appId) => collectContactMethods(details, appId, context));
  const details = await fetchAppDetailsImpl(officialLead.steam_app_id);
  const releaseDate = normalizeReleaseDate(details?.release_date?.date ?? officialLead.release_window);
  const daysToRelease = daysUntil(releaseDate, context.reportDate);
  const alreadyReleased = typeof daysToRelease === "number" && daysToRelease < 0 && !details?.release_date?.coming_soon;
  const steamLinks = [
    `https://store.steampowered.com/app/${officialLead.steam_app_id}/`,
    `https://steamdb.info/app/${officialLead.steam_app_id}/`,
    details?.website
  ].filter(Boolean);
  const steamContacts = details ? await collectContactMethodsImpl(details, officialLead.steam_app_id) : [];
  const steamName = normalizeDisplayText(details?.name);
  const project = steamName && shouldPreferSteamName(officialLead.project) ? steamName : officialLead.project;
  const nextLead = {
    ...officialLead,
    project,
    team: officialLead.team ?? details?.developers?.[0] ?? null,
    publisher_name: officialLead.publisher_name ?? details?.publishers?.[0] ?? null,
    publisher_status: details?.publishers?.length
      ? `${details.publishers.join(" / ")}；B站线索已补 Steam 交叉验证`
      : officialLead.publisher_status,
    release_window: releaseDate ?? officialLead.release_window,
    links: mergeLinks([...(officialLead.links ?? []), ...steamLinks]),
    contact_methods: mergeContactMethods([...(officialLead.contact_methods ?? []), ...steamContacts])
  };
  nextLead.contact = nextLead.contact_methods.map((method) => `${method.type}: ${method.value}`).join("；") || null;

  if (alreadyReleased) {
    diagnostics.media_released_routed_to_drop = (diagnostics.media_released_routed_to_drop ?? 0) + 1;
    return mediaLeadToDrop(finalizeMediaLeadDecisionFields(nextLead, details, context), `B站/媒体线索补到 Steam AppID ${officialLead.steam_app_id} 后交叉验证：Steam 页面显示已发售约${Math.abs(daysToRelease)}天，不符合前置BD窗口`);
  }

  return finalizeMediaLeadDecisionFields(nextLead, details, context);
}

export function shouldPreferSteamName(project) {
  const text = normalizeDisplayText(project);
  if (isUnusableMediaProjectName(text)) return true;
  if (isGenericMediaProjectName(text)) return true;
  return /国产|独立游戏|试玩|实机|pv|demo|公开测试|商店页|愿望单|即将发售/i.test(text);
}

export async function enrichMediaLeadWithOfficialBilibiliContext(lead, context = {}) {
  const diagnostics = context.diagnostics ?? {};
  const maxOfficialLookups = context.maxOfficialLookups ?? 12;
  if (!lead._mediaItem || !/bilibili|b站/i.test(`${lead._mediaItem.source ?? ""} ${lead._mediaItem.link ?? ""}`)) return lead;
  if ((diagnostics.bilibili_official_source_lookups ?? 0) >= maxOfficialLookups) return lead;
  diagnostics.bilibili_official_source_lookups = (diagnostics.bilibili_official_source_lookups ?? 0) + 1;

  const officialCandidates = await (context.fetchOfficialBilibiliCandidatesImpl ?? fetchOfficialBilibiliCandidates)(lead.project, context);
  const preferred = choosePreferredBilibiliSignal(lead._mediaItem, officialCandidates, lead.project);
  if (!preferred || preferred.link === lead._mediaItem.link) return lead;

  diagnostics.bilibili_official_source_hits = (diagnostics.bilibili_official_source_hits ?? 0) + 1;
  const officialText = `${preferred.title} ${preferred.summary} ${preferred.source} ${preferred.link}`;
  const officialLinks = normalizeMediaLinksV63([preferred.link, officialText]);
  const officialSteamAppId = steamAppIdFromLinksV63(officialLinks);
  if (officialSteamAppId && officialSteamAppId !== lead.steam_app_id) diagnostics.media_steam_appids_extracted = (diagnostics.media_steam_appids_extracted ?? 0) + 1;

  return {
    ...lead,
    _mediaItem: preferred,
    _originalMediaItem: lead._mediaItem,
    _officialSourceMatched: true,
    steam_app_id: officialSteamAppId ?? lead.steam_app_id,
    links: mergeLinks([...(lead.links ?? []), ...officialLinks]),
    public_signals: `${preferred.source} / ${preferred.link}`,
    contact_methods: mergeContactMethods([
      ...(lead.contact_methods ?? []),
      ...collectMediaContactMethods(preferred, preferred.link, officialLinks)
    ])
  };
}

export function finalizeMediaLeadDecisionFields(lead, details, context = {}) {
  const reportDate = context.reportDate ?? new Date().toISOString().slice(0, 10);
  const sourceText = `${lead._mediaItem?.title ?? ""} ${lead._mediaItem?.summary ?? ""} ${lead.progress ?? ""}`;
  const progress = formatMediaProgress({ details, sourceText, reportDate });
  const gameplay = formatMediaGameplay({
    title: lead.project,
    summary: sourceText,
    genre: lead.genre,
    details
  });
  const releaseDate = normalizeReleaseDate(details?.release_date?.date ?? lead.release_window);
  const daysToRelease = daysUntil(releaseDate, reportDate);
  const alreadyReleased = progress === "正式上线" || (typeof daysToRelease === "number" && daysToRelease < 0 && !details?.release_date?.coming_soon);
  const fields = deriveMediaDecisionFields({
    title: lead.project,
    source: lead._mediaItem?.source ?? lead.public_signals?.split(" / ")[0] ?? "媒体/B站",
    confidence: lead._confidence ?? "strict",
    score: lead.media_score ?? 0,
    steamAppId: lead.steam_app_id,
    progress,
    gameplay,
    alreadyReleased,
    officialSourceMatched: Boolean(lead._officialSourceMatched)
  });
  return {
    ...lead,
    genre: gameplay,
    gameplay,
    progress,
    release_window: releaseDate ?? lead.release_window,
    priority_reason: fields.priority_reason,
    rule_fit: fields.rule_fit,
    bilibili_fit: fields.bilibili_fit,
    amplification: fields.amplification,
    risks: fields.risks,
    verdict: fields.verdict,
    next_action: fields.next_action,
    notes: fields.notes
  };
}

export function mediaLeadToDrop(lead, reason) {
  return {
    ...lead,
    _class: "drop",
    bucket: "淘汰池",
    stage: "rejected",
    priority: "P3",
    priority_reason: reason,
    rule_fit: `${lead.rule_fit ?? ""}；${reason}`.replace(/^；/, ""),
    risks: reason,
    verdict: `${reason}。不进入未处理 review，除非后续明确要求做上线后复盘。`,
    next_action: null,
    notes: null
  };
}
