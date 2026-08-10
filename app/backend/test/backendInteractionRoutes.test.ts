import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request, Response } from "express";
import { normalizeBackendLead } from "../src/lib/backendLeadModel.ts";
import { createBackendInteractionHandlers } from "../src/lib/interactionRoutes.ts";

const actor = {
  username: "neo",
  display_name: "Neo",
  role: "admin",
  permissions: ["*"]
};

const baseLead = normalizeBackendLead({
  id: "lead-route",
  project: "Route Game",
  bucket: "跟进中",
  next_action: "旧动作",
  due_date: "2026-08-20",
  calendar_enabled: false,
  follow_up_interval: "weekly"
});

const baseBody = {
  request_id: "request-route-001",
  lead_id: baseLead.id,
  channel: "电话",
  occurred_at: "2026-08-11T10:00:00+08:00",
  summary: "确认本周进展。"
};

describe("backend interaction handlers", () => {
  it("requires a server-resolved actor", async () => {
    const response = captureResponse();
    const handlers = createBackendInteractionHandlers({
      interactionRepository: emptyRepository(),
      readLeads: async () => [baseLead],
      writeLeads: async () => undefined,
      assertValidLead: () => undefined,
      resolveActor: () => null
    });

    await handlers.get(request({ query: { lead_id: baseLead.id } }), response.value);

    assert.equal(response.status, 401);
    assert.deepEqual(response.payload, { error: "CRM login required" });
  });

  it("appends summary-only history without rewriting the Lead", async () => {
    const response = captureResponse();
    let writes = 0;
    let appended = 0;
    const repository = emptyRepository();
    repository.append = async (interaction) => {
      appended += 1;
      return { interaction, created: true };
    };
    const handlers = createBackendInteractionHandlers({
      interactionRepository: repository,
      readLeads: async () => [baseLead],
      writeLeads: async () => {
        writes += 1;
      },
      assertValidLead: () => undefined,
      resolveActor: () => actor
    });

    await handlers.post(request({ body: baseBody }), response.value);

    assert.equal(response.status, 201);
    assert.equal(appended, 1);
    assert.equal(writes, 0);
    assert.equal((response.payload as any).lead.next_action, "旧动作");
    assert.equal((response.payload as any).calendar_synced, false);
  });

  it("writes dated next actions before appending history and preserves workflow fields", async () => {
    const response = captureResponse();
    const order: string[] = [];
    let writtenLead = baseLead;
    const repository = emptyRepository();
    repository.append = async (interaction) => {
      order.push("interaction");
      return { interaction, created: true };
    };
    const handlers = createBackendInteractionHandlers({
      interactionRepository: repository,
      readLeads: async () => [baseLead],
      writeLeads: async (leads) => {
        order.push("lead");
        writtenLead = leads[0];
      },
      assertValidLead: () => undefined,
      resolveActor: () => actor
    });

    await handlers.post(request({
      body: {
        ...baseBody,
        request_id: "request-route-002",
        next_action: "发送更新",
        next_follow_up_date: "2026-08-18"
      }
    }), response.value);

    assert.equal(response.status, 201);
    assert.deepEqual(order, ["lead", "interaction"]);
    assert.equal(writtenLead.next_action, "发送更新");
    assert.equal(writtenLead.due_date, "2026-08-18");
    assert.equal(writtenLead.calendar_enabled, true);
    assert.equal(writtenLead.follow_up_interval, "custom");
    assert.equal(writtenLead.bucket, baseLead.bucket);
    assert.equal(writtenLead.stage, baseLead.stage);
    assert.equal(writtenLead.owner, baseLead.owner);
    assert.equal(writtenLead.reviewed_at, baseLead.reviewed_at);
  });

  it("returns 409 when the Lead moved out of the enabled pools", async () => {
    const response = captureResponse();
    const moved = normalizeBackendLead({
      ...baseLead,
      bucket: "观察池",
      stage: "watch"
    });
    let appended = false;
    const repository = emptyRepository();
    repository.append = async (interaction) => {
      appended = true;
      return { interaction, created: true };
    };
    const handlers = createBackendInteractionHandlers({
      interactionRepository: repository,
      readLeads: async () => [moved],
      writeLeads: async () => undefined,
      assertValidLead: () => undefined,
      resolveActor: () => actor
    });

    await handlers.post(request({ body: baseBody }), response.value);

    assert.equal(response.status, 409);
    assert.equal(appended, false);
  });
});

function emptyRepository() {
  return {
    readPage: async () => ({ interactions: [], next_cursor: null }),
    findByRequestId: async () => null,
    append: async (interaction: any) => ({ interaction, created: true })
  };
}

function request(input: { body?: unknown; query?: Record<string, unknown> }) {
  return {
    body: input.body,
    query: input.query ?? {},
    headers: {}
  } as unknown as Request;
}

function captureResponse() {
  const capture = {
    status: 200,
    payload: undefined as unknown
  };
  const value = {
    status(code: number) {
      capture.status = code;
      return value;
    },
    json(payload: unknown) {
      capture.payload = payload;
      return value;
    }
  } as unknown as Response;

  return {
    value,
    get status() {
      return capture.status;
    },
    get payload() {
      return capture.payload;
    }
  };
}
