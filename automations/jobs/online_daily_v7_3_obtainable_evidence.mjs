import { evaluateIndiePrelaunchAdmission } from "./online_daily_v7_indie_admission.mjs";

export const V73_OBTAINABLE_EVIDENCE_RULE_VERSION = "sourcing-rules-v7.3-obtainable-evidence";
export const V73_INDEPENDENT_QUALITY_SOURCE_MINIMUM = 2;

const HARD_EXCLUSION_GATE_IDS = new Set([
  "identity_and_dedupe",
  "prelaunch_window",
  "publisher_china_capacity_clear",
  "non_narrative_product",
  "non_india_team"
]);

const ACTION_BY_GATE_ID = new Map([
  ["identity_and_dedupe", "resolve_project_identity"],
  ["prelaunch_window", "verify_prelaunch_window"],
  ["publisher_china_capacity_clear", "verify_publisher_china_capacity"],
  ["non_narrative_product", "verify_product_focus"],
  ["non_india_team", "verify_team_region"],
  ["official_playable_or_gameplay", "fetch_official_playable_or_gameplay"],
  ["independent_quality_proof", "fetch_independent_quality_evidence"],
  ["non_steam_business_entry", "fetch_non_steam_business_entry"],
  ["concrete_china_bilibili_value", "research_china_bilibili_value"]
]);

const PATCH_FIELDS_BY_ACTION = new Map([
  ["resolve_project_identity", ["project", "steam_app_id", "dedupe_key"]],
  ["verify_prelaunch_window", ["release_state", "release_window", "early_access_state"]],
  ["verify_publisher_china_capacity", ["publisher_occupancy"]],
  ["verify_product_focus", ["narrative_state"]],
  ["verify_team_region", ["india_team_state"]],
  ["fetch_official_playable_or_gameplay", ["official_demo_evidence", "official_gameplay_evidence"]],
  ["fetch_independent_quality_evidence", ["quality_proofs"]],
  ["fetch_non_steam_business_entry", ["business_entrypoints"]],
  ["research_china_bilibili_value", ["china_bilibili_value"]]
]);

const MERGED_EVIDENCE_LIST_FIELDS = new Set([
  "official_demo_evidence",
  "official_gameplay_evidence",
  "quality_proofs",
  "business_entrypoints"
]);

export function evaluateV73IndiePrelaunchAdmission(input = {}) {
  const legacyAdmission = evaluateIndiePrelaunchAdmission(input);
  const evidence = legacyAdmission.evidence;
  const legacyGates = new Map(legacyAdmission.gate_results.map((gate) => [gate.id, gate]));
  const gateResults = [
    copyLegacyGate(legacyGates, "identity_and_dedupe"),
    copyLegacyGate(legacyGates, "prelaunch_window"),
    copyLegacyGate(legacyGates, "publisher_china_capacity_clear"),
    copyLegacyGate(legacyGates, "non_narrative_product"),
    copyLegacyGate(legacyGates, "non_india_team"),
    officialPlayableOrGameplayGate(evidence),
    independentQualityGate(evidence.quality_proofs),
    copyLegacyGate(legacyGates, "non_steam_business_entry"),
    copyLegacyGate(legacyGates, "concrete_china_bilibili_value")
  ];
  const failed = gateResults.filter((gate) => gate.status === "fail" || gate.status === "unknown");
  const hardFailure = failed.some((gate) => (
    gate.status === "fail" && HARD_EXCLUSION_GATE_IDS.has(gate.id)
  ));
  const qualified = failed.length === 0;
  const failedGateDetails = failed.map((gate) => ({
    gate_id: gate.id,
    status: gate.status,
    hard_exclusion: gate.status === "fail" && HARD_EXCLUSION_GATE_IDS.has(gate.id),
    obtainable: gate.status === "unknown" && ACTION_BY_GATE_ID.has(gate.id)
  }));
  const nextEvidenceActions = hardFailure
    ? []
    : failed.flatMap((gate) => {
        if (gate.status !== "unknown") return [];
        const action = ACTION_BY_GATE_ID.get(gate.id);
        return action ? [{ gate_id: gate.id, action }] : [];
      });

  return {
    qualified,
    disposition: qualified ? "formal" : hardFailure ? "excluded" : "candidate",
    sourcing_lane: "indie_prelaunch",
    sourcing_rule_version: V73_OBTAINABLE_EVIDENCE_RULE_VERSION,
    evidence,
    gate_results: gateResults,
    failed_gates: failed.map((gate) => gate.id),
    matched_rules: uniqueStrings([
      ...gateResults
        .filter((gate) => gate.status === "pass" || gate.status === "not_applicable")
        .map((gate) => `v7_3/${gate.id}`),
      evidence.china_demand ? "v7_3/explicit_china_demand_signal" : null,
      qualified ? "v7_3/qualified" : null
    ]),
    missing_evidence: failed.filter((gate) => gate.status === "unknown").map((gate) => gate.id),
    exclusion_reasons: failed.filter((gate) => gate.status === "fail").map((gate) => gate.reason),
    failed_gate_details: failedGateDetails,
    next_evidence_actions: nextEvidenceActions
  };
}

export async function runV73TargetedSecondPass({
  evidence = {},
  evaluate = evaluateV73IndiePrelaunchAdmission,
  fetchEvidence
} = {}) {
  if (typeof evaluate !== "function") {
    throw new TypeError("evaluate must be a function");
  }

  const initialEvidence = cloneValue(evidence);
  const firstPass = evaluate(initialEvidence);
  const requestedActions = Array.isArray(firstPass?.next_evidence_actions)
    ? cloneValue(firstPass.next_evidence_actions)
    : [];
  const canAttempt = firstPass?.qualified !== true
    && firstPass?.disposition !== "excluded"
    && requestedActions.length > 0
    && typeof fetchEvidence === "function";

  if (!canAttempt) {
    return {
      first_pass: firstPass,
      second_pass_attempted: false,
      final_pass: firstPass,
      requested_actions: [],
      evidence: initialEvidence
    };
  }

  const fetchedPatch = await fetchEvidence(cloneValue(requestedActions), {
    evidence: cloneValue(initialEvidence),
    first_pass: firstPass
  });
  const allowedFields = allowedPatchFields(requestedActions);
  const targetedPatch = filterTargetedPatch(fetchedPatch, allowedFields);
  const mergedEvidence = mergeEvidence(initialEvidence, targetedPatch);
  const finalPass = evaluate(mergedEvidence);

  return {
    first_pass: firstPass,
    second_pass_attempted: true,
    final_pass: finalPass,
    requested_actions: requestedActions,
    evidence: mergedEvidence
  };
}

function copyLegacyGate(gates, gateId) {
  const gate = gates.get(gateId);
  return gate
    ? { id: gate.id, status: gate.status, reason: gate.reason ?? null }
    : unknownGate(gateId, `${gateId} evidence is required`);
}

function officialPlayableOrGameplayGate(evidence) {
  const playable = Array.isArray(evidence.official_demo_evidence) && evidence.official_demo_evidence.length > 0;
  const gameplay = Array.isArray(evidence.official_gameplay_evidence) && evidence.official_gameplay_evidence.length > 0;
  return playable || gameplay
    ? passGate("official_playable_or_gameplay")
    : unknownGate(
        "official_playable_or_gameplay",
        "an official Demo/Playtest or official gameplay source is required"
      );
}

function independentQualityGate(proofs) {
  const sourceIds = new Set(
    (Array.isArray(proofs) ? proofs : [])
      .map(qualitySourceId)
      .filter(Boolean)
  );
  return sourceIds.size >= V73_INDEPENDENT_QUALITY_SOURCE_MINIMUM
    ? passGate("independent_quality_proof")
    : unknownGate(
        "independent_quality_proof",
        `quality evidence from at least ${V73_INDEPENDENT_QUALITY_SOURCE_MINIMUM} independent public sources is required`
      );
}

function qualitySourceId(proof) {
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) return null;
  for (const field of ["source_id", "source", "publisher", "outlet"]) {
    const value = normalizeIdentifier(proof[field]);
    if (value) return `${field}:${value}`;
  }
  const url = String(proof.url ?? "").trim();
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return hostname ? `host:${hostname}` : null;
  } catch {
    return null;
  }
}

function allowedPatchFields(actions) {
  const fields = new Set();
  for (const item of actions) {
    for (const field of PATCH_FIELDS_BY_ACTION.get(item?.action) ?? []) {
      fields.add(field);
    }
  }
  return fields;
}

function filterTargetedPatch(patch, allowedFields) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return {};
  const filtered = {};
  for (const field of allowedFields) {
    if (Object.hasOwn(patch, field)) filtered[field] = cloneValue(patch[field]);
  }
  return filtered;
}

function mergeEvidence(base, patch) {
  const merged = cloneValue(base);
  for (const [field, value] of Object.entries(patch)) {
    if (MERGED_EVIDENCE_LIST_FIELDS.has(field)) {
      merged[field] = mergeEvidenceList(merged[field], value);
      continue;
    }
    merged[field] = cloneValue(value);
  }
  return merged;
}

function mergeEvidenceList(current, incoming) {
  const values = [
    ...(Array.isArray(current) ? current : []),
    ...(Array.isArray(incoming) ? incoming : [])
  ];
  const seen = new Set();
  const merged = [];
  for (const value of values) {
    const key = evidenceEntryKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(cloneValue(value));
  }
  return merged;
}

function evidenceEntryKey(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return normalizeIdentifier(value);
  }
  return normalizeIdentifier(value.source_id)
    || normalizeIdentifier(value.url)
    || normalizeIdentifier(`${value.type ?? ""}:${value.value ?? ""}`);
}

function passGate(id) {
  return { id, status: "pass", reason: null };
}

function unknownGate(id, reason) {
  return { id, status: "unknown", reason };
}

function normalizeIdentifier(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return text || null;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, cloneValue(nested)]));
  }
  return value;
}
