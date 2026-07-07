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
const leadsViewSource = source("../src/features/leads/LeadsView.tsx");
const leadFiltersSource = source("../src/features/leads/leadFilters.ts");
const reviewQueueBehaviorSource = optionalSource("../src/ReviewQueueBehavior.tsx");

describe("ReviewQueueBehavior DOM shim removal contract", () => {
  it("does not mount the review queue DOM behavior shim", () => {
    assert.doesNotMatch(mainSource, /ReviewQueueBehavior/);
    assert.equal(reviewQueueBehaviorSource, "", "review queue visibility should live in React sources, not a DOM behavior component");
  });

  it("keeps default review queue and missing-link empty state in React sources", () => {
    assert.match(leadFiltersSource, /export function hasExplicitLeadFilters/);
    assert.match(leadFiltersSource, /export function shouldUseDefaultReviewQueue/);
    assert.match(leadFiltersSource, /export function filterLeadsForView/);
    assert.match(leadsViewSource, /filterLeadsForView/);
    assert.match(leadsViewSource, /暂无缺链接 lead/);
    assert.match(leadsViewSource, /setSelectedId\(filteredLeads\[0\]\?\.id \?\? null\)/);
  });

  it("does not rely on DOM APIs to hide table rows, rewrite counts, or inject detail empty state", () => {
    for (const forbidden of [
      /MutationObserver/,
      /querySelector/,
      /row\.hidden/,
      /document\.createElement/,
      /data-missing-links-empty/,
      /missing-links-empty-style/,
      /\.click\(\)/
    ]) {
      assert.doesNotMatch(reviewQueueBehaviorSource, forbidden);
      assert.doesNotMatch(leadsViewSource, forbidden);
    }
  });
});
