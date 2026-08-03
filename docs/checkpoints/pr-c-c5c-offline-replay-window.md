# PR C C5-C Offline Replay Window Recovery Checkpoint

Date: 2026-08-03 (Asia/Shanghai)
Phase: Phase 5 independent exact-head QA complete — diagnosis/proposal boundary
Status: QA RED — P0=0 / P1=4 / P2=0; no PR decision authorized
Branch: codex/pr-c-c5c-offline-replay-window
Exact base: 9dfce284903a72ba61fac1937acc69ab7f6d04c4
Implementation authority: 800f615fd30546eae4f03c89838e59416406c6a5

## Current Goal

Fresh independent read-only exact-head QA against implementation authority `800f615fd30546eae4f03c89838e59416406c6a5` is complete. QA found four P1 contract gaps. Preserve the implementation authority and stop at the diagnosis/proposal boundary; no implementation repair or PR decision is authorized.

## Completed

- Re-pinned remote `main` and this branch through the GitHub API.
- Current `main`/merge base is `9dfce284903a72ba61fac1937acc69ab7f6d04c4`, the merged shadow-only C5-B authority.
- C5-C branch is exactly three commits ahead and zero behind:
  1. `1040985f911fb68627069d9ec4ad04af637ca1ce` — accepted offline replay/window RED.
  2. `59ca1ccb550f149eb00e5071f6123bd1f6481f32` — added the missing deterministic replay-binding RED.
  3. `800f615fd30546eae4f03c89838e59416406c6a5` — minimal implementation GREEN.
- Exact compare contains nine C5-C job/test/schema paths and no checkpoint path before this recovery record.
- The interrupted run visibly completed the exact-`800f615f` focused suite at 43/43, the V7.3 union at 72/72, syntax checks for the four modified/added job MJS files, and replay-window schema JSON parsing.
- No C5-C PR exists. C5-C is not in `main`, not deployed, not live, and not activated.

The completed test counters above are recovered run evidence. They do not imply that commands whose result was lost during the transport failure passed.

## Remaining

- Resolve the four P1 findings recorded below through a separately approved, bounded repair plan.
- Add adversarial RED coverage for input-derived decision replay, end-to-end artifact/receipt binding, requested-date equality, and impossible replay-window states before changing implementation.
- After an approved repair, repeat focused exact-head verification and fresh independent QA. Do not treat the previous GREEN counters as QA closure.

## Next Action

Stop at diagnosis/proposal. Prepare a separate bounded C5-C repair proposal for the four P1 findings; do not change implementation until separately approved, and do not create a PR, merge, deploy, dispatch, run live providers/generators, sync, replay production data, begin the 15-day observation window, or activate V7.3.

## Git Status

- Remote `main`: `9dfce284903a72ba61fac1937acc69ab7f6d04c4`
- Branch pre-checkpoint head: `800f615fd30546eae4f03c89838e59416406c6a5`
- Ahead/behind before this docs-only checkpoint: 3/0
- Implementation diff paths: exactly 9
- PR: none for C5-C
- Production authority: V7.2
- Recovery checkpoint commit: `7a16db9abe1a3be66f90bbeb807e5f27d56b0e3d`
- Local CRM checkout/worktree: not used or modified

This checkpoint is QA RED at the diagnosis/proposal boundary. It does not authorize an implementation repair, PR, merge, deployment, live replay, observation, or Activation.


## Recovery Stage 2 Exact-Head Full Verification — 2026-08-03

- Verification authority: implementation commit `800f615fd30546eae4f03c89838e59416406c6a5`.
- Verification used a fresh GitHub API exact-SHA tarball plus a synthetic exact-`main@9dfce284903a72ba61fac1937acc69ab7f6d04c4` Git index in a disposable `/tmp` snapshot. The local CRM checkout/worktree was not used or modified.
- Recovered pre-interruption evidence:
  - focused C5-C suite: 43/43 GREEN;
  - V7.3 focused union: 72/72 GREEN;
  - four modified/added job MJS syntax checks: GREEN;
  - replay-window schema JSON parse: GREEN.
- Newly completed after recovery:
  - `npm run test:daily-v4`: GREEN;
  - `npm run verify:all`: all 16 declared tasks GREEN;
  - exact remote compare: `main...800f615f` ahead 3 / behind 0, merge base `9dfce284`;
  - exact implementation scope: 9/9 allowlisted paths;
  - denylist/no-production-data/no-workflow/no-Activation/no-observation guard: GREEN;
  - independent intent-to-add-aware `git diff --check`: GREEN across all nine paths;
  - `package-lock.json`: absent after dependency installation with `--no-package-lock`.
- Behavior manifest contains exactly 38 paths.
- Recomputed `behavior_contract_sha256 = d9f59dd6c2444b6ec3dc64fb7658b22a4ff1ab81dd285a5ab0d1fcefbb11955e`.
- No PR exists for C5-C. No merge, deployment, workflow dispatch, live provider/generator, CRM sync, production replay/data write, 15-day observation, or Activation occurred.
- Next action: fresh independent read-only exact-head QA, then stop for a separate PR decision.


## Independent Exact-Head QA — 2026-08-03

### Authority And Method

- Remote `main` was re-read through the GitHub App/API and remains exact base `9dfce284903a72ba61fac1937acc69ab7f6d04c4`.
- Remote branch `codex/pr-c-c5c-offline-replay-window` was re-read through the GitHub App/API and its handoff head was exactly `5ed655e8ed269351c7e9eb63e382a4599494a107`.
- QA authority was only implementation commit `800f615fd30546eae4f03c89838e59416406c6a5`, inspected in a fresh disposable GitHub API exact-SHA snapshot under `/tmp`; the local CRM checkout/worktree was not read, modified, or used.
- QA was read-only and adversarial. It did not repeat the already completed focused 43/43, V7.3 union 72/72, Daily V4, `verify:all`, syntax, schema-parse, diff-check, or full allowlist suites.
- Result: **P0=0 / P1=4 / P2=0**. The implementation remains blocked at diagnosis/proposal; previous GREEN verification is not independent QA closure.

### P1 Findings

1. **The replayed decision is not reconstructed from frozen evaluator/provider inputs.**
   - `buildReplayedDecisionView` derives first-pass decisions from captured `gate_results` and derives the second-pass final decision from `transaction.final_output.gate_results`; it does not consume the frozen lane `input`, `transaction.merged_final_input`, `filtered_patch`, or `raw_provider_result` to rerun the frozen evaluator.
   - Reproduction: change every first-pass input plus all second-pass provider/merged inputs while retaining captured `gate_results` and publication. Both replay hashes remained exactly `1ab528b2d4f0e8c336b12b0efc3092acae1f52fc44c635be115a1a1fcc1ba84b`, and both final decisions remained qualified/formal.
   - Impact: a self-consistent captured output can prove itself; `expected_decision_sha256 === replayed_decision_sha256` does not prove deterministic reconstruction under the frozen behavior authority.
   - Bounded proposal: make stored outputs comparison-only, reconstruct first and second pass by invoking the frozen evaluator/selector/publication logic on the captured normalized inputs and bounded patch, and add input-sensitivity REDs.

2. **Artifact and receipt identity is not end-to-end bound to the retained bytes/date.**
   - The replay interface accepts bytes only for the corpus and receipt. For report, sourcing-candidate, radar, and trends artifacts it only compares caller-supplied metadata to the identical metadata captured in the corpus; it never receives or hashes those artifact bytes.
   - Receipt bytes are hash-bound, but the receipt path/date/run identity is not semantically tied to `corpus.report_date`, `run_slot`, or `corpus_id`.
   - Reproduction: a valid `2026-08-05` corpus replayed with a fabricated report path `data/reports/1900-01-01.json`, arbitrary Git blob `9999999999999999999999999999999999999999`, arbitrary payload hash `8888888888888888888888888888888888888888888888888888888888888888`, and receipt path `data/automation_runs/1900-01-01-afternoon.json`; replay still returned `status=match` without report bytes.
   - Impact: a window entry can claim Git/payload binding without proving that the retained non-corpus artifacts or receipt identity belong to that canonical date/run.
   - Bounded proposal: require explicit bytes or a trusted Git-blob resolver for every required artifact, recompute Git blob and canonical payload hashes, and enforce canonical path/report-date/run-slot/corpus identity closure.

3. **Canonical selection does not require the corpus date to equal the requested date.**
   - `selectCanonicalReplayRun({ reportDate })` parses `snapshot.report_date` from corpus bytes but never compares it with the requested `reportDate`; `canonicalEntry` then persists the corpus date.
   - Reproduction: a validator-GREEN `2026-08-05` corpus passed a selector call for `reportDate=2026-08-04`; the selector returned `status=selected` with canonical date `2026-08-05`.
   - Impact: stale or future corpus bytes can seed the wrong Asia/Shanghai natural day, so retained-date and 15-day continuity authority is not fail-closed.
   - Bounded proposal: reject any attempt unless corpus, requested date, canonical artifact paths, receipt identity, and captured Asia/Shanghai date agree exactly.

4. **Schema/validator structural closure exists, but replay-window semantic closure is incomplete.**
   - Required fields and `additionalProperties: false` are present for the declared window envelope and nested records.
   - Both JSON Schema and `validateReplayWindow` allow an `active` window with zero retained dates; the JS validator also skips start/end-to-retained-date checks when `dates` is empty and does not require active `integrity.reason_codes` to be empty.
   - Reproduction: a sealed `active` manifest with `dates=[]`, `start_date=2026-08-04`, `end_date=2026-08-19`, and `integrity.reason_codes=["behavior_drift"]` returned `{ valid: true, errors: [] }`.
   - Impact: impossible state can be admitted as contract-valid and later cannot be advanced predictably as a 1–14-day active window.
   - Bounded proposal: require active windows to contain 1–14 consecutive dates, bind start/end to first/last retained dates in every state where dates exist, require empty active reason codes, and close failed-state failure-date/reason parity.

### Green Boundaries Preserved

- Exact implementation compare remains ahead 3 / behind 0 from base `9dfce284903a72ba61fac1937acc69ab7f6d04c4`, with exactly 9/9 allowlisted paths.
- The nine paths contain no workflow, production data, lockfile, C5-D, observation, or Activation change. The only shadow-collector implementation delta adds the offline replay/window files to behavior authority.
- V7.2 remains production authority; C5-C replay/window modules have no filesystem, network, provider, environment, clock, randomness, CRM sync, production replay, or Activation execution path.
- The behavior manifest rebuild contains exactly 38 paths. Reversing dependency input order reproduced the same hash `d9f59dd6c2444b6ec3dc64fb7658b22a4ff1ab81dd285a5ab0d1fcefbb11955e`.
- Static local-import closure from the shadow collector, offline replay, and replay-window roots found zero missing local module dependencies in the 38-path authority.
- Corpus and receipt bytes themselves are checked against recomputed Git blob/canonical payload hashes; the P1 above is the missing end-to-end closure for other artifacts and receipt identity.
- No implementation code was modified. No PR, merge, deploy, workflow dispatch, live provider/generator, CRM sync, production replay/data write, observation, or Activation occurred.

### Remaining / Next Action

Stop at diagnosis/proposal. The next task, only if separately approved, is a small TDD repair proposal covering the four P1 contracts above. After repair, run exact-head focused verification and a new independent QA before any separate PR decision.
