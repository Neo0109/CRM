const STEAM_COMMUNITY_APP_PATTERN = /steamcommunity\.com\/app\/(\d+)/i;

export function normalizedLinkHref(link: string) {
  const steamStoreUrl = steamStoreUrlFromCommunityApp(link);
  return steamStoreUrl ?? link;
}

export function linkLabel(link: string) {
  if (steamStoreUrlFromCommunityApp(link)) return "Steam";
  if (link.includes("store.steampowered.com/app/")) return "Steam";
  if (link.includes("steamdb.info/app/")) return "SteamDB";
  if (link.includes("steamdb.info")) return "SteamDB";
  if (link.includes("bilibili.com")) return "B站";
  try { return new URL(link).hostname.replace("www.", ""); } catch { return "链接"; }
}

function steamStoreUrlFromCommunityApp(value: string) {
  const appId = steamCommunityAppId(value);
  return appId ? `https://store.steampowered.com/app/${appId}/` : null;
}

function steamCommunityAppId(value: string) {
  try {
    const url = new URL(value);
    if (!/steamcommunity\.com$/i.test(url.hostname)) return null;
    const match = url.pathname.match(/^\/app\/(\d+)/i);
    return match?.[1] ?? null;
  } catch {
    const match = value.match(STEAM_COMMUNITY_APP_PATTERN);
    return match?.[1] ?? null;
  }
}
