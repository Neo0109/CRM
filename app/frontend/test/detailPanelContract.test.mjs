import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");
const detailUxSource = readFileSync(resolve(__dirname, "../src/DetailUxRefinement.tsx"), "utf8");

function leadDetailSource() {
  const start = appSource.indexOf("function LeadDetail");
  const end = appSource.indexOf("function leadDecisionHeadline");
  assert.notEqual(start, -1, "LeadDetail should exist");
  assert.notEqual(end, -1, "leadDecisionHeadline should follow LeadDetail");
  return appSource.slice(start, end);
}

function quickActionSource() {
  const start = appSource.indexOf("function quickActionSpecs");
  const end = appSource.indexOf("function BucketButtons");
  assert.notEqual(start, -1, "quickActionSpecs should exist");
  assert.notEqual(end, -1, "BucketButtons should follow quickActionSpecs");
  return appSource.slice(start, end);
}

describe("Lead detail panel contract", () => {
  it("keeps watch and direct drop available from evaluation leads", () => {
    assert.match(quickActionSource(), /lead\.bucket === "待评测"\)\s*return \[testing,\s*watch,\s*drop\]/);
  });

  it("does not render noisy automation/source fields in the default detail editor", () => {
    const detail = leadDetailSource();
    for (const label of [
      "是否符合规则",
      "放大作用",
      "曝光轨迹",
      "旧公开信号",
      "链接，一行一个",
      "排除 / 降权规则",
      "具体评测内容"
    ]) {
      assert.equal(detail.includes(label), false, `${label} should not be shown in the default detail panel`);
    }
  });

  it("keeps source-rule helper from injecting the excluded-rule explainer", () => {
    assert.equal(detailUxSource.includes("排除 / 降权规则"), false);
    assert.equal(detailUxSource.includes("clarifyRuleFlags"), false);
  });
});
