import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildCalendarReminderPatch, canQuickAddFollowUpToCalendar } from "../src/calendarFollowUpActions.ts";

function lead(overrides = {}) {
  return {
    id: "lead-1",
    project: "Calendar Candidate",
    bucket: "跟进中",
    stage: "active",
    due_date: "2026-07-10",
    calendar_enabled: false,
    follow_up_interval: null,
    next_action: "确认发行窗口",
    owner: "Neo",
    priority: "P1",
    ...overrides
  };
}

describe("calendar follow-up actions", () => {
  it("quick-adds due follow-up items to calendar without moving workflow state", () => {
    const candidate = lead({ bucket: "推进池", stage: "active" });

    assert.equal(canQuickAddFollowUpToCalendar(candidate), true);
    assert.deepEqual(buildCalendarReminderPatch(candidate), {
      due_date: "2026-07-10",
      calendar_enabled: true
    });
  });

  it("does not quick-add items that are already visible or have no due date", () => {
    assert.equal(canQuickAddFollowUpToCalendar(lead({ calendar_enabled: true })), false);
    assert.equal(canQuickAddFollowUpToCalendar(lead({ due_date: null })), false);
    assert.equal(buildCalendarReminderPatch(lead({ calendar_enabled: true })), null);
    assert.equal(buildCalendarReminderPatch(lead({ due_date: null })), null);
  });
});
