import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const detailSource = readFileSync(resolve(__dirname, "../src/features/leads/LeadDetail.tsx"), "utf8");
const workflowSource = readFileSync(resolve(__dirname, "../src/features/leads/leadWorkflow.ts"), "utf8");
const detailUxSource = readFileSync(resolve(__dirname, "../src/DetailUxRefinement.tsx"), "utf8");

function leadDetailSource() {
  const start = detailSource.indexOf("export function LeadDetail");
  const end = detailSource.indexOf("function leadDecisionHeadline");
  assert.notEqual(start, -1, "LeadDetail should exist");
  assert.notEqual(end, -1, "leadDecisionHeadline should follow LeadDetail");
  return detailSource.slice(start, end);
}

function quickActionSource() {
  assert.match(workflowSource, /export function buildQuickActionSpecs/);
  return workflowSource;
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

  it("renders native review quick-fill actions for assistant checklist gaps", () => {
    const detail = leadDetailSource();
    assert.match(detailSource, /buildLeadReviewChecklist/);
    assert.match(detailSource, /function ReviewActionPanel/);
    assert.match(detail, /复核快填/);
    assert.match(detail, /保存复核字段/);
    assert.match(detail, /添加联系方式行/);
    assert.match(detail, /reviewChecklist\.some\(\(item\) => item\.key !== "ready"\)/);
    assert.match(detail, /SteamLinkEditor/);
    assert.match(detail, /label="Owner"/);
    assert.match(detail, /label="Due Date"/);
    assert.match(detail, /label="下一步动作"/);
    assert.match(detail, /label="发行结构"/);
  });

  it("does not hide the native due-date editor through DOM mutation", () => {
    assert.equal(detailUxSource.includes("foldRawDueDateField"), false);
    assert.equal(detailUxSource.includes("data-raw-due-date-field"), false);
    assert.equal(detailUxSource.includes("下次跟进日统一在“日历”里设置"), false);
  });
});
