import { createEvidenceSnapshot } from "./online_daily_v4_candidate_state.mjs";
import { normalizeText } from "./online_daily_v4_dedupe.mjs";
import { fetchOfficialBilibiliCandidates } from "./online_daily_v4_media_sources.mjs";
import {
  deriveConcreteChinaBilibiliValue,
  mediaIndieAdmissionEvidence,
  steamIndieAdmissionEvidence
} from "./online_daily_v7_indie_admission.mjs";
import {
  evaluateV73IndiePrelaunchAdmission,
  runV73TargetedSecondPass
} from "./online_daily_v7_3_obtainable_evidence.mjs";

const DAILY_SECOND_PASS_LIMIT = 12;
const MAX_ACTIONS_PER_CANDIDATE = 3;
const SUPPORTED_PUBLIC_ACTIONS = new Set([
  "fetch_official_playable_or_gameplay",
  "fetch_independent_quality_evidence",
  "fetch_non_steam_business_entry",
  "research_china_bilibili_value"
]);

export async function runV73TargetedCandidateSecondPasses({
  steamCandidates = [],
  mediaCandidates = [],
  candidateStates = new Map(),
  capturedAt,
  maxCandidates = DAILY_SECOND_PASS_LIMIT,
  fetchEvidence = fetchV73TargetedEvidence,
  mediaSignals = [],
  context = {},
  evaluate = evaluateV73IndiePrelaunchAdmission
} = {}) {
  if (!Array.isArray(steamCandidates) || !Array.isArray(mediaCandidates)) {
    throw new TypeError("V7.3 second-pass candidates must be arrays.");
  }
  if (!(candidateStates instanceof Map)) {
    throw new TypeError("V7.3 second-pass candidateStates must be a Map.");
  }
  if (typeof fetchEvidence !== "function" || typeof evaluate !== "function") {
    throw new TypeError("V7.3 second-pass provider and evaluator must be functions.");
  }

  const steam = steamCandidates.map(cloneValue);
  const media = mediaCandidates.map(cloneValue);
  const states = new Map(
    [...candidateStates.entries()].map(([key, state]) => [key, cloneValue(state)])
  );
  const eligible = uniqueEligibleCandidates([
    ...steam.map((candidate, index) => candidateForSecondPass({
      candidate,
      index,
      sourceType: "steam",
      evaluate
    })),
    ...media.map((candidate, index) => candidateForSecondPass({
      candidate,
      index,
      sourceType: "media",
      evaluate
    }))
  ].filter(Boolean));
  const selected = eligible.slice(0, boundedCandidateLimit(maxCandidates));
  const metrics = {
    eligible_count: eligible.length,
    selected_count: selected.length,
    attempted_count: 0,
    qualified_count: 0,
    failed_count: 0
  };
  const results = [];

  for (const item of selected) {
    metrics.attempted_count += 1;
    try {
      const outcome = await runV73TargetedSecondPass({
        evidence: item.evidence,
        evaluate,
        fetchEvidence: async (actions, passContext) => fetchEvidence({
          candidate: cloneValue(item.candidate),
          source_type: item.source_type,
          actions: cloneValue(actions),
          evidence: cloneValue(passContext.evidence),
          mediaSignals: cloneValue(mediaSignals),
          context
        })
      });
      const updatedCandidate = candidateWithEvidence(
        item.candidate,
        item.source_type,
        outcome.evidence
      );
      const updatedState = item.source_type === "steam" && states.has(item.dedupe_key)
        ? stateWithEvidenceSnapshot(
            states.get(item.dedupe_key),
            updatedCandidate,
            capturedAt
          )
        : null;

      if (item.source_type === "steam") steam[item.index] = updatedCandidate;
      else media[item.index] = updatedCandidate;
      if (updatedState) states.set(item.dedupe_key, updatedState);
      if (outcome.final_pass?.qualified === true) metrics.qualified_count += 1;
      results.push({
        dedupe_key: item.dedupe_key,
        source_type: item.source_type,
        first_pass: outcome.first_pass,
        final_pass: outcome.final_pass,
        requested_actions: outcome.requested_actions,
        second_pass_attempted: outcome.second_pass_attempted,
        error: null
      });
    } catch (error) {
      metrics.failed_count += 1;
      results.push({
        dedupe_key: item.dedupe_key,
        source_type: item.source_type,
        first_pass: item.first_pass,
        final_pass: item.first_pass,
        requested_actions: item.actions,
        second_pass_attempted: true,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    steam_candidates: steam,
    media_candidates: media,
    candidate_states: states,
    metrics,
    results
  };
}

export async function fetchV73TargetedEvidence({
  candidate = {},
  source_type: sourceType = "steam",
  actions = [],
  evidence = {},
  mediaSignals = [],
  context = {}
} = {}) {
  const requested = new Set(
    actions
      .map((item) => item?.action)
      .filter((action) => SUPPORTED_PUBLIC_ACTIONS.has(action))
  );
  if (!requested.size) return {};

  const project = String(evidence.project ?? candidate.title ?? candidate.project ?? "").trim();
  if (!project) return {};
  const fetchOfficial = context.fetchOfficialBilibiliCandidatesImpl
    ?? fetchOfficialBilibiliCandidates;
  const needsOfficialSignals = [
    "fetch_official_playable_or_gameplay",
    "fetch_non_steam_business_entry",
    "research_china_bilibili_value"
  ].some((action) => requested.has(action));
  const officialSignals = needsOfficialSignals
    ? uniquePublicSignals(
        (await fetchOfficial(project, context)).filter((item) => signalMatchesProject(item, project))
      )
    : [];
  const matchingMediaSignals = uniquePublicSignals(
    mediaSignals.filter((item) => signalMatchesProject(item, project))
  );
  const patch = {};

  if (requested.has("fetch_official_playable_or_gameplay")) {
    patch.official_demo_evidence = evidenceFromSignals(
      officialSignals.filter(isPlayableSignal),
      "official_bilibili_playable"
    );
    patch.official_gameplay_evidence = evidenceFromSignals(
      officialSignals.filter(isGameplaySignal),
      "official_bilibili_gameplay"
    );
  }

  if (requested.has("fetch_independent_quality_evidence")) {
    const independentQualitySignals = matchingMediaSignals.filter(
      isIndependentQualitySignal
    );
    patch.quality_proofs = uniqueEvidence([
      ...qualityEvidenceFromSignals(
        independentQualitySignals.filter(isBilibiliSignal),
        "bilibili"
      ),
      ...qualityEvidenceFromSignals(
        independentQualitySignals.filter((item) => !isBilibiliSignal(item)),
        "media"
      )
    ]);
  }

  if (requested.has("fetch_non_steam_business_entry")) {
    patch.business_entrypoints = officialSignals
      .map((item) => publicSignalUrl(item))
      .filter(Boolean)
      .map((url) => ({ type: "Bilibili", value: url }));
  }

  if (requested.has("research_china_bilibili_value")) {
    const sourceText = [...officialSignals, ...matchingMediaSignals]
      .map((item) => `${item.title ?? ""} ${item.summary ?? ""}`)
      .join(" ");
    const value = deriveConcreteChinaBilibiliValue([
      ...(candidate.genres ?? []),
      ...(candidate.categories ?? []),
      candidate.gameplay,
      sourceText
    ].filter(Boolean).join(" "));
    if (value) patch.china_bilibili_value = value;
  }

  return patch;
}

function candidateForSecondPass({ candidate, index, sourceType, evaluate }) {
  const evidence = sourceType === "steam"
    ? steamIndieAdmissionEvidence(candidate)
    : mediaIndieAdmissionEvidence(candidate);
  const firstPass = evaluate(evidence);
  const actions = Array.isArray(firstPass?.next_evidence_actions)
    ? firstPass.next_evidence_actions.map(cloneValue)
    : [];
  if (
    firstPass?.qualified === true
    || firstPass?.disposition === "excluded"
    || actions.length < 1
    || actions.length > MAX_ACTIONS_PER_CANDIDATE
    || actions.some((item) => !SUPPORTED_PUBLIC_ACTIONS.has(item?.action))
  ) {
    return null;
  }
  const dedupeKey = String(firstPass?.evidence?.dedupe_key ?? "").trim();
  if (!dedupeKey) return null;
  return {
    candidate,
    index,
    source_type: sourceType,
    dedupe_key: dedupeKey,
    evidence: firstPass.evidence,
    first_pass: firstPass,
    actions,
    score: Number(candidate?.score ?? candidate?.media_score ?? 0)
  };
}

function uniqueEligibleCandidates(items) {
  const ranked = [...items].sort((left, right) => (
    left.actions.length - right.actions.length
    || right.score - left.score
    || left.dedupe_key.localeCompare(right.dedupe_key)
    || left.source_type.localeCompare(right.source_type)
  ));
  const seen = new Set();
  return ranked.filter((item) => {
    if (seen.has(item.dedupe_key)) return false;
    seen.add(item.dedupe_key);
    return true;
  });
}

function boundedCandidateLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DAILY_SECOND_PASS_LIMIT;
  return Math.min(DAILY_SECOND_PASS_LIMIT, Math.max(0, Math.floor(parsed)));
}

function candidateWithEvidence(candidate, sourceType, evidence) {
  const normalized = cloneValue(evidence);
  if (sourceType === "steam") {
    return {
      ...cloneValue(candidate),
      officialDemoEvidence: cloneValue(normalized.official_demo_evidence),
      officialGameplayEvidence: cloneValue(normalized.official_gameplay_evidence),
      qualityProofs: cloneValue(normalized.quality_proofs),
      contactMethods: cloneValue(normalized.business_entrypoints),
      chinaBilibiliValue: normalized.china_bilibili_value,
      chinaDemandEvidence: normalized.china_demand,
      _indieAdmissionEvidence: normalized
    };
  }
  return {
    ...cloneValue(candidate),
    contact_methods: cloneValue(normalized.business_entrypoints),
    china_bilibili_value: normalized.china_bilibili_value,
    china_demand: normalized.china_demand,
    _indieAdmissionEvidence: normalized
  };
}

function stateWithEvidenceSnapshot(state, candidate, capturedAt) {
  const next = cloneValue(state);
  next.evidence_snapshot = createEvidenceSnapshot(candidate, { capturedAt });
  return next;
}

function signalMatchesProject(item, project) {
  const projectKey = normalizeText(project);
  if (!projectKey) return false;
  const text = normalizeText(`${item?.title ?? ""} ${item?.summary ?? ""}`);
  return text.includes(projectKey);
}

function uniquePublicSignals(items) {
  const seen = new Set();
  const signals = [];
  for (const item of items) {
    const url = publicSignalUrl(item);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    signals.push({ ...item, link: url });
  }
  return signals;
}

function publicSignalUrl(item) {
  const value = String(item?.link ?? item?.url ?? "").trim();
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const parsed = new URL(value);
    if (!parsed.hostname || parsed.username || parsed.password) return null;
    return value;
  } catch {
    return null;
  }
}

function isIndependentQualitySignal(item) {
  if (!isBilibiliSignal(item)) return true;
  const sourceKind = String(item?.bilibili_probe?.source_kind ?? "")
    .trim()
    .toLowerCase();
  return sourceKind === "media" || sourceKind === "trusted_creator";
}

function isBilibiliSignal(item) {
  if (item?.bilibili_probe && typeof item.bilibili_probe === "object") return true;
  const url = publicSignalUrl(item);
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "bilibili.com"
      || hostname.endsWith(".bilibili.com")
      || hostname === "b23.tv"
      || hostname.endsWith(".b23.tv");
  } catch {
    return false;
  }
}

function isPlayableSignal(item) {
  return /demo|playtest|试玩|試玩|测试|測試/i.test(
    `${item?.title ?? ""} ${item?.summary ?? ""}`
  );
}

function isGameplaySignal(item) {
  return /gameplay|实机|實機|玩法|演示|playtest|demo|试玩|試玩/i.test(
    `${item?.title ?? ""} ${item?.summary ?? ""}`
  );
}

function evidenceFromSignals(signals, type) {
  return uniqueEvidence(signals.map((item) => ({
    type,
    value: String(item.title ?? item.summary ?? type).trim(),
    url: publicSignalUrl(item)
  })));
}

function qualityEvidenceFromSignals(signals, family) {
  return signals
    .filter((item) => /hands-on|playtest|preview|review|showcase|festival|试玩|試玩|测评|測評|评测|評測/i.test(
      `${item?.title ?? ""} ${item?.summary ?? ""}`
    ))
    .map((item) => ({
      type: family === "bilibili"
        ? "bilibili_public_playtest"
        : "independent_media_preview",
      source_id: publicSourceId(item, family),
      source_role: independentQualitySourceRole(item, family),
      source: String(item.source ?? "").trim() || null,
      value: String(item.title ?? item.summary ?? "public quality evidence").trim(),
      url: publicSignalUrl(item)
    }));
}

function independentQualitySourceRole(item, family) {
  const classified = String(
    item?.bilibili_probe?.source_kind ?? item?.source_role ?? ""
  ).trim().toLowerCase();
  if (classified === "trusted_creator") return "trusted_creator";
  if (classified === "media") return "media";
  return family === "media" ? "media" : "unclassified";
}

function publicSourceId(item, family) {
  const author = String(item?.summary ?? "").match(/UP主[:：]\s*([^\s]+)/i)?.[1];
  if (author) return `${family}_author:${normalizeText(author)}`;
  const source = normalizeText(item?.source);
  if (source) return `${family}_source:${source}`;
  try {
    return `${family}_host:${new URL(publicSignalUrl(item)).hostname.toLowerCase()}`;
  } catch {
    return `${family}_url:${normalizeText(publicSignalUrl(item))}`;
  }
}

function uniqueEvidence(items) {
  const seen = new Set();
  const evidence = [];
  for (const item of items) {
    if (!item?.url) continue;
    const key = normalizeText(item.source_id ?? item.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    evidence.push(item);
  }
  return evidence;
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneValue(nested)])
    );
  }
  return value;
}
