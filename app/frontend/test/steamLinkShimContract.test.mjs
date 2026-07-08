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
const linkPresentationSource = source("../src/linkPresentation.ts");
const leadDetailSource = source("../src/features/leads/LeadDetail.tsx");
const weeklySource = source("../src/WeeklyReportLauncher.tsx");
const steamTrendsSource = source("../src/SteamTrendsPage.tsx");
const steamStoreBehaviorSource = optionalSource("../src/SteamStoreLinkBehavior.tsx");

describe("Steam store link DOM shim removal contract", () => {
  it("does not mount the Steam store link DOM behavior shim", () => {
    assert.doesNotMatch(mainSource, /SteamStoreLinkBehavior/);
    assert.equal(steamStoreBehaviorSource, "", "Steam app link hrefs should be normalized during React render, not after DOM mutation");
  });

  it("keeps Steam link presentation in a shared React helper", () => {
    assert.match(linkPresentationSource, /export function normalizedLinkHref/);
    assert.match(linkPresentationSource, /export function linkLabel/);
    assert.doesNotMatch(linkPresentationSource, /querySelector|MutationObserver|document\./);

    for (const reactSource of [leadDetailSource, weeklySource, steamTrendsSource]) {
      assert.match(reactSource, /normalizedLinkHref/);
      assert.match(reactSource, /linkLabel/);
    }
  });
});
