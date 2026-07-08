import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { cleanHumanLeadText } from "../src/features/leads/leadHumanFields.ts";

describe("lead human field helpers", () => {
  it("hides automation placeholder copy from human-owned detail fields", () => {
    assert.equal(cleanHumanLeadText("V6判断：前置信号成立但还不够商务推进；先放入未处理 inbox，人工决定提测、观察或淘汰。"), null);
    assert.equal(cleanHumanLeadText("导入日报 2026-07-04：Sourcing V6.4 线上自动化摘要"), null);
    assert.equal(cleanHumanLeadText("Steam CN Demo/Next Fest Upcoming 前置信号 + 国内优先 + 系统型玩法，距发售约2天，先提测验证再决定商务深聊"), null);
    assert.equal(cleanHumanLeadText("人工 review 后决定提测、观察或淘汰；不要因为缺联系方式阻塞首轮测试"), null);
  });

  it("keeps real human notes and priority reasoning intact", () => {
    assert.equal(cleanHumanLeadText("已联系制作人，等 Demo Key 和发行窗口确认。"), "已联系制作人，等 Demo Key 和发行窗口确认。");
    assert.equal(cleanHumanLeadText("P1：玩法足够独特，B站内容放大可能成立。"), "P1：玩法足够独特，B站内容放大可能成立。");
    assert.equal(cleanHumanLeadText(null), null);
  });
});
