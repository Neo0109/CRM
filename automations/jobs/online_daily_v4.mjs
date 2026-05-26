// Online CRM generator v4: Sourcing Rules V2.
// Core principle: discovery can be broad, push recommendations must be strict.
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
}

enrichedCandidates.sort((a, b) => b.score - a.score);
const pools = buildPools(enrichedCandidates);

await writeJson(`data/reports/${reportDate}.json`, buildDailyReport(pools, rawCandidates.length, enrichedCandidates.length));
await writeJson(`data/radar/${reportDate}.json`, buildRadarReport(enrichedCandidates, pools));
await writeJson(`data/steam_trends/${reportDate}.json`, buildSteamTrendReport(enrichedCandidates, pools));

console.log(JSON.stringify({
  ok: true,
  generator: "online_daily_v4_sourcing_rules_v2",
  report_date: reportDate,
  candidates_seen: rawCandidates.length,
  candidates_enriched: enrichedCandidates.length,
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
  for (const reportPath of [`data/reports/${date}.json`, previousDatePath(date)].filter(Boolean)) {
    try {
      const report = JSON.parse(await readFile(path.join(rootDir, reportPath), "utf8"));
      for (const bucket of ["push_pool", "watch_pool", "drop_pool"]) {
        for (const lead of report[bucket] ?? []) if (lead.project) names.add(normalizeText(lead.project));
      }
    } catch {}
  }
  return names;
}

function previousDatePath(date) {
  const current = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(current.getTime())) return null;
  current.setUTCDate(current.getUTCDate() - 1);
  return `data/reports/${current.toISOString().slice(0, 10)}.json`;
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
  try {
    const payload = await fetchJson(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=english`);
    const entry = payload[String(appId)];
    return entry?.success && entry.data?.type === "game" ? entry.data : null;
  } catch (error) {
    console.warn(`AppDetails failed for ${appId}: ${error.message}`);
    return null;
  }
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
  if (support.email) methods.push({ type: "Email", value: support.email, note: "Steam support email" });
  if (details?.website) methods.push({ type: "官网", value: details.website, note: "Steam official website" });
  if (support.url && support.url !== details?.website) methods.push({ type: "官网", value: support.url, note: "Steam support URL" });
  if (!methods.length) methods.push({ type: "Steam", value: `https://steamcommunity.com/app/${appId}/discussions/`, note: "Official Steam community fallback" });
  return methods.slice(0, 3);
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
  const bucket = className === "push" ? "推进池" : className === "drop" ? "淘汰池" : "观察池";
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
    stage: className === "push" ? "active" : className === "drop" ? "rejected" : "watch",
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
  return `${candidate.source} 有前置信号，${windowText}；先入观察池，等待 Demo/愿望单/社区扩散或发行结构进一步确认`;
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
  return "方向可看但还不够推进，先留在观察池等待更强公开信号";
}

function buildNextAction(className) {
  if (className === "drop") return "归档原因，避免重复讨论";
  if (className === "push") return "确认团队地区、商务邮箱/Discord、中文计划、Demo数据和是否已有中国能力发行商";
  return "补曝光轨迹、Demo/愿望单/社区反馈、发行结构和联系方式";
}

function buildLeadNote(candidate, className, dropReason) {
  if (className === "drop") return `V2判断：${dropReason}。`;
  if (className === "push") return "V2判断：窗口仍在，玩法/视觉/公开信号可支撑优先触达；下一步验证中国区权益空间。";
  return "V2判断：前置信号成立，但还缺强数据或明确可切入理由，先观察。";
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
    summary: `Sourcing V2线上自动化：扫描候选 ${rawCount} 条、输出可review游戏 ${enrichedCount} 条；推进池 ${pools.push.length} 条、观察池 ${pools.watch.length} 条、淘汰池 ${pools.drop.length} 条。推进池不强行凑数，临近上线项目默认不进推进。`,
    insights: [
      "V2把发现标准和推进标准拆开：日报可以有很多观察项，但推进池必须严格。",
      "发售不足60天、EA、叙事主导、印度团队、成熟发行商占位的项目不再进入推进池。",
      "Steam Popular Upcoming、Demo/Next Fest、SteamDB和官方社区是前置发现入口；Popular New/Top Sellers只做大盘背景。",
      "有效lead必须回答三件事：窗口是否还在、权益空间是否还在、B站是否能把中国区盘子做大。"
    ],
    push_pool: pools.push,
    watch_pool: pools.watch,
    drop_pool: pools.drop
  };
}

function buildRadarReport(candidates, pools) {
  const genres = summarizeGenres(candidates);
  return {
    report_date: reportDate,
    summary: `Sourcing V2行业雷达：今日Steam候选 ${candidates.length} 个，高频方向为 ${genres.slice(0, 4).join("、") || "待观察"}。雷达重点从“今天有什么新游戏”转向“哪些前置信号值得长期盯”。`,
    items: [
      radarItem("v2_system", "行业新闻", "日报升级为前置发现系统", "今天的核心不是补几个游戏名，而是把Steam、Demo、社区、视频和新闻稿当成长期雷达站，持续扩大候选池。", "高", "CRM Sourcing V2", "https://github.com/Neo0109/CRM/blob/main/docs/SOURCING_RULES_V2.md", "帮助团队区分发现、观察、推进和淘汰。", "用V2规则复盘每天进入推进池的项目是否真的可切入。"),
      radarItem("popular_upcoming", "发行趋势", "Popular Upcoming 适合前置发现，但不能直接等同推荐", "热门即将推出说明项目有可见度，不代表B站能切入；必须结合发售窗口、发行结构和B站放大价值。", "高", "Steam Store", "https://store.steampowered.com/search/?filter=popularcomingsoon", "避免把明后天上线的项目误判为BD机会。", "把临近上线项目归为大盘观察或淘汰，不进推进池。"),
      radarItem("genre_density", "B站趋势", `今日Steam样本高频品类：${genres.slice(0, 4).join("、") || "待观察"}`, "高频品类代表供给密度，不代表每个都值得推进；要看机制差异、视频表达和社区可扩散性。", "中", "CRM Online Scan", "https://store.steampowered.com/", "只保留有强视觉、强数据或强传播点的项目。", "观察池记录缺什么信号，避免无差别收藏。")
    ]
  };
}

function buildSteamTrendReport(candidates, pools) {
  const genres = summarizeGenres(candidates);
  return {
    report_date: reportDate,
    summary: `今日Steam趋势：扫描到 ${candidates.length} 个候选。宏观看 ${genres.slice(0, 4).join("、") || "新品节窗口和热门即将推出"}；适合CRM的候选已进入日报池，但推进池按V2严格筛选。`,
    market_insights: [
      steamInsight("runway", "前置窗口比临近上线更重要", "Popular Upcoming和Demo/Next Fest能帮助发现项目，但发售不足60天默认不再进推进池。", "高", "Steam", "https://store.steampowered.com/search/?filter=popularcomingsoon", "优先找3-6个月窗口内仍未被中国能力占位的项目。"),
      steamInsight("macro_genres", `今日高频品类：${genres.slice(0, 4).join("、") || "待观察"}`, "高频品类只说明供给密度，真正要看B站内容化、开发者权益空间和公开数据。", "中", "CRM Online Scan", "https://steamdb.info/charts/?sort=trending", "把宏观趋势作为选品背景，不直接当推荐理由。")
    ],
    genre_signals: genres.slice(0, 5).map((genre) => ({
      id: `steam_genre_${reportDate.replaceAll("-", "_")}_${normalizeText(genre).replace(/[^a-z0-9]+/g, "_").slice(0, 32)}`,
      genre,
      signal: `${genre} 在今日样本中出现较多，需区分机制差异和普通跟风供给。`,
      why_it_matters: "B站内容需要能被讲清楚、剪出来、做挑战；只有标签相似不够。",
      bd_action: "保留Steam页面完整、素材可验证、联系入口明确且未被成熟中国发行能力占位的项目。",
      links: ["https://store.steampowered.com/search/?filter=popularcomingsoon", "https://steamdb.info/charts/?sort=trending"]
    })),
    items: candidates.slice(0, 12).map((candidate) => ({
      id: `steam_trend_${reportDate.replaceAll("-", "_")}_${candidate.appId}`,
      title: candidate.title,
      steam_app_id: candidate.appId,
      rank_bucket: candidate.source,
      signal: `${candidate.source}；${candidate.releaseDate}；score=${candidate.score}`,
      source: "Steam Store / AppDetails",
      links: [candidate.storeUrl, candidate.steamDbUrl],
      bilibili_fit: buildBilibiliFit(candidate),
      reason: candidate.releaseTooSoon ? "临近上线，仅作大盘观察，不进推进池" : candidate.score >= 48 ? "可进入CRM观察或推进候选" : "作为大盘趋势观察，不直接推进",
      auto_import: candidate.score >= 24 && !candidate.earlyAccess && !candidate.publisherOccupied,
      captured_at: capturedAt
    })),
    crm_candidates: [...pools.push, ...pools.watch.slice(0, 8)]
  };
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
  return String(value).replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#039;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&nbsp;", " ");
}

function normalizeText(value) {
  return String(value ?? "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
