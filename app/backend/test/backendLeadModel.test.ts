import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  backendLeadKeys,
  backendLeadsFromReport,
  backendToCsv,
  mergeBackendIncomingLeads,
  mergeBackendLead,
  normalizeBackendLead
} from "../src/lib/backendLeadModel.ts";

describe("backend lead model helpers", () => {
  it("normalizes defaults, Steam links, contact fallback, and workflow fields", () => {
    const lead = normalizeBackendLead({
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
    assert.equal(lead.review_status, "已查看");
    assert.deepEqual(lead.links, [
      "https://store.steampowered.com/app/123/",
      "https://steamdb.info/app/123/",
      "https://example.com/"
    ]);
    assert.deepEqual(lead.contact_methods, [{ type: "Email", value: "bd@example.com", note: "legacy contact" }]);
  });

  it("preserves existing workflow while merging new daily report data", () => {
    const current = normalizeBackendLead({
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
    const incoming = normalizeBackendLead({
      project: "Workflow Game",
      bucket: "未处理",
      review_status: "未处理",
      priority: "P2",
      links: ["https://example.com/", "https://store.steampowered.com/app/456/"],
      contact_methods: [{ type: "Discord", value: "discord.gg/demo" }],
      notes: "daily note"
    }, { today: "2026-07-04" });

    const merged = mergeBackendLead(current, incoming);
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

  it("dedupes by project, Steam AppID, and links while preserving import stats", () => {
    const existing = normalizeBackendLead({
      id: "lead-existing",
      project: "Existing Game",
      steam_app_id: "777",
      bucket: "未处理",
      review_status: "未处理"
    }, { today: "2026-07-01" });

    assert.deepEqual(backendLeadKeys(existing), [
      "project:existing game",
      "steam:777",
      "link:https://store.steampowered.com/app/777",
      "link:https://steamdb.info/app/777"
    ]);

    const result = mergeBackendIncomingLeads([existing], [
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
  });

  it("expands daily report pools and escapes complex CSV cells", () => {
    const leads = backendLeadsFromReport({
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
    assert.ok(String(leads[0].notes).includes("导入日报 2026-07-04"));

    const csv = backendToCsv([
      normalizeBackendLead({
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
