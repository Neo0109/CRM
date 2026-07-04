import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  isBackendSystemLeadRow,
  normalizeBackendLead,
  type BackendLead
} from "./backendLeadModel.js";

type SupabaseError = { message: string } | null | undefined;
type SupabaseLeadRow = { id?: string | null; data?: (Partial<BackendLead> & { type?: string }) | null };
type SupabaseLeadClient = {
  from(table: string): {
    select(columns: string): {
      order(column: string, options: { ascending: boolean }): Promise<{ data?: SupabaseLeadRow[] | null; error?: SupabaseError }>;
    };
    upsert(rows: unknown[], options: { onConflict: string }): Promise<{ error?: SupabaseError }>;
  };
};

export type LeadRepositoryInput = {
  supabase?: unknown;
  dataPath?: string;
};

export function createLeadRepository(input: LeadRepositoryInput) {
  const supabase = input.supabase as SupabaseLeadClient | null | undefined;

  return {
    async readLeads() {
      if (supabase) return readLeadsFromSupabase(supabase);
      return readLeadsFromJson(requireDataPath(input.dataPath));
    },

    async writeLeads(leads: Partial<BackendLead>[]) {
      const normalized = leads.map((lead) => normalizeBackendLead(lead));
      if (supabase) {
        await writeLeadsToSupabase(supabase, normalized);
        return;
      }
      await writeLeadsToJson(requireDataPath(input.dataPath), normalized);
    }
  };
}

async function readLeadsFromJson(dataPath: string): Promise<BackendLead[]> {
  try {
    const leads = JSON.parse(await readFile(dataPath, "utf8")) as Partial<BackendLead>[];
    return leads
      .filter((lead) => !isBackendSystemLeadRow({ id: lead.id, data: lead }))
      .map((lead) => normalizeBackendLead(lead));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await writeLeadsToJson(dataPath, []);
      return [];
    }
    throw error;
  }
}

async function writeLeadsToJson(dataPath: string, leads: BackendLead[]) {
  await mkdir(path.dirname(dataPath), { recursive: true });
  await writeFile(dataPath, `${JSON.stringify(leads, null, 2)}\n`, "utf8");
}

async function readLeadsFromSupabase(client: SupabaseLeadClient): Promise<BackendLead[]> {
  const { data, error } = await client.from("crm_leads").select("id,data").order("updated_at", { ascending: false });
  if (error) throw new Error(`Supabase read failed: ${error.message}`);
  return (data ?? [])
    .filter((row) => !isBackendSystemLeadRow(row))
    .map((row) => normalizeBackendLead(row.data ?? {}));
}

async function writeLeadsToSupabase(client: SupabaseLeadClient, leads: BackendLead[]) {
  const rows = leads.map((lead) => ({ id: lead.id, data: lead, updated_at: new Date().toISOString() }));
  if (!rows.length) return;
  const { error } = await client.from("crm_leads").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Supabase write failed: ${error.message}`);
}

function requireDataPath(dataPath: string | undefined) {
  if (!dataPath) throw new Error("JSON lead repository requires dataPath");
  return dataPath;
}
