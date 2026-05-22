import { ExternalLink } from "lucide-react";
import type { SteamTrendReport } from "./types";

export function SteamTrendsPage({ report, loading }: { report: SteamTrendReport | null; loading: boolean }) {
  if (loading) return <section className="radar-shell"><div className="empty-cell">加载 Steam 趋势中</div></section>;
  const items = report?.items ?? [];

  return <section className="radar-shell">
    <div className="radar-head"><div><p className="eyebrow">{report?.report_date ?? "今日"}</p><h2>Steam 趋势</h2></div><p>{report?.summary ?? "暂无 Steam 趋势数据"}</p></div>
    {report?.sync_result && <div className="notice">已自动合并 CRM 候选：新增 {report.sync_result.created}，更新 {report.sync_result.updated}，当前总数 {report.sync_result.total}</div>}
    {items.length ? <div className="radar-grid">{items.map((item) => <article className="radar-card" key={item.id}>
      <div className="radar-card-head"><span className={`heat ${item.auto_import ? "heat-高" : "heat-中"}`}>{item.auto_import ? "入库" : "观察"}</span><strong>{item.title}</strong></div>
      <p>{item.signal}</p>
      <dl><div><dt>趋势来源</dt><dd>{[item.rank_bucket, item.source].filter(Boolean).join(" · ")}</dd></div><div><dt>B站适配</dt><dd>{item.bilibili_fit}</dd></div><div><dt>判断</dt><dd>{item.reason ?? "待复核"}</dd></div></dl>
      <div className="link-list">{item.links.filter(isGameLink).slice(0, 2).map((link) => <a key={link} href={link} target="_blank" rel="noreferrer"><ExternalLink size={14} />{linkLabel(link)}</a>)}</div>
    </article>)}</div> : <div className="radar-empty">等待今日自动化写入 Steam 趋势</div>}
  </section>;
}

function isGameLink(link: string) {
  return /(?:store\.steampowered\.com|steamdb\.info)\/app\/\d+/i.test(link);
}

function linkLabel(link: string) {
  if (link.includes("store.steampowered.com")) return "Steam";
  if (link.includes("steamdb.info")) return "SteamDB";
  return "链接";
}
