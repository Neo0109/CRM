import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const serverPath = path.resolve(import.meta.dirname, "../src/server.ts");
const interactionRoutesPath = path.resolve(import.meta.dirname, "../src/lib/interactionRoutes.ts");

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
  it("registers an append-only local interactions API without logging request content", async () => {
    const [serverSource, routeSource] = await Promise.all([
      readFile(serverPath, "utf8"),
      readFile(interactionRoutesPath, "utf8")
    ]);

    assert.match(serverSource, /data\/interactions\.local\.json/);
    assert.match(serverSource, /registerBackendInteractionRoutes/);
    assert.match(serverSource, /getBackendSessionUser/);
    assert.match(routeSource, /app\.get\("\/api\/interactions"/);
    assert.match(routeSource, /app\.post\("\/api\/interactions"/);
    assert.match(routeSource, /Lead is no longer in an interaction-enabled pool/);
    assert.match(routeSource, /Failed to save interaction/);
    assert.doesNotMatch(routeSource, /console\.(log|warn|error)/);
    assert.doesNotMatch(routeSource, /app\.(patch|put|delete)\("\/api\/interactions/);
  });
});
