import { AlertTriangle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { buildBucketNavigation, buildDecisionTriage, buildLeadEvidenceChips, type BucketNavigationItem, type TriageFilter } from "../../leadTriage";
import { buildFollowUpQueue, formatFollowUpSummary, type FollowUpQueueItem } from "../../followUpQueue";
import type { Lead } from "../../types";
import { bucketOptions, bucketClass, priorityLabel, priorityTone, regionOptions, stageOptions } from "./leadConstants";
import { Select } from "./leadControls";
import { buildDashboardStats, emptyLeadFilters, filterLeads, type LeadFilters } from "./leadFilters";
import { ContactChips, LeadDetail, QuickActions } from "./LeadDetail";
import { isTestingOverdue } from "./leadWorkflow";

type LeadsViewProps = {
  leads: Lead[];
  loading: boolean;
  displayName: string;
  onLeadPatch: (id: string, patch: Partial<Lead>) => Promise<void>;
};

export function LeadsView({ leads, loading, displayName, onLeadPatch }: LeadsViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<LeadFilters>(emptyLeadFilters);
  const stats = useMemo(() => buildDashboardStats(leads), [leads]);
  const filteredLeads = useMemo(() => filterLeads(leads, filters), [filters, leads]);
  const selectedLead = useMemo(() => filteredLeads.find((lead) => lead.id === selectedId) ?? filteredLeads[0] ?? null, [filteredLeads, selectedId]);
  const triage = useMemo(() => buildDecisionTriage(leads), [leads]);
  const followUpQueue = useMemo(() => buildFollowUpQueue(leads), [leads]);
  const followUpTopItems = followUpQueue.items.slice(0, 5);
  const followUpByLeadId = useMemo(() => new Map(followUpTopItems.map((item) => [item.lead.id, item])), [followUpTopItems]);
  const triageLanes = useMemo(() => triage.lanes.map((lane) => lane.key === "action" ? {
    ...lane,
    count: followUpQueue.count,
    leads: followUpTopItems.map((item) => item.lead)
  } : lane), [followUpQueue.count, followUpTopItems, triage.lanes]);
  const bucketNavigation = useMemo(() => buildBucketNavigation(leads), [leads]);
  const greeting = getDashboardGreeting(displayName);
  const todayLabel = formatShanghaiLongDate();
  const focusLabel = activeFilterLabel(filters);

  function applyTriageFilter(patch: Partial<LeadFilters> | TriageFilter) {
    setFilters({ ...emptyLeadFilters, ...patch });
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
        <span>{followUpQueue.count} 个本周待办</span>
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
      {triageLanes.map((lane) => (
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
                <button type="button" onClick={() => { setFilters({ ...emptyLeadFilters, ...lane.filter }); setSelectedId(lead.id); }}>
                  <span>{lead.project}</span>
                  {lane.key === "action" && followUpByLeadId.get(lead.id)
                    ? <FollowUpQueueBrief item={followUpByLeadId.get(lead.id)!} />
                    : <small>{lead.priority} · {lead.bucket} · {lead.region === "中国" ? lead.country : lead.region_priority}</small>}
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
      <button className="ghost-button" onClick={() => { setFilters(emptyLeadFilters); setSelectedId(null); }}>清空</button>
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
                <td className="lead-action-cell"><QuickActions lead={lead} onPatch={onLeadPatch} compact missingLinksMode={filters.missingLinks} /></td>
              </tr>
            ))}
            {!loading && !filteredLeads.length && <tr><td colSpan={5} className="empty-cell">无匹配 leads</td></tr>}
          </tbody>
        </table>
      </div>
      <LeadDetail lead={selectedLead} onPatch={onLeadPatch} missingLinksMode={filters.missingLinks} />
    </section>
  </>;
}

function FollowUpQueueBrief({ item }: { item: FollowUpQueueItem }) {
  return <>
    <small>{formatFollowUpSummary(item)}</small>
    <span className="evidence-chip-list follow-up-chip-list">
      {item.reasons.map((reason) => (
        <span className={`evidence-chip evidence-${reason.tone}`} key={reason.key}>{reason.label}</span>
      ))}
    </span>
  </>;
}

function EvidenceChips({ lead }: { lead: Lead }) {
  const chips = buildLeadEvidenceChips(lead).slice(0, 6);
  if (!chips.length) return <span className="muted">待复核</span>;
  return <div className="evidence-chip-list">{chips.map((chip) => (
    <span className={`evidence-chip evidence-${chip.tone}`} key={chip.label}>{chip.label}</span>
  ))}</div>;
}

function activeFilterLabel(filters: LeadFilters) {
  if (filters.needsAction) return "需要动作";
  if (filters.evidenceIssues) return "证据不足复核";
  if (filters.missingLinks) return "缺链接补全";
  if (filters.reviewStatus !== "全部") return filters.reviewStatus;
  if (filters.bucket !== "全部") return filters.bucket;
  if (filters.query) return "搜索结果";
  return "Leads Review";
}

function isBucketNavigationActive(filters: LeadFilters, item: BucketNavigationItem) {
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
