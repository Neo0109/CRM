import { ArrowDownToLine, FileJson, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchLeads, getAccessToken, importJson, saveAccessToken, updateLead } from "./api";
import type { Bucket, Lead, Stage } from "./types";

type Filters = {
  query: string;
  bucket: "全部" | Bucket;
  region: "全部" | "国内" | "海外";
  stage: "全部" | Stage;
  owner: string;
  releaseWindow: string;
};

const emptyFilters: Filters = {
  query: "",
  bucket: "全部",
  region: "全部",
  stage: "全部",
  owner: "",
  releaseWindow: ""
};

const bucketOptions: Filters["bucket"][] = ["全部", "推进池", "观察池", "淘汰池"];
const stageOptions: Filters["stage"][] = ["全部", "new", "watch", "active", "negotiating", "won", "rejected"];

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenDraft, setTokenDraft] = useState(getAccessToken());

  useEffect(() => {
    void reload();
  }, []);

  const stats = useMemo(() => ({
    total: leads.length,
    push: leads.filter((lead) => lead.bucket === "推进池").length,
    watch: leads.filter((lead) => lead.bucket === "观察池").length,
    drop: leads.filter((lead) => lead.bucket === "淘汰池").length
  }), [leads]);

  const filteredLeads = useMemo(() => leads.filter((lead) => {
    const haystack = [lead.project, lead.team, lead.genre, lead.gameplay, lead.progress, lead.publisher_status, lead.public_signals, lead.next_action, lead.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const queryMatch = !filters.query || haystack.includes(filters.query.toLowerCase());
    const bucketMatch = filters.bucket === "全部" || lead.bucket === filters.bucket;
    const regionMatch = filters.region === "全部" || (filters.region === "国内" ? isDomestic(lead.country) : !isDomestic(lead.country));
    const stageMatch = filters.stage === "全部" || lead.stage === filters.stage;
    const ownerMatch = !filters.owner || (lead.owner ?? "").toLowerCase().includes(filters.owner.toLowerCase());
    const releaseMatch = !filters.releaseWindow || (lead.release_window ?? "").toLowerCase().includes(filters.releaseWindow.toLowerCase());
    return queryMatch && bucketMatch && regionMatch && stageMatch && ownerMatch && releaseMatch;
  }), [filters, leads]);

  const selectedLead = useMemo(() => leads.find((lead) => lead.id === selectedId) ?? filteredLeads[0] ?? null, [filteredLeads, leads, selectedId]);

  async function reload() {
    try {
      setLoading(true);
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

  async function handleImport() {
    try {
      const result = await importJson(JSON.parse(importText));
      setStatus(`新增 ${result.created}，更新 ${result.updated}，淘汰 ${result.dropped}，当前总计 ${result.total}`);
      setImportText("");
      setImportOpen(false);
      await reload();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "导入失败");
    }
  }

  async function handleLeadPatch(id: string, patch: Partial<Lead>) {
    const updated = await updateLead(id, patch);
    setLeads((current) => current.map((lead) => (lead.id === id ? updated : lead)));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">B站游戏发行 BD</p>
          <h1>Sourcing CRM</h1>
        </div>
        <div className="actions">
          <button className="ghost-button" onClick={() => setImportOpen((open) => !open)}><Upload size={16} />导入 JSON</button>
          <a className="ghost-button" href="/api/export/json"><FileJson size={16} />JSON</a>
          <a className="ghost-button" href="/api/export/csv"><ArrowDownToLine size={16} />CSV</a>
        </div>
      </header>

      <section className="metric-strip">
        <Metric label="全部" value={stats.total} tone="neutral" />
        <Metric label="推进池" value={stats.push} tone="green" />
        <Metric label="观察池" value={stats.watch} tone="amber" />
        <Metric label="淘汰池" value={stats.drop} tone="red" />
      </section>

      {importOpen && <section className="import-panel">
        <strong>JSON 导入</strong>
        <textarea value={importText} onChange={(event) => setImportText(event.target.value)} spellCheck={false} placeholder='{"report_date":"2026-05-18","summary":"...","insights":[],"push_pool":[],"watch_pool":[],"drop_pool":[]}' />
        <button className="primary-button" onClick={handleImport} disabled={!importText.trim()}>导入</button>
      </section>}

      {status && <div className="notice">{status}</div>}
      {error && <div className="notice error">{error}</div>}
      {error?.includes("CRM access token") && <section className="token-panel">
        <strong>输入 CRM 访问口令</strong>
        <input type="password" value={tokenDraft} onChange={(event) => setTokenDraft(event.target.value)} placeholder="CRM_ACCESS_TOKEN" />
        <button className="primary-button" onClick={() => { saveAccessToken(tokenDraft); void reload(); }}>进入</button>
      </section>}

      <section className="filters">
        <label className="search-box"><Search size={16} /><input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="项目 / 团队 / 类型 / 关键词" /></label>
        <Select label="池子" value={filters.bucket} options={bucketOptions} onChange={(bucket) => setFilters({ ...filters, bucket })} />
        <Select label="区域" value={filters.region} options={["全部", "国内", "海外"]} onChange={(region) => setFilters({ ...filters, region })} />
        <Select label="阶段" value={filters.stage} options={stageOptions} onChange={(stage) => setFilters({ ...filters, stage })} />
        <label><span>Owner</span><input value={filters.owner} onChange={(event) => setFilters({ ...filters, owner: event.target.value })} /></label>
        <label><span>窗口</span><input value={filters.releaseWindow} onChange={(event) => setFilters({ ...filters, releaseWindow: event.target.value })} /></label>
        <button className="ghost-button" onClick={() => setFilters(emptyFilters)}>清空</button>
      </section>

      <section className="workspace">
        <div className="lead-table-wrap">
          <table className="lead-table">
            <thead><tr><th>项目</th><th>团队</th><th>类型</th><th>进度</th><th>发行结构</th><th>公开信号</th><th>下一步</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="empty-cell">加载中</td></tr> : filteredLeads.map((lead) => (
                <tr key={lead.id} className={lead.id === selectedLead?.id ? "selected-row" : ""} onClick={() => setSelectedId(lead.id)}>
                  <td><div className="project-cell"><span className={`bucket-dot ${bucketClass(lead.bucket)}`} /><div><strong>{lead.project}</strong><small>{lead.country} · {lead.priority} · {lead.stage}</small></div></div></td>
                  <td>{lead.team ?? "待补充"}</td>
                  <td>{lead.genre ?? "待补充"}</td>
                  <td>{lead.progress}</td>
                  <td>{lead.publisher_status}</td>
                  <td>{lead.public_signals ?? lead.traction_summary ?? "待补充"}</td>
                  <td>{lead.next_action ?? "待定"}</td>
                </tr>
              ))}
              {!loading && !filteredLeads.length && <tr><td colSpan={7} className="empty-cell">无匹配 leads</td></tr>}
            </tbody>
          </table>
        </div>
        <LeadDetail lead={selectedLead} onPatch={handleLeadPatch} />
      </section>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "neutral" | "green" | "amber" | "red" }) {
  return <div className={`metric metric-${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (value: T) => void }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function LeadDetail({ lead, onPatch }: { lead: Lead | null; onPatch: (id: string, patch: Partial<Lead>) => Promise<void> }) {
  const [draft, setDraft] = useState<Pick<Lead, "owner" | "due_date" | "next_action" | "notes">>({ owner: null, due_date: null, next_action: null, notes: null });

  useEffect(() => {
    if (lead) setDraft({ owner: lead.owner, due_date: lead.due_date, next_action: lead.next_action, notes: lead.notes });
  }, [lead]);

  if (!lead) return <aside className="detail-panel"><div className="empty-cell">暂无 lead</div></aside>;

  return <aside className="detail-panel">
    <div className="detail-head"><div><p className="eyebrow">{lead.bucket}</p><h2>{lead.project}</h2></div><span className={`badge ${bucketClass(lead.bucket)}`}>{lead.bucket}</span></div>
    <div className="signal-grid">
      <Signal label="B站适配度" value={lead.bilibili_fit} />
      <Signal label="放大作用" value={lead.amplification} />
      <Signal label="风险" value={lead.risks ?? "待补充"} />
    </div>
    <dl className="detail-list">
      <Info label="团队 / 国家" value={`${lead.team ?? "待补充"} · ${lead.country}`} />
      <Info label="玩法 / 类型" value={lead.gameplay ?? lead.genre ?? "待补充"} />
      <Info label="进度 / 窗口" value={`${lead.progress} · ${lead.release_window ?? "待补充"}`} />
      <Info label="发行结构" value={`${lead.publisher_status}${lead.china_capability_occupied ? " · 中国能力已占位" : ""}`} />
      <Info label="公开信号" value={lead.public_signals ?? lead.traction_summary ?? "待补充"} />
      <Info label="曝光轨迹" value={lead.exposure_trail ?? "待补充"} />
      <Info label="结论" value={lead.verdict} />
    </dl>
    <div className="edit-stack">
      <label>Owner<input value={draft.owner ?? ""} onChange={(event) => setDraft({ ...draft, owner: event.target.value || null })} /></label>
      <label>Due Date<input type="date" value={draft.due_date ?? ""} onChange={(event) => setDraft({ ...draft, due_date: event.target.value || null })} /></label>
      <label>下一步动作<textarea value={draft.next_action ?? ""} onChange={(event) => setDraft({ ...draft, next_action: event.target.value || null })} /></label>
      <label>Notes<textarea value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value || null })} /></label>
      <button className="primary-button" onClick={() => onPatch(lead.id, draft)}>保存</button>
    </div>
  </aside>;
}

function Signal({ label, value }: { label: string; value: string }) {
  return <div className="signal"><small>{label}</small><strong>{value}</strong></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function bucketClass(bucket: Bucket) {
  if (bucket === "推进池") return "push";
  if (bucket === "淘汰池") return "drop";
  return "watch";
}

function isDomestic(country: string) {
  return ["中国", "大陆", "香港", "台湾", "澳门"].some((token) => country.includes(token));
}
