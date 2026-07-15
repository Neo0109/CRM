import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { onRequestGet as exportCsv } from "../api/export/csv";
import { onRequestGet as exportExcel } from "../api/export/excel";
import { onRequestGet as exportJson } from "../api/export/json";
import type { Env, PagesContext } from "../_lib/crm";
import { normalizeLead } from "../_lib/leadModel";

const originalFetch = globalThis.fetch;
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function env(): Env {
  return {
    SUPABASE_URL: "https://supabase.example",
    SUPABASE_SECRET_KEY: "service-secret",
    CRM_USERS_JSON: JSON.stringify([{ username: "neo", password: "crm-secret", display_name: "Neo" }]),
    EXCEL_EXPORT_PASSWORD: "excel-secret"
  };
}

function context(request: Request): PagesContext {
  return { request, env: env(), params: {} };
}

function authorizedRequest(url: string, headers: HeadersInit = {}) {
  return new Request(url, {
    headers: {
      cookie: "crm_username=neo; crm_access_token=crm-secret",
      ...headers
    }
  });
}

function mockUnlabeledLead() {
  const lead = normalizeLead({ project: "Unlabeled Export", priority: null }, { today: "2026-07-15" });
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/rest/v1/crm_leads?select=id,data&order=updated_at.desc")) {
      return Response.json([{ id: lead.id, data: lead }]);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  return lead;
}

describe("priority export presentation", () => {
  it("exports an unlabeled priority as an empty human value, never literal priority null", async () => {
    mockUnlabeledLead();

    const jsonResponse = await exportJson(context(authorizedRequest("https://crm.example/api/export/json")));
    const json = await jsonResponse.text();
    assert.equal(jsonResponse.status, 200);
    assert.match(json, /"priority":\s*""/);
    assert.doesNotMatch(json, /"priority":\s*null/);

    const csvResponse = await exportCsv(context(authorizedRequest("https://crm.example/api/export/csv")));
    const csv = await csvResponse.text();
    assert.equal(csvResponse.status, 200);
    assert.doesNotMatch(csv, /"null"/);

    const excelResponse = await exportExcel(context(authorizedRequest("https://crm.example/api/export/excel", { "x-export-password": "excel-secret" })));
    const excel = await excelResponse.text();
    assert.equal(excelResponse.status, 200);
    assert.doesNotMatch(excel, />null</);
  });

  it("provides a non-mutating canonical export projection", async () => {
    const lead = mockUnlabeledLead();
    const leadModel = await import("../_lib/leadModel");
    const leadsForExport = Reflect.get(leadModel, "leadsForExport");

    assert.equal(typeof leadsForExport, "function");
    assert.deepEqual(leadsForExport([lead])[0].priority, "");
    assert.equal(lead.priority, null);
  });

  it("keeps the local backend JSON export on the canonical projection", async () => {
    const backendModel = await readFile(`${repoRoot}app/backend/src/lib/backendLeadModel.ts`, "utf8");
    const backendServer = await readFile(`${repoRoot}app/backend/src/server.ts`, "utf8");

    assert.match(backendModel, /leadsForExport as canonicalLeadsForExport/);
    assert.match(backendServer, /JSON\.stringify\(backendLeadsForExport\(leads\), null, 2\)/);
  });
});
