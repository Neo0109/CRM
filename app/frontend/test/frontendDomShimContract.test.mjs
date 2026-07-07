import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function source(path) {
  const fullPath = resolve(__dirname, path);
  assert.equal(existsSync(fullPath), true, `${path} should exist`);
  return readFileSync(fullPath, "utf8");
}

function optionalSource(path) {
  const fullPath = resolve(__dirname, path);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

const mainSource = source("../src/main.tsx");
const appSource = source("../src/App.tsx");
const leadControlsSource = source("../src/features/leads/leadControls.tsx");
const leadConstantsSource = source("../src/features/leads/leadConstants.ts");
const leadsViewSource = source("../src/features/leads/LeadsView.tsx");
const leadDetailSource = source("../src/features/leads/LeadDetail.tsx");
const leadTriageSource = source("../src/leadTriage.ts");
const headerShimSource = optionalSource("../src/HeaderUiRefinement.tsx");
const detailShimSource = optionalSource("../src/DetailUxRefinement.tsx");

describe("frontend DOM shim removal contract", () => {
  it("does not mount header or detail DOM refinement shims from main.tsx", () => {
    assert.doesNotMatch(mainSource, /HeaderUiRefinement/);
    assert.doesNotMatch(mainSource, /DetailUxRefinement/);
    assert.equal(headerShimSource, "", "Header UI rules should live in React source, not a DOM shim component");
    assert.equal(detailShimSource, "", "Detail UI rules should live in React source, not a DOM shim component");
  });

  it("renders the product version and settings boundary directly in App shell", () => {
    assert.match(appSource, /data-brand-label=\{productVersionLabel\}>\{productVersionLabel\}/);
    assert.doesNotMatch(appSource, /SettingsIcon/);
    assert.doesNotMatch(appSource, /switchView\("settings"\)[\s\S]*设置/);
  });

  it("renders stage labels through React select helpers instead of DOM option relabeling", () => {
    assert.match(leadConstantsSource, /export const stageLabels:\s*Record<Stage,\s*string>/);
    for (const [stage, label] of [["new", "New"], ["watch", "Watch"], ["active", "Active"], ["negotiating", "Negotiating"], ["won", "Won"], ["rejected", "Rejected"]]) {
      assert.match(leadConstantsSource, new RegExp(`${stage}:\\s*"${label}"`));
    }
    assert.match(leadControlsSource, /getOptionLabel\?:/);
    assert.match(leadsViewSource, /getOptionLabel=\{stageLabel\}/);
    assert.match(leadDetailSource, /getOptionLabel=\{stageLabel\}/);
  });

  it("keeps bucket order native in Leads sources without post-render movement", () => {
    assert.match(leadConstantsSource, /bucketOptions:[^\n]+=\s*\["全部",\s*"未处理",\s*"待评测",\s*"测试中",\s*"观察池",\s*"跟进中",\s*"推进池",\s*"淘汰池"\]/);
    assert.match(leadConstantsSource, /bucketValues:[^\n]+=\s*\["未处理",\s*"待评测",\s*"测试中",\s*"观察池",\s*"跟进中",\s*"推进池",\s*"淘汰池"\]/);
    assert.match(leadTriageSource, /"测试中"[\s\S]*"观察池"[\s\S]*"跟进中"/);
    assert.doesNotMatch(headerShimSource, /moveBefore|refineBucketOrder/);
  });
});
