import { ExternalLink } from "lucide-react";
import { ReportHistoryControls } from "../../ReportHistoryControls";
import type { RadarCategory, RadarReport } from "../../types";

const radarCategories: RadarCategory[] = ["行业新闻", "发行八卦", "AI 游戏", "新梗热点", "B站趋势"];

export function RadarPage({ radar, loading, onDateChange }: { radar: RadarReport | null; loading: boolean; onDateChange: (date: string) => void }) {
  if (loading) return <section className="radar-shell"><div className="empty-cell">加载行业雷达中</div></section>;
  return <section className="radar-shell">
    <div className="radar-head">
      <div className="report-head-main"><div><p className="eyebrow">{radar?.report_date ?? "今日"}</p><h2>行业雷达</h2></div><p>{radar?.summary ?? "暂无雷达数据"}</p></div>
      <ReportHistoryControls
        availableDates={radar?.available_dates}
        isFallback={radar?.is_fallback}
        noun="行业雷达"
        onDateChange={onDateChange}
        reportDate={radar?.report_date}
        requestedDate={radar?.requested_date}
      />
    </div>
    {(radarCategoryNames(radar) ?? radarCategories).map((category) => {
      const items = radar?.items.filter((item) => item.category === category) ?? [];
      return <section className="radar-band" key={category}>
        <h3>{category}</h3>
        {items.length ? <div className="radar-grid">{items.map((item) => <article className="radar-card" key={item.id}>
          <div className="radar-card-head"><span className={`heat heat-${item.heat}`}>{item.heat}</span><strong>{item.title}</strong></div>
          <p>{item.summary}</p>
          <dl><div><dt>BD 相关</dt><dd>{item.relevance}</dd></div><div><dt>建议动作</dt><dd>{item.suggested_action}</dd></div></dl>
          <a href={item.link} target="_blank" rel="noreferrer"><ExternalLink size={14} />{item.source}</a>
        </article>)}</div> : <div className="radar-empty">这一天暂无该类记录；可以用上方回看保留的历史内容。</div>}
      </section>;
    })}
  </section>;
}

export function radarCategoryNames(radar: RadarReport | null) {
  const categories = Array.from(new Set((radar?.items ?? []).map((item) => item.category).filter(Boolean)));
  return categories.length ? categories : null;
}
