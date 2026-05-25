export type SteamEventKind = "seasonal" | "next" | "fest";

export type SteamEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  kind: SteamEventKind;
  note: string;
  link: string;
};

export const steamEventsSource = "https://partner.steamgames.com/doc/marketing/upcoming_events";

export const officialSteamEvents: SteamEvent[] = [
  { id: "steam-spring-sale-2026", title: "Steam 春季特卖", start: "2026-03-19", end: "2026-03-26", kind: "seasonal", note: "官方季节性特卖", link: steamEventsSource },
  { id: "steam-summer-sale-2026", title: "Steam 夏季特卖", start: "2026-06-25", end: "2026-07-09", kind: "seasonal", note: "官方季节性特卖", link: steamEventsSource },
  { id: "steam-autumn-sale-2026", title: "Steam 秋季特卖", start: "2026-10-01", end: "2026-10-08", kind: "seasonal", note: "官方季节性特卖", link: steamEventsSource },
  { id: "steam-winter-sale-2026", title: "Steam 冬季特卖", start: "2026-12-17", end: "2027-01-04", kind: "seasonal", note: "官方季节性特卖", link: steamEventsSource },
  { id: "detective-fest-2026", title: "Detective Fest", start: "2026-01-12", end: "2026-01-19", kind: "fest", note: "侦探主题官方活动", link: steamEventsSource },
  { id: "board-game-fest-2026", title: "Board Game Fest", start: "2026-01-26", end: "2026-02-02", kind: "fest", note: "桌游主题官方活动", link: steamEventsSource },
  { id: "typing-fest-2026", title: "Typing Fest", start: "2026-02-05", end: "2026-02-09", kind: "fest", note: "打字主题官方活动", link: steamEventsSource },
  { id: "pvp-fest-2026", title: "Combat PvP Fest", start: "2026-02-09", end: "2026-02-16", kind: "fest", note: "PvP 主题官方活动", link: steamEventsSource },
  { id: "horse-fest-2026", title: "Horse Fest", start: "2026-02-19", end: "2026-02-23", kind: "fest", note: "马主题官方活动", link: steamEventsSource },
  { id: "tower-defense-fest-2026", title: "Tower Defense Fest", start: "2026-03-09", end: "2026-03-16", kind: "fest", note: "塔防主题官方活动", link: steamEventsSource },
  { id: "house-home-fest-2026", title: "House & Home Fest", start: "2026-03-30", end: "2026-04-06", kind: "fest", note: "居家主题官方活动", link: steamEventsSource },
  { id: "hidden-object-fest-2026", title: "Hidden Object Fest", start: "2026-04-09", end: "2026-04-13", kind: "fest", note: "找物主题官方活动", link: steamEventsSource },
  { id: "medieval-fest-2026", title: "Medieval Fest", start: "2026-04-20", end: "2026-04-27", kind: "fest", note: "中世纪主题官方活动", link: steamEventsSource },
  { id: "deckbuilders-fest-2026", title: "Deckbuilders Fest", start: "2026-05-04", end: "2026-05-11", kind: "fest", note: "卡牌构筑主题官方活动", link: steamEventsSource },
  { id: "ocean-fest-2026", title: "Ocean Fest", start: "2026-05-18", end: "2026-05-25", kind: "fest", note: "海洋主题官方活动", link: steamEventsSource },
  { id: "bullet-fest-2026", title: "Bullet Fest", start: "2026-06-08", end: "2026-06-15", kind: "fest", note: "弹幕/射击主题官方活动", link: steamEventsSource },
  { id: "social-deduction-fest-2026", title: "Social Deduction Fest", start: "2026-07-13", end: "2026-07-16", kind: "fest", note: "社交推理主题官方活动", link: steamEventsSource },
  { id: "train-fest-2026", title: "Train Fest", start: "2026-07-20", end: "2026-07-27", kind: "fest", note: "火车主题官方活动", link: steamEventsSource },
  { id: "cyberpunk-fest-2026", title: "Cyberpunk Fest", start: "2026-08-03", end: "2026-08-10", kind: "fest", note: "赛博朋克主题官方活动", link: steamEventsSource },
  { id: "pins-pegs-fest-2026", title: "Pins & Pegs Fest", start: "2026-08-17", end: "2026-08-20", kind: "fest", note: "弹珠/保龄/柏青哥主题官方活动", link: steamEventsSource },
  { id: "pve-survival-crafting-fest-2026", title: "PvE Survival Crafting Fest", start: "2026-08-31", end: "2026-09-07", kind: "fest", note: "PvE 生存制作主题官方活动", link: steamEventsSource },
  { id: "programming-fest-2026", title: "Programming Fest", start: "2026-09-10", end: "2026-09-14", kind: "fest", note: "编程/逻辑挑战主题官方活动", link: steamEventsSource },
  { id: "party-based-rpg-fest-2026", title: "Party-Based RPG Fest", start: "2026-09-14", end: "2026-09-21", kind: "fest", note: "队伍制 RPG 主题官方活动", link: steamEventsSource },
  { id: "cooking-fest-2026", title: "Cooking Fest", start: "2026-10-12", end: "2026-10-19", kind: "fest", note: "烹饪主题官方活动", link: steamEventsSource },
  { id: "steam-scream-v-2026", title: "Steam Scream V", start: "2026-10-26", end: "2026-11-02", kind: "fest", note: "恐怖/Halloween 主题官方活动", link: steamEventsSource },
  { id: "auto-battler-rpg-fest-2026", title: "Auto-Battler RPG Fest", start: "2026-11-16", end: "2026-11-23", kind: "fest", note: "自走棋 RPG 主题官方活动", link: steamEventsSource },
  { id: "next-fest-feb-2026", title: "Steam 新品节 2月", start: "2026-02-23", end: "2026-03-02", kind: "next", note: "Demo / 未发售项目重点观察", link: steamEventsSource },
  { id: "next-fest-jun-2026", title: "Steam 新品节 6月", start: "2026-06-15", end: "2026-06-22", kind: "next", note: "Demo / 未发售项目重点观察", link: "https://store.steampowered.com/sale/nextfest" },
  { id: "next-fest-oct-2026", title: "Steam 新品节 10月", start: "2026-10-19", end: "2026-10-26", kind: "next", note: "Demo / 未发售项目重点观察", link: steamEventsSource }
];
