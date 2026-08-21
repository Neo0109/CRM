import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { linkLabel, normalizedLinkHref } from "../src/linkPresentation.ts";

describe("Steam link presentation helpers", () => {
  it("renders Steam community app links as Steam store links without changing stored values", () => {
    const communityUrl = "https://steamcommunity.com/app/2921670/discussions/";

    assert.equal(normalizedLinkHref(communityUrl), "https://store.steampowered.com/app/2921670/");
    assert.equal(linkLabel(communityUrl), "Steam");
  });

  it("keeps existing labels and hrefs for non-community-app links", () => {
    assert.equal(normalizedLinkHref("https://store.steampowered.com/app/2921670/Demo_Game/"), "https://store.steampowered.com/app/2921670/Demo_Game/");
    assert.equal(linkLabel("https://store.steampowered.com/app/2921670/Demo_Game/"), "Steam");
    assert.equal(normalizedLinkHref("https://steamdb.info/app/2921670/"), "https://steamdb.info/app/2921670/");
    assert.equal(linkLabel("https://steamdb.info/app/2921670/"), "SteamDB");
    assert.equal(normalizedLinkHref("https://www.bilibili.com/video/BV1example/"), "https://www.bilibili.com/video/BV1example/");
    assert.equal(linkLabel("https://www.bilibili.com/video/BV1example/"), "B站");
    assert.equal(linkLabel("https://b23.tv/BV1example"), "B站");
    assert.equal(normalizedLinkHref("https://steamcommunity.com/id/demo-studio/"), "https://steamcommunity.com/id/demo-studio/");
    assert.equal(linkLabel("https://steamcommunity.com/id/demo-studio/"), "steamcommunity.com");
    assert.equal(linkLabel("https://example.com/presskit"), "example.com");
  });
});
