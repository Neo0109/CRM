# PR A Daily Leads Liveness Replay Checkpoint

Date: 2026-07-30
Phase: Phase 4 implementation
Approved proposal: CRM Daily Leads Liveness V7.3, PR A only

## Current Goal

Add production-artifact replay and business-liveness observability for Daily sourcing without changing V7.2 admission, Lead contents, sync behavior, or workflow triggers.

## Overall Progress Checkpoint

- Baseline remote `main`: `55d1b92b18ea7d21e3cee3bd773d4424f1c32ac1`.
- Relevant completed modules: V6.8 quality quarantine, V7.0 indie admission, candidate audit, V7.1 Steam review channel, V7.2 china_joint, sourcing learning, and manual visual AI advisory.
- Open PR queue: unrelated PR `#71` only.
- This PR touches only liveness analysis/replay, focused tests, validation/diagnostic wiring where required, and this checkpoint.
- Explicitly out of scope: admission decisions, rule thresholds, source queries, enrichment ordering, report/Lead payloads, CRM API, Supabase, UI, existing Leads, Radar, Steam Trends, workflow triggers, workflow dispatch, and production writes.

## Approval Context

### Concrete problem

The Daily workflow can complete generation, validation, and sync for many consecutive days while producing zero new Leads. Existing tests prove deterministic gate behavior with synthetic fixtures but do not replay real production candidate artifacts or classify sustained zero output as a business-liveness condition.

### Cost of inaction

CI can remain green while the core product outcome remains absent. Operators cannot distinguish a legitimate single zero day from an unreachable rule path, enrichment starvation, or a sustained product incident.

### Why this slice comes first

Replay and observability are required before changing evidence gates or enrichment behavior. This slice creates a measurable baseline and regression harness while preserving every current production decision.

### Engineering principle

Use a pure, deterministic analyzer over already-generated candidate/report artifacts. Start RED with fixed replay fixtures and real dated artifacts, then add the smallest implementation. Do not call live sources, generate a real report, sync CRM, or mutate production.

### Architecture benefit

Business liveness becomes independently observable from technical delivery health. Later PRs can improve enrichment or admission against a stable replay contract without coupling those changes to sync, UI, or production data.

## Completed

- Confirmed remote baseline, open PRs, empty Actions queue, and production health.
- Created branch `codex/pr-a-daily-leads-liveness` from exact baseline SHA.
- Created this checkpoint before multi-file implementation.

## Remaining

- Inspect current volume diagnostics, validator, receipt wiring, package scripts, and adjacent tests from the branch baseline.
- Define the narrow RED contract for replay and liveness status.
- Implement the pure analyzer and CLI/repository verification wiring without changing admission.
- Run focused tests and repository checks.
- Update this checkpoint with evidence.
- Create a draft PR and wait for CI.

## Next Action

Read the exact remote implementation boundaries and add the RED replay/liveness contract.

## Git Status

Remote branch `codex/pr-a-daily-leads-liveness` at the baseline; local CRM checkout is not used or modified.
