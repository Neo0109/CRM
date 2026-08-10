import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InteractionInputError,
  encodeInteractionCursor,
  interactionEventPrefix,
  parseInteractionPage,
  prepareInteractionMutation
} from "../_lib/interactionModel.ts";
import { normalizeLead } from "../_lib/leadModel.ts";

const actor = {
  username: "neo",
  display_name: "Neo",
  role: "admin",
  permissions: ["*"]
};

const baseLead = normalizeLead({
  id: "lead-follow-up",
  project: "Follow-up Game",
  team: "Studio",
  bucket: "跟进中",
  stage: "active",
  owner: "jojo",
  next_action: "旧动作",
  due_date: "2026-08-20",
  calendar_enabled: true,
  follow_up_interval: "weekly",
  reviewed_at: "2026-08-01T00:00:00.000Z"
});

const baseInput = {
  request_id: "request-001",
  lead_id: baseLead.id,
  channel: "微信/QQ",
  contact_label: "制作人",
  occurred_at: "2026-08-11T10:30:00+08:00",
  summary: "确认了新的试玩版本。"
};

const createdAt = "2026-08-11T03:00:00.000Z";

describe("interaction model", () => {
  it("creates a fixed append-only event while summary-only saves preserve the Lead", () => {
    const result = prepareInteractionMutation(baseInput, baseLead, actor, createdAt);

    assert.equal(result.lead_changed, false);
    assert.equal(result.calendar_synced, false);
    assert.strictEqual(result.lead, baseLead);
    assert.equal(result.interaction.id, `${interactionEventPrefix}request-001`);
    assert.equal(result.interaction.type, "crm_interaction_event");
    assert.equal(result.interaction.created_at, createdAt);
    assert.equal(result.interaction.occurred_at, "2026-08-11T02:30:00.000Z");
    assert.deepEqual(result.interaction.actor, {
      username: "neo",
      display_name: "Neo",
      role: "admin"
    });
    assert.deepEqual(result.interaction.project_snapshot, {
      project: "Follow-up Game",
      team: "Studio",
      owner: "jojo",
      bucket: "跟进中"
    });
    assert.deepEqual(Object.keys(result.interaction).sort(), [
      "actor",
      "calendar_synced",
      "channel",
      "contact_label",
      "created_at",
      "id",
      "lead_id",
      "next_action",
      "next_follow_up_date",
      "occurred_at",
      "project_snapshot",
      "request_id",
      "summary",
      "type"
    ]);
  });

  it("updates only next_action when no date is supplied", () => {
    const result = prepareInteractionMutation(
      { ...baseInput, request_id: "request-002", next_action: "周五确认测试名单" },
      baseLead,
      actor,
      createdAt
    );

    assert.equal(result.lead_changed, true);
    assert.equal(result.calendar_synced, false);
    assert.equal(result.lead.next_action, "周五确认测试名单");
    assert.equal(result.lead.due_date, baseLead.due_date);
    assert.equal(result.lead.calendar_enabled, baseLead.calendar_enabled);
    assert.equal(result.lead.follow_up_interval, baseLead.follow_up_interval);
    assert.equal(result.lead.bucket, baseLead.bucket);
    assert.equal(result.lead.stage, baseLead.stage);
    assert.equal(result.lead.priority, baseLead.priority);
    assert.equal(result.lead.owner, baseLead.owner);
    assert.equal(result.lead.reviewed_at, baseLead.reviewed_at);
  });

  it("synchronizes a dated next action through the existing Lead calendar fields", () => {
    const result = prepareInteractionMutation(
      {
        ...baseInput,
        request_id: "request-003",
        next_action: "发送商务方案",
        next_follow_up_date: "2026-08-18"
      },
      baseLead,
      actor,
      createdAt
    );

    assert.equal(result.lead_changed, true);
    assert.equal(result.calendar_synced, true);
    assert.equal(result.interaction.calendar_synced, true);
    assert.equal(result.lead.next_action, "发送商务方案");
    assert.equal(result.lead.due_date, "2026-08-18");
    assert.equal(result.lead.calendar_enabled, true);
    assert.equal(result.lead.follow_up_interval, "custom");
    assert.equal(result.lead.bucket, baseLead.bucket);
    assert.equal(result.lead.stage, baseLead.stage);
    assert.equal(result.lead.priority, baseLead.priority);
    assert.equal(result.lead.owner, baseLead.owner);
    assert.equal(result.lead.reviewed_at, baseLead.reviewed_at);
  });

  it("rejects ineligible pools, invalid fields, and follow-up dates before the communication date", () => {
    const invalid = (input: unknown, lead = baseLead) => {
      assert.throws(
        () => prepareInteractionMutation(input, lead, actor, createdAt),
        InteractionInputError
      );
    };

    invalid({ ...baseInput, channel: "短信" });
    invalid({ ...baseInput, summary: " " });
    invalid({ ...baseInput, summary: "x".repeat(2001) });
    invalid({ ...baseInput, contact_label: "x".repeat(121) });
    invalid({ ...baseInput, next_action: "x".repeat(501) });
    invalid({ ...baseInput, next_follow_up_date: "2026-08-18" });
    invalid({ ...baseInput, next_action: "回访", next_follow_up_date: "2026-08-10" });
    invalid({ ...baseInput, request_id: "bad id" });
    invalid(
      baseInput,
      normalizeLead({ id: baseLead.id, project: baseLead.project, bucket: "观察池" })
    );
  });

  it("parses bounded opaque pagination cursors", () => {
    assert.deepEqual(parseInteractionPage({}), { offset: 0, limit: 50 });
    assert.deepEqual(parseInteractionPage({ limit: "100" }), { offset: 0, limit: 100 });

    const first = parseInteractionPage({ limit: "2" });
    assert.deepEqual(first, { offset: 0, limit: 2 });
    const cursor = encodeInteractionCursor(2);
    assert.equal(typeof cursor, "string");
    assert.deepEqual(parseInteractionPage({ limit: "2", cursor }), {
      offset: 2,
      limit: 2
    });

    assert.throws(() => parseInteractionPage({ limit: "101" }), InteractionInputError);
    assert.throws(() => parseInteractionPage({ cursor: "not-a-cursor" }), InteractionInputError);
  });
});
