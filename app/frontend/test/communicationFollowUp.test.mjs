import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  buildInteractionInput,
  communicationOwners,
  communicationStatusForLead,
  createInteractionRequestId,
  filterCommunicationLeads,
  mergeInteractionPage,
  newInteractionDraft,
  resolveInteractionRequest,
  shouldCommitTimelineResponse,
  validateInteractionDraft
} from "../src/communicationFollowUp.ts";

const now = new Date("2026-08-11T04:00:00.000Z");

function lead(overrides = {}) {
  return {
    id: "lead-default",
    project: "Default Project",
    team: "Default Team",
    owner: "Neo",
    bucket: "跟进中",
    priority: "P1",
    due_date: "2026-08-20",
    next_action: "发送商务方案",
    contact: null,
    contact_methods: [],
    ...overrides
  };
}

describe("communication follow-up queue", () => {
  it("keeps only eligible pools and sorts overdue, today, 7 days, missing, then future", () => {
    const leads = [
      lead({ id: "future", project: "Future", due_date: "2026-08-20" }),
      lead({ id: "missing", project: "Missing", due_date: null, next_action: null }),
      lead({ id: "soon", project: "Soon", due_date: "2026-08-15" }),
      lead({ id: "today", project: "Today", due_date: "2026-08-11" }),
      lead({ id: "overdue", project: "Overdue", due_date: "2026-08-09" }),
      lead({ id: "excluded", project: "Excluded", bucket: "待评测" })
    ];

    const result = filterCommunicationLeads(leads, {
      query: "",
      owner: "all",
      pool: "all",
      due: "all"
    }, now);

    assert.deepEqual(result.map((item) => item.id), ["overdue", "today", "soon", "missing", "future"]);
    assert.equal(communicationStatusForLead(result[0], now), "overdue");
    assert.equal(communicationStatusForLead(result[1], now), "today");
    assert.equal(communicationStatusForLead(result[2], now), "next-7-days");
    assert.equal(communicationStatusForLead(result[3], now), "missing");
    assert.equal(communicationStatusForLead(result[4], now), "future");
  });

  it("filters by search, owner, pool, and due state", () => {
    const leads = [
      lead({ id: "neo", project: "Moon Studio", owner: "Neo", bucket: "推进池", due_date: "2026-08-09" }),
      lead({ id: "jojo", project: "Sun Studio", owner: "Jojo", contact_methods: [{ type: "Email", value: "sun@example.com" }] }),
      lead({ id: "empty", project: "No Date", owner: null, due_date: null })
    ];

    assert.deepEqual(communicationOwners(leads), ["Jojo", "Neo"]);
    assert.deepEqual(filterCommunicationLeads(leads, {
      query: "moon",
      owner: "Neo",
      pool: "推进池",
      due: "overdue"
    }, now).map((item) => item.id), ["neo"]);
    assert.deepEqual(filterCommunicationLeads(leads, {
      query: "sun@example.com",
      owner: "all",
      pool: "all",
      due: "all"
    }, now).map((item) => item.id), ["jojo"]);
    assert.deepEqual(filterCommunicationLeads(leads, {
      query: "",
      owner: "all",
      pool: "all",
      due: "missing"
    }, now).map((item) => item.id), ["empty"]);
  });

  it("excludes missing next actions from future reminders", () => {
    const missingAction = lead({
      id: "future-missing-action",
      due_date: "2026-08-20",
      next_action: "  "
    });
    const validFuture = lead({
      id: "future-with-action",
      due_date: "2026-08-20",
      next_action: "发送商务方案"
    });

    assert.equal(communicationStatusForLead(missingAction, now), "missing");
    assert.deepEqual(filterCommunicationLeads([missingAction], {
      query: "",
      owner: "all",
      pool: "all",
      due: "missing"
    }, now).map((item) => item.id), ["future-missing-action"]);
    assert.deepEqual(filterCommunicationLeads([missingAction, validFuture], {
      query: "",
      owner: "all",
      pool: "all",
      due: "future"
    }, now).map((item) => item.id), ["future-with-action"]);
  });
});

describe("interaction form contract", () => {
  it("enforces required summary, field bounds, and the date/next-action relationship", () => {
    const draft = newInteractionDraft(now);
    assert.equal(draft.occurred_at, "2026-08-11T12:00");
    assert.equal(validateInteractionDraft(draft).summary, "请填写沟通摘要");

    assert.equal(validateInteractionDraft({
      ...draft,
      summary: "确认本周进展",
      next_follow_up_date: "2026-08-18"
    }).next_action, "设置下次跟进日期时必须填写下一步动作");

    assert.equal(validateInteractionDraft({
      ...draft,
      summary: "确认本周进展",
      next_action: "发送更新",
      next_follow_up_date: "2026-08-10"
    }).next_follow_up_date, "下次跟进日期不能早于沟通日期");

    assert.match(validateInteractionDraft({ ...draft, summary: "x".repeat(2001) }).summary, /2000/);
    assert.match(validateInteractionDraft({ ...draft, summary: "ok", contact_label: "x".repeat(121) }).contact_label, /120/);
    assert.match(validateInteractionDraft({ ...draft, summary: "ok", next_action: "x".repeat(501) }).next_action, /500/);
  });

  it("builds the fixed API payload and preserves optional nulls", () => {
    const draft = {
      ...newInteractionDraft(now),
      channel: "会议",
      contact_label: " 商务负责人 ",
      summary: " 确认商务条件。 ",
      next_action: " 发送修订版 ",
      next_follow_up_date: "2026-08-18"
    };
    assert.deepEqual(buildInteractionInput("lead-1", "request-web-001", draft), {
      request_id: "request-web-001",
      lead_id: "lead-1",
      channel: "会议",
      contact_label: "商务负责人",
      occurred_at: "2026-08-11T04:00:00.000Z",
      summary: "确认商务条件。",
      next_action: "发送修订版",
      next_follow_up_date: "2026-08-18"
    });
    assert.match(createInteractionRequestId(1234, 0.5), /^web-[a-z0-9]+-[a-z0-9]+$/);
  });

  it("reuses a failed request id only while the normalized payload is unchanged", () => {
    const draft = {
      ...newInteractionDraft(now),
      summary: "确认本周进展"
    };
    const first = resolveInteractionRequest(
      undefined,
      "lead-1",
      draft,
      () => "request-web-001"
    );
    const unchangedRetry = resolveInteractionRequest(
      first,
      "lead-1",
      { ...draft },
      () => "request-web-002"
    );
    const editedRetry = resolveInteractionRequest(
      first,
      "lead-1",
      { ...draft, summary: "确认本周进展并补充新条款" },
      () => "request-web-002"
    );

    assert.strictEqual(unchangedRetry, first);
    assert.equal(editedRetry.requestId, "request-web-002");
    assert.notEqual(editedRetry.fingerprint, first.fingerprint);
  });
});

describe("interaction timeline race protection", () => {
  it("commits only the newest request for the currently selected Lead", () => {
    assert.equal(shouldCommitTimelineResponse(3, 3, "lead-a", "lead-a"), true);
    assert.equal(shouldCommitTimelineResponse(2, 3, "lead-a", "lead-a"), false);
    assert.equal(shouldCommitTimelineResponse(3, 3, "lead-a", "lead-b"), false);
  });

  it("deduplicates idempotent responses and keeps the timeline newest-first", () => {
    const older = interaction({ id: "old", occurred_at: "2026-08-10T04:00:00.000Z" });
    const newer = interaction({ id: "new", occurred_at: "2026-08-11T04:00:00.000Z" });
    assert.deepEqual(
      mergeInteractionPage([older], { interactions: [older, newer] }).map((item) => item.id),
      ["new", "old"]
    );
  });
});

function interaction(overrides = {}) {
  return {
    id: "interaction",
    occurred_at: "2026-08-11T04:00:00.000Z",
    created_at: "2026-08-11T04:00:00.000Z",
    ...overrides
  };
}
