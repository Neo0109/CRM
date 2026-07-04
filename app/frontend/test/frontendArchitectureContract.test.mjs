import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");

function source(path) {
  const fullPath = resolve(__dirname, path);
  assert.equal(existsSync(fullPath), true, `${path} should exist`);
  return readFileSync(fullPath, "utf8");
}

describe("frontend app shell architecture", () => {
  it("exports LeadsView and LeadDetail from features/leads", () => {
    const indexSource = source("../src/features/leads/index.ts");
    assert.match(indexSource, /LeadsView/);
    assert.match(indexSource, /LeadDetail/);
  });

  it("exports RadarPage from features/radar", () => {
    const indexSource = source("../src/features/radar/index.ts");
    assert.match(indexSource, /RadarPage/);
  });

  it("keeps App.tsx as the shell instead of declaring feature components and pure helpers", () => {
    assert.match(appSource, /from "\.\/features\/leads"/);
    assert.match(appSource, /from "\.\/features\/radar"/);
    assert.doesNotMatch(appSource, /function LeadsView\(/);
    assert.doesNotMatch(appSource, /function LeadDetail\(/);
    assert.doesNotMatch(appSource, /function RadarPage\(/);
    assert.doesNotMatch(appSource, /function normalizeSteamLinkInput\(/);
    assert.doesNotMatch(appSource, /function reviewPatchForBucket\(/);
    assert.doesNotMatch(appSource, /const radarCategories/);
  });
});
