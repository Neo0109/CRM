import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = new URL("../src/", import.meta.url);

function source(path) {
  return readFileSync(new URL(path, src), "utf8");
}

describe("settings boundary contract", () => {
  it("keeps the settings page as a Cloudflare-managed settings guide and export entry", () => {
    const settingsSource = source("SettingsPage.tsx");

    assert.match(settingsSource, /Cloudflare/);
    assert.match(settingsSource, /CRM_USERS_JSON/);
    assert.match(settingsSource, /EXCEL_EXPORT_PASSWORD/);
    assert.match(settingsSource, /excelExportUrl/);
    assert.doesNotMatch(settingsSource, /saveSettings/);
    assert.doesNotMatch(settingsSource, /sendSettingsVerification/);
  });

  it("does not export frontend helpers for online settings mutation", () => {
    const apiSource = source("api.ts");
    const typesSource = source("types.ts");

    assert.doesNotMatch(apiSource, /export function saveSettings/);
    assert.doesNotMatch(apiSource, /export function sendSettingsVerification/);
    assert.doesNotMatch(typesSource, /export type SettingsPatch/);
    assert.doesNotMatch(typesSource, /export type SettingsVerification/);
  });
});
