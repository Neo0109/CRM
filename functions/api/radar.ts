import { json, requireAccess, todayInShanghai, type PagesContext } from "../_lib/crm";

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
  const reportDate = url.searchParams.get("date") ?? todayInShanghai();

  if (!datePattern.test(reportDate)) return json({ error: "Invalid radar date" }, 400);

  const source = `https://raw.githubusercontent.com/${repoFullName}/${branch}/data/radar/${reportDate}.json`;
  const response = await fetch(`${source}?t=${Date.now()}`, { headers: { Accept: "application/json" } });

  if (response.status === 404) {
    return json({
      report_date: reportDate,
      summary: "今日行业雷达尚未写入。每日自动化会把游戏行业新闻、AI 游戏、互联网梗和 B站趋势保存到这里。",
      items: [],
      source
    });
  }

  if (!response.ok) return json({ error: `Radar fetch failed: ${response.status}` }, 502);
  return json({ ...normalizeRadarReport(await response.json()), source });
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
