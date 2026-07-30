# PR C V7.3 Obtainable Evidence and Targeted Second Pass Checkpoint

Date: 2026-07-30
Phase: Phase 4 entry boundary; checkpoint established, implementation not started
Approved proposal: CRM Daily Leads Liveness V7.3, PR C only

## Current Goal

Implement the already-approved PR C slice: make the V7.3 Daily evidence model reflect evidence that can actually be obtained for unreleased projects, expose actionable near-miss evidence gaps, and run a targeted second evidence pass before applying the same admission decision again.

PR C may change the approved evidence model and its targeted evidence orchestration. It must preserve hard exclusions and quality boundaries, and it must never create Leads through quantity floors, backfill, threshold relaxation, or a separate weaker decision path.

## Overall Progress Checkpoint

- Baseline remote `main`: `71d0c2b2ff678cc73ba6704e949c0eae8177711d`.
- Completed recovery slices: PR A `#105` added production-artifact replay and business-liveness observability; PR B `#106` added candidate research state, compatible evidence-snapshot reuse, and fair allocation of the unchanged Steam enrichment budget.
- PR B merge state: squash merge `71d0c2b2ff678cc73ba6704e949c0eae8177711d`; remote `main` is identical to that commit. PR-head Build run `30487695885` completed successfully.
- Open PR queue: unrelated PR `#71` only.
- No prior PR C branch, PR, commit, or checkpoint was found in current GitHub state.
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

- Reconfirmed the latest remote `main` and PR `#106` solely through the GitHub App/API.
- Confirmed `main` is identical to PR B squash merge `71d0c2b2ff678cc73ba6704e949c0eae8177711d`.
- Confirmed PR `#106` is merged and its PR-head Build run succeeded.
- Confirmed the only open PR is unrelated `#71`.
- Recovered the approved PR C boundary from the current PR A/PR B checkpoints and the approved staged recovery handoff without reopening PR A or PR B design.
- Confirmed no existing PR C branch, PR, commit, or checkpoint in current GitHub state.
- Created remote branch `codex/pr-c-v7-3-obtainable-evidence` from the exact `main` baseline.
- Created this checkpoint before reading or changing PR C business code.
- No local CRM checkout/worktree was read or modified. No live generator ran and no production data was written.

## Remaining

- In the next task, reconfirm remote `main`, this branch head, open PRs, and this checkpoint.
- Read only the exact remote PR C machine-rule, decision, candidate-artifact, targeted-enrichment, replay, validator, and focused-test boundaries.
- Add the first RED contract for the approved evidence alternatives, actionable near-miss classification, same-decision second pass, and hard-exclusion parity.
- Implement the smallest GREEN slices, updating this checkpoint after each phase.
- Validate from exact one-time GitHub API tarballs under `/tmp`, including focused contracts, schema/validator tests, replay, `npm run verify:all`, and an independent branch diff check.
- Create one PR C pull request, wait for required CI, merge only after approval/checks, and perform read-only acceptance.
- Stop after PR C; do not enter PR D or PR E.

## Next Action

Resume from this checkpoint in a new task. Reconfirm the remote baseline and checkpoint, then inspect only the exact PR C implementation boundaries and add the first RED contract. Do not re-plan the approved product direction and do not begin PR D.

## Git Status

Remote branch `codex/pr-c-v7-3-obtainable-evidence` was created from exact remote `main` SHA `71d0c2b2ff678cc73ba6704e949c0eae8177711d` immediately before this checkpoint-only GitHub API commit. All repository writes use GitHub App/API; any later read-only test checkout must be a one-time `/tmp` tarball outside every local CRM checkout/worktree.

## Rollout Status

Checkpoint only. No PR C business code, machine rule, generated artifact, workflow, deployment, or production behavior has changed. Current production sourcing behavior remains the verified behavior of remote `main` at `71d0c2b2ff678cc73ba6704e949c0eae8177711d`.
