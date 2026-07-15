import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { onRequestPost } from "../api/leads/import-daily-report";
import type { Env, PagesContext } from "../_lib/crm";

const originalFetch = globalThis.fetch;
const env: Env = {
  SUPABASE_URL: "https://supabase.example",
  SUPABASE_SECRET_KEY: "service-key",
  CRM_USERNAME: "neo",
  CRM_ACCESS_TOKEN: "access-token",
  CRM_AUTOMATION_TOKEN: "automation-token"
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("daily report import API", () => {
  it("returns synced=true and writes only new JSON leads in create-only mode", async () => {
    const writes = installSupabaseMock([existingRow()]);
    const response = await onRequestPost(context(reportRequest("?mode=create-only", {
      push_pool: [
        { project: "Steam Match", steam_app_id: "777", priority: null, notes: "must not overwrite" },
        {
          project: "New Game",
          steam_app_id: "999",
          priority: null,
          sourcing_lane: "china_heat_ops",
          sourcing_rule_version: "sourcing-rules-v7.1",
          sourcing_run_type: "initial_backfill"
        }
      ]
    })));
    const payload = await response.json() as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(payload.synced, true);
    assert.equal(payload.created, 1);
    assert.equal(payload.skipped_existing, 1);
    assert.equal(payload.updated, 0);
    assert.equal(payload.total, 2);
    assert.equal(writes.length, 1);
    assert.equal(new Headers(writes[0].init.headers).get("Prefer"), "resolution=ignore-duplicates,return=minimal");

    const rows = JSON.parse(String(writes[0].init.body)) as Array<{ id: string; data: Record<string, unknown>; updated_at: string }>;
    assert.equal(rows.length, 1);
    assert.deepEqual(Object.keys(rows[0]).sort(), ["data", "id", "updated_at"]);
    assert.equal(rows[0].data.project, "New Game");
    assert.equal(rows[0].data.priority, null);
    assert.equal(rows[0].data.sourcing_lane, "china_heat_ops");
    assert.equal(rows.some((row) => row.id === "lead-existing"), false);
    assert.equal(rows.some((row) => row.data.notes === "must not overwrite"), false);
  });

  it("keeps the default merge response and write behavior when mode is omitted", async () => {
    const writes = installSupabaseMock([existingRow()]);
    const response = await onRequestPost(context(reportRequest("", {
      push_pool: [{ project: "Steam Match", steam_app_id: "777", notes: "default merge" }]
    })));
    const payload = await response.json() as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(payload.created, 0);
    assert.equal(payload.updated, 1);
    assert.equal("synced" in payload, false);
    assert.equal("skipped_existing" in payload, false);
    assert.equal(writes.length, 1);
    assert.equal(new Headers(writes[0].init.headers).get("Prefer"), "resolution=merge-duplicates,return=minimal");
  });

  it("accepts the configured automation bearer token for create-only workflow imports", async () => {
    const writes = installSupabaseMock([]);
    const request = reportRequest("?mode=create-only", {
      push_pool: [{
        project: "Automated Heat Lead",
        steam_app_id: "12345",
        priority: null,
        sourcing_lane: "china_heat_ops",
        sourcing_rule_version: "sourcing-rules-v7.1",
        sourcing_run_type: "initial_backfill"
      }]
    });
    request.headers.delete("x-crm-username");
    request.headers.delete("x-crm-token");
    request.headers.set("Authorization", "Bearer automation-token");

    const response = await onRequestPost(context(request));
    const payload = await response.json() as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(payload.synced, true);
    assert.equal(payload.created, 1);
    assert.equal(payload.updated, 0);
    assert.equal(writes.length, 1);
  });
});

function context(request: Request): PagesContext {
  return { request, env, params: {} };
}

function reportRequest(search: string, overrides: { push_pool?: unknown[]; watch_pool?: unknown[]; drop_pool?: unknown[] }) {
  return new Request(`https://crm.example/api/leads/import-daily-report${search}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-crm-username": "neo",
      "x-crm-token": "access-token"
    },
    body: JSON.stringify({
      report_date: "2026-07-15",
      summary: "API contract test",
      insights: [],
      push_pool: overrides.push_pool ?? [],
      watch_pool: overrides.watch_pool ?? [],
      drop_pool: overrides.drop_pool ?? []
    })
  });
}

function existingRow() {
  return {
    id: "lead-existing",
    data: {
      id: "lead-existing",
      project: "Existing Game",
      steam_app_id: "777",
      priority: "P0",
      owner: "Neo",
      notes: "protected existing fields",
      first_seen: "2026-07-01"
    }
  };
}

function installSupabaseMock(rows: unknown[]) {
  const writes: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith("https://supabase.example/rest/v1/crm_leads?select=")) {
      return Response.json(rows);
    }
    if (url === "https://supabase.example/rest/v1/crm_leads?on_conflict=id") {
      writes.push({ url, init });
      return new Response(null, { status: 201 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  return writes;
}
