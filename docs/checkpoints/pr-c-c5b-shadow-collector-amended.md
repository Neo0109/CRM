# PR C C5-B Shadow Collector Amended Implementation

Date: 2026-08-03 (Asia/Shanghai)
Phase: Phase 4 implementation
Status: valid bounded repair RED frozen; minimal Phase 4 repair in progress
Branch: codex/pr-c-c5b-shadow-collector-amended
Exact implementation base: 1fc883e36ce8725d345061b8f8f64aef28e36bad
Accepted RED head: 4d9fddfd01b3801d5792caeb881af8c535d75cdf
Authority amendment: codex/pr-c-c5b-shadow-collector-contract-amendment
Authority amendment head: ab6e4c56c3faceac31ef3717a29ee7a46ef17fcd
Authority amendment blob: 24ceb238b50f6aa0757607cb71d0a4e7dad99982
Original proposal head: 60647b5b50ec63add8ceea6b0a32851704cf607d
Frozen failed implementation head: a8b9b45d502583d941d1038fcb57ff3de6fcd381

## Current Goal

Implement only the approved C5-B repair amendment: prove module-load isolation and behavior-manifest closure RED, apply the smallest fail-open/hash-closure repair, complete exact-head verification and independent QA, then stop before PR creation.

## Completed

- Rechecked remote `main` at `1fc883e36ce8725d345061b8f8f64aef28e36bad`.
- Rechecked the amended implementation branch at accepted RED head `4d9fddfd01b3801d5792caeb881af8c535d75cdf`.
- Confirmed the branch is ahead 1 / behind 0 from the exact implementation base.
- Confirmed the RED baseline contains the 11 exact reusable blobs plus the approved import-retarget/reference test surface; production workflows, production V7.2 rule, and production data remain unchanged at the remote head.
- Recovered the disposable GitHub exact-SHA snapshot at `/tmp/crm-c5b-amended.ZKNvih/base`; it is not the CRM checkout/worktree.
- Confirmed the interrupted snapshot contains exactly the nine expected working-path changes beyond RED: two workflows, `online_daily_v4.mjs`, the shadow candidate audit, the new shadow collector, the adapted second-pass test, the candidate-audit contract, the collector contract, and the integration contract.
- No PR, merge, deployment, workflow dispatch, live generator/provider, CRM sync, production replay, or production data write was performed.

## Remaining

- Freeze this approval/start checkpoint on the exact remote branch.
- Add and prove valid module-load and import-closure RED contracts in a disposable exact-SHA GitHub snapshot.
- Apply only the approved workflow/orchestrator/collector/contract-test repair through the GitHub App/API.
- Re-run focused, Daily V4, repository verification, allowlist/denylist, exact blob/hash, and no-lockfile guards.
- Perform a new independent exact-head read-only QA.
- Close the checkpoint if P0=0/P1=0; otherwise stop and return to Phase 2.
- Stop before PR creation, merge, deploy, workflow dispatch, live provider/generator, CRM sync, replay, C5-C, observation window, or Activation.

## Next Action

Apply only the minimal approved repair that makes the five valid RED assertions GREEN: post-output collector load isolation, workflow finalizer catch-and-warn, behavior import closure plus explicit exclusions, and closed-role/final-evidence binding. Do not change V7.2 decisions, workflow triggers, production data, or later C5 phases.

## Git Status

Remote implementation branch before this checkpoint:

- base/main: `1fc883e36ce8725d345061b8f8f64aef28e36bad`
- branch/head: `4d9fddfd01b3801d5792caeb881af8c535d75cdf`
- compare: ahead 1 / behind 0
- accepted RED changed paths: 16 added implementation/test/schema/rule paths
- production authority: V7.2
- PR: none for this branch

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
