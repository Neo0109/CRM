import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const assistantSource = readFileSync(new URL("../src/AssistantPage.tsx", import.meta.url), "utf8");
const leadsViewSource = readFileSync(new URL("../src/features/leads/LeadsView.tsx", import.meta.url), "utf8");

describe("assistant to Leads Review handoff contract", () => {
  it("lets Assistant results send imported leads to Leads Review", () => {
    assert.match(assistantSource, /onReviewLead/);
    assert.match(assistantSource, /reviewTarget/);
    assert.match(assistantSource, /source:\s*"assistant"/);
    assert.match(assistantSource, /去 Leads Review 复核/);
  });

  it("keeps App as the cross-view handoff owner", () => {
    assert.match(appSource, /handleAssistantReviewLead/);
    assert.match(appSource, /leadReviewTarget/);
    assert.match(appSource, /<AssistantPage[\s\S]*onReviewLead=\{handleAssistantReviewLead\}/);
    assert.match(appSource, /<LeadsView[\s\S]*reviewTarget=\{leadReviewTarget\}/);
  });

  it("keeps LeadsView responsible for resolving and selecting the target lead", () => {
    assert.match(leadsViewSource, /resolveLeadReviewTarget/);
    assert.match(leadsViewSource, /buildLeadReviewChecklist/);
    assert.match(leadsViewSource, /reviewTarget/);
    assert.match(leadsViewSource, /setSelectedId\(resolved\.lead\.id\)/);
  });

  it("renders a PC assistant review focus bar without changing lead data", () => {
    assert.match(leadsViewSource, /助手复核/);
    assert.match(leadsViewSource, /清除复核焦点/);
    assert.match(leadsViewSource, /未找到精确匹配，已为你搜索/);
    assert.match(leadsViewSource, /assistant-review-focus/);
  });
});
