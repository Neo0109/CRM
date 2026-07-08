import { strict as assert } from "node:assert";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = new URL("../src/", import.meta.url);

function source(path) {
  const url = new URL(path, src);
  assert.equal(existsSync(url), true, `${path} should exist`);
  return readFileSync(url, "utf8");
}

function fileExists(path) {
  return existsSync(new URL(path, src));
}

function importOffset(sourceText, importPath) {
  const offset = sourceText.indexOf(`import "${importPath}";`);
  assert.notEqual(offset, -1, `${importPath} should be imported`);
  return offset;
}

describe("frontend CSS ownership contract", () => {
  it("does not keep active refinement-named stylesheets", () => {
    const activeCssFiles = readdirSync(src)
      .filter((fileName) => fileName.endsWith(".css"))
      .filter((fileName) => fileName.includes("refinement"));

    assert.deepEqual(activeCssFiles, [], "active frontend CSS files should be named by owning surface, not refinement layer");
    assert.equal(fileExists("calendar-refinement.css"), false, "calendar follow-up styles should live in calendar.css");
    assert.equal(fileExists("detail-ux-refinement.css"), false, "lead detail styles should live in lead-detail.css");
  });

  it("loads Calendar and Lead Detail styles from owning stylesheets", () => {
    const mainSource = source("main.tsx");

    assert.equal(mainSource.includes("calendar-refinement.css"), false, "main.tsx should not import calendar-refinement.css");
    assert.equal(mainSource.includes("detail-ux-refinement.css"), false, "main.tsx should not import detail-ux-refinement.css");

    assert.ok(
      importOffset(mainSource, "./design-tokens.css") < importOffset(mainSource, "./styles.css"),
      "design tokens should still load before base styles"
    );
    assert.ok(
      importOffset(mainSource, "./calendar.css") < importOffset(mainSource, "./aesthetic-refresh.css"),
      "calendar styles should keep their feature slot before the global aesthetic layer"
    );
    assert.ok(
      importOffset(mainSource, "./aesthetic-refresh.css") < importOffset(mainSource, "./lead-detail.css"),
      "Lead Detail owner styles should load after aesthetic-refresh.css so responsive detail overrides keep priority"
    );
  });

  it("keeps follow-up reminder styles in calendar.css", () => {
    const calendarSource = source("calendar.css");

    for (const selector of [
      ".follow-reminder-card.enabled",
      ".follow-reminder-controls",
      ".follow-reminder-card:not(.enabled)"
    ]) {
      assert.match(calendarSource, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${selector} should live in calendar.css`);
    }
  });

  it("keeps Lead Detail-specific styles in lead-detail.css", () => {
    const leadDetailSource = source("lead-detail.css");

    for (const selector of [
      ".rule-flag-explainer",
      ".steam-link-editor",
      ".steam-link-input-row",
      ".current-steam-links"
    ]) {
      assert.match(leadDetailSource, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${selector} should live in lead-detail.css`);
    }
  });
});
