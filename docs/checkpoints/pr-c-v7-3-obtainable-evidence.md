# PR C V7.3 Obtainable Evidence and Targeted Second Pass Checkpoint

Date: 2026-07-30
Phase: Phase 4 TDD; targeted second-pass orchestrator GREEN complete, machine-rule activation not started
Approved proposal: CRM Daily Leads Liveness V7.3, PR C only

## Current Goal

The completed single-task objective was to implement only the minimal GREEN required by `onlineDailyV73SecondPassOrchestrator.test.mjs`, verify the focused contract and adjacent 24-test matrix, update this checkpoint, and stop. Machine-rule activation, workflow/sync behavior, PR B scheduling, live generation, PR D/E, full verification, and PR creation remain out of scope.

Implement the already-approved PR C slice: make the V7.3 Daily evidence model reflect evidence that can actually be obtained for unreleased projects, expose actionable near-miss evidence gaps, and run a targeted second evidence pass before applying the same admission decision again.

PR C may change the approved evidence model and its targeted evidence orchestration. It must preserve hard exclusions and quality boundaries, and it must never create Leads through quantity floors, backfill, threshold relaxation, or a separate weaker decision path.

## Overall Progress Checkpoint

- Approved PR C code baseline: `71d0c2b2ff678cc73ba6704e949c0eae8177711d`.
- Current remote `main`: `f85b014b1160b81fc668c2ec523690a83d8434e7`; the two commits after the approved code baseline only generated and recorded the 2026-07-30 Daily artifacts.
- Completed recovery slices: PR A `#105` added production-artifact replay and business-liveness observability; PR B `#106` added candidate research state, compatible evidence-snapshot reuse, and fair allocation of the unchanged Steam enrichment budget.
- PR B merge state: squash merge `71d0c2b2ff678cc73ba6704e949c0eae8177711d`; PR-head Build run `30487695885` completed successfully.
- Open PR queue: unrelated PR `#71` only.
- The pure V7.3 evidence module is GREEN.
- The candidate-audit/schema GREEN slice is complete: the audit builder recognizes V7.3, projects actionable near-miss fields, and emits schema version 3 with v3-only requirements.
- The targeted second-pass orchestrator RED contract is committed at `e10c2d3cce9fc0126a267d7b74617b10b6f71395`; GREEN code is complete at `12ce6f3b303cb0072dfa16fec2bf3ab65edb267f`.
- The V7.3 batch path is connected to the Daily generator only behind `sourcingRuleVersion === V73_OBTAINABLE_EVIDENCE_RULE_VERSION`; current code and machine rules remain V7.2, so the path is dormant and production behavior is unchanged.
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

- Added `automations/jobs/online_daily_v7_3_second_pass_orchestrator.mjs` in `bd1390b907d8b4e32088937d4f6fdfd6f3c48b8f`: deterministic one-to-three-action near-miss selection capped at 12, named public-evidence fetching, same V7.3 decision reuse, per-candidate provider failure isolation, normalized candidate writeback, PR B snapshot refresh without mutating lifecycle/scheduler fields, and run metrics.
- Updated `automations/jobs/online_daily_v4.mjs` in `12ce6f3b303cb0072dfa16fec2bf3ab65edb267f` so the batch runs before pool/artifact decisions only when the V7.3 rule version is active; V7.2 follows the same candidate arrays, state map, diagnostics, and output behavior as before.
- Ran syntax and the focused contract from the exact `12ce6f3b303cb0072dfa16fec2bf3ab65edb267f` GitHub API tarball with Node `v22.23.1`: 6/6 passed.
- Ran the pure V7.3, V7.3 candidate-audit/schema, existing candidate-audit, and PR B candidate-state/scheduler contracts from the same exact remote commit: 24/24 passed.
- The focused activation-boundary assertions confirmed both `RULE_VERSION` and `automations/rules/daily-report.json` remain on V7.2; no live provider or generator was invoked.
- Independently compared `aa690301e7121a1c3167d64658056815442c8ebc...12ce6f3b303cb0072dfa16fec2bf3ab65edb267f`; the GREEN phase changes only `online_daily_v4.mjs` and the new second-pass orchestrator module.
- Reconfirmed through the GitHub App/API that the branch is still identical to `735a2759dcafeb0c45e3739148834a653c6408b3`, remote `main` remains `f85b014b1160b81fc668c2ec523690a83d8434e7`, and open PR `#71` remains unrelated before beginning GREEN.
- Recovered the exact interrupted 425-line RED draft from the prior Codex session record, corrected one optional-access assertion so the expected missing call fails as an assertion instead of a `TypeError`, and confirmed the test parses before publishing.
- Added `automations/test/onlineDailyV73SecondPassOrchestrator.test.mjs` in `e10c2d3cce9fc0126a267d7b74617b10b6f71395`; no implementation file was added.
- Ran the focused RED from the exact `e10c2d3cce9fc0126a267d7b74617b10b6f71395` GitHub API tarball with Node `v22.23.1`: 0/6 passed for the expected missing business boundaries—batch orchestrator/provider exports, deterministic 12-candidate selection, PR B snapshot-preserving writeback, provider failure isolation, requested public-evidence materialization, and inactive-V7.3 guarded generator wiring.
- The focused RED had no syntax, module-resolution, fixture self-check, or unrelated runtime failure.
- Ran syntax plus the pure V7.3, V7.3 candidate-audit/schema, existing candidate-audit, and PR B candidate-state/scheduler contracts from the same exact remote commit: 24/24 passed.
- Independently compared `4d3a5e27cdcb70f66d46514303da2b684a4fcf19...e10c2d3cce9fc0126a267d7b74617b10b6f71395`; the phase diff adds only the RED contract test.
- Restarted the separate orchestrator phase after the prior remote stream interruption. Reconfirmed through the GitHub App/API that remote `main` remains `f85b014b1160b81fc668c2ec523690a83d8434e7`, this branch still contains only the completed PR C pure-module plus candidate-audit/schema slice, the interrupted orchestrator test was not written remotely, and open PR `#71` remains unrelated.
- Reconfirmed remote `main` at `f85b014b1160b81fc668c2ec523690a83d8434e7`, the PR C branch head, open PR queue, and this checkpoint solely through the GitHub App/API.
- Confirmed the two commits after the approved PR C code baseline only contain 2026-07-30 Daily artifacts, and the only open PR remains unrelated `#71`.
- Added the pure module `automations/jobs/online_daily_v7_3_obtainable_evidence.mjs` in `9d22ae074c3bd982b12e1e84fd0774a8592972fc`; focused and adjacent exact-tarball tests passed 14/14.
- Read the exact remote candidate-audit builder, schema v1/v2 contract, PR B candidate-state schema version, and existing candidate-audit test boundary needed for this phase.
- Added `automations/test/onlineDailyV73CandidateAuditContract.test.mjs` in commit `6e8f279fb7d69b8ae11b31e63eddaa985ed1a304` without modifying candidate-audit or schema implementation.
- The RED contract requires V7.3 near-miss fields to be projected into the candidate artifact, V7.3 artifacts to emit schema version 3 while retaining PR B scan metrics, typed schema definitions for both actionable fields, and v3-only conditional requirements so historical v1/v2 candidates remain compatible.
- Ran the focused test from the exact `6e8f279fb7d69b8ae11b31e63eddaa985ed1a304` GitHub API tarball under a one-time `/tmp` directory with Node `v22.23.1`.
- RED was confirmed through four expected business assertions: V7.3 lane remained `null`, artifact schema remained `2`, schema enum remained `[1, 2]`, and no v3 conditional candidate contract existed.
- The RED run had no module-resolution, dependency, fixture, or syntax failure.
- Reproduced the same focused RED from the exact `7d4a84d0cd3074bd5cdd78a1b22189bb5e15a78a` GitHub API tarball before implementation: 0/4 passed with the same four expected business failures.
- Updated `automations/jobs/online_daily_v4_candidate_audit.mjs` in `c805fbf170bbcc2d5292dd4a39edbf8f01b6471f` so Steam and media audit records use normalized V7.3 evidence, project `failed_gate_details` and `next_evidence_actions`, and select schema v3 without changing v1/v2 selection.
- Updated `schemas/sourcing_candidates.schema.json` in `c69a9ddf6ac743b78ef9f6c699d1234e4ab7b551` with schema version 3, typed actionable-field definitions, and a v3-only conditional candidate requirement; the v1/v2 base required list, PR B state fields, scan metrics, and evidence snapshot contract remain intact.
- Ran syntax, JSON parse, the focused GREEN contract, the pure V7.3 contract, the existing candidate-audit contract, and the PR B candidate-state/scheduler contract from the exact `c69a9ddf6ac743b78ef9f6c699d1234e4ab7b551` GitHub API tarball under a one-time `/tmp` directory with Node `v22.23.1`: 24/24 passed.
- Independently compared `7d4a84d0cd3074bd5cdd78a1b22189bb5e15a78a...c69a9ddf6ac743b78ef9f6c699d1234e4ab7b551`; this GREEN slice changes only the candidate-audit builder and sourcing-candidates schema.
- No machine rule, orchestrator, workflow, generator entrypoint, current-rule document, or production behavior was changed. No local CRM checkout/worktree was read or modified.

## Remaining

- In a separate next task, establish the RED contract for V7.3 machine-rule activation and fixed replay before changing the current rule source; do not combine activation, documentation, full verification, or PR creation into this completed orchestrator task.
- After an approved activation GREEN, update `docs/SOURCING_RULES_CURRENT.md` and the machine-readable rule trace together, then run the fixed July 15-29 replay and legacy weak-sample rejection regression.
- Run full `npm run verify:all`, independent branch diff validation, PR CI, merge, and read-only acceptance only in their later bounded phases.
- Do not change workflow/sync behavior or PR B scheduling, run a live generator, or enter PR D/E.
- Stop after PR C; do not enter PR D or PR E.

## Next Action

Stop at this verified dormant-orchestrator GREEN boundary and wait for an explicit continuation. On the next `继续`, reconfirm remote state and scope only the machine-rule activation RED contract; do not activate V7.3 in the same task.

## Git Status

Remote branch `codex/pr-c-v7-3-obtainable-evidence` was at dormant-orchestrator GREEN code head `12ce6f3b303cb0072dfa16fec2bf3ab65edb267f` immediately before this checkpoint-only GitHub API commit. All repository writes use GitHub App/API; verification uses exact one-time `/tmp` GitHub API tarballs outside every local CRM checkout/worktree.

## Rollout Status

Targeted second-pass orchestrator GREEN complete and dormant. The provider and generator wiring now exist, but no machine-rule activation, workflow, deployment, live provider call, or production behavior has changed. The branch now contains the pure V7.3 module, candidate-audit/schema GREEN, and dormant orchestrator GREEN; active production sourcing behavior remains the PR B V7.2 baseline at `71d0c2b2ff678cc73ba6704e949c0eae8177711d`; current remote `main` is `f85b014b1160b81fc668c2ec523690a83d8434e7` after the 2026-07-30 Daily artifact commits.
