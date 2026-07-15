import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const serverPath = path.resolve(import.meta.dirname, "../src/server.ts");

describe("legacy backend server contract", () => {
  it("keeps Express assembly in server.ts and moves model/user/repository helpers to modules", async () => {
    const source = await readFile(serverPath, "utf8");

    assert.match(source, /express\(\)/);
    assert.doesNotMatch(source, /function parseCrmUsersConfig\(/);
    assert.doesNotMatch(source, /function normalizeLead\(/);
    assert.doesNotMatch(source, /function mergeLead\(/);
    assert.doesNotMatch(source, /function leadKeys\(/);
    assert.doesNotMatch(source, /function toCsv\(/);
    assert.doesNotMatch(source, /async function readLeadsFromSupabase\(/);
    assert.doesNotMatch(source, /async function writeLeadsToSupabase\(/);
  });

  it("routes create-only daily report imports without changing the default import path", async () => {
    const source = await readFile(serverPath, "utf8");

    assert.match(source, /req\.query\.mode === "create-only"/);
    assert.match(source, /createOnlyBackendIncomingLeads/);
    assert.match(source, /createLeads\(result\.leads\)/);
    assert.match(source, /synced:\s*true/);
    assert.match(source, /mergeIncomingLeads\(backendLeadsFromReport\(report\)\)/);
  });
});
