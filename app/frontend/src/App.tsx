import { AlertTriangle, ArrowDownToLine, Bot, CalendarCheck, CheckCircle2, ExternalLink, FileJson, FileSpreadsheet, ListChecks, LogOut, Newspaper, Plus, RefreshCw, Save, Search, Settings as SettingsIcon, Trash2, TrendingUp, XCircle } from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { clearAccessToken, excelExportUrl, fetchLeads, fetchRadar, fetchSteamTrends, getAccessToken, saveAccessToken, syncLatestReport, updateLead } from "./api";
import { AssistantPage } from "./AssistantPage";
import { ReportHistoryControls } from "./ReportHistoryControls";
import { SettingsPage } from "./SettingsPage";
import { SteamTrendsPage } from "./SteamTrendsPage";
import type { Bucket, ContactMethod, ContactType, EvaluationGrade, Lead, Priority, RadarCategory, RadarReport, Region, RegionPriority, ReviewStatus, Stage, SteamTrendReport } from "./types";

type View = "leads" | "assistant" | "radar" | "steam" | "settings";
type Filters = {
  query: string;
  bucket: "全部" | Bucket;
  region: "全部" | Region;
  stage: "全部" | Stage;
  owner: string;
  city: string;
  releaseWindow: string;
  reviewStatus: "全部" | ReviewStatus;
  missingLinks: boolean;
};

type NormalizedSteamLink = {
  appId: string;
  storeUrl: string;
  steamDbUrl: string;
};

type DashboardStats = {
  total: number;
  unread: number;
  evaluation: number;
  testing: number;
  push: number;
  follow: number;
  watch: number;
  drop: number;
  missingLinks: number;
};

type SourcingInsights = {
  weekLabel: string;
  weekSourced: number;
  enteredFollowThisWeek: number;
  pipelineCount: number;
  highPriorityPipeline: number;
  dueSoon: number;
  decisionLanes: DecisionLane[];
  dropReasons: { label: string; count: number }[];
  focusLeads: Lead[];
  actions: string[];
};

type DecisionLane = {
  key: string;
  kicker: string;
  title: string;
  description: string;
  count: number;
  filter: Partial<Filters>;
  leads: Lead[];
  empty: string;
};

const version = "v2.0";
const emptyFilters: Filters = { query: "", bucket: "全部", region: "全部", stage: "全部", owner: "", city: "", releaseWindow: "", reviewStatus: "全部", missingLinks: false };
const bucketOptions: ("全部" | Bucket)[] = ["全部", "未处理", "待评测", "测试中", "跟进中", "观察池", "推进池", "淘汰池"];
const bucketValues: Bucket[] = ["未处理", "待评测", "测试中", "跟进中", "观察池", "推进池", "淘汰池"];
const stageOptions: ("全部" | Stage)[] = ["全部", "new", "watch", "active", "negotiating", "won", "rejected"];
const stageValues: Stage[] = ["new", "watch", "active", "negotiating", "won", "rejected"];
const priorityValues: Priority[] = ["P0", "P1", "P2", "P3"];
const evaluationGradeOptions: ("未评级" | EvaluationGrade)[] = ["未评级", "S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"];
const regionValues: Region[] = ["中国", "海外"];
const regionOptions: ("全部" | Region)[] = ["全部", ...regionValues];
const regionPriorityValues: RegionPriority[] = ["国内优先", "海外-高视觉", "海外-强数据", "其他"];
const contactTypes: ContactType[] = ["微信/QQ", "Email", "电话", "官网", "Steam", "Discord", "B站", "X/Twitter", "其他"];
const radarCategories: RadarCategory[] = ["行业新闻", "发行八卦", "AI 游戏", "新梗热点", "B站趋势"];

export default function App() {
  const [view, setView] = useState<View>("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenDraft, setTokenDraft] = useState(getAccessToken());
  const [radar, setRadar] = useState<RadarReport | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);
  const [steamTrends, setSteamTrends] = useState<SteamTrendReport | null>(null);
  const [steamLoading, setSteamLoading] = useState(false);

  useEffect(() => {
    void reload(true);
    void loadRadar();
    void loadSteamTrends();
  }, []);

  const stats = useMemo(() => ({
    total: leads.length,
    unread: leads.filter((lead) => lead.bucket === "未处理" || lead.review_status === "未处理").length,
    evaluation: leads.filter((lead) => lead.bucket === "待评测").length,
    testing: leads.filter((lead) => lead.bucket === "测试中").length,
    push: leads.filter((lead) => lead.bucket === "推进池").length,
    follow: leads.filter((lead) => lead.bucket === "跟进中").length,
    watch: leads.filter((lead) => lead.bucket === "观察池").length,
    drop: leads.filter((lead) => lead.bucket === "淘汰池").length,
    missingLinks: leads.filter(needsSteamLinkTriage).length
  }), [leads]);

  const filteredLeads = useMemo(() => leads.filter((lead) => {
    const contacts = visibleContacts(lead.contact_methods).map((method) => `${method.type} ${method.value} ${method.note ?? ""}`).join(" ");
    const haystack = [lead.project, lead.team, lead.genre, lead.gameplay, lead.progress, lead.publisher_status, lead.priority_reason, lead.rule_fit, lead.evaluation_grade, lead.evaluation_result, lead.next_action, lead.notes, lead.country, lead.city, contacts]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const queryMatch = !filters.query || haystack.includes(filters.query.toLowerCase());
    const bucketMatch = filters.bucket === "全部" || lead.bucket === filters.bucket;
    const regionMatch = filters.region === "全部" || lead.region === filters.region;
    const stageMatch = filters.stage === "全部" || lead.stage === filters.stage;
    const ownerMatch = !filters.owner || (lead.owner ?? "").toLowerCase().includes(filters.owner.toLowerCase());
    const cityMatch = !filters.city || [lead.city, lead.country].filter(Boolean).join(" ").toLowerCase().includes(filters.city.toLowerCase());
    const releaseMatch = !filters.releaseWindow || (lead.release_window ?? "").toLowerCase().includes(filters.releaseWindow.toLowerCase());
    const reviewMatch = filters.reviewStatus === "全部" || lead.review_status === filters.reviewStatus;
    const missingLinkMatch = !filters.missingLinks || needsSteamLinkTriage(lead);
    return queryMatch && bucketMatch && regionMatch && stageMatch && ownerMatch && cityMatch && releaseMatch && reviewMatch && missingLinkMatch;
  }), [filters, leads]);

  const selectedLead = useMemo(() => filteredLeads.find((lead) => lead.id === selectedId) ?? filteredLeads[0] ?? null, [filteredLeads, selectedId]);

  async function reload(syncDailyReport = false) {
    try {
      setLoading(true);
      if (syncDailyReport) {
        const syncResult = await syncLatestReport();
        if (syncResult.synced && (syncResult.created > 0 || syncResult.updated > 0 || syncResult.dropped > 0)) {
          setStatus(`已自动同步 ${syncResult.report_date} 日报：新增 ${syncResult.created}，更新 ${syncResult.updated}，淘汰 ${syncResult.dropped}`);
        }
      }
      const nextLeads = await fetchLeads();
      setLeads(nextLeads);
      setSelectedId((current) => current ?? nextLeads[0]?.id ?? null);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadRadar(date?: string) {
    try {
      setRadarLoading(true);
      setRadar(await fetchRadar(date));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "行业雷达加载失败");
    } finally {
      setRadarLoading(false);
    }
  }

  async function loadSteamTrends(date?: string) {
    try {
      setSteamLoading(true);
      const report = await fetchSteamTrends(date);
      setSteamTrends(report);
      if (report.sync_result && (report.sync_result.created > 0 || report.sync_result.updated > 0)) {
        setStatus(`Steam 趋势已同步：新增 ${report.sync_result.created}，更新 ${report.sync_result.updated}`);
        void reload(false);
      }
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Steam 趋势加载失败");
    } finally {
      setSteamLoading(false);
    }
  }

  async function handleLeadPatch(id: string, patch: Partial<Lead>) {
    const updated = await updateLead(id, patch);
    setLeads((current) => current.map((lead) => (lead.id === id ? updated : lead)));
    setStatus(`${updated.project} 已保存`);
  }

  async function moveBucket(lead: Lead, bucket: Bucket) {
    await handleLeadPatch(lead.id, { bucket, stage: stageFromBucket(bucket), ...reviewPatchForBucket(bucket) });
  }

  function refreshCurrentView() {
    if (view === "leads") void reload(true);
    if (view === "assistant") void reload(false);
    if (view === "radar") void loadRadar();
    if (view === "steam") void loadSteamTrends();
  }

  function downloadExcel() {
    const password = window.prompt("请输入 Excel 导出密码");
    if (!password?.trim()) return;
    window.location.assign(excelExportUrl(password.trim()));
  }

  function logout() {
    clearAccessToken();
    setTokenDraft("");
    setLeads([]);
    setSelectedId(null);
    setRadar(null);
    setSteamTrends(null);
    setStatus(null);
    setLoading(false);
    setRadarLoading(false);
    setSteamLoading(false);
    setView("leads");
    setError("CRM access token required");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="hero-copy">
          <span className="brand-mark">B</span>
          <p className="eyebrow">Neo's BD Matrix · {version}</p>
          <h1>BD 决策工作台</h1>
          <p className="hero-subtitle">集中处理每日 sourcing 线索、游戏评测、跟进动作和发行判断，帮助快速决定提测、推进或淘汰。</p>
        </div>
        <div className="actions">
          <div className="nav-group">
            <button className={`tab-button ${view === "leads" ? "active" : ""}`} onClick={() => setView("leads")}><ListChecks size={16} />Leads Review</button>
            <button className={`tab-button ${view === "assistant" ? "active" : ""}`} onClick={() => setView("assistant")}><Bot size={16} />线索助手</button>
            <button className={`tab-button ${view === "radar" ? "active" : ""}`} onClick={() => setView("radar")}><Newspaper size={16} />行业雷达</button>
            <button className={`tab-button ${view === "steam" ? "active" : ""}`} onClick={() => setView("steam")}><TrendingUp size={16} />Steam 趋势</button>
            <button className={`tab-button ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}><SettingsIcon size={16} />设置</button>
          </div>
          <div className="nav-section-label">数据操作</div>
          <div className="nav-group nav-tools">
            <button className="ghost-button" onClick={refreshCurrentView}><RefreshCw size={16} />刷新</button>
            <button className="ghost-button" onClick={downloadExcel}><FileSpreadsheet size={16} />Excel</button>
            <a className="ghost-button" href="/api/export/json"><FileJson size={16} />JSON</a>
            <a className="ghost-button" href="/api/export/csv"><ArrowDownToLine size={16} />CSV</a>
          </div>
          <div className="nav-group nav-extension-host" />
          <div className="nav-spacer" aria-hidden="true" />
          <button className="ghost-button logout-button" type="button" onClick={logout}><LogOut size={16} />退出登录</button>
        </div>
      </header>

      {status && <div className="notice">{status}</div>}
      {error && <div className="notice error">{error}</div>}
      {error?.includes("CRM access token") && <section className="token-panel">
        <strong>输入 CRM 访问口令</strong>
        <input type="password" value={tokenDraft} onChange={(event) => setTokenDraft(event.target.value)} placeholder="CRM_ACCESS_TOKEN" />
        <button className="primary-button" onClick={() => { saveAccessToken(tokenDraft); void reload(true); void loadRadar(); void loadSteamTrends(); }}>进入</button>
      </section>}

      {view === "leads" ? <LeadsView
        leads={leads}
        filters={filters}
        setFilters={setFilters}
        stats={stats}
        loading={loading}
        filteredLeads={filteredLeads}
        selectedLead={selectedLead}
        setSelectedId={setSelectedId}
        handleLeadPatch={handleLeadPatch}
        moveBucket={moveBucket}
      /> : view === "assistant" ? <AssistantPage onImported={() => reload(false)} onStatus={setStatus} /> : view === "radar" ? <RadarPage radar={radar} loading={radarLoading} onDateChange={(date) => void loadRadar(date)} /> : view === "steam" ? <SteamTrendsPage report={steamTrends} loading={steamLoading} onDateChange={(date) => void loadSteamTrends(date)} /> : <SettingsPage onStatus={setStatus} onTokenChanged={setTokenDraft} />}
    </main>
  );
}

function LeadsView({ leads, filters, setFilters, stats, loading, filteredLeads, selectedLead, setSelectedId, handleLeadPatch, moveBucket }: {
  leads: Lead[];
  filters: Filters;
  setFilters: (filters: Filters) => void;
  stats: DashboardStats;
  loading: boolean;
  filteredLeads: Lead[];
  selectedLead: Lead | null;
  setSelectedId: (id: string | null) => void;
  handleLeadPatch: (id: string, patch: Partial<Lead>) => Promise<void>;
  moveBucket: (lead: Lead, bucket: Bucket) => Promise<void>;
}) {
  const insights = useMemo(() => buildSourcingInsights(leads, stats), [leads, stats]);

  function applyMetricFilter(patch: Partial<Filters>) {
    setFilters({ ...emptyFilters, ...patch });
    setSelectedId(null);
  }

  return <>
    <section className="dashboard-head">
      <div>
        <p className="eyebrow">工作台</p>
        <h2>早上好，Neo0109</h2>
        <p>今天是 {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}。当前聚焦：{activeFilterLabel(filters)}。</p>
      </div>
      <div className="dashboard-head-meta">
        <span>{filteredLeads.length} / {stats.total} 条记录</span>
        <span>{stats.follow + stats.push} 个重点推进</span>
      </div>
    </section>

    <section className="metric-strip">
      <Metric label="未处理" value={stats.unread} tone="purple" active={filters.reviewStatus === "未处理"} onClick={() => applyMetricFilter({ reviewStatus: "未处理" })} />
      <Metric label="待评测" value={stats.evaluation} tone="amber" active={filters.bucket === "待评测"} onClick={() => applyMetricFilter({ bucket: "待评测" })} />
      <Metric label="测试中" value={stats.testing} tone="cyan" active={filters.bucket === "测试中"} onClick={() => applyMetricFilter({ bucket: "测试中" })} />
      <Metric label="跟进中" value={stats.follow} tone="green" active={filters.bucket === "跟进中"} onClick={() => applyMetricFilter({ bucket: "跟进中" })} />
      <Metric label="观察池" value={stats.watch} tone="blue" active={filters.bucket === "观察池"} onClick={() => applyMetricFilter({ bucket: "观察池" })} />
      <Metric label="淘汰池" value={stats.drop} tone="red" active={filters.bucket === "淘汰池"} onClick={() => applyMetricFilter({ bucket: "淘汰池" })} />
      <Metric label="缺链接" value={stats.missingLinks} tone="neutral" active={filters.missingLinks} onClick={() => applyMetricFilter({ missingLinks: true })} />
    </section>

    <section className="decision-board" aria-label="今日决策流">
      {insights.decisionLanes.map((lane) => (
        <article className="decision-lane" key={lane.key}>
          <div className="decision-lane-head">
            <div>
              <p className="eyebrow">{lane.kicker}</p>
              <h3>{lane.title}</h3>
            </div>
            <button className="lane-count" type="button" onClick={() => applyMetricFilter(lane.filter)}>{lane.count}</button>
          </div>
          <p>{lane.description}</p>
          <ul className="decision-lead-list">
            {lane.leads.length ? lane.leads.map((lead) => (
              <li key={lead.id}>
                <button type="button" onClick={() => { setFilters({ ...emptyFilters, ...lane.filter }); setSelectedId(lead.id); }}>
                  <span>{lead.project}</span>
                  <small>{lead.priority} · {lead.bucket} · {lead.region === "中国" ? lead.country : lead.region_priority}</small>
                </button>
              </li>
            )) : <li className="empty-lane">{lane.empty}</li>}
          </ul>
        </article>
      ))}
    </section>

    <section className="sourcing-brief">
      <div className="brief-head">
        <div>
          <p className="eyebrow">本周 Sourcing 概览</p>
          <h3>把可商务推进、待验证、应淘汰的边界看清楚</h3>
        </div>
        <span>{insights.weekLabel}</span>
      </div>
      <article className="brief-card">
        <div className="brief-card-head">
          <span className="brief-icon"><TrendingUp size={16} /></span>
          <div>
            <span className="brief-kicker">重点推进</span>
            <strong>{insights.pipelineCount} 个项目需要继续动作</strong>
          </div>
        </div>
        <div className="brief-metrics">
          <span><b>{insights.weekSourced}</b>本周新增</span>
          <span><b>{insights.enteredFollowThisWeek}</b>本周进跟进/推进</span>
          <span><b>{insights.highPriorityPipeline}</b>P1/P2 重点</span>
        </div>
        <ul className="brief-list">
          {insights.focusLeads.length ? insights.focusLeads.map((lead) => (
            <li key={lead.id}><b>{lead.project}</b><span>{lead.priority} · {lead.bucket} · {lead.release_window || "窗口待确认"}</span></li>
          )) : <li><b>暂无高优先级积压</b><span>可以从待评测或观察池补充新候选。</span></li>}
        </ul>
      </article>
      <article className="brief-card">
        <div className="brief-card-head">
          <span className="brief-icon"><AlertTriangle size={16} /></span>
          <div>
            <span className="brief-kicker">测试优先</span>
            <strong>先测游戏，测不过直接淘汰</strong>
          </div>
        </div>
        <div className="brief-metrics">
          <span><b>{stats.evaluation + stats.testing}</b>待评测/测试中</span>
          <span><b>{insights.dueSoon}</b>7 天内到期</span>
          <span><b>{stats.missingLinks}</b>缺 Steam 链接</span>
        </div>
        <ul className="brief-list">
          {insights.actions.map((action) => <li key={action}><b>下一步</b><span>{action}</span></li>)}
          {insights.dropReasons.slice(0, 2).map((reason) => <li key={reason.label}><b>{reason.label}</b><span>{reason.count} 个淘汰记录，适合回看规则是否过严。</span></li>)}
        </ul>
      </article>
    </section>

    <section className="filters">
      <label className="search-box"><Search size={16} /><input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="项目 / 团队 / 联系方式 / 推荐理由 / 备注" /></label>
      <Select label="池子" value={filters.bucket} options={bucketOptions} onChange={(bucket) => setFilters({ ...filters, bucket })} />
      <Select label="地区" value={filters.region} options={regionOptions} onChange={(region) => setFilters({ ...filters, region })} />
      <Select label="阶段" value={filters.stage} options={stageOptions} onChange={(stage) => setFilters({ ...filters, stage })} />
      <label><span>城市/国家</span><input value={filters.city} onChange={(event) => setFilters({ ...filters, city: event.target.value })} /></label>
      <label><span>Owner</span><input value={filters.owner} onChange={(event) => setFilters({ ...filters, owner: event.target.value })} /></label>
      <label><span>窗口</span><input value={filters.releaseWindow} onChange={(event) => setFilters({ ...filters, releaseWindow: event.target.value })} /></label>
      <button className="ghost-button" onClick={() => { setFilters(emptyFilters); setSelectedId(null); }}>清空</button>
    </section>

    <section className="workspace">
      <div className="lead-table-wrap">
        <table className="lead-table">
          <colgroup>
            <col className="lead-col-project" />
            <col className="lead-col-region" />
            <col className="lead-col-contact" />
            <col className="lead-col-reason" />
            <col className="lead-col-progress" />
            <col className="lead-col-notes" />
          </colgroup>
          <thead><tr><th>项目</th><th>地区</th><th>联系方式</th><th>推荐理由 / 规则</th><th>进度 / 发行</th><th>备注</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="empty-cell">加载中</td></tr> : filteredLeads.map((lead) => (
              <tr key={lead.id} className={`${lead.id === selectedLead?.id ? "selected-row" : ""} ${lead.review_status === "未处理" ? "unread-row" : ""} priority-${priorityTone(lead.priority)} ${isTestingOverdue(lead) ? "testing-overdue-row" : ""}`} onClick={() => setSelectedId(lead.id)}>
                <td><div className="project-cell"><span className={`bucket-dot ${bucketClass(lead.bucket)}`} /><div><strong>{isTestingOverdue(lead) && <span className="overdue-marker" title="测试已超过两周未更新"><AlertTriangle size={14} /></span>}{lead.project}</strong><small><span className={`priority-pill priority-${priorityTone(lead.priority)}`}>{priorityLabel(lead.priority)}</span> · {lead.bucket} · {lead.review_status}</small></div></div></td>
                <td><strong>{lead.region}</strong><small className="subline">{[lead.country, lead.city].filter(Boolean).join(" · ") || "待补充"}</small></td>
                <td><ContactChips contacts={lead.contact_methods} links={lead.links} /></td>
                <td><strong>{lead.priority_reason ?? "待补充"}</strong><small className="subline">{lead.rule_fit ?? "待复核"}</small></td>
                <td className="lead-progress-cell">{lead.progress}<small className="subline">{lead.publisher_status}</small><QuickActions lead={lead} onPatch={handleLeadPatch} compact missingLinksMode={filters.missingLinks} /></td>
                <td>{lead.notes ?? ""}</td>
              </tr>
            ))}
            {!loading && !filteredLeads.length && <tr><td colSpan={6} className="empty-cell">无匹配 leads</td></tr>}
          </tbody>
        </table>
      </div>
      <LeadDetail lead={selectedLead} onPatch={handleLeadPatch} onMove={moveBucket} missingLinksMode={filters.missingLinks} />
    </section>
  </>;
}

function activeFilterLabel(filters: Filters) {
  if (filters.missingLinks) return "缺链接补全";
  if (filters.reviewStatus !== "全部") return filters.reviewStatus;
  if (filters.bucket !== "全部") return filters.bucket;
  if (filters.query) return "搜索结果";
  return "Leads Review";
}

function buildSourcingInsights(leads: Lead[], stats: DashboardStats): SourcingInsights {
  const { start, end } = currentWeekRange();
  const weekSourced = leads.filter((lead) => isWithinRange(lead.first_seen, start, end)).length;
  const enteredFollowThisWeek = leads.filter((lead) => (lead.bucket === "跟进中" || lead.bucket === "推进池") && isWithinRange(lead.reviewed_at, start, end)).length;
  const activeBuckets: Bucket[] = ["待评测", "测试中", "跟进中", "推进池"];
  const pipelineLeads = leads.filter((lead) => activeBuckets.includes(lead.bucket));
  const highPriorityPipeline = pipelineLeads.filter((lead) => lead.priority === "P0" || lead.priority === "P1" || lead.priority === "P2").length;
  const dueSoon = pipelineLeads.filter((lead) => isDueSoon(lead.due_date)).length;
  const unreadLeads = leads
    .filter((lead) => lead.review_status === "未处理" || lead.bucket === "未处理")
    .sort(sortLeadByBdPriority);
  const commercialLeads = leads
    .filter((lead) => lead.bucket === "跟进中" || lead.bucket === "推进池")
    .sort((a, b) => missingActionScore(b) - missingActionScore(a) || sortLeadByBdPriority(a, b));
  const testingLeads = leads
    .filter((lead) => lead.bucket === "待评测" || lead.bucket === "测试中")
    .sort(sortLeadByBdPriority);
  const focusLeads = [...pipelineLeads]
    .sort((a, b) => priorityScore(a.priority) - priorityScore(b.priority) || dateScore(b.reviewed_at) - dateScore(a.reviewed_at))
    .slice(0, 3);
  const decisionLanes: DecisionLane[] = [
    {
      key: "review",
      kicker: "DECIDE FIRST",
      title: "先清未处理",
      description: "日报新进只进未处理，先粗判：提测、观察或淘汰。",
      count: unreadLeads.length,
      filter: { reviewStatus: "未处理" },
      leads: unreadLeads.slice(0, 3),
      empty: "没有待你判断的新 lead。"
    },
    {
      key: "test",
      kicker: "PLAYTEST",
      title: "先测游戏",
      description: "待评测/测试中先拿实机结论；测不动、体验差就直接淘汰。",
      count: testingLeads.length,
      filter: testingLeads.some((lead) => lead.bucket === "测试中") ? { bucket: "测试中" } : { bucket: "待评测" },
      leads: testingLeads.slice(0, 3),
      empty: "当前没有等待测试的项目。"
    },
    {
      key: "commerce",
      kicker: "BD AFTER TEST",
      title: "测过再商务",
      description: "只有测试通过/明确要深谈的项目，才补 owner、下一步和联系方式。",
      count: commercialLeads.length,
      filter: { reviewStatus: "跟进中" },
      leads: commercialLeads.slice(0, 3),
      empty: "当前没有商务推进队列。"
    }
  ];
  const actions = buildInsightActions(stats, dueSoon, pipelineLeads);
  const dropReasons = buildDropReasons(leads.filter((lead) => lead.bucket === "淘汰池" || lead.review_status === "已淘汰"));

  return {
    weekLabel: `${formatShortDate(start)} - ${formatShortDate(end)}`,
    weekSourced,
    enteredFollowThisWeek,
    pipelineCount: stats.follow + stats.push + stats.evaluation + stats.testing,
    highPriorityPipeline,
    dueSoon,
    decisionLanes,
    dropReasons,
    focusLeads,
    actions
  };
}

function buildInsightActions(stats: DashboardStats, dueSoon: number, pipelineLeads: Lead[]) {
  const actions: string[] = [];
  const commerceLeads = pipelineLeads.filter((lead) => lead.bucket === "跟进中" || lead.bucket === "推进池");
  const commerceMissingTouchPoint = commerceLeads.filter((lead) => needsSteamLinkTriage(lead) || !hasUsefulContact(lead)).length;
  if (stats.evaluation || stats.testing) actions.push(`${stats.evaluation} 个待评测、${stats.testing} 个测试中，先拿实机/运营结论；不行就淘汰。`);
  if (dueSoon) actions.push(`${dueSoon} 个项目 7 天内到期，优先确认 Demo、排期或商务回复。`);
  if (commerceMissingTouchPoint) actions.push(`${commerceMissingTouchPoint} 个已进入商务推进的项目缺触达入口，测过后再补联系人/官网。`);
  const noOwner = commerceLeads.filter((lead) => !lead.owner).length;
  if (noOwner) actions.push(`${noOwner} 个推进相关项目没有 Owner，容易丢跟进。`);
  if (!actions.length) actions.push("今天没有明显积压，可以复看观察池里 P1/P2 项目的 B站适配点。");
  return actions.slice(0, 3);
}

function buildDropReasons(droppedLeads: Lead[]) {
  const reasons = new Map<string, number>();
  const add = (label: string) => reasons.set(label, (reasons.get(label) ?? 0) + 1);

  for (const lead of droppedLeads) {
    let matched = false;
    if (lead.china_capability_occupied) { add("中国发行能力已占位"); matched = true; }
    if (lead.narrative_heavy) { add("叙事重，B站视频表达风险"); matched = true; }
    if (lead.early_access) { add("Early Access / 版本不稳定"); matched = true; }
    if (lead.india_team) { add("印度团队或区域匹配度低"); matched = true; }
    if (lead.priority === "P3") { add("优先级偏低"); matched = true; }
    if (!matched) add("数据或规则不足");
  }

  return Array.from(reasons, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function sortLeadByBdPriority(a: Lead, b: Lead) {
  const domesticScore = Number(b.region === "中国") - Number(a.region === "中国");
  return domesticScore || priorityScore(a.priority) - priorityScore(b.priority) || dateScore(b.first_seen) - dateScore(a.first_seen) || a.project.localeCompare(b.project, "zh-CN");
}

function missingActionScore(lead: Lead) {
  return Number(!lead.next_action) + Number(!lead.owner) + Number(!lead.due_date) + Number(!lead.evaluation_grade);
}

function hasUsefulContact(lead: Lead) {
  return visibleContacts(lead.contact_methods).some((method) => method.value.trim().length > 0);
}

function currentWeekRange() {
  const start = new Date();
  const day = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isWithinRange(value: string | null, start: Date, end: Date) {
  const date = parseMaybeDate(value);
  return Boolean(date && date >= start && date <= end);
}

function isDueSoon(value: string | null) {
  const due = parseMaybeDate(value);
  if (!due) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(today.getDate() + 7);
  return due >= today && due <= limit;
}

function parseMaybeDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function dateScore(value: string | null) {
  return parseMaybeDate(value)?.valueOf() ?? 0;
}

function priorityScore(priority: Priority) {
  if (priority === "P0") return 0;
  if (priority === "P1") return 1;
  if (priority === "P2") return 2;
  return 3;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }).replace(/\//g, ".");
}

function Metric({ label, value, tone, active, onClick }: { label: string; value: number; tone: "neutral" | "green" | "amber" | "red" | "blue" | "cyan" | "purple"; active?: boolean; onClick?: () => void }) {
  return <button className={`metric metric-${tone} ${active ? "active" : ""}`} onClick={onClick} type="button" aria-pressed={active}><span>{label}</span><strong>{value}</strong></button>;
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (value: T) => void }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function LeadDetail({ lead, onPatch, onMove, missingLinksMode }: { lead: Lead | null; onPatch: (id: string, patch: Partial<Lead>) => Promise<void>; onMove: (lead: Lead, bucket: Bucket) => Promise<void>; missingLinksMode: boolean }) {
  const [draft, setDraft] = useState<Lead | null>(null);

  useEffect(() => {
    if (lead) setDraft({ ...lead, contact_methods: [...lead.contact_methods], links: [...lead.links] });
  }, [lead]);

  if (!lead || !draft) return <aside className="detail-panel"><div className="empty-cell">暂无 lead</div></aside>;
  const activeLead = lead;
  const activeDraft = draft;

  function setField<K extends keyof Lead>(key: K, value: Lead[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function applySteamLink(normalized: NormalizedSteamLink) {
    const nextDraft = applySteamLinkToLead(activeDraft, normalized);
    setDraft(nextDraft);
    await onPatch(activeLead.id, nextDraft);
  }

  async function confirmCalendarReminder() {
    if (!activeDraft.due_date) {
      window.alert("请先选择 Due Date，再确认放入日历。");
      return;
    }
    const nextDraft = { ...activeDraft, calendar_enabled: true };
    setDraft(nextDraft);
    await onPatch(activeLead.id, { due_date: activeDraft.due_date, calendar_enabled: true });
  }

  const addContact = () => setField("contact_methods", [...draft.contact_methods, { type: "微信/QQ", value: "", note: null }]);
  const updateContact = (index: number, patch: Partial<ContactMethod>) => setField("contact_methods", draft.contact_methods.map((method, methodIndex) => methodIndex === index ? { ...method, ...patch } : method));
  const removeContact = (index: number) => setField("contact_methods", draft.contact_methods.filter((_, methodIndex) => methodIndex !== index));
  const moveDraft = async (nextLead: Lead, bucket: Bucket) => {
    const patch = { bucket, stage: stageFromBucket(bucket), ...reviewPatchForBucket(bucket) };
    setDraft({ ...nextLead, ...patch });
    await onMove(nextLead, bucket);
  };
  const save = () => {
    const evaluationChanged = draft.evaluation_grade !== lead.evaluation_grade || draft.evaluation_result !== lead.evaluation_result;
    const nextDraft = evaluationChanged && (draft.evaluation_grade || draft.evaluation_result)
      ? { ...draft, evaluated_at: new Date().toISOString() }
      : draft;
    if (nextDraft !== draft) setDraft(nextDraft);
    return onPatch(lead.id, nextDraft);
  };
  const reviewEvidence = buildReviewEvidence(draft);

  return <aside className="detail-panel">
    <div className="detail-head">
      <div><p className="eyebrow">{draft.bucket} · {draft.priority} · {draft.review_status}</p><h2>{isTestingOverdue(draft) && <span className="overdue-marker" title="测试已超过两周未更新"><AlertTriangle size={16} /></span>}{draft.project}</h2></div>
      <button className="primary-button" onClick={save}><Save size={16} />保存</button>
    </div>

    <QuickActions lead={draft} onPatch={onPatch} missingLinksMode={missingLinksMode} />
    <BucketButtons lead={draft} onMove={moveDraft} />

    <section className="review-command-card">
      <div className="review-command-summary">
        <div>
          <p className="eyebrow">BD Review Card</p>
          <h3>{leadDecisionHeadline(draft)}</h3>
          <p>{leadDecisionSummary(draft)}</p>
        </div>
        <span className={`grade-badge ${gradeClass(draft.evaluation_grade)}`}>{draft.evaluation_grade ?? "未评级"}</span>
      </div>
      <div className="review-command-form">
        <Select label="评级" value={draft.evaluation_grade ?? "未评级"} options={evaluationGradeOptions} onChange={(value) => setField("evaluation_grade", value === "未评级" ? null : value)} />
        <label className="field"><span>一句话评测结论</span><textarea value={draft.evaluation_result ?? ""} onChange={(event) => setField("evaluation_result", event.target.value || null)} /></label>
        <label className="field"><span>下一步动作</span><textarea value={draft.next_action ?? ""} onChange={(event) => setField("next_action", event.target.value || null)} /></label>
      </div>
      <div className="review-evidence-grid">
        {reviewEvidence.map((item) => <div key={item.label}><small>{item.label}</small><strong>{item.value}</strong></div>)}
      </div>
    </section>

    <div className="signal-grid three">
      <Signal label="推荐理由" value={draft.priority_reason ?? "待补充"} />
      <Signal label="规则判断" value={draft.rule_fit ?? "待复核"} />
      <Signal label="B站适配" value={draft.bilibili_fit} />
    </div>

    <SteamLinkEditor lead={draft} onApply={applySteamLink} />

    <div className="form-section">
      <h3>基础信息</h3>
      <div className="form-grid two">
        <TextField label="项目名" value={draft.project} onChange={(value) => setField("project", value)} />
        <TextField label="团队" value={draft.team} onChange={(value) => setField("team", value)} />
        <TextField label="Steam AppID" value={draft.steam_app_id} onChange={(value) => setField("steam_app_id", value)} />
        <TextField label="团队规模" value={draft.team_size} onChange={(value) => setField("team_size", value)} />
        <Select label="地区" value={draft.region} options={regionValues} onChange={(value) => setField("region", value)} />
        <TextField label="国家/地区" value={draft.country} onChange={(value) => setField("country", value || "未知")} />
        <TextField label="城市" value={draft.city} onChange={(value) => setField("city", value)} />
        <Select label="区域优先级" value={draft.region_priority} options={regionPriorityValues} onChange={(value) => setField("region_priority", value)} />
      </div>
    </div>

    <div className="form-section">
      <h3>Review 结论</h3>
      <div className="form-grid two">
        <Select label="池子" value={draft.bucket} options={bucketValues} onChange={(value) => setDraft((current) => (current ? { ...current, bucket: value, stage: stageFromBucket(value), ...reviewPatchForBucket(value) } : current))} />
        <Select label="阶段" value={draft.stage} options={stageValues} onChange={(value) => setField("stage", value)} />
        <Select label="优先级" value={draft.priority} options={priorityValues} onChange={(value) => setField("priority", value)} />
        <TextField label="Owner" value={draft.owner} onChange={(value) => setField("owner", value)} />
        <TextField label="Due Date" type="date" value={draft.due_date} onChange={(value) => setField("due_date", value || null)} />
        <TextField label="发售窗口" value={draft.release_window} onChange={(value) => setField("release_window", value)} />
        <div className="due-date-actions span-2">
          <button className="ghost-button" onClick={confirmCalendarReminder}><CalendarCheck size={16} />确认放入日历</button>
          {draft.calendar_enabled && draft.due_date ? <span>已在日历显示：{draft.due_date}</span> : <span>只有点确认后才会进入日历，避免页面被系统自动塞满。</span>}
        </div>
      </div>
      <TextareaField label="优先级高/低的原因" value={draft.priority_reason} onChange={(value) => setField("priority_reason", value)} />
      <TextareaField label="是否符合规则" value={draft.rule_fit} onChange={(value) => setField("rule_fit", value)} />
      <TextareaField label="下一步动作" value={draft.next_action} onChange={(value) => setField("next_action", value)} />
      <TextareaField label="备注" value={draft.notes} onChange={(value) => setField("notes", value)} />
    </div>

    <div className="form-section evaluation-section">
      <h3>评测结果</h3>
      <div className="form-grid two">
        <Select label="评级" value={draft.evaluation_grade ?? "未评级"} options={evaluationGradeOptions} onChange={(value) => setField("evaluation_grade", value === "未评级" ? null : value)} />
        <TextField label="评测时间" value={draft.evaluated_at?.slice(0, 10) ?? ""} type="date" onChange={(value) => setField("evaluated_at", value || null)} />
      </div>
      <TextareaField label="具体评测内容" value={draft.evaluation_result} onChange={(value) => setField("evaluation_result", value)} />
      <p className="field-hint">这里写运营/测试后的真实判断：玩法手感、内容看点、数据表现、B站可放大点、主要风险和是否建议商务深入。</p>
    </div>

    <div className="form-section">
      <h3>联系方式</h3>
      <div className="contact-editor">
        {draft.contact_methods.map((method, index) => <div className="contact-row" key={`${method.type}-${index}`}>
          <select value={method.type} onChange={(event) => updateContact(index, { type: event.target.value as ContactType })}>{contactTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
          <input value={method.value} onChange={(event) => updateContact(index, { value: event.target.value })} placeholder="微信 / QQ / 邮箱 / 电话 / 官网 / Steam 社区" />
          <input value={method.note ?? ""} onChange={(event) => updateContact(index, { note: event.target.value || null })} placeholder="备注" />
          <button className="icon-button danger" onClick={() => removeContact(index)}><Trash2 size={15} /></button>
        </div>)}
        <button className="ghost-button" onClick={addContact}><Plus size={16} />添加联系方式</button>
      </div>
    </div>

    <div className="form-section">
      <h3>产品与发行</h3>
      <div className="form-grid two">
        <TextField label="类型" value={draft.genre} onChange={(value) => setField("genre", value)} />
        <TextField label="发行商" value={draft.publisher_name} onChange={(value) => setField("publisher_name", value)} />
      </div>
      <TextareaField label="玩法" value={draft.gameplay} onChange={(value) => setField("gameplay", value)} />
      <TextareaField label="进度" value={draft.progress} onChange={(value) => setField("progress", value || "待补充")} />
      <TextareaField label="发行结构" value={draft.publisher_status} onChange={(value) => setField("publisher_status", value || "待确认")} />
      <TextareaField label="B站适配度" value={draft.bilibili_fit} onChange={(value) => setField("bilibili_fit", value || "待评估")} />
      <TextareaField label="放大作用" value={draft.amplification} onChange={(value) => setField("amplification", value || "待评估")} />
      <TextareaField label="风险" value={draft.risks} onChange={(value) => setField("risks", value)} />
      <TextareaField label="结论" value={draft.verdict} onChange={(value) => setField("verdict", value || "待判断")} />
      <TextareaField label="曝光轨迹" value={draft.exposure_trail} onChange={(value) => setField("exposure_trail", value)} />
      <TextareaField label="旧公开信号" value={draft.public_signals} onChange={(value) => setField("public_signals", value)} />
      <TextareaField label="链接，一行一个" value={draft.links.join("\n")} onChange={(value) => setField("links", (value ?? "").split("\n").map((line) => line.trim()).filter(Boolean))} />
      <div className="check-grid">
        <CheckboxField label="PC Early Access" checked={draft.early_access} onChange={(value) => setField("early_access", value)} />
        <CheckboxField label="叙事主导" checked={draft.narrative_heavy} onChange={(value) => setField("narrative_heavy", value)} />
        <CheckboxField label="印度团队" checked={draft.india_team} onChange={(value) => setField("india_team", value)} />
        <CheckboxField label="中国能力已占位" checked={draft.china_capability_occupied} onChange={(value) => setField("china_capability_occupied", value)} />
      </div>
    </div>
  </aside>;
}

function leadDecisionHeadline(lead: Lead) {
  if (lead.bucket === "推进池") return "已进入深度商务推进";
  if (lead.bucket === "跟进中") return "值得继续商务跟进";
  if (lead.bucket === "测试中") return "等待测试结论定级";
  if (lead.bucket === "待评测") return "先拿运营/测试判断";
  if (lead.bucket === "淘汰池") return "已淘汰，保留反例";
  if (lead.bucket === "观察池") return "保留信号，暂缓推进";
  return "等待人工首轮判断";
}

function leadDecisionSummary(lead: Lead) {
  return firstText([
    lead.evaluation_result,
    lead.verdict,
    lead.priority_reason,
    lead.bilibili_fit,
    lead.next_action
  ], "还没有形成评审结论，先完成实机/运营测试；不成立就淘汰，成立后再补商务判断。");
}

function buildReviewEvidence(lead: Lead) {
  return [
    { label: "产品亮点", value: firstText([lead.priority_reason, lead.gameplay, lead.genre], "待补充玩法钩子、视觉或数据亮点。") },
    { label: "B站赋能", value: firstText([lead.bilibili_fit, lead.amplification], "待判断直播、切片、二创或 UP 主传播空间。") },
    { label: "商务可行", value: firstText([lead.publisher_status, `${lead.region_priority} · ${lead.release_window ?? "窗口待确认"}`], "待确认团队地区、发行空位和发售窗口。") },
    { label: "风险反证", value: firstText([lead.risks, lead.rule_fit], "待补充为什么不该推进，避免只看亮点。") }
  ];
}

function firstText(values: Array<string | null | undefined>, fallback: string) {
  const value = values.find((item) => item && item.trim());
  return value ? truncateText(value.trim(), 76) : fallback;
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function gradeClass(grade: EvaluationGrade | null) {
  if (!grade) return "grade-empty";
  return `grade-${grade.toLowerCase().replace("+", "plus").replace("-", "minus")}`;
}

function SteamLinkEditor({ lead, onApply }: { lead: Lead; onApply: (link: NormalizedSteamLink) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const links = gameLinks(lead.links);

  useEffect(() => setValue(""), [lead.id]);

  async function handleApply() {
    const normalized = normalizeSteamLinkInput(value);
    if (!normalized) {
      window.alert("请粘贴 Steam 商店/SteamDB/Steam 社区链接，或者直接输入 Steam AppID");
      return;
    }

    try {
      setSaving(true);
      await onApply(normalized);
      setValue("");
    } finally {
      setSaving(false);
    }
  }

  return <div className="steam-link-editor">
    <div className="steam-link-copy">
      <strong>Steam 链接补录</strong>
      <span>粘贴 Steam 商店、SteamDB、Steam 社区链接，或直接填 AppID；保存后左侧会出现 Steam / SteamDB 跳转标签。</span>
    </div>
    <div className="steam-link-input-row">
      <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://store.steampowered.com/app/... 或 AppID" />
      <button className="ghost-button" onClick={handleApply} disabled={saving}>{saving ? "保存中" : "补录并保存"}</button>
    </div>
    {links.length > 0 && <div className="chip-list current-steam-links">{links.map((link) => <a className="chip contact-chip-link" key={link} href={link} target="_blank" rel="noreferrer"><ExternalLink size={12} /><span className="chip-label">{linkLabel(link)}</span></a>)}</div>}
  </div>;
}

type QuickActionSpec = {
  key: string;
  label: string;
  compactLabel: string;
  title: string;
  tone: "evaluate" | "testing" | "follow" | "watch" | "drop" | "push";
  icon: ReactElement;
  patch: () => Partial<Lead>;
};

function QuickActions({ lead, onPatch, compact = false, missingLinksMode = false }: { lead: Lead; onPatch: (id: string, patch: Partial<Lead>) => Promise<void>; compact?: boolean; missingLinksMode?: boolean }) {
  const specs = quickActionSpecs(lead, missingLinksMode);
  return <div className={compact ? "quick-actions compact" : "quick-actions"} data-fixed-actions="native-pipeline" data-action-count={specs.length} onClick={(event) => event.stopPropagation()}>
    {specs.map((spec) => (
      <button key={spec.key} className={`quick-button ${spec.tone}`} data-action-label={compact ? spec.compactLabel : undefined} title={spec.title} aria-label={spec.title} onClick={() => void onPatch(lead.id, spec.patch())}>
        {spec.icon}
        <span className={compact ? "visually-hidden" : ""}>{spec.label}</span>
      </button>
    ))}
  </div>;
}

function quickActionSpecs(lead: Lead, missingLinksMode: boolean): QuickActionSpec[] {
  const reviewed_at = new Date().toISOString();
  const isUnread = lead.review_status === "未处理";
  const evaluate = {
    key: "evaluate",
    label: "待评测",
    compactLabel: "测",
    title: "进入待评测队列，由同事提测",
    tone: "evaluate" as const,
    icon: <ListChecks size={15} />,
    patch: () => ({ bucket: "待评测" as const, stage: "watch" as const, review_status: "已查看" as const, reviewed_at })
  };
  const testing = {
    key: "testing",
    label: "测试中",
    compactLabel: "试",
    title: "提测完成，进入测试中；默认两周后提醒",
    tone: "testing" as const,
    icon: <CalendarCheck size={15} />,
    patch: () => ({ bucket: "测试中" as const, stage: "active" as const, review_status: "跟进中" as const, reviewed_at, due_date: addDaysIso(14), calendar_enabled: true })
  };
  const follow = {
    key: "follow",
    label: lead.bucket === "淘汰池" ? "放入跟进" : "跟进",
    compactLabel: "跟",
    title: lead.bucket === "淘汰池" ? "从淘汰池恢复到跟进中" : "移入跟进中",
    tone: "follow" as const,
    icon: <CheckCircle2 size={15} />,
    patch: () => ({ bucket: "跟进中" as const, stage: "active" as const, review_status: "跟进中" as const, reviewed_at })
  };
  const push = {
    key: "push",
    label: "推进中",
    compactLabel: "推",
    title: "运营测试通过，进入推进池做深入商务洽谈",
    tone: "push" as const,
    icon: <TrendingUp size={15} />,
    patch: () => ({ bucket: "推进池" as const, stage: "negotiating" as const, review_status: "跟进中" as const, reviewed_at })
  };
  const watch = {
    key: "watch",
    label: lead.bucket === "淘汰池" ? "放入观察" : "观望",
    compactLabel: "观",
    title: lead.bucket === "淘汰池" ? "从淘汰池恢复到观察池" : "转入观察池",
    tone: "watch" as const,
    icon: <ListChecks size={15} />,
    patch: () => ({ bucket: "观察池" as const, stage: "watch" as const, review_status: "已查看" as const, reviewed_at })
  };
  const drop = {
    key: "drop",
    label: "淘汰",
    compactLabel: "淘",
    title: "移入淘汰池",
    tone: "drop" as const,
    icon: <XCircle size={15} />,
    patch: () => ({ bucket: "淘汰池" as const, stage: "rejected" as const, review_status: "已淘汰" as const, reviewed_at })
  };

  if (isUnread) return [evaluate, watch, drop];
  if (lead.bucket === "待评测") return [testing];
  if (lead.bucket === "测试中") return [follow, watch, drop];
  if (lead.bucket === "观察池") return [evaluate, follow, drop];
  if (lead.bucket === "淘汰池") return [watch, evaluate];
  if (lead.bucket === "跟进中") return [watch, evaluate, drop];
  if (lead.bucket === "推进池") return [follow, watch, drop];
  if (missingLinksMode) return [evaluate, follow, watch, drop];
  return [evaluate, drop];
}

function BucketButtons({ lead, onMove, compact = false }: { lead: Lead; onMove: (lead: Lead, bucket: Bucket) => Promise<void>; compact?: boolean }) {
  return <div className={compact ? "bucket-actions compact" : "bucket-actions"} onClick={(event) => event.stopPropagation()}>
    {bucketValues.map((bucket) => <button key={bucket} className={`bucket-button ${bucketClass(bucket)} ${lead.bucket === bucket ? "active" : ""}`} onClick={() => void onMove(lead, bucket)} disabled={lead.bucket === bucket}>{bucket}</button>)}
  </div>;
}

function ContactChips({ contacts, links }: { contacts: ContactMethod[]; links: string[] }) {
  const contactChips = visibleContacts(contacts).slice(0, 3).map((method, index) => ({
    href: isHttpUrl(method.value) ? method.value : null,
    key: `contact-${method.value}-${index}`,
    label: contactLabel(method),
    title: `${method.type}: ${method.value}`
  }));
  const usedLabels = new Set(contactChips.map((chip) => chip.label));
  const linkChips = gameLinks(links).map((link, index) => ({
    href: link,
    key: `link-${link}-${index}`,
    label: linkLabel(link),
    title: link
  })).filter((chip) => {
    if (usedLabels.has(chip.label)) return false;
    usedLabels.add(chip.label);
    return true;
  }).slice(0, 2);
  const displayChips = [...contactChips, ...linkChips];
  if (!displayChips.length) return <span className="muted">待补充</span>;
  return <div className="chip-list contact-chip-list">{displayChips.map((chip) => (
    chip.href
      ? <a className="chip contact-chip-link" key={chip.key} href={chip.href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} title={chip.title}><ExternalLink size={12} /><span className="chip-label">{chip.label}</span></a>
      : <span className="chip" key={chip.key} title={chip.title}><span className="chip-label">{chip.label}</span></span>
  ))}</div>;
}

function RadarPage({ radar, loading, onDateChange }: { radar: RadarReport | null; loading: boolean; onDateChange: (date: string) => void }) {
  if (loading) return <section className="radar-shell"><div className="empty-cell">加载行业雷达中</div></section>;
  return <section className="radar-shell">
    <div className="radar-head">
      <div className="report-head-main"><div><p className="eyebrow">{radar?.report_date ?? "今日"}</p><h2>行业雷达</h2></div><p>{radar?.summary ?? "暂无雷达数据"}</p></div>
      <ReportHistoryControls
        availableDates={radar?.available_dates}
        isFallback={radar?.is_fallback}
        noun="行业雷达"
        onDateChange={onDateChange}
        reportDate={radar?.report_date}
        requestedDate={radar?.requested_date}
      />
    </div>
    {(radarCategoryNames(radar) ?? radarCategories).map((category) => {
      const items = radar?.items.filter((item) => item.category === category) ?? [];
      return <section className="radar-band" key={category}>
        <h3>{category}</h3>
        {items.length ? <div className="radar-grid">{items.map((item) => <article className="radar-card" key={item.id}>
          <div className="radar-card-head"><span className={`heat heat-${item.heat}`}>{item.heat}</span><strong>{item.title}</strong></div>
          <p>{item.summary}</p>
          <dl><div><dt>BD 相关</dt><dd>{item.relevance}</dd></div><div><dt>建议动作</dt><dd>{item.suggested_action}</dd></div></dl>
          <a href={item.link} target="_blank" rel="noreferrer"><ExternalLink size={14} />{item.source}</a>
        </article>)}</div> : <div className="radar-empty">这一天暂无该类记录；可以用上方回看保留的历史内容。</div>}
      </section>;
    })}
  </section>;
}

function radarCategoryNames(radar: RadarReport | null) {
  const categories = Array.from(new Set((radar?.items ?? []).map((item) => item.category).filter(Boolean)));
  return categories.length ? categories : null;
}

function Signal({ label, value }: { label: string; value: string }) {
  return <div className="signal"><small>{label}</small><strong>{value}</strong></div>;
}

function TextField({ label, value, onChange, type = "text" }: { label: string; value: string | null; onChange: (value: string) => void; type?: string }) {
  return <label className="field"><span>{label}</span><input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextareaField({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) {
  return <label className="field span-2"><span>{label}</span><textarea value={value ?? ""} onChange={(event) => onChange(event.target.value || null)} /></label>;
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="checkbox-field"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function reviewPatchForBucket(bucket: Bucket): Partial<Lead> {
  const reviewed_at = new Date().toISOString();
  if (bucket === "未处理") return { review_status: "未处理", reviewed_at: null };
  if (bucket === "推进池") return { review_status: "跟进中", reviewed_at };
  if (bucket === "跟进中") return { review_status: "跟进中", reviewed_at };
  if (bucket === "测试中") return { review_status: "跟进中", reviewed_at, due_date: addDaysIso(14), calendar_enabled: true };
  if (bucket === "待评测") return { review_status: "已查看", reviewed_at };
  if (bucket === "淘汰池") return { review_status: "已淘汰", reviewed_at };
  return { review_status: "已查看", reviewed_at };
}

function stageFromBucket(bucket: Bucket): Stage {
  if (bucket === "未处理") return "new";
  if (bucket === "推进池") return "negotiating";
  if (bucket === "跟进中" || bucket === "测试中") return "active";
  if (bucket === "淘汰池") return "rejected";
  return "watch";
}

function bucketClass(bucket: Bucket) {
  if (bucket === "未处理") return "unread";
  if (bucket === "推进池") return "push";
  if (bucket === "待评测") return "evaluate";
  if (bucket === "测试中") return "testing";
  if (bucket === "跟进中") return "follow";
  if (bucket === "淘汰池") return "drop";
  return "watch";
}

function priorityTone(priority: Priority) {
  if (priority === "P0" || priority === "P1") return "high";
  if (priority === "P2") return "medium";
  return "low";
}

function priorityLabel(priority: Priority) {
  if (priority === "P0" || priority === "P1") return `${priority} 高`;
  if (priority === "P2") return `${priority} 中`;
  return `${priority} 低`;
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isTestingOverdue(lead: Lead) {
  return lead.bucket === "测试中" && Boolean(lead.due_date) && lead.due_date! < todayIso();
}

function visibleContacts(contacts: ContactMethod[]) {
  return contacts.filter((method) => !isGameLink(method.value));
}

function gameLinks(links: string[]) {
  return links.filter(isGameLink).slice(0, 2);
}

function needsSteamLinkTriage(lead: Lead) {
  const isDropped = lead.bucket === "淘汰池" || lead.review_status === "已淘汰" || lead.stage === "rejected";
  return !isDropped && !gameLinks(lead.links).length;
}

function normalizeSteamLinkInput(value: string): NormalizedSteamLink | null {
  const appId = steamAppIdFromText(value);
  if (!appId) return null;
  return {
    appId,
    storeUrl: `https://store.steampowered.com/app/${appId}/`,
    steamDbUrl: `https://steamdb.info/app/${appId}/`
  };
}

function steamAppIdFromText(value: string) {
  const trimmed = value.trim();
  if (/^\d{3,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:store\.steampowered\.com|steamcommunity\.com|steamdb\.info)\/app\/(\d+)/i) ?? trimmed.match(/\/app\/(\d+)/i);
  return match?.[1] ?? null;
}

function applySteamLinkToLead(lead: Lead, steam: NormalizedSteamLink): Lead {
  return {
    ...lead,
    steam_app_id: lead.steam_app_id || steam.appId,
    links: mergeLinks([steam.storeUrl, steam.steamDbUrl, ...lead.links])
  };
}

function mergeLinks(links: string[]) {
  const deduped = new Map<string, string>();
  for (const link of links) {
    const trimmed = link.trim();
    if (!trimmed) continue;
    deduped.set(trimmed.toLowerCase().replace(/\/$/, ""), trimmed);
  }
  return Array.from(deduped.values());
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isGameLink(link: string) {
  return /(?:store\.steampowered\.com|steamdb\.info)\/app\/\d+/i.test(link);
}

function contactLabel(method: ContactMethod) {
  const value = method.value.trim();
  if (!isHttpUrl(value)) {
    if (method.type === "Email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Email";
    if (method.type === "电话") return "电话";
    if (method.type === "微信/QQ") return "微信/QQ";
    return `${method.type}: ${value}`;
  }
  if (/steamdb/i.test(value)) return "SteamDB";
  if (/steam(?:powered|community)/i.test(value) || method.type === "Steam") return "Steam";
  if (/discord/i.test(value) || method.type === "Discord") return "Discord";
  if (/instagram/i.test(value)) return "Instagram";
  if (/(?:twitter|x\.com)/i.test(value) || method.type === "X/Twitter") return "X";
  if (/bilibili/i.test(value) || method.type === "B站") return "B站";
  if (method.type === "官网") return "官网";
  return linkLabel(value);
}

function linkLabel(link: string) {
  if (link.includes("store.steampowered.com")) return "Steam";
  if (link.includes("steamdb.info")) return "SteamDB";
  if (link.includes("steamcommunity.com")) return "Steam 社区";
  if (link.includes("bilibili.com")) return "B站";
  try { return new URL(link).hostname.replace("www.", ""); } catch { return "链接"; }
}
