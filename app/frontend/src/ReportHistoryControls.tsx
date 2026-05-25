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
  const dates = (availableDates ?? []).filter(Boolean);
  const selectedDate = reportDate ?? dates[0] ?? "";
  const showPicker = dates.length > 0;
  const fallbackNote = isFallback && reportDate && requestedDate && reportDate !== requestedDate
    ? `${requestedDate} 尚未生成，先保留最近一次有效${noun}：${reportDate}。`
    : "";
  const historyNote = !fallbackNote && dates.length > 1 ? `可回看最近 ${dates.length} 次记录。` : "";

  if (!showPicker && !fallbackNote) return null;

  return <div className="report-history-controls">
    {showPicker && <label className="report-history-picker">
      <span>回看</span>
      <select value={selectedDate} onChange={(event) => onDateChange(event.target.value)}>
        {dates.map((date) => <option key={date} value={date}>{date}</option>)}
      </select>
    </label>}
    {(fallbackNote || historyNote) && <div className="freshness-note">{fallbackNote || historyNote}</div>}
  </div>;
}
