// Online generator for GitHub Actions. Keep this dependency-free so it can run on hosted runners.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const args = parseArgs(process.argv.slice(2));
const reportDate = args.date ?? todayInShanghai();
const capturedAt = `${reportDate}T09:30:00+08:00`;
const maxDetails = Number(args.maxDetails ?? 36);
const existingProjects = await readExistingProjectNames(reportDate);

const searchGroups = await Promise.all([
  fetchSteamSearch("popularcomingsoon", "Popular Upcoming"),
  fetchSteamSearch("popularnew", "Popular New"),
  fetchSteamSearch("topsellers", "Top Sellers Context"),
  fetchSteamSearch("popularcomingsoon", "Co-op Upcoming", [1685]),
  fetchSteamSearch("popularcomingsoon", "Strategy Upcoming", [9]),
  fetchSteamSearch("popularcomingsoon", "Simulation Upcoming", [599]),
  fetchSteamSearch("popularcomingsoon", "Roguelike Upcoming", [1716])
]);

const rawCandidates = dedupeByAppId(searchGroups.flat()).filter((candidate) => !existingProjects.has(normalizeText(candidate.title)));
const enrichedCandidates = (await mapLimit(rawCandidates.slice(0, maxDetails), 6, enrichSteamCandidate))
  .filter(Boolean)
  .sort((a, b) => b.score - a.score);

const pools = buildLeadPools(enrichedCandidates);
const dailyReport = buildDailyReport(pools);
const radarReport = buildRadarReport(enrichedCandidates, pools);
const steamTrendReport = buildSteamTrendReport(enrichedCandidates, pools);

await writeJson(`data/reports/${reportDate}.json`, dailyReport);
await writeJson(`data/radar/${reportDate}.json`, radarReport);
await writeJson(`data/steam_trends/${reportDate}.json`, steamTrendReport);

console.log(JSON.stringify({
  ok: true,
  report_date: reportDate,
  candidates_seen: rawCandidates.length,
  candidates_enriched: enrichedCandidates.length,
  push_pool: dailyReport.push_pool.length,
  watch_pool: dailyReport.watch_pool.length,
  drop_pool: dailyReport.drop_pool.length,
  files: [
    `data/reports/${reportDate}.json`,
    `data/radar/${reportDate}.json`,
    `data/steam_trends/${reportDate}.json`
  ]
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
  const reportPaths = [
    `data/reports/${date}.json`,
    previousDatePath(date)
  ].filter(Boolean);

  for (const reportPath of reportPaths) {
    try {
      const report = JSON.parse(await readFile(path.join(rootDir, reportPath), "utf8"));
      for (const bucket of ["push_pool", "watch_pool", "drop_pool"]) {
        for (const lead of report[bucket] ?? []) {
          if (lead.project) names.add(normalizeText(lead.project));
        }
      }
    } catch {
      // Missing history is expected on first run.
    }
  }
  return names;
}

function previousDatePath(date) {
  const current = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(current.getTime())) return null;
  current.setUTCDate(current.getUTCDate() - 1);
  const previous = current.toISOString().slice(0, 10);
  return `data/reports/${previous}.json`;
}

async function fetchSteamSearch(filter, source, tags = []) {
  const url = new URL("https://store.steampowered.com/search/results/");
  url.searchParams.set("query", "");
  url.searchParams.set("start", "0");
  url.searchParams.set("count", "50");
  url.searchParams.set("dynamic_data", "");
  url.searchParams.set("force_infinite", "1");
  url.searchParams.set("filter", filter);
  url.searchParams.set("category1", "998");
  url.searchParams.set("os", "win");
  if (tags.length) url.searchParams.set("tags", tags.join(","));

  try {
    const payload = await fetchJson(url.toString());
    return parseSteamSearchHtml(payload.results_html ?? "", source);
  } catch (error) {
    console.warn(`Steam search failed for ${source}: ${error.message}`);
    return [];
  }
}

function parseSteamSearchHtml(html, source) {
  return html.split(/<a\s+/i).slice(1).map((chunk) => `<a ${chunk}`).map((chunk, index) => {
    const appId = chunk.match(/data-ds-appid="(\d+)"/)?.[1] ?? chunk.match(/\/app\/(\d+)\//)?.[1] ?? null;
    const title = decodeHtml(stripTags(chunk.match(/<span class="title">([\s\S]*?)<\/span>/i)?.[1] ?? "")).trim();
    const href = decodeHtml(chunk.match(/href="([^"]+)"/)?.[1] ?? "").split("?")[0];
    const release = decodeHtml(stripTags(chunk.match(/search_released[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "")).trim();
    const reviewText = decodeHtml(stripTags(chunk.match(/search_reviewscore[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "")).trim();
    const tags = [...chunk.matchAll(/<span class="top_tag">([\s\S]*?)<\/span>/gi)].map((match) => decodeHtml(stripTags(match[1])).trim()).filter(Boolean);
    if (!appId || !title || !href.includes("/app/")) return null;
    return { appId, title, href, release, reviewText, tags, source, sourceIndex: index };
  }).filter(Boolean);
}

async function enrichSteamCandidate(candidate) {
  const details = await fetchSteamAppDetails(candidate.appId);
  if (!details || details.type !== "game") return null;

  const text = [candidate.title, details.name, details.short_description, ...(details.genres ?? []).map((genre) => genre.description), ...(details.categories ?? []).map((category) => category.description), ...(candidate.tags ?? [])].join(" ");
  const lower = text.toLowerCase();
  const developers = Array.isArray(details.developers) ? details.developers : [];
  const publishers = Array.isArray(details.publishers) ? details.publishers : [];
  const releaseDate = normalizeReleaseDate(details.release_date?.date ?? candidate.release);
  const daysToRelease = daysUntil(releaseDate);
  const comingSoon = Boolean(details.release_date?.coming_soon) || /coming soon|to be announced|tba|即将推出/i.test(candidate.release);
  const earlyAccess = /early access|抢先体验/i.test(text);
  const narrativeHeavy = /visual novel|story rich|interactive fiction|narrative|walking simulator/i.test(lower) && !/strategy|simulation|management|roguelike|deckbuilder|co-op|multiplayer/i.test(lower);
  const strongGameplay = /co-op|multiplayer|strategy|simulation|management|automation|base building|colony|roguelike|deckbuilder|tactical|sandbox|survival|crafting/i.test(lower);
  const highVisual = (details.screenshots?.length ?? 0) >= 5 || (details.movies?.length ?? 0) > 0;
  const publisherOccupied = hasMaturePublisher(publishers);
  const contactMethods = await collectContactMethods(details, candidate.appId);
  const domestic = looksDomestic([details.name, ...developers, ...publishers, details.website].join(" "));
  const releaseTooSoon = typeof daysToRelease === "number" && daysToRelease >= 0 && daysToRelease < 60;
  const hasPublicData = /popular|top sellers|review|demo|playtest/i.test([candidate.source, candidate.reviewText, lower].join(" "));
  const score = scoreCandidate({ candidate, strongGameplay, highVisual, hasPublicData, releaseTooSoon, earlyAccess, narrativeHeavy, publisherOccupied, comingSoon, contactMethods });

  return {
    appId: candidate.appId,
    title: details.name ?? candidate.title,
    candidateTitle: candidate.title,
    source: candidate.source,
    sourceIndex: candidate.sourceIndex,
    storeUrl: `https://store.steampowered.com/app/${candidate.appId}/`,
    steamDbUrl: `https://steamdb.info/app/${candidate.appId}/`,
    developers,
    publishers,
    country: domestic ? "中国（待确认）" : "海外",
    region: domestic ? "中国" : "海外",
    city: null,
    genres: [...new Set([...(details.genres ?? []).map((genre) => genre.description), ...(candidate.tags ?? [])])].slice(0, 5),
    categories: (details.categories ?? []).map((category) => category.description).slice(0, 8),
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

async function fetchSteamAppDetails(appId) {
  try {
    const payload = await fetchJson(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=english`);
    const entry = payload[String(appId)];
    if (!entry?.success) return null;
    return entry.data;
  } catch (error) {
    console.warn(`App details failed for ${appId}: ${error.message}`);
    return null;
  }
}

async function collectContactMethods(details, appId) {
  const methods = [];
  const support = details.support_info ?? {};
  if (support.email) methods.push({ type: "Email", value: support.email, note: "Steam support email" });
  if (support.url) methods.push({ type: "官网", value: support.url, note: "Steam support URL" });
  if (details.website) methods.push({ type: "官网", value: details.website, note: "Official website from Steam" });

  const website = details.website || support.url;
  if (website && /^https?:\/\//i.test(website)) {
    try {
      const html = await fetchText(website, 8000);
      const mail = decodeHtml(html.match(/mailto:([^"'?#>\s]+)/i)?.[1] ?? "");
      if (mail && !methods.some((method) => method.value === mail)) methods.unshift({ type: "Email", value: mail, note: "Found on official site" });
      const socialPatterns = [
        ["Discord", /https?:\/\/(?:www\.)?(?:discord\.gg|discord\.com\/invite)\/[^"'<>\s]+/i],
        ["X/Twitter", /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^"'<>\s]+/i],
        ["B站", /https?:\/\/(?:space\.)?bilibili\.com\/[^"'<>\s]+/i]
      ];
      for (const [type, pattern] of socialPatterns) {
        const value = html.match(pattern)?.[0];
        if (value && !methods.some((method) => method.value === value)) methods.push({ type, value, note: "Found on official site" });
      }
    } catch {
      // Many game sites block crawlers; keep Steam-provided contacts.
    }
  }

  if (!methods.length) {
    methods.push({ type: "Steam", value: `https://steamcommunity.com/app/${appId}/discussions/`, note: "Official Steam community" });
  }

  return methods.slice(0, 4);
}

function scoreCandidate(input) {
  let score = 0;
  if (input.candidate.source.includes("Upcoming")) score += 20;
  if (input.strongGameplay) score += 18;
  if (input.highVisual) score += 12;
  if (input.hasPublicData) score += 8;
  if (input.comingSoon) score += 6;
  if (input.contactMethods.length) score += 4;
  if (input.releaseTooSoon) score -= 18;
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
  const dropPool = leads.filter((lead) => lead._class === "drop" && !used.has(lead.steam_app_id)).slice(0, 8);
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
    ? `${candidate.source} 信号 + ${candidate.strongGameplay ? "系统/互动玩法" : "视觉信号"}，窗口仍可前置触达`
    : className === "drop"
      ? dropReason
      : `${candidate.source} 有公开信号，但${releaseTooSoon ? "窗口偏近" : "强数据/中国区切入点仍需确认"}`;

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
    gameplay: candidate.shortDescription || `${genre ?? "玩法"}，需人工复核核心循环。`,
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
    risks: dropReason ?? (releaseTooSoon ? "窗口偏近，需要确认是否仍有中国区切入价值。" : "需要人工确认团队地区、中文计划和商务合作意愿。"),
    verdict: className === "push" ? "值得优先触达，确认中国区合作窗口" : className === "drop" ? `${dropReason}，暂不投入 BD 时间` : "方向可看，等待更强公开数据或 Demo 反馈",
    next_action: className === "drop" ? "归档原因，避免重复讨论" : "补团队真实地区、商务邮箱/Discord、中文计划和 Demo 数据",
    owner: null,
    due_date: null,
    first_seen: reportDate,
    notes: `线上自动化生成：${candidate.source}，score=${candidate.score}`
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
  if (/co-op|multiplayer/i.test(candidate.categories.join(" "))) return "多人协作和队友互动适合直播切片、挑战局和 UP 主联动。";
  if (/strategy|simulation|management|automation|base building/i.test(candidate.genres.join(" "))) return "系统型玩法适合做教学、效率挑战、机制讲解和长线栏目。";
  if (candidate.highVisual) return "画面素材较完整，适合先做视觉向短内容和愿望单转化测试。";
  return "需要先看 Demo/实机素材，确认是否能被标题化和切片化。";
}

function buildAmplification(candidate) {
  if (/roguelike|deckbuilder|tactical/i.test(candidate.genres.join(" "))) return "可围绕构筑、流派、挑战路线做栏目化内容。";
  if (/simulation|management|automation/i.test(candidate.genres.join(" "))) return "可做新手指南、效率对比、失败案例和长期连载。";
  if (/co-op|multiplayer/i.test(candidate.categories.join(" "))) return "可做多人首测、主播局和社交传播节点。";
  return "先用实机素材验证点击和完播，再决定是否推进商务触达。";
}

function stripPrivateFields(lead) {
  const { _class, ...publicLead } = lead;
  return publicLead;
}

function buildDailyReport(pools) {
  return {
    report_date: reportDate,
    summary: `线上自动化生成：新增推进池 ${pools.push.length} 条、观察池 ${pools.watch.length} 条、淘汰池 ${pools.drop.length} 条。数据来自 Steam Popular Upcoming/New、标签页和 AppDetails，并已同步生成行业雷达与 Steam 趋势。`,
    insights: [
      "线上生成已迁移到 GitHub Actions，不再依赖本地电脑或 Codex 桌面定时进程。",
      "Steam Popular Upcoming 和标签页更适合发现早期窗口；Top Sellers 只作为大盘风向参考。",
      "海外项目必须同时看画面/玩法信号、联系入口和发行占位，不能只因上新就进入推进。",
      "自动化只做第一轮结构化，推进前仍需人工确认团队地区、中文计划、商务窗口和 Demo 数据。"
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
    summary: `今日行业雷达由线上自动化生成：重点关注 Steam 新品节前窗口、Popular Upcoming 早期信号、系统型玩法供给、AI/工具化对小团队产能的影响，以及 B站内容可放大的题材。`,
    items: [
      radarItem("steam_next_fest_window", "行业新闻", "Steam 新品节前窗口是早期 sourcing 的主入口", "新品节前 2-3 周的 Demo、Playtest 和愿望单预热最适合 BD 前置触达，比正式发售后追热点更早。", "高", "Steam", "https://store.steampowered.com/sale/nextfest", "把 Popular Upcoming、Demo、Playtest 作为每日固定入口。", "每天保留可验证 Steam/SteamDB 链接的候选。"),
      radarItem("steam_popular_upcoming", "发行八卦", "Popular Upcoming 比 Top Sellers 更适合找未占位项目", "Top Sellers 多是既有头部产品；Popular Upcoming 更容易出现尚未被成熟发行商完全锁定的项目。", "高", "Steam Store", "https://store.steampowered.com/search/?filter=popularcomingsoon", "避免只看大榜，优先扫临近 Demo/新品节窗口。", "把无成熟中国发行占位的项目放入观察池。"),
      radarItem("steamdb_trending", "行业新闻", "SteamDB 趋势可辅助判断关注增速", "SteamDB 的趋势榜和 app 更新时间能补充 Steam 商店页信号，适合识别还没正式爆发的早期项目。", "中", "SteamDB", "https://steamdb.info/charts/?sort=trending", "用 SteamDB 做二次验证，不把它当唯一来源。", "关注 AppID、更新时间、社区和愿望单信号。"),
      radarItem("ai_small_team_output", "AI 游戏", "AI/工具链会继续放大小团队供给密度", "生成式工具和自动化流程会让 Steam 早期供给更密，BD 需要扩大样本池，同时收紧筛选规则。", "中", "GameDeveloper", "https://www.gamedeveloper.com/", "不要把 AI 标签当推荐理由，仍回到玩法和数据。", "观察小团队是否有更快素材迭代和 Demo 节奏。"),
      radarItem("bilibili_content_fit", "B站趋势", `B站更适合放大 ${topGenres.slice(0, 3).join("、") || "系统型/互动型"} 内容`, "今日 Steam 候选显示，能被标题化、挑战化、切片化的玩法，比纯叙事或低视觉项目更适合 B站发行前置。", "中", "CRM Online Scan", "https://www.bilibili.com/v/game/", "每条 lead 的推荐理由必须是一句能解释传播点的话。", "优先验证 UP 主是否能讲清玩法差异。")
    ]
  };
}

function radarItem(id, category, title, summary, heat, source, link, relevance, suggestedAction) {
  return { id: `radar_${reportDate.replaceAll("-", "_")}_${id}`, category, title, summary, heat, source, link, relevance, suggested_action: suggestedAction, captured_at: capturedAt };
}

function buildSteamTrendReport(candidates, pools) {
  const topGenres = summarizeGenres(candidates);
  const items = candidates.slice(0, 10).map((candidate, index) => ({
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
  }));

  return {
    report_date: reportDate,
    summary: `今日 Steam 趋势由线上自动化生成：共抓取 ${candidates.length} 个可解析 App。重点看 Popular Upcoming、标签页和 SteamDB 二次验证；适合 CRM 的项目已同时写入日报候选。`,
    market_insights: [
      steamInsight("next_fest_runway", "新品节前窗口继续升温", "Demo/Playtest 和 Popular Upcoming 是当日最重要的大盘入口，适合提前发现仍有 BD 窗口的项目。", "高", "Steam Next Fest", "https://store.steampowered.com/sale/nextfest", "每天固定扫新品节、Popular Upcoming 和 Demo 入口。"),
      steamInsight("popular_upcoming_signal", "热门即将推出比热销榜更适合前置 BD", "热销榜更多是已成熟项目；热门即将推出能更早暴露愿望单和页面完善度。", "高", "Steam Store", "https://store.steampowered.com/search/?filter=popularcomingsoon", "把窗口足够早、非 EA、联系方式明确的项目进入观察/推进。"),
      steamInsight("genre_density", `今日高频品类：${topGenres.slice(0, 4).join("、") || "待观察"}`, "高频品类说明供给密度，但不代表每个项目都值得推进；需要看机制差异和 B站内容可解释性。", "中", "CRM Online Scan", "https://store.steampowered.com/", "同质化品类只保留有强视觉、强数据或强传播点的项目。")
    ],
    genre_signals: buildGenreSignals(topGenres),
    items,
    crm_candidates: [...pools.push, ...pools.watch.slice(0, 5)]
  };
}

function steamInsight(id, title, summary, signalLevel, source, link, suggestedAction) {
  return { id: `steam_macro_${reportDate.replaceAll("-", "_")}_${id}`, title, summary, signal_level: signalLevel, source, link, suggested_action: suggestedAction, captured_at: capturedAt };
}

function buildGenreSignals(genres) {
  return genres.slice(0, 4).map((genre) => ({
    id: `steam_genre_${reportDate.replaceAll("-", "_")}_${normalizeText(genre).replace(/[^a-z0-9]+/g, "_").slice(0, 32)}`,
    genre,
    signal: `${genre} 在今日抓取样本中出现较多，需要区分真正机制差异和普通跟风供给。`,
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

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "SourcingCRM/1.0 (+https://github.com/Neo0109/CRM)", Accept: "application/json,text/html;q=0.9,*/*;q=0.8" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "SourcingCRM/1.0 (+https://github.com/Neo0109/CRM)", Accept: "text/html,*/*;q=0.8" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function writeJson(relativePath, payload) {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function mapLimit(items, limit, mapper) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function dedupeByAppId(items) {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    if (seen.has(item.appId)) continue;
    seen.add(item.appId);
    deduped.push(item);
  }
  return deduped;
}

function hasMaturePublisher(publishers) {
  const text = publishers.join(" ").toLowerCase();
  return ["devolver", "raw fury", "annapurna", "team17", "hooded horse", "tinybuild", "kasedo", "kepler", "11 bit", "chucklefish", "humble", "paradox", "focus", "playstack", "fireshine", "nacon", "tinybuild"].some((name) => text.includes(name));
}

function looksDomestic(text) {
  return /[\u4e00-\u9fff]/.test(text) || /china|beijing|shanghai|shenzhen|guangzhou|chengdu|hangzhou/i.test(text);
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
    .replaceAll("&gt;", ">");
}

function normalizeText(value) {
  return String(value ?? "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
