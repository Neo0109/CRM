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
- Read the exact remote orchestrator, Steam enrichment, candidate audit, schema, validator, Build, replay, and focused test boundaries.
- Added the RED contract in `automations/test/onlineDailyV4CandidateStateScheduler.test.mjs` and wired it into Build; branch head is `df5eeb98c586436e6c56709c6fc2acfc36b90908`.
- Confirmed RED from the exact GitHub API branch tarball: the focused test fails with `ERR_MODULE_NOT_FOUND` for `online_daily_v4_candidate_state.mjs`, before any implementation exists.
- Implemented pure candidate state/evidence snapshot logic in `9ea66587af51cf6fbb0a897273b6a7cfda4fdbe3` and deterministic 4:3:2 scheduling in `c856f3b7c0c8ab1d3a5187b75b1553667df9908b`.
- Focused core run on `929185824673ed352a2ea80039c282e00138f133` passed 7 of 8 contracts: valid TTL reuse, invalid snapshot recording, v1 no-reuse, same-day cooldown, exact 40/30/20 scheduling, work conservation, 260/260 three-run coverage, 86 duplicate-success reuse, and V7.2 audit parity. The sole expected failure is the still-v1-only schema/validator.
- Added backward-compatible schema v2 in `5eea3629c4401a22618f81ab93ae8653d2ecf8e9` and v2 integrity validation in `b2775e4e2479b37f56ad4843ddd6791de9892e06` while preserving legacy v1 validation.
- Exact API-tarball focused run on `b2775e4e2479b37f56ad4843ddd6791de9892e06` passed all 8 contracts.
- Added a dedicated orchestrator RED contract in `36fd40a3bbb732d92286ae7251c8e392589d0967`; it failed only because the old static slice still existed.
- Wired v2 audit state in `bcb6b9aa80f090986440fbc9810275f02201dcb6` and the Daily history/scheduler/reuse/outcome path in `c257bede0cff01703f433f0721a7202f5fe35753`.
- Exact API-tarball focused run on `c257bede0cff01703f433f0721a7202f5fe35753` passed all 9 contracts, including the orchestrator wiring contract.

## Remaining

- Run focused and existing Daily tests, candidate validation, liveness replay, `verify:all`, and branch diff checks; fix only PR B regressions.
- Implement the smallest candidate-state and scheduler modules plus narrow orchestration/artifact wiring.
- Run focused tests, Daily V4 tests, candidate validation, liveness replay, `verify:all`, and branch diff checks without running live generators or production writes.
- Update this checkpoint with commits and validation evidence.
- Stop before PR creation.

## Next Action

Run the complete approved validation matrix from the exact remote branch snapshot and inspect Build for the final branch head.

## Git Status

Remote branch `codex/pr-b-candidate-state-fair-enrichment` is at integration-green head `c257bede0cff01703f433f0721a7202f5fe35753` before this checkpoint update. All repository writes used GitHub App/API; focused runs used exact GitHub API tarballs outside every local CRM checkout/worktree.
