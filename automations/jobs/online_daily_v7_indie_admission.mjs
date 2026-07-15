import { normalizeDisplayText, normalizeText, normalizeUrl } from "./online_daily_v4_dedupe.mjs";

export const INDIE_PRELAUNCH_RULE_VERSION = "sourcing-rules-v7.0-quality-gated-indie";

export const INDIE_PRELAUNCH_GATE_IDS = [
  "identity_and_dedupe",
  "prelaunch_window",
  "publisher_china_capacity_clear",
  "non_narrative_product",
  "non_india_team",
  "official_demo_or_playtest",
  "official_gameplay",
  "independent_quality_proof",
  "non_steam_business_entry",
  "concrete_china_bilibili_value",
  "overseas_china_demand"
];

const hardExclusionGates = new Set([
  "prelaunch_window",
  "publisher_china_capacity_clear",
  "non_narrative_product",
  "non_india_team"
]);

export function evaluateIndiePrelaunchAdmission(input = {}) {
  const evidence = normalizeAdmissionEvidence(input);
  const gateResults = [
    identityGate(evidence),
    prelaunchGate(evidence),
    stateGate(
      "publisher_china_capacity_clear",
      evidence.publisher_occupancy,
      "clear",
      "occupied",
      "mature publisher or China-capability occupancy is present"
    ),
    stateGate(
      "non_narrative_product",
      evidence.narrative_state,
      "no",
      "yes",
      "product is narrative-led"
    ),
    stateGate(
      "non_india_team",
      evidence.india_team_state,
      "no",
      "yes",
      "India-led team is confirmed"
    ),
    collectionGate("official_demo_or_playtest", evidence.official_demo_evidence),
    collectionGate("official_gameplay", evidence.official_gameplay_evidence),
    collectionGate("independent_quality_proof", evidence.quality_proofs),
    businessEntrypointGate(evidence.business_entrypoints),
    textGate("concrete_china_bilibili_value", evidence.china_bilibili_value),
    overseasChinaDemandGate(evidence)
  ];
  const failed = gateResults.filter((gate) => gate.status === "fail" || gate.status === "unknown");
  const qualified = failed.length === 0;
  const hardFailure = failed.some((gate) => gate.status === "fail" && hardExclusionGates.has(gate.id));

  return {
    qualified,
    disposition: qualified ? "formal" : hardFailure ? "excluded" : "candidate",
    sourcing_lane: "indie_prelaunch",
    sourcing_rule_version: INDIE_PRELAUNCH_RULE_VERSION,
    evidence,
    gate_results: gateResults,
    failed_gates: failed.map((gate) => gate.id),
    matched_rules: [
      ...gateResults
        .filter((gate) => gate.status === "pass" || gate.status === "not_applicable")
        .map((gate) => `v7_indie/${gate.id}`),
      qualified ? "v7_indie/qualified" : null
    ].filter(Boolean),
    missing_evidence: failed.filter((gate) => gate.status === "unknown").map((gate) => gate.id),
    exclusion_reasons: failed.filter((gate) => gate.status === "fail").map((gate) => gate.reason)
  };
}

export function evaluateSteamIndiePrelaunchAdmission(candidate = {}) {
  return evaluateIndiePrelaunchAdmission(steamIndieAdmissionEvidence(candidate));
}

export function evaluateMediaIndiePrelaunchAdmission(lead = {}) {
  return evaluateIndiePrelaunchAdmission(mediaIndieAdmissionEvidence(lead));
}

export function steamIndieAdmissionEvidence(candidate = {}) {
  const project = normalizeDisplayText(candidate.title ?? candidate.project);
  const steamAppId = numericString(candidate.appId ?? candidate.steam_app_id);
  const hasDetails = candidate.hasDetails === true;
  const derived = {
    project,
    steam_app_id: steamAppId,
    dedupe_key: candidateDedupeKey({ project, steam_app_id: steamAppId }),
    region: normalizeRegion(candidate.region ?? candidate.country),
    release_state: candidate.alreadyReleased === true
      ? "released"
      : hasDetails || candidate.comingSoon === true
        ? "prelaunch"
        : "unknown",
    release_window: releaseWindowState(candidate),
    early_access_state: hasDetails ? (candidate.earlyAccess === true ? "yes" : "no") : "unknown",
    publisher_occupancy: hasDetails ? (candidate.publisherOccupied === true ? "occupied" : "clear") : "unknown",
    narrative_state: hasDetails ? (candidate.narrativeHeavy === true ? "yes" : "no") : "unknown",
    india_team_state: hasDetails ? (candidate.indiaTeam === true ? "yes" : "no") : "unknown",
    official_demo_evidence: normalizeEvidenceList(candidate.officialDemoEvidence ?? candidate.official_demo_evidence),
    official_gameplay_evidence: normalizeEvidenceList(candidate.officialGameplayEvidence ?? candidate.official_gameplay_evidence),
    quality_proofs: normalizeEvidenceList(candidate.qualityProofs ?? candidate.quality_proofs),
    business_entrypoints: nonSteamBusinessEntrypoints(candidate.contactMethods ?? candidate.contact_methods),
    china_bilibili_value: cleanEvidenceText(candidate.chinaBilibiliValue ?? candidate.china_bilibili_value)
      ?? deriveConcreteChinaBilibiliValue(`${(candidate.genres ?? []).join(" ")} ${(candidate.categories ?? []).join(" ")}`),
    china_demand: cleanEvidenceText(candidate.chinaDemandEvidence ?? candidate.china_demand)
  };
  if (!derived.quality_proofs.length && candidate.strongData === true) {
    derived.quality_proofs = [{
      type: "verified_public_data",
      value: candidate.recommendationCount > 0
        ? `${candidate.recommendationCount} Steam recommendations`
        : normalizeDisplayText(candidate.reviewText) || "verified strong public signal",
      url: candidate.storeUrl ?? null
    }];
  }
  return mergeExplicitEvidence(derived, candidate._indieAdmissionEvidence);
}

export function mediaIndieAdmissionEvidence(lead = {}) {
  const details = lead?._steamEntityResolution?.details ?? null;
  const resolution = lead?._steamEntityResolution ?? null;
  const project = normalizeDisplayText(lead.project ?? lead.title);
  const steamAppId = numericString(lead.steam_app_id ?? lead.appId);
  const sourceText = [
    lead?._mediaItem?.title,
    lead?._mediaItem?.summary,
    lead.progress,
    details?.name,
    details?.short_description,
    ...(details?.genres ?? []).map((item) => item?.description),
    ...(details?.categories ?? []).map((item) => item?.description)
  ].filter(Boolean).join(" ");
  const alreadyReleased = lead._class === "drop" && /已发售|正式上线|已上线/i.test(`${lead.risks ?? ""} ${lead.verdict ?? ""}`);
  const earlyAccess = /early access|抢先体验|\bEA\b/i.test(sourceText);
  const narrative = /visual novel|interactive fiction|story rich|walking simulator|视觉小说|文字冒险|互动小说|剧情向|叙事/i.test(sourceText);
  const indiaTeam = /india|indian studio|bengaluru|bangalore|mumbai|pune|hyderabad|chennai/i.test(sourceText);
  const publisherOccupied = lead.china_capability_occupied === true
    || (lead._class === "drop" && /成熟发行商|发行商占位/i.test(`${lead.risks ?? ""} ${lead.verdict ?? ""}`));
  const derived = {
    project,
    steam_app_id: steamAppId,
    dedupe_key: candidateDedupeKey({ project, steam_app_id: steamAppId }),
    region: normalizeRegion(lead.region ?? lead.country),
    release_state: alreadyReleased ? "released" : details || /即将发售|Demo 可玩|试玩 Demo/i.test(lead.progress ?? "") ? "prelaunch" : "unknown",
    release_window: mediaReleaseWindowState(lead, details),
    early_access_state: details ? (earlyAccess ? "yes" : "no") : "unknown",
    publisher_occupancy: details ? (publisherOccupied ? "occupied" : "clear") : "unknown",
    narrative_state: details ? (narrative ? "yes" : "no") : "unknown",
    india_team_state: details ? (indiaTeam ? "yes" : "no") : "unknown",
    official_demo_evidence: resolution?.demo_available === true
      ? [{ type: "steam_demo", url: steamAppId ? `https://store.steampowered.com/app/${steamAppId}/` : null }]
      : [],
    official_gameplay_evidence: officialGameplayEvidence({
      details,
      officialSourceMatched: lead._officialSourceMatched === true,
      sourceItem: lead._mediaItem
    }),
    quality_proofs: publicQualityProofs(details, steamAppId),
    business_entrypoints: nonSteamBusinessEntrypoints(lead.contact_methods, {
      officialBilibili: lead._officialSourceMatched === true
    }),
    china_bilibili_value: cleanEvidenceText(lead.chinaBilibiliValue ?? lead.china_bilibili_value)
      ?? deriveConcreteChinaBilibiliValue(`${lead.gameplay ?? ""} ${sourceText}`),
    china_demand: cleanEvidenceText(lead.chinaDemandEvidence ?? lead.china_demand)
  };
  return mergeExplicitEvidence(derived, lead._indieAdmissionEvidence);
}

export function candidateDedupeKey(value = {}) {
  const appId = numericString(value.steam_app_id ?? value.appId);
  if (appId) return `steam:${appId}`;
  const project = normalizeText(value.project ?? value.title);
  return project ? `project:${project}` : null;
}

export function deriveConcreteChinaBilibiliValue(value) {
  const text = String(value ?? "");
  if (/co-op|multiplayer|合作|多人/i.test(text)) {
    return "多人协作循环可形成主播组队、挑战局和高密度切片，并以简中社区运营承接B站反馈。";
  }
  if (/strategy|simulation|management|automation|city builder|tower defense|factory|策略|模拟|经营|自动化|城市|塔防|工厂/i.test(text)) {
    return "系统型玩法可形成机制讲解、效率挑战和长期栏目，并以简中本地化承接B站社区反馈。";
  }
  if (/roguelike|deckbuilder|card game|tactical|肉鸽|卡牌|构筑|战棋/i.test(text)) {
    return "构筑与局内选择可形成流派复盘、挑战路线和UP主栏目，并以简中内容验证中国用户反馈。";
  }
  return null;
}

function normalizeAdmissionEvidence(input) {
  return {
    project: normalizeDisplayText(input.project ?? input.title),
    steam_app_id: numericString(input.steam_app_id ?? input.appId),
    dedupe_key: cleanEvidenceText(input.dedupe_key) ?? candidateDedupeKey(input),
    region: normalizeRegion(input.region),
    release_state: enumState(input.release_state, ["prelaunch", "released", "unknown"]),
    release_window: enumState(input.release_window, ["over_60", "tba", "too_soon", "unknown"]),
    early_access_state: yesNoUnknown(input.early_access_state),
    publisher_occupancy: enumState(input.publisher_occupancy, ["clear", "occupied", "unknown"]),
    narrative_state: yesNoUnknown(input.narrative_state),
    india_team_state: yesNoUnknown(input.india_team_state),
    official_demo_evidence: normalizeEvidenceList(input.official_demo_evidence),
    official_gameplay_evidence: normalizeEvidenceList(input.official_gameplay_evidence),
    quality_proofs: normalizeEvidenceList(input.quality_proofs),
    business_entrypoints: normalizeEvidenceList(input.business_entrypoints),
    china_bilibili_value: cleanEvidenceText(input.china_bilibili_value),
    china_demand: cleanEvidenceText(input.china_demand)
  };
}

function mergeExplicitEvidence(derived, explicit) {
  if (!explicit || typeof explicit !== "object" || Array.isArray(explicit)) return normalizeAdmissionEvidence(derived);
  return normalizeAdmissionEvidence({ ...derived, ...explicit });
}

function identityGate(evidence) {
  const project = normalizeText(evidence.project);
  const key = cleanEvidenceText(evidence.dedupe_key);
  if (!project || !key) return unknownGate("identity_and_dedupe", "normalized project identity and dedupe key are required");
  return passGate("identity_and_dedupe");
}

function prelaunchGate(evidence) {
  if (evidence.release_state === "released") return failGate("prelaunch_window", "released product is not eligible for indie_prelaunch");
  if (evidence.early_access_state === "yes") return failGate("prelaunch_window", "Early Access product is not eligible for indie_prelaunch");
  if (evidence.release_window === "too_soon") return failGate("prelaunch_window", "confirmed release window is 60 days or fewer");
  if (
    evidence.release_state === "prelaunch"
    && evidence.early_access_state === "no"
    && (evidence.release_window === "over_60" || evidence.release_window === "tba")
  ) return passGate("prelaunch_window");
  return unknownGate("prelaunch_window", "pre-release, non-EA, and over-60-day or TBA window evidence is required");
}

function stateGate(id, state, passState, failState, failureReason) {
  if (state === passState) return passGate(id);
  if (state === failState) return failGate(id, failureReason);
  return unknownGate(id, `${id} evidence is required`);
}

function collectionGate(id, values) {
  return Array.isArray(values) && values.length ? passGate(id) : unknownGate(id, `${id} evidence is required`);
}

function businessEntrypointGate(values) {
  const valid = nonSteamBusinessEntrypoints(values);
  return valid.length
    ? passGate("non_steam_business_entry")
    : unknownGate("non_steam_business_entry", "a non-Steam business entrypoint is required");
}

function textGate(id, value) {
  return cleanEvidenceText(value) ? passGate(id) : unknownGate(id, `${id} evidence is required`);
}

function overseasChinaDemandGate(evidence) {
  if (evidence.region === "domestic") return notApplicableGate("overseas_china_demand");
  if (evidence.region === "overseas" && cleanEvidenceText(evidence.china_demand)) return passGate("overseas_china_demand");
  return unknownGate("overseas_china_demand", "overseas projects require explicit China demand");
}

function passGate(id) {
  return { id, status: "pass", reason: null };
}

function failGate(id, reason) {
  return { id, status: "fail", reason };
}

function unknownGate(id, reason) {
  return { id, status: "unknown", reason };
}

function notApplicableGate(id) {
  return { id, status: "not_applicable", reason: null };
}

function releaseWindowState(candidate) {
  if (candidate.releaseTooSoon === true) return "too_soon";
  if (typeof candidate.daysToRelease === "number") {
    if (candidate.daysToRelease < 0) return "too_soon";
    return candidate.daysToRelease > 60 ? "over_60" : "too_soon";
  }
  if (candidate.comingSoon === true && /coming soon|tba|to be announced|待定|即将/i.test(String(candidate.releaseDate ?? ""))) return "tba";
  return "unknown";
}

function mediaReleaseWindowState(lead, details) {
  const resolution = lead?._steamEntityResolution ?? null;
  if (lead._class === "drop" && /不足60天|窗口不合适/i.test(`${lead.risks ?? ""} ${lead.verdict ?? ""}`)) return "too_soon";
  const releaseDate = String(lead.release_window ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    const reportDate = String(lead.first_seen ?? "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      const days = Math.round((Date.parse(`${releaseDate}T00:00:00+08:00`) - Date.parse(`${reportDate}T00:00:00+08:00`)) / 86400000);
      return days > 60 ? "over_60" : "too_soon";
    }
  }
  if (details?.release_date?.coming_soon || resolution?.demo_only || /即将发售|Demo 可玩|试玩 Demo/i.test(lead.progress ?? "")) return "tba";
  return "unknown";
}

function officialGameplayEvidence({ details, officialSourceMatched, sourceItem }) {
  const evidence = [];
  for (const movie of details?.movies ?? []) {
    if (!/gameplay|game play|实机|實機|玩法|试玩|試玩/i.test(String(movie?.name ?? ""))) continue;
    evidence.push({ type: "steam_official_gameplay", value: movie.name, url: movie?.webm?.max ?? movie?.mp4?.max ?? null });
  }
  const sourceText = `${sourceItem?.title ?? ""} ${sourceItem?.summary ?? ""}`;
  if (officialSourceMatched && /gameplay|实机|實機|玩法演示|试玩演示/i.test(sourceText)) {
    evidence.push({ type: "official_bilibili_gameplay", value: normalizeDisplayText(sourceItem?.title), url: sourceItem?.link ?? null });
  }
  return normalizeEvidenceList(evidence);
}

function publicQualityProofs(details, steamAppId) {
  const proofs = [];
  const recommendations = Number(details?.recommendations?.total ?? 0);
  if (recommendations >= 500) {
    proofs.push({
      type: "steam_recommendations_500_plus",
      value: `${recommendations} Steam recommendations`,
      url: steamAppId ? `https://store.steampowered.com/app/${steamAppId}/` : null
    });
  }
  const metacritic = Number(details?.metacritic?.score ?? 0);
  if (metacritic >= 75) {
    proofs.push({ type: "metacritic_75_plus", value: `Metacritic ${metacritic}`, url: details?.metacritic?.url ?? null });
  }
  return proofs;
}

function nonSteamBusinessEntrypoints(values, options = {}) {
  const entries = normalizeEvidenceList(values);
  return entries.filter((entry) => {
    const type = String(entry.type ?? "").toLowerCase();
    const value = String(entry.value ?? entry.url ?? "");
    if (!value || /steam/i.test(type) || /store\.steampowered\.com|steamcommunity\.com|steamdb\.info/i.test(value)) return false;
    if (type === "其他" || type === "other") return false;
    if ((type === "b站" || /bilibili\.com/i.test(value)) && options.officialBilibili === false) return false;
    return /email|官网|website|discord|twitter|x\/twitter|b站|bilibili|qq|微信|weibo/i.test(`${type} ${value}`) || /@/.test(value);
  });
}

function normalizeEvidenceList(values) {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  const seen = new Set();
  const normalized = [];
  for (const value of list) {
    const entry = value && typeof value === "object" && !Array.isArray(value)
      ? { ...value }
      : { value: String(value ?? "") };
    const content = String(entry.value ?? entry.url ?? "").trim();
    const key = normalizeUrl(content) || normalizeText(`${entry.type ?? ""} ${content}`);
    if (!content || !key || seen.has(key)) continue;
    normalized.push(entry);
    seen.add(key);
  }
  return normalized;
}

function normalizeRegion(value) {
  const text = normalizeText(value);
  if (!text) return "unknown";
  if (/中国|china|domestic/.test(text)) return "domestic";
  if (/海外|overseas|global|international/.test(text)) return "overseas";
  return ["domestic", "overseas"].includes(text) ? text : "unknown";
}

function yesNoUnknown(value) {
  if (value === true || value === "yes") return "yes";
  if (value === false || value === "no") return "no";
  return "unknown";
}

function enumState(value, allowed) {
  return allowed.includes(value) ? value : "unknown";
}

function numericString(value) {
  const text = String(value ?? "").trim();
  return /^\d+$/.test(text) ? text : null;
}

function cleanEvidenceText(value) {
  if (value === null || value === undefined) return null;
  const text = normalizeDisplayText(value);
  if (!text || /^(?:null|undefined)$/i.test(text)) return null;
  return text;
}
