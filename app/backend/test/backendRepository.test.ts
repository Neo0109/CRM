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
    await repository.createLeads([{ project: "Created Game", priority: null }]);
    const raw = await readFile(dataPath, "utf8");
    assert.ok(raw.endsWith("\n"));
    assert.match(raw, /"project": "Repo Game"/);

    const leads = await repository.readLeads();
    assert.equal(leads.length, 2);
    assert.equal(leads[0].project, "Repo Game");
    assert.equal(leads[0].contact_methods[0].value, "repo@example.com");
    assert.equal(leads[1].project, "Created Game");
    assert.equal(leads[1].priority, null);
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
                  {
                    id: "lead-real",
                    data: {
                      project: "Real Game",
                      contact: "real@example.com",
                      priority: null,
                      sourcing_lane: "china_joint",
                      sourcing_rule_version: "sourcing-rules-v7.1-two-lane-china-joint",
                      sourcing_run_type: "initial_backfill"
                    }
                  }
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
    assert.equal(leads[0].priority, null);
    assert.equal(leads[0].sourcing_lane, "china_joint");
    assert.equal(leads[0].sourcing_rule_version, "sourcing-rules-v7.1-two-lane-china-joint");
    assert.equal(leads[0].sourcing_run_type, "initial_backfill");

    await repository.writeLeads(leads);
    assert.equal(calls.length, 1);
    assert.deepEqual((calls[0] as { options: unknown }).options, { onConflict: "id" });
    const rows = (calls[0] as { rows: Array<{ id: string; data: Record<string, unknown>; updated_at: string }> }).rows;
    assert.deepEqual(Object.keys(rows[0]).sort(), ["data", "id", "updated_at"]);
    assert.equal(rows[0].data.priority, null);
    assert.equal(rows[0].data.sourcing_lane, "china_joint");
    assert.equal(rows[0].data.sourcing_rule_version, "sourcing-rules-v7.1-two-lane-china-joint");
    assert.equal(rows[0].data.sourcing_run_type, "initial_backfill");

    await repository.createLeads([{
      project: "Create Only Game",
      priority: null,
      sourcing_lane: "china_heat_ops",
      sourcing_rule_version: "sourcing-rules-v7.1",
      sourcing_run_type: "scheduled"
    }]);
    assert.equal(calls.length, 2);
    assert.deepEqual((calls[1] as { options: unknown }).options, { onConflict: "id", ignoreDuplicates: true });
    const createRows = (calls[1] as { rows: Array<{ id: string; data: Record<string, unknown>; updated_at: string }> }).rows;
    assert.deepEqual(Object.keys(createRows[0]).sort(), ["data", "id", "updated_at"]);
    assert.equal(createRows[0].data.project, "Create Only Game");
    assert.equal(createRows[0].data.priority, null);
    assert.equal(createRows[0].data.sourcing_lane, "china_heat_ops");

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
    await assert.rejects(() => failingRepository.createLeads(leads), /Supabase write failed: write broke/);
  });
});
