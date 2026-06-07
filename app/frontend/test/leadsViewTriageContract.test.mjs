import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

describe("LeadsView triage contract", () => {
  it("uses the triage helper instead of the old sourcing overview", () => {
    assert.match(source, /buildDecisionTriage/);
    assert.match(source, /buildLeadEvidenceChips/);
    assert.doesNotMatch(source, /className="sourcing-brief"/);
  });

  it("renders the decision table around evidence instead of notes", () => {
    assert.match(source, /<th>证据<\/th>/);
    assert.doesNotMatch(source, /<th>备注<\/th>/);
    assert.match(source, /evidenceIssues/);
    assert.match(source, /needsAction/);
  });
});
