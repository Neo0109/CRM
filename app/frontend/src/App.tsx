import { ArrowDownToLine, Bot, CheckCircle2, ExternalLink, FileJson, FileSpreadsheet, ListChecks, Newspaper, Plus, RefreshCw, Save, Search, Settings as SettingsIcon, Trash2, TrendingUp, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { excelExportUrl, fetchLeads, fetchRadar, fetchSteamTrends, getAccessToken, saveAccessToken, syncLatestReport, updateLead } from "./api";
import { AssistantPage } from "./AssistantPage";
import { SettingsPage } from "./SettingsPage";
import { SteamTrendsPage } from "./SteamTrendsPage";
import type { Bucket, ContactMethod, ContactType, Lead, Priority, RadarCategory, RadarReport, Region, RegionPriority, ReviewStatus, Stage, SteamTrendReport } from "./types";

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

const version = "v1.2.6";
const emptyFilters: Filters = { query: "", bucket: "全部", region: "全部", stage: "全部", owner: "", city: "", releaseWindow: "", reviewStatus: "全部", missingLinks: false };
const bucketOptions: ("全部" | Bucket)[] = ["全部", "推进池", "跟进中", "观察池", "淘汰池"];
const bucketValues: Bucket[] = ["推进池", "跟进中", "观察池", "淘汰池"];
const stageOptions: ("全部" | Stage)[] = ["全部", "new", "watch", "active", "negotiating", "won", "rejected"];
const stageValues: Stage[] = ["new", "watch", "active", "negotiating", "won", "rejected"];
const priorityValues: Priority[] = ["P0", "P1", "P2", "P3"];
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
    unread: leads.filter((lead) => lead.review_status === "未处理").length,
    push: leads.filter((lead) => lead.bucket === "推进池").length,
    follow: leads.filter((lead) => lead.bucket === "跟进中").length,
    watch: leads.filter((lead) => lead.bucket === "观察池").length,
    drop: leads.filter((lead) => lead.bucket === "淘汰池").length,
    missingLinks: leads.filter((lead) => !gameLinks(lead.links).length).length
  }), [leads]);

  const filteredLeads = useMemo(() => leads.filter((lead) => {
    const contacts = visibleContacts(lead.contact_methods).map((method) => `${method.type} ${method.value} ${method.note ?? ""}`).join(" ");
    const haystack = [lead.project, lead.team, lead.genre, lead.gameplay, lead.progress, lead.publisher_status, lead.priority_reason, lead.rule_fit, lead.next_action, lead.notes, lead.country, lead.city, contacts]
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
    const missingLinkMatch = !filters.missingLinks || !gameLinks(lead.links).length;
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

  async function loadRadar() {
    try {
      setRadarLoading(true);
      setRadar(await fetchRadar());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "行业雷达加载失败");
    } finally {
      setRadarLoading(false);
    }
  }

  async function loadSteamTrends() {
    try {
      setSteamLoading(true);
      const report = await fetchSteamTrends();
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="hero-copy">
          <span className="brand-mark">B</span>
          <p className="eyebrow">B站游戏发行 BD · {version}</p>
          <h1>Sourcing CRM</h1>
          <p className="hero-subtitle">把 Steam 信号、B站内容适配和发行跟进收束到一个 review 工作台。</p>
        </div>
        <div className="actions">
          <button className={`tab-button ${view === "leads" ? "active" : ""}`} onClick={() => setView("leads")}><ListChecks size={16} />Leads Review</button>
          <button className={`tab-button ${view === "assistant" ? "active" : ""}`} onClick={() => setView("assistant")}><Bot size={16} />线索助手</button>
          <button className={`tab-button ${view === "radar" ? "active" : ""}`} onClick={() => setView("radar")}><Newspaper size={16} />行业雷达</button>
          <button className={`tab-button ${view === "steam" ? "active" : ""}`} onClick={() => setView("steam")}><TrendingUp size={16} />Steam 趋势</button>
          <button className={`tab-button ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}><SettingsIcon size={16} />设置</button>
          <button className="ghost-button" onClick={refreshCurrentView}><RefreshCw size={16} />刷新</button>
          <button className="ghost-button" onClick={downloadExcel}><FileSpreadsheet size={16} />Excel</button>
          <a className="ghost-button" href="/api/export/json"><FileJson size={16} />JSON</a>
          <a className="ghost-button" href="/api/export/csv"><ArrowDownToLine size={16} />CSV</a>
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
        filters={filters}
        setFilters={setFilters}
        stats={stats}
        loading={loading}
        filteredLeads={filteredLeads}
        selectedLead={selectedLead}
        setSelectedId={setSelectedId}
        handleLeadPatch={handleLeadPatch}
        moveBucket={moveBucket}
      /> : view === "assistant" ? <AssistantPage onImported={() => reload(false)} onStatus={setStatus} /> : view === "radar" ? <RadarPage radar={radar} loading={radarLoading} /> : view === "steam" ? <SteamTrendsPage report={steamTrends} loading={steamLoading} /> : <SettingsPage onStatus={setStatus} onTokenChanged={setTokenDraft} />}
    </main>
  );
}

function LeadsView({ filters, setFilters, stats, loading, filteredLeads, selectedLead, setSelectedId, handleLeadPatch, moveBucket }: {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  stats: { unread: number; push: number; follow: number; watch: number; drop: number; missingLinks: number };
  loading: boolean;
  filteredLeads: Lead[];
  selectedLead: Lead | null;
  setSelectedId: (id: string | null) => void;
  handleLeadPatch: (id: string, patch: Partial<Lead>) => Promise<void>;
  moveBucket: (lead: Lead, bucket: Bucket) => Promise<void>;
}) {
  function applyMetricFilter(patch: Partial<Filters>) {
    setFilters({ ...emptyFilters, ...patch });
    setSelectedId(null);
  }

  return <>
    <section className="metric-strip">
      <Metric label="未处理" value={stats.unread} tone="purple" active={filters.reviewStatus === "未处理"} onClick={() => applyMetricFilter({ reviewStatus: "未处理" })} />
      <Metric label="推进池" value={stats.push} tone="green" active={filters.bucket === "推进池"} onClick={() => applyMetricFilter({ bucket: "推进池" })} />
      <Metric label="跟进中" value={stats.follow} tone="cyan" active={filters.bucket === "跟进中"} onClick={() => applyMetricFilter({ bucket: "跟进中" })} />
      <Metric label="观察池" value={stats.watch} tone="amber" active={filters.bucket === "观察池"} onClick={() => applyMetricFilter({ bucket: "观察池" })} />
      <Metric label="淘汰池" value={stats.drop} tone="red" active={filters.bucket === "淘汰池"} onClick={() => applyMetricFilter({ bucket: "淘汰池" })} />
      <Metric label="缺链接" value={stats.missingLinks} tone="blue" active={filters.missingLinks} onClick={() => applyMetricFilter({ missingLinks: true })} />
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
            <col className="lead-col-links" />
            <col className="lead-col-actions" />
          </colgroup>
          <thead><tr><th>项目</th><th>地区</th><th>联系方式</th><th>推荐理由 / 规则</th><th>进度 / 发行</th><th>备注</th><th>链接</th><th>处理</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="empty-cell">加载中</td></tr> : filteredLeads.map((lead) => (
              <tr key={lead.id} className={`${lead.id === selectedLead?.id ? "selected-row" : ""} ${lead.review_status === "未处理" ? "unread-row" : ""}`} onClick={() => setSelectedId(lead.id)}>
                <td><div className="project-cell"><span className={`bucket-dot ${bucketClass(lead.bucket)}`} /><div><strong>{lead.project}</strong><small>{lead.priority} · {lead.bucket} · {lead.review_status}</small></div></div></td>
                <td><strong>{lead.region}</strong><small className="subline">{[lead.country, lead.city].filter(Boolean).join(" · ") || "待补充"}</small></td>
                <td><ContactChips contacts={lead.contact_methods} /></td>
                <td><strong>{lead.priority_reason ?? "待补充"}</strong><small className="subline">{lead.rule_fit ?? "待复核"}</small></td>
                <td>{lead.progress}<small className="subline">{lead.publisher_status}</small></td>
                <td>{lead.notes ?? ""}</td>
                <td><LinkList links={lead.links} /></td>
                <td><QuickActions lead={lead} onPatch={handleLeadPatch} compact /></td>
              </tr>
            ))}
            {!loading && !filteredLeads.length && <tr><td colSpan={8} className="empty-cell">无匹配 leads</td></tr>}
          </tbody>
        </table>
      </div>
      <LeadDetail lead={selectedLead} onPatch={handleLeadPatch} onMove={moveBucket} />
    </section>
  </>;
}

function Metric({ label, value, tone, active, onClick }: { label: string; value: number; tone: "neutral" | "green" | "amber" | "red" | "blue" | "cyan" | "purple"; active?: boolean; onClick?: () => void }) {
  return <button className={`metric metric-${tone} ${active ? "active" : ""}`} onClick={onClick} type="button" aria-pressed={active}><span>{label}</span><strong>{value}</strong></button>;
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (value: T) => void }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function LeadDetail({ lead, onPatch, onMove }: { lead: Lead | null; onPatch: (id: string, patch: Partial<Lead>) => Promise<void>; onMove: (lead: Lead, bucket: Bucket) => Promise<void> }) {
  const [draft, setDraft] = useState<Lead | null>(null);

  useEffect(() => {
    if (lead) setDraft({ ...lead, contact_methods: [...lead.contact_methods], links: [...lead.links] });
  }, [lead]);

  if (!lead || !draft) return <aside className="detail-panel"><div className="empty-cell">暂无 lead</div></aside>;

  function setField<K extends keyof Lead>(key: K, value: Lead[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  const addContact = () => setField("contact_methods", [...draft.contact_methods, { type: "微信/QQ", value: "", note: null }]);
  const updateContact = (index: number, patch: Partial<ContactMethod>) => setField("contact_methods", draft.contact_methods.map((method, methodIndex) => methodIndex === index ? { ...method, ...patch } : method));
  const removeContact = (index: number) => setField("contact_methods", draft.contact_methods.filter((_, methodIndex) => methodIndex !== index));
  const moveDraft = async (nextLead: Lead, bucket: Bucket) => {
    const patch = { bucket, stage: stageFromBucket(bucket), ...reviewPatchForBucket(bucket) };
    setDraft({ ...nextLead, ...patch });
    await onMove(nextLead, bucket);
  };
  const save = () => onPatch(lead.id, draft);

  return <aside className="detail-panel">
    <div className="detail-head">
      <div><p className="eyebrow">{draft.bucket} · {draft.priority} · {draft.review_status}</p><h2>{draft.project}</h2></div>
      <button className="primary-button" onClick={save}><Save size={16} />保存</button>
    </div>

    <QuickActions lead={draft} onPatch={onPatch} />
    <BucketButtons lead={draft} onMove={moveDraft} />

    <div className="signal-grid three">
      <Signal label="推荐理由" value={draft.priority_reason ?? "待补充"} />
      <Signal label="规则判断" value={draft.rule_fit ?? "待复核"} />
      <Signal label="B站适配" value={draft.bilibili_fit} />
    </div>

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
      </div>
      <TextareaField label="优先级高/低的原因" value={draft.priority_reason} onChange={(value) => setField("priority_reason", value)} />
      <TextareaField label="是否符合规则" value={draft.rule_fit} onChange={(value) => setField("rule_fit", value)} />
      <TextareaField label="下一步动作" value={draft.next_action} onChange={(value) => setField("next_action", value)} />
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

function QuickActions({ lead, onPatch, compact = false }: { lead: Lead; onPatch: (id: string, patch: Partial<Lead>) => Promise<void>; compact?: boolean }) {
  return <div className={compact ? "quick-actions compact" : "quick-actions"} onClick={(event) => event.stopPropagation()}>
    <button className="quick-button follow" title="移入跟进" aria-label="移入跟进" onClick={() => void onPatch(lead.id, { bucket: "跟进中", stage: "active", review_status: "跟进中", reviewed_at: new Date().toISOString() })}><CheckCircle2 size={15} /><span className={compact ? "visually-hidden" : ""}>跟进</span></button>
    <button className="quick-button drop" title="移入淘汰池" aria-label="移入淘汰池" onClick={() => void onPatch(lead.id, { bucket: "淘汰池", stage: "rejected", review_status: "已淘汰", reviewed_at: new Date().toISOString() })}><XCircle size={15} /><span className={compact ? "visually-hidden" : ""}>淘汰</span></button>
    {!compact && <button className="quick-button seen" onClick={() => void onPatch(lead.id, { review_status: "已查看", reviewed_at: new Date().toISOString() })}>已看</button>}
  </div>;
}

function BucketButtons({ lead, onMove, compact = false }: { lead: Lead; onMove: (lead: Lead, bucket: Bucket) => Promise<void>; compact?: boolean }) {
  return <div className={compact ? "bucket-actions compact" : "bucket-actions"} onClick={(event) => event.stopPropagation()}>
    {bucketValues.map((bucket) => <button key={bucket} className={`bucket-button ${bucketClass(bucket)} ${lead.bucket === bucket ? "active" : ""}`} onClick={() => void onMove(lead, bucket)} disabled={lead.bucket === bucket}>{bucket}</button>)}
  </div>;
}

function ContactChips({ contacts }: { contacts: ContactMethod[] }) {
  const displayContacts = visibleContacts(contacts).slice(0, 3);
  if (!displayContacts.length) return <span className="muted">待补充</span>;
  return <div className="chip-list">{displayContacts.map((method, index) => {
    const label = contactLabel(method);
    if (isHttpUrl(method.value)) {
      return <a className="chip contact-chip-link" key={`${method.value}-${index}`} href={method.value} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} title={`${method.type}: ${method.value}`}><span className="chip-label">{label}</span></a>;
    }
    return <span className="chip" key={`${method.value}-${index}`} title={`${method.type}: ${method.value}`}><span className="chip-label">{label}</span></span>;
  })}</div>;
}

function LinkList({ links }: { links: string[] }) {
  const displayLinks = gameLinks(links);
  if (!displayLinks.length) return <span className="missing-link">缺链接</span>;
  return <div className="link-list lead-link-list">{displayLinks.map((link, index) => <a key={`${link}-${index}`} href={link} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} title={link} aria-label={`打开 ${linkLabel(link)}`}><ExternalLink size={15} /><span className="visually-hidden">{linkLabel(link)}</span></a>)}</div>;
}

function RadarPage({ radar, loading }: { radar: RadarReport | null; loading: boolean }) {
  if (loading) return <section className="radar-shell"><div className="empty-cell">加载行业雷达中</div></section>;
  return <section className="radar-shell">
    <div className="radar-head"><div><p className="eyebrow">{radar?.report_date ?? "今日"}</p><h2>行业雷达</h2></div><p>{radar?.summary ?? "暂无雷达数据"}</p></div>
    {radarCategories.map((category) => {
      const items = radar?.items.filter((item) => item.category === category) ?? [];
      return <section className="radar-band" key={category}>
        <h3>{category}</h3>
        {items.length ? <div className="radar-grid">{items.map((item) => <article className="radar-card" key={item.id}>
          <div className="radar-card-head"><span className={`heat heat-${item.heat}`}>{item.heat}</span><strong>{item.title}</strong></div>
          <p>{item.summary}</p>
          <dl><div><dt>BD 相关</dt><dd>{item.relevance}</dd></div><div><dt>建议动作</dt><dd>{item.suggested_action}</dd></div></dl>
          <a href={item.link} target="_blank" rel="noreferrer"><ExternalLink size={14} />{item.source}</a>
        </article>)}</div> : <div className="radar-empty">等待今日自动化写入</div>}
      </section>;
    })}
  </section>;
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
  if (bucket === "跟进中") return { review_status: "跟进中", reviewed_at: new Date().toISOString() };
  if (bucket === "淘汰池") return { review_status: "已淘汰", reviewed_at: new Date().toISOString() };
  return { review_status: "已查看", reviewed_at: new Date().toISOString() };
}

function stageFromBucket(bucket: Bucket): Stage {
  if (bucket === "推进池" || bucket === "跟进中") return "active";
  if (bucket === "淘汰池") return "rejected";
  return "watch";
}

function bucketClass(bucket: Bucket) {
  if (bucket === "推进池") return "push";
  if (bucket === "跟进中") return "follow";
  if (bucket === "淘汰池") return "drop";
  return "watch";
}

function visibleContacts(contacts: ContactMethod[]) {
  return contacts.filter((method) => !isGameLink(method.value));
}

function gameLinks(links: string[]) {
  return links.filter(isGameLink).slice(0, 2);
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
  if (!isHttpUrl(value)) return `${method.type}: ${value}`;
  if (/steam(?:powered|community)|steamdb/i.test(value) || method.type === "Steam") return "Steam";
  if (method.type === "官网") return `官网: ${linkLabel(value)}`;
  return `${method.type}: ${linkLabel(value)}`;
}

function linkLabel(link: string) {
  if (link.includes("store.steampowered.com")) return "Steam";
  if (link.includes("steamdb.info")) return "SteamDB";
  if (link.includes("steamcommunity.com")) return "Steam 社区";
  if (link.includes("bilibili.com")) return "B站";
  try { return new URL(link).hostname.replace("www.", ""); } catch { return "链接"; }
}
