import { CalendarDays, ChevronLeft, ChevronRight, Clock3, ExternalLink, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { fetchLeads, updateLead } from "./api";
import type { Lead } from "./types";

type SteamEventKind = "seasonal" | "next" | "fest";
type SteamEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  kind: SteamEventKind;
  note: string;
  link: string;
};

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

const officialSteamEvents: SteamEvent[] = [
  { id: "steam-spring-sale-2026", title: "Steam 春季特卖", start: "2026-03-19", end: "2026-03-26", kind: "seasonal", note: "官方季节性特卖", link: steamEventsSource },
  { id: "steam-summer-sale-2026", title: "Steam 夏季特卖", start: "2026-06-25", end: "2026-07-09", kind: "seasonal", note: "官方季节性特卖", link: steamEventsSource },
  { id: "steam-autumn-sale-2026", title: "Steam 秋季特卖", start: "2026-10-01", end: "2026-10-08", kind: "seasonal", note: "官方季节性特卖", link: steamEventsSource },
  { id: "steam-winter-sale-2026", title: "Steam 冬季特卖", start: "2026-12-17", end: "2027-01-04", kind: "seasonal", note: "官方季节性特卖", link: steamEventsSource },
  { id: "detective-fest-2026", title: "Detective Fest", start: "2026-01-12", end: "2026-01-19", kind: "fest", note: "侦探主题官方活动", link: steamEventsSource },
  { id: "board-game-fest-2026", title: "Board Game Fest", start: "2026-01-26", end: "2026-02-02", kind: "fest", note: "桌游主题官方活动", link: steamEventsSource },
  { id: "typing-fest-2026", title: "Typing Fest", start: "2026-02-05", end: "2026-02-09", kind: "fest", note: "打字主题官方活动", link: steamEventsSource },
  { id: "pvp-fest-2026", title: "Combat PvP Fest", start: "2026-02-09", end: "2026-02-16", kind: "fest", note: "PvP 主题官方活动", link: steamEventsSource },
  { id: "horse-fest-2026", title: "Horse Fest", start: "2026-02-19", end: "2026-02-23", kind: "fest", note: "马主题官方活动", link: steamEventsSource },
  { id: "tower-defense-fest-2026", title: "Tower Defense Fest", start: "2026-03-09", end: "2026-03-16", kind: "fest", note: "塔防主题官方活动", link: steamEventsSource },
  { id: "house-home-fest-2026", title: "House & Home Fest", start: "2026-03-30", end: "2026-04-06", kind: "fest", note: "居家主题官方活动", link: steamEventsSource },
  { id: "hidden-object-fest-2026", title: "Hidden Object Fest", start: "2026-04-09", end: "2026-04-13", kind: "fest", note: "找物主题官方活动", link: steamEventsSource },
  { id: "medieval-fest-2026", title: "Medieval Fest", start: "2026-04-20", end: "2026-04-27", kind: "fest", note: "中世纪主题官方活动", link: steamEventsSource },
  { id: "deckbuilders-fest-2026", title: "Deckbuilders Fest", start: "2026-05-04", end: "2026-05-11", kind: "fest", note: "卡牌构筑主题官方活动", link: steamEventsSource },
  { id: "ocean-fest-2026", title: "Ocean Fest", start: "2026-05-18", end: "2026-05-25", kind: "fest", note: "海洋主题官方活动", link: steamEventsSource },
  { id: "bullet-fest-2026", title: "Bullet Fest", start: "2026-06-08", end: "2026-06-15", kind: "fest", note: "弹幕/射击主题官方活动", link: steamEventsSource },
  { id: "social-deduction-fest-2026", title: "Social Deduction Fest", start: "2026-07-13", end: "2026-07-16", kind: "fest", note: "社交推理主题官方活动", link: steamEventsSource },
  { id: "train-fest-2026", title: "Train Fest", start: "2026-07-20", end: "2026-07-27", kind: "fest", note: "火车主题官方活动", link: steamEventsSource },
  { id: "cyberpunk-fest-2026", title: "Cyberpunk Fest", start: "2026-08-03", end: "2026-08-10", kind: "fest", note: "赛博朋克主题官方活动", link: steamEventsSource },
  { id: "pins-pegs-fest-2026", title: "Pins & Pegs Fest", start: "2026-08-17", end: "2026-08-20", kind: "fest", note: "弹珠/保龄/柏青哥主题官方活动", link: steamEventsSource },
  { id: "pve-survival-crafting-fest-2026", title: "PvE Survival Crafting Fest", start: "2026-08-31", end: "2026-09-07", kind: "fest", note: "PvE 生存制作主题官方活动", link: steamEventsSource },
  { id: "programming-fest-2026", title: "Programming Fest", start: "2026-09-10", end: "2026-09-14", kind: "fest", note: "编程/逻辑挑战主题官方活动", link: steamEventsSource },
  { id: "party-based-rpg-fest-2026", title: "Party-Based RPG Fest", start: "2026-09-14", end: "2026-09-21", kind: "fest", note: "队伍制 RPG 主题官方活动", link: steamEventsSource },
  { id: "cooking-fest-2026", title: "Cooking Fest", start: "2026-10-12", end: "2026-10-19", kind: "fest", note: "烹饪主题官方活动", link: steamEventsSource },
  { id: "steam-scream-v-2026", title: "Steam Scream V", start: "2026-10-26", end: "2026-11-02", kind: "fest", note: "恐怖/Halloween 主题官方活动", link: steamEventsSource },
  { id: "auto-battler-rpg-fest-2026", title: "Auto-Battler RPG Fest", start: "2026-11-16", end: "2026-11-23", kind: "fest", note: "自走棋 RPG 主题官方活动", link: steamEventsSource },
  { id: "next-fest-feb-2026", title: "Steam 新品节 2月", start: "2026-02-23", end: "2026-03-02", kind: "next", note: "Demo / 未发售项目重点观察", link: steamEventsSource },
  { id: "next-fest-jun-2026", title: "Steam 新品节 6月", start: "2026-06-15", end: "2026-06-22", kind: "next", note: "Demo / 未发售项目重点观察", link: "https://store.steampowered.com/sale/nextfest" },
  { id: "next-fest-oct-2026", title: "Steam 新品节 10月", start: "2026-10-19", end: "2026-10-26", kind: "next", note: "Demo / 未发售项目重点观察", link: steamEventsSource }
];

const steamEventsSource = "https://partner.steamgames.com/doc/marketing/upcoming_events";
const weekDays = ["一", "二", "三", "四", "五", "六", "日"];

export function CalendarLauncher() {
  const [host, setHost] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const updateHost = () => setHost(document.querySelector(".actions"));
    updateHost();
    const observer = new MutationObserver(updateHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const versionLabel = document.querySelector<HTMLElement>(".hero-copy .eyebrow");
    if (versionLabel && /v\d+\.\d+(?:\.\d+)?/.test(versionLabel.textContent ?? "")) {
      versionLabel.textContent = (versionLabel.textContent ?? "").replace(/v\d+\.\d+(?:\.\d+)?/, "v1.3.0");
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

  useEffect(() => {
    void reload();
  }, []);

  const reminderEvents = useMemo<CalendarEvent[]>(() => leads
    .filter((lead) => lead.due_date && lead.bucket !== "淘汰池")
    .map((lead) => ({
      id: `lead-${lead.id}`,
      title: lead.project,
      start: lead.due_date!,
      end: lead.due_date!,
      kind: "lead",
      note: `${lead.bucket} · ${lead.priority}${lead.owner ? ` · ${lead.owner}` : ""}`,
      lead
    })), [leads]);

  const steamEvents = useMemo<CalendarEvent[]>(() => officialSteamEvents.map((event) => ({ ...event, kind: event.kind })), []);
  const allEvents = useMemo(() => [...reminderEvents, ...steamEvents], [reminderEvents, steamEvents]);
  const days = useMemo(() => buildMonthDays(month), [month]);
  const selectedEvents = allEvents.filter((event) => selectedDay && event.start <= selectedDay && event.end >= selectedDay);
  const followLeads = useMemo(() => leads.filter((lead) => lead.bucket === "跟进中").sort(compareFollowLeads), [leads]);
  const monthSteamEvents = officialSteamEvents.filter((event) => monthOverlaps(event.start, event.end, month));
  const today = todayKey();
  const overdueCount = followLeads.filter((lead) => lead.due_date && lead.due_date < today).length;
  const soonCount = followLeads.filter((lead) => lead.due_date && daysUntil(lead.due_date) >= 0 && daysUntil(lead.due_date) <= 14).length;
  const missingReminderCount = followLeads.filter((lead) => !lead.due_date).length;

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

  async function scheduleFollowUp(lead: Lead, months: number) {
    const dueDate = addMonths(todayKey(), months);
    await patchLead(lead, {
      bucket: "跟进中",
      stage: "active",
      review_status: "跟进中",
      reviewed_at: new Date().toISOString(),
      due_date: dueDate,
      next_action: lead.next_action ?? `${dueDate} 再跟进研发进度/发行窗口`
    });
  }

  return <div className="calendar-overlay" role="dialog" aria-modal="true" aria-label="CRM 日历">
    <section className="calendar-workspace">
      <header className="calendar-head">
        <div>
          <p className="eyebrow">CALENDAR · FOLLOW-UP</p>
          <h2>日历与长期跟进提醒</h2>
          <p>把跟进中项目的下次触达时间和 Steam 官方活动放在同一张日历里。</p>
        </div>
        <div className="calendar-head-actions">
          <button className="ghost-button" onClick={() => void reload()} disabled={loading}><RefreshCw size={16} />刷新</button>
          <a className="ghost-button" href={steamEventsSource} target="_blank" rel="noreferrer"><ExternalLink size={16} />Steam 官方日历</a>
          <button className="icon-button" onClick={onClose} aria-label="关闭日历"><X size={18} /></button>
        </div>
      </header>

      {error && <div className="notice error">{error}</div>}

      <div className="calendar-metrics">
        <div className="calendar-metric"><span>跟进中</span><strong>{followLeads.length}</strong></div>
        <div className="calendar-metric danger"><span>已过期</span><strong>{overdueCount}</strong></div>
        <div className="calendar-metric warn"><span>14天内</span><strong>{soonCount}</strong></div>
        <div className="calendar-metric"><span>未设提醒</span><strong>{missingReminderCount}</strong></div>
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
            <div className="calendar-panel-head"><h3>跟进提醒</h3><span>{loading ? "..." : followLeads.length}</span></div>
            {loading ? <div className="calendar-empty">加载中</div> : followLeads.length ? <div className="follow-reminder-list">{followLeads.map((lead) => <article className="follow-reminder-card" key={lead.id}>
              <div>
                <strong>{lead.project}</strong>
                <small>{lead.due_date ? reminderText(lead.due_date) : "未设置下次跟进日"}</small>
              </div>
              <p>{lead.next_action ?? lead.priority_reason ?? "等待补充下一步动作"}</p>
              <div className="follow-reminder-actions">
                <button onClick={() => void scheduleFollowUp(lead, 1)} disabled={savingId === lead.id}><Clock3 size={14} />1个月</button>
                <button onClick={() => void scheduleFollowUp(lead, 2)} disabled={savingId === lead.id}><Clock3 size={14} />2个月</button>
                <button onClick={() => void patchLead(lead, { due_date: null })} disabled={savingId === lead.id}>清除</button>
              </div>
            </article>)}</div> : <div className="calendar-empty">暂无跟进中项目。把 Lead 移入“跟进中”后会出现在这里。</div>}
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
  if (!a.due_date && !b.due_date) return a.project.localeCompare(b.project, "zh-CN");
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date.localeCompare(b.due_date) || a.project.localeCompare(b.project, "zh-CN");
}

function reminderText(date: string) {
  const diff = daysUntil(date);
  if (diff < 0) return `${formatDate(date)} · 已过期 ${Math.abs(diff)} 天`;
  if (diff === 0) return `${formatDate(date)} · 今天跟进`;
  if (diff <= 14) return `${formatDate(date)} · ${diff} 天后`;
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
