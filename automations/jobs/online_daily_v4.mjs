// Online CRM generator v4: Sourcing Rules V3.
// Core principle: every output must be useful to a Bilibili BD owner.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const args = parseArgs(process.argv.slice(2));
const reportDate = args.date ?? todayInShanghai();
const capturedAt = nowInShanghaiIso();
const maxCandidates = Number(args.maxCandidates ?? 60);
const existingProjects = await readExistingProjectNames(reportDate);

const rawCandidates = dedupeByAppId((await Promise.all([
  fetchSteamSearch("popularcomingsoon", "Steam Popular Upcoming"),
  fetchSteamSearch("popularcomingsoon", "Steam Demo/Next Fest Window", [21]),
  fetchSteamSearch("popularcomingsoon", "Strategy Upcoming", [9]),
  fetchSteamSearch("popularcomingsoon", "Simulation Upcoming", [599]),
  fetchSteamSearch("popularcomingsoon", "Co-op Upcoming", [1685]),
  fetchSteamSearch("popularcomingsoon", "Roguelike Upcoming", [1716]),
  fetchSteamSearch("popularcomingsoon", "Deckbuilder Upcoming", [32322]),
  fetchSteamSearch("popularnew", "Popular New Context"),
  fetchFeaturedCategories()
])).flat())
  .filter((candidate) => candidate.appId && candidate.title && !existingProjects.has(normalizeText(candidate.title)))
  .slice(0, maxCandidates);

const enrichedCandidates = [];
for (const candidate of rawCandidates) {
  const details = await fetchAppDetails(candidate.appId);
  enrichedCandidates.push(await enrichCandidate(candidate, details));
  await sleep(120);
}

enrichedCandidates.sort((a, b) => b.score - a.score);
const pools = buildPools(enrichedCandidates);
const industrySignals = await fetchIndustrySignals();

await writeJson(`data/reports/${reportDate}.json`, buildDailyReport(pools, rawCandidates.length, enrichedCandidates.length));
await writeJson(`data/radar/${reportDate}.json`, buildRadarReport(enrichedCandidates, pools, industrySignals));
await writeJson(`data/steam_trends/${reportDate}.json`, buildSteamTrendReport(enrichedCandidates, pools));

console.log(JSON.stringify({
  ok: true,
  generator: "online_daily_v4_sourcing_rules_v3",
  report_date: reportDate,
  candidates_seen: rawCandidates.length,
  candidates_enriched: enrichedCandidates.length,
  industry_signals: industrySignals.length,
  push_pool: pools.push.length,
  watch_pool: pools.watch.length,
  drop_pool: pools.drop.length,
  captured_at: capturedAt
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (const item of argv) {
    const match = item.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

function todayInShanghai() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function nowInShanghaiIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}+08:00`;
}

async function readExistingProjectNames(date) {
  const names = new Set();
  for (const reportPath of previousDatePaths(date, 3)) {
    try {
      const report = JSON.parse(await readFile(path.join(rootDir, reportPath), "utf8"));
      for (const bucket of ["push_pool", "watch_pool", "drop_pool"]) {
        for (const lead of report[bucket] ?? []) if (lead.project) names.add(normalizeText(lead.project));
      }
    } catch {}
  }
  return names;
}

function previousDatePaths(date, days) {
  const paths = [];
  const current = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(current.getTime())) return paths;
  for (let index = 1; index <= days; index += 1) {
    const previous = new Date(current);
    previous.setUTCDate(current.getUTCDate() - index);
    paths.push(`data/reports/${previous.toISOString().slice(0, 10)}.json`);
  }
  return paths;
}

async function fetchSteamSearch(filter, source, tags = []) {
  const resultUrl = new URL("https://store.steampowered.com/search/results/");
  resultUrl.searchParams.set("query", "");
  resultUrl.searchParams.set("start", "0");
  resultUrl.searchParams.set("count", "50");
  resultUrl.searchParams.set("dynamic_data", "");
  resultUrl.searchParams.set("infinite", "1");
  resultUrl.searchParams.set("filter", filter);
  resultUrl.searchParams.set("category1", "998");
  resultUrl.searchParams.set("os", "win");
  resultUrl.searchParams.set("l", "english");
  if (tags.length) resultUrl.searchParams.set("tags", tags.join(","));

  const pageUrl = new URL("https://store.steampowered.com/search/");
  pageUrl.searchParams.set("filter", filter);
  pageUrl.searchParams.set("category1", "998");
  pageUrl.searchParams.set("os", "win");
  pageUrl.searchParams.set("l", "english");
  if (tags.length) pageUrl.searchParams.set("tags", tags.join(","));

  try {
    const text = await fetchText(resultUrl.toString(), 12000, "application/json,text/html;q=0.9,*/*;q=0.8");
    const parsed = parseSteamSearchHtml(parseMaybeJsonHtml(text), source);
    if (parsed.length) return parsed;
    return parseSteamSearchHtml(await fetchText(pageUrl.toString(), 12000, "text/html,*/*;q=0.8"), source);
  } catch (error) {
    console.warn(`Steam search failed for ${source}: ${error.message}`);
    return [];
  }
}

function parseMaybeJsonHtml(text) {
  try {
    const payload = JSON.parse(text);
    return payload.results_html ?? payload.html ?? text;
  } catch {
    return text;
  }
}

function parseSteamSearchHtml(html, source) {
  return String(html).split(/<a\s+/i).slice(1).map((chunk) => `<a ${chunk}`).map((chunk, index) => {
    const appId = chunk.match(/data-ds-appid=["']\[?(\d+)/i)?.[1] ?? chunk.match(/\/app\/(\d+)\//)?.[1] ?? null;
    const rawTitle = chunk.match(/<span[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]
      ?? chunk.match(/title=["']([^"']+)["']/i)?.[1]
      ?? "";
    const title = decodeHtml(stripTags(rawTitle)).trim();
    const release = decodeHtml(stripTags(chunk.match(/search_released[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "")).trim();
    const reviewText = decodeHtml(stripTags(chunk.match(/search_reviewscore[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "")).trim();
    const tags = [...chunk.matchAll(/<span[^>]*class=["'][^"']*top_tag[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)].map((match) => decodeHtml(stripTags(match[1])).trim()).filter(Boolean);
    if (!appId || !title) return null;
    return { appId: String(appId), title, release, reviewText, tags, source, sourceIndex: index, href: `https://store.steampowered.com/app/${appId}/` };
  }).filter(Boolean);
}

async function fetchFeaturedCategories() {
  try {
    const payload = await fetchJson("https://store.steampowered.com/api/featuredcategories?cc=us&l=english");
    return [["Featured Coming Soon", payload.coming_soon?.items], ["Featured New Releases Context", payload.new_releases?.items], ["Featured Top Sellers Context", payload.top_sellers?.items]]
      .flatMap(([source, items]) => (items ?? []).map((item, index) => ({
        appId: String(item.id ?? ""),
        title: item.name,
        release: source.includes("Coming") ? "Coming soon" : "",
        reviewText: "",
        tags: [],
        source,
        sourceIndex: index,
        href: `https://store.steampowered.com/app/${item.id}/`
      })).filter((item) => item.appId && item.title));
  } catch (error) {
    console.warn(`Steam featured categories failed: ${error.message}`);
    return [];
  }
}

async function fetchAppDetails(appId) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const payload = await fetchJson(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=english`);
      const entry = payload[String(appId)];
      return entry?.success && entry.data?.type === "game" ? entry.data : null;
    } catch (error) {
      if (attempt < 3 && /429|too many requests/i.test(error.message)) {
        await sleep(1200 * attempt);
        continue;
      }
      console.warn(`AppDetails failed for ${appId}: ${error.message}`);
      return null;
    }
  }
  return null;
}

async function enrichCandidate(candidate, details) {
  const developers = Array.isArray(details?.developers) ? details.developers : [];
  const publishers = Array.isArray(details?.publishers) ? details.publishers : [];
  const genres = [...new Set([...(details?.genres ?? []).map((genre) => genre.description), ...(candidate.tags ?? [])].filter(Boolean))].slice(0, 6);
  const categories = (details?.categories ?? []).map((category) => category.description).slice(0, 8);
  const text = [candidate.title, details?.name, details?.short_description, ...developers, ...publishers, ...genres, ...categories].join(" ");
  const lower = text.toLowerCase();
  const releaseDate = normalizeReleaseDate(details?.release_date?.date ?? candidate.release);
  const daysToRelease = daysUntil(releaseDate);
  const releaseTooSoon = typeof daysToRelease === "number" && daysToRelease >= 0 && daysToRelease < 60;
  const comingSoon = Boolean(details?.release_date?.coming_soon) || /coming soon|tba|to be announced/i.test(candidate.release ?? "");
  const earlyAccess = /early access|抢先体验/i.test(text);
  const narrativeHeavy = isNarrativeHeavy(lower, genres);
  const indiaTeam = /india|indian studio|bengaluru|bangalore|mumbai|pune|hyderabad|chennai/i.test(text);
  const strongGameplay = /co-op|multiplayer|strategy|simulation|management|automation|base building|colony|roguelike|deckbuilder|tactical|sandbox|survival|crafting|city builder|card game|tower defense|factory|physics/i.test(lower);
  const highVisual = (details?.screenshots?.length ?? 0) >= 4 || (details?.movies?.length ?? 0) > 0;
  const publisherOccupied = hasMaturePublisher(publishers);
  const domestic = looksDomestic([candidate.title, details?.name, ...developers, ...publishers, details?.website].join(" "));
  const strongData = hasStrongPublicData(candidate.reviewText, candidate.source, details);
  const contactMethods = await collectContactMethods(details, candidate.appId);
  const score = scoreCandidate({ source: candidate.source, domestic, strongGameplay, highVisual, strongData, releaseTooSoon, earlyAccess, narrativeHeavy, indiaTeam, publisherOccupied, comingSoon, hasDetails: Boolean(details), contactCount: contactMethods.length });

  return {
    appId: candidate.appId,
    title: details?.name ?? candidate.title,
    source: candidate.source,
    storeUrl: `https://store.steampowered.com/app/${candidate.appId}/`,
    steamDbUrl: `https://steamdb.info/app/${candidate.appId}/`,
    developers,
    publishers,
    country: domestic ? "中国（待确认）" : "海外",
    region: domestic ? "中国" : "海外",
    genres,
    categories,
    shortDescription: details?.short_description ?? "",
    releaseDate: releaseDate ?? candidate.release ?? "待确认",
    daysToRelease,
    comingSoon,
    earlyAccess,
    narrativeHeavy,
    indiaTeam,
    strongGameplay,
    highVisual,
    strongData,
    publisherOccupied,
    contactMethods,
    website: details?.website ?? null,
    hasDetails: Boolean(details),
    recommendationCount: details?.recommendations?.total ?? 0,
    screenshotCount: details?.screenshots?.length ?? 0,
    movieCount: details?.movies?.length ?? 0,
    reviewText: candidate.reviewText ?? "",
    releaseTooSoon,
    score
  };
}

function isNarrativeHeavy(lowerText, genres) {
  const genreText = genres.join(" ").toLowerCase();
  if (/visual novel|interactive fiction|story rich|narrative|walking simulator/.test(lowerText)) return true;
  if (/jrpg|adventure/.test(genreText) && /story|legend|novel|chapter|dialogue|romance|mystery/.test(lowerText) && !/deckbuilder|strategy|simulation|management|co-op|multiplayer|roguelike|sandbox|survival/.test(lowerText)) return true;
  return false;
}

function hasStrongPublicData(reviewText, source, details) {
  const text = `${reviewText ?? ""} ${source ?? ""}`.toLowerCase();
  if (/very positive|overwhelmingly positive|好评如潮|特别好评|wishlist|愿望单/.test(text)) return true;
  if ((details?.recommendations?.total ?? 0) >= 500) return true;
  return false;
}

async function collectContactMethods(details, appId) {
  const methods = [];
  const support = details?.support_info ?? {};
  const website = firstRealWebsite(details?.website, support.url);
  addContact(methods, "Email", support.email, "Steam support email");
  addContact(methods, "官网", website, "Steam official website");
  if (support.url !== website) addContact(methods, "官网", support.url, "Steam support URL");

  if (website) {
    for (const method of await contactsFromWebsite(website)) addContact(methods, method.type, method.value, method.note);
  }

  addContact(methods, "Steam", `https://steamcommunity.com/app/${appId}/discussions/`, methods.length ? "Steam community backup" : "Official Steam community fallback");
  return methods.slice(0, 4);
}

async function contactsFromWebsite(website) {
  try {
    const html = await fetchText(website, 7000, "text/html,*/*;q=0.8");
    const methods = [];
    const mailto = decodeHtml(String(html).match(/mailto:([^"'?#>\s]+)/i)?.[1] ?? "");
    const plainEmail = String(html).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
    addContact(methods, "Email", mailto || plainEmail, "Found on official site");
    for (const [type, pattern] of [
      ["Discord", /https?:\/\/(?:www\.)?(?:discord\.gg|discord\.com\/invite)\/[^"'<>\s]+/i],
      ["X/Twitter", /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^"'<>\s]+/i],
      ["B站", /https?:\/\/(?:space\.)?bilibili\.com\/[^"'<>\s]+/i]
    ]) {
      const value = String(html).match(pattern)?.[0];
      addContact(methods, type, value, "Found on official site");
    }
    return methods;
  } catch {
    return [];
  }
}

function firstRealWebsite(...values) {
  return values.find((value) => value && /^https?:\/\//i.test(value) && !isSteamStoreLike(value)) ?? null;
}

function isSteamStoreLike(value) {
  return /(?:store\.steampowered\.com|steamdb\.info)\/app\/\d+/i.test(String(value));
}

function addContact(methods, type, value, note) {
  const cleanValue = typeof value === "string" ? value.trim() : "";
  if (!cleanValue || isSteamStoreLike(cleanValue)) return;
  const key = normalizeUrl(cleanValue);
  if (methods.some((method) => normalizeUrl(method.value) === key)) return;
  methods.push({ type, value: cleanValue, note });
}

function scoreCandidate(input) {
  let score = 0;
  if (input.source.includes("Upcoming")) score += 24;
  if (input.source.includes("Demo") || input.source.includes("Next Fest")) score += 14;
  if (input.source.includes("Featured Coming")) score += 10;
  if (input.domestic) score += 12;
  if (input.strongGameplay) score += 18;
  if (input.highVisual) score += 12;
  if (input.strongData) score += 14;
  if (input.comingSoon) score += 6;
  if (input.hasDetails) score += 5;
  if (input.contactCount) score += 4;
  if (input.releaseTooSoon) score -= 30;
  if (input.publisherOccupied) score -= 24;
  if (input.earlyAccess) score -= 50;
  if (input.narrativeHeavy) score -= 35;
  if (input.indiaTeam) score -= 50;
  return score;
}

function buildPools(candidates) {
  const leads = candidates.map(toLead);
  const push = leads.filter((lead) => lead._class === "push").slice(0, 3);
  const used = new Set(push.map((lead) => lead.steam_app_id));
  const watch = leads.filter((lead) => lead._class === "watch" && !used.has(lead.steam_app_id)).slice(0, 15);
  for (const lead of watch) used.add(lead.steam_app_id);
  const drop = leads.filter((lead) => lead._class === "drop" && !used.has(lead.steam_app_id)).slice(0, 12);
  return { push: push.map(stripPrivate), watch: watch.map(stripPrivate), drop: drop.map(stripPrivate) };
}

function toLead(candidate) {
  const dropReason = hardDropReason(candidate);
  const pushEligible = isPushEligible(candidate, dropReason);
  const className = dropReason ? "drop" : pushEligible ? "push" : "watch";
  const bucket = className === "drop" ? "淘汰池" : "未处理";
  const priority = className === "push" ? "P1" : className === "drop" ? "P3" : candidate.score >= 34 ? "P2" : "P3";
  const genre = candidate.genres.join(" / ") || null;
  const priorityReason = buildPriorityReason(candidate, className, dropReason);
  return {
    _class: className,
    id: `lead_steam_${candidate.appId}_${reportDate}`,
    project: candidate.title,
    steam_app_id: candidate.appId,
    team: candidate.developers[0] ?? null,
    team_size: null,
    country: candidate.country,
    region: candidate.region,
    city: null,
    region_priority: candidate.region === "中国" ? "国内优先" : candidate.highVisual ? "海外-高视觉" : candidate.strongData ? "海外-强数据" : "其他",
    bucket,
    stage: className === "drop" ? "rejected" : "new",
    priority,
    priority_reason: priorityReason,
    rule_fit: buildRuleFit(candidate, dropReason, className),
    genre,
    gameplay: candidate.shortDescription || `${genre ?? "玩法待复核"}。需要打开 Steam 页面确认实机画面、玩法循环、Demo/愿望单信号和中文计划。`,
    progress: `Steam ${candidate.source}；发售窗口：${candidate.releaseDate}`,
    release_window: candidate.releaseDate,
    early_access: candidate.earlyAccess,
    narrative_heavy: candidate.narrativeHeavy,
    india_team: candidate.indiaTeam,
    publisher_status: buildPublisherStatus(candidate),
    publisher_name: candidate.publishers[0] ?? null,
    china_capability_occupied: candidate.publisherOccupied,
    traction_summary: buildTractionSummary(candidate),
    public_signals: `${candidate.source} / Steam App ${candidate.appId}`,
    contact: candidate.contactMethods.map((method) => `${method.type}: ${method.value}`).join("；"),
    contact_methods: candidate.contactMethods,
    links: [candidate.storeUrl, candidate.steamDbUrl, candidate.website].filter(Boolean),
    exposure_trail: buildExposureTrail(candidate),
    bilibili_fit: buildBilibiliFit(candidate),
    amplification: buildAmplification(candidate),
    risks: buildRisks(candidate, dropReason),
    verdict: buildVerdict(className, dropReason),
    next_action: buildNextAction(className),
    owner: null,
    due_date: null,
    first_seen: reportDate,
    notes: buildLeadNote(candidate, className, dropReason)
  };
}

function hardDropReason(candidate) {
  if (candidate.earlyAccess) return "命中排除项：PC Early Access";
  if (candidate.narrativeHeavy) return "命中排除项：叙事主导/视觉小说倾向";
  if (candidate.indiaTeam) return "命中排除项：印度团队/印度开发主体";
  if (candidate.publisherOccupied) return "成熟发行商占位，BD切入价值低";
  if (candidate.releaseTooSoon) return "发售窗口不足60天，默认不进正式推进";
  if (candidate.region === "海外" && !candidate.highVisual && !candidate.strongData && !candidate.strongGameplay) return "海外项目缺少高视觉、强数据或清晰内容化玩法";
  return null;
}

function isPushEligible(candidate, dropReason) {
  if (dropReason) return false;
  if (typeof candidate.daysToRelease !== "number" || candidate.daysToRelease < 60) return false;
  if (!candidate.strongGameplay) return false;
  if (candidate.region === "中国") return candidate.score >= 48;
  return candidate.score >= 58 && (candidate.highVisual || candidate.strongData);
}

function buildPriorityReason(candidate, className, dropReason) {
  if (className === "drop") return dropReason;
  const windowText = typeof candidate.daysToRelease === "number" ? `距发售约${candidate.daysToRelease}天` : "窗口待确认";
  if (className === "push") return `${candidate.source} 前置信号 + ${candidate.region === "中国" ? "国内优先" : candidate.highVisual ? "高视觉" : "强数据"} + 系统型玩法，${windowText}，值得优先确认中国区窗口`;
  return `${candidate.source} 有前置信号，${windowText}；先进入未处理 inbox，由人工决定是否进观察池、待评测或跟进`;
}

function buildRuleFit(candidate, dropReason, className) {
  const parts = [];
  if (candidate.region === "中国") parts.push("国内项目优先");
  if (candidate.region === "海外" && (candidate.highVisual || candidate.strongData)) parts.push("海外保留条件成立");
  if (candidate.strongGameplay) parts.push("玩法具备内容化潜力");
  if (typeof candidate.daysToRelease === "number") parts.push(`距发售约${candidate.daysToRelease}天`);
  if (className === "push") parts.push("窗口仍在，允许优先触达");
  if (dropReason) parts.push(dropReason);
  if (!parts.length) parts.push("基础入口成立，待人工复核");
  return parts.join("；");
}

function buildPublisherStatus(candidate) {
  if (!candidate.publishers.length) return "发行结构待确认";
  return `${candidate.publishers.join(" / ")}；${candidate.publisherOccupied ? "成熟发行商可能已占位" : "未见成熟中国发行能力占位"}`;
}

function buildTractionSummary(candidate) {
  const signals = [candidate.source];
  if (candidate.highVisual) signals.push("素材/截图/视频可验证");
  if (candidate.strongData) signals.push("存在强公开数据信号");
  if (candidate.strongGameplay) signals.push("玩法具备内容化空间");
  return `${signals.join("；")}。`;
}

function buildExposureTrail(candidate) {
  return `最早自动捕捉：${candidate.source}（${reportDate}）。待反查：Steam News、SteamDB、GamesPress、YouTube trailer、B站、indienova、官网/Discord。目标是确认是否仍处在最佳BD窗口。`;
}

function buildRisks(candidate, dropReason) {
  if (dropReason) return dropReason;
  const risks = [];
  if (typeof candidate.daysToRelease !== "number") risks.push("发售窗口未精确");
  if (!candidate.strongData) risks.push("缺少愿望单/口碑/社区强数据");
  if (!candidate.developers.length) risks.push("团队信息待确认");
  if (!candidate.contactMethods.length) risks.push("联系入口待确认");
  return risks.length ? risks.join("；") : "需要人工确认团队地区、中文计划、发行占位和商务合作意愿。";
}

function buildVerdict(className, dropReason) {
  if (className === "push") return "符合V2推进标准，建议优先确认中国区合作窗口与开发者真实需求";
  if (className === "drop") return `${dropReason}，暂不投入BD时间`;
  return "方向可看但还不够推进，先进入未处理 inbox，等待人工 review 后再分池";
}

function buildNextAction(className) {
  if (className === "drop") return "归档原因，避免重复讨论";
  if (className === "push") return "确认团队地区、商务邮箱/Discord、中文计划、Demo数据和是否已有中国能力发行商";
  return "人工 review 后决定进观察池/待评测/淘汰，并补曝光轨迹、数据和联系方式";
}

function buildLeadNote(candidate, className, dropReason) {
  if (className === "drop") return `V2判断：${dropReason}。`;
  if (className === "push") return "V2判断：窗口仍在，玩法/视觉/公开信号可支撑优先触达；下一步验证中国区权益空间。";
  return "V3判断：前置信号成立，但还缺强数据或明确可切入理由，先放入未处理 inbox 等人工分池。";
}

function buildBilibiliFit(candidate) {
  const text = `${candidate.genres.join(" ")} ${candidate.categories.join(" ")}`;
  if (/co-op|multiplayer/i.test(text)) return "多人协作适合直播切片、挑战局和UP主联动。";
  if (/strategy|simulation|management|automation|city builder|tower defense|factory/i.test(text)) return "系统型玩法适合做教学、机制讲解、效率挑战和长线栏目。";
  if (/roguelike|deckbuilder|card game|tactical/i.test(text)) return "构筑、流派和局内选择适合标题化、复盘化和挑战化。";
  if (candidate.highVisual) return "画面素材较完整，适合先做视觉向短内容和愿望单转化测试。";
  return "需要先看 Steam 页面素材，确认是否能被标题化、切片化和讲解化。";
}

function buildAmplification(candidate) {
  const text = `${candidate.genres.join(" ")} ${candidate.categories.join(" ")}`;
  if (/roguelike|deckbuilder|card game|tactical/i.test(text)) return "可围绕构筑、流派、挑战路线做栏目化内容。";
  if (/simulation|management|automation|city builder|factory/i.test(text)) return "可做新手指南、效率对比、失败案例和长期连载。";
  if (/co-op|multiplayer/i.test(text)) return "可做多人首测、主播局和社交传播节点。";
  return "先用实机素材验证点击和完播，再决定是否推进商务触达。";
}

function buildDailyReport(pools, rawCount, enrichedCount) {
  return {
    report_date: reportDate,
    summary: `Sourcing V3线上自动化：扫描候选 ${rawCount} 条、输出可review游戏 ${enrichedCount} 条；推荐优先复核 ${pools.push.length} 条、普通复核 ${pools.watch.length} 条、淘汰 ${pools.drop.length} 条。非淘汰项目统一进入未处理 inbox，人工 review 后再分池。`,
    insights: [
      "V3把日报读者明确为B站商务负责人：不输出泛趋势废话，只输出能辅助BD判断的信息。",
      "每个可review项目必须说明玩法循环、公开数据、优势、短板、B站内容/社区赋能方式和下一步动作。",
      "行业雷达必须来自真实媒体、厂商、法院/公司公告或可核验社区信号，不能用内部规则说明冒充行业新闻。",
      "发售不足60天、EA、叙事主导、印度团队、成熟发行商占位的项目不再进入推进池。",
      "有效lead必须回答三件事：窗口是否还在、权益空间是否还在、B站是否能把中国区盘子做大。",
      "自动日报只负责发现和优先级建议，非淘汰项目不得自动进入观察池/待评测/跟进池/推进池。"
    ],
    push_pool: pools.push,
    watch_pool: pools.watch,
    drop_pool: pools.drop
  };
}

function buildRadarReport(candidates, pools, industrySignals) {
  const genres = summarizeGenres(candidates);
  const mediaItems = industrySignals.slice(0, 6).map(mediaSignalToRadarItem);
  const bilibiliSignal = radarItem(
    "bilibili_bd_lens",
    "B站趋势",
    `今日Steam候选中值得人工复核的方向：${genres.slice(0, 4).join("、") || "待观察"}`,
    `样本高频不等于推荐。V3只关心这些方向里哪些产品能被UP主讲清楚、剪出看点、形成社区话题，并且仍有中国区权益空间。`,
    "中",
    "CRM Online Scan",
    "https://store.steampowered.com/search/?filter=popularcomingsoon",
    "这是给BD选品的背景信号，不是新闻，也不直接进入推进池。",
    `优先复核 ${pools.push.length} 个强信号项目；其余候选先在未处理 inbox 等人工分池。`
  );
  return {
    report_date: reportDate,
    summary: `Sourcing V3行业雷达：今日抓到 ${industrySignals.length} 条主流媒体/行业信号，另扫描 Steam 候选 ${candidates.length} 个。行业新闻只放真实外部事件；Steam样本只作为B站BD选品背景。`,
    items: [...mediaItems, bilibiliSignal]
  };
}

function buildSteamTrendReport(candidates, pools) {
  const genres = summarizeGenres(candidates);
  return {
    report_date: reportDate,
    summary: `今日Steam趋势V3：扫描 ${candidates.length} 个候选，推进 ${pools.push.length}、观察 ${pools.watch.length}、淘汰 ${pools.drop.length}。本页只服务BD判断：看产品优劣、数据、玩法、B站能否赋能和下一步动作。`,
    market_insights: [
      steamInsight("bd_decision_cards", "趋势页改为BD判断卡", "V3不再把Indie、Adventure这类标签当趋势结论；每个候选必须写清玩法、公开数据、优势短板、B站赋能和BD动作。", "高", "CRM Sourcing V3", "https://github.com/Neo0109/CRM/blob/main/docs/SOURCING_RULES_V3.md", "只把能辅助商务判断的信息留在趋势页。"),
      steamInsight("push_watch_drop", `今日复核结构：强信号${pools.push.length} / 普通候选${pools.watch.length} / 淘汰${pools.drop.length}`, "自动化只给优先级和淘汰理由，非淘汰项目统一进入未处理 inbox，避免误把未读线索塞进观察池。", "中", "CRM Online Scan", "https://store.steampowered.com/search/?filter=popularcomingsoon", "先处理未处理 inbox，再由人工分配观察池、待评测或跟进。")
    ],
    genre_signals: [],
    items: candidates.slice(0, 12).map((candidate) => ({
      id: `steam_trend_${reportDate.replaceAll("-", "_")}_${candidate.appId}`,
      title: candidate.title,
      steam_app_id: candidate.appId,
      rank_bucket: candidate.source,
      signal: buildV3SteamSignal(candidate),
      source: "Steam Store / AppDetails",
      links: [candidate.storeUrl, candidate.steamDbUrl],
      bilibili_fit: buildBilibiliFit(candidate),
      reason: buildV3TrendReason(candidate),
      auto_import: candidate.score >= 24 && !candidate.earlyAccess && !candidate.publisherOccupied,
      captured_at: capturedAt
    })),
    crm_candidates: [...pools.push, ...pools.watch.slice(0, 8)]
  };
}

async function fetchIndustrySignals() {
  const results = (await Promise.all(mediaSources().map(fetchMediaSource))).flat();
  const scored = results
    .map((item) => ({ ...item, score: scoreMediaSignal(item) }))
    .filter((item) => item.score >= 12)
    .sort((a, b) => b.score - a.score);

  return selectDiverseMediaSignals(dedupeMediaSignals(scored), 6);
}

function mediaSources() {
  return [
    { name: "GamesIndustry.biz", url: "https://www.gamesindustry.biz/feed", type: "feed", quality: 14, focus: ["business", "publishing"] },
    { name: "GameDeveloper", url: "https://www.gamedeveloper.com/rss.xml", type: "feed", quality: 13, focus: ["development", "business"] },
    { name: "VGC", url: "https://www.videogameschronicle.com/feed/", type: "feed", quality: 12, focus: ["industry", "platform"] },
    { name: "Eurogamer", url: "https://www.eurogamer.net/feed/news", type: "feed", quality: 11, focus: ["industry", "product"] },
    { name: "PC Gamer", url: "https://www.pcgamer.com/rss/", type: "feed", quality: 10, focus: ["pc", "community"] },
    { name: "IGN", url: "https://www.ign.com/rss/articles/feed?tags=games", type: "feed", quality: 10, focus: ["product", "mainstream"] },
    { name: "Gematsu", url: "https://www.gematsu.com/feed", type: "feed", quality: 9, focus: ["product", "asia"] },
    { name: "The Verge Gaming", url: "https://www.theverge.com/rss/games/index.xml", type: "feed", quality: 9, focus: ["platform", "technology"] },
    { name: "GameSpot", url: "https://www.gamespot.com/feeds/news/", type: "feed", quality: 8, focus: ["mainstream", "product"] },
    { name: "GameLook", url: "http://www.gamelook.com.cn/feed", type: "feed", quality: 12, focus: ["china", "business"] },
    { name: "触乐", url: "https://www.chuapp.com/?feed=rss2", type: "feed", quality: 11, focus: ["china", "culture"] },
    { name: "IT之家", url: "https://www.ithome.com/rss/", type: "feed", quality: 7, focus: ["china", "technology"] },
    { name: "3DM", url: "https://www.3dmgame.com/news/", type: "page", quality: 6, focus: ["china", "product"] },
    { name: "游民星空", url: "https://www.gamersky.com/news/", type: "page", quality: 6, focus: ["china", "product"] },
    { name: "证券时报", url: "https://www.stcn.com/", type: "page", quality: 10, focus: ["china", "capital", "legal"] },
    { name: "澎湃新闻", url: "https://m.thepaper.cn/", type: "page", quality: 9, focus: ["china", "legal", "society"] }
  ].filter((source) => !source.activeUntil || reportDate <= source.activeUntil);
}

async function fetchMediaSource(source) {
  try {
    const text = await fetchText(source.url, 12000, "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8");
    if (source.type === "feed") return parseFeedItems(text, source);
    if (source.type === "article") return [parseArticleItem(text, source)].filter(Boolean);
    return parsePageItems(text, source);
  } catch (error) {
    console.warn(`Media source failed for ${source.name}: ${error.message}`);
    return [];
  }
}

function parseFeedItems(xml, source) {
  const items = [];
  const blocks = String(xml).split(/<item\b|<entry\b/i).slice(1);
  for (const block of blocks.slice(0, 20)) {
    const title = cleanExtractedText(readXmlTag(block, "title"));
    const rawLink = readXmlTag(block, "link") || block.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || "";
    const link = absolutizeUrl(decodeHtml(stripTags(rawLink)).trim(), source.url);
    const summary = cleanExtractedText(readXmlTag(block, "description") || readXmlTag(block, "summary") || "");
    const publishedAt = cleanExtractedText(readXmlTag(block, "pubDate") || readXmlTag(block, "published") || "");
    if (title && link) items.push(sourceTaggedItem({ title, link, summary, published_at: publishedAt }, source));
  }
  return items;
}

function parsePageItems(html, source) {
  const items = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html).matchAll(anchorPattern)) {
    const title = cleanExtractedText(match[2]);
    if (title.length < 8 || title.length > 100) continue;
    items.push(sourceTaggedItem({
      title,
      link: absolutizeUrl(match[1], source.url),
      summary: title,
      published_at: ""
    }, source));
    if (items.length >= 30) break;
  }
  return items;
}

function parseArticleItem(html, source) {
  const title = cleanExtractedText(
    String(html).match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
    ?? String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?? ""
  );
  const summary = cleanExtractedText(
    String(html).match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)?.[1]
    ?? String(html).match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1]
    ?? title
  );
  return title ? sourceTaggedItem({ title, link: source.url, summary, published_at: "" }, source) : null;
}

function readXmlTag(block, tagName) {
  const match = String(block).match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match?.[1]?.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "") ?? "";
}

function scoreMediaSignal(item) {
  const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
  let topicPoints = 0;
  topicPoints += topicScore(text, /\b(publisher|publishing|acquisition|investment|funding|layoffs?|union|lawsuit|court|rights?|licen[cs]e|ip|studio closure|executive|leadership)\b|出版|收购|投资|融资|裁员|诉讼|法院|判决|死刑|执行死刑|版权|授权|股权|高管|创始人|工作室|关停|监管|版号|财报/, 18);
  topicPoints += topicScore(text, /\b(expansion|dlc|major update|announced|showcase|release date|delay|remaster|remake|sequel|cross[- ]?media|adaptation|restarted from scratch)\b|资料片|大型更新|公布|发布会|延期|重制|续作|新作|改编|影视化|动画|联动|周年|上线|定档|发售|手游|端游/, 14);
  topicPoints += topicScore(text, /\b(steam|epic games store|game pass|playstation|xbox|switch|nintendo|mobile|wishlist|demo|next fest|early access|store policy|platform)\b|平台|商店|愿望单|试玩|新品节|抢先体验|主机|移动端|渠道/, 12);
  topicPoints += topicScore(text, /\b(streamer|creator|ugc|youtube|twitch|community|mod|viral|meme|esports)\b|主播|创作者|up主|视频|直播|社区|二创|模组|爆火|梗|赛事|传播/, 10);
  topicPoints += topicScore(text, /\b(ai|artificial intelligence|generative ai|procedural|toolchain|engine|ue5|unity)\b|人工智能|生成式|aigc|程序化|工具链|引擎|虚幻|Unity/i, 12);
  topicPoints += topicScore(text, /\b(china|chinese|bilibili|asia|netease|tencent)\b|中国|国产|出海|B站|哔哩哔哩|腾讯|网易|米哈游|莉莉丝|心动|鹰角/, 12);
  topicPoints += topicScore(text, /\b(report|analysis|interview|confirmed|official|financial results)\b|报告|分析|专访|确认|官方|公告|财报/, 4);

  let score = (item.source_quality ?? 0) + topicPoints;
  if (topicPoints < 8) score -= 12;
  if (!hasGameOrBdContext(text, item)) score -= 30;

  if (/\b(review|guide|walkthrough|tips|best settings|deal|sale|discount|cosplay|quiz)\b|攻略|评测|折扣|促销|史低|壁纸|图赏|盘点/.test(text)) score -= 10;
  if (/rumor|leak|传闻|曝/.test(text) && !/\b(confirmed|official)\b|确认|官方|公告/.test(text)) score -= 4;
  return score;
}

function dedupeMediaSignals(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = normalizeText(item.title).slice(0, 80);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function selectDiverseMediaSignals(items, limit) {
  const selected = [];
  const sourceCount = new Map();
  const familyCount = new Map();

  for (const item of items) {
    const family = mediaTopicFamily(item);
    if ((sourceCount.get(item.source) ?? 0) >= 2) continue;
    if ((familyCount.get(family) ?? 0) >= 2) continue;
    selected.push(item);
    sourceCount.set(item.source, (sourceCount.get(item.source) ?? 0) + 1);
    familyCount.set(family, (familyCount.get(family) ?? 0) + 1);
    if (selected.length >= limit) return selected;
  }

  for (const item of items) {
    if (selected.includes(item)) continue;
    selected.push(item);
    if (selected.length >= limit) break;
  }

  return selected;
}

function mediaSignalToRadarItem(item, index) {
  const category = categoryForMediaSignal(item);
  const title = normalizeDisplayText(item.title);
  return radarItem(
    `media_${index}_${normalizeText(title).replace(/[^a-z0-9]+/g, "_").slice(0, 36)}`,
    category,
    title,
    conciseMediaSummary(item),
    item.score >= 25 ? "高" : "中",
    item.source,
    item.link,
    relevanceForMediaSignal(item),
    actionForMediaSignal(item)
  );
}

function categoryForMediaSignal(item) {
  const family = mediaTopicFamily(item);
  if (family === "business_legal") return "发行八卦";
  if (family === "ai_production") return "AI 游戏";
  if (family === "creator_community") return "B站趋势";
  return "行业新闻";
}

function conciseMediaSummary(item) {
  const text = [item.summary, item.title].filter(Boolean).join(" ");
  const cleaned = normalizeDisplayText(text);
  const family = mediaTopicFamily(item);
  if (family === "product_ip") return `产品/IP生命周期信号：${cleaned.slice(0, 80)}。重点看UP主选题、社区回流、愿望单/复购转化或长线运营案例。`;
  if (family === "business_legal") return `公司/IP/法律/资本信号：${cleaned.slice(0, 80)}。重点看合作方可信度、权属风险或BD切入窗口。`;
  if (family === "platform_market") return `平台/渠道/市场节奏信号：${cleaned.slice(0, 80)}。重点看发现入口、曝光成本或中国区发行窗口。`;
  if (family === "creator_community") return `社区/创作者信号：${cleaned.slice(0, 80)}。重点看B站内容打法、达人合作和话题扩散。`;
  if (family === "ai_production") return `AI/工具链信号：${cleaned.slice(0, 80)}。重点看研发效率、素材风险、内容供给质量和平台合规。`;
  return cleaned.slice(0, 120);
}

function relevanceForMediaSignal(item) {
  const family = mediaTopicFamily(item);
  if (family === "product_ip") return "对B站商务的价值在于识别可被内容节点重新点燃的产品/IP。";
  if (family === "business_legal") return "对BD判断的价值在于把合作方治理、IP权属、发行占位和关键人风险纳入尽调。";
  if (family === "platform_market") return "对BD判断的价值在于判断平台流量规则、窗口期和发行资源配置是否变化。";
  if (family === "creator_community") return "对B站商务的价值在于判断是否能形成UP主选题、直播节点和社区扩散。";
  if (family === "ai_production") return "对BD判断的价值在于理解供给侧变化、研发效率和内容合规风险。";
  return "用于判断游戏行业外部环境、发行节奏和内容平台可介入窗口。";
}

function actionForMediaSignal(item) {
  const family = mediaTopicFamily(item);
  if (family === "product_ip") return "记录内容节点和社区反应；判断是否能做B站专题、UP主共创或发行前置沟通。";
  if (family === "business_legal") return "补公司治理、股权/IP权属、发行协议、诉讼和关键人风险检查。";
  if (family === "platform_market") return "复核平台窗口、榜单入口、Demo/愿望单数据和中国区资源位机会。";
  if (family === "creator_community") return "观察B站/YouTube/Twitch等内容扩散，筛选可合作达人和可复制选题。";
  if (family === "ai_production") return "关注产品是否涉及AI披露、素材争议、产能变化或平台合规风险。";
  return "只保留有BD启发的媒体信号；无业务动作的普通新闻不进雷达。";
}

function sourceTaggedItem(item, source) {
  return {
    ...item,
    source: source.name,
    source_focus: source.focus ?? [],
    source_quality: source.quality ?? 0
  };
}

function topicScore(text, pattern, points) {
  return pattern.test(text) ? points : 0;
}

function mediaTopicFamily(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (/\b(ai|artificial intelligence|generative ai|procedural|toolchain|engine|ue5|unity)\b|人工智能|生成式|aigc|程序化|工具链|引擎|虚幻|Unity/i.test(text)) return "ai_production";
  if (/\b(publisher|publishing|acquisition|investment|funding|layoffs?|lawsuit|court|rights?|licen[cs]e|studio closure|executive|leadership)\b|出版|收购|投资|融资|裁员|诉讼|法院|判决|死刑|执行死刑|版权|授权|股权|高管|创始人|工作室|关停|监管|版号|财报/.test(text)) return "business_legal";
  if (/\b(expansion|dlc|major update|announced|showcase|release date|delay|remaster|remake|sequel|cross[- ]?media|adaptation|restarted from scratch)\b|资料片|大型更新|公布|发布会|延期|重制|续作|新作|改编|影视化|动画|联动|周年|上线|定档|发售|手游|端游/.test(text)) return "product_ip";
  if (/\b(streamer|creator|ugc|youtube|twitch|community|mod|viral|meme|esports)\b|主播|创作者|up主|视频|直播|社区|二创|模组|爆火|梗|赛事|传播/.test(text)) return "creator_community";
  if (/\b(steam|epic games store|game pass|playstation|xbox|switch|nintendo|mobile|wishlist|demo|next fest|early access|store policy|platform)\b|平台|商店|愿望单|试玩|新品节|抢先体验|主机|移动端|渠道/.test(text)) return "platform_market";
  return "industry_context";
}

function buildV3SteamSignal(candidate) {
  return [
    `数据：${candidate.source}；发售窗口 ${candidate.releaseDate}；score=${candidate.score}；推荐数 ${candidate.recommendationCount || "无公开"}；素材 ${candidate.screenshotCount}图/${candidate.movieCount}视频。`,
    `玩法：${candidate.shortDescription || candidate.genres.join(" / ") || "待打开Steam页确认玩法循环"}。`,
    `优势：${buildProductStrength(candidate)}。`,
    `短板：${buildProductWeakness(candidate)}。`
  ].join("\n");
}

function buildV3TrendReason(candidate) {
  if (candidate.releaseTooSoon) return "不建议推进：窗口过近，只作为市场背景。";
  if (candidate.earlyAccess) return "不建议推进：Early Access命中排除项。";
  if (candidate.publisherOccupied) return "不建议推进：成熟发行商可能已占位。";
  return `B站赋能：${buildBilibiliFit(candidate)} BD动作：${candidate.score >= 58 ? "优先确认中国区权益、联系方式、中文计划和Demo/愿望单数据。" : "先补公开数据、视频素材、社区反馈和发行占位，再决定是否触达。"}`;
}

function buildProductStrength(candidate) {
  const strengths = [];
  if (candidate.strongGameplay) strengths.push("玩法具备机制表达空间");
  if (candidate.highVisual) strengths.push("截图/视频素材较完整");
  if (candidate.strongData) strengths.push("存在公开数据或榜单信号");
  if (candidate.contactMethods.length) strengths.push("有可尝试联系入口");
  return strengths.join("；") || "目前只有基础Steam曝光，优势待复核";
}

function buildProductWeakness(candidate) {
  const weaknesses = [];
  if (typeof candidate.daysToRelease !== "number") weaknesses.push("发售窗口不精确");
  if (!candidate.strongData) weaknesses.push("缺愿望单/口碑/社区强数据");
  if (!candidate.highVisual) weaknesses.push("视觉素材不足，内容转化需验证");
  if (candidate.releaseTooSoon) weaknesses.push("发售过近");
  if (candidate.publisherOccupied) weaknesses.push("发行可能已占位");
  return weaknesses.join("；") || "主要风险在团队地区、发行结构和中国区权益空间";
}

function radarItem(id, category, title, summary, heat, source, link, relevance, suggestedAction) {
  return { id: `radar_${reportDate.replaceAll("-", "_")}_${id}`, category, title, summary, heat, source, link, relevance, suggested_action: suggestedAction, captured_at: capturedAt };
}

function steamInsight(id, title, summary, signalLevel, source, link, suggestedAction) {
  return { id: `steam_macro_${reportDate.replaceAll("-", "_")}_${id}`, title, summary, signal_level: signalLevel, source, link, suggested_action: suggestedAction, captured_at: capturedAt };
}

function summarizeGenres(candidates) {
  const counts = new Map();
  for (const candidate of candidates) for (const genre of candidate.genres.slice(0, 4)) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([genre]) => genre);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: defaultHeaders("application/json,text/html;q=0.9,*/*;q=0.8") });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchText(url, timeoutMs, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: defaultHeaders(accept) });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function defaultHeaders(accept) {
  return { "User-Agent": "Mozilla/5.0 SourcingCRM/1.0 (+https://github.com/Neo0109/CRM)", Accept: accept ?? "*/*" };
}

async function writeJson(relativePath, payload) {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function dedupeByAppId(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item?.appId || seen.has(String(item.appId))) continue;
    seen.add(String(item.appId));
    out.push({ ...item, appId: String(item.appId) });
  }
  return out;
}

function stripPrivate(lead) {
  const { _class, ...rest } = lead;
  return rest;
}

function hasMaturePublisher(publishers) {
  const text = publishers.join(" ").toLowerCase();
  return ["devolver", "raw fury", "annapurna", "team17", "hooded horse", "tinybuild", "kasedo", "kepler", "11 bit", "chucklefish", "humble", "paradox", "focus", "playstack", "fireshine", "nacon", "secret mode", "thunderful", "netea", "tencent", "bilibili", "xd", "gamera", " indienova"].some((name) => text.includes(name.trim()));
}

function looksDomestic(text) {
  return /[\u4e00-\u9fff]/.test(text) || /china|beijing|shanghai|shenzhen|guangzhou|chengdu|hangzhou|wuhan|xiamen|nanjing|suzhou|chongqing/i.test(text);
}

function normalizeReleaseDate(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const parsed = Date.parse(cleaned);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return cleaned || null;
}

function daysUntil(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
  const target = new Date(`${value}T00:00:00+08:00`).getTime();
  const now = new Date(`${reportDate}T00:00:00+08:00`).getTime();
  return Math.round((target - now) / 86400000);
}

function stripTags(value) {
  return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function decodeHtml(value) {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ");
}

function normalizeDisplayText(value) {
  return cleanExtractedText(value);
}

function cleanExtractedText(value) {
  return stripTags(decodeHtml(value)).replace(/\s+/g, " ").trim();
}

function hasGameOrBdContext(text, item) {
  const broadSources = new Set(["IT之家", "证券时报", "澎湃新闻"]);
  if (!broadSources.has(item.source)) return true;
  return /game|gaming|steam|xbox|playstation|nintendo|switch|publisher|developer|studio|bilibili|acg|ip|游戏|手游|端游|主机|电竞|动画|动漫|发行|发售|上线|资料片|腾讯游戏|网易游戏|米哈游|莉莉丝|心动|鹰角|游族|三体|版权|授权|版号|B站|哔哩哔哩/i.test(text);
}

function normalizeText(value) {
  return String(value ?? "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return String(value ?? "").trim().replace(/\/$/, "").toLowerCase();
  }
}

function absolutizeUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
