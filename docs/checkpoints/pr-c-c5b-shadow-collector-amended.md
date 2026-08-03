# PR C C5-B Shadow Collector Amended Implementation

Date: 2026-08-03 (Asia/Shanghai)
Phase: Phase 4 review-repair implementation
Status: in progress — PR #108 P2 cluster accepted RED
Branch: codex/pr-c-c5b-shadow-collector-amended
Exact implementation base: 1fc883e36ce8725d345061b8f8f64aef28e36bad
Accepted RED head: 4d9fddfd01b3801d5792caeb881af8c535d75cdf
Authority amendment: codex/pr-c-c5b-shadow-collector-contract-amendment
Authority amendment head: ab6e4c56c3faceac31ef3717a29ee7a46ef17fcd
Authority amendment blob: 24ceb238b50f6aa0757607cb71d0a4e7dad99982
Original proposal head: 60647b5b50ec63add8ceea6b0a32851704cf607d
Frozen failed implementation head: a8b9b45d502583d941d1038fcb57ff3de6fcd381

## Current Goal

Repair only the four confirmed unresolved PR #108 findings with exact-head TDD, remote checkpointing, full bounded verification, and fresh independent QA; stop before merge, deploy, thread resolution, or any live/production action.

## Completed

- Rechecked remote `main` at `1fc883e36ce8725d345061b8f8f64aef28e36bad`.
- Rechecked the amended implementation branch at accepted RED head `4d9fddfd01b3801d5792caeb881af8c535d75cdf`.
- Confirmed the branch is ahead 1 / behind 0 from the exact implementation base.
- Confirmed the RED baseline contains the 11 exact reusable blobs plus the approved import-retarget/reference test surface; production workflows, production V7.2 rule, and production data remain unchanged at the remote head.
- Recovered the disposable GitHub exact-SHA snapshot at `/tmp/crm-c5b-amended.ZKNvih/base`; it is not the CRM checkout/worktree.
- Confirmed the interrupted snapshot contains exactly the nine expected working-path changes beyond RED: two workflows, `online_daily_v4.mjs`, the shadow candidate audit, the new shadow collector, the adapted second-pass test, the candidate-audit contract, the collector contract, and the integration contract.
- No PR, merge, deployment, workflow dispatch, live generator/provider, CRM sync, production replay, or production data write was performed.

## Remaining

- Add and close the two P2 RED contracts.
- Run the exact-head focused union, Daily V4, `verify:all`, syntax/JSON/diff/allowlist/denylist/no-lockfile guards, and behavior-manifest/hash recalculation.
- Complete a fresh independent exact-head QA with P0=0/P1=0.
- Recheck PR Actions, preview, review-thread state, and scope, then stop.

## Next Action

Implement only the minimal P2 GREEN against accepted RED `106c5e205aa9ef39c73f682a454027df870ee5ef`, then run the complete exact-head verification matrix.

## Git Status

Remote review-repair branch at this checkpoint:

- PR base/main: `8e255cded6e9063011f4da2f4c2f3f53ec3cc7e4`
- pre-repair PR head: `8bf9414929b0b0a7c6a932f142987f7ab0ca1a93`
- accepted review-repair RED: `a6ffb924958f53fe9e3a6bb409455713179315fb`
- evidence-integrity GREEN: `d4bbd00f3740c6b96a0b6ec39c04d9d5008d6ce2`
- P2 accepted RED: `106c5e205aa9ef39c73f682a454027df870ee5ef`
- PR: `#108`, open, head `codex/pr-c-c5b-shadow-collector-amended`
- scope: exactly the existing 21-path PR allowlist; this RED changes two existing test paths only
- production authority: V7.2

This checkpoint is an in-progress recovery record. It is not GREEN evidence and does not authorize or claim deployment or production activation.


## Recovery Stage 1 Evidence

- Recovery checkpoint commit: `fbfd7496d11b5f0b6f5cf6dd768e038be91fa469`.
- Budget-parity RED commit: `4d60d102bfee534c6e425bf8d6419241c5489208`.
- RED command: `node --test automations/test/onlineDailyV73ShadowCollector.test.mjs automations/test/onlineDailyV73ShadowIntegrationContract.test.mjs`.
- RED result: 10 tests, 8 passed, 2 expected failures; only the false `30/30/30` shadow budget metadata failed against PR B's actual `40/30/20` scheduler contract.
- Minimal working-snapshot correction: record `40/30/20` in the generator hook and collector defaults; no production scheduler, decision, pool, payload, workflow trigger, or sync behavior changed.
- Focused GREEN: 53/53 passed across obtainable evidence, replay corpus, second-pass, shadow candidate audit, collector, and integration contracts.
- Daily V4 GREEN: 234/234 passed after installing repository-declared dependencies in the disposable snapshot with `npm install --ignore-scripts --no-package-lock`.
- JSON parse and Node syntax checks passed for all added/modified rule, schema, job, and test files.
- No `package-lock.json` was generated.
- Full `verify:all`, exact changed-path/denylist proof, remote atomic GREEN write, behavior-hash freeze, and independent QA remain pending.


## Recovery Stage 2 Exact GREEN Evidence

- Atomic implementation GREEN commit: `9c0ef83183eb5736350aeee147e23c77cc3d0b93`.
- GREEN parent: checkpoint head `40b15e3c9e072d6a69e9c66771693761c3b586e9`.
- Atomic GREEN changed exactly four files beyond the accepted RED/checkpoint state:
  - `.github/workflows/daily-report-watchdog.yml` blob `d51998e80835998c4e1d963a85da62a62d5a18b8`
  - `.github/workflows/sync-daily-report.yml` blob `1b3ce6c724fbc28d248cdaa0d843342c2e35ba54`
  - `automations/jobs/online_daily_v4.mjs` blob `26a823c6a9b7c8010e5b0e1bd4e2209ebd6ebf15`
  - `automations/jobs/online_daily_v7_3_shadow_collector.mjs` blob `eca507996bea80c637cc65375ece561ff34b7fe3`
- New/adapted contract blobs frozen at GREEN:
  - shadow candidate audit: `1922f4f4b451dbd60c36bda8386da9febbde4c25`
  - adapted second-pass test: `a7a228b9f4dd771639e560e5fa7426066b8e3b6c`
  - shadow candidate-audit contract: `66e7b93de68416dbb8f053b7a6107fa9686f01de`
  - shadow collector contract: `4e0a12e4b8024a5e7ce91d488bd61d100179a42e`
  - shadow integration contract: `7e07ee9e1ad21b2dde4004eb48645446760ede86`
- All eleven exact-reuse blobs match the authority amendment byte-for-byte.
- Behavior dependency manifest contains 26 paths.
- Frozen `behavior_contract_sha256`: `1927376864a35386142d86288062a91b38c4aa87f259226fe599ddbf93a17537`.
- Exact `main@1fc883e36ce8725d345061b8f8f64aef28e36bad...9c0ef83183eb5736350aeee147e23c77cc3d0b93` compare: ahead 5, behind 0, exactly 21 allowlisted paths.
- Exact denylist matches main; `automations/test/onlineDailyV73ActivationReplayContract.test.mjs` remains absent on both base and GREEN.
- No production/generated data, replay corpus, package/lockfile, app/frontend/backend/functions, UI/API, Supabase, CRM sync endpoint, current sourcing-rule reader, C5-C, observation, Activation, PR D/E, or AI-editing path is present.
- Disposable exact-SHA verification:
  - JSON parse: GREEN
  - modified/added MJS syntax: GREEN
  - focused union: 53/53 GREEN
  - Daily V4: 234/234 GREEN
  - `npm run verify:all`: all 16 declared tasks GREEN after supplying an exact-main synthetic Git index for the tarball-only `git diff --check` task
  - independent `git diff --check`: GREEN
  - no `package-lock.json`
- A fresh GitHub API tarball of exact GREEN `9c0ef831...` independently repeated focused 53/53 and the same behavior hash.
- GitHub exposes no combined status checks and no PR-triggered Actions runs for exact GREEN; no CI claim is made.
- No PR exists for this branch. No PR, merge, deployment, workflow dispatch, live provider/generator, CRM sync, production replay, or production data write was performed.

## Remaining After Exact GREEN

- Complete the independent read-only exact-head QA and record P0/P1 findings.
- If QA returns P0 or P1, return to Phase 2 or the smallest approved TDD repair as required.
- If QA returns P0=0/P1=0, close this checkpoint with the final QA evidence and stop before PR creation.


## Independent QA Result — Blocking

Independent read-only QA locked to implementation GREEN `9c0ef83183eb5736350aeee147e23c77cc3d0b93`.

Result: **P0=0, P1=2. Merge/deploy and PR creation are blocked. Phase 4 is stopped and this work returns to Phase 2.**

### P1-1 — Module-load failure is outside the non-throwing boundary

- `automations/jobs/online_daily_v4.mjs` uses a top-level static import of the shadow collector.
- If the collector or any of its top-level dependencies fails to parse or load, the production generator exits before the four V7.2 writes and before `runC5BShadowCollectorSafely` can catch anything.
- Both receipt workflows dynamically import the finalizer inside the receipt IIFE whose outer catch sets `process.exitCode=1`.
- A finalizer module-load/import rejection can therefore fail the existing V7.2 receipt commit step.
- Existing integration tests assert markers and function names but do not inject collector/finalizer module-load failures.
- This violates the frozen requirement that any provider, collector, or finalizer failure cannot change V7.2 generation, report, validation, sync, receipt, or exit behavior.

### P1-2 — Behavior manifest omits approved transitive dependencies

The authority proposal's exact current-main transitive floor includes:

- `automations/jobs/online_daily_v4_enrichment_scheduler.mjs`
- `automations/jobs/online_daily_v4_steam_source.mjs`

The GREEN 26-path manifest omits both while production `online_daily_v4.mjs` imports and uses them to determine scheduled candidates, budget use, and enrichment. A future change in either path would not change `behavior_contract_sha256`, so a later observation window could fail to detect behavior drift and reset.

The current frozen hash `1927376864a35386142d86288062a91b38c4aa87f259226fe599ddbf93a17537` is therefore not acceptable as the final C5-B behavior authority.

### QA Reproduction Evidence

- Exact remote facts: `main=1fc883e36ce8725d345061b8f8f64aef28e36bad`, GREEN `9c0ef83183eb5736350aeee147e23c77cc3d0b93`.
- Current branch was checkpoint-only beyond GREEN during QA.
- Compare: ahead 5 / behind 0, exactly 21 allowlisted paths.
- Exact denylist equals main; the denied activation replay test remains absent on both.
- Eleven exact-reuse blobs remain byte-for-byte.
- No data, lockfile, app, Functions, UI/API, Supabase, CRM sync endpoint, C5-C, observation, Activation, PR D/E, or AI-editing path is present.
- JSON parse and Node syntax: GREEN.
- Focused union: 53/53 GREEN.
- Daily V4: 234/234 GREEN.
- `verify:all`: 16/16 GREEN.
- No package lockfile.
- No live provider/generator, workflow dispatch, sync, replay, deployment, PR, or merge.

### Remaining P2 Risks

- Final quality proofs are present in the evidence catalog, but the candidate gate binds only first-pass proof IDs; transaction final output does not explicitly bind final evidence IDs.
- `independentRoleForProof` defaults non-`trusted_creator` proof to `media`; a future upstream role regression could hide official/developer/publisher/keyword/unclassified evidence unless the collector explicitly preserves or rejects those roles.

## Phase 2 Repair Proposal Boundary

One bounded amendment is required before any further implementation:

1. Add RED tests that inject collector module-load failure and finalizer import/load failure and prove V7.2 writes/receipt/exit remain unchanged.
2. Move collector import plus invocation wholly inside the post-output protected boundary; no shadow module may load before all four production writes.
3. Give each workflow finalizer import plus invocation its own catch-and-warn boundary outside the receipt-fatal path.
4. Add the two missing approved transitive-floor paths to the behavior manifest.
5. Add a deterministic static test that proves every approved floor and every loaded shadow decision/capture dependency is declared, while any production-only exclusion is explicit and reviewed.
6. Address the two P2 evidence-role/binding risks in tests before deciding whether they are required for GREEN; do not silently coerce unknown roles to `media`.
7. Re-run JSON/syntax, focused union, Daily V4, `verify:all`, allowlist/denylist, exact remote blob/hash, and a new independent exact-head QA.
8. Keep the same no-PR/no-merge/no-deploy/no-dispatch/no-live-provider/no-sync/no-replay/no-C5-C/no-Activation boundary.

No Phase 4 repair is authorized by this checkpoint. The next action is explicit user approval or revision of this Phase 2 amendment.


## Phase 2 Transitive Import Closure Audit

Static recursive relative-import scanning was performed against exact GREEN `9c0ef83183eb5736350aeee147e23c77cc3d0b93`.

### Explicit proposal floor missing from the manifest

- `automations/jobs/online_daily_v4_enrichment_scheduler.mjs` — main blob `c63221f75658529607c7adfb9324065c97cad862`
- `automations/jobs/online_daily_v4_steam_source.mjs` — main blob `0cc45a9788aed679c91be97a95e90b0391d18468`

These are explicitly authoritative in the original proposal and cannot be excluded without a new Phase 2 contract decision.

### Real collector/shadow transitive closure missing from the manifest

- `automations/jobs/bilibili_evidence.mjs` — `5243ffe606734112e6b88cb24087cdb20cd0341b`
- `automations/jobs/online_daily_v4_media_rules.mjs` — `7390e7f8ddb478c732394d3908a717aef4da8344`
- `automations/jobs/online_daily_v4_network.mjs` — `50d81836e17dcb50bb5c36eb9f82eee0773efd68`
- `automations/jobs/online_daily_v4_source_health.mjs` — `9c09f003d5268b9f48c7b506e41c34a8c36a8379`
- `automations/jobs/sourcing_v6_3_quality.mjs` — `0e890ee2009472e9cec897791d78b86907e987da`

Under the existing wording requiring every loaded transitive decision/capture dependency, all five belong in the behavior manifest unless a separately approved contract explicitly narrows the definition.

### Production-root-only missing local imports

- `automations/jobs/online_daily_v4_candidate_audit.mjs` — `f6e4403f937eaec60e935c01ea37bd8eeacd40d2`
- `automations/jobs/online_daily_v4_decision.mjs` — `b326be1cb67b36985616ec54a489d30ec958a8c3`
- `automations/jobs/online_daily_v4_media_enrichment.mjs` — `4de18e9d5e62076cf32b1240f8c24251ce8bca9a`
- `automations/jobs/online_daily_v4_media_entities.mjs` — `254daa3b8e2d0802626bdf9872070ad338de2818`
- `automations/jobs/online_daily_v4_reports.mjs` — `2d78c1d1605fd5ad6a89e68a85e5c2b20fa3d7e1`
- `automations/jobs/online_daily_v4_volume.mjs` — `0c6168917876cc52bd08e8cf960f3ccb9f2e590b`

Candidate-audit, reports, and volume may be proposed as explicit production-output/diagnostic exclusions. They may not be omitted silently.

Decision, media-enrichment, and media-entities are not safely classified as output-only:

- production decision exports `scoreCandidate`, which influences Steam scoring, shadow ranking, and second-pass selection;
- media-enrichment and media-entities shape the media universe, evidence, and identity passed into the shadow collector.

The Phase 2 amendment must either include these behavior-affecting paths in the hash or explicitly justify and approve a narrower upstream-universe contract plus its observation-window risk. The default recommended repair is to include them and add an executable import-closure/floor contract so future dependency changes cannot silently escape the behavior hash.


## Phase 3 Approval and Phase 4 Repair Start — 2026-08-03

- User explicitly approved: `批准 C5-B Phase 2 repair amendment，并授权 Phase 4 按上述边界实施`.
- Approval re-pin:
  - remote `main`: `1fc883e36ce8725d345061b8f8f64aef28e36bad` (identical)
  - pre-start branch head: `6564da55f2dd801f1451bc696592c9c2ae205723` (identical)
  - pre-start checkpoint blob: `10f291a9e4edd8a82ffd87738bc51826680ef1a3`
  - compare: ahead 8 / behind 0 / exactly 21 allowlisted paths
  - open PRs: C5-A #107 and unrelated #71; no PR for this branch
- Authorized repair:
  - collector import plus invocation wholly inside the post-output protected boundary;
  - each workflow finalizer import plus call inside its own catch-and-warn boundary;
  - executable approved-floor/import-closure contract and explicit reviewed exclusions;
  - P2 final-evidence binding and closed independent-role tests without relaxing quality rules;
  - exact-head focused/full verification and a new independent QA.
- Still forbidden: PR creation, merge, deploy, workflow dispatch, live provider/generator, CRM sync, production replay/data write, C5-C, 15-day observation, and Activation.
- No implementation file changed in this checkpoint-only stage.


## Repair Stage 1 Valid RED Evidence — 2026-08-03

- Exact RED parent: `253bfaa5412dedcc6a842ed3b8ac89396b5c16e6`.
- RED changes are limited to:
  - `automations/test/onlineDailyV73ShadowIntegrationContract.test.mjs`
  - `automations/test/onlineDailyV73ShadowCollector.test.mjs`
  - this checkpoint
- RED command: `node --test automations/test/onlineDailyV73ShadowIntegrationContract.test.mjs automations/test/onlineDailyV73ShadowCollector.test.mjs`.
- RED result: 14 tests, 9 passed, 5 expected failures.
- Expected failures:
  1. collector module-load syntax failure exits before the simulated four production writes;
  2. sync finalizer module-load failure reaches the receipt-fatal catch and exits nonzero;
  3. watchdog finalizer has the same failure;
  4. behavior manifest lacks the approved/imported closure and explicit exclusions;
  5. final evidence IDs are unbound and official/unknown roles are coerced to `media`.
- Node syntax checks for both RED test files: GREEN.
- No production implementation, workflow trigger, data, lockfile, PR, merge, deploy, dispatch, live provider/generator, sync, replay, C5-C, observation, or Activation changed in the RED stage.
- Next action: atomic minimal implementation repair against this RED, then focused GREEN.


## Repair Stage 2 Focused GREEN Evidence — 2026-08-03

- Exact accepted repair RED parent: `a675df38d923816c81ab7e5e4bc9545e9e1a4eb7`.
- Minimal implementation changes exactly four paths:
  - `.github/workflows/daily-report-watchdog.yml`
  - `.github/workflows/sync-daily-report.yml`
  - `automations/jobs/online_daily_v4.mjs`
  - `automations/jobs/online_daily_v7_3_shadow_collector.mjs`
- Collector static import was removed; dynamic import plus invocation now execute together inside the post-output protected boundary after all four production writes.
- Each workflow finalizer import plus invocation now has its own catch-and-warn boundary after the receipt write and before the existing receipt-fatal catch.
- Behavior authority now declares the approved/imported closure and the three explicit production-output/diagnostic exclusions.
- Final transaction output binds final independent evidence IDs; explicit official/developer/publisher/keyword/unclassified roles are preserved and unknown roles remain unclassified.
- Focused repair tests: 14/14 GREEN.
- Full C5-B focused union: 57/57 GREEN.
- Modified MJS and RED-test Node syntax: GREEN.
- Full exact-head Daily V4, verify:all, allowlist/denylist, behavior hash, and independent QA remain pending.
- No production data, lockfile, PR, merge, deploy, dispatch, live provider/generator, sync, replay, C5-C, observation, or Activation.


## Repair Stage 3 Exact-Head Full Verification — 2026-08-03

- Atomic repair implementation commit: `4b33610a6c2973a7641fc1d52a70119f6f0b9c9d`.
- Exact parent/RED: `a675df38d923816c81ab7e5e4bc9545e9e1a4eb7`.
- Implementation commit changed the four approved implementation paths plus this checkpoint only.
- Frozen implementation blobs:
  - watchdog workflow: `78ce71384fb2fd8b687da1176d6c0e851e1c1bfe`
  - sync workflow: `be328e9737b51088beab5eb7e3600cffdf8418fa`
  - production orchestrator: `878697499f1649069e5d559208a8a99987744b01`
  - shadow collector: `8b6f4bcfca9dd88cd3e869f6621aa00ed960b3f0`
  - integration RED/GREEN contract: `d04602a2d4d4e040d1d4a1ef1bffce6193d401a0`
  - collector RED/GREEN contract: `3a70dbe546d0ef693a5810b3e1743154ca31aca7`
- Exact GitHub API snapshot verification:
  - JSON parse: GREEN
  - 14 relevant MJS syntax checks: GREEN
  - focused union: 57/57 GREEN
  - Daily V4: 238/238 GREEN
  - `npm run verify:all`: all 16 tasks GREEN
  - independent `git diff --check`: GREEN
  - exact-main changed-path proof: 21/21 allowlisted paths
  - denylist blobs unchanged; Activation replay test absent on base and implementation
  - no `package-lock.json`
- Behavior manifest: 36 paths.
- Frozen `behavior_contract_sha256`: `0d2e9199de728a75750f0e4cd64571ab3859e5189ff734eea8d2c49c870aeaab`.
- GitHub exposes no combined statuses and no PR-triggered workflow runs for exact implementation; no CI claim is made.
- No PR exists for this branch.
- No production data write, merge, deploy, dispatch, live provider/generator, CRM sync, replay, C5-C, observation, or Activation occurred.


## Repair Stage 4 Fresh Exact-Head QA and Closure — 2026-08-03

- QA authority: implementation commit `4b33610a6c2973a7641fc1d52a70119f6f0b9c9d`, not later checkpoint-only commits.
- QA used a second fresh GitHub API exact-SHA snapshot.
- Result: **P0=0, P1=0.**
- Former P1-1 closed:
  - no top-level static shadow-collector import remains in `online_daily_v4.mjs`;
  - injected collector syntax/load failure leaves all four simulated production writes complete and exits zero;
  - injected finalizer syntax/load failure leaves both sync/watchdog receipts unchanged and exits zero;
  - exact patch review confirms both workflow finalizer imports/calls are nested in their own catch-and-warn boundary before the receipt-fatal catch.
- Former P1-2 closed:
  - executable recursive import-closure/floor contract passes;
  - behavior manifest contains 36 declared paths;
  - candidate-audit, reports, and volume are the exact three explicit production-only exclusions;
  - collector closure contains no excluded dependency;
  - fresh behavior hash reproduces `0d2e9199de728a75750f0e4cd64571ab3859e5189ff734eea8d2c49c870aeaab`.
- P2 closure:
  - final transaction output directly binds final independent evidence IDs;
  - explicit official/developer/publisher/keyword/unclassified roles are preserved;
  - unknown roles remain `unclassified`;
  - only `media` and `trusted_creator` occupy independent-quality evidence IDs.
- Fresh QA focused union: 57/57 GREEN.
- Fresh QA syntax/no-static-import/no-lockfile guards: GREEN.
- Branch after implementation contained only checkpoint documentation beyond the implementation SHA.
- Overall scope remains exactly 21 allowlisted paths; denylist and production V7.2 authority remain unchanged.
- No PR exists for this branch. GitHub exposes no combined status or PR-triggered workflow runs for the implementation SHA; no CI claim is made.
- No PR, merge, deploy, workflow dispatch, live provider/generator, CRM sync, production replay/data write, C5-C, observation, or Activation occurred.


## PR #108 Review Repair Stage 1 — Evidence-Integrity RED — 2026-08-03

- Remote freeze before write:
  - `main = 8e255cded6e9063011f4da2f4c2f3f53ec3cc7e4`
  - PR #108 open/base `main`/head `8bf9414929b0b0a7c6a932f142987f7ab0ca1a93`
  - checkpoint blob `f5597a01f4487ff962ec60c51d2c064829d23f1b`
  - Build run `30782720394` completed/success
  - exactly 21 allowlisted changed paths; no production/generated data or lockfile
  - all four confirmed review threads unresolved and non-outdated
- Accepted RED commit: `a6ffb924958f53fe9e3a6bb409455713179315fb`.
- RED changed only:
  - `automations/test/onlineDailyV73ShadowCollector.test.mjs`
  - `automations/test/onlineDailyV73ReplayCorpusContract.test.mjs`
- RED contract 1 uses the real fixture provider with an ordinary non-Bilibili media signal that has no `source_role`; qualification must preserve an explicit `media` proof and bind two final evidence IDs (`media` plus `trusted_creator`).
- RED contract 2 rejects a qualified `final_output` when evidence IDs are missing, empty, unknown, role-ineligible, or represent fewer than two distinct eligible `source_id` values.
- RED command: `node --test automations/test/onlineDailyV73ShadowCollector.test.mjs automations/test/onlineDailyV73ReplayCorpusContract.test.mjs`.
- RED result: 32 tests, 30 passed, 2 expected failures; one producer-role/binding failure and one validator final-reference failure.
- No implementation, schema, workflow, production V7.2, data, or lockfile path changed. No review reply/resolution, merge, deploy, dispatch, live provider/generator, CRM sync, replay, C5-C, observation, or Activation occurred.
- Next action: minimal producer role propagation plus final transaction evidence semantic validation; keep unknown proof roles unclassified.


## PR #108 Review Repair Stage 2 — Evidence-Integrity GREEN — 2026-08-03

- Accepted RED: `a6ffb924958f53fe9e3a6bb409455713179315fb`; RED checkpoint head: `b28770814befe4f2b5d79790cf8be69666aef661`.
- Minimal implementation commit: `d4bbd00f3740c6b96a0b6ec39c04d9d5008d6ce2`.
- Implementation changed exactly:
  - `automations/jobs/online_daily_v7_3_second_pass_orchestrator.mjs`
  - `automations/jobs/online_daily_v7_3_replay_corpus_contract.mjs`
- Producer behavior: generated independent-quality proofs now carry the provider's normalized `media` or `trusted_creator` role; ordinary non-Bilibili media signals classify as `media`.
- Collector behavior remains closed: arbitrary proof roles are not coerced; unknown remains `unclassified`; only `media` and `trusted_creator` bind final independent evidence IDs.
- Validator behavior: every qualified final output must reference evidence in the catalog, use only eligible independent roles, and provide at least two distinct eligible `source_id` values.
- Syntax: both modified jobs GREEN.
- Focused cluster command: `node --test automations/test/onlineDailyV73ShadowCollector.test.mjs automations/test/onlineDailyV73ReplayCorpusContract.test.mjs`.
- Focused cluster result: 32/32 GREEN.
- No schema, workflow, production V7.2, generated data, or lockfile change. No review reply/resolution, merge, deploy, dispatch, live provider/generator, CRM sync, replay, C5-C, observation, or Activation.
- Next action: P2 RED for zero official lookup on quality-only requests and Steam app-ID-only publication matching when an app ID is known.


## PR #108 Review Repair Stage 3 — P2 RED — 2026-08-03

- P2 RED parent/checkpoint: `903bdd289c4baf8f4745a7ada92543fdca58502c`.
- Accepted P2 RED commit: `106c5e205aa9ef39c73f682a454027df870ee5ef`.
- RED changed only:
  - `automations/test/onlineDailyV73SecondPassOrchestrator.test.mjs`
  - `automations/test/onlineDailyV73ShadowCollector.test.mjs`
- Quality-only contract: `fetch_independent_quality_evidence` must make zero official Bilibili lookups; an official stub that throws cannot suppress the locally available media quality patch.
- Publication contract: with the same project title but different known Steam app IDs, only the actually published app may set `shadow_push_pool=true` or receive a shadow lead payload hash.
- RED command: `node --test automations/test/onlineDailyV73SecondPassOrchestrator.test.mjs automations/test/onlineDailyV73ShadowCollector.test.mjs`.
- RED result: 17 tests, 15 passed, 2 expected failures; the official lookup was called and the same-title different-app candidate falsely matched the push pool.
- No implementation, schema, workflow, production V7.2, generated data, or lockfile path changed. No review reply/resolution, merge, deploy, dispatch, live provider/generator, CRM sync, replay, C5-C, observation, or Activation.
- Next action: gate official lookup to actions that consume official signals and use project fallback only when `entry.steamAppId` is absent.
