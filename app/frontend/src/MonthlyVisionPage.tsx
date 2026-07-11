import { CheckCircle2, FileSpreadsheet, LockOpen, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { fetchMonthlyVision, saveMonthlyVision, syncAccessCookies } from "./api";
import {
  availableMonthlyVisionLeads,
  currentShanghaiMonth,
  monthlyVisionItemFromLead,
  monthlyVisionMonthLabel,
  monthlyVisionValidationErrors,
  sortMonthlyVisionItems
} from "./monthlyVision";
import type { Lead, MonthlyVisionItem, MonthlyVisionSheet, MonthlyVisionStatus } from "./types";

const monthlyVisionDownloadTarget = "monthly-vision-download-frame";

export function MonthlyVisionPage({ leads, refreshKey, onStatus }: { leads: Lead[]; refreshKey: number; onStatus: (message: string) => void }) {
  const [month, setMonth] = useState(currentShanghaiMonth());
  const [sheet, setSheet] = useState<MonthlyVisionSheet | null>(null);
  const [source, setSource] = useState<"generated" | "stored">("generated");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [downloadPassword, setDownloadPassword] = useState("");
  const exportFrameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSheet() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchMonthlyVision(month);
        if (cancelled) return;
        setSheet(result.sheet);
        setSource(result.source);
        setSelectedLeadId("");
      } catch (nextError) {
        if (!cancelled) setError(errorMessage(nextError, "月度视野表加载失败"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadSheet();
    return () => { cancelled = true; };
  }, [month, refreshKey]);

  const items = sheet?.items ?? [];
  const locked = sheet?.status === "finalized";
  const availableLeads = useMemo(() => availableMonthlyVisionLeads(leads, items), [leads, items]);
  const validationErrors = useMemo(() => monthlyVisionValidationErrors(items), [items]);
  const incompleteRows = items.filter((item) => !item.project.trim() || !item.developer.trim() || !item.contacts.trim()).length;

  function updateItem(leadId: string, field: keyof Pick<MonthlyVisionItem, "project" | "developer" | "contacts">, value: string) {
    if (!sheet || locked) return;
    setSheet({ ...sheet, items: sheet.items.map((item) => item.lead_id === leadId ? { ...item, [field]: value } : item) });
  }

  function addSelectedLead() {
    if (!sheet || locked || !selectedLeadId) return;
    const lead = leads.find((item) => item.id === selectedLeadId);
    if (!lead) return;
    setSheet({ ...sheet, items: sortMonthlyVisionItems([...sheet.items, monthlyVisionItemFromLead(lead)]) });
    setSelectedLeadId("");
  }

  function removeItem(leadId: string) {
    if (!sheet || locked) return;
    setSheet({ ...sheet, items: sheet.items.filter((item) => item.lead_id !== leadId) });
  }

  async function persist(status: MonthlyVisionStatus) {
    if (!sheet) return;
    if (status === "finalized" && validationErrors.length) {
      setError(`还有 ${validationErrors.length} 项需要补齐：${validationErrors.slice(0, 3).join("；")}`);
      return;
    }
    if (status === "finalized" && !window.confirm(`确认提交 ${monthlyVisionMonthLabel(month)}视野表？确认后将冻结当前三列内容。`)) return;
    if (status === "draft" && locked && !window.confirm("重新编辑会解除本月表的确认状态，确定继续吗？")) return;

    try {
      setSaving(true);
      setError(null);
      const saved = await saveMonthlyVision(month, status, sheet.items);
      setSheet(saved);
      setSource("stored");
      onStatus(status === "finalized" ? `${monthlyVisionMonthLabel(month)}视野表已确认` : `${monthlyVisionMonthLabel(month)}视野表草稿已保存`);
    } catch (nextError) {
      setError(errorMessage(nextError, "月度视野表保存失败"));
    } finally {
      setSaving(false);
    }
  }

  function exportExcel(event: FormEvent<HTMLFormElement>) {
    if (!locked) {
      event.preventDefault();
      setError("请先确认本月视野表，再导出 Excel");
      return;
    }
    if (exporting) {
      event.preventDefault();
      return;
    }
    if (!downloadPassword.trim()) {
      event.preventDefault();
      setError("请输入 Excel 导出密码");
      return;
    }

    syncAccessCookies();
    setExporting(true);
    setError(null);
    onStatus(`开始导出 ${monthlyVisionMonthLabel(month)}视野表 Excel`);
    window.setTimeout(() => setExporting(false), 1500);
  }

  function handleExportFrameLoad() {
    const text = exportFrameRef.current?.contentDocument?.body.textContent?.trim();
    if (!text) return;
    try {
      const payload = JSON.parse(text) as { error?: string };
      if (payload.error) setError(payload.error);
    } catch {
      // A successful attachment response does not expose a readable document body.
    } finally {
      setExporting(false);
    }
  }

  return <section className="monthly-vision-shell">
    <div className="monthly-vision-head">
      <div>
        <p className="eyebrow">Monthly Pipeline Snapshot</p>
        <h2>月度视野表</h2>
        <p className="subline">从活跃项目预填，人工确认项目名称、研发团队和联系方式后按月留档。</p>
      </div>
      <label className="monthly-vision-month"><span>月份</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
    </div>

    {error && <div className="notice error">{error}</div>}

    <div className="monthly-vision-metrics">
      <div><span>当前月份</span><strong>{monthlyVisionMonthLabel(month)}</strong></div>
      <div><span>项目数</span><strong>{items.length}</strong></div>
      <div data-tone={incompleteRows ? "warning" : "complete"}><span>待补齐</span><strong>{incompleteRows}</strong></div>
      <div data-tone={locked ? "complete" : "neutral"}><span>状态</span><strong>{locked ? "已确认" : source === "generated" ? "未保存" : "草稿"}</strong></div>
    </div>

    {loading ? <div className="empty-cell">正在整理本月视野表…</div> : sheet ? <>
      <div className="monthly-vision-toolbar">
        <div className="monthly-vision-add">
          <select value={selectedLeadId} disabled={locked} onChange={(event) => setSelectedLeadId(event.target.value)}>
            <option value="">从其他非淘汰项目中添加…</option>
            {availableLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.project} · {lead.bucket}</option>)}
          </select>
          <button className="ghost-button" type="button" disabled={locked || !selectedLeadId} onClick={addSelectedLead}><Plus size={16} />添加项目</button>
        </div>
        <div className="monthly-vision-actions">
          {!locked ? <>
            <button className="ghost-button" type="button" disabled={saving} onClick={() => void persist("draft")}><Save size={16} />保存草稿</button>
            <button className="primary-button" type="button" disabled={saving || validationErrors.length > 0} onClick={() => void persist("finalized")}><CheckCircle2 size={16} />确认本月表</button>
          </> : <button className="ghost-button" type="button" disabled={saving} onClick={() => void persist("draft")}><LockOpen size={16} />重新编辑</button>}
        </div>
      </div>

      <div className="monthly-vision-table-wrap">
        <table className="monthly-vision-table">
          <thead><tr><th>项目名称</th><th>研发团队</th><th>联系方式</th><th aria-label="操作" /></tr></thead>
          <tbody>
            {items.map((item) => <tr key={item.lead_id} data-incomplete={!item.project.trim() || !item.developer.trim() || !item.contacts.trim()}>
              <td><input value={item.project} readOnly={locked} aria-label={`${item.project || item.lead_id} 项目名称`} onChange={(event) => updateItem(item.lead_id, "project", event.target.value)} /></td>
              <td><input value={item.developer} readOnly={locked} placeholder="待补研发团队" aria-label={`${item.project} 研发团队`} onChange={(event) => updateItem(item.lead_id, "developer", event.target.value)} /></td>
              <td><textarea value={item.contacts} readOnly={locked} placeholder="待补微信 / QQ / Email / 电话" aria-label={`${item.project} 联系方式`} onChange={(event) => updateItem(item.lead_id, "contacts", event.target.value)} /></td>
              <td><button className="icon-button danger" type="button" disabled={locked} aria-label={`移除 ${item.project}`} onClick={() => removeItem(item.lead_id)}><Trash2 size={15} /></button></td>
            </tr>)}
            {!items.length && <tr><td colSpan={4} className="empty-cell">本月暂无项目，请从 CRM 中添加。</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="monthly-vision-export">
        <div><strong>Excel 导出</strong><p className="subline">固定导出“项目名称、研发团队、联系方式”三列；历史月份保持确认时的内容。</p></div>
        <form className="monthly-vision-export-actions" action="/api/export/monthly-vision" method="post" target={monthlyVisionDownloadTarget} onSubmit={exportExcel}>
          <input type="hidden" name="month" value={month} />
          <input type="password" name="password" value={downloadPassword} onChange={(event) => setDownloadPassword(event.target.value)} placeholder="Excel 导出密码" aria-label="Excel 导出密码" />
          <button className="ghost-button" type="submit" disabled={!locked || exporting}><FileSpreadsheet size={16} />{exporting ? "导出中…" : "导出 Excel"}</button>
        </form>
        <iframe ref={exportFrameRef} name={monthlyVisionDownloadTarget} title="月度视野表 Excel 下载" hidden onLoad={handleExportFrameLoad} />
      </div>
    </> : null}
  </section>;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
