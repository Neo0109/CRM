import { CalendarDays, ChevronLeft, ChevronRight, Clock3, ExternalLink, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { fetchLeads, updateLead } from "./api";
import { productVersion } from "./productVersion";
import { officialSteamEvents, steamEventsSource, type SteamEventKind } from "./steamEvents";
import type { Lead } from "./types";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  kind: "lead" | SteamEventKind;
  note: string;
  link?: string;
  lead?: Lead;
};

type ReminderChoice = "14d" | "1m" | "6w" | "2m" | "3m" | "6m" | "custom";

type ReminderOption = {
  value: ReminderChoice;
  label: string;
  days?: number;
  months?: number;
};

const weekDays = ["一", "二", "三", "四", "五", "六", "日"];
const reminderOptions: ReminderOption[] = [
  { value: "14d", label: "2周后", days: 14 },
  { value: "1m", label: "1个月后", months: 1 },
  { value: "6w", label: "6周后", days: 42 },
  { value: "2m", label: "2个月后", months: 2 },
  { value: "3m", label: "3个月后", months: 3 },
  { value: "6m", label: "6个月后", months: 6 },
  { value: "custom", label: "指定日期" }
];

export function CalendarLauncher() {
  const [host, setHost] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const updateHost = () => setHost(document.querySelector(".nav-extension-host") ?? document.querySelector(".actions"));
    updateHost();
    const observer = new MutationObserver(updateHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const versionLabel = document.querySelector<HTMLElement>(".hero-copy .eyebrow");
    if (versionLabel && /v\d+\.\d+(?:\.\d+)?/.test(versionLabel.textContent ?? "")) {
      versionLabel.textContent = (versionLabel.textContent ?? "").replace(/v\d+\.\d+(?:\.\d+)?/, productVersion);
    }
  }, []);

  const button = <button className={`tab-button ${open ? "active" : ""}`} onClick={() => setOpen(true)} type="button"><CalendarDays size={16} />日历</button>;

  return <>
    {host ? createPortal(button, host) : <div className="calendar-fallback-entry">{button}</div>}
    {open && createPortal(<CalendarWorkspace onClose={() => setOpen(false)} />, document.body)}
  </>;
}

function CalendarWorkspace({ onClose }: { onClose: () => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(monthStart(todayKey()));
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [choiceByLead, setChoiceByLead] = useState<Record<string, ReminderChoice>>({});
  const [customDateByLead, setCustomDateByLead] = useState<Record<string, string>>({});

  useEffect(() => {
    void reload();
  }, []);

  const calendarLeads = useMemo(() => leads.filter(isLeadCalendarVisible), [leads]);
  const reminderEvents = useMemo<CalendarEvent[]>(() => calendarLeads
    .filter((lead) => lead.bucket !== "淘汰池")
    .map((lead) => ({
      id: `lead-${lead.id}`,
      title: lead.project,
      start: lead.due_date!,
      end: lead.due_date!,
      kind: "lead",
      note: `${lead.bucket} · ${lead.priority}${lead.owner ? ` · ${lead.owner}` : ""}`,
      lead
    })), [calendarLeads]);

  const steamEvents = useMemo<CalendarEvent[]>(() => officialSteamEvents.map((event) => ({ ...event, kind: event.kind })), []);
  const allEvents = useMemo(() => [...reminderEvents, ...steamEvents], [reminderEvents, steamEvents]);
  const days = useMemo(() => buildMonthDays(month), [month]);
  const selectedEvents = allEvents.filter((event) => selectedDay && event.start <= selectedDay && event.end >= selectedDay);
  const followLeads = useMemo(() => leads.filter((lead) => lead.bucket === "跟进中").sort(compareFollowLeads), [leads]);
  const monthSteamEvents = officialSteamEvents.filter((event) => monthOverlaps(event.start, event.end, month));
  const today = todayKey();
  const overdueCount = calendarLeads.filter((lead) => lead.due_date && lead.due_date < today).length;
  const soonCount = calendarLeads.filter((lead) => lead.due_date && daysUntil(lead.due_date) >= 0 && daysUntil(lead.due_date) <= 14).length;
  const pendingFollowCount = followLeads.filter((lead) => !isLeadCalendarVisible(lead)).length;

  async function reload() {
    try {
      setLoading(true);
      setLeads(await fetchLeads());
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "日历加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function patchLead(lead: Lead, patch: Partial<Lead>) {
    try {
      setSavingId(lead.id);
      const updated = await updateLead(lead.id, patch);
      setLeads((current) => current.map((item) => item.id === lead.id ? updated : item));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "保存提醒失败");
    } finally {
      setSavingId(null);
    }
  }

  async function scheduleFollowUp(lead: Lead) {
    const choice = choiceByLead[lead.id] ?? "1m";
    const dueDate = dueDateFromChoice(choice, customDateByLead[lead.id]);
    if (!dueDate) {
      setError("请先选择一个具体日期");
      return;
    }

    await patchLead(lead, {
      bucket: "跟进中",
      stage: "active",
      review_status: "跟进中",
      reviewed_at: new Date().toISOString(),
      due_date: dueDate,
      calendar_enabled: true,
      follow_up_interval: choice,
      next_action: lead.next_action ?? `${dueDate} 再跟进研发进度/发行窗口`
    });
  }

  async function removeCalendarReminder(lead: Lead) {
    await patchLead(lead, {
      due_date: null,
      calendar_enabled: false,
      follow_up_interval: null
    });
  }

  return <div className="calendar-overlay" role="dialog" aria-modal="true" aria-label="CRM 日历">
    <section className="calendar-workspace">
      <header className="calendar-head">
        <div>
          <p className="eyebrow">CALENDAR · FOLLOW-UP</p>
          <h2>日历与长期跟进提醒</h2>
          <p>日历只显示你手动加入的 Lead 提醒；Steam 官方活动默认显示，避免日程被自动导入的线索淹没。</p>
        </div>
        <div className="calendar-head-actions">
          <button className="ghost-button" onClick={() => void reload()} disabled={loading}><RefreshCw size={16} />刷新</button>
          <a className="ghost-button" href={steamEventsSource} target="_blank" rel="noreferrer"><ExternalLink size={16} />Steam 官方日历</a>
          <button className="icon-button" onClick={onClose} aria-label="关闭日历"><X size={18} /></button>
        </div>
      </header>

      {error && <div className="notice error">{error}</div>}

      <div className="calendar-metrics">
        <div className="calendar-metric"><span>日历提醒</span><strong>{calendarLeads.length}</strong></div>
        <div className="calendar-metric danger"><span>已过期</span><strong>{overdueCount}</strong></div>
        <div className="calendar-metric warn"><span>14天内</span><strong>{soonCount}</strong></div>
        <div className="calendar-metric"><span>跟进中待加入</span><strong>{pendingFollowCount}</strong></div>
        <div className="calendar-metric steam"><span>本月 Steam 活动</span><strong>{monthSteamEvents.length}</strong></div>
      </div>

      <div className="calendar-layout">
        <section className="calendar-board">
          <div className="calendar-toolbar">
            <button className="icon-button" onClick={() => setMonth(addMonths(month, -1))} aria-label="上个月"><ChevronLeft size={18} /></button>
            <strong>{monthLabel(month)}</strong>
            <button className="icon-button" onClick={() => setMonth(addMonths(month, 1))} aria-label="下个月"><ChevronRight size={18} /></button>
            <button className="ghost-button" onClick={() => { const current = monthStart(todayKey()); setMonth(current); setSelectedDay(todayKey()); }}>回到今天</button>
          </div>

          <div className="calendar-weekdays">{weekDays.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">
            {days.map((day, index) => {
              const dayEvents = day ? allEvents.filter((event) => event.start <= day && event.end >= day) : [];
              return <button key={day ?? `empty-${index}`} className={`calendar-day ${day === selectedDay ? "selected" : ""} ${day === today ? "today" : ""} ${!day ? "blank" : ""}`} onClick={() => day && setSelectedDay(day)} disabled={!day} type="button">
                {day && <>
                  <span className="calendar-date-number">{Number(day.slice(-2))}</span>
                  <div className="calendar-day-events">
                    {dayEvents.slice(0, 4).map((event) => <span key={event.id} className={`calendar-event-dot ${event.kind}`}>{event.title}</span>)}
                    {dayEvents.length > 4 && <span className="calendar-event-more">+{dayEvents.length - 4}</span>}
                  </div>
                </>}
              </button>;
            })}
          </div>
        </section>

        <aside className="calendar-side">
          <section className="calendar-panel">
            <div className="calendar-panel-head"><h3>{formatDate(selectedDay)} 事项</h3><span>{selectedEvents.length}</span></div>
            {selectedEvents.length ? <div className="calendar-agenda-list">{selectedEvents.map((event) => <CalendarAgendaItem key={event.id} event={event} />)}</div> : <div className="calendar-empty">这一天没有提醒或 Steam 官方活动。</div>}
          </section>

          <section className="calendar-panel">
            <div className="calendar-panel-head"><h3>设置跟进提醒</h3><span>{loading ? "..." : followLeads.length}</span></div>
            {loading ? <div className="calendar-empty">加载中</div> : followLeads.length ? <div className="follow-reminder-list">{followLeads.map((lead) => {
              const choice = choiceByLead[lead.id] ?? (lead.follow_up_interval as ReminderChoice | null) ?? "1m";
              const enabled = isLeadCalendarVisible(lead);
              return <article className={`follow-reminder-card ${enabled ? "enabled" : ""}`} key={lead.id}>
                <div>
                  <strong>{lead.project}</strong>
                  <small>{enabled && lead.due_date ? `已加入日历 · ${reminderText(lead.due_date)}` : "未加入日历，不会显示在月历上"}</small>
                </div>
                <p>{lead.next_action ?? lead.priority_reason ?? "等待补充下一步动作"}</p>
                <div className="follow-reminder-controls">
                  <select value={choice} onChange={(event) => setChoiceByLead((current) => ({ ...current, [lead.id]: event.target.value as ReminderChoice }))}>
                    {reminderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  {choice === "custom" && <input type="date" value={customDateByLead[lead.id] ?? lead.due_date ?? ""} onChange={(event) => setCustomDateByLead((current) => ({ ...current, [lead.id]: event.target.value }))} />}
                </div>
                <div className="follow-reminder-actions">
                  <button onClick={() => void scheduleFollowUp(lead)} disabled={savingId === lead.id}><Clock3 size={14} />{enabled ? "更新提醒" : "加入日历"}</button>
                  {enabled && <button onClick={() => void removeCalendarReminder(lead)} disabled={savingId === lead.id}>移出日历</button>}
                </div>
              </article>;
            })}</div> : <div className="calendar-empty">暂无跟进中项目。先把 Lead 移入“跟进中”，再按需要加入日历提醒。</div>}
          </section>
        </aside>
      </div>
    </section>
  </div>;
}

function CalendarAgendaItem({ event }: { event: CalendarEvent }) {
  return <article className={`calendar-agenda-item ${event.kind}`}>
    <div>
      <strong>{event.title}</strong>
      <small>{event.start === event.end ? formatDate(event.start) : `${formatDate(event.start)} - ${formatDate(event.end)}`}</small>
    </div>
    <p>{event.note}</p>
    {event.link && <a href={event.link} target="_blank" rel="noreferrer"><ExternalLink size={14} />查看来源</a>}
  </article>;
}

function isLeadCalendarVisible(lead: Lead) {
  return Boolean(lead.calendar_enabled && lead.due_date && lead.bucket !== "淘汰池");
}

function dueDateFromChoice(choice: ReminderChoice, customDate?: string) {
  if (choice === "custom") return customDate || null;
  const option = reminderOptions.find((item) => item.value === choice);
  if (!option) return addMonths(todayKey(), 1);
  if (option.days) return addDays(todayKey(), option.days);
  if (option.months) return addMonths(todayKey(), option.months);
  return null;
}

function buildMonthDays(monthKey: string) {
  const first = parseDate(monthKey);
  const startOffset = (first.getDay() + 6) % 7;
  const totalDays = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(dateKey(new Date(first.getFullYear(), first.getMonth(), day)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function compareFollowLeads(a: Lead, b: Lead) {
  const enabledDiff = Number(isLeadCalendarVisible(b)) - Number(isLeadCalendarVisible(a));
  if (enabledDiff) return enabledDiff;
  if (!a.due_date && !b.due_date) return a.project.localeCompare(b.project, "zh-CN");
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date.localeCompare(b.due_date) || a.project.localeCompare(b.project, "zh-CN");
}

function reminderText(date: string) {
  const diff = daysUntil(date);
  if (diff < 0) return `${formatDate(date)} · 已过期 ${Math.abs(diff)} 天`;
  if (diff === 0) return `${formatDate(date)} · 今天跟进`;
  return `${formatDate(date)} · ${diff} 天后`;
}

function daysUntil(value: string) {
  const target = parseDate(value).getTime();
  const today = parseDate(todayKey()).getTime();
  return Math.round((target - today) / 86400000);
}

function monthOverlaps(start: string, end: string, monthKey: string) {
  const startOfMonth = monthStart(monthKey);
  const endOfMonth = dateKey(new Date(parseDate(startOfMonth).getFullYear(), parseDate(startOfMonth).getMonth() + 1, 0));
  return start <= endOfMonth && end >= startOfMonth;
}

function monthStart(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function addMonths(value: string, months: number) {
  const date = parseDate(value);
  date.setMonth(date.getMonth() + months);
  return dateKey(date);
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}/${Number(month)}/${Number(day)}`;
}
