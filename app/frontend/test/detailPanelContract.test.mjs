import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const detailSource = readFileSync(resolve(__dirname, "../src/features/leads/LeadDetail.tsx"), "utf8");
const workflowSource = readFileSync(resolve(__dirname, "../src/features/leads/leadWorkflow.ts"), "utf8");
const detailUxPath = resolve(__dirname, "../src/DetailUxRefinement.tsx");
const detailUxSource = existsSync(detailUxPath) ? readFileSync(detailUxPath, "utf8") : "";
const aestheticSource = readFileSync(resolve(__dirname, "../src/aesthetic-refresh.css"), "utf8");
const leadDetailStyleSource = readFileSync(resolve(__dirname, "../src/lead-detail.css"), "utf8");
const manualSource = readFileSync(resolve(__dirname, "../src/manual.css"), "utf8");

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

  it("keeps desktop review detail layout scannable and protected from the floating add action", () => {
    const detail = leadDetailSource();
    assert.match(detail, /data-detail-layout="pc-review-polish"/);
    assert.match(detail, /className="form-section detail-section detail-section-core"/);
    assert.match(detail, /className="form-section detail-section detail-section-followup"/);
    assert.match(detail, /className="form-section detail-section detail-section-contacts"/);
    assert.match(detail, /className="form-section detail-section detail-section-product"/);
    for (const label of ["核心复核", "商务跟进", "联系方式", "产品与发行"]) {
      assert.match(detail, new RegExp(label), `${label} should be a first-class detail section`);
    }
    assert.match(detail, /detail-floating-safe-zone/);
    assert.match(leadDetailStyleSource, /\.detail-panel\[data-detail-layout="pc-review-polish"\]/);
    assert.match(leadDetailStyleSource, /\.detail-section/);
    assert.doesNotMatch(
      aestheticSource,
      /\.detail-panel\[data-detail-layout="pc-review-polish"\]/,
      "PC Lead Detail layout should live in lead-detail.css, not the global aesthetic override"
    );
    assert.match(manualSource, /\.app-shell\.has-manual-floating-action[\s\S]*\.detail-panel\[data-detail-layout="pc-review-polish"\]/);
  });

  it("prevents the desktop detail rail from becoming a sideways scrolling form", () => {
    assert.match(
      leadDetailStyleSource,
      /\.detail-panel\[data-detail-layout="pc-review-polish"\][\s\S]*overflow-x:\s*hidden/,
      "pc review detail panel should clip horizontal overflow instead of exposing a sideways scrollbar"
    );
    assert.match(
      leadDetailStyleSource,
      /\.detail-panel\[data-detail-layout="pc-review-polish"\][\s\S]*--detail-review-columns:\s*minmax\(0,\s*1fr\)/,
      "pc review detail panel should default to a single shrink-safe review column"
    );
    assert.match(
      leadDetailStyleSource,
      /\.detail-panel\[data-detail-layout="pc-review-polish"\]\s+\.review-action-form[\s\S]*grid-template-columns:\s*var\(--detail-review-columns\)/,
      "review quick-fill form should consume the detail panel column contract"
    );
    assert.match(
      leadDetailStyleSource,
      /\.detail-panel\[data-detail-layout="pc-review-polish"\]\s+\.contact-row[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
      "contact editor rows should collapse inside the narrow detail rail"
    );
    assert.match(
      leadDetailStyleSource,
      /\.detail-panel\[data-detail-layout="pc-review-polish"\]\s+\.review-action-head[\s\S]*flex-direction:\s*column/,
      "review quick-fill header should not force a wide two-sided row"
    );
    assert.match(
      manualSource,
      /\.app-shell\.has-manual-floating-action:has\(\.detail-panel\[data-detail-layout="pc-review-polish"\]\)[\s\S]*\.manual-floating-button[\s\S]*display:\s*none/,
      "global add lead action should not float over an active detail review rail"
    );
  });
});
