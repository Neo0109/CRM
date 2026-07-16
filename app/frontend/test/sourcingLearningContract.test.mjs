import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

const diagnosticsSource = readFileSync(new URL("../src/AutomationDiagnosticsPage.tsx", import.meta.url), "utf8");
const viewModelSource = readFileSync(new URL("../src/sourcingLearningView.ts", import.meta.url), "utf8");

describe("sourcing learning visualization contract", () => {
  it("keeps Sourcing Learning as a diagnostics-page enhancement backed by a view-model", () => {
    assert.match(diagnosticsSource, /buildSourcingLearningView/);
    assert.match(diagnosticsSource, /SourcingLearningBlock/);
    assert.doesNotMatch(diagnosticsSource, /setView\("learning"\)|view === "learning"/);
  });

  it("renders sample accumulation, signal review, positive and negative samples, and top drop reasons", () => {
    assert.match(diagnosticsSource, /样本积累/);
    assert.match(diagnosticsSource, /信号复盘/);
    assert.match(diagnosticsSource, /正向样本/);
    assert.match(diagnosticsSource, /负向样本/);
    assert.match(diagnosticsSource, /Top 淘汰原因/);
    assert.match(diagnosticsSource, /view\.signalSections/);
  });

  it("renders mutually exclusive precision cohorts without quantity-control shortcuts", () => {
    assert.match(diagnosticsSource, /精度与 cohort/);
    assert.match(diagnosticsSource, /view\.cohortItems/);
    assert.match(viewModelSource, /常规 Sourcing/);
    assert.match(viewModelSource, /EA 高热/);
    assert.match(viewModelSource, /中文热度/);
    assert.match(viewModelSource, /initial_backfill/);
    assert.doesNotMatch(diagnosticsSource, /每日上限|最低数量|截断合格/);
  });
});
