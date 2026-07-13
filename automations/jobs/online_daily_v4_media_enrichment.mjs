import {
  choosePreferredBilibiliSignal,
  deriveMediaDecisionFields,
  formatMediaGameplay,
  formatMediaProgress
} from "./sourcing_v6_3_quality.mjs";
import { enforceLeadSteamEvidence, extractBilibiliEvidence } from "./bilibili_evidence.mjs";
import { normalizeDisplayText } from "./online_daily_v4_dedupe.mjs";
import { collectContactMethods, fetchAppDetails, fetchSteamSearch } from "./online_daily_v4_steam_source.mjs";
import { fetchOfficialBilibiliCandidates } from "./online_daily_v4_media_sources.mjs";
import { collectMediaContactMethods, isGenericMediaProjectName, isUnusableMediaProjectName } from "./online_daily_v4_media_entities.mjs";
import {
  daysUntil,
  hasMaturePublisher,
  mergeContactMethods,
  mergeLinks,
  normalizeReleaseDate,
  sleep
} from "./online_daily_v4_source_utils.mjs";

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
  let verifiedLead = await enrichMediaLeadWithOfficialBilibiliContext(lead, context);
  verifiedLead = await enrichMediaLeadWithExactSteamTitle(verifiedLead, context);
  if (!verifiedLead.steam_app_id) return finalizeMediaLeadDecisionFields(verifiedLead, null, context);

  const resolution = await resolveSteamEntity(verifiedLead.steam_app_id, context);
  const canonicalAppId = resolution.canonical_app_id ?? verifiedLead.steam_app_id;
  const details = resolution.details;
  const releaseDate = resolution.demo_only
    ? verifiedLead.release_window
    : normalizeReleaseDate(details?.release_date?.date ?? verifiedLead.release_window);
  const daysToRelease = daysUntil(releaseDate, context.reportDate);
  const alreadyReleased = !resolution.demo_only
    && typeof daysToRelease === "number"
    && daysToRelease < 0
    && !details?.release_date?.coming_soon;
  const releaseTooSoon = !resolution.demo_only
    && typeof daysToRelease === "number"
    && daysToRelease >= 0
    && daysToRelease < 60;
  const publishers = Array.isArray(details?.publishers) ? details.publishers : [];
  const publisherOccupied = hasMaturePublisher(publishers);
  const steamLinks = [
    "https://store.steampowered.com/app/" + canonicalAppId + "/",
    "https://steamdb.info/app/" + canonicalAppId + "/",
    resolution.evidence_app_id !== canonicalAppId
      ? "https://store.steampowered.com/app/" + resolution.evidence_app_id + "/"
      : null,
    resolution.evidence_app_id !== canonicalAppId
      ? "https://steamdb.info/app/" + resolution.evidence_app_id + "/"
      : null,
    details?.website
  ].filter(Boolean);
  const collectContactMethodsImpl = context.collectContactMethodsImpl
    ?? ((nextDetails, appId) => collectContactMethods(nextDetails, appId, context));
  const steamContacts = details ? await collectContactMethodsImpl(details, canonicalAppId) : [];
  const steamName = normalizeDisplayText(details?.name);
  const project = steamName && shouldPreferSteamName(verifiedLead.project) ? steamName : verifiedLead.project;
  const nextLead = {
    ...verifiedLead,
    project,
    steam_app_id: canonicalAppId,
    _steamEntityResolution: resolution,
    _mediaDisposition: "lead_candidate",
    team: verifiedLead.team ?? details?.developers?.[0] ?? null,
    publisher_name: verifiedLead.publisher_name ?? publishers[0] ?? null,
    publisher_status: publishers.length
      ? publishers.join(" / ") + "；B站/媒体线索已补 Steam 交叉验证"
      : verifiedLead.publisher_status,
    release_window: releaseDate ?? verifiedLead.release_window,
    links: mergeLinks([...(verifiedLead.links ?? []), ...steamLinks]),
    contact_methods: mergeContactMethods([...(verifiedLead.contact_methods ?? []), ...steamContacts])
  };
  nextLead.contact = nextLead.contact_methods.map((method) => method.type + ": " + method.value).join("；") || null;

  const finalized = finalizeMediaLeadDecisionFields(nextLead, details, context);
  if (alreadyReleased) {
    diagnostics.media_released_routed_to_drop = (diagnostics.media_released_routed_to_drop ?? 0) + 1;
    return mediaLeadToDrop(
      finalized,
      "B站/媒体线索补到 Steam AppID " + canonicalAppId + " 后交叉验证：Steam 页面显示已发售约" + Math.abs(daysToRelease) + "天，不符合前置BD窗口",
      { disposition: "radar_only" }
    );
  }
  if (publisherOccupied) {
    diagnostics.media_publisher_occupied_routed_to_radar = (diagnostics.media_publisher_occupied_routed_to_radar ?? 0) + 1;
    return mediaLeadToDrop(
      finalized,
      "Steam 交叉验证显示已有成熟发行商占位（" + publishers.join(" / ") + "），只保留行业雷达，不创建新 Lead",
      { disposition: "radar_only" }
    );
  }
  if (releaseTooSoon) {
    return mediaLeadToDrop(
      finalized,
      "B站/媒体线索补到 Steam AppID " + canonicalAppId + " 后交叉验证：距发售不足60天，合作窗口不合适",
      { disposition: "reject" }
    );
  }
  return finalized;
}

export async function resolveSteamEntity(appId, context = {}) {
  const fetchAppDetailsImpl = context.fetchAppDetailsImpl
    ?? ((nextAppId) => fetchAppDetails(nextAppId, { ...context, acceptedAppTypes: ["game", "demo"] }));
  const evidenceAppId = String(appId);
  const evidenceDetails = await fetchAppDetailsImpl(evidenceAppId);
  const parentAppId = evidenceDetails?.type === "demo"
    ? String(evidenceDetails?.fullgame?.appid ?? "")
    : "";

  if (parentAppId && /^\d+$/.test(parentAppId)) {
    const parentDetails = await fetchAppDetailsImpl(parentAppId);
    if (parentDetails) {
      const diagnostics = context.diagnostics ?? {};
      diagnostics.media_demo_parent_resolutions = (diagnostics.media_demo_parent_resolutions ?? 0) + 1;
      return {
        evidence_app_id: evidenceAppId,
        canonical_app_id: parentAppId,
        relation: "demo_of",
        demo_available: true,
        demo_only: false,
        evidence_details: evidenceDetails,
        details: parentDetails
      };
    }
  }

  return {
    evidence_app_id: evidenceAppId,
    canonical_app_id: evidenceAppId,
    relation: evidenceDetails?.type === "demo" ? "unresolved_demo" : "self",
    demo_available: evidenceDetails?.type === "demo" || Boolean(evidenceDetails?.demos?.length),
    demo_only: evidenceDetails?.type === "demo",
    evidence_details: evidenceDetails,
    details: evidenceDetails
  };
}

export async function enrichMediaLeadWithExactSteamTitle(lead, context = {}) {
  if (!shouldLookupSteamExactTitle(lead)) return lead;
  const diagnostics = context.diagnostics ?? {};
  const maxLookups = context.maxExactSteamLookups ?? 12;
  if ((diagnostics.media_exact_steam_lookup_attempts ?? 0) >= maxLookups) return lead;

  const cache = context.steamExactTitleCache ?? (context.steamExactTitleCache = new Map());
  const cacheKey = normalizeExactTitle(lead.project);
  let candidates;
  if (cache.has(cacheKey)) {
    candidates = cache.get(cacheKey);
  } else {
    diagnostics.media_exact_steam_lookup_attempts = (diagnostics.media_exact_steam_lookup_attempts ?? 0) + 1;
    const fetchCandidatesImpl = context.fetchSteamExactTitleCandidatesImpl
      ?? ((project) => fetchSteamSearch("", "Steam exact-title verification", [], {
        ...context,
        query: project,
        cc: "cn",
        l: "schinese"
      }));
    candidates = await fetchCandidatesImpl(lead.project);
    cache.set(cacheKey, Array.isArray(candidates) ? candidates : []);
  }

  const match = chooseExactSteamTitleCandidate(lead.project, candidates);
  if (!match?.appId) return lead;
  diagnostics.media_exact_steam_lookup_hits = (diagnostics.media_exact_steam_lookup_hits ?? 0) + 1;
  return {
    ...lead,
    steam_app_id: String(match.appId),
    _steamTitleLookupMatched: true,
    links: mergeLinks([
      ...(lead.links ?? []),
      "https://store.steampowered.com/app/" + match.appId + "/",
      "https://steamdb.info/app/" + match.appId + "/"
    ])
  };
}

export function chooseExactSteamTitleCandidate(project, candidates = []) {
  const projectKey = normalizeExactTitle(project);
  if (!projectKey) return null;
  const valid = candidates.filter((candidate) => /^\d+$/.test(String(candidate?.appId ?? "")));
  const exact = valid.filter((candidate) => normalizeExactTitle(candidate.title) === projectKey);
  return exact.length === 1 ? exact[0] : null;
}

export function shouldLookupSteamExactTitle(lead) {
  if (lead?.steam_app_id) return false;
  const project = normalizeDisplayText(lead?.project);
  if (!project || project.length < 2 || project.length > 48) return false;
  if (isUnusableMediaProjectName(project) || isGenericMediaProjectName(project)) return false;
  if ((lead?.media_score ?? 0) < 52) return false;
  const title = String(lead?._mediaItem?.title ?? "");
  return /《[^》]{2,48}》/.test(title) || Boolean(lead?._officialSourceMatched);
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
  if (!lead._mediaItem || !/bilibili|b站/i.test(String(lead._mediaItem.source ?? "") + " " + String(lead._mediaItem.link ?? ""))) return lead;
  if ((diagnostics.bilibili_official_source_lookups ?? 0) >= maxOfficialLookups) return lead;
  diagnostics.bilibili_official_source_lookups = (diagnostics.bilibili_official_source_lookups ?? 0) + 1;

  const officialCandidates = await (context.fetchOfficialBilibiliCandidatesImpl ?? fetchOfficialBilibiliCandidates)(lead.project, context);
  const preferred = choosePreferredBilibiliSignal(lead._mediaItem, officialCandidates, lead.project);
  if (!preferred || preferred.link === lead._mediaItem.link) return lead;

  diagnostics.bilibili_official_source_hits = (diagnostics.bilibili_official_source_hits ?? 0) + 1;
  const officialEvidence = extractBilibiliEvidence(preferred);
  const priorEvidence = lead._bilibiliEvidence ?? extractBilibiliEvidence(lead._mediaItem ?? {});
  const evidence = extractBilibiliEvidence({
    ...preferred,
    bilibili_evidence: {
      ...officialEvidence,
      source_urls: [...(officialEvidence.source_urls ?? []), ...(priorEvidence.source_urls ?? [])],
      urls: [...(officialEvidence.urls ?? []), ...(priorEvidence.urls ?? [])],
      steam_app_ids: [...(officialEvidence.steam_app_ids ?? []), ...(priorEvidence.steam_app_ids ?? [])],
      emails: [...(officialEvidence.emails ?? []), ...(priorEvidence.emails ?? [])]
    }
  }, [
    ...(priorEvidence.website_urls ?? []),
    ...(priorEvidence.contact_urls ?? [])
  ]);
  const officialSteamAppId = officialEvidence.steam_app_id;
  const priorSteamAppId = priorEvidence.steam_app_id;
  if (officialSteamAppId) {
    if (officialSteamAppId !== lead.steam_app_id) {
      diagnostics.media_steam_appids_extracted = (diagnostics.media_steam_appids_extracted ?? 0) + 1;
    }
    const newEvidenceSourceCount = Math.max(
      1,
      (officialEvidence.source_urls ?? []).filter((url) => !(priorEvidence.source_urls ?? []).includes(url)).length
    );
    diagnostics.steam_links_detected = (diagnostics.steam_links_detected ?? 0) + newEvidenceSourceCount;
    if (priorSteamAppId === officialSteamAppId) {
      diagnostics.steam_evidence_duplicate_merged = (diagnostics.steam_evidence_duplicate_merged ?? 0) + newEvidenceSourceCount;
    }
  }

  return {
    ...lead,
    _mediaItem: { ...preferred, bilibili_evidence: evidence },
    _originalMediaItem: lead._mediaItem,
    _officialSourceMatched: true,
    _bilibiliEvidence: evidence,
    _steamEvidencePrimary: evidence.steam_app_id ? 1 : lead._steamEvidencePrimary,
    steam_app_id: evidence.steam_app_id ?? lead.steam_app_id,
    links: mergeLinks([...(lead.links ?? []), ...(evidence.urls ?? []), ...(evidence.source_urls ?? [])]),
    public_signals: String(preferred.source) + " / " + String(preferred.link),
    contact_methods: mergeContactMethods([
      ...(lead.contact_methods ?? []),
      ...collectMediaContactMethods(preferred, preferred.link, evidence.urls ?? [])
    ])
  };
}

export function finalizeMediaLeadDecisionFields(lead, details, context = {}) {
  const reportDate = context.reportDate ?? new Date().toISOString().slice(0, 10);
  const sourceText = String(lead._mediaItem?.title ?? "") + " " + String(lead._mediaItem?.summary ?? "") + " " + String(lead.progress ?? "");
  const resolution = lead._steamEntityResolution ?? null;
  const progress = formatMediaProgress({
    details,
    sourceText,
    reportDate,
    demoAvailable: Boolean(resolution?.demo_available),
    demoParentResolved: resolution?.relation === "demo_of"
  });
  const gameplay = formatMediaGameplay({
    title: lead.project,
    summary: sourceText,
    genre: lead.genre,
    details
  });
  const releaseDate = resolution?.demo_only
    ? lead.release_window
    : normalizeReleaseDate(details?.release_date?.date ?? lead.release_window);
  const daysToRelease = daysUntil(releaseDate, reportDate);
  const alreadyReleased = !resolution?.demo_only
    && (progress === "正式上线" || (typeof daysToRelease === "number" && daysToRelease < 0 && !details?.release_date?.coming_soon));
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
    priority_reason: null,
    rule_fit: fields.rule_fit,
    bilibili_fit: fields.bilibili_fit,
    amplification: fields.amplification,
    risks: fields.risks,
    verdict: fields.verdict,
    next_action: fields.next_action,
    notes: fields.notes
  };
}

export function mediaLeadToDrop(lead, reason, options = {}) {
  return {
    ...lead,
    _class: "drop",
    _mediaDisposition: options.disposition ?? "reject",
    bucket: "淘汰池",
    stage: "rejected",
    priority: "P3",
    drop_reason: dropReasonLabel(reason),
    priority_reason: null,
    rule_fit: String(lead.rule_fit ?? "") + (lead.rule_fit ? "；" : "") + reason,
    risks: reason,
    verdict: reason + "。不进入未处理 review，除非后续明确要求做上线后复盘。",
    next_action: null,
    notes: null
  };
}

function dropReasonLabel(reason) {
  if (/不足60天|窗口不合适/.test(reason)) return "窗口不合适";
  if (/已发售|正式上线|已上线/.test(reason)) return "已上线";
  if (/发行商占位/.test(reason)) return "已有发行";
  return null;
}

function normalizeExactTitle(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[\s"'“”‘’《》【】()[\]{}:：·._-]+/g, "")
    .trim();
}

export { enforceLeadSteamEvidence };
