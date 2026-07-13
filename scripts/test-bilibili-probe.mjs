import assert from "node:assert/strict";
import { collectBilibiliProbeSignals, defaultBilibiliProbeDiagnostics } from "../automations/jobs/bilibili_probe.mjs";

function okJson(value) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    async json() {
      return value;
    }
  };
}

const recent = Math.floor(Date.parse("2026-06-20T00:00:00+08:00") / 1000);
const old = Math.floor(Date.parse("2025-01-01T00:00:00+08:00") / 1000);

const config = {
  schema_version: 1,
  rule_version: "sourcing-rules-v6.4-bili-probe",
  max_video_age_days: 120,
  max_detail_fetches: 20,
  official_uids: ["100"],
  developer_uids: ["101"],
  publisher_uids: [],
  media_uids: [],
  trusted_creator_uids: ["200"],
  keywords: ["卡牌修真"],
  required_keywords: ["Steam", "Demo", "试玩"],
  blacklist_uids: ["999"],
  blacklist_bvids: ["BVBLACK"],
  blacklist_keywords: ["广告"],
  generic_collection_patterns: ["盘点", "推荐", "合集"]
};

function makeFakeFetch({ failKeyword = false } = {}) {
  return async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname.includes("/x/space/arc/search")) {
      const mid = parsed.searchParams.get("mid");
      if (mid === "100") {
        return okJson({ data: { list: { vlist: [
          {
            bvid: "BVOFFICIAL",
            aid: 1,
            title: "卡牌修真：九宫幻境录 Demo 官方PV",
            description: "Steam商店页：https://store.steampowered.com/app/2921670/",
            created: recent,
            mid: "100",
            author: "九宫幻境录官方",
            play: 1200
          }
        ] } } });
      }
      if (mid === "101") {
        return okJson({ data: { list: { vlist: [
          {
            bvid: "BVDEV",
            aid: 6,
            title: "另一款国产策略 Demo 开发日志",
            description: "Steam：https://store.steampowered.com/app/3000000/",
            created: recent,
            mid: "101",
            author: "开发组",
            play: 600
          }
        ] } } });
      }
      return okJson({ data: { list: { vlist: [] } } });
    }

    if (parsed.pathname.includes("/x/web-interface/search/type")) {
      if (failKeyword) throw new Error("keyword source down");
      return okJson({ data: { result: [
        {
          bvid: "BVREC",
          aid: 2,
          title: "卡牌修真：九宫幻境录 Demo 试玩",
          description: "Steam商店页：https://store.steampowered.com/app/2921670/",
          pubdate: recent,
          mid: "200",
          author: "推荐UP",
          play: 800
        },
        {
          bvid: "BVGENERIC",
          aid: 3,
          title: "三款国产独立游戏推荐合集",
          description: "Steam Demo",
          pubdate: recent,
          mid: "200",
          author: "推荐UP",
          play: 700
        },
        {
          bvid: "BVOLD",
          aid: 4,
          title: "卡牌修真旧PV Steam Demo",
          description: "Steam商店页：https://store.steampowered.com/app/2999990/",
          pubdate: old,
          mid: "201",
          author: "旧UP",
          play: 300
        },
        {
          bvid: "BVBLACK",
          aid: 5,
          title: "卡牌修真黑名单 Steam Demo",
          description: "Steam Demo",
          pubdate: recent,
          mid: "999",
          author: "黑名单UP",
          play: 500
        },
        {
          bvid: "BVNO_KEYWORD",
          aid: 7,
          title: "卡牌修真开发闲聊",
          description: "没有关键发布窗口",
          pubdate: recent,
          mid: "202",
          author: "路人UP",
          play: 200
        }
      ] } });
    }

    if (parsed.pathname.includes("/x/web-interface/view")) {
      const bvid = parsed.searchParams.get("bvid");
      const base = {
        bvid,
        pubdate: recent,
        stat: { view: 1200, like: 88, favorite: 20 },
        tag: [{ tag_name: "国产独立游戏" }, { tag_name: "Steam" }]
      };
      if (bvid === "BVOFFICIAL") {
        return okJson({ data: {
          ...base,
          title: "卡牌修真：九宫幻境录 Demo 官方PV",
          desc: "Steam商店页：https://store.steampowered.com/app/2921670/ 官网：https://nine.example.com 联系邮箱 bd@nine.example.com",
          dynamic: "Demo开放",
          owner: { mid: 100, name: "九宫幻境录官方" }
        } });
      }
      if (bvid === "BVDEV") {
        return okJson({ data: {
          ...base,
          title: "另一款国产策略 Demo 开发日志",
          desc: "Steam：https://store.steampowered.com/app/3000000/",
          owner: { mid: 101, name: "开发组" }
        } });
      }
      if (bvid === "BVOLD") {
        return okJson({ data: {
          ...base,
          title: "卡牌修真旧PV Steam Demo",
          desc: "Steam商店页：https://store.steampowered.com/app/2999990/",
          owner: { mid: 201, name: "旧UP" },
          pubdate: old,
          stat: { view: 300 },
          tag: []
        } });
      }
    }

    return okJson({ data: {} });
  };
}

assert.deepEqual(defaultBilibiliProbeDiagnostics(), {
  raw_candidates: 0,
  keyword_candidates: 0,
  up_candidates: 0,
  detail_success: 0,
  detail_failed: 0,
  source_failures: 0,
  official_source_hits: 0,
  developer_source_hits: 0,
  publisher_source_hits: 0,
  media_source_hits: 0,
  trusted_creator_hits: 0,
  links_extracted: 0,
  steam_links_extracted: 0,
  steam_links_detected: 0,
  blacklist_filtered: 0,
  old_video_filtered: 0,
  generic_collection_filtered: 0,
  required_keyword_filtered: 0,
  duplicate_filtered: 0,
  final_candidates: 0,
  request_retries: 0,
  rate_limit_retries: 0,
  fallback_queries: 0,
  source_health: {}
});

{
  const { signals, diagnostics } = await collectBilibiliProbeSignals({
    reportDate: "2026-06-29",
    config,
    fetchImpl: makeFakeFetch(),
    sleepImpl: async () => {}
  });
  assert.ok(signals.length >= 2, "probe should keep valid official and developer signals");
  const official = signals.find((signal) => signal.bvid === "BVOFFICIAL");
  assert.ok(official, "official source should beat recommendation UP for the same Steam AppID");
  assert.equal(official.source, "B站探头-官方源");
  assert.equal(official.bilibili_probe.steam_app_id, "2921670");
  assert.equal(official.bilibili_probe.source_kind, "official");
  assert.ok(official.bilibili_probe.extracted_links.includes("https://store.steampowered.com/app/2921670/"));
  assert.ok(official.bilibili_probe.extracted_links.includes("https://steamdb.info/app/2921670/"));
  assert.ok(official.bilibili_probe.extracted_links.includes("https://nine.example.com"));
  assert.ok(official.summary.includes("bd@nine.example.com"));
  assert.ok(signals.some((signal) => signal.bvid === "BVDEV" && signal.bilibili_probe.source_kind === "developer"));
  assert.ok(!signals.some((signal) => signal.bvid === "BVREC"), "duplicated recommendation UP should not survive official-source dedupe");
  assert.ok(!signals.some((signal) => signal.bvid === "BVGENERIC"), "generic recommendation collection should be filtered");
  assert.ok(!signals.some((signal) => signal.bvid === "BVOLD"), "old Bilibili videos should be filtered");
  assert.ok(!signals.some((signal) => signal.bvid === "BVBLACK"), "blacklisted videos should be filtered");
  assert.ok(!signals.some((signal) => signal.bvid === "BVNO_KEYWORD"), "non-official videos without required keywords should be filtered");
  assert.equal(diagnostics.official_source_hits, 1);
  assert.equal(diagnostics.developer_source_hits, 1);
  assert.ok(diagnostics.steam_links_extracted >= 2);
  assert.ok(diagnostics.duplicate_filtered >= 1);
  assert.ok(diagnostics.generic_collection_filtered >= 1);
  assert.ok(diagnostics.old_video_filtered >= 1);
  assert.ok(diagnostics.blacklist_filtered >= 1);
  assert.ok(diagnostics.required_keyword_filtered >= 1);
  assert.equal(diagnostics.final_candidates, signals.length);
}

{
  const { signals, diagnostics } = await collectBilibiliProbeSignals({
    reportDate: "2026-06-29",
    config,
    fetchImpl: makeFakeFetch({ failKeyword: true }),
    sleepImpl: async () => {}
  });
  assert.ok(signals.some((signal) => signal.bvid === "BVOFFICIAL"), "UP-list probe should still work when keyword source fails");
  assert.ok(diagnostics.source_failures >= 1, "keyword failure should be recorded as diagnostics");
}

console.log(JSON.stringify({ ok: true, checked: "bilibili-probe-v1" }, null, 2));
