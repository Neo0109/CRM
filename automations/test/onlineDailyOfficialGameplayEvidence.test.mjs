import test from "node:test";
import assert from "node:assert/strict";
import { extractSteamGameplayEvidence, parseSteamStoreTrailers, extractOfficialBilibiliGameplayEvidence } from "../jobs/online_daily_v4_official_gameplay.mjs";
import { refreshOfficialGameplayEvidence } from "../jobs/online_daily_v4_gameplay_refresh.mjs";

const id = "3361000";
const stream = (appid=id) => "https://video.fastly.steamstatic.com/store_trailers/"+appid+"/576817724/hash/1/hls.m3u8";
const trailer = (extra={}) => ({ id:1, category:1, title:"New Trailer", statsURL:"https://store.steampowered.com/app/trailerstats/"+id+"/576817724", hlsManifest:stream(), ...extra });
const page = (trailers) => '<div data-featuretarget="gamehighlight-desktopcarousel" data-props="'+JSON.stringify({appName:"Example",trailers}).replaceAll("&","&amp;").replaceAll('"',"&quot;")+'"></div>';
const candidate = (appId=id, extra={}) => ({
  appId,title:"Example",hasDetails:true,alreadyReleased:false,earlyAccess:false,comingSoon:true,
  daysToRelease:120,publisherOccupied:false,narrativeHeavy:false,indiaTeam:false,
  officialDemoEvidence:[],officialGameplayEvidence:[],qualityProofs:[],country:"中国",region:"中国",
  contactMethods:[{type:"Website",value:"https://example.com"}],
  chinaBilibiliValue:"Concrete community content opportunity",genres:[],categories:[],...extra
});

test("official Gameplay category recognizes generic titles with bound stable video and modern URL",()=>{
  const evidence=extractSteamGameplayEvidence({appId:id,storeHtml:page([trailer()])});
  assert.equal(evidence.length,1);
  assert.equal(evidence[0].basis,"steam_gameplay_category");
  assert.equal(evidence[0].steam_app_id,id);
  assert.equal(evidence[0].video_id,"576817724");
  assert.equal(evidence[0].url,stream());
  assert.equal(evidence[0].source_url,"https://store.steampowered.com/app/"+id+"/");
});
test("official declaration must belong to a particular video; generic body and cinematic labels do not qualify",()=>{
  for(const t of [trailer({category:3,title:"Trailer"}),trailer({category:2,title:"Teaser"}),trailer({category:6,title:"Interview"}),trailer({category:0,title:"Not actual gameplay"}),trailer({category:0,title:"No gameplay trailer"})]){
    assert.deepEqual(extractSteamGameplayEvidence({appId:id,storeHtml:page([t])+"<p>Gameplay</p>"}),[]);
  }
  assert.equal(extractSteamGameplayEvidence({appId:id,storeHtml:page([trailer({category:0,description:"Official gameplay demonstration"})])}).length,1);
  assert.equal(extractSteamGameplayEvidence({appId:id,storeHtml:page([trailer({category:0,title:"玩法演示"})])}).length,1);
});
test("wrong product, injected markup, malformed hydration and hostile media URLs never create evidence",()=>{
  assert.deepEqual(parseSteamStoreTrailers(page([trailer()]),"999"),[]);
  assert.deepEqual(extractSteamGameplayEvidence({appId:id,details:{type:"game",steam_appid:999,movies:[{name:"Gameplay"}]}}),[]);
  assert.deepEqual(extractSteamGameplayEvidence({appId:id,details:{type:"demo",steam_appid:Number(id),movies:[{name:"Gameplay"}]}}),[]);
  assert.deepEqual(parseSteamStoreTrailers('<script>'+page([trailer()])+'</script>',id),[]);
  assert.deepEqual(parseSteamStoreTrailers('<div data-featuretarget="gamehighlight-desktopcarousel" data-props="oops"></div>',id),[]);
  assert.deepEqual(extractSteamGameplayEvidence({appId:id,storeHtml:page([trailer({hlsManifest:stream("999")})])}),[]);
  assert.deepEqual(extractSteamGameplayEvidence({appId:id,storeHtml:page([trailer({hlsManifest:"https://evil.example/clip.mp4"})])}),[]);
});
test("AppDetails supports DASH, HLS, legacy MP4/WebM and a canonical page fallback",()=>{
  for(const movie of [
    {id:10,name:"Gameplay",dash_h264:stream().replace("hls.m3u8","dash.mpd")},
    {id:10,name:"Gameplay",hls_h264:stream()},
    {id:10,name:"Gameplay",webm:{max:"https://cdn.akamai.steamstatic.com/steam/apps/10/movie.webm"}},
    {id:10,name:"Gameplay",mp4:{max:"https://cdn.akamai.steamstatic.com/steam/apps/10/movie.mp4"}},
    {id:10,name:"Gameplay"}
  ]){
    const es=extractSteamGameplayEvidence({appId:id,details:{type:"game",steam_appid:Number(id),movies:[movie]}});
    assert.equal(es.length,1);assert.ok(es[0].url.startsWith("https://"));
  }
});
test("verified Bilibili provenance and same-game identity are both required",()=>{
  const item={title:"《Example》实机演示",link:"https://www.bilibili.com/video/BV1example/",steam_app_id:id};
  assert.equal(extractOfficialBilibiliGameplayEvidence({appId:id,project:"Example",officialSourceMatched:true,sourceItem:item}).length,1);
  assert.deepEqual(extractOfficialBilibiliGameplayEvidence({appId:id,project:"Example",officialSourceMatched:false,sourceItem:item}),[]);
  assert.deepEqual(extractOfficialBilibiliGameplayEvidence({appId:id,project:"Example",officialSourceMatched:true,sourceItem:{...item,steam_app_id:"999"}}),[]);
  assert.deepEqual(extractOfficialBilibiliGameplayEvidence({appId:id,project:"Another Game",officialSourceMatched:true,sourceItem:{...item,steam_app_id:null}}),[]);
});
test("missing-gameplay cached candidates share the remaining official budget, prioritizing fewest gaps",async()=>{
  const calls=[];const diagnostics={bilibili_official_source_lookups:1};
  const good=candidate();const bad=candidate("999",{contactMethods:[],chinaBilibiliValue:null});
  const r=await refreshOfficialGameplayEvidence({steamCandidates:[bad,good],reportDate:"2026-09-15",maxOfficialLookups:2,diagnostics,
    fetchTextImpl:async url=>{calls.push(url);return page([trailer()]);}});
  assert.equal(calls.length,1);assert.ok(calls[0].includes("/"+id+"/"));
  assert.equal(r.steamCandidates[1].officialGameplayEvidence.length,1);
  assert.equal(r.steamCandidates[1].qualityProofs.length,0);
  assert.equal(r.lookupResults.get("steam:"+id).status,"confirmed");
  assert.equal(diagnostics.official_gameplay_lookup_attempts,1);
});
test("same-day history and duplicate source rows do not spend the budget twice; old evidence is re-evaluated",async()=>{
  const first=await refreshOfficialGameplayEvidence({steamCandidates:[candidate()],reportDate:"2026-09-15",maxOfficialLookups:1,fetchTextImpl:async()=>page([trailer()])});
  const lookup=first.lookupResults.get("steam:"+id);
  const history=[{report_date:"2026-09-15",candidates:[{dedupe_key:"steam:"+id,official_gameplay_lookup:lookup}]}];
  const second=await refreshOfficialGameplayEvidence({steamCandidates:[candidate(),candidate()],history,reportDate:"2026-09-15",maxOfficialLookups:1,fetchTextImpl:()=>assert.fail("must reuse")});
  assert.equal(second.steamCandidates.every(x=>x.officialGameplayEvidence.length===1),true);
  assert.equal(second.lookupResults.size,1);
});
test("isolated request failure is remembered for the day, retries next day, and hard-excluded projects cost nothing",async()=>{
  const failed=await refreshOfficialGameplayEvidence({steamCandidates:[candidate(),candidate("999",{earlyAccess:true})],reportDate:"2026-09-15",maxOfficialLookups:12,fetchTextImpl:async()=>{throw new Error("offline");}});
  assert.equal(failed.lookupResults.size,1);
  const lookup=failed.lookupResults.get("steam:"+id);assert.equal(lookup.status,"fetch_failed");
  const history=[{report_date:"2026-09-15",candidates:[{dedupe_key:"steam:"+id,official_gameplay_lookup:lookup}]}];
  await refreshOfficialGameplayEvidence({steamCandidates:[candidate()],history,reportDate:"2026-09-15",maxOfficialLookups:12,fetchTextImpl:()=>assert.fail("same-day failure must not retry")});
  let calls=0;
  await refreshOfficialGameplayEvidence({steamCandidates:[candidate()],history,reportDate:"2026-09-16",maxOfficialLookups:12,fetchTextImpl:async()=>{calls++;return page([trailer()]);}});
  assert.equal(calls,1);
});

test("malformed official metadata cannot abort enrichment or confirm a mismatched video",()=>{
  for (const movies of [[null], {}, [42]]) {
    assert.deepEqual(extractSteamGameplayEvidence({appId:id,details:{type:"game",steam_appid:Number(id),movies}}),[]);
  }
  assert.deepEqual(parseSteamStoreTrailers(page([null, trailer()]),id).map(x=>x.video_id),["576817724"]);
  assert.deepEqual(extractSteamGameplayEvidence({appId:id,storeHtml:page([trailer({hlsManifest:stream().replace("576817724","999999")})])}),[]);
});
test("confirmed refresh survives explicit admission snapshots without changing other gates",async()=>{
  const {steamIndieAdmissionEvidence,evaluateSteamIndiePrelaunchAdmission}=await import("../jobs/online_daily_v7_indie_admission.mjs");
  const input=candidate();
  input._indieAdmissionEvidence=steamIndieAdmissionEvidence(input);
  const before=evaluateSteamIndiePrelaunchAdmission(input);
  const r=await refreshOfficialGameplayEvidence({steamCandidates:[input],reportDate:"2026-09-15",fetchTextImpl:async()=>page([trailer()])});
  const after=evaluateSteamIndiePrelaunchAdmission(r.steamCandidates[0]);
  assert.deepEqual(after.failed_gates,before.failed_gates.filter(x=>x!=="official_gameplay"));
  assert.equal(input._indieAdmissionEvidence.official_gameplay_evidence.length,0,"original snapshot stays immutable");
});
test("expired evidence is retried and same-day negative results do not spend a second request",async()=>{
  const first=await refreshOfficialGameplayEvidence({steamCandidates:[candidate()],reportDate:"2026-09-08",fetchTextImpl:async()=>page([trailer()])});
  const history=[{report_date:"2026-09-08",candidates:[{dedupe_key:"steam:"+id,official_gameplay_lookup:first.lookupResults.get("steam:"+id)}]}];
  const expired=await refreshOfficialGameplayEvidence({steamCandidates:[candidate()],history,reportDate:"2026-09-15",fetchTextImpl:async()=>page([trailer({category:3})])});
  assert.equal(expired.diagnostics.official_gameplay_lookup_attempts,1);
  assert.deepEqual(expired.steamCandidates[0].officialGameplayEvidence,[]);
  history.push({report_date:"2026-09-15",candidates:[{dedupe_key:"steam:"+id,official_gameplay_lookup:expired.lookupResults.get("steam:"+id)}]});
  const repeat=await refreshOfficialGameplayEvidence({steamCandidates:[candidate()],history,reportDate:"2026-09-15",fetchTextImpl:()=>assert.fail("negative same-day cache")});
  assert.equal(repeat.diagnostics.official_gameplay_lookup_attempts,0);
});
