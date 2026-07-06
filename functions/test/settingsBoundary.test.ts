import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { onRequestGet, onRequestPatch } from "../api/settings";
import { onRequestPost as onRequestPostSettingsVerification } from "../api/settings-verification";
import type { Env, PagesContext } from "../_lib/crm";

const originalFetch = globalThis.fetch;

const env: Env = {
  SUPABASE_URL: "https://supabase.example",
  SUPABASE_SECRET_KEY: "service-role",
  CRM_USERS_JSON: JSON.stringify([{ username: "neo", password: "secret", role: "admin", permissions: ["*"] }])
};

function authorizedRequest(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-crm-username": "neo",
      "x-crm-token": "secret",
      ...init.headers
    }
  });
}

function context(request: Request): PagesContext {
  return { request, env, params: {} };
}

function installSettingsFetchMock() {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });

    if (url.startsWith("https://supabase.example/rest/v1/crm_leads?select=")) {
      return Response.json([
        {
          id: "__crm_settings__",
          data: {
            bound_email: "ne***@example.com",
            excel_export_password: "excel-secret",
            login_password: "login-secret",
            updated_at: "2026-07-06T00:00:00.000Z"
          }
        }
      ]);
    }

    if (url.startsWith("https://supabase.example/rest/v1/crm_leads?on_conflict=")) {
      return new Response(null, { status: 204 });
    }

    if (url.startsWith("https://api.resend.com/")) {
      return Response.json({ id: "email-1" });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("settings API boundary", () => {
  it("keeps settings status readable without exposing stored secret values", async () => {
    installSettingsFetchMock();

    const response = await onRequestGet(context(authorizedRequest("https://crm.example/api/settings")));
    const payload = await response.json() as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.deepEqual(payload, {
      bound_email: "ne***@example.com",
      has_excel_export_password: true,
      has_login_password: true,
      updated_at: "2026-07-06T00:00:00.000Z"
    });
  });

  it("rejects settings PATCH and does not write Supabase settings", async () => {
    const calls = installSettingsFetchMock();

    const response = await onRequestPatch(context(authorizedRequest("https://crm.example/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ bound_email: "new@example.com" })
    })));
    const payload = await response.json() as { error?: string };

    assert.equal(response.status, 405);
    assert.match(payload.error ?? "", /Cloudflare Variables\/Secrets/);
    assert.equal(calls.some((call) => call.init?.method === "POST"), false);
  });

  it("rejects settings verification and does not write Supabase or send email", async () => {
    const calls = installSettingsFetchMock();

    const response = await onRequestPostSettingsVerification(context(authorizedRequest("https://crm.example/api/settings-verification", {
      method: "POST"
    })));
    const payload = await response.json() as { error?: string };

    assert.equal(response.status, 405);
    assert.match(payload.error ?? "", /online settings changes are disabled/i);
    assert.equal(calls.some((call) => call.init?.method === "POST"), false);
    assert.equal(calls.some((call) => call.url.startsWith("https://api.resend.com/")), false);
  });
});
