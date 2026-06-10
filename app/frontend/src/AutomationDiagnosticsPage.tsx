import { AlertTriangle, CheckCircle2, ExternalLink, FileCheck2, ServerCog, ShieldAlert, TrendingUp } from "lucide-react";
import { ReportHistoryControls } from "./ReportHistoryControls";
import type { AutomationDiagnostics, AutomationDiagnosticsStatus, AutomationFileHealth, AutomationReceiptSummary, SourcingLearningReport } from "./types";

export function AutomationDiagnosticsPage({ diagnostics, loading, onDateChange, sourcingLearning }: {
  diagnostics: AutomationDiagnostics | null;
  loading: boolean;
  onDateChange: (date: string) => void;
  sourcingLearning: SourcingLearningReport | null;
}) {
  if (loading) return <section className="diagnostics-shell"><div className="empty-cell">加载自动化诊断中</div></section>;

  return <section className="diagnostics-shell">
    <div className="diagnostics-head">
      <div>
        <p className="eyebrow">{diagnostics?.report_date ?? "今日"}</p>
        <h2>自动化运行与线索质量诊断中心</h2>
        <p>{diagnostics?.summary ?? "暂无自动化诊断数据。"} </p>
      </div>
      <ReportHistoryControls
        availableDates={diagnostics?.available_dates}
        isFallback={diagnostics?.report_date !== diagnostics?.requested_date}
        noun="自动化诊断"
        onDateChange={onDateChange}
        reportDate={diagnostics?.report_date}
        requestedDate={diagnostics?.requested_date}
      />
    </div>

    {!diagnostics ? <div className="diagnostics-empty">没有读取到诊断数据。</div> : <>
      <div className={`diagnostics-status status-${diagnostics.status}`}>
        <StatusIcon status={diagnostics.status} />
        <div>
          <span>{statusLabel(diagnostics.status)}</span>
          <strong>{diagnostics.rule_version ?? "未识别规则版本"}</strong>
        </div>
        <small>生成于 {formatDateTime(diagnostics.generated_at)}</small>
      </div>

      <div className="diagnostics-grid diagnostics-grid-top">
        <MetricCard label="非淘汰候选" value={diagnostics.counts.review_candidates} helper={`阈值 ${diagnostics.thresholds.min_review_candidates}`} tone={diagnostics.counts.review_candidates >= diagnostics.thresholds.min_review_candidates ? "ok" : "warn"} />
        <MetricCard label="最终候选" value={diagnostics.counts.final_candidates} helper={`推荐 ${diagnostics.counts.push_candidates} / 普通 ${diagnostics.counts.watch_candidates} / 淘汰 ${diagnostics.counts.drop_candidates}`} tone="neutral" />
        <MetricCard label="媒体/B站候选" value={diagnostics.source_breakdown.media_bilibili_leads ?? 0} helper={`阈值 ${diagnostics.thresholds.min_media_bilibili_candidates}`} tone={(diagnostics.source_breakdown.media_bilibili_leads ?? 0) >= diagnostics.thresholds.min_media_bilibili_candidates ? "ok" : "warn"} />
        <MetricCard label="Steam 富化" value={diagnostics.source_breakdown.steam_enriched ?? 0} helper={`扫描 ${diagnostics.source_breakdown.steam_scanned ?? 0}`} tone="neutral" />
      </div>

      {diagnostics.business_acceptance && <BusinessAcceptanceBlock acceptance={diagnostics.business_acceptance} />}

      <SourcingLearningBlock report={sourcingLearning} />

      <div className="diagnostics-grid diagnostics-grid-panels">
        <article className="diagnostics-panel">
          <div className="diagnostics-panel-head"><FileCheck2 size={18} /><h3>文件健康</h3></div>
          <FileHealthRow label="日报" file={diagnostics.files.report} />
          <FileHealthRow label="行业雷达" file={diagnostics.files.radar} />
          <FileHealthRow label="Steam 趋势" file={diagnostics.files.steam_trends} />
        </article>

        <article className="diagnostics-panel">
          <div className="diagnostics-panel-head"><ServerCog size={18} /><h3>最近同步</h3></div>
          <ReceiptBlock receipt={diagnostics.latest_synced_receipt ?? diagnostics.latest_receipt} />
        </article>

        <article className="diagnostics-panel">
          <div className="diagnostics-panel-head"><TrendingUp size={18} /><h3>内容看板</h3></div>
          <dl className="diagnostics-kv">
            <div><dt>行业雷达</dt><dd>{diagnostics.counts.radar_items} 条</dd></div>
            <div><dt>Steam 大盘观察</dt><dd>{diagnostics.counts.steam_market_insights} 条</dd></div>
            <div><dt>Steam 品类信号</dt><dd>{diagnostics.counts.steam_genre_signals} 条</dd></div>
            <div><dt>CRM 候选样本</dt><dd>{diagnostics.counts.steam_crm_candidates} 条</dd></div>
          </dl>
          <div className="diagnostics-tags">
            {Object.entries(diagnostics.counts.radar_categories).map(([category, count]) => <span key={category}>{category} {count}</span>)}
          </div>
        </article>
      </div>

      <div className="diagnostics-grid diagnostics-grid-bottom">
        <article className="diagnostics-panel">
          <div className="diagnostics-panel-head"><AlertTriangle size={18} /><h3>风险与告警</h3></div>
          {diagnostics.warnings.length ? <ul className="diagnostics-list">
            {diagnostics.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul> : <p className="diagnostics-muted">当前没有诊断告警。</p>}
        </article>

        <article className="diagnostics-panel">
          <div className="diagnostics-panel-head"><ShieldAlert size={18} /><h3>建议动作</h3></div>
          <ul className="diagnostics-list">
            {diagnostics.next_actions.map((action) => <li key={action}>{action}</li>)}
          </ul>
        </article>
      </div>
    </>}
  </section>;
}

function SourcingLearningBlock({ report }: { report: SourcingLearningReport | null }) {
  return <article className="diagnostics-business acceptance-needs_attention">
    <div className="diagnostics-business-head">
      <div>
        <span>Sourcing 学习</span>
        <h3>人工决策漏斗</h3>
      </div>
      <strong>{report ? `${report.cohort.total_active} 个流程内样本` : "等待数据"}</strong>
    </div>
    {!report ? <p>还没有读取到学习数据；处理 lead 后这里会显示评级、淘汰原因和流转结果。</p> : <>
      <p>{report.learning_note}</p>
      <div className="business-metric-grid">
        <div className="business-metric metric-status-pass"><span>正向结果</span><strong>{report.outcomes.positive}</strong><small>跟进/推进或高评级</small></div>
        <div className="business-metric metric-status-fail"><span>负向结果</span><strong>{report.outcomes.negative}</strong><small>淘汰或低评级</small></div>
        <div className="business-metric metric-status-warn"><span>中间状态</span><strong>{report.outcomes.intermediate}</strong><small>待评测/测试/观察</small></div>
        <div className="business-metric metric-status-unknown"><span>记录事件</span><strong>{report.events.total}</strong><small>人工保存动作</small></div>
      </div>
      <div className="business-cause-grid">
        <div>
          <h4>漏斗</h4>
          <div className="diagnostics-tags">
            {report.funnel.map((item) => <span key={item.bucket}>{item.bucket} {item.count}</span>)}
          </div>
        </div>
        <div>
          <h4>评级 / 淘汰原因</h4>
          <div className="diagnostics-tags">
            {Object.entries(report.grade_distribution).map(([grade, count]) => <span key={grade}>{grade} {count}</span>)}
            {report.drop_reasons.slice(0, 6).map((item) => <span key={item.reason}>{item.reason} {item.count}</span>)}
            {!Object.keys(report.grade_distribution).length && !report.drop_reasons.length ? <span>继续积累样本</span> : null}
          </div>
        </div>
      </div>
    </>}
  </article>;
}

function StatusIcon({ status }: { status: AutomationDiagnosticsStatus }) {
  if (status === "healthy") return <CheckCircle2 size={22} />;
  return <AlertTriangle size={22} />;
}

function statusLabel(status: AutomationDiagnosticsStatus) {
  const labels: Record<AutomationDiagnosticsStatus, string> = {
    failed: "自动化失败",
    healthy: "运行正常",
    missing: "核心文件缺失",
    warning: "需要关注"
  };
  return labels[status];
}

function MetricCard({ helper, label, tone, value }: { helper: string; label: string; tone: "neutral" | "ok" | "warn"; value: number }) {
  return <article className={`diagnostics-metric metric-${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{helper}</small>
  </article>;
}

function BusinessAcceptanceBlock({ acceptance }: { acceptance: NonNullable<AutomationDiagnostics["business_acceptance"]> }) {
  return <article className={`diagnostics-business acceptance-${acceptance.status}`}>
    <div className="diagnostics-business-head">
      <div>
        <span>{businessStatusLabel(acceptance.status)}</span>
        <h3>业务验收</h3>
      </div>
      <strong>{acceptance.primary_issue ?? "今天可交付"}</strong>
    </div>
    <p>{acceptance.verdict}</p>
    <div className="business-metric-grid">
      {acceptance.metrics.map((metric) => <div className={`business-metric metric-status-${metric.status}`} key={metric.key}>
        <span>{metric.label}</span>
        <strong>{metric.actual ?? "无法判断"}</strong>
        <small>{metric.expected}</small>
      </div>)}
    </div>
    <div className="business-cause-grid">
      <div>
        <h4>原因拆解</h4>
        {acceptance.root_causes.length ? <ul className="diagnostics-list">
          {acceptance.root_causes.map((cause) => <li key={`${cause.category}-${cause.title}-${cause.evidence}`}>
            <strong>{cause.title}</strong>
            <span>{cause.evidence}</span>
          </li>)}
        </ul> : <p className="diagnostics-muted">核心文件、同步和候选质量均达到验收阈值。</p>}
      </div>
      <div>
        <h4>建议动作</h4>
        <ul className="diagnostics-list">
          {acceptance.recommended_actions.map((action) => <li key={action}>{action}</li>)}
        </ul>
      </div>
    </div>
  </article>;
}

function FileHealthRow({ file, label }: { file: AutomationFileHealth; label: string }) {
  return <div className="diagnostics-file-row">
    <span className={file.exists ? "file-ok" : "file-missing"}>{file.exists ? "存在" : "缺失"}</span>
    <div>
      <strong>{label}</strong>
      <small>{file.path}</small>
    </div>
    <a href={file.source} target="_blank" rel="noreferrer" aria-label={`打开${label}源文件`}><ExternalLink size={15} /></a>
  </div>;
}

function ReceiptBlock({ receipt }: { receipt: AutomationReceiptSummary | null }) {
  if (!receipt) return <p className="diagnostics-muted">当天没有 automation_runs receipt。</p>;
  return <div className="diagnostics-receipt">
    <dl className="diagnostics-kv">
      <div><dt>slot</dt><dd>{receipt.slot ?? "unknown"}</dd></div>
      <div><dt>status</dt><dd>{receipt.status}</dd></div>
      <div><dt>synced</dt><dd>{receipt.sync?.synced ? "true" : "false"}</dd></div>
      <div><dt>captured</dt><dd>{formatDateTime(receipt.captured_at)}</dd></div>
      <div><dt>created</dt><dd>{receipt.sync?.created ?? "-"}</dd></div>
      <div><dt>updated</dt><dd>{receipt.sync?.updated ?? "-"}</dd></div>
      <div><dt>dropped</dt><dd>{receipt.sync?.dropped ?? "-"}</dd></div>
      <div><dt>total</dt><dd>{receipt.sync?.total ?? "-"}</dd></div>
    </dl>
    {receipt.run_url && <a className="diagnostics-run-link" href={receipt.run_url} target="_blank" rel="noreferrer"><ExternalLink size={15} />打开 Actions run</a>}
  </div>;
}

function businessStatusLabel(status: NonNullable<AutomationDiagnostics["business_acceptance"]>["status"]) {
  if (status === "pass") return "业务可用";
  if (status === "fail") return "不可交付";
  return "需要关注";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric"
  }).format(date);
}
