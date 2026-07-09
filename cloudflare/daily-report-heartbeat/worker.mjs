const DEFAULT_OWNER = "Neo0109";
const DEFAULT_REPO = "CRM";
const DEFAULT_BRANCH = "main";
const DEFAULT_WORKFLOW_FILE = "daily-report-watchdog.yml";

export default {
  async scheduled(controller, env, ctx) {
    const task = runHeartbeat({ env, now: new Date(controller.scheduledTime) });
    ctx.waitUntil(task);
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? shanghaiDate();
    const forceDispatch = url.searchParams.get("dispatch") === "1";
    const result = await runHeartbeat({ env, date, dryRun: !forceDispatch });
    return jsonResponse(result, result.ok || result.dispatched || result.dryRun ? 200 : 502);
  },
};

export async function runHeartbeat({ env, date, now = new Date(), dryRun = false, fetchFn = fetch } = {}) {
  const reportDate = date ?? shanghaiDate(now);
  const state = await inspectDailyArtifacts({ env, date: reportDate, fetchFn });
  if (!state.needsDispatch) {
    return { ok: true, date: reportDate, checked_at: now.toISOString(), dispatched: false, state };
  }

  if (dryRun) {
    return { ok: false, date: reportDate, checked_at: now.toISOString(), dispatched: false, dryRun: true, state };
  }

  const dispatch = await dispatchWatchdog({ env, date: reportDate, fetchFn });
  return {
    ok: dispatch.ok,
    date: reportDate,
    checked_at: now.toISOString(),
    dispatched: dispatch.ok,
    dispatch,
    state,
  };
}

export async function inspectDailyArtifacts({ env, date, fetchFn = fetch }) {
  const config = githubConfig(env);
  const files = {
    report: `data/reports/${date}.json`,
    radar: `data/radar/${date}.json`,
    steam_trends: `data/steam_trends/${date}.json`,
  };
  const fileResults = {};
  for (const [key, repoPath] of Object.entries(files)) {
    fileResults[key] = await rawFileExists({ config, repoPath, fetchFn });
  }

  const receipts = await listReceipts({ config, date, fetchFn });
  const successfulReceipt = receipts.find((receipt) => receipt.status === "success" && receipt.synced === true);
  const missingFiles = Object.entries(fileResults)
    .filter(([, exists]) => !exists)
    .map(([key]) => key);
  const reasons = [];
  if (missingFiles.length) reasons.push(`missing files: ${missingFiles.join(", ")}`);
  if (!successfulReceipt) reasons.push("no successful synced receipt");

  return {
    ok: reasons.length === 0,
    needsDispatch: reasons.length > 0,
    date,
    branch: config.branch,
    files: fileResults,
    receipts,
    reasons,
  };
}

export async function dispatchWatchdog({ env, date, fetchFn = fetch }) {
  const config = githubConfig(env);
  const response = await fetchFn(dispatchUrl(config), {
    method: "POST",
    headers: githubHeaders(config.token),
    body: JSON.stringify({
      ref: config.branch,
      inputs: {
        date,
        force: "true",
      },
    }),
  });

  return {
    ok: response.status === 204,
    status: response.status,
    workflow: config.workflowFile,
  };
}

export function shanghaiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function githubConfig(env = {}) {
  const token = env.GITHUB_TOKEN ?? env.CRM_GITHUB_DISPATCH_TOKEN;
  if (!token) {
    throw new Error("Missing GITHUB_TOKEN or CRM_GITHUB_DISPATCH_TOKEN");
  }
  return {
    owner: env.GITHUB_OWNER ?? DEFAULT_OWNER,
    repo: env.GITHUB_REPO ?? DEFAULT_REPO,
    branch: env.GITHUB_BRANCH ?? DEFAULT_BRANCH,
    workflowFile: env.GITHUB_WORKFLOW_FILE ?? DEFAULT_WORKFLOW_FILE,
    token,
  };
}

async function rawFileExists({ config, repoPath, fetchFn }) {
  const response = await fetchFn(rawUrl(config, repoPath), {
    method: "HEAD",
    headers: githubHeaders(config.token),
  });
  return response.ok;
}

async function listReceipts({ config, date, fetchFn }) {
  const listingResponse = await fetchFn(contentsUrl(config, "data/automation_runs"), {
    headers: githubHeaders(config.token),
  });
  if (!listingResponse.ok) return [];

  const entries = await listingResponse.json();
  if (!Array.isArray(entries)) return [];
  const receiptEntries = entries.filter((entry) => entry.type === "file" && entry.name.startsWith(`${date}-`) && entry.name.endsWith(".json"));
  const receipts = [];
  for (const entry of receiptEntries) {
    const response = await fetchFn(entry.download_url, { headers: githubHeaders(config.token) });
    if (!response.ok) continue;
    const payload = await response.json().catch(() => null);
    if (!payload) continue;
    receipts.push(normalizeReceipt(entry.name, payload));
  }
  return receipts;
}

function normalizeReceipt(name, payload) {
  const syncPayload = parseSyncResponse(payload.sync_response);
  return {
    name,
    status: payload.status ?? null,
    slot: payload.slot ?? null,
    run_url: payload.run_url ?? null,
    captured_at: payload.captured_at ?? null,
    synced: syncPayload?.synced === true,
  };
}

function parseSyncResponse(value) {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function rawUrl(config, repoPath) {
  return `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${repoPath}`;
}

function contentsUrl(config, repoPath) {
  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}?ref=${encodeURIComponent(config.branch)}`;
}

function dispatchUrl(config) {
  return `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${encodeURIComponent(config.workflowFile)}/dispatches`;
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "crm-daily-report-heartbeat",
  };
}

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
