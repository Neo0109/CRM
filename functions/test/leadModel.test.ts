import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLeadDedupeIndex,
  leadKeys,
  leadsFromReport,
  mergeIncomingLeadSet,
  mergeLead,
  normalizeLead,
  toCsv
} from "../_lib/leadModel.ts";

describe("lead model helpers", () => {
  it("preserves nullable priority and sourcing provenance in the Lead JSON contract", () => {
    const lead = normalizeLead({
      project: "Provenance Game",
      priority: null,
      sourcing_lane: "china_joint",
      sourcing_rule_version: "sourcing-rules-v7.1-two-lane-china-joint",
      sourcing_run_type: "initial_backfill"
    }, { today: "2026-07-15" });

    assert.equal(lead.priority, null);
    assert.equal(lead.sourcing_lane, "china_joint");
    assert.equal(lead.sourcing_rule_version, "sourcing-rules-v7.1-two-lane-china-joint");
    assert.equal(lead.sourcing_run_type, "initial_backfill");

    const legacyLead = normalizeLead({ project: "Legacy Game" }, { today: "2026-07-15" });
    assert.equal(legacyLead.priority, "P2");
    assert.equal(legacyLead.sourcing_lane, null);
    assert.equal(legacyLead.sourcing_rule_version, null);
    assert.equal(legacyLead.sourcing_run_type, null);
  });

  it("normalizes defaults, Steam links, region, contacts, and workflow fields", () => {
    const lead = normalizeLead({
      project: " Demo Game ",
      steam_app_id: "123",
      country: "中国",
      bucket: "待评测",
      contact: "bd@example.com",
      links: [
        "https://store.steampowered.com/app/999/",
        "https://example.com",
        "https://example.com/"
      ],
      public_signals: "国产 Demo"
    }, { today: "2026-07-04" });

    assert.equal(lead.id, "lead_steam_123_2026-07-04");
    assert.equal(lead.project, "Demo Game");
    assert.equal(lead.region, "中国");
    assert.equal(lead.region_priority, "国内优先");
    assert.equal(lead.stage, "watch");
    assert.equal(lead.priority, "P2");
    assert.equal(lead.priority_reason, null);
    assert.equal(lead.review_status, "已查看");
    assert.deepEqual(lead.links, [
      "https://store.steampowered.com/app/123/",
      "https://steamdb.info/app/123/",
      "https://example.com/"
    ]);
    assert.deepEqual(lead.contact_methods, [{ type: "Email", value: "bd@example.com", note: "legacy contact" }]);
  });

  it("preserves existing workflow while merging new daily report data", () => {
    const current = normalizeLead({
      id: "lead-current",
      project: "Workflow Game",
      bucket: "推进池",
      stage: "negotiating",
      priority: "P0",
      review_status: "跟进中",
      owner: "Neo",
      due_date: "2026-07-10",
      links: ["https://example.com"],
      contact_methods: [{ type: "Email", value: "neo@example.com" }],
      notes: "existing note"
    }, { today: "2026-07-01" });
    const incoming = normalizeLead({
      project: "Workflow Game",
      bucket: "未处理",
      review_status: "未处理",
      priority: "P2",
      links: ["https://example.com/", "https://store.steampowered.com/app/456/"],
      contact_methods: [{ type: "Discord", value: "discord.gg/demo" }],
      notes: "daily note"
    }, { today: "2026-07-04" });

    const merged = mergeLead(current, incoming);
    assert.equal(merged.id, "lead-current");
    assert.equal(merged.bucket, "推进池");
    assert.equal(merged.stage, "negotiating");
    assert.equal(merged.priority, "P0");
    assert.equal(merged.owner, "Neo");
    assert.equal(merged.due_date, "2026-07-10");
    assert.deepEqual(merged.links, ["https://example.com/", "https://store.steampowered.com/app/456/"]);
    assert.deepEqual(merged.contact_methods.map((method) => method.type), ["Email", "Discord"]);
    assert.equal(merged.notes, "existing note\ndaily note");
  });

  it("builds dedupe keys and import stats for creates, updates, and drops", () => {
    const existing = normalizeLead({
      id: "lead-existing",
      project: "Existing Game",
      steam_app_id: "777",
      bucket: "未处理",
      review_status: "未处理"
    }, { today: "2026-07-01" });

    assert.deepEqual(leadKeys(existing), [
      "project:existing game",
      "steam:777",
      "link:https://store.steampowered.com/app/777",
      "link:https://steamdb.info/app/777"
    ]);

    const result = mergeIncomingLeadSet([existing], [
      { project: "Existing Game", bucket: "未处理", review_status: "未处理", links: ["https://example.com"] },
      { project: "Drop Game", bucket: "淘汰池", verdict: "bad fit" }
    ], { today: "2026-07-04" });

    assert.equal(result.created, 1);
    assert.equal(result.updated, 1);
    assert.equal(result.dropped, 1);
    assert.equal(result.total, 2);
    assert.equal(result.import_stats.created_dropped, 1);
    assert.equal(result.import_stats.updated_unprocessed_visible, 1);
    assert.equal(result.import_stats.visible_unprocessed, 1);

    const index = buildLeadDedupeIndex(result.leads, { generatedAt: "2026-07-04T00:00:00.000Z" });
    assert.equal(index.generated_at, "2026-07-04T00:00:00.000Z");
    assert.ok(index.projects.includes("existing game"));
    assert.ok(index.keys.includes("project:drop game"));
  });

  it("expands daily report pools and escapes complex CSV cells", () => {
    const leads = leadsFromReport({
      report_date: "2026-07-04",
      summary: "日报摘要",
      insights: [],
      push_pool: [{ project: "Push Game", contact_methods: [{ type: "Email", value: "push@example.com", note: "BD" }] }],
      watch_pool: [{ project: "Watch Game" }],
      drop_pool: [{ project: "Drop Game", links: ["https://example.com/a,b"], notes: "quote \"inside\"" }]
    });

    assert.deepEqual(leads.map((lead) => [lead.project, lead.bucket, lead.stage, lead.review_status]), [
      ["Push Game", "未处理", "new", "未处理"],
      ["Watch Game", "未处理", "new", "未处理"],
      ["Drop Game", "淘汰池", "rejected", "已淘汰"]
    ]);
    assert.equal(leads[0].notes, undefined);
    assert.equal(leads[1].notes, undefined);
    assert.equal(leads[2].notes, "quote \"inside\"");

    const csv = toCsv([
      normalizeLead({
        project: "CSV Game",
        contact_methods: [{ type: "Email", value: "csv@example.com", note: "quote \"inside\"" }],
        links: ["https://example.com/a,b"],
        notes: "line1\nline2"
      }, { today: "2026-07-04" })
    ]);

    assert.match(csv, /"Email:csv@example.com \(quote ""inside""\)"/);
    assert.match(csv, /"https:\/\/example.com\/a,b"/);
    assert.match(csv, /"line1\nline2"/);
  });
});
