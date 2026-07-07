import { Activity, ArrowDownToLine, Bot, FileJson, FileSpreadsheet, ListChecks, LogOut, Menu, Newspaper, RefreshCw, Settings as SettingsIcon, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { clearAccessToken, excelExportUrl, fetchAutomationDiagnostics, fetchLeads, fetchRadar, fetchSourcingLearning, fetchSteamTrends, getAccessDisplayName, hasSavedCredentials, loginToCrm, syncLatestReport, updateLead } from "./api";
import { AssistantPage } from "./AssistantPage";
import type { AssistantResultReviewTarget } from "./assistantQuality";
import { AutomationDiagnosticsPage } from "./AutomationDiagnosticsPage";
import { LeadsView } from "./features/leads";
import type { LeadReviewTarget } from "./features/leads/leadReviewTarget";
import { RadarPage } from "./features/radar";
import { LoginPage } from "./LoginPage";
import { ManualLeadLauncher } from "./ManualLeadLauncher";
import { SettingsPage } from "./SettingsPage";
import { SteamTrendsPage } from "./SteamTrendsPage";
import bilibiliLogo from "./assets/bilibili-game-logo.png";
import { getDailyPhilosophyQuote } from "./dailyPhilosophyQuote";
import { productVersion, productVersionLabel } from "./productVersion";
import type { AutomationDiagnostics, Lead, RadarReport, SourcingLearningReport, SteamTrendReport } from "./types";

type View = "leads" | "assistant" | "radar" | "steam" | "diagnostics" | "settings";

const viewLabels: Record<View, string> = {
  leads: "Leads Review",
  assistant: "线索助手",
  radar: "行业雷达",
  steam: "Steam 趋势",
  diagnostics: "自动化诊断",
  settings: "设置"
};

export default function App() {
  const [view, setView] = useState<View>("leads");
  const reviewTargetRequestId = useRef(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(hasSavedCredentials());
  const [displayName, setDisplayName] = useState(getAccessDisplayName());
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [radar, setRadar] = useState<RadarReport | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [steamTrends, setSteamTrends] = useState<SteamTrendReport | null>(null);
  const [steamLoading, setSteamLoading] = useState(false);
  const [steamError, setSteamError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<AutomationDiagnostics | null>(null);
  const [sourcingLearning, setSourcingLearning] = useState<SourcingLearningReport | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [leadReviewTarget, setLeadReviewTarget] = useState<LeadReviewTarget | null>(null);

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
      setRadarError(null);
      setError(null);
    } catch (nextError) {
      setRadarError(errorMessage(nextError, "行业雷达加载失败"));
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
      setSteamError(null);
      setError(null);
    } catch (nextError) {
      setSteamError(errorMessage(nextError, "Steam 趋势加载失败"));
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
    const message = errorMessage(nextError, fallback);
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

  function switchView(nextView: View) {
    setView(nextView);
    setMobileNavOpen(false);
  }

  function handleAssistantReviewLead(target: AssistantResultReviewTarget) {
    reviewTargetRequestId.current += 1;
    setLeadReviewTarget({ ...target, requestId: reviewTargetRequestId.current });
    switchView("leads");
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
    setRadar(null);
    setRadarError(null);
    setSteamTrends(null);
    setSteamError(null);
    setDiagnostics(null);
    setStatus(null);
    setLoading(false);
    setRadarLoading(false);
    setSteamLoading(false);
    setDiagnosticsLoading(false);
    setView("leads");
    setMobileNavOpen(false);
    setError(null);
  }

  if (!isAuthenticated) {
    return <LoginPage error={loginError} loading={loginPending} onLogin={handleLogin} />;
  }

  const dailyQuote = getDailyPhilosophyQuote();

  return (
    <main className={`app-shell ${view === "leads" || view === "assistant" ? "has-manual-floating-action" : ""}`}>
      <header className="topbar">
        <div className="hero-copy">
          <span className="brand-mark"><img src={bilibiliLogo} alt="bilibili" /></span>
          <p className="eyebrow" data-brand-label={productVersionLabel}>Neo's BD Matrix · {productVersion}</p>
          <h1>BD 决策工作台</h1>
          <p className="hero-subtitle">{dailyQuote}</p>
        </div>
        <button
          className="mobile-menu-button"
          type="button"
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-nav-panel"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <Menu size={16} />{viewLabels[view]}
        </button>
        <div className="actions" id="mobile-nav-panel" data-mobile-open={mobileNavOpen}>
          <div className="nav-group">
            <button className={`tab-button ${view === "leads" ? "active" : ""}`} onClick={() => switchView("leads")}><ListChecks size={16} />Leads Review</button>
            <button className={`tab-button ${view === "assistant" ? "active" : ""}`} onClick={() => switchView("assistant")}><Bot size={16} />线索助手</button>
            <button className={`tab-button ${view === "radar" ? "active" : ""}`} onClick={() => switchView("radar")}><Newspaper size={16} />行业雷达</button>
            <button className={`tab-button ${view === "steam" ? "active" : ""}`} onClick={() => switchView("steam")}><TrendingUp size={16} />Steam 趋势</button>
            <button className={`tab-button ${view === "diagnostics" ? "active" : ""}`} onClick={() => switchView("diagnostics")}><Activity size={16} />自动化诊断</button>
            <button className={`tab-button ${view === "settings" ? "active" : ""}`} onClick={() => switchView("settings")}><SettingsIcon size={16} />设置</button>
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
        loading={loading}
        displayName={displayName}
        reviewTarget={leadReviewTarget}
        onLeadPatch={handleLeadPatch}
      /> : view === "assistant" ? <AssistantPage onImported={() => reload(false)} onReviewLead={handleAssistantReviewLead} onStatus={setStatus} /> : view === "radar" ? <RadarPage radar={radar} loading={radarLoading} error={radarError} onDateChange={(date) => void loadRadar(date)} /> : view === "steam" ? <SteamTrendsPage report={steamTrends} loading={steamLoading} error={steamError} onDateChange={(date) => void loadSteamTrends(date)} /> : view === "diagnostics" ? <AutomationDiagnosticsPage diagnostics={diagnostics} loading={diagnosticsLoading} onDateChange={(date) => void loadDiagnostics(date)} sourcingLearning={sourcingLearning} /> : <SettingsPage onStatus={setStatus} />}
      <ManualLeadLauncher visible={view === "leads" || view === "assistant"} />
    </main>
  );
}

function errorMessage(nextError: unknown, fallback: string) {
  return nextError instanceof Error ? nextError.message : fallback;
}

function isAuthError(message: string | null) {
  return Boolean(message && (message.includes("CRM login required") || message.includes("CRM access token required")));
}
