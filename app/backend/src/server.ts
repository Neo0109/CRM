import * as AjvModule from "ajv";
import * as addFormatsModule from "ajv-formats";
import cors from "cors";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  backendLeadsFromReport,
  backendToCsv,
  mergeBackendIncomingLeads,
  normalizeBackendLead,
  type BackendDailyReport,
  type BackendLead
} from "./lib/backendLeadModel.js";
import {
  buildBackendUsers,
  cleanBackendAuthValue,
  validateBackendLogin,
  validateBackendSession,
  type BackendUsersInput
} from "./lib/backendUsers.js";
import { createLeadRepository } from "./lib/leadRepository.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(dirname, "../../..");
const dataPath = path.join(rootDir, "data/leads.json");
const frontendDistPath = path.join(rootDir, "app/frontend/dist");
const leadSchemaPath = path.join(rootDir, "schemas/sourcing_lead.schema.json");
const dailyReportSchemaPath = path.join(rootDir, "schemas/daily_report.schema.json");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const crmUsersJson = process.env.CRM_USERS_JSON;
const crmUsername = cleanBackendAuthValue(process.env.CRM_USERNAME);
const crmAccessToken = process.env.CRM_ACCESS_TOKEN;
const authConfig: BackendUsersInput = { rawUsers: crmUsersJson, legacyUsername: crmUsername, legacyPassword: crmAccessToken };
const configuredCrmUsers = buildBackendUsers(authConfig);
const hasCrmAuthConfig = Boolean(cleanBackendAuthValue(crmUsersJson) || crmUsername || cleanBackendAuthValue(crmAccessToken));
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
    })
  : null;
const leadRepository = createLeadRepository({ supabase, dataPath });

const [leadSchema, dailyReportSchema] = await Promise.all([
  readJson(leadSchemaPath),
  readJson(dailyReportSchemaPath)
]);

const Ajv = (AjvModule as { default: any }).default;
const addFormats = (addFormatsModule as { default: any }).default;
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
type ValidatorFn = ((data: unknown) => boolean) & { errors?: unknown };
const validateLead = ajv.compile(leadSchema) as ValidatorFn;
const validateDailyReport = ajv.compile(dailyReportSchema) as ValidatorFn;

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use((req, res, next) => {
  if (!hasCrmAuthConfig || req.path === "/api/health" || req.path === "/api/auth/login" || !req.path.startsWith("/api")) {
    next();
    return;
  }

  if (validateBackendSession(authConfig, {
    usernameHeader: req.headers["x-crm-username"],
    tokenHeader: req.headers["x-crm-token"],
    cookieHeader: req.headers.cookie
  })) {
    next();
    return;
  }

  res.status(401).json({ error: "CRM login required" });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    storage: supabase ? "supabase" : "json",
    version: "v2.4-automation-diagnostics-center",
    env: {
      hasCrmUsersJson: Boolean(crmUsersJson),
      crmUserCount: configuredCrmUsers.length,
      hasCrmUsername: Boolean(crmUsername),
      hasCrmAccessToken: Boolean(crmAccessToken)
    }
  });
});

app.post("/api/auth/login", (req, res) => {
  const result = validateBackendLogin(authConfig, {
    username: typeof req.body?.username === "string" ? req.body.username : "",
    password: typeof req.body?.password === "string" ? req.body.password : ""
  });

  if (!result.ok) {
    res.status(401).json({ error: "账号或密码无效" });
    return;
  }

  res.json({ ok: true, username: result.user.username, display_name: result.user.display_name, role: result.user.role, permissions: result.user.permissions });
});

app.get("/api/leads", async (_req, res, next) => {
  try {
    res.json(await readLeads());
  } catch (error) {
    next(error);
  }
});

app.patch("/api/leads/:id", async (req, res, next) => {
  try {
    const leads = await readLeads();
    const index = leads.findIndex((lead) => lead.id === req.params.id);
    if (index === -1) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    const updated = normalizeBackendLead({ ...leads[index], ...req.body, id: leads[index].id, first_seen: leads[index].first_seen });
    assertValidLead(updated);
    leads[index] = updated;
    await writeLeads(leads);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.post("/api/leads/import-daily-report", async (req, res, next) => {
  try {
    const report = req.body;
    assertValidDailyReport(report);
    const result = await mergeIncomingLeads(backendLeadsFromReport(report));
    res.json({ ...result, report_date: report.report_date, summary: report.summary });
  } catch (error) {
    next(error);
  }
});

app.get("/api/export/json", async (_req, res, next) => {
  try {
    const leads = await readLeads();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=sourcing-leads.json");
    res.send(JSON.stringify(leads, null, 2));
  } catch (error) {
    next(error);
  }
});

app.get("/api/export/csv", async (_req, res, next) => {
  try {
    const leads = await readLeads();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=sourcing-leads.csv");
    res.send(backendToCsv(leads));
  } catch (error) {
    next(error);
  }
});

app.use(express.static(frontendDistPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(500).json({ error: message });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Sourcing CRM listening on http://localhost:${port}`);
});

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readLeads(): Promise<BackendLead[]> {
  return leadRepository.readLeads();
}

async function writeLeads(leads: BackendLead[]) {
  await leadRepository.writeLeads(leads);
}

async function mergeIncomingLeads(rawLeads: Partial<BackendLead>[]) {
  const result = mergeBackendIncomingLeads(await readLeads(), rawLeads);
  for (const lead of result.leads) assertValidLead(lead);
  await writeLeads(result.leads);
  const { leads: _leads, ...summary } = result;
  return summary;
}

function assertValidDailyReport(report: BackendDailyReport) {
  if (!validateDailyReport(report)) throw new Error(ajv.errorsText(validateDailyReport.errors));
}

function assertValidLead(lead: BackendLead) {
  if (!validateLead(lead)) throw new Error(ajv.errorsText(validateLead.errors));
}
