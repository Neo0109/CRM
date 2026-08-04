# PR C C5-C Offline Replay Window Recovery Checkpoint

Date: 2026-08-04 (Asia/Shanghai)
Phase: Phase 4 bounded implementation and root verification complete
Status: GREEN at root verification; fresh independent exact-head QA still required
Branch: codex/c5c-gate-a-reconciliation
Current remote main observed: 4707887aa00a8ca453cebcc187e6bb6bea3f0f85
Opening docs-only head: 5c38c9a5555f4f187e6a923e299f21c4453dfd45
Accepted Gate A repair RED: 2a15af5b147cfa79a1ebe24febd228278e311e48
Gate A implementation / root-verification authority: 8307120ab50c7e91714f350cf94e17323ae0bb55

## Current Goal

Preserve accepted RED `2a15af5b147cfa79a1ebe24febd228278e311e48` and implementation/root-verification authority `8307120ab50c7e91714f350cf94e17323ae0bb55`. The two approved Gate A P1 contracts are GREEN under root verification. Stop before independent QA and do not interpret root GREEN as independent QA closure or PR authorization.

## Completed

- Opening GitHub App/API gate re-pinned `main=4707887aa00a8ca453cebcc187e6bb6bea3f0f85`, reconciliation head `5c38c9a5555f4f187e6a923e299f21c4453dfd45`, and Gate A code/QA authority `7b8b1ad9b9efd94796e3c2b57faa2b265520f117`. The one authority-to-head commit changed only this checkpoint.
- The branch was ahead 9 / behind 0 at opening with the known ten paths. Open PRs remained #107 and #71; neither overlapped the five repair allowlist paths.
- Accepted RED `2a15af5b147cfa79a1ebe24febd228278e311e48` changed only the two approved tests. The focused adversarial run was 21/23 GREEN with exactly two expected RED failures: self-consistent receipt/corpus event mismatch and invalid completed persisted window accepted by the fast path.
- Minimal GREEN `8307120ab50c7e91714f350cf94e17323ae0bb55` changed only the two approved jobs: supported receipt events must exist and equal `corpus.event_name`; every non-null persisted replay window is validated before complete, failed, active, or same-day fast paths.
- Fresh GitHub API exact-`8307120a` snapshot narrow checks: four touched job/test syntax checks GREEN; C5-C focused suite 58/58 GREEN; all `onlineDailyV73*.test.mjs` 100/100 GREEN.
- Root full verification ran once at exact `8307120a`: the first 15 declared tasks were GREEN, including Daily V4 281/281, typechecks, contract checks, and build. The final diff-check initially stopped only because the disposable no-index shim did not map branch-added files to `/dev/null`; after that harness-only correction, the final exact main-to-head ten-path `git diff --check` was GREEN without rerunning the first 15 tasks. All 16 declared task commands are GREEN.
- Exact remote post-verification compare: `main...8307120a` ahead 11 / behind 0, merge base `4707887a`, exactly the existing ten paths. The repair delta `5c38c9a...8307120a` is two commits and exactly four allowlisted paths; workflow, schema, rules, `data/**`, Daily V4, shadow collector, API/UI/Supabase, package/lockfile, observation, and Activation denylist remained untouched.
- `package-lock.json` is absent. GitHub exposes no combined status checks and no PR-triggered Actions run for `8307120a`.
- The local CRM checkout/worktree was not read or modified. No PR was created or modified; no workflow dispatch/rerun, merge, deployment, live provider/generator, CRM sync, production replay/write, observation, or Activation occurred.

## Remaining

- Run a fresh independent read-only adversarial QA task against exact code/QA authority `8307120ab50c7e91714f350cf94e17323ae0bb55`.
- Only if that independent QA closes P0/P1/P2 should a later, separate task enter the PR decision gate.
- PR creation or modification, merge, deployment, workflow dispatch/rerun, production replay/write, observation, and Activation remain out of scope.

## Next Action

Stop at Phase 4 implementation plus root verification complete. The next action is another task's fresh independent exact-head QA at `8307120ab50c7e91714f350cf94e17323ae0bb55`; after that, and only if independently GREEN, use a separate PR decision gate. Do not create or modify a PR, merge, deploy, dispatch workflows, call live providers/generators, sync, replay production data, start observation, or activate V7.3.

## Git Status

- Current remote `main`: `4707887aa00a8ca453cebcc187e6bb6bea3f0f85`
- Opening docs-only head: `5c38c9a5555f4f187e6a923e299f21c4453dfd45`
- Accepted RED: `2a15af5b147cfa79a1ebe24febd228278e311e48`
- Implementation / root-verification authority: `8307120ab50c7e91714f350cf94e17323ae0bb55`
- Branch relation before this docs-only checkpoint: ahead 11 / behind 0; merge base exactly current `main`
- Branch diff paths before this docs-only checkpoint: exactly the existing ten paths, including this checkpoint
- Approved repair delta: two commits, four paths, `5c38c9a...8307120a`
- C5-C PR: none; open PRs remain #107 and #71 with no repair-allowlist overlap
- Commit statuses / PR-triggered Actions at implementation authority: none exposed
- Production authority: V7.2
- Local CRM checkout/worktree: not used or modified

This checkpoint records implementation and root verification only. It is not independent QA and does not authorize a PR, merge, deployment, live replay, observation, or Activation.

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


## Fresh Independent Exact-Head QA Of Repair — 2026-08-03

### Authority And Method

- QA authority: `a972963f27c61e88994ba0168c5140720eab011c`.
- Accepted repair RED: `8d1ed37777ca85cb92f9f8faf2e13d0d9eba1d11`.
- Remote frozen merge base: `9dfce284903a72ba61fac1937acc69ab7f6d04c4`.
- Current remote `main`: `e27c86e6b4901e19ad20e226e851a4424dfe2577`; the intervening five changed paths are dated `data/` artifacts only.
- QA used a fresh disposable GitHub API exact-SHA snapshot under `/tmp`. The local CRM checkout/worktree was not read or modified.
- Existing verification suites were not repeated. Four new adversarial probes targeted only gaps not asserted by the accepted RED.
- Result: **P0=0 / P1=4 / P2=0**.

### P1 Findings

1. **Receipt workflow-run identity remains unbound.**
   - `verifyArtifactIdentity` closes canonical paths, report date, corpus ID, captured Shanghai date, and receipt slot, but never compares the receipt's `run_id` or run attempt with `corpus.workflow_run_id` and `corpus.run_attempt`.
   - Reproduction: replace the re-hashed, byte-bound receipt with `run_id="999999"` and `run_attempt=99` while the corpus remains run `9100/1`; replay still returns `status=match`.
   - Impact: a successful receipt from another workflow run can be made self-consistent at the byte/hash layer and admitted into the canonical day.
   - Bounded repair direction: require and normalize receipt run identity, then bind it to corpus ID, workflow run ID, run attempt, date, and slot.

2. **The frozen provider-result-to-patch selector is not replayed.**
   - `buildReplayedDecisionView` consumes `filtered_patch` and `merged_final_input` but ignores `raw_provider_result`; the validator only type-checks the raw result.
   - Reproduction: replace `raw_provider_result.official_gameplay_evidence` with an empty list while retaining the captured filtered patch. The replay hash stays exactly `d669cbd507b8b61aefb767921789e019d3eb7f6646edfdf9251d6746c30151fe`.
   - Impact: a self-consistent filtered patch can prove itself without demonstrating that the frozen allowlist selector would derive it from the retained provider result.
   - Bounded repair direction: replay the frozen privacy/allowlist selector over the retained normalized provider result and compare the derived patch byte-for-byte/canonically before merging.

3. **Offline bounded-list merge semantics differ from production.**
   - Production `mergeEvidenceList` deduplicates by normalized `source_id`, then URL, then `type:value`; offline `mergeBoundedInput` deduplicates by canonical JSON of the full object.
   - Reproduction: a production-valid quality patch containing a changed record for an existing `source_id` plus a second independent source retains the original and the new source in production, but exact-head replay adds both same-source records and throws `REPLAY_INPUT_MISMATCH`.
   - Impact: a legitimate captured transaction can be unreplayable even when provider selection and the retained merged input are correct.
   - Bounded repair direction: reuse one exported frozen merge helper or reproduce its exact evidence-key semantics under a contract test.

4. **Publication replay does not reproduce production dedupe and precedence.**
   - Production `buildPools` applies media-first selection and `poolLeadKey`, including the 6-24 Han-character loose key; replay uses corpus order plus `steam_app_id` or lower-cased project text.
   - Reproduction: two qualified media projects with the same Han character set in different order produce one production push Lead, preserving media input order, while replay marks both candidates as `shadow_push_pool=true`.
   - Impact: valid captured publication can fail replay, and replay can reconstruct a formal pool different from the frozen shadow publication authority.
   - Bounded repair direction: retain sufficient publication-order/key inputs in the corpus and invoke or exactly mirror the frozen pool selector/dedupe function.

### Green Boundaries Preserved

- Requested-date equality, explicit non-corpus artifact bytes/hash verification, and active/failed replay-window state closure were inspected; this QA found no additional P1 in those repaired boundaries.
- The repair delta remains one commit across five paths. The branch remains confined to the C5-C offline replay/window scope plus its checkpoint.
- V7.2 remains production authority. No live run, production write, observation, or Activation occurred.

### Remaining / Next Action

Stop at diagnosis/proposal. The next task, only if separately approved, is a new bounded TDD repair proposal for the four P1 findings above. After repair, run exact-head focused verification and another independent QA before any separate PR decision.

## Gate A Reconciliation And Minimal Fixture Compatibility — 2026-08-04

### Authority And Approved Scope

- Reconciliation branch: `codex/c5c-gate-a-reconciliation`.
- Frozen merge base: `9dfce284903a72ba61fac1937acc69ab7f6d04c4`.
- Opening remote `main`: `4707887aa00a8ca453cebcc187e6bb6bea3f0f85`.
- Reconciliation commit: `7d4ee87e4072432dfafab5b7c60a98f557acb7cf`.
- Accepted adversarial RED: `10a20d26a2f33a0501d0769a8df8de128c7a6db6` — the original 9 focused tests remained GREEN and 5 new adversarial tests were RED, covering the four P1 findings with raw-selector allowlist and privacy boundaries separated.
- Gate A implementation: `e373dc4c4d1289fe265a03be922a89a567e010f2`.
- Raw-authority mutation alignment: `c50ae24f3bc62183fca3e5ce81c3e76d9825c521`.
- Minimal fixture-compatibility GREEN authority: `df3eabd94fd995f904d5a28efe0d289688b659fa`.
- The only newly approved compatibility delta is in `attempt()` in `automations/test/onlineDailyV73ReplayWindow.test.mjs`: `run_id: String(workflowRunId)` and `run_attempt: runAttempt`. The exact commit delta is one path, +2/-0.
- Saved code/QA authority `a972963f27c61e88994ba0168c5140720eab011c`, saved docs authority and old-branch head `385fabd33f7abb3ae491f19821572af7b7cc1e7e`, and old branch `codex/pr-c-c5c-offline-replay-window` remain unchanged.

### Exact-Head GREEN Evidence At `df3eabd94fd995f904d5a28efe0d289688b659fa`

- Relevant job/test `node --check`: GREEN for all eight main-to-head job/test paths.
- C5-C focused suite: 56/56 GREEN.
- All `onlineDailyV73*.test.mjs`: 98/98 GREEN.
- `npm run test:daily-v4`: 279/279 GREEN after installing declared dependencies into the disposable tarball with `--ignore-scripts --no-package-lock`; the first dependency-free attempt stopped only because `ajv` was absent.
- `npm run verify:all`: all 16 declared tasks GREEN. Because an API tarball intentionally has no `.git`, a temporary projectless git shim routed only the final `git diff --check` task to the frozen `main@4707887...df3eabd9` ten-path no-index whitespace check; the other 15 tasks ran unchanged.
- `schemas/sourcing_replay_window.schema.json`: JSON parse GREEN.
- Main-to-head compare: ahead 6 / behind 0, merge base exactly `4707887aa00a8ca453cebcc187e6bb6bea3f0f85`, and exactly the approved 10 paths.
- Workflow, production-data, Daily V4, rules, API, UI, Supabase, package, lockfile, observation, and Activation denylist: GREEN.
- `package-lock.json`: absent.
- Behavior manifest: exactly 38 paths, asserted by the GREEN shadow-integration contract.

### Production Fact Boundary

- Remote morning receipt `data/automation_runs/2026-08-04-morning.json` remains `status=success`, encoded `sync_response` parses to `synced=true`, `run_id="30878679661"`, and `run_attempt=1`.
- Target corpus `data/sourcing_replay_corpus/2026-08-04/30878679661-1-morning.json` remains absent on `main` with GitHub API 404.
- Workflow run `30878679661`, job `91895191085`, remains successful while its log records the isolated pending-core failure exactly as `ENOENT` for `data/runtime/2026-08-04-c5b-shadow-30878679661-1-morning.json`. No corpus success is claimed or manufactured.

### Stop Boundary

- V7.2 remains production authority.
- No PR was created or modified; open PRs remained only #107 and #71 at the opening recheck.
- No PR merge, workflow dispatch/rerun, deployment, live provider/generator call, CRM sync, production replay/write, visual acceptance, 15-day observation, or V7.3 Activation occurred.
- After the docs-only checkpoint, perform final exact-head validation/guards and fresh independent read-only adversarial QA, then stop at a separate PR decision gate.

### Fresh Independent Gate A Exact-Head QA

- QA authority: `7b8b1ad9b9efd94796e3c2b57faa2b265520f117`.
- Fresh remote recheck: `main=4707887aa00a8ca453cebcc187e6bb6bea3f0f85`; reconciliation branch exact at the QA authority; ahead 8 / behind 0 with the same exact 10 paths and no new code/schema/test overlap.
- Method: independent GitHub App/API recheck, fresh GitHub API exact-SHA tarball, production-parity code review, and new read-only adversarial probes. The local CRM checkout/worktree was not read or modified.
- Result: **P0=0 / P1=0 / P2=0**.
- Receipt/corpus identity: corpus ID, report date, slot, workflow run ID, numeric run attempt, Shanghai captured date, and canonical artifact paths fail closed. Canonical decimal receipt run IDs must equal the corpus run ID; receipt run attempts must be positive safe integers and equal the corpus attempt.
- Raw selector/privacy: raw output is privacy-normalized and validated before action-derived allowlist filtering and canonical stored-patch comparison. Unauthorized raw fields cannot widen the patch; stored-patch overreach, secrets, and privacy-normalization mismatches are rejected.
- Bounded merge: normalized source ID, then URL, then `type:value` parity and base-first retention match production. All three duplicate-key probes preserve base, append only unique incoming evidence, and reject forged incoming replacement.
- Publication replay: media-first order, Steam app key, project fallback, and the 6–24 Han sorted loose key match production. Probes confirm Han lengths 6 and 24 dedupe while 5 and 25 do not, with media precedence preserved.
- Fixture expansion from `c50ae24f3bc62183fca3e5ce81c3e76d9825c521` remains exactly the two approved `attempt()` receipt fields. Independent focused probes were 21/21 GREEN: offline replay 14/14 plus selector/window 7/7.
- No file or remote state was changed by QA. No PR/workflow/deployment/replay/write/observation/Activation action occurred, and no success is claimed for the absent 2026-08-04 corpus.
- Gate A may stop at the PR decision gate; PR creation or modification still requires separate approval.
