# PR C V7.3 Obtainable Evidence and Targeted Second Pass Checkpoint

Date: 2026-07-30
Phase: Phase 4 single-file sourcing compatibility migration and full verification complete; stopped at approved boundary
Approved proposal: CRM Daily Leads Liveness V7.3, PR C only

## Current Goal

The explicitly approved single-file migration and bounded verification are complete at exact remote code commit `bb841ec81cafd9159131bd6d5ec822ca973f6b0c`. Syntax, the focused compatibility script, the exact `sourcing-v6-4` compatibility/Bilibili task, and all 16 tasks in the unmodified full `npm run verify:all` are GREEN from a one-time exact remote snapshot. Independent full-branch diff validation, PR creation, merge, deployment, live generation, workflow/sync behavior, PR B scheduling changes, and PR D/E remain out of scope.

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

## Remaining

- No work remains inside the approved single-file implementation and bounded-verification task.
- Independent full-branch diff validation, PR creation, PR CI, merge, deployment, and read-only production acceptance remain separate later phases requiring their own boundary.
- Do not change workflow/sync behavior or PR B scheduling, run a live generator, or enter PR D/E.

## Next Action

Stop. Await a separately approved phase for independent full-branch validation or PR creation. Do not add another code change, create a PR, run live automation, or proceed to deployment in this task.

## Git Status

The approved implementation remains exactly code commit `bb841ec81cafd9159131bd6d5ec822ca973f6b0c`; all later branch commits are checkpoint evidence only. Before this final checkpoint update, the remote branch was `d80a51abb26a2c926f20c3e6cc95e20b29ea00a1`, remote `main` remained `166afdd759f5d3a4a6fff005e9293a906bda44d3`, and the only open PR remained unrelated `#71`. No local CRM checkout/worktree was read or modified.

## Rollout Status

The approved single-file compatibility migration is implemented, scope-checked, focused GREEN, and full-suite GREEN. This task stops at its approved verification boundary. No production generator, rule, other test, package script, workflow, sync, production artifact, PR B, PR D/E, independent full-branch diff validation, PR/CI, merge, deployment, live generation, or production acceptance was changed or performed.