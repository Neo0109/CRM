import { json, readLeads, requireAccess, todayInShanghai, type Lead, type PagesContext } from "../../_lib/crm";

type WeeklyLeadSummary = {
  id: string;
  project: string;
  bucket: Lead["bucket"];
  priority: Lead["priority"];
  review_status: Lead["review_status"];
  region: Lead["region"];
  country: string;
  city: string | null;
  team: string | null;
  genre: string | null;
  gameplay: string | null;
  progress: string;
  release_window: string | null;
  publisher_status: string;
  bilibili_fit: string;
  priority_reason: string | null;
  rule_fit: string | null;
  verdict: string;
  evaluation_grade: Lead["evaluation_grade"];
  evaluation_result: string | null;
  evaluated_at: string | null;
  first_seen: string;
  reviewed_at: string | null;
  steam_store_url: string | null;
  steamdb_url: string | null;
  links: string[];
  basic_summary: string;
  recommendation_summary: string;
  follow_summary: string;
};

type WeeklyReport = {
  week_start: string;
  week_end: string;
  generated_at: string;
  source: "crm_leads";
  method: string;
  summary: string;
  stats: {
    sourced: number;
    submitted_for_test: number;
    test_queue: number;
    testing_pool: number;
    entered_follow_up: number;
    active_following: number;
    push_pool: number;
    follow_pool: number;
    watch_pool: number;
    dropped: number;
    pending_review: number;
    missing_steam_links: number;
  };
  follow_up_leads: WeeklyLeadSummary[];
  dropped_leads: WeeklyLeadSummary[];
  sourced_leads: WeeklyLeadSummary[];
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const followBuckets: Lead["bucket"][] = ["推进池", "跟进中"];
const testBuckets: Lead["bucket"][] = ["待评测", "测试中"];

export const onRequestGet = async ({ request, env }: PagesContext) => {
  const denied = await requireAccess(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const anchorDate = url.searchParams.get("date") ?? todayInShanghai();
  if (!datePattern.test(anchorDate)) return json({ error: "Invalid date" }, 400);

  try {
    const leads = await readLeads(env);
    return json(buildWeeklyReport(leads, anchorDate));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
};

function buildWeeklyReport(leads: Lead[], anchorDate: string): WeeklyReport {
  const { start, end } = weekRange(anchorDate);
  const sourced = leads.filter((lead) => inRange(dateOnly(lead.first_seen), start, end));
  const followed = uniqueLeads(leads.filter((lead) => isFollowedThisWeek(lead, start, end)));
  const dropped = uniqueLeads(leads.filter((lead) => isDroppedThisWeek(lead, start, end)));
  const submittedForTest = uniqueLeads(leads.filter((lead) => isSubmittedForTestThisWeek(lead, start, end)));
  const activeFollowing = leads.filter((lead) => followBuckets.includes(lead.bucket));
  const sourcedSummaries = sourced.map(toWeeklyLeadSummary).sort(compareWeeklyLead);
  const followSummaries = activeFollowing.map(toWeeklyLeadSummary).sort(compareWeeklyLead);
  const droppedSummaries = dropped.map(toWeeklyLeadSummary).sort(compareWeeklyLead);
  const pendingReview = sourced.filter((lead) => lead.review_status === "未处理").length;
  const missingSteamLinks = followSummaries.filter((lead) => !lead.steam_store_url).length;

  return {
    week_start: start,
    week_end: end,
    generated_at: new Date().toISOString(),
    source: "crm_leads",
    method: "No OpenAI API. The report is calculated from CRM fields: first_seen, reviewed_at, evaluated_at, bucket, review_status, evaluation_grade, evaluation_result, priority_reason, rule_fit, product links.",
    summary: `本周共 sourcing ${sourced.length} 款游戏，提测 ${submittedForTest.length} 款，进入跟进/推进 ${followed.length} 款，当前正在跟进 ${activeFollowing.length} 款，淘汰 ${droppedSummaries.length} 款。`,
    stats: {
      sourced: sourced.length,
      submitted_for_test: submittedForTest.length,
      test_queue: leads.filter((lead) => lead.bucket === "待评测").length,
      testing_pool: leads.filter((lead) => lead.bucket === "测试中").length,
      entered_follow_up: followed.length,
      active_following: activeFollowing.length,
      push_pool: activeFollowing.filter((lead) => lead.bucket === "推进池").length,
      follow_pool: activeFollowing.filter((lead) => lead.bucket === "跟进中").length,
      watch_pool: sourced.filter((lead) => lead.bucket === "观察池").length,
      dropped: droppedSummaries.length,
      pending_review: pendingReview,
      missing_steam_links: missingSteamLinks
    },
    follow_up_leads: followSummaries,
    dropped_leads: droppedSummaries,
    sourced_leads: sourcedSummaries
  };
}

function isFollowedThisWeek(lead: Lead, start: string, end: string) {
  if (!followBuckets.includes(lead.bucket)) return false;
  const reviewedDate = dateFromIso(lead.reviewed_at);
  if (reviewedDate) return inRange(reviewedDate, start, end);
  return inRange(dateOnly(lead.first_seen), start, end);
}

function isDroppedThisWeek(lead: Lead, start: string, end: string) {
  if (lead.bucket !== "淘汰池") return false;
  const reviewedDate = dateFromIso(lead.reviewed_at);
  if (reviewedDate) return inRange(reviewedDate, start, end);
  return inRange(dateOnly(lead.first_seen), start, end);
}

function isSubmittedForTestThisWeek(lead: Lead, start: string, end: string) {
  const evaluatedDate = dateFromIso(lead.evaluated_at);
  if (evaluatedDate && inRange(evaluatedDate, start, end)) return true;
  if (!testBuckets.includes(lead.bucket)) return false;
  const reviewedDate = dateFromIso(lead.reviewed_at);
  if (reviewedDate) return inRange(reviewedDate, start, end);
  return inRange(dateOnly(lead.first_seen), start, end);
}

function toWeeklyLeadSummary(lead: Lead): WeeklyLeadSummary {
  const steamStoreUrl = steamStoreLink(lead);
  const steamdbUrl = steamDbLink(lead);
  const links = uniqueStrings([steamStoreUrl, steamdbUrl, ...lead.links].filter(Boolean) as string[]);
  const basicSummary = compactJoin([
    lead.team ? `团队：${lead.team}` : null,
    [lead.country, lead.city].filter(Boolean).join(" / ") || null,
    lead.genre ? `类型：${lead.genre}` : null,
    lead.gameplay ? `玩法：${lead.gameplay}` : null,
    lead.progress ? `进度：${lead.progress}` : null,
    lead.release_window ? `窗口：${lead.release_window}` : null,
    lead.publisher_status ? `发行：${lead.publisher_status}` : null
  ]);
  const recommendationSummary = compactJoin([
    lead.evaluation_grade ? `评测评级：${lead.evaluation_grade}` : null,
    lead.evaluation_result ? `评测结论：${lead.evaluation_result}` : null,
    lead.priority_reason,
    lead.rule_fit,
    lead.bilibili_fit ? `B站适配：${lead.bilibili_fit}` : null,
    lead.verdict ? `结论：${lead.verdict}` : null
  ]);
  const followSummary = compactJoin([
    lead.evaluation_grade ? `评级 ${lead.evaluation_grade}` : null,
    lead.evaluation_result,
    lead.next_action ? `下一步：${lead.next_action}` : null,
    !lead.evaluation_result && lead.priority_reason ? `跟进依据：${lead.priority_reason}` : null,
    !lead.evaluation_result && lead.bilibili_fit ? `B站价值：${lead.bilibili_fit}` : null
  ]);

  return {
    id: lead.id,
    project: lead.project,
    bucket: lead.bucket,
    priority: lead.priority,
    review_status: lead.review_status,
    region: lead.region,
    country: lead.country,
    city: lead.city,
    team: lead.team,
    genre: lead.genre,
    gameplay: lead.gameplay,
    progress: lead.progress,
    release_window: lead.release_window,
    publisher_status: lead.publisher_status,
    bilibili_fit: lead.bilibili_fit,
    priority_reason: lead.priority_reason,
    rule_fit: lead.rule_fit,
    verdict: lead.verdict,
    evaluation_grade: lead.evaluation_grade,
    evaluation_result: lead.evaluation_result,
    evaluated_at: lead.evaluated_at,
    first_seen: lead.first_seen,
    reviewed_at: lead.reviewed_at,
    steam_store_url: steamStoreUrl,
    steamdb_url: steamdbUrl,
    links,
    basic_summary: basicSummary || "基础信息待补充",
    recommendation_summary: recommendationSummary || "推荐理由待补充",
    follow_summary: followSummary || "跟进总结待补充：建议在右侧“评测结果”写明测试结论、评级和下一步商务动作。"
  };
}

function steamStoreLink(lead: Lead) {
  const appId = lead.steam_app_id ?? lead.links.map(extractSteamAppId).find(Boolean) ?? null;
  if (appId) return `https://store.steampowered.com/app/${appId}/`;
  const storeLink = lead.links.find((link) => /store\.steampowered\.com\/app\/\d+/i.test(link));
  return storeLink ? normalizeSteamStoreLink(storeLink) : null;
}

function steamDbLink(lead: Lead) {
  const appId = lead.steam_app_id ?? lead.links.map(extractSteamAppId).find(Boolean) ?? null;
  if (appId) return `https://steamdb.info/app/${appId}/`;
  return lead.links.find((link) => /steamdb\.info\/app\/\d+/i.test(link)) ?? null;
}

function extractSteamAppId(value: string) {
  return value.match(/(?:store\.steampowered\.com|steamcommunity\.com|steamdb\.info)\/app\/(\d+)/i)?.[1] ?? null;
}

function normalizeSteamStoreLink(value: string) {
  const appId = extractSteamAppId(value);
  return appId ? `https://store.steampowered.com/app/${appId}/` : value;
}

function uniqueLeads(leads: Lead[]) {
  const seen = new Set<string>();
  return leads.filter((lead) => {
    if (seen.has(lead.id)) return false;
    seen.add(lead.id);
    return true;
  });
}

function compareWeeklyLead(a: WeeklyLeadSummary, b: WeeklyLeadSummary) {
  return priorityRank(a.priority) - priorityRank(b.priority)
    || bucketRank(a.bucket) - bucketRank(b.bucket)
    || a.project.localeCompare(b.project, "zh-CN");
}

function priorityRank(priority: Lead["priority"]) {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[priority] ?? 9;
}

function bucketRank(bucket: Lead["bucket"]) {
  return { "推进池": 0, "跟进中": 1, "测试中": 2, "待评测": 3, "观察池": 4, "淘汰池": 5 }[bucket] ?? 9;
}

function weekRange(anchorDate: string) {
  const day = dayOfWeek(anchorDate);
  const mondayOffset = -((day + 6) % 7);
  const start = addDays(anchorDate, mondayOffset);
  return { start, end: addDays(start, 6) };
}

function dayOfWeek(dateKey: string) {
  const date = dateAtUtcNoon(dateKey);
  return date.getUTCDay();
}

function addDays(dateKey: string, days: number) {
  const date = dateAtUtcNoon(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

function dateAtUtcNoon(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateOnly(value: string | null | undefined) {
  return value?.slice(0, 10) ?? "";
}

function dateFromIso(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return dateOnly(value);
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function inRange(value: string, start: string, end: string) {
  return Boolean(value && value >= start && value <= end);
}

function compactJoin(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean).join("；");
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}
