import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

const diagnosticsSource = readFileSync(new URL("../src/AutomationDiagnosticsPage.tsx", import.meta.url), "utf8");

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
});
