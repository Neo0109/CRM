# PR C V7.3 Obtainable Evidence and Targeted Second Pass Checkpoint

Date: 2026-07-30
Phase: Phase 4 TDD; minimal machine-rule activation GREEN complete, full verification not started
Approved proposal: CRM Daily Leads Liveness V7.3, PR C only

## Current Goal

The completed single-task objective was to implement only the minimal V7.3 activation GREEN required by the existing activation/replay RED contract, verify it from the exact remote commit, update this checkpoint, and stop. Full `verify:all`, broad contract migration, independent full-branch diff validation, PR creation, merge, deployment, live generation, workflow/sync behavior, PR B scheduling changes, and PR D/E remain out of scope.

Implement the already-approved PR C slice: make the V7.3 Daily evidence model reflect evidence that can actually be obtained for unreleased projects, expose actionable near-miss evidence gaps, and run a targeted second evidence pass before applying the same admission decision again.

PR C may change the approved evidence model and its targeted evidence orchestration. It must preserve hard exclusions and quality boundaries, and it must never create Leads through quantity floors, backfill, threshold relaxation, or a separate weaker decision path.

## Overall Progress Checkpoint

- Approved PR C code baseline: `71d0c2b2ff678cc73ba6704e949c0eae8177711d`.
- Current remote `main`: `166afdd759f5d3a4a6fff005e9293a906bda44d3`; the four commits after the approved code baseline only generated and recorded 2026-07-30 Daily artifacts.
- Completed recovery slices: PR A `#105` added production-artifact replay and business-liveness observability; PR B `#106` added candidate research state, compatible evidence-snapshot reuse, and fair allocation of the unchanged Steam enrichment budget.
- PR B merge state: squash merge `71d0c2b2ff678cc73ba6704e949c0eae8177711d`; PR-head Build run `30487695885` completed successfully.
- Open PR queue: unrelated PR `#71` only.
- The pure V7.3 evidence module is GREEN.
- The candidate-audit/schema GREEN slice is complete: the audit builder recognizes V7.3, projects actionable near-miss fields, and emits schema version 3 with v3-only requirements.
- The targeted second-pass orchestrator RED contract is committed at `e10c2d3cce9fc0126a267d7b74617b10b6f71395`; GREEN code is complete at `12ce6f3b303cb0072dfa16fec2bf3ab65edb267f`.
- The machine-rule activation and fixed-replay RED contract is committed at `3f0df5185586c96d5c61b0a197a5f1e4e77c829b`.
- Minimal activation GREEN is complete at exact remote code head `182cfd0e60e0b0e1094a50178297ad489a82dc31`: runtime, machine rule, current-doc trace, rule-versioned pool decisions, Lead-count health, and reader-facing Daily output now agree on V7.3.
- The V7.3 batch path remains guarded by `sourcingRuleVersion === V73_OBTAINABLE_EVIDENCE_RULE_VERSION`; because that version is now active on this branch, the targeted second pass runs before the same rule-versioned pool and candidate-artifact decisions. Production `main` remains unchanged and still runs the merged PR B V7.2 baseline.
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

- Reconfirmed before writing that remote `main` remained `166afdd759f5d3a4a6fff005e9293a906bda44d3`, the PR C branch was exactly `aa926698833fd8da25c09fa6a4fef74dcda455cc`, and the only open PR remained unrelated `#71`.
- Reproduced the activation contract from the exact `aa926698833fd8da25c09fa6a4fef74dcda455cc` GitHub API tarball with Node `v22.23.1`: the same six intended activation assertions were RED and the fixed July 15-29 replay plus seven historical weak-sample guardrails remained GREEN.
- Added `docs/SOURCING_RULES_V7_3.md` and aligned `docs/SOURCING_RULES_CURRENT.md`, `automations/rules/daily-report.json`, and the runtime rule version to `sourcing-rules-v7.3-obtainable-evidence`.
- Updated the machine rule with the exact nine-gate obtainable-evidence model, `any_of` playable/gameplay family, two-independent-source quality minimum, optional positive China-demand signal, bounded one-to-three-action second pass capped at 12, same-decision requirement, and explicit no-bypass/no-backfill guardrails.
- Made `buildPools` explicitly rule-versioned. V7.3 evaluates the obtainable-evidence `indie_prelaunch` lane and the unchanged `china_joint` lane through the existing selection/dedupe boundary, while legacy callers that omit `ruleVersion` retain the V7.2 behavior.
- Passed the active rule version through the generator pool and Daily-report boundaries; V7.3 formal Leads and reader-facing Daily text no longer carry stale V7.2 provenance, while Radar and Steam Trends remain untouched as required by this phase boundary.
- Kept V7.3 outside Lead-count health and preserved `formal_lead_minimum=null`, `formal_lead_maximum=null`, `watch_pool_enabled=false`, and `drop_pool_enabled=false`.
- Updated the existing second-pass orchestrator contract from its completed pre-activation assertion to the active V7.3 boundary. Avoided an import-order-dependent circular initialization by keeping the runtime rule version in the rules module rather than importing the evidence evaluator into the rules loader.
- Wrote the eight activation-slice files only through the GitHub App/API. The exact activation slice `aa926698833fd8da25c09fa6a4fef74dcda455cc...182cfd0e60e0b0e1094a50178297ad489a82dc31` changes four job modules, one machine-rule JSON file, one existing test, one current-rule document, and one new canonical V7.3 document.
- Downloaded the exact remote `182cfd0e60e0b0e1094a50178297ad489a82dc31` GitHub API tarball and ran syntax plus JSON parsing, the focused activation/replay contract, the adjacent pure V7.3/candidate-audit/PR B matrix, and the second-pass orchestrator contract with Node `v22.23.1`: 8/8, 24/24, and 6/6 passed.
- No local CRM checkout/worktree was read or modified. No live generator, provider call, workflow dispatch, sync, production write, PR, merge, deployment, PR B scheduler change, or PR D/E work was performed.
- Added `automations/test/onlineDailyV73ActivationReplayContract.test.mjs` in `3f0df5185586c96d5c61b0a197a5f1e4e77c829b`; no runtime, machine rule, current-rule document, workflow, or production artifact was changed.
- Ran syntax and the focused contract from the exact `3f0df5185586c96d5c61b0a197a5f1e4e77c829b` GitHub API tarball with Node `v22.23.1`: 2/8 guardrails passed and 6/8 assertions failed at the intended business boundaries.
- The six RED boundaries are: active runtime/machine/doc trace remains V7.2; machine required gates still encode the V7.2 conjunction; no bounded second-pass machine policy exists; `buildPools` ignores explicit V7.3 and admits only the retained `china_joint` fixture; V7.3 is incorrectly treated as Lead-count health enabled; and reader-facing Daily text still claims V7.2.
- The two GREEN guardrails in the same focused contract preserve the exact July 15-29 historical replay baseline and keep all seven historical weak samples out under the V7.3 decision.
- Ran the pure V7.3, V7.3 candidate-audit/schema, existing candidate-audit, and PR B candidate-state/scheduler contracts from the same exact remote commit: 24/24 passed; the existing targeted second-pass orchestrator contract also passed 6/6.
- Independently compared `9b3a4d5561c6bc0b86c2d25cde22c0fa2f292e6b...3f0df5185586c96d5c61b0a197a5f1e4e77c829b`; the phase diff adds only the 349-line RED contract test.
- Reconfirmed through the GitHub App/API that the only open PR remains unrelated `#71`; remote `main` advanced from `f85b014b1160b81fc668c2ec523690a83d8434e7` to `166afdd759f5d3a4a6fff005e9293a906bda44d3` through two additional 2026-07-30 morning artifact commits only.
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

- In a separate next task, run full `npm run verify:all` from the exact remote activation-GREEN commit and record the complete verification result. Broader historical activation/rules tests were deliberately not executed or rewritten in this minimal phase; any stale V7.2-active assertion must be treated as an explicit verification finding.
- Perform independent full-branch diff validation only after the full verification result is known.
- Update or add broader contracts only in a separately bounded, evidence-driven follow-up if full verification proves they still encode the superseded active V7.2 state; do not weaken V7.3 business guardrails to satisfy stale tests.
- Create a PR, run PR CI, merge, deploy, and perform read-only acceptance only in their later approved phases.
- Do not change workflow/sync behavior or PR B scheduling, run a live generator, or enter PR D/E.
- Stop after PR C; do not enter PR D or PR E.

## Next Action

Stop at this verified activation GREEN boundary and wait for an explicit continuation. On the next `继续`, reconfirm remote state and scope only full `npm run verify:all` plus evidence capture; do not combine test fixes, independent full-branch diff validation, PR creation, merge, live generation, deployment, or PR D/E.

## Git Status

Remote branch `codex/pr-c-v7-3-obtainable-evidence` was at exact activation GREEN code head `182cfd0e60e0b0e1094a50178297ad489a82dc31` immediately before this checkpoint-only GitHub API commit. Remote `main` remained `166afdd759f5d3a4a6fff005e9293a906bda44d3`; the only open PR remained unrelated `#71`. All repository writes use GitHub App/API; verification uses exact one-time `/tmp` GitHub API tarballs outside every local CRM checkout/worktree.

## Rollout Status

Minimal V7.3 activation GREEN is complete and exact-remote focused verification is GREEN. The branch now activates the obtainable-evidence rule, bounded second pass, rule-versioned pool selection with retained `china_joint`, candidate schema v3, V7.3 Daily provenance, and zero-Lead health separation while preserving the fixed historical replay, seven weak-sample exclusions, PR B state/scheduler contracts, and all explicit no-backfill/no-bypass boundaries. Full verification, broader contract migration if proven necessary, independent full-branch diff validation, PR/CI, merge, deployment, and production acceptance have not started. Production `main` remains the PR B V7.2 baseline at `166afdd759f5d3a4a6fff005e9293a906bda44d3`.
