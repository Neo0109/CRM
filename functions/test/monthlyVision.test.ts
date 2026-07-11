import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { onRequestGet as getMonthlyVision, onRequestPut as putMonthlyVision } from "../api/monthly-vision";
import { onRequestGet as exportExcel } from "../api/export/excel";
import { onRequestGet as exportMonthlyVision, onRequestPost as postMonthlyVisionExport } from "../api/export/monthly-vision";
import type { Env, PagesContext } from "../_lib/crm";
import { normalizeLead } from "../_lib/leadModel";
import {
  buildGeneratedMonthlyVisionSheet,
  formatMonthlyVisionContacts,
  monthlyVisionRowId,
  validateFinalizedMonthlyVisionItems
} from "../_lib/monthlyVision";

const originalFetch = globalThis.fetch;

const env: Env = {
  SUPABASE_URL: "https://supabase.example",
  SUPABASE_SECRET_KEY: "service-role",
  CRM_USERS_JSON: JSON.stringify([{ username: "neo", password: "secret", role: "admin", permissions: ["*"] }]),
  EXCEL_EXPORT_PASSWORD: "excel-secret"
};

function lead(project: string, bucket: Parameters<typeof normalizeLead>[0]["bucket"], team: string | null, contact: string) {
  return normalizeLead({
    id: `lead-${project.toLowerCase().replaceAll(" ", "-")}`,
    project,
    bucket,
    team,
    contact_methods: contact ? [{ type: "Email", value: contact, note: "BD" }] : []
  }, { today: "2026-07-10" });
}

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

function cookieAuthorizedFormRequest(month: string, password: string) {
  const form = new FormData();
  form.set("month", month);
  form.set("password", password);
  return new Request("https://crm.example/api/export/monthly-vision", {
    method: "POST",
    headers: { cookie: "crm_username=neo; crm_access_token=secret" },
    body: form
  });
}

function context(request: Request): PagesContext {
  return { request, env, params: {} };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("monthly vision model", () => {
  it("prefills active workflow buckets, snapshots three fields, and sorts by project", () => {
    const sheet = buildGeneratedMonthlyVisionSheet([
      lead("Zulu", "跟进中", "Studio Z", "z@example.com"),
      lead("Dropped", "淘汰池", "Studio D", "d@example.com"),
      lead("Alpha", "待评测", "Studio A", "a@example.com"),
      lead("Inbox", "未处理", "Studio I", "i@example.com"),
      lead("Testing", "测试中", "Studio T", "t@example.com"),
      lead("Pushing", "推进池", "Studio P", "p@example.com"),
      lead("Watching", "观察池", "Studio W", "w@example.com")
    ], "2026-07", "2026-07-10T02:00:00.000Z");

    assert.equal(sheet.status, "draft");
    assert.equal(sheet.month, "2026-07");
    assert.deepEqual(sheet.items.map((item) => item.project), ["Alpha", "Pushing", "Testing", "Zulu"]);
    assert.deepEqual(sheet.items[0], {
      lead_id: "lead-alpha",
      project: "Alpha",
      developer: "Studio A",
      contacts: "Email: a@example.com (BD)"
    });
  });

  it("formats multiple contacts on separate lines and validates finalized rows", () => {
    assert.equal(formatMonthlyVisionContacts([
      { type: "微信/QQ", value: "neo0109" },
      { type: "Email", value: "neo@example.com", note: "主联系人" }
    ]), "微信/QQ: neo0109\nEmail: neo@example.com (主联系人)");

    assert.deepEqual(validateFinalizedMonthlyVisionItems([
      { lead_id: "lead-a", project: "A", developer: "", contacts: "a@example.com" },
      { lead_id: "lead-a", project: "A duplicate", developer: "Studio", contacts: "" }
    ]), [
      "A：缺少研发团队",
      "A duplicate：缺少联系方式",
      "存在重复项目：lead-a"
    ]);
  });
});

describe("monthly vision API", () => {
  it("returns a generated draft when the month has no stored sheet", async () => {
    const leads = [lead("Active Game", "跟进中", "Active Studio", "active@example.com")];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(`id=eq.${monthlyVisionRowId("2026-07")}`)) return Response.json([]);
      if (url.includes("select=id,data&order=updated_at.desc")) {
        return Response.json(leads.map((item) => ({ id: item.id, data: item })));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const response = await getMonthlyVision(context(authorizedRequest("https://crm.example/api/monthly-vision?month=2026-07")));
    const payload = await response.json() as { source: string; sheet: { items: { project: string }[] } };

    assert.equal(response.status, 200);
    assert.equal(payload.source, "generated");
    assert.equal(payload.sheet.items[0].project, "Active Game");
  });

  it("saves a finalized snapshot as a system row", async () => {
    const activeLead = lead("Active Game", "跟进中", "Active Studio", "active@example.com");
    let writtenBody = "";
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes(`id=eq.${monthlyVisionRowId("2026-07")}`)) return Response.json([]);
      if (url.includes("select=id,data&order=updated_at.desc")) return Response.json([{ id: activeLead.id, data: activeLead }]);
      if (url.includes("on_conflict=id")) {
        writtenBody = String(init?.body ?? "");
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const response = await putMonthlyVision(context(authorizedRequest("https://crm.example/api/monthly-vision?month=2026-07", {
      method: "PUT",
      body: JSON.stringify({
        status: "finalized",
        items: [{ lead_id: activeLead.id, project: "Active Game", developer: "Active Studio", contacts: "active@example.com" }]
      })
    })));
    const payload = await response.json() as { status: string; finalized_by: string | null };
    const rows = JSON.parse(writtenBody) as { id: string; data: { type: string; month: string } }[];

    assert.equal(response.status, 200);
    assert.equal(payload.status, "finalized");
    assert.equal(payload.finalized_by, "Neo");
    assert.equal(rows[0].id, monthlyVisionRowId("2026-07"));
    assert.equal(rows[0].data.type, "monthly_vision_sheet");
    assert.equal(rows[0].data.month, "2026-07");
  });

  it("exports only finalized snapshots with exactly three Excel columns", async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(`id=eq.${monthlyVisionRowId("2026-07")}`)) {
        return Response.json([{ id: monthlyVisionRowId("2026-07"), data: {
          type: "monthly_vision_sheet",
          month: "2026-07",
          status: "finalized",
          items: [{ lead_id: "lead-a", project: "A & B", developer: "研发 <甲>", contacts: "Email: a@example.com\n微信: neo" }],
          created_at: "2026-07-10T00:00:00.000Z",
          updated_at: "2026-07-10T00:00:00.000Z",
          finalized_at: "2026-07-10T00:00:00.000Z",
          updated_by: "Neo",
          finalized_by: "Neo"
        } }]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const response = await exportMonthlyVision(context(authorizedRequest("https://crm.example/api/export/monthly-vision?month=2026-07&password=excel-secret")));
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Disposition"), "attachment; filename=monthly-vision-2026-07.xls");
    assert.equal((html.match(/<th>/g) ?? []).length, 3);
    assert.match(html, /<th>项目名称<\/th><th>研发团队<\/th><th>联系方式<\/th>/);
    assert.match(html, /A &amp; B/);
    assert.match(html, /研发 &lt;甲&gt;/);
  });
  it("exports finalized snapshots through native form POST with cookie authentication", async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(`id=eq.${monthlyVisionRowId("2026-07")}`)) {
        return Response.json([{ id: monthlyVisionRowId("2026-07"), data: {
          type: "monthly_vision_sheet",
          month: "2026-07",
          status: "finalized",
          items: [{ lead_id: "lead-a", project: "Native Export", developer: "Studio", contacts: "Email: native@example.com" }],
          created_at: "2026-07-10T00:00:00.000Z",
          updated_at: "2026-07-10T00:00:00.000Z",
          finalized_at: "2026-07-10T00:00:00.000Z",
          updated_by: "Neo",
          finalized_by: "Neo"
        } }]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const response = await postMonthlyVisionExport(context(cookieAuthorizedFormRequest("2026-07", "excel-secret")));
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Disposition"), "attachment; filename=monthly-vision-2026-07.xls");
    assert.equal((html.match(/<th>/g) ?? []).length, 3);
    assert.match(html, /Native Export/);
  });

  it("returns native form errors for a bad password, missing sheet, and draft sheet", async () => {
    const badPassword = await postMonthlyVisionExport(context(cookieAuthorizedFormRequest("2026-07", "wrong")));
    assert.equal(badPassword.status, 403);
    assert.deepEqual(await badPassword.json(), { error: "Excel 导出密码错误" });

    globalThis.fetch = (async () => Response.json([])) as typeof fetch;
    const missing = await postMonthlyVisionExport(context(cookieAuthorizedFormRequest("2026-07", "excel-secret")));
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "该月份尚未保存视野表" });

    globalThis.fetch = (async () => Response.json([{ id: monthlyVisionRowId("2026-07"), data: {
      type: "monthly_vision_sheet",
      month: "2026-07",
      status: "draft",
      items: [{ lead_id: "lead-a", project: "Draft", developer: "Studio", contacts: "Email: draft@example.com" }],
      created_at: "2026-07-10T00:00:00.000Z",
      updated_at: "2026-07-10T00:00:00.000Z",
      finalized_at: null,
      updated_by: "Neo",
      finalized_by: null
    } }])) as typeof fetch;
    const draft = await postMonthlyVisionExport(context(cookieAuthorizedFormRequest("2026-07", "excel-secret")));
    assert.equal(draft.status, 409);
    assert.deepEqual(await draft.json(), { error: "请先确认本月视野表，再导出 Excel" });
  });
  it("preserves the default full Excel export on the shared endpoint", async () => {
    const activeLead = lead("Full Export", "跟进中", "Full Studio", "full@example.com");
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("select=id,data&order=updated_at.desc")) return Response.json([{ id: activeLead.id, data: activeLead }]);
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const response = await exportExcel(context(authorizedRequest("https://crm.example/api/export/excel?password=excel-secret")));
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Disposition") ?? "", /^attachment; filename=sourcing-crm-leads-/);
    assert.ok((html.match(/<th>/g) ?? []).length > 3);
    assert.match(html, /Full Export/);
  });

  it("exports the finalized three-column sheet through the shared Excel endpoint", async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(`id=eq.${monthlyVisionRowId("2026-07")}`)) {
        return Response.json([{ id: monthlyVisionRowId("2026-07"), data: {
          type: "monthly_vision_sheet",
          month: "2026-07",
          status: "finalized",
          items: [{ lead_id: "lead-a", project: "Shared Export", developer: "Studio", contacts: "Email: shared@example.com" }],
          created_at: "2026-07-10T00:00:00.000Z",
          updated_at: "2026-07-10T00:00:00.000Z",
          finalized_at: "2026-07-10T00:00:00.000Z",
          updated_by: "Neo",
          finalized_by: "Neo"
        } }]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const response = await exportExcel(context(authorizedRequest("https://crm.example/api/export/excel?scope=monthly-vision&month=2026-07&password=excel-secret")));
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Disposition"), "attachment; filename=monthly-vision-2026-07.xls");
    assert.equal((html.match(/<th>/g) ?? []).length, 3);
    assert.match(html, /<th>项目名称<\/th><th>研发团队<\/th><th>联系方式<\/th>/);
    assert.match(html, /Shared Export/);
  });

  it("returns shared endpoint errors for bad password, missing sheet, and draft sheet", async () => {
    const badPassword = await exportExcel(context(authorizedRequest("https://crm.example/api/export/excel?scope=monthly-vision&month=2026-07&password=wrong")));
    assert.equal(badPassword.status, 403);
    assert.deepEqual(await badPassword.json(), { error: "Excel 导出密码错误" });

    globalThis.fetch = (async () => Response.json([])) as typeof fetch;
    const missing = await exportExcel(context(authorizedRequest("https://crm.example/api/export/excel?scope=monthly-vision&month=2026-07&password=excel-secret")));
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "该月份尚未保存视野表" });

    globalThis.fetch = (async () => Response.json([{ id: monthlyVisionRowId("2026-07"), data: {
      type: "monthly_vision_sheet",
      month: "2026-07",
      status: "draft",
      items: [{ lead_id: "lead-a", project: "Draft", developer: "Studio", contacts: "Email: draft@example.com" }],
      created_at: "2026-07-10T00:00:00.000Z",
      updated_at: "2026-07-10T00:00:00.000Z",
      finalized_at: null,
      updated_by: "Neo",
      finalized_by: null
    } }])) as typeof fetch;
    const draft = await exportExcel(context(authorizedRequest("https://crm.example/api/export/excel?scope=monthly-vision&month=2026-07&password=excel-secret")));
    assert.equal(draft.status, 409);
    assert.deepEqual(await draft.json(), { error: "请先确认本月视野表，再导出 Excel" });
  });
});
