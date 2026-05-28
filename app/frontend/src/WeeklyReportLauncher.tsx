import { BarChart3, ExternalLink, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fetchWeeklyReport } from "./api";
import type { WeeklyLeadSummary, WeeklyReport } from "./types";

export function WeeklyReportLauncher() {
  const [host, setHost] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const updateHost = () => setHost(document.querySelector(".actions"));
    updateHost();
    const observer = new MutationObserver(updateHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const button = <button className={`tab-button ${open ? "active" : ""}`} onClick={() => setOpen(true)} type="button"><BarChart3 size={16} />周报</button>;

  return <>
    {host ? createPortal(button, host) : <div className="weekly-fallback-entry">{button}</div>}
    {open && createPortal(<WeeklyReportWorkspace onClose={() => setOpen(false)} />, document.body)}
  </>;
}

function WeeklyReportWorkspace({ onClose }: { onClose: () => void }) {
  const [anchorDate, setAnchorDate] = useState(todayKey());
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void reload(anchorDate);
  }, [anchorDate]);

  async function reload(date = anchorDate) {
    try {
      setLoading(true);
      setReport(await fetchWeeklyReport(date));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "周报加载失败");
    } finally {
      setLoading(false);
    }
  }

  return <div className="weekly-overlay" role="dialog" aria-modal="true" aria-label="CRM 周报">
    <section className="weekly-workspace">
      <header className="weekly-head">
        <div>
          <p className="eyebrow">WEEKLY REPORT · NO OPENAI API</p>
          <h2>本周 Sourcing 周报</h2>
          <p>从 CRM 已有字段自动计算，不调用 OpenAI：统计本周 sourcing、提测、淘汰、进入跟进和当前正在跟进的产品。</p>
        </div>
        <div className="weekly-head-actions">
          <label className="weekly-date-picker"><span>选择周内任意一天</span><input type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value || todayKey())} /></label>
          <button className="ghost-button" onClick={() => void reload()} disabled={loading}><RefreshCw size={16} />刷新</button>
          <button className="icon-button" onClick={onClose} aria-label="关闭周报"><X size={18} /></button>
        </div>
      </header>

      {error && <div className="notice error">{error}</div>}
      {loading && <div className="weekly-empty">正在生成周报</div>}

      {report && !loading && <>
        <section className="weekly-summary-band">
          <div>
            <p className="eyebrow">{report.week_start} - {report.week_end}</p>
            <h3>{report.summary}</h3>
            <small>{report.method}</small>
          </div>
        </section>

        <section className="weekly-metrics">
          <Metric label="本周 Sourcing" value={report.stats.sourced} tone="blue" />
          <Metric label="本周提测" value={report.stats.submitted_for_test} tone="amber" />
          <Metric label="测试中" value={report.stats.testing_pool} tone="cyan" />
          <Metric label="本周进跟进" value={report.stats.entered_follow_up} tone="green" />
          <Metric label="正在跟进" value={report.stats.active_following} tone="purple" />
          <Metric label="推进池" value={report.stats.push_pool} tone="green" />
          <Metric label="跟进中" value={report.stats.follow_pool} tone="purple" />
          <Metric label="淘汰" value={report.stats.dropped} tone="red" />
          <Metric label="未处理" value={report.stats.pending_review} tone="amber" />
        </section>

        <section className="weekly-section">
          <div className="weekly-section-head">
            <div><p className="eyebrow">ACTIVE FOLLOW-UP PRODUCTS</p><h3>正在跟进的产品</h3></div>
            <span>{report.follow_up_leads.length}</span>
          </div>
          {report.follow_up_leads.length ? <div className="weekly-card-grid">
            {report.follow_up_leads.map((lead) => <WeeklyLeadCard lead={lead} key={lead.id} />)}
          </div> : <div className="weekly-empty">当前还没有跟进中/推进池项目。</div>}
        </section>

        <section className="weekly-columns">
          <div className="weekly-section compact">
            <div className="weekly-section-head"><h3>本周淘汰</h3><span>{report.dropped_leads.length}</span></div>
            {report.dropped_leads.length ? <ul className="weekly-mini-list">{report.dropped_leads.map((lead) => <li key={lead.id}><strong>{lead.project}</strong><small>{lead.verdict || lead.rule_fit || "淘汰原因待补充"}</small></li>)}</ul> : <div className="weekly-empty">无淘汰记录。</div>}
          </div>
          <div className="weekly-section compact">
            <div className="weekly-section-head"><h3>本周新增池子分布</h3><span>{report.sourced_leads.length}</span></div>
            {report.sourced_leads.length ? <ul className="weekly-mini-list">{report.sourced_leads.slice(0, 12).map((lead) => <li key={lead.id}><strong>{lead.project}</strong><small>{lead.priority} · {lead.bucket} · {lead.region}</small></li>)}</ul> : <div className="weekly-empty">本周暂无新增。</div>}
          </div>
        </section>
      </>}
    </section>
  </div>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "neutral" | "green" | "amber" | "red" | "blue" | "cyan" | "purple" }) {
  return <div className={`weekly-metric weekly-metric-${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function WeeklyLeadCard({ lead }: { lead: WeeklyLeadSummary }) {
  return <article className="weekly-lead-card">
    <div className="weekly-lead-head">
      <div>
        <p className="eyebrow">{lead.bucket} · {lead.priority} · {lead.region}</p>
        <h3>{lead.project}</h3>
      </div>
      {lead.evaluation_grade && <span className={`weekly-grade grade-${lead.evaluation_grade.replace("+", "plus").replace("-", "minus")}`}>{lead.evaluation_grade}</span>}
      {lead.steam_store_url ? <a className="ghost-button" href={lead.steam_store_url} target="_blank" rel="noreferrer"><ExternalLink size={14} />Steam</a> : <span className="weekly-missing-link">缺 Steam 链接</span>}
    </div>
    <dl className="weekly-lead-facts">
      <div><dt>跟进总结</dt><dd>{lead.follow_summary}</dd></div>
      <div><dt>基本情况</dt><dd>{lead.basic_summary}</dd></div>
      <div><dt>推荐理由</dt><dd>{lead.recommendation_summary}</dd></div>
    </dl>
    <div className="weekly-link-row">
      {lead.steamdb_url && <a href={lead.steamdb_url} target="_blank" rel="noreferrer"><ExternalLink size={13} />SteamDB</a>}
      {lead.links.filter((link) => link !== lead.steam_store_url && link !== lead.steamdb_url).slice(0, 3).map((link) => <a href={link} target="_blank" rel="noreferrer" key={link}><ExternalLink size={13} />{linkLabel(link)}</a>)}
    </div>
  </article>;
}

function todayKey() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function linkLabel(link: string) {
  if (link.includes("store.steampowered.com")) return "Steam";
  if (link.includes("steamdb.info")) return "SteamDB";
  if (link.includes("bilibili.com")) return "B站";
  try { return new URL(link).hostname.replace("www.", ""); } catch { return "链接"; }
}
