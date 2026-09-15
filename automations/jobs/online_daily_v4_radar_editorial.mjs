// Radar-only editorial rules: pure, with no network or Lead-policy dependencies.
const textKey = value => String(value ?? "").normalize("NFKC").toLowerCase().replace(/[\p{P}\p{Z}\s]+/gu, "");
const escapeRegExp = value => value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

export const RADAR_ENTITY_ALIASES = [
  {id:"wow",names:["World of Warcraft","WoW","魔兽世界"]},
  {id:"starcraft",names:["StarCraft","星际争霸"]},
  {id:"diablo5",names:["Diablo 5","Diablo V","暗黑破坏神5","暗黑破坏神 5","暗黑5"]},
  {id:"diablo4",names:["Diablo 4","Diablo IV","暗黑破坏神4","暗黑破坏神 4","暗黑4"]},
  {id:"lastofus2",names:["The Last of Us Part 2","The Last of Us Part II","最后生还者2","最后生还者 第二部","美国末日2"]},
  {id:"lastofus",names:["The Last of Us","最后生还者","美国末日"]},
  {id:"gta6",names:["GTA 6","GTA VI","Grand Theft Auto VI","侠盗猎车手6","侠盗猎车手 6"]},
  {id:"fortnite",names:["Fortnite","堡垒之夜"]},
  {id:"wardogs",names:["Wardogs"]},
  {id:"monsterhunterwilds",names:["Monster Hunter Wilds","怪物猎人荒野","怪物猎人：荒野"]},
  {id:"witcher4",names:["The Witcher 4","巫师4","巫师 4"]},
  {id:"witcher3",names:["The Witcher 3","巫师3","巫师 3"]},
  {id:"pokemon",names:["Pokémon","Pokemon","宝可梦","精灵宝可梦"]},
  {id:"blizzard",names:["Blizzard","暴雪"]},
  {id:"bungie",names:["Bungie","棒鸡"]},
  {id:"naughtydog",names:["Naughty Dog","顽皮狗"]},
  {id:"level5",names:["Level-5","LEVEL5","LEVEL 5"]},
  {id:"nintendo",names:["Nintendo","任天堂"]},
  {id:"playstation",names:["PlayStation","PS5","索尼游戏"]},
  {id:"xbox",names:["Xbox"]},
  {id:"steam",names:["Steam","Steam商店"]},
  {id:"epic",names:["Epic Games","Epic Games Store","Epic游戏商城"]},
  {id:"unity",names:["Unity Engine","Unity引擎"]},
  {id:"unreal",names:["Unreal Engine","虚幻引擎"]},
  {id:"godot",names:["Godot"]},
  {id:"roblox",names:["Roblox","罗布乐思"]},
  {id:"squareenix",names:["Square Enix","史克威尔艾尼克斯"]},
  {id:"mihoyo",names:["miHoYo","HoYoverse","米哈游"]},
  {id:"neteasegames",names:["NetEase Games","网易游戏"]},
  {id:"tencentgames",names:["Tencent Games","腾讯游戏"]}
];

export function radarEditorialText(item) {
  const title = String(item.title ?? "").replace(/<[^>]*>/g, " ");
  let summary = String(item.summary ?? "").replace(/<[^>]*>/g, " ");
  summary = summary.replace(/^(?:行业新闻|今日亮点|广域媒体非游戏信号|AI 游戏|新梗热点|B站趋势)[：:]\s*/, "");
  summary = summary.split(/。(?:重点看|先看|把公司\/IP|保留在 Radar|用于判断|记录关键人|打开视频|只保留有BD|这类线索)/)[0];
  return {title, summary, text:title + " " + summary};
}
function containsAlias(text, alias) {
  if (/^[\x00-\x7f]+$/.test(alias))
    return new RegExp("(?:^|[^a-z0-9])" + escapeRegExp(alias).replace(/\s+/g, "\\s*") + "(?=$|[^a-z0-9])", "i").test(text);
  return textKey(text).includes(textKey(alias));
}
function entities(text, editorial = {}) {
  const aliases = [...RADAR_ENTITY_ALIASES, ...(editorial.entity_aliases ?? [])];
  const found = aliases.filter(entry => entry.names.some(name => containsAlias(text, name)));
  const ids = [...new Set(found.map(x => x.id))];
  if (ids.includes("lastofus2") && ids.includes("lastofus")) ids.splice(ids.indexOf("lastofus"),1);
  for (const match of text.matchAll(/[《「『]([^》」』]+)[》」』]/g)) {
    if (!found.some(entry => entry.names.some(name => textKey(name) === textKey(match[1])))) ids.push("title:" + textKey(match[1]));
  }
  return ids.sort();
}

export function assessRadarRelevance(item, editorial = {}) {
  const {title, summary, text} = radarEditorialText(item);
  const ids = entities(text, editorial);
  const companies = /^(blizzard|bungie|naughtydog|level5|nintendo|playstation|xbox|steam|epic|unity|unreal|godot|roblox|squareenix|mihoyo|neteasegames|tencentgames)$/;
  const namedGame = ids.some(id => !id.startsWith("title:") && !companies.test(id));
  const explicit = /\b(?:games?|gaming|gameplay|gamers?|rpg|mmorpg|mmo|rts|roguelike|deckbuilder|playtest|esports?|dlc)\b|游戏|手游|端游|电竞|玩法|副本|资料片|版号|试玩|实机|战棋|肉鸽/i.test(text);
  const engine = /\b(?:unreal(?: engine)?|godot|unity engine)\b|虚幻引擎|Unity引擎/i.test(text);
  const business = /\b(?:layoffs?|acquisition|funding|union|studio|publishing|publisher|policy|revenue|earnings|copyright|disc|development)\b|裁员|游戏开发|发行|收购|融资|工作室|光盘|游戏政策|营收|版号/i.test(text);
  const entertainment = /\b(?:television|TV show|new show|movie|film|leprechaun|cinema|Netflix)\b|电视剧|影视剧|电影|演员访谈/i.test(text);
  const hardware = /\b(?:laptop|notebook|monitors?|GPU|CPU|graphics card|RTX|processor|keyboard|mouse)\b|笔记本|迷你主机|处理器|显卡|显示器|键盘|鼠标/i.test(text);
  let level = 0;
  if (entertainment) {
    if ((namedGame || explicit) && /\b(?:adaptation|based on|crossover|collab)\b|游戏改编|游戏联动|改编自|游戏IP/i.test(text)) level = 1;
    else if (explicit && /\b(?:gameplay|DLC|patch|in-game|game release)\b|游戏内|游戏更新|游戏发售/i.test(text)) level = 3;
  } else if (hardware) {
    if (explicit || /\b(?:playstation|xbox|steam deck|nintendo switch)\b|游戏主机/i.test(text)) level = 2;
  } else if (explicit || namedGame || engine || (ids.some(id=>companies.test(id)) && business)) level = 3;
  const filler = /\b(?:best deals|discount|walkthrough|best settings|cosplay|quiz)\b|折扣|促销|史低|壁纸|图赏|喜加[一二三四五六七八九十\d]+|免费白嫖|周末游戏视频集锦/i.test(title);
  if (filler || title.trim().length < 6 || /^(首页|更多|新闻|资讯|专题|视频|搜索|登录|注册)$/.test(title.trim())) level = 0;
  const information = Math.min(8,Math.floor(textKey(summary).length/24)) + (title.length>=24 ? 2 : 0);
  return {level, information, reason:level ? (level===3 ? "direct_game_context" : "explicit_game_connection") : filler ? "low_information" : "no_game_context"};
}

const DOMESTIC_NAMES = new Set(["GameLook","游戏葡萄","GameRes游资网","游戏陀螺","手游那点事","游戏茶馆","indienova","游研社","机核","TapTap发现","触乐","IT之家","3DM","游民星空","证券时报","澎湃新闻"]);
const hostname = value => {try{return new URL(value).hostname.toLowerCase().replace(/^www\./,"");}catch{return "";}};
export function radarPublisherRegion(item, sources = []) {
  const host = hostname(item.link);
  const source = sources.find(s=>s.name===item.source) ?? sources.find(s=>host && hostname(s.url)===host);
  if (source) return source.focus?.some(f=>f==="china"||f==="domestic_sourcing") ? "china" : "global";
  if (DOMESTIC_NAMES.has(item.source) || /bilibili\.com$/.test(host) || /b站|哔哩哔哩/i.test(item.source??"")) return "china";
  // source_focus is collector-owned registry metadata, never story geography.
  return item.source_focus?.some(f=>f==="china"||f==="domestic_sourcing") ? "china" : "global";
}
function urlKey(value) {
  try {
    const url=new URL(value); if (!/^https?:$/.test(url.protocol)) return "";
    for(const key of [...url.searchParams.keys()]) if(/^(utm_.+|fbclid|gclid|spm.*|from|ref|referrer|source)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.hostname.toLowerCase().replace(/^www\./,"")+url.pathname.replace(/\/+$/,"")+url.search;
  } catch {return "";}
}
function progressFacts(text) {
  const normalized=text.replace(/(20\d{2})年(\d{1,2})月(\d{1,2})日/g,(_,y,m,d)=>y+"-"+m.padStart(2,"0")+"-"+d.padStart(2,"0"));
  return {
    versions:[...normalized.matchAll(/\b(?:v(?:ersion)?\s*)?(\d+\.\d+(?:\.\d+)*)\b/gi)].map(x=>x[1]),
    dates:[...normalized.matchAll(/\b20\d{2}(?:-\d{2}-\d{2})?\b/g)].map(x=>x[0]),
    parts:[...normalized.matchAll(/第([一二三四五六七八九十\d]+)[章节部弹]|(?:chapter|part)\s+(\d+)/gi)].map(x=>x[1]??x[2])
  };
}
const conflict=(a,b)=>["versions","dates","parts"].some(k=>a[k].length&&b[k].length&&!a[k].some(x=>b[k].includes(x)));
function eventAction(text) {
  if(/\b(?:review|opinion|hands-on|impressions)\b|评测|评析|体验感受/i.test(text)) return "review";
  if(/(?:sequel|wow\s*2|续作|魔兽世界\s*2).{0,100}(?:unlikely|no plans|not planned|不会|不太可能|没有计划)|(?:unlikely|no plans|不会|不太可能|没有).{0,100}(?:sequel|续作)/i.test(text)) return "sequel_unlikely";
  if(/(?:mod|模组).{0,100}(?:stop|block|end|cease|halt|叫停|停止|终止)|(?:stop|block|end|cease|halt|叫停|停止|终止).{0,100}(?:mod|模组)/i.test(text)) return "mod_blocked";
  if(/\b(?:layoffs?|reduces? staff)\b|裁员/i.test(text)) return "layoffs";
  if(/sublease|转租/i.test(text)) return "office_sublease";
  if(/(?:disc|光盘).{0,120}(?:production|manufactur|产量|生产)/i.test(text)) return "disc_production";
  if(/\b(?:patch|update)\b|补丁|版本更新/i.test(text)) return "patch";
  if(/release date|launch date|发售日|发售日期|发售时间|定档/i.test(text)) return "release_date";
  if(/\b(?:acquire[sd]?|acquisition)\b|收购/i.test(text)) return "acquisition";
  if(/\b(?:funding|investment)\b|融资|投资/i.test(text)) return "funding";
  if(/trailer|预告|\bpv\b/i.test(text)) return "trailer";
  if(/demo|试玩/i.test(text)) return "demo";
  if(/playtest|测试/i.test(text)) return "playtest";
  if(/announc|公布|宣布/i.test(text)) return "announcement";
  if(/launch|releas|发售|上线/i.test(text)) return "release";
  return "";
}
export function sameRadarEvent(a,b,editorial={}) {
  const at=radarEditorialText(a), bt=radarEditorialText(b);
  const au=urlKey(a.link), bu=urlKey(b.link);
  if((au&&au===bu)||(textKey(at.title)&&textKey(at.title)===textKey(bt.title))) return true;
  const af=progressFacts(at.text), bf=progressFacts(bt.text);
  if(conflict(af,bf)) return false;
  const aa=eventAction(at.text), ba=eventAction(bt.text);
  const compatible=!aa||!ba||aa===ba||["announcement","release_date","release"].includes(aa)&&["announcement","release_date","release"].includes(ba);
  if(!compatible) return false;
  const originalsA=new Set((a.original_links??[]).map(urlKey).filter(Boolean));
  const originalsB=new Set((b.original_links??[]).map(urlKey).filter(Boolean));
  if(bu&&originalsA.has(bu)||au&&originalsB.has(au)||[...originalsA].some(url=>originalsB.has(url))) return true;
  if(!aa||aa!==ba||aa==="review") return false;
  const ae=entities(at.text,editorial), be=entities(bt.text,editorial);
  if(!ae.length||!ae.some(id=>be.includes(id))) return false;
  const distinctive=/^(sequel_unlikely|mod_blocked|office_sublease|disc_production)$/.test(aa);
  const sharedFact=["versions","dates","parts"].some(k=>af[k].some(x=>bf[k].includes(x)));
  return distinctive||sharedFact;
}
export function hasCompleteRadarCoverage(item,alternatives=[]) {
  const {title,summary,text}=radarEditorialText(item);
  if(textKey(summary).length<18||/^(详见原文|点击查看|阅读原文|read more)[。.!！\s]*$/i.test(summary)) return false;
  const facts=progressFacts(text);
  return title.trim().length>=6 && alternatives.every(other=>{
    const expected=progressFacts(radarEditorialText(other).text);
    return ["versions","dates","parts"].every(k=>!expected[k].length||expected[k].every(value=>facts[k].includes(value)));
  });
}
