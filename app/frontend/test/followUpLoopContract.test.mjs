import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

const leadsViewSource = readFileSync(new URL("../src/features/leads/LeadsView.tsx", import.meta.url), "utf8");
const calendarSource = readFileSync(new URL("../src/CalendarLauncher.tsx", import.meta.url), "utf8");
const weeklySource = readFileSync(new URL("../src/WeeklyReportLauncher.tsx", import.meta.url), "utf8");

describe("follow-up loop product contract", () => {
  it("makes Leads Review the primary weekly work queue surface", () => {
    assert.match(leadsViewSource, /buildFollowUpQueue/);
    assert.match(leadsViewSource, /本周待办/);
    assert.match(leadsViewSource, /followUpQueue\.items\.slice\(0,\s*5\)/);
    assert.match(leadsViewSource, /needsAction/);
  });

  it("keeps Calendar opt-in while showing the same weekly queue", () => {
    assert.match(calendarSource, /buildFollowUpQueue/);
    assert.match(calendarSource, /buildCalendarReminderPatch/);
    assert.match(calendarSource, /canQuickAddFollowUpToCalendar/);
    assert.match(calendarSource, /本周待办/);
    assert.match(calendarSource, /followUpQueue\.count/);
    assert.match(calendarSource, /onAddToCalendar/);
    assert.match(calendarSource, /加入日历/);
    assert.match(calendarSource, /日历只显示你手动加入/);
    assert.doesNotMatch(calendarSource, /followUpQueue\.items\.forEach[\s\S]*calendar_enabled:\s*true/);
  });

  it("adds a non-blocking weekly work queue to Weekly Report", () => {
    assert.match(weeklySource, /fetchLeads/);
    assert.match(weeklySource, /buildFollowUpQueue/);
    assert.match(weeklySource, /本周待办/);
    assert.match(weeklySource, /setFollowUpError/);
    assert.match(weeklySource, /followUpQueue\.items/);
  });
});
