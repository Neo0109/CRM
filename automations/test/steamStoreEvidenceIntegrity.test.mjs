import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  isDomesticMediaRescueSignal,
  isExpandedDomesticProductSignal,
  isProductSourcingSignal,
  mediaSignalToLead
} from "../jobs/online_daily_v4_media_entities.mjs";
import { buildMediaLeadCandidates } from "../jobs/online_daily_v4_media_leads.mjs";
import { classifyMediaDisposition } from "../jobs/online_daily_v4_media_rules.mjs";

const fixture = JSON.parse(readFileSync(
  new URL("./fixtures/steam-store-evidence-integrity.json", import.meta.url),
  "utf8"
));

function emptyIndex() {
  return {
    projects: new Set(),
    projectLooseKeys: new Set(),
    steamAppIds: new Set(),
    links: new Set(),
    keys: new Set()
  };
}

function diagnostics() {
  return {
    media_non_product_filtered: 0,
    media_expanded_product_candidates: 0,
    media_rescue_product_candidates: 0,
    media_duplicate_filtered: 0,
    media_steam_appids_extracted: 0,
    media_released_routed_to_drop: 0,
    media_radar_only: 0,
    media_rejected: 0,
    media_exact_steam_lookup_attempts: 0,
    media_exact_steam_lookup_hits: 0,
    steam_links_detected: 0,
    steam_evidence_materialized: 0,
    steam_demo_parent_converted: 0,
    steam_evidence_released_filtered: 0,
    steam_evidence_duplicate_merged: 0,
    steam_evidence_lost: 0
  };
}

describe("Steam store evidence integrity", () => {
  it("rejects unresolved Steam store claims before every Lead path", async () => {
    const localDiagnostics = diagnostics();
    let officialLookups = 0;
    let exactSteamLookups = 0;

    for (const item of fixture.invalid) {
      assert.deepEqual(classifyMediaDisposition(item), {
        kind: "reject",
        reason: "steam_store_claim_without_normalized_evidence"
      });
      assert.equal(isProductSourcingSignal(item), false);
      assert.equal(isExpandedDomesticProductSignal(item), false);
      assert.equal(isDomesticMediaRescueSignal(item), false);
    }

    const leads = await buildMediaLeadCandidates(fixture.invalid, emptyIndex(), {
      reportDate: "2026-07-15",
      diagnostics: localDiagnostics,
      maxOfficialLookups: 4,
      maxExactSteamLookups: 4,
      sleepImpl: async () => {},
      fetchOfficialBilibiliCandidatesImpl: async () => {
        officialLookups += 1;
        return [];
      },
      fetchSteamExactTitleCandidatesImpl: async () => {
        exactSteamLookups += 1;
        return [];
      },
      collectContactMethodsImpl: async () => []
    });

    assert.deepEqual(leads, []);
    assert.equal(officialLookups, 0);
    assert.equal(exactSteamLookups, 0);
    assert.equal(localDiagnostics.media_rejected, fixture.invalid.length);
  });

  it("keeps normalized Steam URLs and structured AppIDs eligible", () => {
    for (const item of fixture.valid) {
      assert.equal(classifyMediaDisposition(item).kind, "lead_candidate");
      assert.equal(isProductSourcingSignal(item), true);

      const lead = mediaSignalToLead(item, "strict", {
        reportDate: "2026-07-15",
        diagnostics: diagnostics()
      });

      assert.match(lead.steam_app_id, /^\d+$/);
      assert.ok(lead.links.includes(`https://store.steampowered.com/app/${lead.steam_app_id}/`));
      assert.ok(lead.links.includes(`https://steamdb.info/app/${lead.steam_app_id}/`));
    }
  });
});
