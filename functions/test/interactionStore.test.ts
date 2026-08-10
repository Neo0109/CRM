import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  parseInteractionPage,
  prepareInteractionMutation
} from "../_lib/interactionModel.ts";
import {
  readInteractionByRequestId,
  readInteractionPage,
  writeInteractionMutation
} from "../_lib/interactionStore.ts";
import { normalizeLead } from "../_lib/leadModel.ts";

const originalFetch = globalThis.fetch;
const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "server-secret"
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mutation(requestId = "request-store-001") {
  const lead = normalizeLead({
    id: "lead-store",
    project: "Store Game",
    bucket: "推进池",
    due_date: "2026-08-20",
    calendar_enabled: false
  });
  return prepareInteractionMutation({
    request_id: requestId,
    lead_id: lead.id,
    channel: "Email",
    occurred_at: "2026-08-11T09:00:00.000Z",
    summary: "收到发行材料。",
    next_action: "确认条款",
    next_follow_up_date: "2026-08-15"
  }, lead, {
    username: "neo",
    display_name: "Neo",
    role: "admin",
    permissions: ["*"]
  }, "2026-08-11T09:05:00.000Z");
}

describe("interaction Supabase system-row store", () => {
  it("queries authenticated JSONB rows by lead with bounded offset pagination", async () => {
    const first = mutation("request-store-001").interaction;
    const second = mutation("request-store-002").interaction;
    const third = mutation("request-store-003").interaction;
    let requestedUrl = "";

    globalThis.fetch = (async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify([
        { id: first.id, data: first, updated_at: first.occurred_at },
        { id: second.id, data: second, updated_at: second.occurred_at },
        { id: third.id, data: third, updated_at: third.occurred_at }
      ]), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const page = await readInteractionPage(env, "lead-store", { offset: 0, limit: 2 });

    assert.deepEqual(page.interactions, [first, second]);
    assert.equal(parseInteractionPage({ limit: "2", cursor: page.next_cursor }).offset, 2);
    assert.match(requestedUrl, /id=like\.__crm_interaction_event__/);
    assert.match(requestedUrl, /data->>lead_id=eq\.lead-store/);
    assert.match(requestedUrl, /order=updated_at\.desc%2Cid\.desc/);
    assert.match(requestedUrl, /limit=3/);
    assert.doesNotMatch(requestedUrl, /收到发行材料/);
  });

  it("loads idempotency keys and bulk-upserts the event and changed Lead once", async () => {
    const prepared = mutation();
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      if (!init?.method) {
        return new Response(JSON.stringify([
          { id: prepared.interaction.id, data: prepared.interaction }
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    assert.deepEqual(
      await readInteractionByRequestId(env, prepared.interaction.request_id),
      prepared.interaction
    );
    await writeInteractionMutation(env, prepared);

    const write = calls.find((call) => call.init?.method === "POST");
    assert.ok(write);
    const rows = JSON.parse(String(write.init?.body)) as Array<Record<string, unknown>>;
    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, prepared.interaction.id);
    assert.equal(rows[0].updated_at, prepared.interaction.occurred_at);
    assert.equal(rows[1].id, prepared.lead.id);
    assert.equal(rows[1].updated_at, prepared.interaction.created_at);
  });

  it("writes summary-only events without rewriting the Lead and keeps storage errors private", async () => {
    const prepared = mutation("request-store-summary");
    const summaryOnly = {
      ...prepared,
      lead_changed: false,
      calendar_synced: false,
      lead: normalizeLead({ id: "lead-store", project: "Store Game", bucket: "推进池" }),
      interaction: { ...prepared.interaction, calendar_synced: false, next_action: null, next_follow_up_date: null }
    };
    let body = "";

    globalThis.fetch = (async (_input, init) => {
      body = String(init?.body ?? "");
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    await writeInteractionMutation(env, summaryOnly);
    assert.equal((JSON.parse(body) as unknown[]).length, 1);

    globalThis.fetch = (async () => new Response("private contact and summary", { status: 500 })) as typeof fetch;
    await assert.rejects(
      () => readInteractionByRequestId(env, "request-store-summary"),
      (error: unknown) => error instanceof Error
        && error.message === "Interaction storage request failed"
        && !error.message.includes("private")
    );
  });
});
