import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../src/CommunicationFollowUpPage.tsx", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
const calendarSource = readFileSync(new URL("../src/CalendarLauncher.tsx", import.meta.url), "utf8");

describe("communication follow-up frontend contract", () => {
  it("adds the authenticated top-level page and writes returned Leads back to App state", () => {
    assert.match(appSource, /"follow-up": "沟通跟进"/);
    assert.match(appSource, /<MessageSquareText[^>]*\/>沟通跟进/);
    assert.match(appSource, /<CommunicationFollowUpPage/);
    assert.match(appSource, /onLeadUpdated=\{handleInteractionLeadUpdated\}/);
    assert.match(appSource, /setLeads\(\(current\) => current\.map/);
    assert.match(pageSource, /onLeadUpdated\(result\.lead\)/);
  });

  it("keeps the project list bounded and exposes all approved filters and states", () => {
    assert.match(pageSource, /communicationBuckets\.some/);
    assert.match(pageSource, /搜索项目、团队或联系方式/);
    assert.match(pageSource, /全部 Owner/);
    assert.match(pageSource, /跟进中 \+ 推进池/);
    assert.match(pageSource, /缺下一步或日期/);
    assert.match(pageSource, /未来提醒/);
  });

  it("lazy-loads per-Lead history without allowing stale quick-switch responses to bleed", () => {
    assert.match(pageSource, /fetchInteractions\(leadId/);
    assert.match(pageSource, /new AbortController\(\)/);
    assert.match(pageSource, /shouldCommitTimelineResponse/);
    assert.match(pageSource, /暂无沟通记录/);
    assert.match(pageSource, /沟通历史加载失败/);
  });

  it("enforces field limits, disables duplicate submit, handles save failure and 409", () => {
    assert.match(pageSource, /maxLength=\{120\}/);
    assert.match(pageSource, /maxLength=\{2000\}/);
    assert.match(pageSource, /maxLength=\{500\}/);
    assert.match(pageSource, /disabled=\{saving\}/);
    assert.match(pageSource, /isApiErrorStatus\(error, 409\)/);
    assert.match(pageSource, /已移出跟进中或推进池/);
    assert.match(pageSource, /沟通记录保存失败/);
    assert.match(apiSource, /class ApiError extends Error/);
    assert.match(apiSource, /this\.status = status/);
  });

  it("shows the next action on Lead agenda cards and explains both calendar entry paths", () => {
    assert.match(calendarSource, /nextAction: lead\.next_action/);
    assert.match(calendarSource, /calendar-agenda-next-action/);
    assert.match(calendarSource, /手动确认提醒，或在沟通记录中设置下次日期/);
  });
});
