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

  it("uses a native authenticated form download without Blob simulation", () => {
    const api = source("api.ts");
    const page = source("MonthlyVisionPage.tsx");
    assert.match(api, /export function syncAccessCookies/);
    assert.match(page, /action="\/api\/export\/monthly-vision"/);
    assert.match(page, /method="post"/);
    assert.match(page, /target=\{monthlyVisionDownloadTarget\}/);
    assert.match(page, /type="hidden" name="month"/);
    assert.match(page, /type="password" name="password"/);
    assert.match(page, /<iframe ref=\{exportFrameRef\}/);
    assert.doesNotMatch(api, /response\.blob\(\)/);
    assert.doesNotMatch(api, /URL\.createObjectURL/);
    assert.doesNotMatch(api, /anchor\.click\(\)/);
    assert.match(api, /\/api\/export\/excel\?password=/);
  });

  it("submits the same native form from the button or Enter key", () => {
    const page = source("MonthlyVisionPage.tsx");
    assert.match(page, /onSubmit=\{exportExcel\}/);
    assert.match(page, /type="submit"/);
    assert.match(page, /syncAccessCookies\(\)/);
    assert.match(page, /contentDocument/);
    assert.match(page, /JSON\.parse\(text\)/);
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
