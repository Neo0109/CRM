import { Activity, AlertTriangle, ArrowDownToLine, Bot, CalendarCheck, CheckCircle2, ExternalLink, FileJson, FileSpreadsheet, ListChecks, LogOut, Newspaper, Plus, RefreshCw, Save, Search, Settings as SettingsIcon, Trash2, TrendingUp, XCircle } from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { clearAccessToken, excelExportUrl, fetchAutomationDiagnostics, fetchLeads, fetchRadar, fetchSourcingLearning, fetchSteamTrends, getAccessDisplayName, hasSavedCredentials, loginToCrm, syncLatestReport, updateLead } from "./api";
import { AssistantPage } from "./AssistantPage";
import { AutomationDiagnosticsPage } from "./AutomationDiagnosticsPage";
import { LeadEvidencePanel } from "./LeadEvidencePanel";
import { LoginPage } from "./LoginPage";
import { ReportHistoryControls } from "./ReportHistoryControls";
import { SettingsPage } from "./SettingsPage";
import { SteamTrendsPage } from "./SteamTrendsPage";
import bilibiliLogo from "./assets/bilibili-game-logo.png";
import { getDailyPhilosophyQuote } from "./dailyPhilosophyQuote";
import { buildBucketNavigation, buildDecisionTriage, buildLeadEvidenceChips, hasEvidenceIssue, needsActionAttention, type BucketNavigationItem, type TriageFilter } from "./leadTriage";
import { productVersion, productVersionLabel } from "./productVersion";
import type { AutomationDiagnostics, Bucket, ContactMethod, ContactType, EvaluationGrade, Lead, Priority, RadarCategory, RadarReport, Region, RegionPriority, ReviewStatus, SourcingLearningReport, Stage, SteamTrendReport } from "./types";

type View = "leads" | "assistant" | "radar" | "steam" | "diagnostics" | "settings";
type Filters = {
  query: string;
  bucket: "全部" | Bucket;
  region: "全部" | Region;
  stage: "全部" | Stage;
  owner: string;
  city: string;
  releaseWindow: string;
  reviewStatus: "全部" | ReviewStatus;
  evidenceIssues: boolean;
  missingLinks: boolean;
  needsAction: boolean;
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

const emptyFilters: Filters = { query: "", bucket: "全部", region: "全部", stage: "全部", owner: "", city: "", releaseWindow: "", reviewStatus: "全部", evidenceIssues: false, missingLinks: false, needsAction: false };
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
const dropReasonOptions = ["未选择", "已上线", "已有中国合作伙伴", "画面不符合中国", "画面差", "玩法粗糙", "题材/合规风险", "商业化空间弱", "B站适配弱", "数据/热度不足", "团队/发行结构不清晰", "重复项目", "联系不到/缺触达", "窗口不合适", "其他"] as const;

export default function App() {
  const [view, setView] = useState<View>("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(hasSavedCredentials());
  const [displayName, setDisplayName] = useState(getAccessDisplayName());
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [radar, setRadar] = useState<RadarReport | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);
  const [steamTrends, setSteamTrends] = useState<SteamTrendReport | null>(null);
  const [steamLoading, setSteamLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<AutomationDiagnostics | null>(null);
  const [sourcingLearning, setSourcingLearning] = useState<SourcingLearningReport | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    void reload(true);
    void loadRadar();
    void loadSteamTrends();
    void loadDiagnostics();
  }, [isAuthenticated]);

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
    const evidenceMatch = !filters.evidenceIssues || hasEvidenceIssue(lead);
    const missingLinkMatch = !filters.missingLinks || needsSteamLinkTriage(lead);
    const actionMatch = !filters.needsAction || needsActionAttention(lead);
    return queryMatch && bucketMatch && regionMatch && stageMatch && ownerMatch && cityMatch && releaseMatch && reviewMatch && evidenceMatch && missingLinkMatch && actionMatch;
  }), [filters, leads]);

  const selectedLead = useMemo(() => filteredLeads.find((lead) => lead.id === selectedId) ?? filteredLeads[0] ?? null, [filteredLeads, selectedId]);

  async function reload(syncDailyReport: boolean | "force" = false) {
    try {
      setLoading(true);
      if (syncDailyReport) {
        const syncResult = await syncLatestReport(undefined, syncDailyReport === "force");
        if (syncResult.synced && (syncResult.created > 0 || syncResult.updated > 0 || syncResult.dropped > 0)) {
          setStatus(`已自动同步 ${syncResult.report_date} 日报：新增 ${syncResult.created}，更新 ${syncResult.updated}，淘汰 ${syncResult.dropped}`);
        }
      }
      const nextLeads = await fetchLeads();
      setLeads(nextLeads);
      setSelectedId((current) => current ?? nextLeads[0]?.id ?? null);
      setError(null);
    } catch (nextError) {
      handleDataError(nextError, "加载失败");
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
      handleDataError(nextError, "行业雷达加载失败");
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
      handleDataError(nextError, "Steam 趋势加载失败");
    } finally {
      setSteamLoading(false);
    }
  }

  async function loadDiagnostics(date?: string) {
    try {
      setDiagnosticsLoading(true);
      setDiagnostics(await fetchAutomationDiagnostics(date));
      try {
        setSourcingLearning(await fetchSourcingLearning());
      } catch {
        setSourcingLearning(null);
      }
      setError(null);
    } catch (nextError) {
      handleDataError(nextError, "自动化诊断加载失败");
    } finally {
      setDiagnosticsLoading(false);
    }
  }

  function handleDataError(nextError: unknown, fallback: string) {
    const message = nextError instanceof Error ? nextError.message : fallback;
    if (isAuthError(message)) {
      clearAccessToken();
      setIsAuthenticated(false);
      setLoginError("登录已失效，请重新输入账号和密码。");
    }
    setError(message);
  }

  async function handleLogin(username: string, password: string) {
    try {
      setLoginPending(true);
      setLoginError(null);
      const result = await loginToCrm({ username, password });
      setDisplayName(result.display_name || result.username || username.trim());
      setError(null);
      setStatus(null);
      setIsAuthenticated(true);
    } catch (nextError) {
      setLoginError(nextError instanceof Error ? nextError.message : "登录失败");
    } finally {
      setLoginPending(false);
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
    if (view === "leads") void reload("force");
    if (view === "assistant") void reload(false);
    if (view === "radar") void loadRadar();
    if (view === "steam") void loadSteamTrends();
    if (view === "diagnostics") void loadDiagnostics();
  }

  function downloadExcel() {
    const password = window.prompt("请输入 Excel 导出密码");
    if (!password?.trim()) return;
    window.location.assign(excelExportUrl(password.trim()));
  }

  function logout() {
    clearAccessToken();
    setDisplayName("");
    setIsAuthenticated(false);
    setLoginError(null);
    setLeads([]);
    setSelectedId(null);
    setRadar(null);
    setSteamTrends(null);
    setDiagnostics(null);
    setStatus(null);
    setLoading(false);
    setRadarLoading(false);
    setSteamLoading(false);
    setDiagnosticsLoading(false);
    setView("leads");
    setError(null);
  }

  if (!isAuthenticated) {
    return <LoginPage error={loginError} loading={loginPending} onLogin={handleLogin} />;
  }

  const dailyQuote = getDailyPhilosophyQuote();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="hero-copy">
          <span className="brand-mark"><img src={bilibiliLogo} alt="bilibili" /></span>
          <p className="eyebrow" data-brand-label={productVersionLabel}>Neo's BD Matrix · {productVersion}</p>
          <h1>BD 决策工作台</h1>
          <p className="hero-subtitle">{dailyQuote}</p>
        </div>
        <div className="actions">
          <div className="nav-group">
            <button className={`tab-button ${view === "leads" ? "active" : ""}`} onClick={() => setView("leads")}><ListChecks size={16} />Leads Review</button>
            <button className={`tab-button ${view === "assistant" ? "active" : ""}`} onClick={() => setView("assistant")}><Bot size={16} />线索助手</button>
            <button className={`tab-button ${view === "radar" ? "active" : ""}`} onClick={() => setView("radar")}><Newspaper size={16} />行业雷达</button>
            <button className={`tab-button ${view === "steam" ? "active" : ""}`} onClick={() => setView("steam")}><TrendingUp size={16} />Steam 趋势</button>
            <button className={`tab-button ${view === "diagnostics" ? "active" : ""}`} onClick={() => setView("diagnostics")}><Activity size={16} />自动化诊断</button>
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

      {view === "leads" ? <LeadsView
        leads={leads}
        filters={filters}
        setFilters={setFilters}
        stats={stats}
        loading={loading}
        filteredLeads={filteredLeads}
        selectedLead={selectedLead}
        setSelectedId={setSelectedId}
        displayName={displayName}
        handleLeadPatch={handleLeadPatch}
        moveBucket={moveBucket}
      /> : view === "assistant" ? <AssistantPage onImported={() => reload(false)} onStatus={setStatus} /> : view === "radar" ? <RadarPage radar={radar} loading={radarLoading} onDateChange={(date) => void loadRadar(date)} /> : view === "steam" ? <SteamTrendsPage report={steamTrends} loading={steamLoading} onDateChange={(date) => void loadSteamTrends(date)} /> : view === "diagnostics" ? <AutomationDiagnosticsPage diagnostics={diagnostics} loading={diagnosticsLoading} onDateChange={(date) => void loadDiagnostics(date)} sourcingLearning={sourcingLearning} /> : <SettingsPage onStatus={setStatus} />}
    </main>
  );
}

function isAuthError(message: string | null) {
  return Boolean(message && (message.includes("CRM login required") || message.includes("CRM access token required")));
}

function LeadsView({ leads, filters, setFilters, stats, loading, filteredLeads, selectedLead, setSelectedId, displayName, handleLeadPatch, moveBucket }: {
  leads: Lead[];
  filters: Filters;
  setFilters: (filters: Filters) => void;
  stats: DashboardStats;
  loading: boolean;
  filteredLeads: Lead[];
  selectedLead: Lead | null;
  setSelectedId: (id: string | null) => void;
  displayName: string;
  handleLeadPatch: (id: string, patch: Partial<Lead>) => Promise<void>;
  moveBucket: (lead: Lead, bucket: Bucket) => Promise<void>;
}) {
  const triage = useMemo(() => buildDecisionTriage(leads), [leads]);
  const bucketNavigation = useMemo(() => buildBucketNavigation(leads), [leads]);
  const actionLane = triage.lanes.find((lane) => lane.key === "action");
  const greeting = getDashboardGreeting(displayName);
  const todayLabel = formatShanghaiLongDate();
  const focusLabel = activeFilterLabel(filters);

  function applyTriageFilter(patch: Partial<Filters> | TriageFilter) {
    setFilters({ ...emptyFilters, ...patch });
    setSelectedId(null);
  }

  return <>
    <section className="dashboard-head">
      <div className="dashboard-copy">
        <p className="eyebrow">工作台</p>
        <h2>{greeting.title}</h2>
        <div className="dashboard-context">
          <span>{todayLabel}</span>
          <span>当前聚焦：{focusLabel}</span>
          <span>{greeting.note}</span>
        </div>
      </div>
      <div className="dashboard-head-meta">
        <span>{filteredLeads.length} / {stats.total} 条记录</span>
        <span>{actionLane?.count ?? 0} 个需要动作</span>
      </div>
    </section>

    <section className="metric-strip bucket-nav" aria-label="池子导航">
      {bucketNavigation.map((item) => (
        <button
          className={`metric bucket-nav-card metric-${bucketNavigationToneClass(item.tone)} ${isBucketNavigationActive(filters, item) ? "active" : ""}`}
          key={item.key}
          onClick={() => applyTriageFilter(item.filter)}
          type="button"
        >
          <span>{item.label}</span>
          <strong>{item.count}</strong>
        </button>
      ))}
    </section>

    <section className="decision-board supporting-triage" aria-label="辅助复核视角">
      {triage.lanes.map((lane) => (
        <article className={`decision-lane decision-lane-${lane.key}`} key={lane.key}>
          <div className="decision-lane-head">
            <div>
              <p className="eyebrow">{lane.kicker}</p>
              <h3>{lane.title}</h3>
            </div>
            <button className="lane-count" type="button" onClick={() => applyTriageFilter(lane.filter)}>{lane.count}</button>
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

    <section className="filters">
      <label className="search-box"><Search size={16} /><input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="项目 / 团队 / 联系方式 / 推荐理由" /></label>
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
            <col className="lead-col-evidence" />
            <col className="lead-col-reason" />
            <col className="lead-col-progress" />
            <col className="lead-col-actions" />
          </colgroup>
          <thead><tr><th>项目</th><th>证据</th><th>推荐理由</th><th>进度 / 发行</th><th>处理</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="empty-cell">加载中</td></tr> : filteredLeads.map((lead) => (
              <tr key={lead.id} className={`${lead.id === selectedLead?.id ? "selected-row" : ""} ${lead.review_status === "未处理" ? "unread-row" : ""} priority-${priorityTone(lead.priority)} ${isTestingOverdue(lead) ? "testing-overdue-row" : ""}`} onClick={() => setSelectedId(lead.id)}>
                <td><div className="project-cell"><span className={`bucket-dot ${bucketClass(lead.bucket)}`} /><div><strong>{isTestingOverdue(lead) && <span className="overdue-marker" title="测试已超过两周未更新"><AlertTriangle size={14} /></span>}{lead.project}</strong><small><span className={`priority-pill priority-${priorityTone(lead.priority)}`}>{priorityLabel(lead.priority)}</span> · {lead.bucket} · {lead.review_status}</small></div></div></td>
                <td><EvidenceChips lead={lead} /></td>
                <td><strong>{lead.priority_reason ?? "待判断"}</strong><small className="subline">{[lead.genre, lead.gameplay].filter(Boolean).join(" · ") || lead.bilibili_fit || "玩法待补充"}</small></td>
                <td className="lead-progress-cell">{lead.progress}<small className="subline">{lead.publisher_status}</small><ContactChips contacts={lead.contact_methods} links={lead.links} /></td>
                <td className="lead-action-cell"><QuickActions lead={lead} onPatch={handleLeadPatch} compact missingLinksMode={filters.missingLinks} /></td>
              </tr>
            ))}
            {!loading && !filteredLeads.length && <tr><td colSpan={5} className="empty-cell">无匹配 leads</td></tr>}
          </tbody>
        </table>
      </div>
      <LeadDetail lead={selectedLead} onPatch={handleLeadPatch} onMove={moveBucket} missingLinksMode={filters.missingLinks} />
    </section>
  </>;
}

function activeFilterLabel(filters: Filters) {
  if (filters.needsAction) return "需要动作";
  if (filters.evidenceIssues) return "证据不足复核";
  if (filters.missingLinks) return "缺链接补全";
  if (filters.reviewStatus !== "全部") return filters.reviewStatus;
  if (filters.bucket !== "全部") return filters.bucket;
  if (filters.query) return "搜索结果";
  return "Leads Review";
}

function isBucketNavigationActive(filters: Filters, item: BucketNavigationItem) {
  if (item.filter.missingLinks) return filters.missingLinks;
  return Boolean(item.filter.bucket && filters.bucket === item.filter.bucket && !filters.evidenceIssues && !filters.needsAction && !filters.missingLinks);
}

function bucketNavigationToneClass(tone: BucketNavigationItem["tone"]) {
  if (tone === "unread") return "purple";
  if (tone === "evaluation") return "amber";
  if (tone === "testing") return "cyan";
  if (tone === "watch") return "blue";
  if (tone === "follow") return "green";
  if (tone === "push") return "blue";
  if (tone === "drop") return "red";
  return "neutral";
}

function getDashboardGreeting(displayName: string, date = new Date()) {
  const name = displayName.trim() || "Neo";
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  }).format(date));

  if (hour < 6) return { title: `早点休息，${name}`, note: "现在是北京时间深夜，先保留精力。" };
  if (hour < 12) return { title: `早上好，${name}`, note: "先处理最需要判断的新线索。" };
  if (hour < 18) return { title: `下午好，${name}`, note: "适合推进评测、补证据和确认下一步。" };
  return { title: `晚上好，${name}`, note: "收束今天的跟进，把明天要看的项目留清楚。" };
}

function formatShanghaiLongDate(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Shanghai",
    weekday: "long",
    year: "numeric"
  }).format(date);
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

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
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
      <button className="primary-button save-icon-button" type="button" onClick={save} aria-label="保存" title="保存"><Save size={18} /></button>
    </div>

    <QuickActions lead={draft} onPatch={onPatch} missingLinksMode={missingLinksMode} />
    <BucketButtons lead={draft} onMove={moveDraft} />

    <section className="review-command-card">
      <div className="review-command-summary">
        <div>
          <p className="eyebrow">评测结论</p>
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

    <LeadEvidencePanel lead={draft} />

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
      <h3>人工决策</h3>
      <div className="form-grid two">
        <Select label="池子" value={draft.bucket} options={bucketValues} onChange={(value) => setDraft((current) => (current ? { ...current, bucket: value, stage: stageFromBucket(value), ...reviewPatchForBucket(value) } : current))} />
        <Select label="阶段" value={draft.stage} options={stageValues} onChange={(value) => setField("stage", value)} />
        <Select label="优先级" value={draft.priority} options={priorityValues} onChange={(value) => setField("priority", value)} />
        <TextField label="Owner" value={draft.owner} onChange={(value) => setField("owner", value)} />
        <TextField label="Due Date" type="date" value={draft.due_date} onChange={(value) => setField("due_date", value || null)} />
        <TextField label="发售窗口" value={draft.release_window} onChange={(value) => setField("release_window", value)} />
        {(draft.bucket === "未处理" || draft.bucket === "淘汰池" || draft.drop_reason) ? <Select label="淘汰原因（若淘汰）" value={draft.drop_reason ?? "未选择"} options={dropReasonOptions} onChange={(value) => setField("drop_reason", value === "未选择" ? null : value)} /> : null}
        <div className="due-date-actions span-2">
          <button className="ghost-button" onClick={confirmCalendarReminder}><CalendarCheck size={16} />确认放入日历</button>
          {draft.calendar_enabled && draft.due_date ? <span>已在日历显示：{draft.due_date}</span> : <span>只有点确认后才会进入日历，避免页面被系统自动塞满。</span>}
        </div>
      </div>
      <TextareaField label="优先级高/低的原因" value={draft.priority_reason} onChange={(value) => setField("priority_reason", value)} />
      <TextareaField label="备注" value={draft.notes} onChange={(value) => setField("notes", value)} />
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
      <TextareaField label="风险" value={draft.risks} onChange={(value) => setField("risks", value)} />
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
    lead.priority_reason,
    lead.bilibili_fit,
    lead.next_action
  ], "还没有形成评审结论，先完成实机/运营测试；不成立就淘汰，成立后再补商务判断。");
}

function buildReviewEvidence(lead: Lead) {
  return [
    { label: "产品亮点", value: firstText([lead.priority_reason, lead.gameplay, lead.genre], "待补充玩法钩子、视觉或数据亮点。") },
    { label: "B站适配", value: firstText([lead.bilibili_fit], "待判断直播、切片、二创或 UP 主传播空间。") },
    { label: "商务可行", value: firstText([lead.publisher_status, `${lead.region_priority} · ${lead.release_window ?? "窗口待确认"}`], "待确认团队地区、发行空位和发售窗口。") },
    { label: "风险反证", value: firstText([lead.risks], "待补充为什么不该推进，避免只看亮点。") }
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
  if (lead.bucket === "待评测") return [testing, drop];
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

function EvidenceChips({ lead }: { lead: Lead }) {
  const chips = buildLeadEvidenceChips(lead).slice(0, 6);
  if (!chips.length) return <span className="muted">待复核</span>;
  return <div className="evidence-chip-list">{chips.map((chip) => (
    <span className={`evidence-chip evidence-${chip.tone}`} key={chip.label}>{chip.label}</span>
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
  return /(?:store\.steampowered\.com|steamdb\.info)\/app\/\d+|bilibili\.com|taptap\.cn|indienova\.com|gcores\.com|yystv\.cn|gamelook\.com\.cn|youxiputao\.com|gameres\.com|youxituoluo\.com|nadianshi\.com|youxichaguan\.com|chuapp\.com|gamersky\.com|3dmgame\.com/i.test(link);
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
