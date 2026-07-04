import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { createLeadRepository } from "../src/lib/leadRepository.ts";

const tmpDirs: string[] = [];

after(async () => {
  await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("backend lead repository", () => {
  it("creates an empty JSON store on missing file and writes stable formatted JSON", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "crm-backend-repo-"));
    tmpDirs.push(dir);
    const dataPath = path.join(dir, "nested/leads.json");
    const repository = createLeadRepository({ dataPath });

    assert.deepEqual(await repository.readLeads(), []);
    assert.equal(await readFile(dataPath, "utf8"), "[]\n");

    await repository.writeLeads([{ project: "Repo Game", contact: "repo@example.com" }]);
    const raw = await readFile(dataPath, "utf8");
    assert.ok(raw.endsWith("\n"));
    assert.match(raw, /"project": "Repo Game"/);

    const leads = await repository.readLeads();
    assert.equal(leads.length, 1);
    assert.equal(leads[0].project, "Repo Game");
    assert.equal(leads[0].contact_methods[0].value, "repo@example.com");
  });

  it("filters system rows and maps Supabase read/write failures into stable errors", async () => {
    const calls: unknown[] = [];
    const supabase = {
      from(table: string) {
        assert.equal(table, "crm_leads");
        return {
          select() {
            return {
              order: async () => ({
                data: [
                  { id: "__crm_event", data: { id: "__crm_event", type: "sourcing_decision_event" } },
                  { id: "lead-real", data: { project: "Real Game", contact: "real@example.com" } }
                ],
                error: null
              })
            };
          },
          async upsert(rows: unknown[], options: unknown) {
            calls.push({ rows, options });
            return { error: null };
          }
        };
      }
    };

    const repository = createLeadRepository({ supabase });
    const leads = await repository.readLeads();
    assert.equal(leads.length, 1);
    assert.equal(leads[0].project, "Real Game");

    await repository.writeLeads(leads);
    assert.equal(calls.length, 1);
    assert.deepEqual((calls[0] as { options: unknown }).options, { onConflict: "id" });

    const failingRepository = createLeadRepository({
      supabase: {
        from() {
          return {
            select() {
              return { order: async () => ({ data: null, error: { message: "read broke" } }) };
            },
            async upsert() {
              return { error: { message: "write broke" } };
            }
          };
        }
      }
    });

    await assert.rejects(() => failingRepository.readLeads(), /Supabase read failed: read broke/);
    await assert.rejects(() => failingRepository.writeLeads(leads), /Supabase write failed: write broke/);
  });
});
