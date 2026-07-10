import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  availableMonthlyVisionLeads,
  currentShanghaiMonth,
  monthlyVisionItemFromLead,
  monthlyVisionValidationErrors
} from "../src/monthlyVision.ts";

function lead(overrides = {}) {
  return {
    id: "lead-a",
    project: "Project A",
    team: "Studio A",
    bucket: "跟进中",
    contact_methods: [{ type: "Email", value: "a@example.com", note: "BD" }],
    ...overrides
  };
}

describe("monthly vision frontend helpers", () => {
  it("uses Shanghai month at the UTC boundary", () => {
    assert.equal(currentShanghaiMonth(new Date("2026-07-31T16:30:00.000Z")), "2026-08");
  });

  it("maps a CRM lead into the three-column monthly snapshot", () => {
    assert.deepEqual(monthlyVisionItemFromLead(lead()), {
      lead_id: "lead-a",
      project: "Project A",
      developer: "Studio A",
      contacts: "Email: a@example.com (BD)"
    });
  });

  it("offers non-dropped leads not already selected", () => {
    const candidates = availableMonthlyVisionLeads([
      lead(),
      lead({ id: "lead-b", project: "Project B", bucket: "观察池" }),
      lead({ id: "lead-c", project: "Project C", bucket: "淘汰池" })
    ], [{ lead_id: "lead-a", project: "Project A", developer: "Studio A", contacts: "a@example.com" }]);

    assert.deepEqual(candidates.map((item) => item.id), ["lead-b"]);
  });

  it("reports incomplete and duplicate rows before finalization", () => {
    assert.deepEqual(monthlyVisionValidationErrors([
      { lead_id: "lead-a", project: "Project A", developer: "", contacts: "a@example.com" },
      { lead_id: "lead-a", project: "Project A copy", developer: "Studio", contacts: "" }
    ]), [
      "Project A：缺少研发团队",
      "Project A copy：缺少联系方式",
      "存在重复项目：lead-a"
    ]);
  });
});
