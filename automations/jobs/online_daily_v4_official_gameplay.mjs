// Official declarations only. This module never inspects video/image content.
export const OFFICIAL_GAMEPLAY_EVIDENCE_VERSION = "official-gameplay-metadata-v1";
const gameplay = /\bgame[\s-]?play\b|实机|實機|玩法演示|试玩演示|試玩演示/i;
const denial = /\b(?:no|not|without|non)[ -]+(?:actual[ -]+|real[ -]+)?game[\s-]?play\b|非实机|非實機|不是实机|并非实机|无实机|無實機|不含实机|不含實機/i;
const idString = value => /^\d+$/.test(String(value ?? "")) ? String(value) : null;

function httpsUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch { return null; }
}
function mediaUrl(value, appId, videoId = null) {
  const url = httpsUrl(value);
  if (!url || !/(^|\.)steamstatic\.com$/.test(url.hostname)) return null;
  const bound = url.pathname.match(/^\/store_trailers\/(\d+)\/(\d+)\//);
  if (bound && (bound[1] !== appId || (videoId && bound[2] !== videoId))) return null;
  return url.href;
}
function decodeAttribute(value) {
  return String(value).replace(/&quot;|&#34;/g,'"').replace(/&#39;|&apos;/g,"'")
    .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");
}
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map(m=>[m[1].toLowerCase(),decodeAttribute(m[2] ?? m[3])]));
}
function text(value) {
  return typeof value === "string" ? value.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim() : "";
}
function declaration(video) {
  const title=text(video.title ?? video.name), description=text(video.description);
  if (denial.test(title+" "+description)) return null;
  // Valve's ETrailerCategory: 1=Gameplay. Other numeric categories are not evidence.
  if (video.category === 1 || /^(?:gameplay|实机|實機)$/i.test(text(video.category))) return "steam_gameplay_category";
  if (gameplay.test(title)) return "official_video_title";
  if (gameplay.test(description)) return "official_video_description";
  return null;
}
export function parseSteamStoreTrailers(html, appId) {
  const id=idString(appId);
  if (!id || typeof html !== "string") return [];
  const clean=html.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,"").replace(/<!--[\s\S]*?-->/g,"");
  const trailers=[], seen=new Set();
  for (const match of clean.matchAll(/<div\b[^>]*>/gi)) {
    const attrs=attributes(match[0]);
    if (!/^gamehighlight-(?:desktop|gamepad)carousel$/.test(attrs["data-featuretarget"] ?? "")) continue;
    let data;
    try { data=JSON.parse(attrs["data-props"]); } catch { continue; }
    if (!Array.isArray(data?.trailers)) continue;
    for (const t of data.trailers) {
      if (!t || typeof t !== "object" || Array.isArray(t)) continue;
      const stats=httpsUrl(t?.statsURL);
      const identity=stats?.hostname === "store.steampowered.com" && stats.pathname.match(/^\/app\/trailerstats\/(\d+)\/(\d+)\/?$/);
      if (!identity || identity[1] !== id || seen.has(identity[2])) continue;
      seen.add(identity[2]);
      trailers.push({...t,video_id:identity[2],steam_app_id:id});
    }
  }
  return trailers;
}
function evidenceFromVideo(video, appId) {
  if (!video || typeof video !== "object" || Array.isArray(video)) return null;
  const basis=declaration(video);
  if (!basis) return null;
  const possible=[video.hlsManifest,video.hls_h264,video.dash_h264,...(Array.isArray(video.dashManifests)?video.dashManifests:[]),
    video.dash_av1,video.webm?.max,video.mp4?.max,video.webm?.["480"],video.mp4?.["480"]].filter(Boolean);
  const usable=possible.map(url=>mediaUrl(url,appId,video.video_id ?? null)).find(Boolean);
  // A present but wrong-product/non-Steam media target cannot fall back to a page.
  if (possible.length && !usable) return null;
  const sourceUrl="https://store.steampowered.com/app/"+appId+"/";
  return {type:"steam_official_gameplay",value:text(video.title ?? video.name) || "Steam Gameplay",
    url:usable ?? sourceUrl,source_url:sourceUrl,video_id:String(video.video_id ?? video.id ?? ""),
    steam_app_id:appId,basis,evidence_version:OFFICIAL_GAMEPLAY_EVIDENCE_VERSION};
}
export function extractSteamGameplayEvidence({appId,details=null,storeHtml=""}={}) {
  const id=idString(appId);
  if (!id) return [];
  if (details && (details.type !== "game" || String(details.steam_appid) !== id)) return [];
  const videos=[...(Array.isArray(details?.movies) ? details.movies : []),...parseSteamStoreTrailers(storeHtml,id)];
  const result=[], seen=new Set();
  for (const video of videos) {
    const entry=evidenceFromVideo(video,id);
    if (!entry) continue;
    const key=entry.url+"|"+entry.video_id;
    if (!seen.has(key)) { seen.add(key); result.push(entry); }
  }
  return result;
}
function normalizedName(value) { return text(value).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu,""); }
export function extractOfficialBilibiliGameplayEvidence({appId,project,officialSourceMatched=false,sourceItem,acceptedSourceAppId=null}={}) {
  if (!officialSourceMatched || !sourceItem) return [];
  const url=httpsUrl(sourceItem.link);
  if (!url || !/(^|\.)bilibili\.com$/.test(url.hostname) || !/^\/video\/BV[a-zA-Z0-9]+\/?$/.test(url.pathname)) return [];
  const title=text(sourceItem.title);
  const description=text(sourceItem.description ?? sourceItem.summary);
  if (!gameplay.test(title+" "+description) || denial.test(title+" "+description)) return [];
  const ids=new Set([
    sourceItem.steam_app_id,
    ...(sourceItem.bilibili_evidence?.steam_app_ids ?? []),
    ...[...String(sourceItem.description ?? sourceItem.summary ?? "").matchAll(/(?:store\.steampowered\.com\/app\/|steamdb\.info\/app\/)(\d+)/g)].map(m=>m[1])
  ].map(idString).filter(Boolean));
  const id=idString(appId);
  if (ids.size && (!id || [...ids].some(x=>x!==id && x!==String(acceptedSourceAppId ?? "")))) return [];
  // Without a product ID, require the exact quoted title, not a substring/role label.
  if (!ids.size) {
    const named=[...title.matchAll(/《([^》]+)》|「([^」]+)」|"([^"]+)"/g)].map(m=>normalizedName(m[1]??m[2]??m[3]));
    if (!normalizedName(project) || !named.includes(normalizedName(project))) return [];
  }
  return [{type:"official_bilibili_gameplay",value:title,url:url.href,source_url:url.href,
    video_id:url.pathname.split("/")[2],steam_app_id:id,basis:"verified_official_same_game_video",
    evidence_version:OFFICIAL_GAMEPLAY_EVIDENCE_VERSION}];
}
