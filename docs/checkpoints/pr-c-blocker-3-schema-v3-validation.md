# PR C Blocker 3 — Schema V3 Validation Implementation

Date: 2026-07-30
Phase: Phase 4 GREEN implementation complete; implementation-SHA verification GREEN; final exact-head snapshot confirmation follows this evidence-only checkpoint commit; no PR, merge, deployment, replay, integration, or live automation

## Current Goal

Close only PR C blocker 3 at the validation boundary: make schema v3 inherit the complete PR B state, scheduler, snapshot, and summary integrity contract, and explicitly require `failed_gate_details` plus `next_evidence_actions` for every v3 candidate. Phase 4 remains limited to the approved RED-to-GREEN validator and contract-test change.

## Overall Progress Checkpoint

- Phase 4 start gate found remote `main` at `f93a937aaaa7e688f233ab4ba0b9a97930c7b0c7` (`Record 2026-07-30 afternoon automation sync`); the proposal-time `166afdd759f5d3a4a6fff005e9293a906bda44d3` is historical and the implementation branch was not caught up to current `main`.
- Frozen PR C parent `codex/pr-c-v7-3-obtainable-evidence` was independently confirmed as `e0d0b2ac71849ac135d68f124c17e7262772c144`; it was not moved or caught up.
- Phase 4 start gate independently reconfirmed proposal branch `codex/pr-c-b3-schema-v3-validation` at exact approved head `2902ad461bf40616aefbfe2593739f2699214397` before any implementation write.
- The complete open-PR search returned only unrelated Weekly CSS PR `#71`.
- PR B state, compatible snapshot reuse, retry, summary accounting, and fair scheduling already exist and are consumed as an inherited contract.
- Blocker 1 owns V7.3 retained-`china_joint` publication/audit decision parity. Blocker 2 owns independent-quality source-role classification. Neither problem is reopened here.
- This task touches only validator enforcement design. It does not change admission, thresholds, evidence acquisition, provider classification, scheduler semantics, schema, generator output, workflows, product/UI, sync, or production data.

## Read-Only Baseline

All repository evidence below was fetched at exact parent SHA `e0d0b2ac71849ac135d68f124c17e7262772c144` through the GitHub App/API. No local CRM checkout or worktree was read or modified.

- [`scripts/validate-daily-contract.mjs`](https://github.com/Neo0109/CRM/blob/e0d0b2ac71849ac135d68f124c17e7262772c144/scripts/validate-daily-contract.mjs)
- [`schemas/sourcing_candidates.schema.json`](https://github.com/Neo0109/CRM/blob/e0d0b2ac71849ac135d68f124c17e7262772c144/schemas/sourcing_candidates.schema.json)
- [`automations/jobs/online_daily_v4_candidate_audit.mjs`](https://github.com/Neo0109/CRM/blob/e0d0b2ac71849ac135d68f124c17e7262772c144/automations/jobs/online_daily_v4_candidate_audit.mjs)
- [`automations/test/onlineDailyV73CandidateAuditContract.test.mjs`](https://github.com/Neo0109/CRM/blob/e0d0b2ac71849ac135d68f124c17e7262772c144/automations/test/onlineDailyV73CandidateAuditContract.test.mjs)
- [`automations/test/onlineDailyV4CandidateStateScheduler.test.mjs`](https://github.com/Neo0109/CRM/blob/e0d0b2ac71849ac135d68f124c17e7262772c144/automations/test/onlineDailyV4CandidateStateScheduler.test.mjs)
- [`scripts/verify-all.mjs`](https://github.com/Neo0109/CRM/blob/e0d0b2ac71849ac135d68f124c17e7262772c144/scripts/verify-all.mjs) and `package.json` validator scripts.

## Independent Reproduction Evidence

### 1. JSON Schema v3 conditional is declared but not executed

- The candidate schema accepts versions 1, 2, and 3 at line 14.
- The two actionable properties are typed at lines 92-99.
- The v3-only requirement is expressed solely through `allOf` -> `if` -> `then` at lines 197-214.
- `validateSchemaSubset` at lines 332-390 evaluates `$ref`, `type`, `enum`, formats, length/range, object `required`, `additionalProperties`, child `properties`, arrays, `minItems`, and `items`.
- It has no execution path for `allOf`, `if`, `then`, or `const`. Therefore the v3 conditional is documentation to this validator, not an enforced runtime condition.
- Among the five schemas loaded by the Daily validator, only `sourcing_candidates.schema.json` currently contains these four keywords. The other four contain none.

### 2. PR B integrity is gated to exact schema v2

- `validateSourcingCandidateIntegrity` calls `validateSourcingCandidateV2` only when `artifact.schema_version === 2` at line 195.
- The skipped checker is the complete PR B boundary: required summary counters and lane counts at lines 233-255; summary identities at lines 257-275; nine required state fields at lines 278-294; date ordering and snapshot contract, dedupe, app-id, successful-detail, and expiry relationships at lines 295-317.
- A v3 artifact therefore skips the entire inherited PR B semantic contract even when all v3 actionable fields are present and schema-valid.

### 3. Exact isolated validator harness

The harness executed the exact remote function declarations for `validateSchemaSubset`, `validateSourcingCandidateIntegrity`, and their dependencies in memory, with the exact remote schema and active rule version `sourcing-rules-v7.3-obtainable-evidence`. It did not reimplement their logic, write a repository fixture, invoke a provider, or run a live generator.

The complete one-record v3 control produced `0` errors. Each mutation below was applied independently to that otherwise complete artifact:

| Mutation | Current v3 result | Exact missing enforcement |
| --- | ---: | --- |
| Delete `failed_gate_details` | accepted, 0 errors | schema `allOf/if/then` is ignored |
| Delete `next_evidence_actions` | accepted, 0 errors | schema `allOf/if/then` is ignored |
| Delete PR B `first_seen` | accepted, 0 errors | v2 integrity call is skipped for v3 |
| Change `steam_candidates_scheduled` from 1 to 2 without changing related counters | accepted, 0 errors | PR B summary identities are skipped |
| Insert a schema-valid snapshot whose `dedupe_key` does not match the candidate | accepted, 0 errors | PR B snapshot relationship is skipped |

The same three PR B mutations under schema v2 produced the expected current errors:

- Missing state: `steam:9900001: first_seen is required for schema v2`.
- Corrupt summary: four errors for enriched/scheduled, scheduled/fresh-plus-failed, evaluated/scheduled-plus-reused, and lane-total/scheduled equality.
- Corrupt snapshot: `steam:9900001: evidence_snapshot dedupe_key must match candidate`.

This isolates the version dispatch as the only difference.

### 4. Historical 282-record relabel reproduction

- Exact source artifact: `data/sourcing_candidates/2026-07-29.json`, blob `8af83e153f038a415e77bf9a3b02c2a5b011b699`.
- Exact report: `data/reports/2026-07-29.json`, blob `7dbc96ff42fb826aa3e5672cd5d1778f50ba74b1`, with empty push/watch/drop pools.
- The artifact contains 282 records: 260 Steam and 22 media.
- The reproduction changed `schema_version` from 1 to 3 and aligned the artifact plus candidate rule-version strings to the active V7.3 rule. Counts and report parity remained valid.
- All 282 records lacked both actionable fields; all 260 Steam records lacked all nine PR B state/snapshot fields; the scan summary lacked all nine PR B stateful summary entries.
- Current validator result: accepted, `0` errors.
- Exact v2 control on the same incomplete artifact: rejected with 2,616 errors. That count is 2,340 missing state-field errors, 260 `last_seen` errors, 11 missing summary/lane-count errors, and 5 failed summary identities.

### 5. Accurate current error boundary

The validator still enforces top-level/base schema properties, candidate field types when present, duplicate dedupe keys, candidate/artifact rule-version equality, records/formal/candidate/excluded counts, active-rule qualified/push/report parity, and formal-report parity. The gap is narrower but critical: v3 conditional field presence and every PR B state/snapshot/summary semantic invariant are absent.

`onlineDailyV73CandidateAuditContract.test.mjs` currently proves field projection, schema-version emission, metric emission, typed definitions, and the presence of the JSON Schema conditional. It never invokes the Daily validator. Its fixture also uses an empty `candidateStates` map, so it is not evidence that a generated v3 record satisfies inherited PR B state integrity.

`onlineDailyV4CandidateStateScheduler.test.mjs` already owns the executable validator fixture and proves legacy v1 acceptance, valid v2 acceptance, and v2 rejection when `first_seen` is missing. It has no v3 validator case.

`verify:all` runs every automation test at task `daily-v4-tests` and later runs the Daily contract validator at task `daily-contract`; both surfaces currently lack an executable v3 negative fixture.

## Approval Context

### Current module problem

Schema v3 is presented as an additive contract over PR B, but production validation treats it as a third unrelated version. The machine-readable schema declares actionable fields through unsupported keywords, and the explicit semantic checker recognizes only version 2. Generation and documentation can therefore say v3 while validation silently drops both the new fields and the inherited lifecycle contract.

### Cost of inaction

- A near-miss audit can lose the only fields that tell downstream review what failed and what evidence to obtain next.
- A v3 artifact can lose candidate lifecycle state, accept a mismatched or stale snapshot relationship, or report impossible scheduling totals while Daily validation still succeeds.
- Healthy `verify:all`, workflow validation, and sync receipts could then be mistaken for business-artifact integrity.
- The next schema version would inherit the same ambiguity unless version inheritance is made explicit.

### Why this cut is next and does not repeat blockers 1 or 2

Blocker 1 corrected which admission decision is shared by publication and audit. Blocker 2 is limited to whether provider evidence is genuinely independent. Blocker 3 begins after those decisions and projections already exist: it determines whether the emitted artifact is rejected when required evidence fields or inherited PR B integrity are absent. No evaluator, provider, rule, threshold, candidate selection, or scheduling behavior needs to change.

This is the smallest remaining correctness boundary before PR C can rely on schema v3 as a validated artifact contract.

### TDD RED-to-GREEN principle

First add executable negative fixtures that the current validator wrongly accepts. Confirm RED only at the five missing enforcement boundaries, with the complete v3 control and historical v1/v2 cases still GREEN. Then add the smallest explicit version-dispatch and v3-field enforcement. GREEN must come from the same fixtures without changing schema, generator, admission, or scheduler behavior.

### Architecture benefit and blast radius

The Daily validator becomes the explicit version-inheritance boundary: v1 remains legacy, v2 remains PR B stateful, and v3 is PR B stateful plus V7.3 actionable evidence. The fix reuses one proven semantic checker rather than duplicating its invariants. Blast radius is limited to candidate-artifact validation and its existing contract test; Daily report, Radar, Steam Trends, sourcing Lead schema, generation, orchestration, sync, and product code remain untouched.

## Option Evaluation

### Option A — extend the generic schema subset validator

Required work would include correct `const`, `allOf`, and conditional `if/then` semantics, including evaluating `if` without leaking predicate errors. That shared engine validates Daily report, Radar, Steam Trends, sourcing Lead, and sourcing candidates. More importantly, this option still cannot enforce PR B counter identities, date ordering, snapshot dedupe/app-id relationships, or inherited state completeness without an additional explicit change.

Result: broader shared blast radius, more semantic surface, and still not a complete blocker-3 fix.

### Option B — add an explicit v3 validator and inherit v2 integrity

Recommended.

- Dispatch schema v2 to the existing `validateSourcingCandidateV2` unchanged.
- Dispatch schema v3 to a small `validateSourcingCandidateV3`.
- `validateSourcingCandidateV3` first calls the existing v2 checker, making full PR B inheritance explicit.
- It then requires own presence of `failed_gate_details` and `next_evidence_actions` on every candidate.
- Existing schema-subset traversal continues to validate the types and nested `$ref` contracts whenever those fields are present.
- Preserve existing v2 error text so historical validator contracts do not churn; add precise v3-only missing-field errors.

This is smaller and safer because it solves both halves of blocker 3 in one candidate-specific boundary and does not generalize a partial JSON Schema engine.

## Exact Phase 4 File Allowlist

If and only if explicitly approved, implementation may modify exactly:

1. `scripts/validate-daily-contract.mjs`
   - Add explicit v3 dispatch/inheritance and v3 actionable-field presence checks.
   - Do not change non-candidate validation, volume policy, report parity, date selection, CLI arguments, or workflow behavior.
2. `automations/test/onlineDailyV4CandidateStateScheduler.test.mjs`
   - Reuse its existing temporary contract root, historical v1/v2 upgrader, validator runner, and snapshot factory.
   - Add the complete-v3 positive control plus five independent negative cases.
3. `docs/checkpoints/pr-c-blocker-3-schema-v3-validation.md`
   - Evidence/status updates only.

No new fixture file is required. The following inspected files remain read-only and must not be modified:

- `schemas/sourcing_candidates.schema.json`
- `automations/jobs/online_daily_v4_candidate_audit.mjs`
- `automations/test/onlineDailyV73CandidateAuditContract.test.mjs`
- all admission, provider, second-pass, scheduler/state implementation, machine-rule, workflow, report, sync, UI/API, and production-data files.

## RED Fixture and Focused Tests

Build one complete v3 fixture by reusing the existing valid v2 historical upgrade, setting schema version 3, aligning rule-version strings, and adding empty actionable arrays to every candidate. Confirm it passes before applying independent mutations.

Add six focused cases:

1. Complete v3 control passes.
2. One candidate missing `failed_gate_details` is rejected with a v3-specific path/error.
3. One candidate missing `next_evidence_actions` is rejected with a v3-specific path/error.
4. One Steam candidate missing `first_seen` is rejected through inherited PR B integrity.
5. A scheduled-count mismatch is rejected through inherited PR B summary identities.
6. A schema-valid snapshot with a mismatched dedupe key is rejected through inherited PR B snapshot integrity.

Expected RED before validator implementation: case 1 GREEN; cases 2-6 fail because the process exits 0. Existing nine PR B/state-scheduler cases and six V7.3 candidate-audit/schema cases must remain GREEN.

Expected GREEN after the minimal validator change: all six new cases pass, existing v1/v2 behavior remains unchanged, and both focused files are fully GREEN.

## Phase 4 RED Evidence

- Test-only RED commit: `6354eee16107af8380d9e5c3bf63c4e924f86981`; it changed only `automations/test/onlineDailyV4CandidateStateScheduler.test.mjs`.
- The test file adds one complete schema-v3 positive control and five independent negative cases: missing `failed_gate_details`, missing `next_evidence_actions`, missing inherited `first_seen`, scheduled-counter identity mismatch, and snapshot `dedupe_key` mismatch.
- RED ran from a GitHub API tarball snapshot of that exact remote commit, not from a local CRM checkout/worktree.
- `node --test automations/test/onlineDailyV4CandidateStateScheduler.test.mjs` produced exactly 15 tests: 10 passed and the five new negative cases failed.
- The complete v3 positive control and all nine pre-existing scheduler/state tests passed, including the historical v1/v2 validator control.
- Every negative failure was isolated to wrong acceptance: the validator subprocess returned exit status 0 and each assertion reported `validator wrongly accepted ...`; there was no syntax, fixture, import, schema-type, or existing-test failure.
- The unchanged `node --test automations/test/onlineDailyV73CandidateAuditContract.test.mjs` control remained GREEN: 6 passed, 0 failed.
- No validator, schema, generator, scheduler/state implementation, rule, workflow, production data, or other file was changed in RED.

## Phase 4 GREEN and Verification Evidence

- GREEN implementation commit: `27857b1226cb49396a97d280f0796d0765b5cd93`.
- Option B was implemented exactly: schema v2 still calls the unchanged `validateSourcingCandidateV2`; schema v3 calls a new 15-line `validateSourcingCandidateV3`; the v3 checker first invokes the complete v2 checker and then uses own-property checks for `failed_gate_details` and `next_evidence_actions`.
- `validateSchemaSubset`, the JSON schema, candidate-audit generator, admission/evaluator/threshold code, Blocker 2, second pass, and PR B scheduler/state semantics were not changed.
- Exact-implementation API snapshot checks were GREEN:
  - `node --check scripts/validate-daily-contract.mjs`: exit 0.
  - `node --test automations/test/onlineDailyV4CandidateStateScheduler.test.mjs`: 15 passed, 0 failed.
  - `node --test automations/test/onlineDailyV73CandidateAuditContract.test.mjs`: 6 passed, 0 failed.
  - Combined two-file run: 21 passed, 0 failed.
  - Historical v1 Daily validator for 2026-07-29: `ok: true`, 282 sourcing candidates, no warnings.
- The first `npm run test:daily-v4` snapshot attempt had no installed dependencies and exposed only two unrelated `ERR_MODULE_NOT_FOUND: ajv` errors; all Blocker 3 tests were already GREEN. The repository has no npm lockfile, so `npm ci` correctly returned its precondition error.
- Installed the repository's 201 declared packages only inside the disposable snapshot with `npm install --no-audit --no-fund --package-lock=false`; no lockfile or remote change was created.
- The required rerun of `npm run test:daily-v4` passed 212/212.
- The unmodified `npm run verify:all` at exact implementation SHA `27857b1226cb49396a97d280f0796d0765b5cd93` exited 0 after all 16 tasks, including Daily V4 212/212, diagnostics, assistant model, sourcing learning 9/9, heartbeat 9/9, three typechecks, rule/probe compatibility, July 15-29 liveness replay, Daily contract, 1,634-module frontend build, and final `git diff --check`.
- GitHub compare from approved proposal head `2902ad461bf40616aefbfe2593739f2699214397` to the implementation SHA was `ahead=3`, `behind=0`, with exactly three allowlisted files and no other path.
- GitHub compare from frozen parent was `ahead=4`, `behind=0`; the parent branch itself remained unchanged.

## Acceptance Matrix

### RED proof

- `node --test automations/test/onlineDailyV4CandidateStateScheduler.test.mjs`
- Record that only the five new negative v3 cases fail for wrong acceptance; stop if syntax, fixture setup, module resolution, or an existing test fails.

### Focused GREEN

- `node --check scripts/validate-daily-contract.mjs`
- `node --test automations/test/onlineDailyV4CandidateStateScheduler.test.mjs`
- `node --test automations/test/onlineDailyV73CandidateAuditContract.test.mjs`
- Combined two-file run to exclude order or shared-fixture leakage.
- `node scripts/validate-daily-contract.mjs --date=2026-07-29 --allowLowVolume=true --requireSourcingCandidates=true` to preserve the historical v1 artifact path.

### Complete regression

- `npm run test:daily-v4`
- Unmodified `npm run verify:all` from the exact implementation commit. This verifier explicitly does not run live generators.
- Confirm all 16 verifier tasks complete; do not stop after only `daily-v4-tests` or `daily-contract`.
- Confirm remote diff from the proposal checkpoint contains only the two allowlisted implementation/test files plus this checkpoint.
- Confirm `schemas/sourcing_candidates.schema.json`, candidate-audit generation, PR B scheduler/state implementation, machine rules, workflows, and production data have zero diff.

## Historical Compatibility Requirements

- Schema v1 remains accepted without PR B state/snapshot/summary fields and without v3 actionable fields.
- Schema v2 continues to run the existing full PR B checker and does not require v3 actionable fields.
- Schema v3 runs the complete unchanged v2 checker first, then requires both actionable fields.
- Existing schema enum, JSON file, persisted v1/v2 artifacts, error wording for v2, report/date/volume policy, and validator CLI remain unchanged.
- No migration or rewrite of historical artifacts is part of blocker 3.

## Explicitly Forbidden Scope

- No schema, generator, admission, threshold, provider, blocker 2, second-pass, PR B scheduler/state semantic, machine-rule, workflow-trigger, report/Radar/Steam Trends, sync/recovery, product/UI/API, Supabase, production artifact, PR D/E, quantity, priority, or Lead-policy change.
- No PR creation, merge, deployment, workflow dispatch, provider call, live generator, live automation, or production validation run.
- No modification of `main` or `codex/pr-c-v7-3-obtainable-evidence`.
- No local CRM checkout/worktree read or write and no Computer Use.

## Stop Conditions

- Stop if the frozen parent no longer equals `e0d0b2ac71849ac135d68f124c17e7262772c144`; do not auto-catch-up.
- Stop if RED does not isolate exactly the five wrong-acceptance boundaries or if an existing v1/v2 test fails.
- Stop if a complete builder-produced v3 artifact cannot pass without changing candidate-audit generation or PR B scheduler/state semantics.
- Stop if the fix requires schema changes, generic validator expansion, blocker 2 work, admission/threshold changes, or any file outside the allowlist.
- Stop and record any unrelated `verify:all` failure; do not repair it opportunistically.
- Stop after checkpoint evidence. PR creation remains a separate explicitly approved task.

## Completed

- Reconfirmed every start gate through the GitHub App/API and preserved the frozen parent.
- Completed the approved RED-only test commit and recorded exact wrong-acceptance evidence.
- Completed the minimal Option B GREEN validator implementation without widening scope.
- Passed every focused, combined, historical, Daily V4, and full 16-task verifier check at the exact implementation SHA.
- Independently confirmed the remote changed-file allowlist contains only the approved validator, test, and checkpoint paths.
- Created no PR, merge, deployment, replay, integration, workflow dispatch, provider/generator run, sync, production-data change, or local CRM checkout/worktree change.

## Remaining

- After this evidence-only checkpoint commit moves the branch once, perform one read-only final exact-head API snapshot verification, independent `git diff --check`, and GitHub compare allowlist check.
- Report that final exact SHA and stop. Do not create another checkpoint commit afterward, because doing so would move the SHA that was just verified.
- Replay, integration into the frozen parent, PR creation, merge, and deployment remain explicitly outside this task.

## Next Action

Commit this checkpoint update, then validate that exact resulting remote head from a one-time GitHub API snapshot. If every required check is GREEN and the allowlist remains exact, report the result and stop.

## Git Status

- Remote `main` observed at Phase 4 start: `f93a937aaaa7e688f233ab4ba0b9a97930c7b0c7`; not used as a new base.
- Frozen parent: `codex/pr-c-v7-3-obtainable-evidence` remains `e0d0b2ac71849ac135d68f124c17e7262772c144`.
- Approved proposal head: `2902ad461bf40616aefbfe2593739f2699214397`.
- RED test commit: `6354eee16107af8380d9e5c3bf63c4e924f86981`.
- RED checkpoint commit: `3af137730aaf8dcbf8158cc72d2ca3dd3b2c2f4f`.
- GREEN implementation head before this checkpoint update: `27857b1226cb49396a97d280f0796d0765b5cd93`.
- Open PRs at Phase 4 start: unrelated `#71` only; no PR was created.
- Changed files are exactly:
  - `scripts/validate-daily-contract.mjs`
  - `automations/test/onlineDailyV4CandidateStateScheduler.test.mjs`
  - `docs/checkpoints/pr-c-blocker-3-schema-v3-validation.md`
