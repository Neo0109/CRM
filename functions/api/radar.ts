import { json, requireAccess, todayInShanghai, type PagesContext } from "../_lib/crm";
import { fetchHistoricalJson } from "../_lib/reportHistory";

const repoFullName = "Neo0109/CRM";
const branch = "main";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const verifiedRadarLinks: Record<string, string> = {
  radar_2026_05_25_future_games_show_june: "https://www.gamesradar.com/future-games-show/",
  radar_2026_05_25_warhammer_skulls_demo_burst: "https://www.techradar.com/gaming/here-are-the-biggest-announcements-from-warhammer-skulls-2026-including-how-to-claim-a-free-40-000-steam-game",
  radar_2026_05_25_capcom_ai_policy: "https://www.techradar.com/gaming/capcom-isnt-completely-abandoning-generative-ai-but-has-promised-fans-it-wont-use-ai-assets-in-games",
  radar_2026_05_25_take_two_ai_jobs: "https://www.gamesradar.com/games/grand-theft-auto/take-two-ceo-calls-generative-ai-the-future-of-technology-that-will-increase-employment-months-after-saying-gta-6s-creative-genius-is-human/"
};

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const reportDate = url.searchParams.get("date");

  if (reportDate && !datePattern.test(reportDate)) return json({ error: "Invalid radar date" }, 400);

  try {
    const result = await fetchHistoricalJson<Record<string, unknown>>(reportDate, {
      basePath: "data/radar",
      branch,
      fallbackSummary: "暂无行业雷达历史数据。每日自动化写入后，这里会保留最近一次有效内容并支持回看。",
      repoFullName,
      today: todayInShanghai()
    });
    return json({
      ...normalizeRadarReport(result.report),
      available_dates: result.available_dates,
      is_fallback: result.is_fallback,
      requested_date: result.requested_date,
      source: result.source
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "invalid_date") return json({ error: "Invalid radar date" }, 400);
    if (message.startsWith("fetch_failed:")) return json({ error: `Radar fetch failed: ${message.split(":")[1]}` }, 502);
    return json({ error: "Radar fetch failed" }, 502);
  }
};

function normalizeRadarReport(report: Record<string, unknown>) {
  const items = Array.isArray(report.items) ? report.items : [];
  return {
    ...report,
    items: items.map((item) => normalizeRadarItem(item))
  };
}

function normalizeRadarItem(item: unknown) {
  if (!item || typeof item !== "object") return item;
  const record = item as Record<string, unknown>;
  return {
    ...record,
    link: safeRadarLink(record)
  };
}

function safeRadarLink(item: Record<string, unknown>) {
  const id = typeof item.id === "string" ? item.id : "";
  if (verifiedRadarLinks[id]) return verifiedRadarLinks[id];

  const link = typeof item.link === "string" ? item.link.trim() : "";
  if (isUsableHttpLink(link)) return link;

  return searchLink([item.source, item.title].filter((value): value is string => typeof value === "string"));
}

function isUsableHttpLink(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (["example.com", "localhost"].includes(url.hostname)) return false;
    if (url.pathname === "/404") return false;
    return true;
  } catch {
    return false;
  }
}

function searchLink(parts: string[]) {
  const query = parts.join(" ").trim() || "game industry news";
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
