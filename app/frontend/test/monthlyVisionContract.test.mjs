import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const source = (path) => readFileSync(resolve(root, path), "utf8");

describe("monthly vision feature contract", () => {
  it("owns a dedicated app view and stylesheet", () => {
    assert.match(source("App.tsx"), /vision: "月度视野表"/);
    assert.match(source("App.tsx"), /<MonthlyVisionPage/);
    assert.match(source("main.tsx"), /monthly-vision\.css/);
  });

  it("uses an authenticated download without exposing the export password in the URL", () => {
    const api = source("api.ts");
    assert.match(api, /\/api\/monthly-vision\?month=/);
    assert.match(api, /\/api\/export\/monthly-vision\?month=/);
    assert.match(api, /"x-export-password": password/);
    assert.match(api, /"x-crm-username"/);
    assert.match(api, /"x-crm-token"/);
    assert.match(api, /response\.blob\(\)/);
    assert.match(api, /URL\.createObjectURL/);
    assert.match(api, /anchor\.click\(\)/);
    assert.doesNotMatch(api, /monthly-vision\?month=.*&password=/);
    assert.match(api, /\/api\/export\/excel\?password=/);
  });

  it("submits the same export action from the button or Enter key", () => {
    const page = source("MonthlyVisionPage.tsx");
    assert.match(page, /<form className="monthly-vision-export-actions"/);
    assert.match(page, /onSubmit=/);
    assert.match(page, /type="submit"/);
    assert.match(page, /await downloadMonthlyVisionExcel\(month, password\)/);
    assert.doesNotMatch(page, /window\.location\.assign\(monthlyVision/);
  });

  it("exposes the draft, finalize, unlock, and three-column workflow", () => {
    const page = source("MonthlyVisionPage.tsx");
    assert.match(page, /保存草稿/);
    assert.match(page, /确认本月表/);
    assert.match(page, /重新编辑/);
    assert.match(page, /项目名称/);
    assert.match(page, /研发团队/);
    assert.match(page, /联系方式/);
  });
});
