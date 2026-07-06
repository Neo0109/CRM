import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = new URL("../src/", import.meta.url);

function source(path) {
  const url = new URL(path, src);
  assert.equal(existsSync(url), true, `${path} should exist`);
  return readFileSync(url, "utf8");
}

function importOffset(sourceText, importPath) {
  const offset = sourceText.indexOf(`import "${importPath}";`);
  assert.notEqual(offset, -1, `${importPath} should be imported`);
  return offset;
}

describe("frontend design token contract", () => {
  it("loads design tokens before page and feature styles", () => {
    const mainSource = source("main.tsx");

    assert.ok(
      importOffset(mainSource, "./design-tokens.css") < importOffset(mainSource, "./styles.css"),
      "design-tokens.css should load before styles.css"
    );
  });

  it("keeps base visual tokens in a single CSS source", () => {
    const tokenSource = source("design-tokens.css");
    const stylesSource = source("styles.css");
    const aestheticSource = source("aesthetic-refresh.css");

    for (const token of [
      "--surface-page",
      "--surface-card",
      "--text-primary",
      "--border-default",
      "--action-primary",
      "--status-success-bg",
      "--status-warning-bg",
      "--status-danger-bg",
      "--bucket-push-bg",
      "--bucket-watch-bg",
      "--bucket-drop-bg",
      "--radius-card",
      "--shadow-card",
      "--focus-ring",
      "--font-sans",
      "--bg",
      "--paper",
      "--blue",
      "--pink"
    ]) {
      assert.match(tokenSource, new RegExp(`${token}\\s*:`), `${token} should be defined in design-tokens.css`);
    }

    assert.doesNotMatch(stylesSource, /^:root\s*\{/m, "styles.css should consume design tokens instead of declaring root tokens");
    assert.doesNotMatch(
      aestheticSource,
      /^:root\s*\{/m,
      "aesthetic-refresh.css should consume design tokens instead of overriding root tokens"
    );
  });

  it("uses shared tokens for recurring status and bucket colors", () => {
    const aestheticSource = source("aesthetic-refresh.css");
    const diagnosticsSource = source("automation-diagnostics.css");

    for (const token of [
      "--bucket-push-bg",
      "--bucket-push-border",
      "--bucket-push-text",
      "--bucket-watch-bg",
      "--bucket-watch-border",
      "--bucket-watch-text",
      "--bucket-drop-bg",
      "--bucket-drop-border",
      "--bucket-drop-text"
    ]) {
      assert.match(aestheticSource, new RegExp(`var\\(${token}\\)`), `${token} should be consumed by bucket controls`);
    }

    for (const token of ["--status-success-bg", "--status-warning-bg", "--status-danger-bg"]) {
      assert.match(diagnosticsSource, new RegExp(`var\\(${token}\\)`), `${token} should be consumed by diagnostics states`);
    }
  });
});
