import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type ReportHistoryControlsProps = {
  availableDates?: string[];
  isFallback?: boolean;
  noun: string;
  onDateChange: (date: string) => void;
  reportDate?: string;
  requestedDate?: string;
};

export function ReportHistoryControls({
  availableDates,
  isFallback,
  noun,
  onDateChange,
  reportDate,
  requestedDate
}: ReportHistoryControlsProps) {
  const dates = useMemo(() => Array.from(new Set((availableDates ?? []).filter(Boolean))).sort((a, b) => b.localeCompare(a)), [availableDates]);
  const dateSet = useMemo(() => new Set(dates), [dates]);
  const selectedDate = reportDate ?? dates[0] ?? "";
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(monthFromDate(selectedDate));
  const pickerRef = useRef<HTMLDivElement>(null);
  const showPicker = dates.length > 0;
  const fallbackNote = isFallback && reportDate && requestedDate && reportDate !== requestedDate
    ? `${requestedDate} 尚未生成，先保留最近一次有效${noun}：${reportDate}。`
    : "";
  const historyNote = !fallbackNote && dates.length > 1 ? `可回看最近 ${dates.length} 次记录。` : "";
  const minMonth = dates[dates.length - 1]?.slice(0, 7) ?? visibleMonth;
  const maxMonth = dates[0]?.slice(0, 7) ?? visibleMonth;
  const monthDays = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);

  useEffect(() => {
    setVisibleMonth(monthFromDate(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (pickerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  if (!showPicker && !fallbackNote) return null;

  return <div className="report-history-controls">
    {showPicker && <div className="report-history-picker" ref={pickerRef}>
      <span>回看</span>
      <div className="report-date-picker">
        <button className="report-date-button" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="dialog">
          <CalendarDays size={15} />
          <strong>{selectedDate}</strong>
        </button>
        {open && <div className="report-calendar-popover" role="dialog" aria-label={`${noun}历史日期`}>
          <div className="report-calendar-head">
            <button type="button" onClick={() => setVisibleMonth(shiftMonth(visibleMonth, -1))} disabled={visibleMonth <= minMonth} aria-label="上个月"><ChevronLeft size={16} /></button>
            <strong>{monthLabel(visibleMonth)}</strong>
            <button type="button" onClick={() => setVisibleMonth(shiftMonth(visibleMonth, 1))} disabled={visibleMonth >= maxMonth} aria-label="下个月"><ChevronRight size={16} /></button>
          </div>
          <div className="report-calendar-weekdays">{weekDays.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="report-calendar-grid">
            {monthDays.map((day, index) => day
              ? <button
                className={day.date === selectedDate ? "selected" : ""}
                disabled={!dateSet.has(day.date)}
                key={day.date}
                onClick={() => {
                  onDateChange(day.date);
                  setOpen(false);
                }}
                title={dateSet.has(day.date) ? `${day.date} 有历史记录` : `${day.date} 暂无记录`}
                type="button"
              >
                {day.label}
              </button>
              : <span aria-hidden="true" key={`blank-${index}`} />)}
          </div>
          <p className="report-calendar-hint">只有有记录的日期可选。</p>
        </div>}
      </div>
    </div>}
    {(fallbackNote || historyNote) && <div className="freshness-note">{fallbackNote || historyNote}</div>}
  </div>;
}

const weekDays = ["一", "二", "三", "四", "五", "六", "日"];

function monthFromDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  return `${year}年${monthNumber}月`;
}

function buildMonthDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1));
  const startOffset = firstDay.getUTCDay() === 0 ? 6 : firstDay.getUTCDay() - 1;
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const days: ({ date: string; label: number } | null)[] = Array.from({ length: startOffset }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({
      date: `${month}-${String(day).padStart(2, "0")}`,
      label: day
    });
  }

  return days;
}
