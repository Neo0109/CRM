import { ExternalLink } from "lucide-react";
import type { SteamTrendReport } from "./types";

export function SteamTrendsPage({ report, loading }: { report: SteamTrendReport | null; loading: boolean }) {
  if (loading) return <section className="radar-shell"><div className="empty-cell">加载 Steam 趋势中</div></section>;

  const marketInsights = report?.market_insights ?? [];
  const genreSignals = report?.genre_signals ?? [];
  const items = report?.items ?? [];
  const hasContent = marketInsights.length > 0 || genreSignals.length > 0 || items.length > 0;

  return <section className="radar-shell">
    <div className="radar-head"><div><p className="eyebrow">{report?.report_date ?? "今日"}</p><h2>Steam 趋势</h2></div><p>{report?.summary ?? "暂无 Steam 趋势数据"}</p></div>
    {report?.sync_result && <div className="notice">已自动合并 CRM 候选：新增 {report.sync_result.created}，更新 {report.sync_result.updated}，当前总数 {report.sync_result.total}</div>}

    {marketInsights.length > 0 && <div className="radar-band">
      <h3>大盘观察</h3>
      <div className="radar-grid">{marketInsights.map((insight) => <article className="radar-card" key={insight.id}>
        <div className="radar-card-head"><span className={`heat heat-${insight.signal_level}`}>{insight.signal_level}</span><strong>{insight.title}</strong></div>
        <p>{insight.summary}</p>
        <dl><div><dt>来源</dt><dd>{insight.source}</dd></div><div><dt>BD 动作</dt><dd>{insight.suggested_action}</dd></div></dl>
        <div className="link-list"><a href={insight.link} target="_blank" rel="noreferrer"><ExternalLink size={14} />{linkLabel(insight.link)}</a></div>
      </article>)}</div>
    </div>}

    {genreSignals.length > 0 && <div className="radar-band">
      <h3>品类信号</h3>
      <div className="radar-grid">{genreSignals.map((signal) => <article className="radar-card" key={signal.id}>
        <div className="radar-card-head"><span className="heat heat-中">品类</span><strong>{signal.genre}</strong></div>
        <p>{signal.signal}</p>
        <dl><div><dt>为什么重要</dt><dd>{signal.why_it_matters}</dd></div><div><dt>筛选动作</dt><dd>{signal.bd_action}</dd></div></dl>
        <div className="link-list">{visibleLinks(signal.links).map((link) => <a key={link} href={link} target="_blank" rel="noreferrer"><ExternalLink size={14} />{linkLabel(link)}</a>)}</div>
      </article>)}</div>
    </div>}

    {items.length > 0 && <div className="radar-band">
      <h3>候选与样本</h3>
      <div className="radar-grid">{items.map((item) => <article className="radar-card" key={item.id}>
        <div className="radar-card-head"><span className={`heat ${item.auto_import ? "heat-高" : "heat-中"}`}>{item.auto_import ? "入库" : "观察"}</span><strong>{item.title}</strong></div>
        <p>{item.signal}</p>
        <dl><div><dt>趋势来源</dt><dd>{[item.rank_bucket, item.source].filter(Boolean).join(" · ")}</dd></div><div><dt>B站适配</dt><dd>{item.bilibili_fit}</dd></div><div><dt>判断</dt><dd>{item.reason ?? "待复核"}</dd></div></dl>
        <div className="link-list">{visibleLinks(item.links).map((link) => <a key={link} href={link} target="_blank" rel="noreferrer"><ExternalLink size={14} />{linkLabel(link)}</a>)}</div>
      </article>)}</div>
    </div>}

    {!hasContent && <div className="radar-empty">等待今日自动化写入 Steam 趋势</div>}
  </section>;
}

function visibleLinks(links: string[]) {
  return (links ?? []).filter(Boolean).slice(0, 4);
}

function linkLabel(link: string) {
  if (link.includes("steamdb.info/charts")) return "SteamDB 大盘";
  if (link.includes("steamdb.info/sales")) return "SteamDB 促销";
  if (link.includes("store.steampowered.com/sale/nextfest")) return "Steam 新品节";
  if (link.includes("filter=popularcomingsoon")) return "热门即将推出";
  if (link.includes("filter=popularnew")) return "热门新品";
  if (link.includes("filter=topsellers")) return "热销榜";
  if (link.includes("store.steampowered.com/tags")) return tagLabel(link);
  if (link.includes("store.steampowered.com/app/")) return "Steam";
  if (link.includes("steamdb.info/app/")) return "SteamDB";
  return "来源";
}

function tagLabel(link: string) {
  const rawTag = link.split("/tags/en/")[1]?.replace(/\/$/, "");
  if (!rawTag) return "Steam 标签";
  return decodeURIComponent(rawTag.replace(/\+/g, " "));
}
