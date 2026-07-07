import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { resolveLeadReviewTarget } from "../src/features/leads/leadReviewTarget.ts";

const baseLead = (patch = {}) => ({
  id: "lead-1",
  project: "Lunar Garden",
  steam_app_id: "123456",
  bucket: "未处理",
  review_status: "未处理",
  ...patch
});

describe("lead review target resolver", () => {
  it("selects assistant-imported leads by id, Steam AppID, or normalized project", () => {
    const leads = [
      baseLead({ id: "lead-a", project: "Lunar Garden", steam_app_id: "111111" }),
      baseLead({ id: "lead-b", project: "Cloud Runner", steam_app_id: "222222" })
    ];

    assert.equal(resolveLeadReviewTarget(leads, { leadId: "lead-b" }).lead?.id, "lead-b");
    assert.equal(resolveLeadReviewTarget(leads, { steamAppId: "111111" }).lead?.id, "lead-a");
    assert.equal(resolveLeadReviewTarget(leads, { project: " cloud runner " }).lead?.id, "lead-b");
  });

  it("falls back to a useful Leads Review query when the lead is not loaded yet", () => {
    const projectFallback = resolveLeadReviewTarget([], { project: "Lunar Garden" });
    const steamFallback = resolveLeadReviewTarget([], { steamAppId: "333333" });

    assert.equal(projectFallback.lead, null);
    assert.equal(projectFallback.query, "Lunar Garden");
    assert.equal(steamFallback.lead, null);
    assert.equal(steamFallback.query, "333333");
  });
});
