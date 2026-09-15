import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../jobs/online_daily_v4_rules.mjs";
import { extractSteamGameplayEvidence } from "../jobs/online_daily_v4_official_gameplay.mjs";
import { refreshOfficialGameplayEvidence } from "../jobs/online_daily_v4_gameplay_refresh.mjs";
import { evaluateSteamIndiePrelaunchAdmission } from "../jobs/online_daily_v7_indie_admission.mjs";
import { buildPools } from "../jobs/online_daily_v4_decision.mjs";
import { buildSourcingCandidateArtifact } from "../jobs/online_daily_v4_candidate_audit.mjs";

const fixture=JSON.parse(readFileSync(new URL("./fixtures/official-gameplay-46.json",import.meta.url),"utf8"));
const page=row=>'<div data-featuretarget="gamehighlight-desktopcarousel" data-props="'+JSON.stringify({trailers:row.trailers}).replaceAll("&","&amp;").replaceAll('"',"&quot;")+'"></div>';
const evidence=row=>extractSteamGameplayEvidence({appId:row.steam_app_id,storeHtml:page(row)});
const recovered=fixture.rows.filter(row=>evidence(row).length);
test("46 frozen official store records recover exactly the declared videos",()=>{
  assert.equal(fixture.rows.length,46);
  assert.equal(new Set(fixture.rows.map(row=>row.steam_app_id)).size,46);
  assert.equal(recovered.length,18);
  for(const row of recovered){
    assert.ok(evidence(row).every(e=>e.basis==="steam_gameplay_category"&&e.steam_app_id===row.steam_app_id));
    assert.ok(row.before_missing_evidence.includes("independent_quality_proof"));
  }
});
test("cached real candidates reach publication and lookup ledger without changing other admission gates",async()=>{
  const rows=fixture.rows.filter(row=>row.steam_candidate);
  const inputs=rows.map(row=>structuredClone(row.steam_candidate));
  const originals=structuredClone(inputs);
  const byId=new Map(rows.map(row=>[row.steam_app_id,row]));
  const before=buildPools(inputs,[],{reportDate:fixture.baseline_date});
  const calls=[];
  const refreshed=await refreshOfficialGameplayEvidence({
    steamCandidates:inputs,reportDate:fixture.baseline_date,maxOfficialLookups:46,
    fetchTextImpl:async url=>{const id=url.match(/\/app\/(\d+)\//)[1];calls.push(id);return page(byId.get(id));}
  });
  assert.deepEqual(inputs,originals);
  assert.equal(new Set(calls).size,calls.length);
  for(let i=0;i<inputs.length;i++){
    const prior=evaluateSteamIndiePrelaunchAdmission(inputs[i]);
    const after=evaluateSteamIndiePrelaunchAdmission(refreshed.steamCandidates[i]);
    assert.deepEqual(after.gate_results.filter(g=>g.id!=="official_gameplay"),prior.gate_results.filter(g=>g.id!=="official_gameplay"));
  }
  const after=buildPools(refreshed.steamCandidates,[],{reportDate:fixture.baseline_date});
  assert.equal(before.strict_formal_count,0);
  assert.equal(after.strict_formal_count,0);
  assert.equal(before.near_pass_review_count,0);
  assert.equal(after.near_pass_review_count,2);
  assert.deepEqual(after.push.map(x=>x.steam_app_id).sort(),["4328540","4955940"]);
  const duplicate=buildPools([...refreshed.steamCandidates,...refreshed.steamCandidates],[],{reportDate:fixture.baseline_date});
  assert.deepEqual(duplicate,after);
  const artifact=buildSourcingCandidateArtifact({
    reportDate:fixture.baseline_date,capturedAt:"2026-09-15T18:00:00+08:00",
    ruleVersion:"sourcing-rules-v7.2.3-official-gameplay-value",
    enrichedSteamCandidates:refreshed.steamCandidates,candidatePools:after,publishedPools:after,
    gameplayLookupResults:refreshed.lookupResults
  });
  const published=artifact.candidates.filter(c=>c.publication_tier==="near_pass_review");
  assert.equal(published.length,2);
  assert.ok(published.every(c=>c.official_gameplay_lookup.status==="confirmed"&&!c.missing_evidence.includes("official_gameplay")));
  const repeat=await refreshOfficialGameplayEvidence({steamCandidates:inputs,history:[artifact],reportDate:fixture.baseline_date,maxOfficialLookups:46,fetchTextImpl:()=>assert.fail("same-day artifact must suppress repeat queries")});
  assert.equal(repeat.diagnostics.official_gameplay_lookup_attempts,0);
  assert.deepEqual(buildPools(repeat.steamCandidates,[],{reportDate:fixture.baseline_date}),after);
});
