# PR C C5-C Offline Replay Window Recovery Checkpoint

Date: 2026-08-04 (Asia/Shanghai)
Phase: Phase 6 fresh independent exact-head QA complete — draft PR creation authorized
Status: GREEN — P0=0 / P1=0 / P2=0; draft PR only, merge not authorized
Branch: codex/c5c-gate-a-reconciliation
Current remote main observed: 4707887aa00a8ca453cebcc187e6bb6bea3f0f85
Pre-decision docs-only head: ce0036defdd2818c941c5bf624cc26ee9e96fc7f
Accepted Gate A repair RED: 2a15af5b147cfa79a1ebe24febd228278e311e48
Exact code / independent QA authority: 8307120ab50c7e91714f350cf94e17323ae0bb55

## Current Goal

Preserve exact code and independent-QA authority `8307120ab50c7e91714f350cf94e17323ae0bb55`. Fresh read-only adversarial QA closed the approved Gate A receipt-event and persisted-window contracts with P0/P1/P2 all zero. The user separately approved only a docs-only checkpoint reconciliation followed by creation of a dedicated draft C5-C PR against current `main`. PR merge, deployment, workflow dispatch/rerun, live replay/write, observation, and V7.3 Activation remain unauthorized.

## Completed

- Gate A implementation / root verification authority remains `8307120ab50c7e91714f350cf94e17323ae0bb55`; accepted RED remains `2a15af5b147cfa79a1ebe24febd228278e311e48`.
- Root verification at exact `8307120a` remains GREEN: four touched job/test syntax checks, C5-C focused 58/58, all `onlineDailyV73*.test.mjs` 100/100, Daily V4 281/281, all 16 declared `verify:all` tasks, schema parse, exact ten-path `diff --check`, allowlist/denylist guards, and no `package-lock.json`.
- Fresh independent QA used a new GitHub API exact-`8307120a` disposable snapshot and 20 new read-only adversarial probes. Result: **P0=0 / P1=0 / P2=0; 20/20 GREEN** — receipt 12/12 and persisted window 8/8.
- Receipt probes covered the three allowed event names, missing/unknown events, supported-but-mismatched events with self-consistent byte/blob/payload/corpus re-hashing, and existing date/slot/run/attempt/path identity controls.
- Persisted-window probes covered valid fast paths plus tampered complete, failed, active, same-day, and advance states. Every invalid non-null window failed closed before return without silent repair, reseal, pass-through, or input mutation.
- End-of-QA and PR-decision rechecks pinned `main=4707887aa00a8ca453cebcc187e6bb6bea3f0f85` and reconciliation head `ce0036defdd2818c941c5bf624cc26ee9e96fc7f`; `8307120a...ce0036de` changed only this checkpoint.
- The reconciliation branch was ahead 12 / behind 0 from exact current `main`, with exactly ten C5-C paths. The repair delta `2a15af5b...8307120a` remained one commit changing only the two approved job files (+19/-0).
- Open PRs remained #107 and #71. Their overlap with the ten C5-C paths was 3 and 0 respectively. #107 targets an older side branch and is historically diverged from current `main`; the dedicated C5-C PR must target `main`, disclose the three overlapping contract/schema paths, and must not modify #107 or #71.
- GitHub exposed no combined status checks or PR-triggered Actions for the pre-PR reconciliation head. PR CI/review evidence is therefore a later gate, not merge authority.
- No local CRM checkout/worktree was read or modified. No workflow dispatch/rerun, merge, deployment, live provider/generator call, CRM sync, production replay/write, observation, or Activation occurred.

## Remaining

- After this docs-only commit, confirm `main` is unchanged and `8307120a...new-head` still changes only this checkpoint beyond the exact QA authority.
- Create one dedicated **draft** C5-C PR from `codex/c5c-gate-a-reconciliation` to current `main`.
- Record the exact ten-path scope, QA evidence, #107 three-path overlap, denylist, and no-production boundary in the PR body.
- Stop immediately after PR creation. CI/review may run automatically, but no merge or downstream action is authorized in this task.

## Next Action

Create the authorized draft PR only after the docs-only and main-pin checks pass, then stop. Do not modify #107/#71; do not mark ready, merge, deploy, dispatch or rerun workflows, call live providers/generators, sync CRM, replay or write production data, start the 15-day observation window, or activate V7.3.

## Git Status

- Current remote `main`: `4707887aa00a8ca453cebcc187e6bb6bea3f0f85`
- Pre-decision docs-only branch head: `ce0036defdd2818c941c5bf624cc26ee9e96fc7f`
- Accepted RED: `2a15af5b147cfa79a1ebe24febd228278e311e48`
- Exact code / independent QA authority: `8307120ab50c7e91714f350cf94e17323ae0bb55`
- Branch relation before this checkpoint update: ahead 12 / behind 0; merge base exactly current `main`
- Branch diff: exactly ten C5-C paths, including this checkpoint
- Repair delta: one commit, two approved job paths, +19/-0
- Open PRs before draft creation: #107 and #71; C5-C overlap 3 and 0
- Commit statuses / PR-triggered Actions at the pre-PR head: none exposed
- Production authority: V7.2
- Local CRM checkout/worktree: not used or modified

This checkpoint records independent QA closure and authorization to create a draft PR only. It is not merge, deployment, workflow, production replay/write, observation, or Activation authority.

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

## PR #110 Post-Interruption Boundary Recovery — 2026-08-04

### Current Goal

Preserve the completed C5-C verification and review evidence while recovering only the interrupted PR-boundary correction. Keep PR #110 at the approved original ten paths, record the corrected exact code authority, and stop with the PR still draft. Merge, ready-for-review, deployment, workflow dispatch/rerun, live replay/write, observation, and V7.3 Activation remain unauthorized.

### Completed

- Recovery began from remote PR #110 head `7c6491f1491d2d4c1d5126a2674b5d0169361159`; the local CRM checkout/worktree was not read or modified.
- The saved pre-interruption suites were not repeated: C5-C repair 61/61, all V7.3 103/103, Daily V4 284/284, and `verify:all` 16/16 remain prior exact-head evidence.
- Remote Build #1014 for `7c6491f1` was successful, but the PR compare exposed 11 paths because `schemas/sourcing_replay_corpus.schema.json` had crossed the approved ten-path boundary.
- The bounded correction moved publication-order evidence under the existing canonical-hashed `ranking_inputs.publication_order`, retained explicit JS contract validation, and restored `schemas/sourcing_replay_corpus.schema.json` byte-for-byte to its `018af7dce0e23568088288d1cf91b803d61f59de` blob `7b96f828bead30fa97fc1c45861eae8bdb894729`.
- The correction was validated in a disposable exact-`7c6491f1` GitHub archive: touched syntax checks GREEN, impacted suites 53/53 GREEN, schema byte comparison GREEN, seven-path correction `+36/-45`, and `diff --check` GREEN.
- Corrective code authority `b32627661ea9d6f9c809d8fd113d4dc21d8c6876` is a one-parent fast-forward from `7c6491f1`. GitHub tree `a5b7f01f9970653800267dab9ef9dacad295f7fc` matched the independently rebuilt disposable tree exactly.
- Remote compare at `b3262766`: base and merge base remain `main@4707887aa00a8ca453cebcc187e6bb6bea3f0f85`, ahead 15 / behind 0, and exactly the original ten C5-C paths.
- Build #1017 completed successfully at exact `b3262766`. PR #110 remains open, draft, and mergeable with zero reviews and zero review threads.
- Open PR overlap remains bounded and disclosed: #107 overlaps three paths; #71 overlaps zero paths. Neither PR was modified.

### Remaining

- Commit this checkpoint as the only docs-only delta after exact code authority `b3262766`.
- Re-read remote `main`, PR #110 head/draft/mergeability, exact ten-path diff, Build status, reviews/threads, and open-PR overlap.
- Stop. No readiness, reviewer request, merge, deployment, workflow action, production replay/write, observation, or Activation is authorized.

### Next Action

Create one docs-only checkpoint commit with parent `b32627661ea9d6f9c809d8fd113d4dc21d8c6876`, fast-forward PR #110 only if its head is unchanged, perform the final read-only remote recheck, and stop.

### Git Status

- Current remote `main`: `4707887aa00a8ca453cebcc187e6bb6bea3f0f85`
- PR: #110, open, draft, mergeable
- Corrected exact code authority: `b32627661ea9d6f9c809d8fd113d4dc21d8c6876`
- Corrective parent: `7c6491f1491d2d4c1d5126a2674b5d0169361159`
- Exact corrected tree: `a5b7f01f9970653800267dab9ef9dacad295f7fc`
- Branch relation at code authority: ahead 15 / behind 0; merge base exactly current `main`
- Branch diff at code authority: exactly ten approved C5-C paths
- Remote CI: Build #1017 success
- Reviews / review threads: 0 / 0
- Open PR overlap: #107 = 3 paths; #71 = 0 paths
- Production authority: V7.2
- Local CRM checkout/worktree: not used or modified

This recovery checkpoint is delivery evidence for the draft PR boundary only. It is not merge, deployment, production replay/write, observation, or V7.3 Activation authority.

## Three-Day Natural-Afternoon Evidence Gate — 2026-08-09

### Current Goal

Reconcile Draft PR #110 with `main` after #111, replace the fixed fifteen-day replay window with a fail-closed three-consecutive-natural-afternoon gate, and require at least one distinct shadow-formal project before the window can complete. Keep this phase confined to C5-C replay-window code, schema, tests, and this checkpoint.

### Completed

- Re-read remote authority: `main=96afd976bbab7e713e29c8985b0a07c540167d86`; PR #111 is merged and its Build is successful.
- Re-read Draft PR #110 at old head `0b1707e7b83ddbbcffc22272a294291eb1da0fde`; it was mergeable but based on stale `main=4707887aa00a8ca453cebcc187e6bb6bea3f0f85`.
- Merged current `main` into `codex/c5c-gate-a-reconciliation` through the GitHub API. The aligned remote head is `30115ca9f77c47224b84fb98dcf3722f62a90ec7`.
- Opened a disposable exact-head API snapshot under `/tmp` for TDD. The user's dirty local CRM checkout remains untouched.
- Confirmed the old implementation still admits watchdog fallback and completes solely at fifteen retained dates without a shadow-formal reachability proof.

### Remaining

- Add RED coverage for natural-afternoon-only selection, two-day active state, three-day completion with a shadow formal, and third-day zero-shadow failure.
- Implement the three-day window contract and evidence-coverage failure semantics.
- Run focused tests, V7.3 suites, Daily V4, schema validation, `verify:all`, and remote exact-head CI.
- Update Draft PR #110 body and this checkpoint with exact verification evidence.

### Next Action

Patch tests first and run the focused replay-window suite to capture the expected RED before changing production code.

### Git Status

- Remote `main`: `96afd976bbab7e713e29c8985b0a07c540167d86`
- Draft PR: #110, branch `codex/c5c-gate-a-reconciliation`
- Aligned branch head: `30115ca9f77c47224b84fb98dcf3722f62a90ec7`
- Local CRM checkout/worktree: preserved and not modified
- Disposable TDD snapshot: `/tmp/crm-c5c-3day-aligned.MjHWJi/repo`
- Production authority: V7.2
- Explicit non-goals for this phase: workflow trigger changes, API/UI, sourcing-rule activation, Supabase schema/write semantics, manual workflow dispatch, production writes, and Activation

### Implementation And Disposable Validation

- RED captured at aligned head: the focused suite failed exactly because watchdog remained eligible, a three-day window remained active, and a third zero-shadow day did not fail.
- GREEN implementation admits only natural `schedule` + `afternoon` corpus runs into the canonical window; watchdog remains available to C5-B capture but cannot substitute for a natural acceptance day.
- Each retained date binds the distinct candidate IDs whose replayed publication has `shadow_push_pool=true`.
- Days one and two remain active. Day three completes only when the retained union contains at least one shadow-formal candidate; otherwise it fails that same day with `evidence_coverage_insufficient` and cannot keep accumulating.
- Behavior SHA drift, privacy/schema failure, artifact mismatch, offline replay mismatch, unhealthy generation/validation/receipt, or `synced!=true` remain fail-closed through the existing selector/replay contract.
- Focused replay-window suite: 9/9 GREEN.
- All V7.3 suites: 105/105 GREEN.
- Daily V4 full suite: 286/286 GREEN. The first dependency-light attempt exposed the repository's undeclared test-only `ajv` requirement; `ajv` was added only to disposable `node_modules`, and `package.json` was restored byte-for-byte before diff validation.
- `verify:all`: the first 15 declared tasks GREEN. Its final `git diff --check` cannot run inside an API tarball because no `.git` directory exists; the equivalent six-path `git diff --no-index --check` is GREEN.
- Exact disposable delta versus aligned head is six paths only: replay-window implementation, replay-corpus/window contract validator, their two focused tests, window JSON schema, and this checkpoint. No workflow, production data, API/UI, rules, package, lockfile, or Supabase path changed.

### Remote Delivery Remaining

- Create one GitHub API commit on top of unchanged remote head `30115ca9f77c47224b84fb98dcf3722f62a90ec7` and fast-forward only `codex/c5c-gate-a-reconciliation`.
- Update Draft PR #110 description from the old fifteen-day contract to this three-day evidence gate.
- Wait for exact-head Build, re-read the remote compare and PR state, then stop at the phase boundary.

### Remote Delivery Next Action

Re-read the branch head, create the six-path tree/commit only if it is still `30115ca9f77c47224b84fb98dcf3722f62a90ec7`, and let GitHub CI run on the real checkout. Do not mark the PR ready or merge it.

### Remote Delivery Result

- Six-path implementation commit: `777650ea78494758f11405f098174bdd2d735c2d`, parent `30115ca9f77c47224b84fb98dcf3722f62a90ec7`.
- Exact implementation-head push Build: [31318681392](https://github.com/Neo0109/CRM/actions/runs/31318681392), success.
- Exact implementation-head pull-request Build: [31318684329](https://github.com/Neo0109/CRM/actions/runs/31318684329), success.
- Remote compare after implementation: merge base `96afd976bbab7e713e29c8985b0a07c540167d86`, ahead 18 / behind 0, exactly the original ten C5-C paths.
- PR #110 remains open, draft, and based on current `main`; its title and description now state the three-day evidence gate.
- No merge, ready-for-review action, workflow dispatch/rerun, provider/generator call, CRM sync, production write, observation, visual acceptance, or Activation occurred.

### Phase Boundary

The bounded C5-C implementation phase is complete. Stop here. The next independently approved phase may address the privacy-safe sourcing-review API/UI queue or the formal V7.3 rule/source repair, but neither is included in #110.
