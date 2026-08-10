import { mkdir, readFile, writeFile } from "node:fs/promises";
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
      const interactions = await readInteractions(input.dataPath);
      const existing = interactions.find((event) =>
        event.request_id === interaction.request_id || event.id === interaction.id
      );
      if (existing) return { interaction: existing, created: false };

      interactions.push(interaction);
      await writeInteractions(input.dataPath, interactions);
      return { interaction, created: true };
    }
  };
}

async function readInteractions(dataPath: string): Promise<InteractionEvent[]> {
  try {
    const value = JSON.parse(await readFile(dataPath, "utf8")) as unknown;
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
  await mkdir(path.dirname(dataPath), { recursive: true });
  await writeFile(dataPath, `${JSON.stringify(interactions, null, 2)}\n`, "utf8");
}

function compareInteractions(a: InteractionEvent, b: InteractionEvent) {
  return b.occurred_at.localeCompare(a.occurred_at)
    || b.created_at.localeCompare(a.created_at)
    || b.id.localeCompare(a.id);
}
