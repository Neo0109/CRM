import fs from "node:fs/promises";
import path from "node:path";
import {
  encodeInteractionCursor,
  isInteractionEvent,
  type InteractionEvent,
  type InteractionPageRequest
} from "../../../../functions/_lib/interactionModel.js";

export type BackendInteractionRepositoryInput = {
  dataPath: string;
};

const appendQueues = new Map<string, Promise<void>>();

export function createBackendInteractionRepository(input: BackendInteractionRepositoryInput) {
  return {
    async readPage(leadId: string, page: InteractionPageRequest) {
      const interactions = (await readInteractions(input.dataPath))
        .filter((event) => event.lead_id === leadId)
        .sort(compareInteractions);
      const hasMore = interactions.length > page.offset + page.limit;

      return {
        interactions: interactions.slice(page.offset, page.offset + page.limit),
        next_cursor: hasMore ? encodeInteractionCursor(page.offset + page.limit) : null
      };
    },

    async findByRequestId(requestId: string) {
      return (await readInteractions(input.dataPath))
        .find((event) => event.request_id === requestId) ?? null;
    },

    async append(interaction: InteractionEvent) {
      return serializeAppend(input.dataPath, async () => {
        const interactions = await readInteractions(input.dataPath);
        const existing = interactions.find((event) =>
          event.request_id === interaction.request_id || event.id === interaction.id
        );
        if (existing) return { interaction: existing, created: false };

        interactions.push(interaction);
        await writeInteractions(input.dataPath, interactions);
        return { interaction, created: true };
      });
    }
  };
}

function serializeAppend<T>(dataPath: string, operation: () => Promise<T>): Promise<T> {
  const previous = appendQueues.get(dataPath) ?? Promise.resolve();
  const result = previous.then(operation, operation);
  const tail = result.then(() => undefined, () => undefined);
  appendQueues.set(dataPath, tail);

  return result.finally(() => {
    if (appendQueues.get(dataPath) === tail) appendQueues.delete(dataPath);
  });
}

async function readInteractions(dataPath: string): Promise<InteractionEvent[]> {
  try {
    const value = JSON.parse(await fs.readFile(dataPath, "utf8")) as unknown;
    if (!Array.isArray(value)) throw new Error("Invalid interaction repository");
    return value.filter(isInteractionEvent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await writeInteractions(dataPath, []);
      return [];
    }
    throw error;
  }
}

async function writeInteractions(dataPath: string, interactions: InteractionEvent[]) {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, `${JSON.stringify(interactions, null, 2)}\n`, "utf8");
}

function compareInteractions(a: InteractionEvent, b: InteractionEvent) {
  return b.occurred_at.localeCompare(a.occurred_at)
    || b.created_at.localeCompare(a.created_at)
    || b.id.localeCompare(a.id);
}
