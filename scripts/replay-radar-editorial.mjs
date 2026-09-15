import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {curateRadarSignals,loadRadarHistory} from "../automations/jobs/online_daily_v4_radar.mjs";
import {assessRadarRelevance} from "../automations/jobs/online_daily_v4_radar_editorial.mjs";
import {buildDailyRuleConfig} from "../automations/jobs/online_daily_v4_rules.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const rules=buildDailyRuleConfig(JSON.parse(await readFile(path.join(root,"automations/rules/daily-report.json"),"utf8")));
const sources=[...rules.mediaSources,...rules.radarSources];
const byName=new Map(sources.map(source=>[source.name,source]));
const dates=["2026-09-12","2026-09-13","2026-09-14","2026-09-15"];
const output=[];
for(const reportDate of dates){
  const report=JSON.parse(await readFile(path.join(root,"data/radar",reportDate+".json"),"utf8"));
  const external=report.items.filter(item=>item.source!=="CRM Online Scan");
  // Historical cards have no publication field. This replay tests curation only,
  // with a fixed synthetic publication date; it is never production evidence of freshness.
  const input=external.map(item=>({...item,published_at:reportDate+"T09:00:00+08:00",
    source_focus:byName.get(item.source)?.focus??[],source_quality:byName.get(item.source)?.quality??10}));
  const history=await loadRadarHistory({rootDir:root,reportDate});
  const result=curateRadarSignals(input,{reportDate,capturedAt:reportDate+"T23:00:00+08:00",
    history:history.reports,diversity:rules.radarDiversity,sources});
  const again=curateRadarSignals(input,{reportDate,capturedAt:reportDate+"T23:00:00+08:00",
    history:[...history.reports,report],diversity:rules.radarDiversity,sources});
  assert.deepEqual(result,again,"same-day history must not empty a rerun");
  assert.ok(result.signals.length<=40);
  assert.ok(Object.values(result.diagnostics.sources).every(count=>count<=3));
  assert.ok(Object.values(result.diagnostics.regions).every(count=>count<=24));
  const selected=new Set(result.signals.map(item=>item.link));
  output.push({report_date:reportDate,before:external.length,after:result.signals.length,
    diagnostics:result.diagnostics,removed:external.filter(item=>!selected.has(item.link)).map(item=>({source:item.source,title:item.title,assessment:assessRadarRelevance(item)}))});
}
console.log(JSON.stringify({mode:"archived_curation_only_synthetic_publication_dates",editions:output},null,2));
