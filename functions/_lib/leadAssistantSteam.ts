export type SteamAppData = {
  type?: string;
  name?: string;
  developers?: string[];
  publishers?: string[];
  genres?: { description?: string }[];
  short_description?: string;
  release_date?: { coming_soon?: boolean; date?: string };
  website?: string;
};

type SteamAppResponse = Record<string, { success?: boolean; data?: SteamAppData }>;

type FetchLike = typeof fetch;

export async function fetchSteamAppDetails(steamAppId: string, fetchFn: FetchLike = fetch) {
  try {
    const response = await fetchFn(`https://store.steampowered.com/api/appdetails?appids=${steamAppId}&cc=us&l=schinese`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    const payload = await response.json() as SteamAppResponse;
    const entry = payload[steamAppId];
    return entry?.success ? entry.data ?? null : null;
  } catch {
    return null;
  }
}
