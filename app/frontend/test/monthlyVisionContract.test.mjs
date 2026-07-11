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

  it("routes monthly vision through the original full Excel API", () => {
    const api = source("api.ts");
    const page = source("MonthlyVisionPage.tsx");
    assert.match(api, /export function excelExportUrl/);
    assert.match(api, /new URLSearchParams\(\{ password \}\)/);
    assert.match(api, /params\.set\("scope", options\.scope\)/);
    assert.match(page, /window\.location\.assign\(excelExportUrl\(password, \{ scope: "monthly-vision", month \}\)\)/);
    assert.match(page, /syncAccessCookies\(\)/);
    assert.doesNotMatch(page, /\/api\/export\/monthly-vision/);
    assert.doesNotMatch(page, /<iframe/);
    assert.doesNotMatch(api, /response\.blob\(\)/);
    assert.doesNotMatch(api, /URL\.createObjectURL/);
    assert.doesNotMatch(api, /anchor\.click\(\)/);
  });

  it("submits the same shared export action from the button or Enter key", () => {
    const page = source("MonthlyVisionPage.tsx");
    assert.match(page, /onSubmit=\{exportExcel\}/);
    assert.match(page, /type="submit"/);
    assert.match(page, /event\.preventDefault\(\)/);
    assert.match(page, /scope: "monthly-vision"/);
    assert.match(page, /研发名字、游戏名字、联系方式/);
    assert.match(page, /async function exportExcel/);
    assert.match(page, /await saveMonthlyVision\(month, "draft", sheet\.items\)/);
    assert.doesNotMatch(page, /disabled=\{!locked \|\| exporting\}/);
    assert.match(page, /disabled=\{saving \|\| exporting\}/);
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
