import { todayInShanghai } from "./crm";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

type FetchJsonOptions = {
  basePath: string;
  branch: string;
  fallbackSummary: string;
  repoFullName: string;
  today?: string;
};

export type HistoricalJsonResult<T extends Record<string, unknown>> = {
  available_dates: string[];
  is_fallback: boolean;
  report: T;
  requested_date: string;
  source: string;
};

export async function fetchHistoricalJson<T extends Record<string, unknown>>(
  requestedDate: string | null,
  options: FetchJsonOptions
): Promise<HistoricalJsonResult<T>> {
  const today = options.today ?? todayInShanghai();
  const requested = requestedDate ?? today;
  if (!datePattern.test(requested)) throw new Error("invalid_date");

  const availableDates = await listAvailableDates(options, today).catch(() => probeAvailableDates(requested, options));
  const selectedDate = selectReportDate(requested, availableDates);

  if (selectedDate) {
    const source = rawGithubUrl(options, selectedDate);
    const report = await fetchJson<T>(source);
    const reportDate = typeof report.report_date === "string" ? report.report_date : selectedDate;
    return {
      available_dates: availableDates,
      is_fallback: reportDate !== requested,
      report,
      requested_date: requested,
      source
    };
  }

  const source = rawGithubUrl(options, requested);
  return {
    available_dates: [],
    is_fallback: false,
    report: {
      report_date: requested,
      summary: options.fallbackSummary,
      items: []
    } as unknown as T,
    requested_date: requested,
    source
  };
}

async function listAvailableDates(options: FetchJsonOptions, today: string) {
  const allowedDates = new Set(candidateDates(today, 45));
  const url = `https://api.github.com/repos/${options.repoFullName}/contents/${options.basePath}?ref=${encodeURIComponent(options.branch)}`;
  const response = await fetch(`${url}&t=${Date.now()}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "sourcing-crm"
    }
  });
  if (!response.ok) throw new Error(`list_failed:${response.status}`);

  const entries = await response.json() as { name?: string; type?: string }[];
  return entries
    .filter((entry) => entry.type === "file")
    .map((entry) => entry.name?.replace(/\.json$/, "") ?? "")
    .filter((date) => datePattern.test(date) && allowedDates.has(date))
    .sort((a, b) => b.localeCompare(a));
}

async function probeAvailableDates(requested: string, options: FetchJsonOptions) {
  const availableDates: string[] = [];
  for (const date of candidateDates(requested, 45)) {
    const source = rawGithubUrl(options, date);
    const response = await fetch(`${source}?t=${Date.now()}`, { headers: { Accept: "application/json" } });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`fetch_failed:${response.status}`);
    availableDates.push(date);
  }
  return availableDates;
}

function selectReportDate(requested: string, availableDates: string[]) {
  if (!availableDates.length) return null;
  return availableDates.find((date) => date === requested)
    ?? availableDates.find((date) => date < requested)
    ?? availableDates[0];
}

async function fetchJson<T>(source: string) {
  const response = await fetch(`${source}?t=${Date.now()}`, { headers: { Accept: "application/json" } });
  if (response.status === 404) throw new Error("fetch_failed:404");
  if (!response.ok) throw new Error(`fetch_failed:${response.status}`);
  return response.json() as Promise<T>;
}

function candidateDates(startDate: string, days: number) {
  const dates: string[] = [];
  const [year, month, day] = startDate.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() - index);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

function rawGithubUrl(options: FetchJsonOptions, date: string) {
  return `https://raw.githubusercontent.com/${options.repoFullName}/${options.branch}/${options.basePath}/${date}.json`;
}
