import type { Lead } from "./types";

type CalendarReminderCandidate = Pick<Lead, "calendar_enabled" | "due_date">;

export function canQuickAddFollowUpToCalendar(lead: CalendarReminderCandidate) {
  return Boolean(lead.due_date && !lead.calendar_enabled);
}

export function buildCalendarReminderPatch(lead: CalendarReminderCandidate): Pick<Lead, "calendar_enabled" | "due_date"> | null {
  if (!canQuickAddFollowUpToCalendar(lead)) return null;
  return {
    due_date: lead.due_date,
    calendar_enabled: true
  };
}
