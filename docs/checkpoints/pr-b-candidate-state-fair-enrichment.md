# PR B Candidate State and Fair Enrichment Checkpoint

Date: 2026-07-30
Phase: Phase 4 implementation
Approved proposal: CRM Daily Leads Liveness V7.3, PR B only

## Current Goal

Restore Daily Steam candidate decision coverage by persisting candidate research state in dated artifacts, reusing valid 7-day evidence snapshots, and scheduling the unchanged `maxSteamDetails` budget fairly across new, never-enriched backlog, and retry/refresh candidates.

PR B changes enrichment allocation only. It must not change V7.2 admission, quality gates, formal Lead decisions, sync semantics, recovery semantics, or workflow triggers.

## Overall Progress Checkpoint

- Baseline remote `main`: `bde5908f1e618ff33d3b5b724b52d09b87464380`.
- Relevant completed work: PR A #105 production-artifact replay and business-liveness observability; V6.8 quality quarantine; V7.0 indie admission and candidate audit; V7.1 Steam review channel; V7.2 china_joint; sourcing learning; manual visual AI advisory.
- Open PR queue: unrelated PR #71 only.
- This implementation touches only Daily Steam candidate state reconstruction, evidence snapshot reuse, fair enrichment scheduling, candidate artifact/validator contracts, focused tests, verification wiring, and this checkpoint.
- Explicitly out of scope: V7.2 admission and quality gates, rule version/thresholds, `failed_gate_details`, `next_evidence_actions`, near-miss second-pass evidence, PR A liveness classification, PR C-E, AI, UI/API, Supabase, existing Leads, Radar/Steam Trends product behavior, CRM import/sync behavior, workflow triggers, quantity floors, backfill, and legacy P2 noise.

## Approval Context

### Concrete problem

The 2026-07-29 production replay showed all 90 enrichment requests succeeded, but 86 of 90 slots repeated candidates enriched the previous day. Another 136 repeated candidates received no budget on both days, including 125 still missing Steam details. The current static-sort-then-slice path has no cross-day research state, so successful repeats can monopolize a fixed budget while backlog candidates starve.

### Cost of inaction

Daily generation can remain technically healthy while most reachable candidates never receive enough evidence to reach an unchanged V7.2 decision. Repeated Steam and official-site requests waste the fixed budget, and operators cannot distinguish cache reuse, fresh success, retry, or deferred backlog.

### Why this slice comes first

PR A established deterministic production replay and business-liveness observability. The next smallest causal slice is budget fairness and evidence reuse. Evidence-model changes belong to PR C and are deliberately excluded.

### Engineering principle

Use TDD and pure deterministic modules. Rebuild state from the current artifact plus the previous 7 Asia/Shanghai calendar days; do not add a database or mutable global state. Store a versioned normalized evidence snapshot, reuse only compatible valid snapshots, and feed the same evidence into the existing V7.2 decision path. Keep scheduling work-conserving and stable.

### Architecture benefit

Candidate lifecycle, cache validity, and lane scheduling become independently testable. The Daily orchestrator returns to orchestration, repeated enrichment stops consuming network budget, backlog receives bounded access to the unchanged budget, and V7.2 parity remains protected by regression tests.

## Approved Contract

- Candidate state records `first_seen`, `last_seen`, `enrichment_status`, `enrichment_attempts`, `last_attempted_at`, `last_enriched_at`, `next_retry_date`, `scheduler_lane`, and `evidence_snapshot`.
- Reconstruct state from dated `data/sourcing_candidates/` artifacts over 7 Asia/Shanghai calendar days.
- Historical schema v1 artifacts remain valid input but cannot supply a reusable snapshot. New artifacts use schema v2.
- A successful normalized evidence snapshot is reusable for 7 Asia/Shanghai calendar days, including same-day reruns. Invalid, expired, corrupt, or contract-version-mismatched snapshots are ignored and recorded.
- Snapshot reuse does not consume `maxSteamDetails` and caches evidence, never a final admission decision.
- Default budget 90 uses deterministic work-conserving `4:3:2` lanes: 40 new, 30 never-successfully-enriched backlog, 20 retry or expired-refresh.
- New candidates keep existing review-window order. Backlog prefers longest-unattempted then earliest-seen. Retry/refresh prefers earliest-due then longest-unattempted. Existing static score and `dedupe_key` break ties.
- Same-day failures cannot be rescheduled before the next Asia/Shanghai calendar day.
- Keep `steam_candidates_enriched` as actual scheduled enrichment requests; separately report scheduled, reused, fresh success, failed, deferred, evaluated, backlog count, and per-lane counts.

## Completed

- Recovered the approved Phase 2 proposal and Phase 1 evidence without reopening PR A diagnosis.
- Confirmed remote `main`, the open PR queue, and absence of an existing PR B branch/checkpoint.
- Created remote branch `codex/pr-b-candidate-state-fair-enrichment` from the exact baseline SHA.
- Created this checkpoint before multi-file implementation.
- No local CRM checkout or worktree was read, modified, checked out, or committed.

## Remaining

- Read the exact remote implementation, schema, validator, and verification boundaries.
- Add the RED contracts for state reconstruction, 7-day snapshot reuse, 4:3:2 work-conserving scheduling, production-distribution replay, V7.2 parity, invalid snapshot handling, and v1/v2 schema compatibility.
- Confirm RED for missing implementation behavior.
- Implement the smallest candidate-state and scheduler modules plus narrow orchestration/artifact wiring.
- Run focused tests, Daily V4 tests, candidate validation, liveness replay, `verify:all`, and branch diff checks without running live generators or production writes.
- Update this checkpoint with commits and validation evidence.
- Stop before PR creation.

## Next Action

Read the exact files on this remote branch and commit the focused RED test contract before implementation.

## Git Status

Remote branch `codex/pr-b-candidate-state-fair-enrichment` is based on `bde5908f1e618ff33d3b5b724b52d09b87464380`. This file is the initial checkpoint commit; no local CRM checkout or worktree is used.
