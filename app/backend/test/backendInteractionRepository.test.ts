import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it, mock } from "node:test";
import {
  prepareInteractionMutation,
  type InteractionEvent
} from "../../../functions/_lib/interactionModel.ts";
import { normalizeLead } from "../../../functions/_lib/leadModel.ts";
import { createBackendInteractionRepository } from "../src/lib/interactionRepository.ts";

const tmpDirs: string[] = [];

after(async () => {
  await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

function event(requestId: string, occurredAt: string) {
  const lead = normalizeLead({
    id: "lead-local-interactions",
    project: "Local History Game",
    bucket: "跟进中"
  });
  return prepareInteractionMutation({
    request_id: requestId,
    lead_id: lead.id,
    channel: "Discord",
    occurred_at: occurredAt,
    summary: `summary for ${requestId}`
  }, lead, {
    username: "local",
    display_name: "Local CRM",
    role: "local",
    permissions: []
  }, "2026-08-11T10:00:00.000Z").interaction;
}

describe("backend interaction JSON repository", () => {
  it("creates an ignored-style local store, appends events, paginates, and preserves idempotency", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "crm-interactions-"));
    tmpDirs.push(dir);
    const dataPath = path.join(dir, "nested/interactions.local.json");
    const repository = createBackendInteractionRepository({ dataPath });
    const older = event("request-local-001", "2026-08-10T09:00:00.000Z");
    const newer = event("request-local-002", "2026-08-11T09:00:00.000Z");

    assert.deepEqual(await repository.readPage("lead-local-interactions", { offset: 0, limit: 50 }), {
      interactions: [],
      next_cursor: null
    });
    assert.equal(await readFile(dataPath, "utf8"), "[]\n");

    assert.deepEqual(await repository.append(older), { interaction: older, created: true });
    assert.deepEqual(await repository.append(newer), { interaction: newer, created: true });

    const duplicate = await repository.append({ ...older, summary: "must not overwrite" });
    assert.deepEqual(duplicate, { interaction: older, created: false });
    assert.equal((await repository.findByRequestId(older.request_id))?.summary, older.summary);

    const firstPage = await repository.readPage("lead-local-interactions", { offset: 0, limit: 1 });
    assert.deepEqual(firstPage.interactions, [newer]);
    assert.equal(typeof firstPage.next_cursor, "string");

    const raw = await readFile(dataPath, "utf8");
    assert.ok(raw.endsWith("\n"));
    assert.equal((JSON.parse(raw) as unknown[]).length, 2);
  });

  it("does not expose records from another Lead", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "crm-interactions-"));
    tmpDirs.push(dir);
    const repository = createBackendInteractionRepository({
      dataPath: path.join(dir, "interactions.local.json")
    });
    await repository.append(event("request-local-003", "2026-08-11T09:00:00.000Z"));

    assert.deepEqual(await repository.readPage("another-lead", { offset: 0, limit: 50 }), {
      interactions: [],
      next_cursor: null
    });
  });

  it("serializes overlapping appends to the same data path", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "crm-interactions-"));
    tmpDirs.push(dir);
    const dataPath = path.join(dir, "interactions.local.json");
    await fs.writeFile(dataPath, "[]\n", "utf8");

    const repository = createBackendInteractionRepository({ dataPath });
    const first = event("request-local-concurrent-001", "2026-08-11T09:00:00.000Z");
    const second = event("request-local-concurrent-002", "2026-08-11T09:01:00.000Z");
    const originalReadFile = fs.readFile.bind(fs);
    const originalWriteFile = fs.writeFile.bind(fs);
    let dataPathReadCount = 0;
    let releaseFirstWrite = () => {};
    let markFirstWriteStarted = () => {};
    const firstWriteCanFinish = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const firstWriteStarted = new Promise<void>((resolve) => {
      markFirstWriteStarted = resolve;
    });

    const readFileMock = mock.method(fs, "readFile", async (...args) => {
      if (String(args[0]) === dataPath) dataPathReadCount += 1;
      return originalReadFile(...args);
    });
    const writeFileMock = mock.method(fs, "writeFile", async (...args) => {
      const target = String(args[0]);
      const contents = String(args[1]);
      if (target === dataPath
        && contents.includes(first.request_id)
        && !contents.includes(second.request_id)) {
        markFirstWriteStarted();
        await firstWriteCanFinish;
      }
      return originalWriteFile(...args);
    });

    let readsBeforeFirstWriteFinished = 0;
    try {
      const firstAppend = repository.append(first);
      await firstWriteStarted;
      const secondAppend = repository.append(second);
      readsBeforeFirstWriteFinished = dataPathReadCount;
      releaseFirstWrite();
      await Promise.all([firstAppend, secondAppend]);
    } finally {
      releaseFirstWrite();
      readFileMock.mock.restore();
      writeFileMock.mock.restore();
    }

    assert.equal(readsBeforeFirstWriteFinished, 1);
    const stored = JSON.parse(await readFile(dataPath, "utf8")) as InteractionEvent[];
    assert.deepEqual(new Set(stored.map((interaction) => interaction.request_id)), new Set([
      first.request_id,
      second.request_id
    ]));
  });

  it("continues the append queue after a write failure", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "crm-interactions-"));
    tmpDirs.push(dir);
    const dataPath = path.join(dir, "interactions.local.json");
    await fs.writeFile(dataPath, "[]\n", "utf8");

    const repository = createBackendInteractionRepository({ dataPath });
    const failed = event("request-local-failed-001", "2026-08-11T09:00:00.000Z");
    const recovered = event("request-local-recovered-001", "2026-08-11T09:01:00.000Z");
    const originalWriteFile = fs.writeFile.bind(fs);
    let failNextWrite = true;
    const writeFileMock = mock.method(fs, "writeFile", async (...args) => {
      if (String(args[0]) === dataPath && failNextWrite) {
        failNextWrite = false;
        throw new Error("injected interaction write failure");
      }
      return originalWriteFile(...args);
    });

    try {
      await assert.rejects(repository.append(failed), /injected interaction write failure/);
      assert.deepEqual(await repository.append(recovered), {
        interaction: recovered,
        created: true
      });
    } finally {
      writeFileMock.mock.restore();
    }

    const stored = JSON.parse(await readFile(dataPath, "utf8")) as InteractionEvent[];
    assert.deepEqual(stored.map((interaction) => interaction.request_id), [recovered.request_id]);
  });
});
