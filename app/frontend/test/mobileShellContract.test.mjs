import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = new URL("../src/", import.meta.url);

function source(path) {
  const url = new URL(path, src);
  assert.equal(existsSync(url), true, `${path} should exist`);
  return readFileSync(url, "utf8");
}

const appSource = source("App.tsx");
const mainSource = source("main.tsx");
const manualLauncherSource = source("ManualLeadLauncher.tsx");
const stylesSource = `${source("styles.css")}\n${source("aesthetic-refresh.css")}\n${source("manual.css")}`;

describe("mobile app shell and floating action contract", () => {
  it("keeps the manual lead launcher scoped to authenticated input views", () => {
    assert.match(appSource, /from "\.\/ManualLeadLauncher"/, "App.tsx should own the manual lead launcher");
    assert.doesNotMatch(mainSource, /<ManualLeadLauncher\s*\/>/, "main.tsx should not render the launcher globally");
    assert.match(
      appSource,
      /<ManualLeadLauncher\s+visible=\{view === "leads" \|\| view === "assistant"\}/,
      "launcher should only be visible on Leads Review and Assistant views"
    );
    assert.match(manualLauncherSource, /visible\?:\s*boolean/, "ManualLeadLauncher should accept a visible prop");
    assert.match(manualLauncherSource, /if \(!visible\) return null;/, "ManualLeadLauncher should not render when hidden");
  });

  it("adds an explicit mobile navigation disclosure to the app shell", () => {
    assert.match(appSource, /mobileNavOpen/, "App.tsx should track mobile nav open state");
    assert.match(appSource, /switchView\(nextView/, "view changes should go through a mobile-aware switch helper");
    assert.match(appSource, /setMobileNavOpen\(false\)/, "switching views should close the mobile nav");
    assert.match(appSource, /className="mobile-menu-button"/, "mobile menu button should have a stable class");
    assert.match(appSource, /aria-expanded=\{mobileNavOpen\}/, "mobile menu button should expose expanded state");
    assert.match(appSource, /aria-controls="mobile-nav-panel"/, "mobile menu button should point at the nav panel");
    assert.match(appSource, /id="mobile-nav-panel"/, "actions panel should expose a stable mobile nav id");
    assert.match(appSource, /data-mobile-open=\{mobileNavOpen\}/, "actions panel should expose mobile open state to CSS");
  });

  it("collapses mobile navigation and reserves space for the visible floating action", () => {
    assert.match(stylesSource, /@media \(max-width: 720px\)[\s\S]*\.mobile-menu-button/, "mobile menu styles should live in the mobile breakpoint");
    assert.match(stylesSource, /\.actions\[data-mobile-open="false"\]/, "mobile nav should be collapsible through the actions state");
    assert.match(stylesSource, /\.app-shell\.has-manual-floating-action/, "app shell should reserve space when the floating action is visible");
    assert.match(stylesSource, /env\(safe-area-inset-bottom\)/, "floating action should respect mobile safe-area");
    assert.match(stylesSource, /body:has\(\.manual-floating-button\)/, "body should reserve bottom space when the floating action exists");
  });
});
