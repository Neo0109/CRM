import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  runVisualAiManualAudit,
  validateVisualAiManualAuditArtifact
} from "../jobs/visual_ai_manual_audit.mjs";
import { createFakeVisualAiProvider } from "../jobs/visual_ai_fake_provider.mjs";

const generatedAt = "2026-07-17T10:30:00.000Z";

describe("visual AI manual audit", () => {
  it("uses only the fake provider in tests and produces advisory output with zero real requests", async () => {
    const calls = [];
    const provider = createFakeVisualAiProvider({
      onCall: (request) => calls.push(request),
      result: {
        visual_summary: "Readable combat loop and a distinct silhouette.",
        strengths: ["Strong silhouette"],
        risks: ["UI density needs human review"],
        questions_for_human: ["Is the trailer representative of normal play?"],
        confidence: "medium"
      }
    });

    const artifact = await runVisualAiManualAudit({
      request: auditRequest(),
      config: { provider: "fake" },
      providers: { fake: provider },
      now: () => generatedAt
    });

    assert.equal(calls.length, 1);
    assert.equal(Object.isFrozen(calls[0]), true);
    assert.equal(Object.isFrozen(calls[0].image_urls), true);
    assert.equal(artifact.status, "completed");
    assert.equal(artifact.provider, "fake");
    assert.equal(artifact.result.recommendation_impact, "none");
    assert.equal(artifact.guardrails.real_ai_requests, 0);
    assert.equal(artifact.guardrails.crm_import_calls, 0);
    assert.equal(artifact.guardrails.lead_mutations, 0);
    assert.equal(artifact.guardrails.priority_mutations, 0);
    assert.equal(artifact.guardrails.pool_mutations, 0);
    assert.deepEqual(validateVisualAiManualAuditArtifact(artifact), []);
  });

  it("safe-exits without a key and never reaches a real provider", async () => {
    let calls = 0;
    const unreachableFake = createFakeVisualAiProvider({ onCall: () => { calls += 1; } });
    const artifact = await runVisualAiManualAudit({
      request: auditRequest(),
      config: realConfig({ apiKey: "" }),
      providers: { openai: unreachableFake },
      now: () => generatedAt
    });

    assert.equal(calls, 0);
    assert.equal(artifact.status, "skipped");
    assert.equal(artifact.skip_reason, "missing_api_key");
    assert.equal(artifact.guardrails.real_ai_requests, 0);
    assert.deepEqual(validateVisualAiManualAuditArtifact(artifact), []);
  });

  it("requires separate approval, an explicit model, and positive budgets before real-provider eligibility", async () => {
    const cases = [
      [realConfig({ productionApproved: false }), "production_not_approved"],
      [realConfig({ model: "" }), "missing_model"],
      [realConfig({ maxRequests: 0 }), "missing_request_budget"],
      [realConfig({ maxImages: 0 }), "missing_image_budget"],
      [realConfig({ maxOutputTokens: 0 }), "missing_output_token_budget"]
    ];

    for (const [config, expectedReason] of cases) {
      let calls = 0;
      const unreachableFake = createFakeVisualAiProvider({ onCall: () => { calls += 1; } });
      const artifact = await runVisualAiManualAudit({
        request: auditRequest(),
        config,
        providers: { openai: unreachableFake },
        now: () => generatedAt
      });

      assert.equal(calls, 0, expectedReason);
      assert.equal(artifact.status, "skipped", expectedReason);
      assert.equal(artifact.skip_reason, expectedReason);
      assert.equal(artifact.guardrails.real_ai_requests, 0);
    }
  });

  it("defaults to disabled and exits before validating or sending visual inputs", async () => {
    const artifact = await runVisualAiManualAudit({
      request: {},
      config: { provider: "disabled" },
      providers: {},
      now: () => generatedAt
    });

    assert.equal(artifact.status, "skipped");
    assert.equal(artifact.provider, "disabled");
    assert.equal(artifact.skip_reason, "provider_disabled");
    assert.equal(artifact.subject.image_count, 0);
    assert.equal(artifact.guardrails.real_ai_requests, 0);
  });

  it("cannot mutate Lead, priority, decision, or pool state and strips action-like provider fields", async () => {
    const request = auditRequest();
    const before = structuredClone(request);
    const provider = createFakeVisualAiProvider({
      result: {
        visual_summary: "Advisory only.",
        strengths: [],
        risks: [],
        questions_for_human: [],
        confidence: "low",
        priority: "P3",
        bucket: "淘汰池",
        decision: "excluded",
        withdraw_lead: true
      }
    });

    const artifact = await runVisualAiManualAudit({
      request,
      config: { provider: "fake" },
      providers: { fake: provider },
      now: () => generatedAt
    });

    assert.deepEqual(request, before);
    assert.deepEqual(request.lead_snapshot, {
      id: "lead-9",
      priority: "P1",
      bucket: "推进池",
      decision: "formal"
    });
    assert.equal("priority" in artifact.result, false);
    assert.equal("bucket" in artifact.result, false);
    assert.equal("decision" in artifact.result, false);
    assert.equal("withdraw_lead" in artifact.result, false);
    assert.doesNotMatch(JSON.stringify(artifact.result), /"priority":|"bucket":|"decision":|withdraw_lead/);
    assert.equal(artifact.result.recommendation_impact, "none");
    assert.equal(artifact.guardrails.lead_mutations, 0);
    assert.equal(artifact.guardrails.priority_mutations, 0);
    assert.equal(artifact.guardrails.pool_mutations, 0);
  });

  it("rejects artifacts that claim CRM calls, real requests, or recommendation mutations", async () => {
    const artifact = await runVisualAiManualAudit({
      request: auditRequest(),
      config: { provider: "fake" },
      providers: { fake: createFakeVisualAiProvider() },
      now: () => generatedAt
    });

    for (const field of ["crm_import_calls", "lead_mutations", "priority_mutations", "pool_mutations"]) {
      const corrupt = structuredClone(artifact);
      corrupt.guardrails[field] = 1;
      assert.match(validateVisualAiManualAuditArtifact(corrupt).join("\n"), new RegExp(`${field} must be 0`));
    }
  });
});

function auditRequest() {
  return {
    project: "Manual Audit Game",
    dedupe_key: "steam:9009",
    image_urls: [
      "https://cdn.example.com/9009-capsule.jpg",
      "https://cdn.example.com/9009-gameplay.jpg"
    ],
    context: "Manual human-requested visual review.",
    lead_snapshot: {
      id: "lead-9",
      priority: "P1",
      bucket: "推进池",
      decision: "formal"
    }
  };
}

function realConfig(overrides = {}) {
  return {
    provider: "openai",
    productionApproved: true,
    apiKey: "test-only-placeholder",
    model: "future-explicit-model",
    maxRequests: 1,
    maxImages: 2,
    maxOutputTokens: 800,
    ...overrides
  };
}
