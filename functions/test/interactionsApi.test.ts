import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { prepareInteractionMutation } from "../_lib/interactionModel.ts";
import { normalizeLead } from "../_lib/leadModel.ts";
import { onRequestGet, onRequestPost } from "../api/interactions.ts";

const originalFetch = globalThis.fetch;
const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "server-secret",
  CRM_USERS_JSON: JSON.stringify([
    { username: "neo", password: "login-secret", display_name: "Neo", role: "admin" }
  ])
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function authHeaders() {
  return {
    "x-crm-username": "neo",
    "x-crm-token": "login-secret",
    "Content-Type": "application/json"
  };
}

function leadRow(bucket: "跟进中" | "推进池" | "观察池" = "跟进中") {
  return {
    id: "lead-api",
    data: {
      id: "lead-api",
      project: "API Game",
      bucket,
      next_action: "旧动作",
      due_date: "2026-08-20",
      calendar_enabled: false,
      follow_up_interval: "weekly"
    }
  };
}

const postBody = {
  request_id: "request-api-001",
  lead_id: "lead-api",
  channel: "会议",
  occurred_at: "2026-08-11T10:00:00+08:00",
  summary: "确认商务条件。",
  next_action: "发送修订版",
  next_follow_up_date: "2026-08-15"
};

describe("interactions Functions API", () => {
  it("requires CRM authentication before reading or writing", async () => {
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response("[]");
    }) as typeof fetch;

    const response = await onRequestGet({
      request: new Request("https://crm.example/api/interactions?lead_id=lead-api"),
      env,
      params: {}
    });

    assert.equal(response.status, 401);
    assert.equal(fetchCalled, false);
  });

  it("creates a dated interaction with one atomic system-row and Lead upsert", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (init?.method === "POST") return new Response(null, { status: 204 });
      if (url.includes("id=eq.")) {
        return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify([leadRow()]), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }) as typeof fetch;

    const response = await onRequestPost({
      request: new Request("https://crm.example/api/interactions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(postBody)
      }),
      env,
      params: {}
    });
    const payload = await response.json() as Record<string, any>;

    assert.equal(response.status, 201);
    assert.equal(payload.calendar_synced, true);
    assert.equal(payload.lead.next_action, "发送修订版");
    assert.equal(payload.lead.due_date, "2026-08-15");
    assert.equal(payload.lead.calendar_enabled, true);
    assert.equal(payload.lead.follow_up_interval, "custom");

    const write = calls.find((call) => call.init?.method === "POST");
    assert.ok(write);
    const rows = JSON.parse(String(write.init?.body)) as Array<{ id: string }>;
    assert.equal(rows.length, 2);
    assert.match(rows[0].id, /^__crm_interaction_event__/);
    assert.equal(rows[1].id, "lead-api");
  });

  it("returns an existing request id without another write", async () => {
    const lead = normalizeLead(leadRow().data);
    const existing = prepareInteractionMutation(postBody, lead, {
      username: "neo",
      display_name: "Neo",
      role: "admin",
      permissions: []
    }, "2026-08-11T03:00:00.000Z").interaction;
    let writes = 0;

    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (init?.method === "POST") {
        writes += 1;
        return new Response(null, { status: 204 });
      }
      const data = url.includes("id=eq.")
        ? [{ id: existing.id, data: existing }]
        : [leadRow()];
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }) as typeof fetch;

    const response = await onRequestPost({
      request: new Request("https://crm.example/api/interactions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(postBody)
      }),
      env,
      params: {}
    });

    assert.equal(response.status, 200);
    assert.equal(writes, 0);
    assert.equal((await response.json() as Record<string, any>).interaction.id, existing.id);
  });

  it("rejects a Lead that left the allowed pools and rejects invalid date ordering", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify([leadRow("观察池")]), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })) as typeof fetch;

    const moved = await onRequestPost({
      request: new Request("https://crm.example/api/interactions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(postBody)
      }),
      env,
      params: {}
    });
    assert.equal(moved.status, 409);

    globalThis.fetch = (async () => new Response(JSON.stringify([leadRow()]), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })) as typeof fetch;
    const invalidDate = await onRequestPost({
      request: new Request("https://crm.example/api/interactions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...postBody,
          request_id: "request-api-002",
          next_follow_up_date: "2026-08-10"
        })
      }),
      env,
      params: {}
    });
    assert.equal(invalidDate.status, 400);
  });

  it("returns a bounded per-Lead page and an opaque next cursor", async () => {
    const lead = normalizeLead(leadRow("推进池").data);
    const event = prepareInteractionMutation({
      ...postBody,
      request_id: "request-api-page",
      lead_id: lead.id
    }, lead, {
      username: "neo",
      display_name: "Neo",
      role: "admin",
      permissions: []
    }, "2026-08-11T03:00:00.000Z").interaction;
    let reads = 0;

    globalThis.fetch = (async () => {
      reads += 1;
      const data = reads === 1
        ? [leadRow("推进池")]
        : [
            { id: event.id, data: event, updated_at: event.occurred_at },
            { id: event.id + "-2", data: { ...event, id: event.id + "-2", request_id: "request-api-page-2" }, updated_at: event.occurred_at }
          ];
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }) as typeof fetch;

    const response = await onRequestGet({
      request: new Request("https://crm.example/api/interactions?lead_id=lead-api&limit=1", {
        headers: authHeaders()
      }),
      env,
      params: {}
    });
    const payload = await response.json() as Record<string, any>;

    assert.equal(response.status, 200);
    assert.equal(payload.interactions.length, 1);
    assert.equal(typeof payload.next_cursor, "string");
  });
});
