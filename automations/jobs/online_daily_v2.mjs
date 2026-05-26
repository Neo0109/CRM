// Resilient online generator for GitHub Actions. No third-party dependencies.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const args = parseArgs(process.argv.slice(2));
const reportDate = args.date ?? todayInShanghai();
const capturedAt = `${reportDate}T09:30:00+08:00`;
const maxDetails = Number(args.maxDetails ?? 45);
const existingProjects = await readExistingProjectNames(reportDate);

const searchGroups = await Promise.all([
  fetchSteamSearch("popularcomingsoon", "Popular Upcoming"),
  fetchSteamSearch("popularnew", "Popular New"),
  fetchSteamSearch("topsellers", "Top Sellers Context"),
  fetchSteamSearch("popularcomingsoon", "Strategy Upcoming", [9]),
  fetchSteamSearch("popularcomingsoon", "Simulation Upcoming", [599]),
  fetchSteamSearch("popularcomingsoon", "Co-op Upcoming", [1685]),
  fetchSteamSearch("popularcomingsoon", "Deckbuilder Upcoming", [32322])
]);

const featuredGroups = await fetchFeaturedCategories();
const rawCandidates = dedupeByAppId([...searchGroups.flat(), ...featuredGroups])
  .filter((candidate) => candidate.appId && !existingProjects.has(normalizeText(candidate.title)))
  .slice(0, maxDetails);

const detailsByAppId = await fetchAppDetails(rawCandidates.map((candidate) => candidate.appId));
const enrichedCandidates = [];
for (const candidate of rawCandidates) {
  const details = detailsByAppId.get(candidate.appId);
  const enriched = await enrichSteamCandidate(candidate, details);
  if (enriched) enrichedCandidates.push(enriched);
}

enrichedCandidates.sort((a, b) => b.score - a.score);

const pools = buildLeadPools(enrichedCandidates);
const dailyReport = buildDailyReport(pools, enrichedCandidates.length, rawCandidates.length);
const radarReport = buildRadarReport(enrichedCandidates, pools);
const steamTrendReport = buildSteamTrendReport(enrichedCandidates, pools);

await writeJson(`data/reports/${reportDate}.json`, dailyReport);
await writeJson(`data/radar/${reportDate}.json`, radarReport);
await writeJson(`data/steam_trends/${reportDate}.json`, steamTrendReport);

console.log(JSON.stringify({
  ok: true,
  generator: "online_daily_v2",
  report_date: reportDate,
  candidates_seen: rawCandidates.length,
  candidates_enriched: enrichedCandidates.length,
  push_pool: dailyReport.push_pool.length,
  watch_pool: dailyReport.watch_pool.length,
  drop_pool: dailyReport.drop_pool.length
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
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

async function readExistingProjectNames(date) {
  const names = new Set();
  for (const reportPath of [`data/reports/${date}.json`, previousDatePath(date)].filter(Boolean)) {
    try {
      const report = JSON.parse(await readFile(path.join(rootDir, reportPath), "utf8"));
      for (const bucket of ["push_pool", "watch_pool", "drop_pool"]) {
        for (const lead of report[bucket] ?? []) {
          if (lead.project) names.add(normalizeText(lead.project));
        }
      }
    } catch {
      // Missing history is fine on first runs.
    }
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
  const resultsUrl = new URL("https://store.steampowered.com/search/results/");
  resultsUrl.searchParams.set("query", "");
  resultsUrl.searchParams.set("start", "0");
  resultsUrl.searchParams.set("count", "50");
  resultsUrl.searchParams.set("dynamic_data", "");
  resultsUrl.searchParams.set("infinite", "1");
  resultsUrl.searchParams.set("filter", filter);
  resultsUrl.searchParams.set("category1", "998");
  resultsUrl.searchParams.set("os", "win");
  resultsUrl.searchParams.set("l", "english");
  if (tags.length) resultsUrl.searchParams.set("tags", tags.join(","));

  const pageUrl = new URL("https://store.steampowered.com/search/");
  pageUrl.searchParams.set("filter", filter);
  pageUrl.searchParams.set("category1", "998");
  pageUrl.searchParams.set("os", "win");
  pageUrl.searchParams.set("l", "english");
  if (tags.length) pageUrl.searchParams.set("tags", tags.join(","));

  try {
    const html = await fetchSteamResultsHtml(resultsUrl.toString());
    const parsed = parseSteamSearchHtml(html, source);
    if (parsed.length) return parsed;

    const fullPageHtml = await fetchText(pageUrl.toString(), 12000, "text/html,*/*;q=0.8");
    return parseSteamSearchHtml(fullPageHtml, source);
  } catch (error) {
    console.warn(`Steam search failed for ${source}: ${error.message}`);
    return [];
  }
}

async function fetchSteamResultsHtml(url) {
  const text = await fetchText(url, 12000, "application/json,text/html;q=0.9,*/*;q=0.8");
  try {
    const payload = JSON.parse(text);
    return payload.results_html ?? payload.html ?? text;
  } catch {
    return text;
  }
}

function parseSteamSearchHtml(html, source) {
  return String(html)
    .split(/<a\s+/i)
    .slice(1)
    .map((chunk) => `<a ${chunk}`)
    .map((chunk, index) => {
      const appId = chunk.match(/data-ds-appid=["']\[?(\d+)/i)?.[1]
        ?? chunk.match(/\/app\/(\d+)\//)?.[1]
        ?? null;
      const title = decodeHtml(stripTags(chunk.match(/<span[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "")).trim();
      const href = decodeHtml(chunk.match(/href=["']([^"']+)["']/i)?.[1] ?? "").split("?")[0];
      const release = decodeHtml(stripTags(chunk.match(/search_released[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "")).trim();
      const reviewText = decodeHtml(stripTags(chunk.match(/search_reviewscore[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "")).trim();
      const tags = [...chunk.matchAll(/<span[^>]*class=["'][^"']*top_tag[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)]
        .map((match) => decodeHtml(stripTags(match[1])).trim())
        .filter(Boolean);
      if (!appId || !title) return null;
      return { appId, title, href: `https://store.steampowered.com/app/${appId}/`, release, reviewText, tags, source, sourceIndex: index };
    })
    .filter(Boolean);
}

async function fetchFeaturedCategories() {
  try {
    const payload = await fetchJson("https://store.steampowered.com/api/featuredcategories?cc=us&l=english");
    const groups = [
      ["Featured New Releases", payload.new_releases?.items],
      ["Featured Top Sellers", payload.top_sellers?.items],
      ["Featured Coming Soon", payload.coming_soon?.items],
      ["Featured Specials Context", payload.specials?.items]
    ];

    return groups.flatMap(([source, items]) => (items ?? [])
      .filter((item) => String(item.type ?? 0) === "0" || item.type === "game")
      .map((item, index) => ({
        appId: String(item.id),
        title: item.name,
        href: `https://store.steampowered.com/app/${item.id}/`,
        release: source.includes("Coming") ? "Coming soon" : "",
        reviewText: "",
        tags: [],
        source,
        sourceIndex: index
      }))
      .filter((item) => item.appId && item.title));
  } catch (error) {
    console.warn(`Steam featured categories failed: ${error.message}`);
    return [];
  }
}

async function fetchAppDetails(appIds) {
  const details = new Map();
  for (const chunk of chunkArray(appIds, 20)) {
    try {
      const payload = await fetchJson(`https://store.steampowered.com/api/appdetails?appids=${chunk.join(",")}&cc=us&l=english`);
      for (const appId of chunk) {
        const entry = payload[String(appId)];
        if (entry?.success && entry.data?.type === "game") details.set(String(appId), entry.data);
      }
    } catch (error) {
      console.warn(`App details batch failed: ${error.message}`);
    }
  }
  return details;
}

async function enrichSteamCandidate(candidate, details) {
  if (!details) return null;
  const developers = Array.isArray(details.developers) ? details.developers : [];
  const publishers = Array.isArray(details.publishers) ? details.publishers : [];
  const genres = [...new Set([...(details.genres ?? []).map((genre) => genre.description), ...(candidate.tags ?? [])].filter(Boolean))].slice(0, 6);
  const categories = (details.categories ?? []).map((category) => category.description).slice(0, 10);
  const text = [details.name, details.short_description, ...developers, ...publishers, ...genres, ...categories].join(" ");
  const lower = text.toLowerCase();
  const releaseDate = normalizeReleaseDate(details.release_date?.date ?? candidate.release);
  const daysToRelease = daysUntil(releaseDate);
  const comingSoon = Boolean(details.release_date?.coming_soon) || /coming soon|tba|to be announced/i.test(candidate.release);
  const earlyAccess = /early access|抢先体验/i.test(text);
  const narrativeHeavy = /visual novel|story rich|interactive fiction|narrative|walking simulator/i.test(lower) && !/strategy|simulation|management|roguelike|deckbuilder|co-op|multiplayer|sandbox/i.test(lower);
  const strongGameplay = /co-op|multiplayer|strategy|simulation|management|automation|base building|colony|roguelike|deckbuilder|tactical|sandbox|survival|crafting|city builder|card game/i.test(lower);
  const highVisual = (details.screenshots?.length ?? 0) >= 5 || (details.movies?.length ?? 0) > 0;
  const publisherOccupied = hasMaturePublisher(publishers);
  const domestic = looksDomestic([details.name, ...developers, ...publishers, details.website].join(" "));
  const releaseTooSoon = typeof daysToRelease === "number" && daysToRelease >= 0 && daysToRelease < 60;
  const hasPublicData = /popular|top sellers|featured|review|demo|playtest/i.test([candidate.source, candidate.reviewText, lower].join(" "));
  const contactMethods = await collectContactMethods(details, candidate.appId);
  const score = scoreCandidate({ candidate, strongGameplay, highVisual, hasPublicData, releaseTooSoon, earlyAccess, narrativeHeavy, publisherOccupied, comingSoon, contactMethods });

  return {
    appId: String(candidate.appId),
    title: details.name ?? candidate.title,
    source: candidate.source,
    sourceIndex: candidate.sourceIndex,
    storeUrl: `https://store.steampowered.com/app/${candidate.appId}/`,
    steamDbUrl: `https://steamdb.info/app/${candidate.appId}/`,
    developers,
    publishers,
    country: domestic ? "中国（待确认）" : "海外",
    region: domestic ? "中国" : "海外",
    city: null,
    genres,
    categories,
    shortDescription: details.short_description ?? "",
    releaseDate: releaseDate ?? details.release_date?.date ?? candidate.release ?? "待确认",
    daysToRelease,
    comingSoon,
    earlyAccess,
    narrativeHeavy,
    strongGameplay,
    highVisual,
    hasPublicData,
    publisherOccupied,
    contactMethods,
    website: details.website ?? null,
    score
  };
}

async function collectContactMethods(details, appId) {
  const methods = [];
  const support = details.support_info ?? {};
  if (support.email) methods.push({ type: "Email", value: support.email, note: "Steam support email" });
  if (details.website) methods.push({ type: "官网", value: details.website, note: "Steam official website" });
  if (support.url && support.url !== details.website) methods.push({ type: "Support", value: support.url, note: "Steam support URL" });

  const website = details.website || support.url;
  if (website && /^https?:\/\//i.test(website)) {
    try {
      const html = await fetchText(website, 7000, "text/html,*/*;q=0.8");
      const mail = decodeHtml(html.match(/mailto:([^"'?#>\s]+)/i)?.[1] ?? "");
      if (mail && !methods.some((method) => method.value === mail)) methods.unshift({ type: "Email", value: mail, note: "Found on official site" });
      for (const [type, pattern] of [
        ["Discord", /https?:\/\/(?:www\.)?(?:discord\.gg|discord\.com\/invite)\/[^"'<>\s]+/i],
        ["X/Twitter", /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^"'<>\s]+/i],
        ["B站", /https?:\/\/(?:space\.)?bilibili\.com\/[^"'<>\s]+/i]
      ]) {
        const value = html.match(pattern)?.[0];
        if (value && !methods.some((method) => method.value === value)) methods.push({ type, value, note: "Found on official site" });
      }
    } catch {
      // Some official sites block crawler requests. Keep Steam-provided contact entries.
    }
  }

  if (!methods.length) {
    methods.push({ type: "Steam社区", value: `https://steamcommunity.com/app/${appId}/discussions/`, note: "Fallback official community" });
  }
  return methods.slice(0, 4);
}

function scoreCandidate(input) {
  let score = 0;
  if (input.candidate.source.includes("Upcoming")) score += 22;
  if (input.candidate.source.includes("Featured")) score += 8;
  if (input.strongGameplay) score += 18;
  if (input.highVisual) score += 12;
  if (input.hasPublicData) score += 8;
  if (input.comingSoon) score += 6;
  if (input.contactMethods.length) score += 5;
  if (input.releaseTooSoon) score -= 16;
  if (input.publisherOccupied) score -= 20;
  if (input.earlyAccess) score -= 40;
  if (input.narrativeHeavy) score -= 18;
  return score;
}

function buildLeadPools(candidates) {
  const leads = candidates.map(toLead);
  const pushPool = leads.filter((lead) => lead._class === "push").slice(0, 3);
  const used = new Set(pushPool.map((lead) => lead.steam_app_id));
  const watchPool = leads.filter((lead) => lead._class === "watch" && !used.has(lead.steam_app_id)).slice(0, 12);
  for (const lead of watchPool) used.add(lead.steam_app_id);
  const dropPool = leads.filter((lead) => lead._class === "drop" && !used.has(lead.steam_app_id)).slice(0, 10);
  return {
    push: pushPool.map(stripPrivateFields),
    watch: watchPool.map(stripPrivateFields),
    drop: dropPool.map(stripPrivateFields)
  };
}

function toLead(candidate) {
  const releaseTooSoon = typeof candidate.daysToRelease === "number" && candidate.daysToRelease >= 0 && candidate.daysToRelease < 60;
  const dropReason = candidate.earlyAccess ? "命中排除项：PC Early Access"
    : candidate.narrativeHeavy ? "命中排除项：叙事主导"
      : candidate.publisherOccupied ? "成熟发行商占位，BD切入价值低"
        : releaseTooSoon ? "发售窗口过近，先不进推进池"
          : null;
  const className = dropReason ? "drop" : candidate.score >= 42 ? "push" : "watch";
  const bucket = className === "push" ? "推进池" : className === "drop" ? "淘汰池" : "观察池";
  const priority = className === "push" ? "P1" : className === "drop" ? "P3" : candidate.score >= 34 ? "P2" : "P3";
  const genre = candidate.genres.join(" / ") || null;
  const publisherStatus = candidate.publishers.length
    ? `${candidate.publishers.join(" / ")}；${candidate.publisherOccupied ? "成熟发行商可能已占位" : "未见成熟中国发行能力占位"}`
    : "未见明确成熟发行商占位";
  const priorityReason = className === "push"
    ? `${candidate.source} 信号 + ${candidate.strongGameplay ? "系统/互动玩法" : "视觉素材"}，窗口仍可前置触达`
    : className === "drop"
      ? dropReason
      : `${candidate.source} 有公开信号，但强数据、中国区窗口或发行结构仍需确认`;

  return {
    _class: className,
    id: `lead_steam_${candidate.appId}_${reportDate}`,
    project: candidate.title,
    steam_app_id: candidate.appId,
    team: candidate.developers[0] ?? null,
    team_size: null,
    country: candidate.country,
    region: candidate.region,
    city: candidate.city,
    region_priority: candidate.region === "中国" ? "国内优先" : candidate.highVisual ? "海外-高视觉" : candidate.hasPublicData ? "海外-强数据" : "其他",
    bucket,
    stage: className === "push" ? "active" : className === "drop" ? "rejected" : "watch",
    priority,
    priority_reason: priorityReason,
    rule_fit: buildRuleFit(candidate, dropReason),
    genre,
    gameplay: candidate.shortDescription || `${genre ?? "玩法"}，需要人工复核核心循环。`,
    progress: `Steam ${candidate.source}；发售窗口：${candidate.releaseDate}`,
    release_window: candidate.releaseDate,
    early_access: candidate.earlyAccess,
    narrative_heavy: candidate.narrativeHeavy,
    india_team: false,
    publisher_status: publisherStatus,
    publisher_name: candidate.publishers[0] ?? null,
    china_capability_occupied: candidate.publisherOccupied,
    traction_summary: `${candidate.source} 中出现；${candidate.highVisual ? "素材完整" : "素材待复核"}；${candidate.contactMethods.length ? "联系入口明确" : "联系入口不足"}。`,
    public_signals: `${candidate.source} / Steam App ${candidate.appId}`,
    contact: candidate.contactMethods.map((method) => `${method.type}: ${method.value}`).join("；"),
    contact_methods: candidate.contactMethods,
    links: [candidate.storeUrl, candidate.steamDbUrl, candidate.website].filter(Boolean),
    exposure_trail: `GitHub Actions online scan captured from ${candidate.source} on ${reportDate}.`,
    bilibili_fit: buildBilibiliFit(candidate),
    amplification: buildAmplification(candidate),
    risks: dropReason ?? "需要人工确认团队地区、中文计划、发行占位和商务合作意愿。",
    verdict: className === "push" ? "值得优先触达，确认中国区合作窗口" : className === "drop" ? `${dropReason}，暂不投入 BD 时间` : "方向可看，等待更强公开数据或 Demo 反馈",
    next_action: className === "drop" ? "归档原因，避免重复讨论" : "补团队真实地区、商务邮箱/Discord、中文计划和 Demo 数据",
    owner: null,
    due_date: null,
    first_seen: reportDate,
    notes: `${candidate.source}；score=${candidate.score}；${priorityReason}`
  };
}

function buildRuleFit(candidate, dropReason) {
  const parts = [];
  if (candidate.region === "中国") parts.push("国内项目优先");
  if (candidate.region !== "中国" && (candidate.highVisual || candidate.hasPublicData)) parts.push("海外保留条件成立");
  if (candidate.earlyAccess) parts.push("命中排除项：EA");
  if (candidate.narrativeHeavy) parts.push("命中排除项：叙事主导");
  if (candidate.publisherOccupied) parts.push("成熟发行商占位");
  if (dropReason) parts.push(dropReason);
  if (!parts.length) parts.push("符合基础筛选，待人工复核");
  return parts.join("；");
}

function buildBilibiliFit(candidate) {
  const categoryText = candidate.categories.join(" ");
  const genreText = candidate.genres.join(" ");
  if (/co-op|multiplayer/i.test(categoryText)) return "多人协作和队友互动适合直播切片、挑战局和 UP 主联动。";
  if (/strategy|simulation|management|automation|base building|city builder/i.test(genreText)) return "系统型玩法适合做教学、效率挑战、机制讲解和长线栏目。";
  if (/roguelike|deckbuilder|card game|tactical/i.test(genreText)) return "构筑、流派和局内选择适合被标题化、复盘化和挑战化。";
  if (candidate.highVisual) return "画面素材较完整，适合先做视觉向短内容和愿望单转化测试。";
  return "需要先看 Demo/实机素材，确认是否能被标题化和切片化。";
}

function buildAmplification(candidate) {
  const genreText = candidate.genres.join(" ");
  const categoryText = candidate.categories.join(" ");
  if (/roguelike|deckbuilder|card game|tactical/i.test(genreText)) return "可围绕构筑、流派、挑战路线做栏目化内容。";
  if (/simulation|management|automation|city builder/i.test(genreText)) return "可做新手指南、效率对比、失败案例和长期连载。";
  if (/co-op|multiplayer/i.test(categoryText)) return "可做多人首测、主播局和社交传播节点。";
  return "先用实机素材验证点击和完播，再决定是否推进商务触达。";
}

function buildDailyReport(pools, enrichedCount, rawCount) {
  return {
    report_date: reportDate,
    summary: `线上自动化生成：扫描候选 ${rawCount} 条、可解析游戏 ${enrichedCount} 条；新增推进池 ${pools.push.length} 条、观察池 ${pools.watch.length} 条、淘汰池 ${pools.drop.length} 条。`,
    insights: [
      "日报已切到 GitHub Actions 线上生成，不依赖本地电脑开机或 Codex 桌面任务。",
      "Steam 搜索页抓取失败时会自动退到 Steam 官方 featured categories，避免趋势和日报整天开天窗。",
      "推进池只代表值得优先触达的候选；真正进入深度推进仍需要你人工确认团队地区、窗口和发行占位。",
      "联系方式优先取 Steam support email、官网、官网邮件和社媒；没有明确入口时保留 Steam 社区作为兜底。"
    ],
    push_pool: pools.push,
    watch_pool: pools.watch,
    drop_pool: pools.drop
  };
}

function buildRadarReport(candidates, pools) {
  const topGenres = summarizeGenres(candidates);
  return {
    report_date: reportDate,
    summary: `今日行业雷达由线上自动化生成：Steam 可解析样本 ${candidates.length} 个，重点关注 ${topGenres.slice(0, 4).join("、") || "新品节窗口、系统型玩法和可传播素材"}。`,
    items: [
      radarItem("steam_next_fest_window", "行业新闻", "新品节前窗口仍是早期 sourcing 主入口", "新品节前的 Demo、Playtest 和愿望单预热更适合 BD 前置触达。", "高", "Steam", "https://store.steampowered.com/sale/nextfest", "用新品节窗口找还未被成熟发行能力锁死的项目。", "每天固定扫 Popular Upcoming、Demo、Playtest。"),
      radarItem("popular_upcoming_signal", "发行趋势", "Popular Upcoming 比热销榜更适合找前期项目", "热销榜更多是已经起量的项目，热门即将推出更容易暴露早期窗口。", "高", "Steam Store", "https://store.steampowered.com/search/?filter=popularcomingsoon", "把窗口足够早、非 EA、联系入口明确的项目进入观察。", "优先补 SteamDB、官网和联系入口。"),
      radarItem("steamdb_trending", "行业新闻", "SteamDB 可作为二次验证入口", "SteamDB 的趋势榜、App 更新时间和历史记录能帮助判断项目是否仍有增长。", "中", "SteamDB", "https://steamdb.info/charts/?sort=trending", "不要只靠 Steam 商店推荐位。", "对推进候选补 SteamDB 链接。"),
      radarItem("genre_density", "B站趋势", `今日 Steam 样本高频品类：${topGenres.slice(0, 4).join("、") || "待观察"}`, "高频品类代表供给密度，不代表每个都值得推进；要回到机制差异和 B站可解释性。", "中", "CRM Online Scan", "https://store.steampowered.com/", "同质化品类只保留有强视觉、强数据或强传播点的项目。", "用推荐理由解释清楚为什么值得你看。")
    ]
  };
}

function radarItem(id, category, title, summary, heat, source, link, relevance, suggestedAction) {
  return { id: `radar_${reportDate.replaceAll("-", "_")}_${id}`, category, title, summary, heat, source, link, relevance, suggested_action: suggestedAction, captured_at: capturedAt };
}

function buildSteamTrendReport(candidates, pools) {
  const topGenres = summarizeGenres(candidates);
  return {
    report_date: reportDate,
    summary: `今日 Steam 趋势：扫描到 ${candidates.length} 个可解析游戏。宏观看 ${topGenres.slice(0, 4).join("、") || "新品节窗口和热门即将推出"}，适合 CRM 的候选已进入日报池。`,
    market_insights: [
      steamInsight("next_fest_runway", "新品节前窗口继续升温", "Demo/Playtest 与 Popular Upcoming 是当前最适合前置 BD 的入口。", "高", "Steam Next Fest", "https://store.steampowered.com/sale/nextfest", "固定追踪新品节、Popular Upcoming 和 Demo 入口。"),
      steamInsight("macro_genres", `今日高频品类：${topGenres.slice(0, 4).join("、") || "待观察"}`, "高频品类只说明供给密度，需要结合愿望单、Demo、视频素材和发行占位判断。", "中", "CRM Online Scan", "https://store.steampowered.com/search/?filter=popularcomingsoon", "把有视觉/玩法传播点且窗口未被占位的项目进入观察。"),
      steamInsight("featured_fallback", "Steam featured categories 已作为兜底数据源", "当搜索结果接口返回空时，系统会用 Steam 官方 featured categories 保证趋势页和日报不断档。", "中", "Steam API", "https://store.steampowered.com/api/featuredcategories", "把 featured 数据当大盘补充，不直接等同于推进理由。")
    ],
    genre_signals: buildGenreSignals(topGenres),
    items: candidates.slice(0, 12).map((candidate) => ({
      id: `steam_trend_${reportDate.replaceAll("-", "_")}_${candidate.appId}`,
      title: candidate.title,
      steam_app_id: candidate.appId,
      rank_bucket: candidate.source,
      signal: `${candidate.source}；${candidate.releaseDate}；score=${candidate.score}`,
      source: "Steam Store / AppDetails",
      links: [candidate.storeUrl, candidate.steamDbUrl],
      bilibili_fit: buildBilibiliFit(candidate),
      reason: candidate.score >= 42 ? "可进入 CRM 推进/观察候选" : "作为大盘趋势观察，不直接推进",
      auto_import: candidate.score >= 34 && !candidate.earlyAccess && !candidate.publisherOccupied,
      captured_at: capturedAt
    })),
    crm_candidates: [...pools.push, ...pools.watch.slice(0, 5)]
  };
}

function steamInsight(id, title, summary, signalLevel, source, link, suggestedAction) {
  return { id: `steam_macro_${reportDate.replaceAll("-", "_")}_${id}`, title, summary, signal_level: signalLevel, source, link, suggested_action: suggestedAction, captured_at: capturedAt };
}

function buildGenreSignals(genres) {
  return genres.slice(0, 5).map((genre) => ({
    id: `steam_genre_${reportDate.replaceAll("-", "_")}_${normalizeText(genre).replace(/[^a-z0-9]+/g, "_").slice(0, 32)}`,
    genre,
    signal: `${genre} 在今日抓取样本中出现较多，需要区分机制差异和普通跟风供给。`,
    why_it_matters: "B站内容需要能被讲清楚、剪出来、做挑战；只有标签相似不够。",
    bd_action: "保留 Steam 页面完整、Demo/素材可验证、联系入口明确且未被成熟中国发行能力占位的项目。",
    links: ["https://store.steampowered.com/search/?filter=popularcomingsoon", "https://steamdb.info/charts/?sort=trending"]
  }));
}

function summarizeGenres(candidates) {
  const counts = new Map();
  for (const candidate of candidates) {
    for (const genre of candidate.genres.slice(0, 4)) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([genre]) => genre);
}

function stripPrivateFields(lead) {
  const { _class, ...publicLead } = lead;
  return publicLead;
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
  return {
    "User-Agent": "Mozilla/5.0 SourcingCRM/1.0 (+https://github.com/Neo0109/CRM)",
    Accept: accept ?? "*/*"
  };
}

async function writeJson(relativePath, payload) {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function dedupeByAppId(items) {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    if (!item?.appId || seen.has(String(item.appId))) continue;
    seen.add(String(item.appId));
    deduped.push({ ...item, appId: String(item.appId) });
  }
  return deduped;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function hasMaturePublisher(publishers) {
  const text = publishers.join(" ").toLowerCase();
  return ["devolver", "raw fury", "annapurna", "team17", "hooded horse", "tinybuild", "kasedo", "kepler", "11 bit", "chucklefish", "humble", "paradox", "focus", "playstack", "fireshine", "nacon", "secret mode", "thunderful"].some((name) => text.includes(name));
}

function looksDomestic(text) {
  return /[\u4e00-\u9fff]/.test(text) || /china|beijing|shanghai|shenzhen|guangzhou|chengdu|hangzhou|wuhan|xiamen/i.test(text);
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
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ");
}

function normalizeText(value) {
  return String(value ?? "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
