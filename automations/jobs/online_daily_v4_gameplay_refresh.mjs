import { fetchText } from "./online_daily_v4_network.mjs";
import { evaluateMediaIndiePrelaunchAdmission, evaluateSteamIndiePrelaunchAdmission } from "./online_daily_v7_indie_admission.mjs";
import { extractSteamGameplayEvidence, OFFICIAL_GAMEPLAY_EVIDENCE_VERSION } from "./online_daily_v4_official_gameplay.mjs";

const keyOf = candidate => /^\d+$/.test(String(candidate.appId ?? candidate.steam_app_id ?? "")) ? "steam:"+String(candidate.appId ?? candidate.steam_app_id) : null;
const addDays = (date,days) => new Date(Date.parse(date+"T00:00:00Z")+days*86400000).toISOString().slice(0,10);
const merge = (...lists) => [...new Map(lists.flat().filter(Boolean).map(e=>[(e.type??"")+"|"+(e.url??e.value),e])).values()];
function validRecord(record,key,date) {
  return record?.version===OFFICIAL_GAMEPLAY_EVIDENCE_VERSION && record.steam_app_id===key.slice(6)
    && /^\d{4}-\d{2}-\d{2}$/.test(record.checked_on??"") && record.checked_on<=date
    && Array.isArray(record.evidence) && record.evidence.every(e=>e.steam_app_id===key.slice(6));
}
export async function refreshOfficialGameplayEvidence({
  steamCandidates=[],mediaCandidates=[],history=[],reportDate,maxOfficialLookups=12,diagnostics={},
  fetchTextImpl=fetchText
}={}) {
  const steam=steamCandidates.map(c=>({...c})), media=mediaCandidates.map(c=>({...c}));
  const records=new Map();
  for (const artifact of [...history].sort((a,b)=>String(a.report_date).localeCompare(String(b.report_date)))) {
    for (const c of artifact.candidates ?? []) {
      const key=c.dedupe_key, r=c.official_gameplay_lookup;
      if (typeof key==="string" && key.startsWith("steam:") && validRecord(r,key,reportDate)
        && r.checked_on>=addDays(reportDate,-7)) records.set(key,structuredClone(r));
    }
  }
  const groups=new Map();
  const apply=(item,evidence)=>{
    if (item.kind==="steam") item.candidate.officialGameplayEvidence=merge(item.candidate.officialGameplayEvidence??[],evidence);
    else item.candidate._officialGameplayEvidence=merge(item.candidate._officialGameplayEvidence??[],evidence);
  };
  for (const [kind,list] of [["steam",steam],["media",media]]) {
    for (const c of list) {
      const key=keyOf(c);if (!key) continue;
      const item={kind,candidate:c};
      const cached=records.get(key);
      if (cached?.status==="confirmed" && addDays(cached.checked_on,7)>reportDate) apply(item,cached.evidence);
      const admission=kind==="steam"?evaluateSteamIndiePrelaunchAdmission(c):evaluateMediaIndiePrelaunchAdmission(c);
      if (admission.disposition==="excluded" || !admission.failed_gates.includes("official_gameplay")) continue;
      const group=groups.get(key) ?? {key,items:[],gapCount:Infinity,firstSeen:reportDate};
      group.items.push(item);
      group.gapCount=Math.min(group.gapCount,admission.failed_gates.length);
      const previous=history.flatMap(a=>a.candidates??[]).filter(r=>r.dedupe_key===key).map(r=>r.first_seen).filter(Boolean).sort()[0];
      group.firstSeen=previous??reportDate;
      groups.set(key,group);
    }
  }
  const queue=[...groups.values()].sort((a,b)=>a.gapCount-b.gapCount
    || (records.get(a.key)?.checked_on??a.firstSeen).localeCompare(records.get(b.key)?.checked_on??b.firstSeen)
    || a.key.localeCompare(b.key));
  let attempts=0, recovered=0;
  const remaining=Math.max(0,Math.floor(maxOfficialLookups)-Number(diagnostics.bilibili_official_source_lookups??0));
  for (const group of queue) {
    if (records.get(group.key)?.checked_on===reportDate || attempts>=remaining) continue;
    attempts++;
    const appId=group.key.slice(6);
    let evidence=[],status="not_confirmed";
    try {
      const html=await fetchTextImpl("https://store.steampowered.com/app/"+appId+"/?l=english",{timeoutMs:12000});
      evidence=extractSteamGameplayEvidence({appId,storeHtml:html});
      if (evidence.length) { status="confirmed";recovered++; }
    } catch { status="fetch_failed"; }
    records.set(group.key,{version:OFFICIAL_GAMEPLAY_EVIDENCE_VERSION,steam_app_id:appId,checked_on:reportDate,status,evidence});
    for (const item of group.items) apply(item,evidence);
  }
  // Apply a newly found same-AppID result to every duplicate, including already-qualified inputs.
  for (const [kind,list] of [["steam",steam],["media",media]]) {
    for (const c of list) {
      const r=records.get(keyOf(c));
      if (r?.status==="confirmed" && addDays(r.checked_on,7)>reportDate) apply({kind,candidate:c},r.evidence);
    }
  }
  diagnostics.official_gameplay_lookup_attempts=attempts;
  diagnostics.official_gameplay_recovered=recovered;
  diagnostics.official_gameplay_deferred=queue.filter(g=>records.get(g.key)?.checked_on!==reportDate).length;
  return {steamCandidates:steam,mediaCandidates:media,lookupResults:records,diagnostics};
}
