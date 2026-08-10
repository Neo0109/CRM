import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  History,
  Link as LinkIcon,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createInteraction, fetchInteractions, isApiErrorStatus } from "./api";
import {
  buildInteractionInput,
  communicationBuckets,
  communicationChannels,
  communicationDueText,
  communicationOwners,
  communicationStatusForLead,
  communicationStatusLabel,
  createInteractionRequestId,
  filterCommunicationLeads,
  interactionOccurredDate,
  mergeInteractionPage,
  newInteractionDraft,
  shouldCommitTimelineResponse,
  validateInteractionDraft,
  type CommunicationDueFilter,
  type CommunicationFilters,
  type CommunicationPoolFilter,
  type InteractionDraftErrors
} from "./communicationFollowUp";
import { priorityLabel } from "./leadPriority";
import type { ContactMethod, InteractionDraft, InteractionEvent, Lead } from "./types";

type CommunicationFollowUpPageProps = {
  leads: Lead[];
  loading: boolean;
  displayName: string;
  onLeadUpdated: (lead: Lead) => void;
  onReloadLeads: () => Promise<void>;
};

type TimelineState = {
  status: "idle" | "loading" | "loaded" | "error";
  interactions: InteractionEvent[];
  nextCursor: string | null;
  error: string | null;
  loadingMore: boolean;
};

const initialFilters: CommunicationFilters = {
  query: "",
  owner: "all",
  pool: "all",
  due: "all"
};

const emptyTimeline: TimelineState = {
  status: "idle",
  interactions: [],
  nextCursor: null,
  error: null,
  loadingMore: false
};

const dueFilterOptions: Array<{ value: CommunicationDueFilter; label: string }> = [
  { value: "all", label: "全部到期状态" },
  { value: "overdue", label: "已逾期" },
  { value: "today", label: "今日到期" },
  { value: "next-7-days", label: "7天内" },
  { value: "missing", label: "缺下一步或日期" },
  { value: "future", label: "未来提醒" }
];

export function CommunicationFollowUpPage({
  leads,
  loading,
  displayName,
  onLeadUpdated,
  onReloadLeads
}: CommunicationFollowUpPageProps) {
  const [filters, setFilters] = useState<CommunicationFilters>(initialFilters);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [timelineByLead, setTimelineByLead] = useState<Record<string, TimelineState>>({});
  const [timelineReloadKey, setTimelineReloadKey] = useState(0);
  const [draft, setDraft] = useState<InteractionDraft>(() => newInteractionDraft());
  const [draftErrors, setDraftErrors] = useState<InteractionDraftErrors>({});
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
  const timelineRequestId = useRef(0);
  const selectedLeadIdRef = useRef<string | null>(selectedLeadId);
  const requestIdByLead = useRef<Record<string, string>>({});

  selectedLeadIdRef.current = selectedLeadId;

  const eligibleLeads = useMemo(() => leads.filter((lead) => communicationBuckets.some((bucket) => lead.bucket === bucket)), [leads]);
  const visibleLeads = useMemo(() => filterCommunicationLeads(leads, filters), [filters, leads]);
  const owners = useMemo(() => communicationOwners(leads), [leads]);
  const selectedLead = eligibleLeads.find((lead) => lead.id === selectedLeadId) ?? null;
  const selectedTimeline = selectedLead ? timelineByLead[selectedLead.id] ?? emptyTimeline : emptyTimeline;
  const counts = useMemo(() => ({
    total: eligibleLeads.length,
    overdue: eligibleLeads.filter((lead) => communicationStatusForLead(lead) === "overdue").length,
    today: eligibleLeads.filter((lead) => communicationStatusForLead(lead) === "today").length,
    missing: eligibleLeads.filter((lead) => !lead.next_action?.trim() || !lead.due_date).length
  }), [eligibleLeads]);

  useEffect(() => {
    if (selectedLeadId && visibleLeads.some((lead) => lead.id === selectedLeadId)) return;
    setSelectedLeadId(visibleLeads[0]?.id ?? null);
  }, [selectedLeadId, visibleLeads]);

  useEffect(() => {
    setDraft(newInteractionDraft());
    setDraftErrors({});
    setSaveError(null);
    setSaveSuccess(null);
  }, [selectedLeadId]);

  useEffect(() => {
    const leadId = selectedLeadId;
    if (!leadId || timelineByLead[leadId]?.status === "loaded") return;

    const controller = new AbortController();
    const requestId = ++timelineRequestId.current;
    setTimelineByLead((current) => ({
      ...current,
      [leadId]: {
        ...(current[leadId] ?? emptyTimeline),
        status: "loading",
        error: null
      }
    }));

    void fetchInteractions(leadId, { limit: 50, signal: controller.signal })
      .then((page) => {
        if (!shouldCommitTimelineResponse(requestId, timelineRequestId.current, leadId, selectedLeadIdRef.current)) return;
        setTimelineByLead((current) => ({
          ...current,
          [leadId]: {
            status: "loaded",
            interactions: mergeInteractionPage(current[leadId]?.interactions ?? [], page),
            nextCursor: page.next_cursor,
            error: null,
            loadingMore: false
          }
        }));
      })
      .catch((error: unknown) => {
        if (isAbortError(error)
          || !shouldCommitTimelineResponse(requestId, timelineRequestId.current, leadId, selectedLeadIdRef.current)) return;
        setTimelineByLead((current) => ({
          ...current,
          [leadId]: {
            ...(current[leadId] ?? emptyTimeline),
            status: "error",
            error: errorMessage(error, "沟通历史加载失败"),
            loadingMore: false
          }
        }));
      });

    return () => controller.abort();
  }, [selectedLeadId, timelineReloadKey]);

  function updateFilter<Key extends keyof CommunicationFilters>(key: Key, value: CommunicationFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function updateDraft(patch: Partial<InteractionDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setDraftErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as Array<keyof InteractionDraft>) delete next[key];
      return next;
    });
    setSaveError(null);
    setSaveSuccess(null);
  }

  function retryTimeline(leadId: string) {
    setTimelineByLead((current) => ({ ...current, [leadId]: emptyTimeline }));
    setTimelineReloadKey((current) => current + 1);
  }

  async function loadMoreHistory(leadId: string, cursor: string) {
    const requestId = ++timelineRequestId.current;
    const controller = new AbortController();
    setTimelineByLead((current) => ({
      ...current,
      [leadId]: { ...(current[leadId] ?? emptyTimeline), loadingMore: true, error: null }
    }));
    try {
      const page = await fetchInteractions(leadId, { cursor, limit: 50, signal: controller.signal });
      if (!shouldCommitTimelineResponse(requestId, timelineRequestId.current, leadId, selectedLeadIdRef.current)) return;
      setTimelineByLead((current) => ({
        ...current,
        [leadId]: {
          status: "loaded",
          interactions: mergeInteractionPage(current[leadId]?.interactions ?? [], page),
          nextCursor: page.next_cursor,
          error: null,
          loadingMore: false
        }
      }));
    } catch (error) {
      if (!isAbortError(error) && selectedLeadIdRef.current === leadId) {
        setTimelineByLead((current) => ({
          ...current,
          [leadId]: {
            ...(current[leadId] ?? emptyTimeline),
            status: "loaded",
            error: errorMessage(error, "更多沟通历史加载失败"),
            loadingMore: false
          }
        }));
      }
    } finally {
      setTimelineByLead((current) => current[leadId]?.loadingMore ? {
        ...current,
        [leadId]: { ...current[leadId], loadingMore: false }
      } : current);
    }
  }

  async function submitInteraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lead = selectedLead;
    if (!lead || savingLeadId) return;

    const errors = validateInteractionDraft(draft);
    setDraftErrors(errors);
    if (Object.keys(errors).length) {
      setSaveError("请先修正表单中的字段");
      return;
    }

    const requestId = requestIdByLead.current[lead.id] ?? createInteractionRequestId();
    requestIdByLead.current[lead.id] = requestId;
    setSavingLeadId(lead.id);
    setSaveError(null);
    setSaveSuccess(null);
    setWorkspaceNotice(null);

    try {
      const result = await createInteraction(buildInteractionInput(lead.id, requestId, draft));
      delete requestIdByLead.current[lead.id];
      onLeadUpdated(result.lead);
      setTimelineByLead((current) => ({
        ...current,
        [lead.id]: {
          status: "loaded",
          interactions: mergeInteractionPage(current[lead.id]?.interactions ?? [], {
            interactions: [result.interaction]
          }),
          nextCursor: current[lead.id]?.nextCursor ?? null,
          error: null,
          loadingMore: false
        }
      }));

      if (selectedLeadIdRef.current === lead.id) {
        setDraft(newInteractionDraft());
        setDraftErrors({});
        setSaveSuccess(result.calendar_synced
          ? "沟通记录已保存，下次跟进已同步到日历"
          : "沟通记录已保存");
      }
    } catch (error) {
      if (isApiErrorStatus(error, 409)) {
        setWorkspaceNotice("刚才选择的 Lead 已移出跟进中或推进池，本次记录未保存，项目列表已刷新。");
        if (selectedLeadIdRef.current === lead.id) {
          setSaveError("该 Lead 已移出跟进中或推进池，无法继续记录；列表正在刷新。");
        }
        void onReloadLeads();
      } else if (selectedLeadIdRef.current === lead.id) {
        setSaveError(errorMessage(error, "沟通记录保存失败，请重试"));
      }
    } finally {
      setSavingLeadId(null);
    }
  }

  return <section className="communication-shell">
    <header className="communication-head">
      <div>
        <p className="eyebrow">COMMUNICATION · FOLLOW-UP</p>
        <h2>沟通跟进工作台</h2>
        <p>集中处理跟进中与推进池项目，记录沟通上下文，并把明确的下一次动作同步到日历。</p>
      </div>
      <button className="ghost-button" type="button" onClick={() => void onReloadLeads()} disabled={loading}>
        <RefreshCw size={16} />刷新 Lead
      </button>
    </header>

    {workspaceNotice ? <div className="communication-workspace-notice" role="alert"><AlertTriangle size={16} />{workspaceNotice}</div> : null}

    <div className="communication-metrics" aria-label="沟通跟进概览">
      <Metric label="可跟进项目" value={counts.total} />
      <Metric label="已逾期" value={counts.overdue} tone="danger" />
      <Metric label="今日到期" value={counts.today} tone="warning" />
      <Metric label="缺下一步或日期" value={counts.missing} tone="muted" />
    </div>

    <div className="communication-layout">
      <aside className="communication-list-panel" aria-label="跟进项目列表">
        <div className="communication-filters">
          <label className="communication-search">
            <Search size={16} />
            <span className="sr-only">搜索项目</span>
            <input
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder="搜索项目、团队或联系方式"
              type="search"
            />
          </label>
          <div className="communication-filter-grid">
            <label>
              <span>Owner</span>
              <select value={filters.owner} onChange={(event) => updateFilter("owner", event.target.value)}>
                <option value="all">全部 Owner</option>
                {owners.map((owner) => <option value={owner} key={owner}>{owner}</option>)}
              </select>
            </label>
            <label>
              <span>池子</span>
              <select value={filters.pool} onChange={(event) => updateFilter("pool", event.target.value as CommunicationPoolFilter)}>
                <option value="all">跟进中 + 推进池</option>
                {communicationBuckets.map((bucket) => <option value={bucket} key={bucket}>{bucket}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>到期状态</span>
            <select value={filters.due} onChange={(event) => updateFilter("due", event.target.value as CommunicationDueFilter)}>
              {dueFilterOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>

        <div className="communication-list-summary">
          <strong>{visibleLeads.length}</strong><span>个项目</span>
          {filters !== initialFilters ? <button type="button" onClick={() => setFilters(initialFilters)}>清除筛选</button> : null}
        </div>

        <div className="communication-lead-list">
          {loading && !leads.length ? <div className="communication-empty">正在加载 Lead…</div> : visibleLeads.length ? visibleLeads.map((lead) => (
            <LeadListItem
              key={lead.id}
              lead={lead}
              selected={lead.id === selectedLeadId}
              onSelect={() => setSelectedLeadId(lead.id)}
            />
          )) : <div className="communication-empty">当前筛选下没有跟进中或推进池项目。</div>}
        </div>
      </aside>

      <main className="communication-detail-panel">
        {selectedLead ? <>
          <LeadContext lead={selectedLead} />
          <div className="communication-work-grid">
            <InteractionForm
              displayName={displayName}
              draft={draft}
              errors={draftErrors}
              saving={savingLeadId === selectedLead.id}
              saveError={saveError}
              saveSuccess={saveSuccess}
              onChange={updateDraft}
              onSubmit={submitInteraction}
            />
            <InteractionTimeline
              lead={selectedLead}
              timeline={selectedTimeline}
              onRetry={() => retryTimeline(selectedLead.id)}
              onLoadMore={(cursor) => void loadMoreHistory(selectedLead.id, cursor)}
            />
          </div>
        </> : <div className="communication-detail-empty">
          <MessageSquareText size={30} />
          <h3>选择一个项目开始跟进</h3>
          <p>这里只显示当前处于跟进中或推进池的 Lead。</p>
        </div>}
      </main>
    </div>
  </section>;
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: string }) {
  return <div className={`communication-metric ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function LeadListItem({ lead, selected, onSelect }: { lead: Lead; selected: boolean; onSelect: () => void }) {
  const status = communicationStatusForLead(lead);
  return <button
    className={`communication-lead-card ${selected ? "selected" : ""}`}
    type="button"
    aria-pressed={selected}
    onClick={onSelect}
  >
    <div className="communication-lead-card-head">
      <strong>{lead.project}</strong>
      <ChevronRight size={16} />
    </div>
    <div className="communication-lead-meta">
      <span>{lead.bucket}</span>
      <span>{lead.owner || "缺 Owner"}</span>
      <span>{priorityLabel(lead.priority)}</span>
    </div>
    <span className={`communication-status status-${status}`}>{communicationStatusLabel(status)}</span>
    <small>{communicationDueText(lead)}</small>
    <p>{lead.next_action?.trim() || "尚未补充下一步动作"}</p>
  </button>;
}

function LeadContext({ lead }: { lead: Lead }) {
  const contacts = normalizedContacts(lead);
  return <section className="communication-context-card">
    <div className="communication-context-head">
      <div>
        <div className="communication-chip-row">
          <span>{lead.bucket}</span>
          <span>{priorityLabel(lead.priority)}</span>
          <span><UserRound size={13} />{lead.owner || "未分配 Owner"}</span>
        </div>
        <h3>{lead.project}</h3>
        <p>{lead.team || "团队信息待补充"}{lead.country ? ` · ${lead.country}` : ""}</p>
      </div>
      <div className="communication-due-card">
        <CalendarDays size={18} />
        <span>现有跟进提醒</span>
        <strong>{communicationDueText(lead)}</strong>
      </div>
    </div>
    <div className="communication-context-grid">
      <div>
        <span className="communication-section-label">现有下一步</span>
        <p className="communication-current-action">{lead.next_action?.trim() || "尚未设置下一步动作"}</p>
      </div>
      <div>
        <span className="communication-section-label">联系方式</span>
        {contacts.length ? <div className="communication-contact-list">{contacts.map((contact, index) => (
          <ContactChip contact={contact} key={`${contact.type}-${contact.value}-${index}`} />
        ))}</div> : <p className="communication-muted">尚未录入联系方式</p>}
      </div>
    </div>
  </section>;
}

function ContactChip({ contact }: { contact: ContactMethod }) {
  const href = contactHref(contact);
  const content = <><span>{contact.type}</span><strong>{contact.value}</strong>{contact.note ? <small>{contact.note}</small> : null}</>;
  return href ? <a className="communication-contact-chip" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
    <LinkIcon size={14} />{content}
  </a> : <div className="communication-contact-chip"><LinkIcon size={14} />{content}</div>;
}

function InteractionForm({
  displayName,
  draft,
  errors,
  saving,
  saveError,
  saveSuccess,
  onChange,
  onSubmit
}: {
  displayName: string;
  draft: InteractionDraft;
  errors: InteractionDraftErrors;
  saving: boolean;
  saveError: string | null;
  saveSuccess: string | null;
  onChange: (patch: Partial<InteractionDraft>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const occurredDate = interactionOccurredDate(draft);
  return <section className="communication-form-card">
    <div className="communication-panel-title">
      <div><Send size={17} /><h3>记录本次沟通</h3></div>
      <span>记录人：{displayName}</span>
    </div>
    <form onSubmit={onSubmit}>
      <div className="communication-form-row">
        <Field label="渠道" error={errors.channel}>
          <select value={draft.channel} onChange={(event) => onChange({ channel: event.target.value as InteractionDraft["channel"] })} aria-invalid={Boolean(errors.channel)}>
            {communicationChannels.map((channel) => <option value={channel} key={channel}>{channel}</option>)}
          </select>
        </Field>
        <Field label="沟通时间" error={errors.occurred_at}>
          <input type="datetime-local" value={draft.occurred_at} onChange={(event) => onChange({ occurred_at: event.target.value })} aria-invalid={Boolean(errors.occurred_at)} required />
        </Field>
      </div>
      <Field label="沟通对象（选填）" error={errors.contact_label} counter={`${Array.from(draft.contact_label).length}/120`}>
        <input value={draft.contact_label} onChange={(event) => onChange({ contact_label: event.target.value })} maxLength={120} aria-invalid={Boolean(errors.contact_label)} placeholder="例如：创始人 / 商务负责人" />
      </Field>
      <Field label="沟通摘要" error={errors.summary} counter={`${Array.from(draft.summary).length}/2000`}>
        <textarea value={draft.summary} onChange={(event) => onChange({ summary: event.target.value })} maxLength={2000} aria-invalid={Boolean(errors.summary)} placeholder="记录对方反馈、确认事项和关键上下文" rows={6} required />
      </Field>
      <Field label="下一步动作（选填）" error={errors.next_action} counter={`${Array.from(draft.next_action).length}/500`}>
        <textarea value={draft.next_action} onChange={(event) => onChange({ next_action: event.target.value })} maxLength={500} aria-invalid={Boolean(errors.next_action)} placeholder="例如：周五发送修订版商务方案" rows={3} />
      </Field>
      <Field label="下次跟进日期（选填）" error={errors.next_follow_up_date}>
        <input type="date" value={draft.next_follow_up_date} min={occurredDate || undefined} onChange={(event) => onChange({ next_follow_up_date: event.target.value })} aria-invalid={Boolean(errors.next_follow_up_date)} />
      </Field>
      <p className="communication-form-help">填写日期时必须同时填写下一步动作；保存后会自动进入日历。不填日期会保留原提醒。</p>
      {saveError ? <div className="communication-form-notice error" role="alert"><AlertTriangle size={15} />{saveError}</div> : null}
      {saveSuccess ? <div className="communication-form-notice success" role="status"><CheckCircle2 size={15} />{saveSuccess}</div> : null}
      <button className="communication-submit" type="submit" disabled={saving} aria-busy={saving}>
        <Send size={16} />{saving ? "保存中…" : "保存沟通记录"}
      </button>
      <small className="communication-append-note">沟通历史为追加记录，第一版不支持编辑或删除；需要修正时请新增一条记录。</small>
    </form>
  </section>;
}

function Field({ label, error, counter, children }: { label: string; error?: string; counter?: string; children: React.ReactNode }) {
  return <label className="communication-field">
    <span><strong>{label}</strong>{counter ? <small>{counter}</small> : null}</span>
    {children}
    {error ? <em>{error}</em> : null}
  </label>;
}

function InteractionTimeline({
  lead,
  timeline,
  onRetry,
  onLoadMore
}: {
  lead: Lead;
  timeline: TimelineState;
  onRetry: () => void;
  onLoadMore: (cursor: string) => void;
}) {
  return <section className="communication-timeline-card">
    <div className="communication-panel-title">
      <div><History size={17} /><h3>沟通时间线</h3></div>
      <span>{timeline.status === "loaded" ? `${timeline.interactions.length} 条` : lead.project}</span>
    </div>
    {timeline.status === "loading" ? <div className="communication-timeline-state"><Clock3 size={20} />正在加载该项目的沟通历史…</div> : null}
    {timeline.status === "error" ? <div className="communication-timeline-state error">
      <AlertTriangle size={20} /><p>{timeline.error}</p><button type="button" onClick={onRetry}>重试</button>
    </div> : null}
    {timeline.status === "loaded" && !timeline.interactions.length ? <div className="communication-timeline-state">
      <MessageSquareText size={24} /><p>暂无沟通记录</p><small>保存第一条沟通后，历史会显示在这里。</small>
    </div> : null}
    {timeline.interactions.length ? <div className="communication-timeline-list">{timeline.interactions.map((interaction) => (
      <InteractionCard interaction={interaction} key={interaction.id} />
    ))}</div> : null}
    {timeline.error && timeline.status === "loaded" ? <div className="communication-inline-error">{timeline.error}</div> : null}
    {timeline.nextCursor ? <button className="communication-load-more" type="button" disabled={timeline.loadingMore} onClick={() => onLoadMore(timeline.nextCursor!)}>
      {timeline.loadingMore ? "加载中…" : "加载更早记录"}
    </button> : null}
  </section>;
}

function InteractionCard({ interaction }: { interaction: InteractionEvent }) {
  return <article className="communication-timeline-item">
    <div className="communication-timeline-dot" aria-hidden="true" />
    <div className="communication-timeline-item-head">
      <div><strong>{interaction.channel}</strong>{interaction.contact_label ? <span>{interaction.contact_label}</span> : null}</div>
      <time dateTime={interaction.occurred_at}>{formatInteractionTime(interaction.occurred_at)}</time>
    </div>
    <p>{interaction.summary}</p>
    {interaction.next_action ? <div className="communication-timeline-next">
      <span>下一步</span><strong>{interaction.next_action}</strong>
      {interaction.next_follow_up_date ? <small><CalendarDays size={13} />{interaction.next_follow_up_date}{interaction.calendar_synced ? " · 已入日历" : ""}</small> : null}
    </div> : null}
    <footer>{interaction.actor.display_name || interaction.actor.username} · 记录于 {formatInteractionTime(interaction.created_at)}</footer>
  </article>;
}

function normalizedContacts(lead: Lead): ContactMethod[] {
  if (lead.contact_methods.length) return lead.contact_methods;
  return lead.contact?.trim() ? [{ type: "其他", value: lead.contact.trim() }] : [];
}

function contactHref(contact: ContactMethod) {
  if (contact.type === "Email" && contact.value.includes("@")) return `mailto:${contact.value}`;
  if (contact.type === "电话") return `tel:${contact.value.replace(/\s+/g, "")}`;
  if (/^https?:\/\//i.test(contact.value)) return contact.value;
  return null;
}

function formatInteractionTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric"
  }).format(date);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
