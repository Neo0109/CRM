import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import {
  backendLeadKeys,
  backendLeadsFromReport,
  backendToCsv,
  createOnlyBackendIncomingLeads,
  isBackendSystemLeadRow,
  mergeBackendIncomingLeads,
  mergeBackendLead,
  normalizeBackendLead,
  type BackendLead
} from "../src/lib/backendLeadModel.ts";
import * as canonicalLeadModelModule from "../../../functions/_lib/leadModel.ts";
import type { Lead } from "../../../functions/_lib/leadModel.ts";

const backendModelPath = path.resolve(import.meta.dirname, "../src/lib/backendLeadModel.ts");
const canonicalLeadModel = ("normalizeLead" in canonicalLeadModelModule
  ? canonicalLeadModelModule
  : (canonicalLeadModelModule.default ?? canonicalLeadModelModule)) as typeof import("../../../functions/_lib/leadModel.ts");
const {
  createOnlyIncomingLeadSet,
  leadKeys,
  leadsFromReport,
  mergeIncomingLeadSet,
  mergeLead,
  normalizeLead,
  toCsv
} = canonicalLeadModel as typeof import("../../../functions/_lib/leadModel.ts");

function rawLead(overrides: Partial<Lead> = {}): Partial<Lead> {
  return {
    project: " Shared Game ",
    steam_app_id: "123",
    country: "中国",
    bucket: "待评测",
    contact: "bd@example.com",
    links: [
      "https://store.steampowered.com/app/999/",
      "https://example.com",
      "https://example.com/"
    ],
    public_signals: "国产 Demo",
    ...overrides
  };
}

describe("backend lead model canonical parity", () => {
  it("uses the Functions lead model as the canonical implementation instead of inlining helpers", async () => {
    const source = await readFile(backendModelPath, "utf8");

    assert.match(source, /functions\/_lib\/leadModel\.js/);
    for (const helper of [
      "normalizeBackendLead",
      "mergeBackendLead",
      "mergeBackendIncomingLeads",
      "createOnlyBackendIncomingLeads",
      "backendLeadKeys",
      "backendLeadsFromReport",
      "backendToCsv",
      "normalizeLinks",
      "normalizeContacts",
      "mergeContactMethods",
      "csvCell",
      "stageFromBucket",
      "priorityFromBucket"
    ]) {
      assert.doesNotMatch(source, new RegExp(`function\\s+${helper}\\b`));
      assert.doesNotMatch(source, new RegExp(`export\\s+function\\s+${helper}\\b`));
    }
  });

  it("normalizes backend leads through the same canonical model as Functions", () => {
    const backend = normalizeBackendLead(rawLead() as Partial<BackendLead>, { today: "2026-07-04" });
    const canonical = normalizeLead(rawLead(), { today: "2026-07-04" });

    assert.deepEqual(backend, canonical);
    assert.deepEqual(backendLeadKeys(backend), leadKeys(canonical));
  });

  it("merges backend leads and import sets with canonical Functions semantics", () => {
    const currentRaw = rawLead({
      id: "lead-current",
      project: "Workflow Game",
      steam_app_id: null,
      bucket: "推进池",
      stage: "negotiating",
      priority: "P0",
      review_status: "跟进中",
      owner: "Neo",
      due_date: "2026-07-10",
      links: ["https://example.com"],
      contact_methods: [{ type: "Email", value: "neo@example.com" }],
      notes: "existing note"
    });
    const incomingRaw = rawLead({
      project: "Workflow Game",
      steam_app_id: null,
      bucket: "未处理",
      review_status: "未处理",
      priority: "P2",
      links: ["https://example.com/", "https://store.steampowered.com/app/456/"],
      contact_methods: [{ type: "Discord", value: "discord.gg/demo" }],
      notes: "daily note"
    });

    const backendCurrent = normalizeBackendLead(currentRaw as Partial<BackendLead>, { today: "2026-07-01" });
    const backendIncoming = normalizeBackendLead(incomingRaw as Partial<BackendLead>, { today: "2026-07-04" });
    const canonicalCurrent = normalizeLead(currentRaw, { today: "2026-07-01" });
    const canonicalIncoming = normalizeLead(incomingRaw, { today: "2026-07-04" });

    assert.deepEqual(mergeBackendLead(backendCurrent, backendIncoming), mergeLead(canonicalCurrent, canonicalIncoming));

    const backendResult = mergeBackendIncomingLeads([backendCurrent], [
      incomingRaw as Partial<BackendLead>,
      rawLead({ project: "Drop Game", bucket: "淘汰池", verdict: "bad fit" }) as Partial<BackendLead>
    ], { today: "2026-07-04" });
    const canonicalResult = mergeIncomingLeadSet([canonicalCurrent], [
      incomingRaw,
      rawLead({ project: "Drop Game", bucket: "淘汰池", verdict: "bad fit" })
    ], { today: "2026-07-04" });

    assert.deepEqual(backendResult, canonicalResult);
  });

  it("uses canonical create-only semantics for backend imports", () => {
    const existingRaw = rawLead({
      id: "lead-existing",
      project: "Existing Game",
      steam_app_id: "777",
      priority: "P0",
      notes: "protected"
    });
    const existing = normalizeBackendLead(existingRaw as Partial<BackendLead>, { today: "2026-07-01" });
    const incoming = [
      rawLead({ project: "Steam Match", steam_app_id: "777", priority: null }),
      rawLead({ project: "New Game", steam_app_id: "999", priority: null })
    ] as Partial<BackendLead>[];

    assert.deepEqual(
      createOnlyBackendIncomingLeads([existing], incoming, { today: "2026-07-15" }),
      createOnlyIncomingLeadSet([existing], incoming, { today: "2026-07-15" })
    );
  });

  it("expands reports and exports CSV through canonical Functions semantics", () => {
    const report = {
      report_date: "2026-07-04",
      summary: "日报摘要",
      insights: [],
      push_pool: [{ project: "Push Game", contact_methods: [{ type: "Email", value: "push@example.com", note: "BD" }] }],
      watch_pool: [{ project: "Watch Game" }],
      drop_pool: [{ project: "Drop Game", links: ["https://example.com/a,b"], notes: "quote \"inside\"" }]
    };

    assert.deepEqual(backendLeadsFromReport(report), leadsFromReport(report));

    const backendCsv = backendToCsv([
      normalizeBackendLead({
        project: "CSV Game",
        contact_methods: [{ type: "Email", value: "csv@example.com", note: "quote \"inside\"" }],
        links: ["https://example.com/a,b"],
        notes: "line1\nline2"
      }, { today: "2026-07-04" })
    ]);
    const canonicalCsv = toCsv([
      normalizeLead({
        project: "CSV Game",
        contact_methods: [{ type: "Email", value: "csv@example.com", note: "quote \"inside\"" }],
        links: ["https://example.com/a,b"],
        notes: "line1\nline2"
      }, { today: "2026-07-04" })
    ]);

    assert.equal(backendCsv, canonicalCsv);
  });

  it("keeps backend-only system row filtering as local adapter behavior", () => {
    assert.equal(isBackendSystemLeadRow({ id: "__crm_settings" }), true);
    assert.equal(isBackendSystemLeadRow({ data: { id: "__crm_shadow" } }), true);
    assert.equal(isBackendSystemLeadRow({ data: { type: "sourcing_decision_event" } }), true);
    assert.equal(isBackendSystemLeadRow({ id: "lead_normal", data: { project: "Normal Game" } }), false);
  });
});
