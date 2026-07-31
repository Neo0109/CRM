# PR C V7.3 Obtainable Evidence and Targeted Second Pass Checkpoint

Date: 2026-07-30
Phase: Blocker 2 Phase 2 proposal complete; awaiting approval; no implementation or PR creation
Approved proposal: CRM Daily Leads Liveness V7.3, PR C only

## Current Goal

Blocker 1 is implemented and fully verified at exact code commit `c789f4efca8e9a33d0d419bfbe0a49215a243066`. The shared pure V7.3 evaluator now makes Steam/media formal-pool and candidate-audit consumers select the same retained `china_joint` lane and qualification result. Four-file syntax, the approved 31-test matrix, and the complete unmodified `npm run verify:all` are GREEN from exact remote snapshots.

Blocker 2 now has a bounded Phase 2 proposal. The targeted provider must keep project-controlled official/developer/publisher evidence in the official playable/gameplay and business-entry channels, while only positively classified independent media or creator signals may enter `quality_proofs`. The two-independent-source minimum, evaluator, hard exclusions, and all quantity boundaries remain unchanged. No blocker 2 implementation is authorized yet; blocker 3 remains separate.

Implement the already-approved PR C slice: make the V7.3 Daily evidence model reflect evidence that can actually be obtained for unreleased projects, expose actionable near-miss evidence gaps, and run a targeted second evidence pass before applying the same admission decision again.

PR C may change the approved evidence model and its targeted evidence orchestration. It must preserve hard exclusions and quality boundaries, and it must never create Leads through quantity floors, backfill, threshold relaxation, or a separate weaker decision path.

## Overall Progress Checkpoint

- Approved PR C code baseline: `71d0c2b2ff678cc73ba6704e949c0eae8177711d`.
- Current remote `main`: `166afdd759f5d3a4a6fff005e9293a906bda44d3`; the four commits after the approved code baseline only generated and recorded 2026-07-30 Daily artifacts.
- Completed recovery slices: PR A `#105` added production-artifact replay and business-liveness observability; PR B `#106` added candidate research state, compatible evidence-snapshot reuse, and fair allocation of the unchanged Steam enrichment budget.
- PR B merge state: squash merge `71d0c2b2ff678cc73ba6704e949c0eae8177711d`; PR-head Build run `30487695885` completed successfully.
- Open PR queue: unrelated PR `#71` only.
- Blocker 1 is closed at exact code commit `c789f4efca8e9a33d0d419bfbe0a49215a243066`.
- Blocker 2 Phase 2 is now bounded to the targeted provider source-role projection and its focused contract; no evaluator, threshold, machine-rule, or schema redesign is proposed.
- The pure V7.3 evidence module is GREEN.
- The candidate-audit/schema GREEN slice is complete: the audit builder recognizes V7.3, projects actionable near-miss fields, and emits schema version 3 with v3-only requirements.
- The targeted second-pass orchestrator RED contract is committed at `e10c2d3cce9fc0126a267d7b74617b10b6f71395`; GREEN code is complete at `12ce6f3b303cb0072dfa16fec2bf3ab65edb267f`.
- The machine-rule activation and fixed-replay RED contract is committed at `3f0df5185586c96d5c61b0a197a5f1e4e77c829b`.
- Minimal activation GREEN is complete at exact remote code head `182cfd0e60e0b0e1094a50178297ad489a82dc31`: runtime, machine rule, current-doc trace, rule-versioned pool decisions, Lead-count health, and reader-facing Daily output now agree on V7.3.
- Full `npm run verify:all` has now been executed from that exact code commit. Frontend 114/114, backend 21/21, and functions 31/31 passed; Daily V4 passed 201/204 and stopped the fail-fast verifier on three historical V7.2-active contract findings. The 12 later verification tasks were not run.
- Explicit approval was received. The three bounded test-contract migrations are complete at exact remote code head `cf9b5dc9332b16c9b96b76a1a55c427275dae731`; syntax and the focused 32-test ownership matrix are GREEN. Full `verify:all` advanced beyond Daily V4 and stopped at the separately owned stale V7.2 generator-identity assertion in `scripts/test-sourcing-v6-3.mjs:71`.
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

## Test-Contract Migration Proposal (Approval Required)

### Current module problem

Three test surfaces still encode V7.2 as the active rule after the approved V7.3 activation:

- `automations/test/onlineDailyV4Rules.test.mjs` is the unit owner of the runtime `RULE_VERSION`, but its locked literal and title still name V7.2.
- `automations/test/dailyAutomationHardening.test.mjs` duplicates the entire former V7.2 `indie_prelaunch_admission` object plus retained `china_joint` values. That duplicates version-specific business ownership already covered by the dedicated V7.3 activation/evidence contracts.
- `automations/test/onlineDailyV7Activation.test.mjs` still claims V7.2 owns active runtime, machine rules, current docs, and generator provenance. Its first equality now fails before the rest of the subtest runs, even though `onlineDailyV73ActivationReplayContract.test.mjs` already owns and passes that current-version boundary.

The remaining four subtests in `onlineDailyV7Activation.test.mjs` are not obsolete: they protect V6.8 quarantine history, the intentional V7.2 default when report builders are called without `ruleVersion`, zero-Lead artifact buildability, and qualified/push parity.

### Cost of inaction

The branch cannot pass `verify:all`, and fail-fast hides the 12 later verification tasks. More importantly, overlapping current-version ownership makes a future activation likely to repeat the same stale-contract failure or tempt a false fix that reverts V7.3 behavior to satisfy historical tests. Blind string replacement would also miss the later V7.2 object, documentation, and generator assertions currently short-circuited by the first failure.

### Why this slice is next

The exact V7.3 implementation contracts are already GREEN: activation/replay 8/8, candidate audit/schema 4/4, obtainable evidence 5/5, second-pass orchestration 6/6, and PR B candidate-state/fair-enrichment 8/8. The only currently exposed blocker is test-contract ownership, so a test-only migration is the smallest causal slice before any independent full-branch diff or PR work.

### Operation principle

Use the existing RED full-suite result as the TDD starting point. Assign one owner to each contract:

- active runtime version: `onlineDailyV4Rules.test.mjs` plus the dedicated V7.3 activation contract;
- version-neutral automation safety: `dailyAutomationHardening.test.mjs`;
- retained V7.2 compatibility and historical trace: `onlineDailyV7Activation.test.mjs`;
- exact V7.3 evidence, machine rule, current-doc, generator, and replay semantics: the already-GREEN `onlineDailyV73ActivationReplayContract.test.mjs`.

Do not change production code or weaken any V7.3 assertion to make the old tests pass.

### Architecture benefit

This removes duplicate ownership of the active business rule, keeps historical V7.2 behavior explicitly testable, and makes hardening assertions survive future rule-version changes. A later V7.4 activation should need to update its version-specific contract and the runtime-version unit, not rewrite generic workflow safety or historical compatibility tests.

### Proposed file changes

1. `automations/test/onlineDailyV4Rules.test.mjs`
   - Rename the locked-version subtest to V7.3 obtainable evidence.
   - Change only its expected literal from `sourcing-rules-v7.2-china-joint` to `sourcing-rules-v7.3-obtainable-evidence`.
   - Leave loader validation, defaults, source normalization, runner wiring, and orchestrator wiring unchanged.

2. `automations/test/dailyAutomationHardening.test.mjs`
   - Replace the copied full V7.2 indie rule with version-neutral safety assertions.
   - Preserve checks that `quality_quarantine` is absent; both lanes have `priority=null`, no formal minimum/maximum, no watch/drop backfill, and qualified/push parity; the targeted second pass cannot bypass hard exclusions or backfill formal Leads.
   - Move exact active evidence-model ownership to the existing V7.3 contract instead of duplicating it here.

3. `automations/test/onlineDailyV7Activation.test.mjs`
   - Keep the filename to avoid a noisy rename, but rename the suite and labels around retained-rule compatibility.
   - Rewrite only the first subtest so V7.2 is historical rather than active: machine rule version must equal `RULE_VERSION`, `RULE_VERSION` must differ from the historical V7.2 regular version, V7.2 must not be the active canonical doc, and the current doc must retain an explicit historical V7.2 reference.
   - Preserve the unchanged `china_joint` gate IDs, data-path thresholds, rating values, no-quota fields, historical V7.2 canonical fixture, generator `RULE_VERSION` wiring, and no-backfill/no-quarantine guardrails.
   - Remove only the now-unused V7.0 indie imports.
   - Rename the remaining passing labels so the active-rule safety test is version-neutral and the no-`ruleVersion` report test is explicitly described as intentional legacy V7.2 default compatibility. Do not change report, Radar, Steam Trend, volume, or validator implementation.

### Bounded implementation and verification

- Reconfirm remote `main`, branch head, and open PR queue before any write.
- Update only the three test files above through the GitHub App/API; checkpoint updates remain evidence-only.
- Run syntax checks for the three edited files.
- Run the focused 32-test ownership matrix:
  `dailyAutomationHardening.test.mjs`, `onlineDailyV4Rules.test.mjs`, `onlineDailyV7Activation.test.mjs`, `onlineDailyV73ActivationReplayContract.test.mjs`, and `onlineDailyV7ChinaJointAdmission.test.mjs`.
- If focused GREEN, run the unmodified full `npm run verify:all` from the exact resulting remote commit.
- If a later fail-fast task reveals another failure, record it and stop; do not add opportunistic fixes in the same task.
- Stop after verification and checkpoint evidence. Independent full-branch diff validation and PR creation remain separate later phases.

### Explicitly untouched

No changes to V7.3 evidence or second-pass implementation, machine rules, current/canonical rule documents, PR B state/snapshot/scheduler behavior, Daily generator, report/Radar/Steam Trend code, workflow triggers, sync/recovery, schemas, UI/API, Supabase, production artifacts, quantity policy, PR D, or PR E.

## Single-File Sourcing Compatibility Proposal (Approval Required)

### Current module problem

`scripts/test-sourcing-v6-3.mjs` combines stable V6.3 compatibility checks with one version-following assertion. Line 71 still hard-codes `online_daily_v4_sourcing_rules_v7_2_china_joint`, and the final JSON log still reports `sourcing-v7.2-china-joint`. On this PR C branch, the generator correctly uses `RULE_VERSION = sourcing-rules-v7.3-obtainable-evidence` and emits `online_daily_v4_sourcing_rules_v7_3_obtainable_evidence`. Exact active-version ownership already belongs to `onlineDailyV4Rules.test.mjs` and `onlineDailyV73ActivationReplayContract.test.mjs`; this legacy script should protect consistency, not independently select the current rule.

### Cost of inaction

The unmodified `verify:all` remains fail-fast at task 12, `sourcing-v6-4`. The Bilibili probe half of that task and the four later tasks—Daily Leads liveness replay, Daily contract validation, frontend temporary build, and diff-check—remain unexecuted. Leaving the literal in place also guarantees the same false regression on the next rule activation even when runtime, machine rules, documentation, and the dedicated activation contract all agree.

### Why this slice is next

The first 11 verification tasks are GREEN, including Daily V4 204/204, and the stale line is the first exposed failure. The three previously approved test migrations are complete. Updating this one compatibility owner is therefore the smallest causal slice; changing production behavior, a second test, package aliases, or verifier ordering would exceed the observed failure.

### Operation principle

Use the existing RED result as the TDD start and separate exact-version ownership from version-neutral consistency:

- import the runtime `RULE_VERSION` into the legacy script;
- retain a source-level assertion that the generator assigns `sourcingRuleVersion` from `RULE_VERSION`;
- extract the generator's declared `generatorName` and compare it with a name derived from `RULE_VERSION` by removing the `sourcing-rules-` prefix and normalizing dots and hyphens to underscores;
- keep V7.2 and V7.3 literals out of this compatibility assertion, so a future rule bump fails only when runtime wiring and the emitted generator label diverge;
- replace the outdated final log claim with a stable compatibility label plus the actual `active_rule: RULE_VERSION`.

This remains a test-only migration. It does not rewrite the generator to satisfy the test and does not weaken the dedicated V7.3 contract.

### Architecture benefit

The active version keeps one authoritative runtime constant and one dedicated version-specific activation contract. The older V6.3 suite continues to guard field hygiene, no-backfill behavior, qualified/push parity, and absence of formal quantity targets, while its version-following check becomes reusable for V7.4 and later. This reduces duplicate ownership and prevents an obsolete compatibility test from forcing production back to a historical rule.

### Proposed file change

Change only `scripts/test-sourcing-v6-3.mjs`:

1. Import `RULE_VERSION` from `automations/jobs/online_daily_v4_rules.mjs`.
2. Replace the literal V7.2 generator-name regex with:
   - a version-neutral assertion for `const sourcingRuleVersion = RULE_VERSION`;
   - extraction of the quoted `generatorName`;
   - equality against the generator label derived from the current `RULE_VERSION`.
3. Change the final JSON output from the stale V7.2 claim to a stable `sourcing-v6.3-compatibility` check label and an explicit `active_rule` value.
4. Leave every existing media-field, review-backfill, qualified/push parity, and no-quantity-target assertion unchanged.
5. Keep the historical filename and the `test:sourcing-v6-3` / `test:sourcing-v6-4` package aliases unchanged to avoid an unrelated rename and verifier-structure change.

### Bounded implementation and verification

- Reconfirm remote `main`, branch head, and open PR queue before any write.
- Update only `scripts/test-sourcing-v6-3.mjs` through the GitHub App/API; checkpoint updates remain evidence-only.
- Run `node --check scripts/test-sourcing-v6-3.mjs`.
- Run the focused script, then the exact task-12 command `node scripts/test-sourcing-v6-3.mjs && node scripts/test-bilibili-probe.mjs`.
- If focused GREEN, download the exact resulting remote commit to a one-time snapshot and run the unmodified `npm run verify:all`.
- If a later task exposes another failure, record it and stop. Do not repair it opportunistically.
- Stop after verification and checkpoint evidence. Independent full-branch diff validation and PR creation remain separate phases.

### Explicitly untouched

No changes to production generator or rule modules, V7.3 evidence/second-pass logic, machine rules, current/canonical rule documents, the three already-migrated tests, package scripts, verifier ordering, PR B state/snapshot/scheduler behavior, workflow triggers, sync/recovery, schemas, UI/API, Supabase, generated production artifacts, quantity policy, PR D, or PR E.

### Acceptance invariants

- The only implementation file changed is `scripts/test-sourcing-v6-3.mjs`.
- The script contains no assertion or final log that claims V7.2 is the active rule.
- The script fails if `RULE_VERSION`, generator runtime wiring, and the emitted generator label diverge.
- All existing V6.3 field-hygiene, no-backfill, parity, and no-quantity-target checks remain intact.
- The exact `sourcing-v6-4` task runs both its compatibility and Bilibili probe halves successfully before full verification proceeds.
- No production behavior, admission threshold, Lead quantity rule, workflow, sync, or data changes are introduced.

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

- Entered only blocker 2 Phase 2 proposal work after the user supplied the final blocker 1 completion checkpoint.
- Reconfirmed proposal-start remote state through the GitHub App/API: `main=166afdd759f5d3a4a6fff005e9293a906bda44d3`, branch=`c156039da6df08d14c26f6d61eb3fc70ded227dd`, and the only open PR is unrelated `#71`.
- Downloaded that exact branch commit to one disposable GitHub API snapshot and reran the four directly relevant existing contracts: V7.3 second-pass orchestrator 6/6, obtainable evidence 5/5, media source 8/8, and Steam source 8/8; baseline total 27/27 GREEN.
- Reproduced blocker 2 from the exact snapshot without live network: one project developer's official Bilibili Demo/playtest plus one genuinely independent media preview produced two `quality_proofs`, passed `independent_quality_proof`, and returned `qualified=true`.
- Confirmed the source data already exposes the required role boundary: Bilibili probe signals carry `official`, `developer`, `publisher`, `media`, `trusted_creator`, or `keyword`; broad official lookup origin is not proof of independence.
- Recorded the bounded blocker 2 proposal below. No implementation/test file, evaluator, threshold, machine rule, sourcing rule document, schema, workflow, production artifact, PR, merge, deployment, live generator, sync, or local CRM checkout/worktree was changed.

- Created one-time Git verification clone `/tmp/crm-v73-joint-git.dV6Gsd/repo`, detached exactly at `c789f4efca8e9a33d0d419bfbe0a49215a243066`, and installed 201 declared packages only there. `npm install` created an untracked temporary `package-lock.json`; both tracked and staged diffs remained empty.
- Reran the unmodified `npm run verify:all` successfully from that exact Git-backed snapshot. Frontend passed 114/114, backend 21/21, Functions 31/31, Daily V4 206/206, sourcing learning 9/9, and Daily heartbeat 9/9.
- Automation diagnostics, Lead Assistant, all three typechecks, sourcing-v6-4 plus Bilibili probe, fixed July 15-29 liveness replay, Daily contract, 1634-module frontend temporary build, and final `git diff --check` all passed.
- Final full-verifier log SHA-256: `438554b571f10e93b06ac098303f19392e6ec54ea4a9ae1dff6d7b88236f7415`.
- Reconfirmed final remote baseline before this checkpoint update: `main=166afdd759f5d3a4a6fff005e9293a906bda44d3`, branch=`923ae2b141caf8d05b79e25e47720bfe5582b1ce`, open PR queue contains only unrelated `#71`.
- Blocker 1 is closed at exact code commit `c789f4efca8e9a33d0d419bfbe0a49215a243066`. No PR was created because blockers 2 and 3 remain unresolved.

- Installed 201 declared packages only inside `/tmp/crm-v73-joint-green.iTPifD/Neo0109-CRM-c789f4e` and ran the unmodified full `npm run verify:all`.
- The verifier passed frontend tests, backend tests, Functions tests, all Daily V4 tests, automation diagnostics, Lead Assistant, sourcing learning, Daily heartbeat, all three typechecks, sourcing-v6-4 including Bilibili probe, fixed liveness replay, Daily contract, and frontend temporary build.
- Only final task `git diff --check` failed with exit 129 and `Not a git repository`, because the exact GitHub API tarball intentionally contains no `.git`; verifier log SHA-256 `a71b3def7e45f8caf25d9ba2cc2b66e133404d4021c746f6b00158df59e61f0b`.
- Per scope, no tracked file was edited to work around the verification environment. A one-time read-only Git clone at the same exact code commit will be used for the final unmodified rerun.

- Added `automations/jobs/online_daily_v7_3_regular_admission.mjs` at `9ebb30c6642211636560a18756565e170fba0cf0`; it composes the V7.3 indie evaluator with the unchanged retained-joint evaluators through `selectRegularAdmission` and stamps V7.3 provenance.
- Rewired only `online_daily_v4_decision.mjs` at `cbeff25425bcf87c2c8b144c2220ef9e387393a3` and `online_daily_v4_candidate_audit.mjs` at exact GREEN code head `c789f4efca8e9a33d0d419bfbe0a49215a243066`.
- Compared `949237546d74b9cd095cb7b004de7daa9673846f...c789f4efca8e9a33d0d419bfbe0a49215a243066`: only the approved three production files changed (34-line new module; decision +12/-31; audit +7/-8).
- Downloaded exact GREEN commit `c789f4e` to `/tmp/crm-v73-joint-green.iTPifD`; tarball SHA-256 `7fdc597eb7d4cb36e57885d89c964c05c7c5de574e7cdd368031545e37c97ecb`.
- All four implementation files passed `node --check`. The approved five-file focused matrix passed 31/31: V7.3 candidate audit 6/6, activation/replay 8/8, obtainable evidence 5/5, retained V7.2 joint admission 6/6, and legacy candidate audit 6/6.
- Reconfirmed before full verification that remote `main` remained `166afdd759f5d3a4a6fff005e9293a906bda44d3`, the branch was exact code commit `c789f4efca8e9a33d0d419bfbe0a49215a243066`, and the only open PR remained unrelated `#71`.

- Added only the approved Steam/media RED regressions in `automations/test/onlineDailyV73CandidateAuditContract.test.mjs` at exact commit `f8ed7fae2b1ada6f0228af9fa87ab5a458264147`.
- Downloaded that exact GitHub API tarball to one-time snapshot `/tmp/crm-v73-joint-red.lI3GVK`; tarball SHA-256 `b161de6ccba6cb0bccb1adcaf3bddf36dda37bfa879945713874420b46a4e6fc`.
- `node --check` passed. The focused RED ran 6 tests: the existing 4 passed and the new Steam/media tests both failed at the intended assertion (`actual=indie_prelaunch`, `expected=china_joint`); exit status 1. No syntax, module-resolution, fixture, or unrelated assertion failure occurred.
- Reconfirmed before GREEN that remote `main` remained `166afdd759f5d3a4a6fff005e9293a906bda44d3`, the branch was `f8ed7fae2b1ada6f0228af9fa87ab5a458264147`, and the only open PR remained unrelated `#71`.

- Received explicit user approval for only the blocker 1 four-file Phase 4 implementation and the bounded verification plan.
- Reconfirmed immediately before Phase 4 that remote `main` was `166afdd759f5d3a4a6fff005e9293a906bda44d3`, the branch was `6d270e49d4cf1fdd490a16cbd59f30c1f55ce772`, and the only open PR remained unrelated `#71`.

- Received explicit user confirmation to enter only blocker 1 Phase 2 proposal work.
- Reconfirmed remote `main` at `166afdd759f5d3a4a6fff005e9293a906bda44d3`, the proposal-start branch at `ffd3fa9bf32bdcc47a537eeb9755b9563f2c9a11`, and the open PR queue containing only unrelated `#71`.
- Confirmed the exact ownership divergence: pool publication composes V7.3 indie plus retained joint, while V7.3 candidate audit calls only the indie evaluator; the pool-index formal override cannot repair qualification metrics, lane, or exclusion evidence.
- Confirmed the test gap: activation/replay covers retained joint only through `buildPools`; candidate audit covers only an indie near-miss. Defined two deterministic cross-path RED fixtures and a four-file GREEN boundary.
- Recorded the bounded proposal above. No implementation or test file, machine rule, workflow, production artifact, PR, merge, deployment, live generator, sync, or local CRM checkout/worktree was changed.

- Confirmed test-ownership gaps: the V7.3 activation contract covers retained `china_joint` only through `buildPools`, while the candidate-audit contract covers only one `indie_prelaunch` near-miss; no test composes a retained-joint formal pool with the V7.3 candidate artifact.
- Confirmed the second-pass provider test asserts creator and media proof inclusion but never requires official/developer self-evidence to be excluded from independent quality.
- Reproduced schema-v3 validation bypass by changing the historical 282-record artifact to `schema_version=3` without adding any `failed_gate_details` or `next_evidence_actions`; `validate-daily-contract.mjs` returned `ok: true`.
- Root cause of the validation bypass: `validateSchemaSubset` ignores JSON Schema `allOf/if/then`, and `validateSourcingCandidateIntegrity` calls the PR B state/scheduler/snapshot checker only when `schema_version === 2`, so v3 also skips inherited v2 integrity checks.
- Performed an isolated bare-repository three-way merge check of current `main` and validation branch head after the first findings checkpoint. Merge base was `71d0c2b2ff678cc73ba6704e949c0eae8177711d`; `git merge-tree --write-tree` completed cleanly with tree `c6b9375074499b86c3af85ba015fb11de8957824` and no conflict.
- Confirmed the complete branch file list contains no workflow, package, UI/API, Supabase, production-data, sync/recovery, PR B candidate-state/scheduler, Steam review workflow, or secret-bearing change. Added provider code rejects URLs with embedded usernames/passwords and no credential literal was introduced.
- Reconfirmed before final evidence update that remote `main` remained `166afdd759f5d3a4a6fff005e9293a906bda44d3`, the PR C branch was `9ca09a8fd41fef05e62dd5a142a27648eff3e5b9`, and the only open PR remained unrelated `#71`.

- Compared merge base `71d0c2b2ff678cc73ba6704e949c0eae8177711d` to validation-start branch head `5cd7ca1426042af05fa25980bfed291d0ce46e6d`: 44 branch-only commits, 20 files, 2617 additions, 144 deletions; every GitHub compare patch is available. Compare payload SHA-256: `af37aee323d97039024398f516c7bfac27c352ed20d7a032ddc6a7d85d410935`.
- Compared the same merge base to current `main`: its four branch-only commits add only six dated 2026-07-30 automation artifact/receipt files. They have zero path overlap with PR C's 20 files.
- Reproduced a retained-`china_joint` audit inconsistency from the exact verified snapshot: `buildPools` publishes one formal `china_joint` Lead with `new_qualified_count=1`, while `buildSourcingCandidateArtifact` reports the same record as formal but `sourcing_lane=indie_prelaunch`, attaches a hard prelaunch exclusion, and emits `new_qualified_count=0` versus `push_pool_count=1`.
- Root cause of that inconsistency: the V7.3 branches of `steamAdmissionForRule` and `mediaAdmissionForRule` call only `evaluateV73IndiePrelaunchAdmission`; unlike pool selection, they never combine the retained V7.2 `china_joint` decision.
- Reproduced an independent-quality boundary violation: `fetchV73TargetedEvidence` converts a developer's own official Bilibili video into `bilibili_public_playtest` quality proof. With only one genuinely independent media preview, the evaluator counts two source IDs, passes `independent_quality_proof`, and returns `qualified=true`.
- Root cause of that violation: `qualityEvidenceFromSignals(officialSignals, "bilibili")` does not distinguish official/developer self-evidence from independent creator evidence before the two-source gate.
- No repository implementation or test file was modified; reproductions ran only against the previously verified one-time snapshot.

- User said `继续`; this task interprets that as approval for the next safest separate phase: independent full-branch diff validation only, not PR creation.
- Reconfirmed at phase start that remote `main` is `166afdd759f5d3a4a6fff005e9293a906bda44d3`, the PR C branch is `4c1f8d58e2f20df1d21f9045b5034c11bff8ece0`, and the only open PR remains unrelated `#71`.
- Reopened the final single-file verification checkpoint and confirmed all 16 unmodified `verify:all` tasks are already GREEN at exact code commit `bb841ec81cafd9159131bd6d5ec822ca973f6b0c`.
- No code, rule, test, workflow, production artifact, local CRM checkout/worktree, PR, or deployment was changed before beginning review.

- Installed the repository's 201 declared packages only inside `/tmp/crm-v73-single-test.WQM7if/repo` with `npm install --no-audit --no-fund --package-lock=false`; no repository package lock was created.
- Ran the unmodified `npm run verify:all` from exact code commit `bb841ec81cafd9159131bd6d5ec822ca973f6b0c`; it exited 0 after all 16 tasks.
- Full-suite counts were GREEN: frontend 114/114, backend 21/21, functions 31/31, Daily V4 204/204, sourcing learning 9/9, and Daily heartbeat 9/9. Automation diagnostics, Lead Assistant, all three typechecks, `sourcing-v6-4`, liveness replay, Daily contract, frontend temp build, and diff-check also passed.
- The formerly blocked task 12 reported `sourcing-v6.3-compatibility`, `active_rule=sourcing-rules-v7.3-obtainable-evidence`, and `bilibili-probe-v1` successfully.
- The fixed July 15-29 liveness replay remained the immutable historical baseline: 15 report days, 14 candidate-artifact days, 15 consecutive zero-Lead days, and `unhealthy-business-liveness`.
- Daily contract validation passed for 2026-07-29 with 282 sourcing candidates, 15 Radar items, 12 Steam Trend items, and zero formal pools; frontend temporary build transformed 1634 modules; final `git diff --check` passed and no tracked snapshot change remained.
- Full verification log: `/tmp/crm-v73-single-test.WQM7if/verify-all.log`, SHA-256 `e538b8e6c6ba98da93d20465d7f39a9983990d1e96b846a08bb8dc5932746ff8`.
- Reconfirmed after verification that remote `main` remained `166afdd759f5d3a4a6fff005e9293a906bda44d3`, the PR C branch was `d80a51abb26a2c926f20c3e6cc95e20b29ea00a1`, and the only open PR remained unrelated `#71`.

- Downloaded the exact `bb841ec81cafd9159131bd6d5ec822ca973f6b0c` GitHub API tarball to one-time snapshot `/tmp/crm-v73-single-test.WQM7if`; SHA-256 `c5332f45d933df3eaee679d161bce8a3deb9691c525f82f8b90f468b932d9f75`; Node `v22.23.1`, npm `10.9.8`, pnpm `11.9.0`.
- `node --check scripts/test-sourcing-v6-3.mjs` passed.
- The focused compatibility script passed and reported `active_rule=sourcing-rules-v7.3-obtainable-evidence`.
- The exact task-12 command passed both halves: `sourcing-v6.3-compatibility` and `bilibili-probe-v1`.
- No dependency installation, live provider, generator, workflow dispatch, sync, or production write was used for focused verification.

- Received explicit user approval for the single-file proposal and bounded verification.
- Reconfirmed immediately before writing that remote `main` was `166afdd759f5d3a4a6fff005e9293a906bda44d3`, the PR C branch was `c08d3014d5687b6f408e0c0e335fe62172fc0660`, and the only open PR remained unrelated `#71`.
- Updated only `scripts/test-sourcing-v6-3.mjs` through the GitHub App/API at exact code commit `bb841ec81cafd9159131bd6d5ec822ca973f6b0c`.
- The implementation imports `RULE_VERSION`, verifies the generator runtime wiring, derives the expected generator label without a V7.2/V7.3 literal, and replaces the stale final log with `sourcing-v6.3-compatibility` plus `active_rule`.
- Compared `c08d3014d5687b6f408e0c0e335fe62172fc0660...bb841ec81cafd9159131bd6d5ec822ca973f6b0c`; the implementation commit changes only `scripts/test-sourcing-v6-3.mjs` with 17 additions and 2 deletions.

- Reconfirmed remote `main` at `166afdd759f5d3a4a6fff005e9293a906bda44d3`, PR C branch at `fd611cb3b87bd8967442d50cc0e62b20873d2568`, and the open PR queue containing only unrelated `#71` before this proposal update.
- Read the exact remote compatibility script, active generator header, runtime `RULE_VERSION`, package aliases, verifier task ordering, and checkpoint boundary needed for the single-file proposal.
- Recorded the bounded single-file ownership migration above. No test, implementation, machine-rule, workflow, production artifact, or local CRM checkout/worktree was changed.

- Installed 201 declared dependency packages only inside the one-time snapshot and ran the unmodified `npm run verify:all` from exact code commit `cf9b5dc9332b16c9b96b76a1a55c427275dae731`.
- Full verification passed tasks 1-11: frontend tests, backend tests, functions tests, Daily V4 tests 204/204, automation diagnostics, Lead Assistant, sourcing learning 9/9, Daily heartbeat 9/9, and frontend/backend/functions typechecks.
- Fail-fast stopped at task 12, `sourcing-v6-4`, before `test-bilibili-probe.mjs` could run. `scripts/test-sourcing-v6-3.mjs:71` expected `/online_daily_v4_sourcing_rules_v7_2_china_joint/`, while the generator correctly exposes `online_daily_v4_sourcing_rules_v7_3_obtainable_evidence`; exit code 1.
- Per the approved boundary, no fourth test file or implementation file was changed. The four later verifier tasks—liveness replay, Daily contract, frontend temp build, and diff-check—were not run.

- Downloaded the exact `cf9b5dc9332b16c9b96b76a1a55c427275dae731` GitHub API tarball to one-time snapshot `/tmp/crm-v73-test-migration.yUEesg`; SHA-256 `277ad5b0704479bd3c0287714663e911f3920ad57ac2f1b063211b3478cdd29c`; Node `v22.23.1`, npm `10.9.8`.
- All three edited test files passed `node --check`, and the five-file ownership matrix passed 32/32: hardening 6/6, V4 rules 7/7, V7.3 activation/replay 8/8, retained V7.2 compatibility 5/5, and V7.2 `china_joint` 6/6.

- Received explicit user approval for only the three-test-file migration and bounded verification.
- Updated `onlineDailyV4Rules.test.mjs` at `8567de27fc7e563d0d64f804168de35494ab2211`, `dailyAutomationHardening.test.mjs` at `6625b2856cd09057dc83869410946f163f37732f`, and `onlineDailyV7Activation.test.mjs` at exact remote code head `cf9b5dc9332b16c9b96b76a1a55c427275dae731`, exclusively through the GitHub App/API.
- The edits separate current V7.3 ownership, stable version-neutral no-quota/no-bypass guardrails, and retained historical V7.2 compatibility. No implementation, machine rule, rule document, workflow, sync, production artifact, PR B, or PR D/E file changed.

- Reconfirmed for this proposal that remote `main` remains `166afdd759f5d3a4a6fff005e9293a906bda44d3`, the PR C branch remains exactly `34a6ea31562c64852f58e00957552c9f3739bad9`, and the only open PR remains unrelated `#71`.
- Read the exact remote versions of the three failing tests, the dedicated 8/8 V7.3 activation/replay owner, the retained 6/6 `china_joint` contract, runtime rule loader, decision defaults, report labeling behavior, machine rule, and current rules entrypoint.
- Confirmed the ownership split: `onlineDailyV4Rules` should lock the runtime version; `dailyAutomationHardening` should assert version-neutral no-quota/no-bypass safety; `onlineDailyV7Activation` should preserve historical V7.2 compatibility; and the dedicated V7.3 contract should remain the sole exact active evidence/model/provenance owner.
- Confirmed that omitted `ruleVersion` intentionally preserves V7.2 defaults in `buildPools` and `buildDailyReport`, while the active generator passes V7.3 explicitly. The passing legacy-default test must therefore be relabeled, not converted into an active-generator claim.
- Defined a bounded three-test-file RED-to-GREEN migration and a 32-test focused ownership matrix. No test, implementation, machine rule, rule document, workflow, production artifact, or local CRM checkout/worktree was modified.
- Reconfirmed before verification that remote `main` remained `166afdd759f5d3a4a6fff005e9293a906bda44d3`, the PR C branch remained exactly `94da0a73ebf12e88f09f0ef770ae3f1c961cae63`, and the only open PR remained unrelated `#71`.
- Downloaded the exact remote `182cfd0e60e0b0e1094a50178297ad489a82dc31` GitHub API tarball into a one-time `/tmp` directory. The captured tarball SHA-256 was `182125c18462c831bd7b72d8b1e3c05be26ea68d98887a57e0358726bca14325`; verification used Node `v22.23.1`, npm `10.9.8`, and pnpm `11.9.0`.
- Confirmed the repository has no npm lockfile. `npm ci` therefore returned its expected `EUSAGE` precondition error; declared dependencies were installed only inside the isolated snapshot with `npm install --no-audit --no-fund`. This setup result is separate from the subsequent repository verification command.
- Ran the unmodified `npm run verify:all`. Frontend tests passed 114/114, backend tests passed 21/21, functions tests passed 31/31, and Daily V4 passed 201/204. The verifier then stopped at `daily-v4-tests` by design, so its 12 later tasks were not run.
- Recorded the three currently exposed failures: `dailyAutomationHardening.test.mjs` still expects the machine rule version and full indie lane to be V7.2; `onlineDailyV4Rules.test.mjs` still names and expects the locked active rule as V7.2; and the first `onlineDailyV7Activation.test.mjs` subtest still expects V7.2 across runtime, machine rules, current/canonical docs, and generator provenance. Each first equality expected `sourcing-rules-v7.2-china-joint` and received the intended active `sourcing-rules-v7.3-obtainable-evidence`.
- Inspected those exact test bodies without editing them. Because the failing equality short-circuits later assertions, especially the full machine-rule and documentation assertions, a future contract migration must review each whole subtest and cannot be treated as three blind string replacements.
- Confirmed within the same Daily V4 run that the V7.3 activation/fixed-replay contract passed 8/8, candidate-audit/schema passed 4/4, obtainable-evidence decision passed 5/5, targeted second-pass orchestration passed 6/6, PR B candidate-state/fair-enrichment passed 8/8, the July 15-29 replay remained GREEN, and all seven historical weak samples remained excluded.
- No test, implementation, machine rule, source document, workflow, production artifact, or local CRM checkout/worktree was modified. No live generator, provider call, workflow dispatch, sync, PR, merge, deployment, independent full-branch diff validation, PR B scheduler change, or PR D/E work was performed.
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

## Retained china_joint Candidate-Audit Parity Proposal (Approval Required)

### Overall progress checkpoint

- Current remote `main`: `166afdd759f5d3a4a6fff005e9293a906bda44d3`.
- Completed preceding modules: PR A `#105` production replay/liveness; PR B `#106` candidate state, compatible snapshot reuse, and fair scheduling; PR C V7.3 implementation remains exact code commit `bb841ec81cafd9159131bd6d5ec822ca973f6b0c`.
- Open PR queue: unrelated Weekly CSS PR `#71` only.
- Current module: only the pure V7.3 rule-versioned composition that selects between the obtainable-evidence `indie_prelaunch` lane and the retained `china_joint` lane, as consumed by the formal pool and candidate audit.
- This proposal does not revisit completed PR A/PR B modules or reopen V7.3 evidence thresholds, second-pass provider behavior, schemas, validators, reporting, or workflow ownership.

### Concrete problem

`online_daily_v4_decision.mjs` currently owns the correct V7.3 two-lane composition: it evaluates the V7.3 indie lane and retained V7.2 `china_joint` lane, then uses `selectRegularAdmission` to choose the qualifying result. `online_daily_v4_candidate_audit.mjs` independently routes rule versions and, for V7.3, calls only `evaluateV73IndiePrelaunchAdmission`.

The pool index can overwrite the audit record's reader-facing decision to `formal`, but it cannot repair the independently computed qualification flag, lane, failed gates, missing evidence, or exclusion reasons. A retained-joint project can therefore be published as a formal `china_joint` Lead while the same v3 artifact records `indie_prelaunch`, an indie hard exclusion, `new_qualified_count=0`, and `push_pool_count=1`.

Existing tests divide ownership without composing the two paths: the V7.3 activation contract proves `buildPools` retains `china_joint`, while the V7.3 candidate-audit contract covers only one indie near-miss.

### Cost of inaction

A legitimate retained-joint formal Lead can make the Daily candidate artifact internally contradictory and fail the blocking qualified/push parity validation. Even if a downstream consumer ignores that validator, diagnostics would misstate which lane qualified the project and why. Keeping separate admission composition in the pool and audit also makes the same drift likely on the next rule activation.

### Why this operation is necessary

This is not a new sourcing-policy decision. The retained `china_joint` lane and its gates are already approved, implemented, and tested; only the audit consumer fails to use the same composition.

Do not fix the symptom by copying `china_joint` selection into the audit or by forcing `sourcing_lane` from the published pool. Either approach leaves two business-rule owners or hides a false `_admissionQualified` result behind corrected metadata. The smallest durable operation is to give both consumers one pure V7.3 composition function.

### Engineering principle

Use TDD and pure-logic ownership:

1. Add deterministic RED coverage to the existing V7.3 candidate-audit contract for both Steam and media retained-joint formal candidates. Each fixture must pass `buildPools`, then be audited with those exact candidate and published pools.
2. Add `automations/jobs/online_daily_v7_3_regular_admission.mjs`, mirroring the established V7.2 regular-admission boundary. It composes the V7.3 indie evaluator with the unchanged V7.2 `china_joint` evaluator through `selectRegularAdmission`, and stamps the selected result with the V7.3 rule version.
3. Make both `online_daily_v4_decision.mjs` and `online_daily_v4_candidate_audit.mjs` consume the shared Steam/media V7.3 evaluators.
4. Preserve the existing V7.0/V7.2 audit routes and every pool-selection, ordering, dedupe, evidence, and hard-exclusion rule.

The candidate-audit builder remains responsible for projecting a decision into an artifact; it does not become a second admission authority.

### Architecture benefit

One pure module owns V7.3 lane composition for every consumer. Formal publication and diagnostic projection cannot silently choose different lanes, future V7.4 work has a clear rule-versioned seam, and network/orchestration code remains outside admission logic. The blast radius is limited to the composition boundary and two existing consumers; no schema, workflow, sync, UI, or production-data path changes.

### Proposed implementation files

1. `automations/test/onlineDailyV73CandidateAuditContract.test.mjs`
   - First commit two RED regressions: one Steam and one media retained-joint candidate.
   - Assert formal decision, `sourcing_lane=china_joint`, V7.3 provenance, empty contradictory indie exclusions/actions, and `new_qualified_count === push_pool_count === 1`.
   - Preserve the existing indie near-miss and schema assertions unchanged.

2. `automations/jobs/online_daily_v7_3_regular_admission.mjs` (new)
   - Export pure Steam and media V7.3 regular-admission evaluators.
   - Reuse `evaluateV73IndiePrelaunchAdmission`, the existing retained-joint evaluators, and `selectRegularAdmission`.
   - Change no gate, threshold, evidence normalization, lane priority, or quantity policy.

3. `automations/jobs/online_daily_v4_decision.mjs`
   - Replace the local private V7.3 composition with calls to the shared pure evaluators.
   - Leave pool filtering, dedupe, ordering, Lead shape, and legacy default behavior unchanged.

4. `automations/jobs/online_daily_v4_candidate_audit.mjs`
   - Route only V7.3 Steam/media audit evaluation through the same shared evaluators.
   - Leave V7.0/V7.2 routing, schema selection, record merging, pool indexing, PR B state fields, and scan metrics unchanged.

Checkpoint updates are evidence-only and are not part of the implementation boundary.

### Bounded RED-to-GREEN and verification

- Reconfirm remote `main`, branch head, and open PR queue before each write phase.
- RED commit: change only the candidate-audit contract, then run it from the exact remote snapshot and confirm failures are limited to the reproduced lane/qualification/parity boundary.
- GREEN commits: add the pure composition module, then rewire only the decision and candidate-audit consumers.
- Run `node --check` on the four implementation files.
- Run the focused 31-test matrix:
  - `onlineDailyV73CandidateAuditContract.test.mjs` (expected 6 tests after RED additions);
  - `onlineDailyV73ActivationReplayContract.test.mjs` (8);
  - `onlineDailyV73ObtainableEvidence.test.mjs` (5);
  - `onlineDailyV7ChinaJointAdmission.test.mjs` (6);
  - `onlineDailyV4CandidateAudit.test.mjs` (6).
- If focused GREEN, run the unmodified full `npm run verify:all` from the exact resulting remote code commit.
- If any unrelated later task fails, record it and stop. Do not repair blocker 2, blocker 3, or another verifier surface opportunistically.
- Stop after verification and checkpoint evidence. PR creation remains a separate task.

### Acceptance invariants

- For identical V7.3 inputs, formal-pool and candidate-audit consumers select the same qualified lane for Steam and media candidates.
- A fully qualified retained-joint formal record has `decision=formal`, `sourcing_lane=china_joint`, V7.3 provenance, no contradictory indie hard exclusion, and candidate-audit qualified/push parity.
- The existing V7.3 indie qualified and near-miss fixtures remain unchanged.
- The retained `china_joint` gates, thresholds, evidence normalization, mature-partner exclusion, and selection priority remain unchanged.
- Historical V7.0/V7.2 audit behavior and omitted-rule V7.2 defaults remain unchanged.
- No quota floor, backfill, watch/drop formalization, threshold relaxation, or hard-exclusion bypass is introduced.
- No live provider, generator, workflow dispatch, sync, production write, PR, merge, or deployment is used for verification.

### Explicitly untouched

Blocker 2 independent-quality source classification; blocker 3 schema-v3 and inherited PR B validator enforcement; V7.3 obtainable-evidence gates; targeted second-pass provider/orchestrator; machine rules and sourcing documents; candidate schema; PR B state/snapshot/scheduler; reports, Radar, Steam Trends, Lead-count health, CRM import/sync/recovery; workflows; UI/API; Supabase; production artifacts; PR D/E; existing Leads; quantity and priority policy.

### Policy decision status

No unresolved business-policy choice is encoded by this proposal. It restores consistency with the already-approved rule that V7.3 retains the independent V7.2 `china_joint` lane unchanged.

## Independent Full-Branch Validation Findings (Blocking)

### 1. Retained china_joint decisions diverge between publication and candidate audit

- Production pool decision: a fully qualified retained joint fixture publishes one formal Lead with `sourcing_lane=china_joint` and `new_qualified_count=1`.
- Candidate artifact for the same object: `decision=formal`, but `sourcing_lane=indie_prelaunch`, a hard `prelaunch_window` exclusion, `new_qualified_count=0`, and `push_pool_count=1`.
- Root cause: V7.3 candidate-audit admission calls only `evaluateV73IndiePrelaunchAdmission`; it does not compose the retained joint lane as `buildPools` does.
- Impact: a legitimate retained-joint formal Lead makes the generated v3 audit internally contradictory and triggers the blocking qualified/push parity validator.

### 2. Official/developer self-evidence can satisfy an independent-quality slot

- The targeted provider passes every project-matching result from the broad “official lookup” into `qualityEvidenceFromSignals(officialSignals, "bilibili")`.
- A developer's own official Bilibili Demo/playtest video is therefore emitted as a `bilibili_public_playtest` quality proof.
- Deterministic reproduction with one official developer video plus one genuinely independent media preview produced two source IDs, passed `independent_quality_proof`, and returned `qualified=true`.
- Impact: V7.3 can publish a formal Lead with only one genuinely independent public quality source, weakening the approved quality boundary.

### 3. Production validation does not enforce schema v3 or inherited PR B integrity

- The schema adds v3 candidate requirements through `allOf/if/then`, but the repository's `validateSchemaSubset` implementation does not evaluate those keywords.
- `validateSourcingCandidateIntegrity` invokes `validateSourcingCandidateV2` only for exact schema version 2, so v3 skips inherited state, scheduler, snapshot, and summary consistency checks.
- Deterministic reproduction relabeled a 282-candidate historical artifact as schema v3 while leaving all 282 records without both new actionable fields; the official Daily validator returned `ok: true`.
- Impact: workflow validation can accept structurally incomplete v3 candidate audits and no longer protects the PR B lifecycle/snapshot contract after V7.3 activation.

## Independent-Quality Source Classification Proposal (Approval Required)

### Overall progress checkpoint

- Current remote `main`: `166afdd759f5d3a4a6fff005e9293a906bda44d3`.
- Completed preceding modules: PR A `#105` production replay/liveness; PR B `#106` candidate state, compatible snapshot reuse, and fair scheduling; blocker 1 shared V7.3 two-lane composition at exact code commit `c789f4efca8e9a33d0d419bfbe0a49215a243066`.
- Proposal-start branch head: `c156039da6df08d14c26f6d61eb3fc70ded227dd`.
- Open PR queue: unrelated Weekly CSS PR `#71` only.
- Current module: only the targeted second-pass provider's projection of public signals into the independent `quality_proofs` channel.
- This proposal does not revisit blocker 1, implement blocker 3, or reopen the V7.3 minimum, evaluator, official playable/gameplay family, hard exclusions, second-pass selection cap, or PR B scheduler/state contracts.

### Concrete problem

`fetchV73TargetedEvidence` gathers a broad project-matching `officialSignals` set and the run's matching `mediaSignals`. When `fetch_independent_quality_evidence` is requested, it sends both collections through `qualityEvidenceFromSignals`.

That helper checks only hands-on/playtest/preview/review wording and a public URL. It does not classify the signal's relationship to the project. The V7.3 evaluator then correctly deduplicates the emitted proof source IDs, but it has no source-role information with which to distinguish a project-controlled citation from an independent one.

The current branch therefore converts an official developer Bilibili Demo/playtest into `bilibili_public_playtest`. In an exact-commit deterministic reproduction, that self-evidence plus one genuine independent media preview produced two source IDs and returned `qualified=true`.

The repository already has the relevant source-role vocabulary. Bilibili probe signals expose `bilibili_probe.source_kind` as `official`, `developer`, `publisher`, `media`, `trusted_creator`, or `keyword`. Broad official-lookup results do not carry positive independent provenance.

### Cost of inaction

A candidate can satisfy the two-source gate with only one genuinely independent quality source. The formal Lead may still look structurally valid, so replay, artifact validation, and sync can all succeed while the approved quality boundary has already been weakened. Any future official/developer search expansion would enlarge the false-positive surface because relevance wording, not independence, currently decides admission into `quality_proofs`.

### Why this operation is necessary and next

Blocker 1 restored publication/audit decision parity without changing sourcing policy. Blocker 2 is the next independent full-branch finding and directly affects whether V7.3 can publish a false formal Lead. It must be closed before blocker 3 or PR creation.

This repair does not lower or raise the existing minimum. It restores the approved meaning of the word “independent” by requiring positive source-role evidence before a Bilibili signal consumes a quality slot.

### Engineering principle

Keep source classification at the provider boundary, where origin and `source_kind` are available, and keep the pure V7.3 evaluator responsible only for deduplicating and counting already-normalized independent proofs.

Use disjoint evidence channels:

1. Broad official lookup results may support official Demo/Playtest, official gameplay, non-Steam business entry, and China/Bilibili value research. They must never be projected into `quality_proofs`.
2. Non-Bilibili signals from the configured media collection may be projected as independent media evidence after the existing project-match, public-URL, and quality-content checks.
3. Bilibili signals may consume an independent-quality slot only when `bilibili_probe.source_kind` positively identifies `media` or `trusted_creator`.
4. `official`, `developer`, and `publisher` are project-controlled for this boundary. `keyword`, missing, or otherwise unclassified Bilibili roles do not count as independent merely because no self-ownership keyword was detected.
5. Keep the existing source-ID deduplication and two-source evaluator unchanged. Content relevance proves that an item discusses hands-on quality; it does not prove independence.

### Architecture benefit

The provider becomes an explicit trust boundary instead of letting search origin and content wording silently define independence. Official evidence remains available for the gates it is qualified to prove, independent evidence remains separately countable, and the pure evaluator avoids Bilibili-specific ownership heuristics. Future providers get a clear contract: classify provenance before writing `quality_proofs`.

The blast radius is one provider module and its public contract test. No machine rule, artifact schema, candidate lifecycle, report, sync, UI, or workflow path changes.

### Proposed implementation files

1. `automations/test/onlineDailyV73SecondPassOrchestrator.test.mjs`
   - First commit two deterministic RED regressions using injected fixtures only.
   - Prove that an official/developer/publisher Bilibili signal can still support requested official evidence but contributes zero independent-quality proofs.
   - Prove that one genuine independent media proof plus any number of project-controlled proofs remains below the two-source minimum.
   - Prove that two distinct positively classified independent signals—such as one `trusted_creator` Bilibili playtest plus one external media preview—can satisfy the unchanged gate when every other gate passes.
   - Preserve the six existing second-pass selection, snapshot, failure-isolation, provider, and wiring subtests.

2. `automations/jobs/online_daily_v7_3_second_pass_orchestrator.mjs`
   - Stop passing `officialSignals` into independent-quality projection.
   - Add a small pure source-role filter for `matchingMediaSignals`.
   - Admit external non-Bilibili media plus Bilibili `media`/`trusted_creator`; reject Bilibili `official`/`developer`/`publisher` and unclassified/`keyword` roles from `quality_proofs`.
   - Leave official playable/gameplay, business-entry, China/Bilibili value, action allowlisting, candidate selection, snapshot writeback, and provider failure isolation unchanged.

Checkpoint updates are evidence-only and are not part of the implementation boundary.

### Bounded RED-to-GREEN and verification

- Reconfirm remote `main`, branch head, and open PR queue before each write phase.
- RED commit: change only `onlineDailyV73SecondPassOrchestrator.test.mjs`; run it from the exact remote snapshot and confirm the new failures are limited to self-evidence occupying an independent slot.
- GREEN commit: change only `online_daily_v7_3_second_pass_orchestrator.mjs`.
- Run `node --check` on the test and provider modules.
- Run the focused 29-test matrix after the two RED additions:
  - `onlineDailyV73SecondPassOrchestrator.test.mjs` (8);
  - `onlineDailyV73ObtainableEvidence.test.mjs` (5);
  - `onlineDailyV4MediaSource.test.mjs` (8);
  - `onlineDailyV4SteamSource.test.mjs` (8).
- If focused GREEN, run the unmodified full `npm run verify:all` from the exact resulting remote code commit.
- If any unrelated later task fails, record it and stop. Do not repair blocker 3 or another verifier surface opportunistically.
- Stop after verification and checkpoint evidence. PR creation remains a separate task.

### Acceptance invariants

- The V7.3 independent-quality minimum remains exactly two distinct public sources.
- One independent source plus any number of project official/developer/publisher sources never passes `independent_quality_proof`.
- Official/developer/publisher evidence remains usable for the existing official playable/gameplay and business-entry actions when otherwise valid.
- External media and positively classified Bilibili `media`/`trusted_creator` signals remain eligible; source-ID deduplication still prevents duplicate pages or citations from filling two slots.
- Bilibili `keyword`, missing, or unclassified roles do not consume an independent slot.
- Existing Steam recommendation and Metacritic public-quality proofs remain unchanged.
- Hard exclusions, same-evaluator second pass, 12-candidate cap, one-to-three action bound, candidate snapshot semantics, and provider-failure isolation remain unchanged.
- No quota floor, backfill, threshold relaxation, alternate decision path, live provider, generator, workflow dispatch, sync, production write, PR, merge, or deployment is introduced.

### Explicitly untouched

The pure V7.3 evaluator and its two-source threshold; blocker 1 shared regular-admission composition; blocker 3 schema-v3 and inherited PR B validation; V7.3 machine rules and sourcing documents; candidate schema; PR B state/snapshot/scheduler; pool selection and candidate audit; reports, Radar, Steam Trends, Lead-count health, CRM import/sync/recovery; workflows; UI/API; Supabase; production artifacts; PR D/E; existing Leads; quantity and priority policy.

### Policy decision status

No lower-quality exception is proposed. Treating project official/developer/publisher channels as non-independent and requiring positive provenance for Bilibili independent evidence is the conservative enforcement of the already-approved two-independent-source rule.

## Remaining

- No work remains inside blocker 1 implementation or verification.
- Blocker 2 Phase 2 proposal is complete; its two-file RED-to-GREEN implementation is not authorized until explicit user approval.
- Blocker 3 schema-v3/inherited-PR-B validator enforcement remains unresolved and must stay in its own later Proposal -> Approval -> Implementation task.
- Blockers 2 and 3 still block PR C creation.
- PR creation, merge, deployment, live generation, and production acceptance remain out of scope.

## Next Action

Stop. Await explicit user approval for only the blocker 2 two-file Phase 4 implementation and bounded verification above. Do not edit an implementation/test file, address blocker 3, create a PR, merge, deploy, or run live automation before that approval.

## Git Status

The exact blocker 1 code commit remains `c789f4efca8e9a33d0d419bfbe0a49215a243066`. Immediately before this blocker 2 proposal checkpoint update, remote `main` was `166afdd759f5d3a4a6fff005e9293a906bda44d3`, this branch was `c156039da6df08d14c26f6d61eb3fc70ded227dd`, and the only open PR was unrelated `#71`. Blocker 2 implementation/test files remain unchanged. Proposal inspection and reproduction used only a disposable exact-commit GitHub API snapshot; the dirty local CRM checkout/worktree was not modified.

## Rollout Status

Blocker 1 implementation is complete and fully GREEN. Blocker 2 now has a concrete two-file Phase 2 proposal, but no RED, GREEN, or full verification has been authorized or performed for that repair. Blocker 3 remains unresolved. No machine rule, workflow, sync, production artifact, PR B, PR D/E, PR creation, merge, deployment, live generation, or production acceptance changed.


## S1 Integration Rehome

### Current Goal

Task `RC-C-INT-S1-E` is the approved Phase 4 implementation slice for rebuilding the final PR C Root tree onto a clean non-production integration child. The child starts from `codex/pr-c-v7-3-integration@3928de8472ffb15b609acc138c9340329234e686`; the source-of-truth Root tree is `codex/pr-c-v7-3-obtainable-evidence@e0d0b2ac71849ac135d68f124c17e7262772c144`. This slice may change exactly the 21 frozen Root paths and nothing else.

### Completed

- Reconfirmed immediately before every write phase that remote `main`, the shared integration base, and source Root remained at their frozen SHAs.
- Created `codex/pr-c-int-s1-root` from the shared base and committed the durable pre-write checkpoint as `7a42c1e47594718c450d3af7cfc75654a72f58fe`.
- Rebuilt all 20 non-checkpoint allowlisted paths in `c2a78bc09afc6ac22650d65d78dd699e2096aefb` by reusing their exact source Git blob IDs. No old branch commit was merged or replayed.
- GitHub API compare from the frozen base reported exactly 21 changed paths. Recursive-tree comparison reported 20 of 20 non-checkpoint blob IDs identical to source Root, with no mismatch.
- From the exact `c2a78bc09afc6ac22650d65d78dd699e2096aefb` GitHub API tarball on Node `v22.23.1`: 16 of 16 changed MJS files passed `node --check`; both changed JSON files parsed; seven frozen focused suites plus four unchanged admission/candidate-audit controls passed 73 of 73 tests.
- `node scripts/test-sourcing-v6-3.mjs` passed and reported `sourcing-v6.3-compatibility` with active rule `sourcing-rules-v7.3-obtainable-evidence`.
- The first dependency-free tarball Daily V4 run had only two missing-`ajv` environment failures. After the repository-standard temporary install with `npm install --no-package-lock --ignore-scripts --no-audit --no-fund`, `npm run test:daily-v4` passed 206 of 206 tests; no `package-lock.json` was generated.
- A disposable Git repository assembled from exact base/head GitHub API tarballs passed `git diff --check origin/main...HEAD` and independently reported exactly the same 21 changed paths.
- Exact-head GitHub Build run `30601905479` completed `success` for `c2a78bc09afc6ac22650d65d78dd699e2096aefb`.
- Preserved every base path outside the allowlist, including current-main data-only commits. No local CRM checkout/worktree was read or modified; no PR, shared-base update, merge, workflow dispatch, deployment, production generation, B2, B3, C5, or backlog work occurred.

### Remaining

- GitHub assigns this final checkpoint commit SHA after the content is committed. Re-download that exact final head and repeat the frozen read-only syntax, JSON, focused/control, compatibility, Daily V4, path, source-parity, and whitespace checks.
- Report the exact final head and evidence to the Release Captain, then stop. Independent review, independent verification, PR creation, integration-base advancement, merge, and later slices remain separate cards.

### Next Action

Perform only read-only verification of the exact final child head from a new disposable GitHub API tarball. Do not write again, start a repair loop, create a PR, merge, deploy, or start another slice.

### Git Status

- Remote `main`: `3928de8472ffb15b609acc138c9340329234e686`.
- Shared base: `codex/pr-c-v7-3-integration@3928de8472ffb15b609acc138c9340329234e686`.
- Source Root: `codex/pr-c-v7-3-obtainable-evidence@e0d0b2ac71849ac135d68f124c17e7262772c144`.
- Final checkpoint parent: `c2a78bc09afc6ac22650d65d78dd699e2096aefb`. The exact final checkpoint SHA is intentionally reported externally after GitHub creates it, avoiding a recursive self-reference write.
- Expected final cumulative diff: exactly 21 frozen paths; the only post-reconstruction change is this checkpoint evidence.
