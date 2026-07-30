# PR C V7.3 Obtainable Evidence and Targeted Second Pass Checkpoint

Date: 2026-07-30
Phase: Phase 4 TDD; RED contract established, implementation not started
Approved proposal: CRM Daily Leads Liveness V7.3, PR C only

## Current Goal

Implement the already-approved PR C slice: make the V7.3 Daily evidence model reflect evidence that can actually be obtained for unreleased projects, expose actionable near-miss evidence gaps, and run a targeted second evidence pass before applying the same admission decision again.

PR C may change the approved evidence model and its targeted evidence orchestration. It must preserve hard exclusions and quality boundaries, and it must never create Leads through quantity floors, backfill, threshold relaxation, or a separate weaker decision path.

## Overall Progress Checkpoint

- Baseline remote `main`: `71d0c2b2ff678cc73ba6704e949c0eae8177711d`.
- Completed recovery slices: PR A `#105` added production-artifact replay and business-liveness observability; PR B `#106` added candidate research state, compatible evidence-snapshot reuse, and fair allocation of the unchanged Steam enrichment budget.
- PR B merge state: squash merge `71d0c2b2ff678cc73ba6704e949c0eae8177711d`; remote `main` is identical to that commit. PR-head Build run `30487695885` completed successfully.
- Open PR queue: unrelated PR `#71` only.
- No prior PR C branch, PR, commit, or checkpoint was found before this branch was created.
- The first PR C RED contract is now committed; no PR C implementation exists yet.
- This branch is for PR C only.
- Explicitly out of scope: reopening PR A replay/liveness work; rewriting PR B candidate state, snapshot TTL, or 4:3:2 scheduling; PR D AI editing or paid-provider work; PR E seven-day observation/calibration; UI/API, Supabase, existing Leads, CRM import/sync/recovery semantics, Radar, Steam Trends, Steam review workflow, workflow triggers, production data, quantity floors, review backfill, and legacy P2 cleanup.

## Approved PR C Scope

This section records the existing approved recovery direction; it is not a new proposal.

- Preserve the hard identity, deduplication, release-window, Early Access, publisher-role, and occupied-China-partner exclusions.
- Replace production-unobtainable evidence conjunctions with the approved V7.3 obtainable-evidence model. Official Demo/Playtest and official gameplay belong to an obtainable evidence family instead of requiring every member simultaneously.
- Evaluate independent quality through the approved multi-source public-evidence model rather than making one mature Steam-review threshold the only reachable proof for an unreleased project.
- Treat explicit China-cooperation demand as stronger positive evidence instead of an otherwise unreachable wording requirement, while retaining the China-partner occupancy exclusion and requiring a concrete China/Bilibili value thesis.
- Emit explicit `failed_gate_details` and `next_evidence_actions` so a near-miss can be distinguished from a hard exclusion.
- Run a targeted second pass only for candidates whose first decision identifies specific obtainable missing evidence. Fetch only the named missing evidence, merge normalized evidence, and call the same decision function again.
- Never let second-pass eligibility, business-liveness state, or daily Lead count bypass a hard exclusion, lower a quality threshold, create a quota floor, or cache a final admission decision.
- Keep PR B state reconstruction, compatible evidence reuse, retry cooldown, and fair scheduler semantics intact; PR C consumes those contracts rather than redesigning them.

## Approval Context

### Concrete problem

PR A's fixed production replay made the output failure measurable: the July 15-29 corpus produced 15 consecutive zero-Lead days even though generation and delivery could remain technically healthy. Its largest recorded blockers were `independent_quality_proof` (3017), `steam_review_summary` (3017), and `official_gameplay` (2943). PR B prevents repeated candidates from monopolizing enrichment, but it deliberately does not change the evidence model or perform a targeted follow-up for near-misses.

### Cost of inaction

The pipeline can scan broadly, allocate enrichment fairly, validate artifacts, and sync successfully while the formal admission path remains practically unreachable for the unreleased-project pool. Operators still cannot tell which missing evidence is obtainable, and the system repeats broad evaluation instead of closing a specific evidence gap.

### Why this slice is next

PR A established deterministic replay and liveness diagnosis. PR B established candidate continuity, reusable normalized evidence, and fair budget access. PR C is the next approved causal slice: improve evidence reachability and near-miss follow-up without repeating either completed module or introducing PR D cost and PR E calibration work.

### Engineering principle

Use TDD with fixed fixtures and the existing production replay. Keep evidence normalization, missing-evidence classification, admission decision, and second-pass orchestration explicit and independently testable. A second pass enriches evidence only; the existing decision boundary remains the sole authority. Separate pure logic from network orchestration and pass state explicitly rather than adding hidden globals.

### Architecture benefit

The Daily orchestrator can request a narrow evidence action without owning admission logic. Rule changes remain traceable from the human-readable current-rules entry to the machine rule and focused contracts. Blast radius stays within the evidence/decision boundary, while future source additions can satisfy a named evidence action without rewriting candidate scheduling, sync, or product UI.

## Acceptance Invariants

- Hard-excluded fixtures remain excluded before and after a second pass.
- A candidate can pass only when the same V7.3 decision function sees a complete approved evidence set.
- Demo/Playtest and official-gameplay alternatives, independent-source counting, and China-demand evidence are represented explicitly in machine rules and deterministic tests.
- `failed_gate_details` and `next_evidence_actions` are stable, validated artifact fields; hard exclusions never advertise a second-pass route.
- Second-pass orchestration is deterministic, bounded to named missing public evidence, and cannot invoke PR D AI or paid editing.
- Zero-Leads or degraded business liveness can trigger diagnosis, never relaxed admission or filler Leads.
- The fixed July 15-29 replay and legacy weak-sample rejection remain regression gates; liveness improvement cannot be purchased by admitting the previously rejected low-quality fixtures.
- `docs/SOURCING_RULES_CURRENT.md`, the actual machine rule source, candidate artifact contract, generator behavior, and tests remain traceable. V7.3 must not be marked current until implementation and verification are complete.
- No live generator, workflow dispatch, production write, or production-data mutation is used for PR verification.

## Completed

- Reconfirmed the latest remote `main`, the PR C branch head, open PR queue, and this checkpoint solely through the GitHub App/API.
- Confirmed `main` remains identical to PR B squash merge `71d0c2b2ff678cc73ba6704e949c0eae8177711d` and the only open PR remains unrelated `#71`.
- Read the exact remote V7 indie admission, V7.2 regular selector, candidate audit, candidate schema, existing focused tests, `verify:all`, and Build boundaries required for the first PR C contract.
- Confirmed the current V7 path requires Demo/Playtest, official gameplay, independent quality proof, and overseas China-demand wording as separate gates; candidate audit currently has `missing_evidence` but not `failed_gate_details` or `next_evidence_actions`.
- Added `automations/test/onlineDailyV73ObtainableEvidence.test.mjs` in commit `9882fcfe555e877b05cf34f360bb9693d99fd205`.
- The RED contract fixes the public pure-logic boundary for Demo-or-gameplay evidence, independent-source counting, actionable near-miss fields, hard-exclusion parity, and targeted evidence followed by the exact same evaluator.
- Ran the focused test from the exact `9882fcfe555e877b05cf34f360bb9693d99fd205` GitHub API tarball under a one-time `/tmp` directory with Node `v22.23.1`.
- RED was confirmed: the test failed only with `ERR_MODULE_NOT_FOUND` for `automations/jobs/online_daily_v7_3_obtainable_evidence.mjs`; no implementation file exists yet.
- No existing business code, machine rule, schema, workflow, generator, or production behavior was changed. No local CRM checkout/worktree was read or modified.

## Remaining

- In the next task, reconfirm remote `main`, this branch head, open PRs, and this checkpoint.
- Implement the smallest pure `online_daily_v7_3_obtainable_evidence.mjs` GREEN slice required by the focused contract; do not wire candidate artifacts or the Daily orchestrator in the same phase.
- Re-run the exact focused test from a one-time GitHub API tarball and update this checkpoint.
- In later bounded phases, add candidate-audit/schema contracts, orchestrator RED/GREEN wiring, current-rule documentation, replay/legacy-weak-sample regression coverage, and full verification.
- Validate from exact one-time GitHub API tarballs under `/tmp`, including focused contracts, schema/validator tests, replay, `npm run verify:all`, and an independent branch diff check.
- Create one PR C pull request, wait for required CI, merge only after approval/checks, and perform read-only acceptance.
- Stop after PR C; do not enter PR D or PR E.

## Next Action

Resume from this checkpoint in a new task. Reconfirm the remote baseline and checkpoint, then implement only the pure V7.3 obtainable-evidence module required to turn `onlineDailyV73ObtainableEvidence.test.mjs` GREEN. Do not wire artifacts, the orchestrator, PR D, or PR E in that task.

## Git Status

Remote branch `codex/pr-c-v7-3-obtainable-evidence` was at RED contract commit `9882fcfe555e877b05cf34f360bb9693d99fd205` immediately before this checkpoint-only GitHub API commit. All repository writes use GitHub App/API; read-only tests use exact one-time `/tmp` GitHub API tarballs outside every local CRM checkout/worktree.

## Rollout Status

Checkpoint plus RED contract only. No PR C business implementation, machine rule, generated artifact, workflow, deployment, or production behavior has changed. Current production sourcing behavior remains the verified behavior of remote `main` at `71d0c2b2ff678cc73ba6704e949c0eae8177711d`.
