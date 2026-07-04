import assert from "node:assert/strict";
import {
  buildAiLead,
  buildManualLead,
  buildSteamLead,
  ensureContactMethods,
  extractLeadAssistantSignals,
  normalizeAiContacts,
  normalizeAssistantInput
} from "../functions/_lib/leadAssistantModel";
import { fetchSteamAppDetails } from "../functions/_lib/leadAssistantSteam";
import { hasImageDataUrl, responseOutputText } from "../functions/_lib/leadAssistantVision";

function testInputNormalizationAndImageDetection() {
  const payload = {
    text: "  项目：星海工坊  ",
    keywords: ["  Steam AppID: 123456  ", "", "  上海团队  "],
    attachments: [
      { name: "", type: "", data_url: "" },
      { name: "screen.png", type: "image/png", size: 2048, source: "paste", data_url: "data:image/png;base64,AAA" },
      { name: "note.txt", type: "text/plain", source: "upload" }
    ]
  };

  const normalized = normalizeAssistantInput(payload);

  assert.equal(normalized.text, "项目：星海工坊\nSteam AppID: 123456\n上海团队");
  assert.equal(normalized.attachments.length, 2);
  assert.equal(normalized.imageAttachments.length, 1);
  assert.equal(normalized.imageAttachments[0].name, "screen.png");
  assert.equal(hasImageDataUrl(normalized.imageAttachments[0]), true);
  assert.equal(hasImageDataUrl({ data_url: "data:application/pdf;base64,AAA" }), false);
}

function testSignalExtractionNormalizesLinksAndContacts() {
  const signals = extractLeadAssistantSignals(`
    项目：Moon Cafe
    https://store.steampowered.com/app/111111/Moon_Cafe/；
    https://steamdb.info/app/111111/,
    appid: 222222
    官网 https://mooncafe.example.com/contact。
    联系邮箱 hello@mooncafe.example.com 电话 +86 138 0013 8000
    微信 moon_cafe Discord moon#1234
  `);

  assert.deepEqual(signals.steamAppIds, ["111111", "222222"]);
  assert.ok(signals.links.includes("https://store.steampowered.com/app/111111/Moon_Cafe/"));
  assert.ok(signals.links.includes("https://steamdb.info/app/111111/"));
  assert.ok(signals.links.includes("https://mooncafe.example.com/contact"));
  assert.ok(signals.contacts.some((contact) => contact.type === "Email" && contact.value === "hello@mooncafe.example.com"));
  assert.ok(signals.contacts.some((contact) => contact.type === "电话" && contact.value === "+86 138 0013 8000"));
  assert.ok(signals.contacts.some((contact) => contact.type === "微信/QQ" && contact.value === "moon_cafe"));
  assert.ok(signals.contacts.some((contact) => contact.type === "Discord" && contact.value === "moon#1234"));
  assert.ok(!signals.contacts.some((contact) => contact.value.includes("store.steampowered.com/app/111111")));
}

function testContactFallbacksStayReachable() {
  const contacts = normalizeAiContacts(
    [
      { type: "Email", value: "bd@example.com", note: "press" },
      { type: "Steam", value: "https://store.steampowered.com/app/333333/" },
      { type: null, value: "https://x.com/example" }
    ],
    "https://steamdb.info/app/333333/"
  );

  assert.deepEqual(contacts, [
    { type: "Email", value: "bd@example.com", note: "press" },
    { type: "X/Twitter", value: "https://x.com/example", note: null }
  ]);

  assert.deepEqual(ensureContactMethods([], "333333", []), [{
    type: "Steam",
    value: "https://steamcommunity.com/app/333333/discussions/",
    note: "线索助手自动补充的 Steam 社区联系入口"
  }]);
  assert.deepEqual(ensureContactMethods([], null, ["https://studio.example.com", "https://steamdb.info/app/333333/"]), [{
    type: "官网",
    value: "https://studio.example.com",
    note: "线索助手从输入链接中提取"
  }]);
}

function testSteamAndManualLeadShapes() {
  const steamLead = buildSteamLead({
    steamAppId: "444444",
    details: {
      type: "game",
      name: "Cloud Runner",
      developers: ["Cloud Studio"],
      publishers: ["Cloud Publisher"],
      genres: [{ description: "Action" }, { description: "Adventure" }],
      short_description: "Fast co-op action.",
      release_date: { coming_soon: true, date: "2026" },
      website: "https://cloudrunner.example.com"
    },
    text: "上海团队 高视觉 愿望单增长 early access",
    links: ["https://cloudrunner.example.com"],
    contacts: [],
    attachments: [{ name: "screen.png", type: "image/png", size: 1536, source: "paste" }],
    today: "2026-07-04"
  });

  assert.equal(steamLead.project, "Cloud Runner");
  assert.equal(steamLead.bucket, "未处理");
  assert.equal(steamLead.stage, "new");
  assert.equal(steamLead.priority, "P1");
  assert.equal(steamLead.review_status, "未处理");
  assert.equal(steamLead.steam_app_id, "444444");
  assert.ok(steamLead.links?.includes("https://store.steampowered.com/app/444444/"));
  assert.ok(steamLead.links?.includes("https://steamdb.info/app/444444/"));
  assert.equal(steamLead.contact_methods?.[0]?.value, "https://steamcommunity.com/app/444444/discussions/");
  assert.ok(steamLead.notes?.includes("截图：粘贴 / screen.png / image/png / 2 KB"));

  const manualLead = buildManualLead({
    text: "项目：Lunar Garden\n官网 https://lunargarden.example.com/contact\n适合主播挑战",
    links: ["https://lunargarden.example.com/contact"],
    contacts: [],
    attachments: [],
    today: "2026-07-04"
  });

  assert.equal(manualLead.project, "Lunar Garden");
  assert.equal(manualLead.stage, "new");
  assert.equal(manualLead.progress, "线索助手录入，待补 Steam/官网信息");
  assert.equal(manualLead.rule_fit, "缺少 Steam/SteamDB 链接，需要补充可验证页面");
  assert.equal(manualLead.contact_methods?.[0]?.type, "官网");
  assert.equal(manualLead.next_action, "补充 Steam/官网链接后再判断");
}

async function testAiLeadUsesStubbedSteamLookup() {
  const lead = await buildAiLead(
    {
      project: null,
      steam_app_id: null,
      country: null,
      bucket: "推进池",
      priority: "P0",
      links: ["https://steamdb.info/app/555555/", "https://studio.example.com"],
      contact_methods: [{ type: null, value: "https://discord.gg/studio", note: "community" }],
      notes: "上海团队，有主播挑战内容"
    },
    {
      text: "截图显示上海团队，wishlist 暴涨",
      attachments: [],
      ocrText: "Steam App 555555",
      searchSummary: "找到 Steam 和 Discord",
      today: "2026-07-04"
    },
    {
      loadSteamAppDetails: async (appId) => {
        assert.equal(appId, "555555");
        return {
          type: "game",
          name: "Signal Forge",
          developers: ["Signal Team"],
          publishers: ["Signal Publisher"],
          genres: [{ description: "Strategy" }],
          short_description: "Signal tactics.",
          release_date: { coming_soon: false, date: "4 Jul, 2026" },
          website: "https://signalforge.example.com"
        };
      }
    }
  );

  assert.ok(lead);
  assert.equal(lead.project, "Signal Forge");
  assert.equal(lead.steam_app_id, "555555");
  assert.equal(lead.bucket, "推进池");
  assert.equal(lead.stage, "negotiating");
  assert.equal(lead.priority, "P0");
  assert.equal(lead.country, "中国");
  assert.equal(lead.region_priority, "国内优先");
  assert.equal(lead.publisher_name, "Signal Publisher");
  assert.ok(lead.links?.includes("https://store.steampowered.com/app/555555/"));
  assert.ok(lead.links?.includes("https://steamdb.info/app/555555/"));
  assert.equal(lead.contact_methods?.[0]?.type, "Discord");
  assert.ok(lead.notes?.includes("AI 检索：找到 Steam 和 Discord"));

  const skipped = await buildAiLead(
    { project: "Soundtrack", steam_app_id: "666666", links: [] },
    { text: "", attachments: [], today: "2026-07-04" },
    { loadSteamAppDetails: async () => ({ type: "music", name: "Soundtrack" }) }
  );
  assert.equal(skipped, null);
}

function testVisionOutputTextExtraction() {
  assert.equal(responseOutputText({ output_text: "{\"ok\":true}" }), "{\"ok\":true}");
  assert.equal(responseOutputText({
    output: [
      { content: [{ text: "{\"leads\":" }, { output_text: "[]}" }] }
    ]
  }), "{\"leads\":\n[]}");
  assert.equal(typeof fetchSteamAppDetails, "function");
}

async function main() {
  testInputNormalizationAndImageDetection();
  testSignalExtractionNormalizesLinksAndContacts();
  testContactFallbacksStayReachable();
  testSteamAndManualLeadShapes();
  await testAiLeadUsesStubbedSteamLookup();
  testVisionOutputTextExtraction();
  console.log("lead assistant model tests passed");
}

void main();
