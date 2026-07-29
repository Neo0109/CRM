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
- Read the exact remote implementation boundaries for candidate audit, Daily validation, receipts, workflows, package verification, and adjacent tests.
- Added the RED production-replay contract in commit `e472ca965a1e8cb77aa5570ecffac0cfc6a06608`.
- Confirmed RED fails because `online_daily_leads_liveness.mjs` does not exist yet.
- Implemented the pure analyzer and deterministic CLI, and added the fixed 2026-07-15 through 2026-07-29 replay to `verify:all`.
- Wired the same analyzer into morning/afternoon and watchdog receipts with `business_liveness_status`, `new_lead_count`, `consecutive_zero_days`, and `top_blocking_gates`.
- Kept delivery health and recovery independent: business liveness never changes V7.2 admission, sync status, watchdog `needs_run`, or workflow triggers.
- Focused remote-snapshot tests passed: 4 liveness tests and 6 verification-contract tests.
- Fixed production replay passed structurally and reported 15 consecutive zero-Lead days, rolling 7-day `0` nonzero days / `0` new Leads, and `unhealthy-business-liveness`.
- Replay gate distribution is visible; the top three are `independent_quality_proof` (3017), `steam_review_summary` (3017), and `official_gameplay` (2943).
- All non-git `verify:all` tasks passed from the exact GitHub API branch tarball. The tarball has no `.git`, so the final `git diff --check` task was delegated to Build CI through an explicit branch-diff step.
- Build run `30473216862` passed on implementation SHA `fa840b8432d0c97d1775179c1c37502b9b796b06`, including the real replay test.

## Remaining

- Commit this completed checkpoint.
- Create the PR, wait for PR CI including branch-diff validation, and fix only PR A regressions if any.
- Merge after CI.
- Verify merged `main`, production health, and production replay/business-liveness observability.

## Next Action

Create the PR from `codex/pr-a-daily-leads-liveness`, wait for PR CI, then merge and perform PR A production acceptance.

## Git Status

Remote branch `codex/pr-a-daily-leads-liveness` at `17fbffefc6ad3dd5b8179e41057daab41b999d9e`; exact branch tarballs were used for tests and no local CRM checkout was used or modified.
