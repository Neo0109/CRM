import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

const assistantSource = readFileSync(new URL("../src/AssistantPage.tsx", import.meta.url), "utf8");

describe("assistant quality product contract", () => {
  it("uses shared assistant quality helpers instead of inline-only hints", () => {
    assert.match(assistantSource, /assistantQuality/);
    assert.match(assistantSource, /analyzeAssistantDraft/);
    assert.match(assistantSource, /buildAssistantResultHints/);
  });

  it("renders pre-submit quality and post-submit supplement guidance", () => {
    assert.match(assistantSource, /录入质量/);
    assert.match(assistantSource, /补充建议/);
    assert.match(assistantSource, /draftAnalysis\.signals/);
    assert.match(assistantSource, /resultHints/);
  });
});
