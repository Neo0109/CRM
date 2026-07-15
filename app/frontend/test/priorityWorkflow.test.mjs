import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { priorityLabel, priorityTone } from "../src/features/leads/leadConstants.ts";
import { emptyLeadFilters, filterLeads } from "../src/features/leads/leadFilters.ts";

const leadsViewSource = readFileSync(new URL("../src/features/leads/LeadsView.tsx", import.meta.url), "utf8");
const leadDetailSource = readFileSync(new URL("../src/features/leads/LeadDetail.tsx", import.meta.url), "utf8");

function lead(id, priority) {
  return {
    id,
    project: id,
    steam_app_id: null,
    team: null,
    team_size: null,
    country: "中国",
    region: "中国",
    city: null,
    region_priority: "国内优先",
    bucket: "测试中",
    stage: "active",
    priority,
    review_status: "已查看",
    reviewed_at: null,
    drop_reason: null,
    priority_reason: null,
    rule_fit: null,
    genre: null,
    gameplay: null,
    progress: "待补充",
    release_window: null,
    early_access: false,
    narrative_heavy: false,
    india_team: false,
    publisher_status: "待确认",
    publisher_name: null,
    china_capability_occupied: false,
    traction_summary: null,
    public_signals: null,
    contact: null,
    contact_methods: [],
    links: [],
    exposure_trail: null,
    bilibili_fit: "待评估",
    amplification: "待评估",
    risks: null,
    verdict: "待判断",
    evaluation_grade: null,
    evaluation_result: null,
    evaluated_at: null,
    next_action: null,
    owner: null,
    due_date: null,
    calendar_enabled: false,
    follow_up_interval: null,
    first_seen: "2026-07-15",
    notes: null
  };
}

describe("nullable priority workflow", () => {
  it("presents an unlabeled priority explicitly and neutrally", () => {
    assert.equal(priorityLabel(null), "未标注");
    assert.equal(priorityTone(null), "unlabeled");
  });

  it("sorts unlabeled leads after P0-P3", () => {
    const leads = [lead("unlabeled", null), lead("p3", "P3"), lead("p1", "P1"), lead("p0", "P0"), lead("p2", "P2")];
    const result = filterLeads(leads, { ...emptyLeadFilters, bucket: "测试中" });

    assert.deepEqual(result.map((item) => item.id), ["p0", "p1", "p2", "p3", "unlabeled"]);
  });

  it("filters the explicit unlabeled state", () => {
    const leads = [lead("unlabeled", null), lead("p1", "P1")];
    const result = filterLeads(leads, { ...emptyLeadFilters, priority: "未标注" });

    assert.deepEqual(result.map((item) => item.id), ["unlabeled"]);
  });

  it("wires the list filter and detail editor to set or clear priority", () => {
    assert.match(leadsViewSource, /<Select label="优先级"[\s\S]*priorityFilterOptions/);
    assert.match(leadDetailSource, /value=\{prioritySelection\(draft\.priority\)\}/);
    assert.match(leadDetailSource, /setField\("priority", priorityFromSelection\(value\)\)/);
    assert.match(leadDetailSource, /priorityLabel\(draft\.priority\)/);
  });
});
