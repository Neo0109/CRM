import assert from "node:assert/strict";
import { collectBilibiliProbeSignals } from "../automations/jobs/bilibili_probe.mjs";

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
  developer_uids: [],
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
        }
      ] } });
    }

    if (parsed.pathname.includes("/x/web-interface/view")) {
      const bvid = parsed.searchParams.get("bvid");
      if (bvid === "BVOFFICIAL") {
        return okJson({ data: {
          bvid,
          title: "卡牌修真：九宫幻境录 Demo 官方PV",
          desc: "Steam商店页：https://store.steampowered.com/app/2921670/ 欢迎加入愿望单",
          dynamic: "Demo开放",
          owner: { mid: 100, name: "九宫幻境录官方" },
          pubdate: recent,
          stat: { view: 1200, like: 88, favorite: 20 },
          tag: [{ tag_name: "国产独立游戏" }, { tag_name: "Steam" }]
        } });
      }
      if (bvid === "BVOLD") {
        return okJson({ data: {
          bvid,
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

{
  const { signals, diagnostics } = await collectBilibiliProbeSignals({
    reportDate: "2026-06-29",
    config,
    fetchImpl: makeFakeFetch()
  });
  assert.ok(signals.length >= 1, "probe should keep at least one valid official signal");
  const official = signals.find((signal) => signal.bvid === "BVOFFICIAL");
  assert.ok(official, "official source should beat recommendation UP for the same Steam AppID");
  assert.equal(official.source, "B站探头-官方源");
  assert.equal(official.bilibili_probe.steam_app_id, "2921670");
  assert.ok(official.bilibili_probe.extracted_links.includes("https://store.steampowered.com/app/2921670/"));
  assert.ok(official.bilibili_probe.extracted_links.includes("https://steamdb.info/app/2921670/"));
  assert.ok(!signals.some((signal) => signal.bvid === "BVREC"), "duplicated recommendation UP should not survive official-source dedupe");
  assert.ok(!signals.some((signal) => signal.bvid === "BVGENERIC"), "generic recommendation collection should be filtered");
  assert.ok(!signals.some((signal) => signal.bvid === "BVOLD"), "old Bilibili videos should be filtered");
  assert.ok(!signals.some((signal) => signal.bvid === "BVBLACK"), "blacklisted videos should be filtered");
  assert.ok(diagnostics.official_source_hits >= 1);
  assert.ok(diagnostics.steam_links_extracted >= 1);
  assert.ok(diagnostics.duplicate_filtered >= 1);
  assert.ok(diagnostics.generic_collection_filtered >= 1);
  assert.ok(diagnostics.old_video_filtered >= 1);
  assert.ok(diagnostics.blacklist_filtered >= 1);
}

{
  const { signals, diagnostics } = await collectBilibiliProbeSignals({
    reportDate: "2026-06-29",
    config,
    fetchImpl: makeFakeFetch({ failKeyword: true })
  });
  assert.ok(signals.some((signal) => signal.bvid === "BVOFFICIAL"), "UP-list probe should still work when keyword source fails");
  assert.ok(diagnostics.source_failures >= 1, "keyword failure should be recorded as diagnostics");
}

console.log(JSON.stringify({ ok: true, checked: "bilibili-probe-v1" }, null, 2));
