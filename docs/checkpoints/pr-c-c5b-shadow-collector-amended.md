# PR C C5-B Shadow Collector Amended Implementation

Date: 2026-08-03 (Asia/Shanghai)
Phase: Phase 4 implementation
Status: in progress — exact GREEN frozen; independent QA pending
Branch: codex/pr-c-c5b-shadow-collector-amended
Exact implementation base: 1fc883e36ce8725d345061b8f8f64aef28e36bad
Accepted RED head: 4d9fddfd01b3801d5792caeb881af8c535d75cdf
Authority amendment: codex/pr-c-c5b-shadow-collector-contract-amendment
Authority amendment head: ab6e4c56c3faceac31ef3717a29ee7a46ef17fcd
Authority amendment blob: 24ceb238b50f6aa0757607cb71d0a4e7dad99982
Original proposal head: 60647b5b50ec63add8ceea6b0a32851704cf607d
Frozen failed implementation head: a8b9b45d502583d941d1038fcb57ff3de6fcd381

## Current Goal

Complete only the approved C5-B shadow-only implementation from the accepted RED head, reach the bounded GREEN and repository verification gates, freeze exact evidence in this checkpoint, then stop before PR creation.

## Completed

- Rechecked remote `main` at `1fc883e36ce8725d345061b8f8f64aef28e36bad`.
- Rechecked the amended implementation branch at accepted RED head `4d9fddfd01b3801d5792caeb881af8c535d75cdf`.
- Confirmed the branch is ahead 1 / behind 0 from the exact implementation base.
- Confirmed the RED baseline contains the 11 exact reusable blobs plus the approved import-retarget/reference test surface; production workflows, production V7.2 rule, and production data remain unchanged at the remote head.
- Recovered the disposable GitHub exact-SHA snapshot at `/tmp/crm-c5b-amended.ZKNvih/base`; it is not the CRM checkout/worktree.
- Confirmed the interrupted snapshot contains exactly the nine expected working-path changes beyond RED: two workflows, `online_daily_v4.mjs`, the shadow candidate audit, the new shadow collector, the adapted second-pass test, the candidate-audit contract, the collector contract, and the integration contract.
- No PR, merge, deployment, workflow dispatch, live generator/provider, CRM sync, production replay, or production data write was performed.

## Remaining

- Re-read the amendment and original proposal acceptance gates from their exact remote blobs.
- Prove the disposable snapshot is rooted in the accepted RED head and audit the nine recovered changes against the 21-path allowlist and denylist.
- Run the focused RED-to-GREEN contracts and repair only approved C5-B failures.
- Run JSON parse, Node syntax, focused union, Daily V4, `verify:all`, workflow/static guards, privacy/network sentinels, and diff checks.
- Write the implementation files atomically through the GitHub Git Data API.
- Freeze the exact GREEN head, new/adapted blob SHAs, behavior hash, verification evidence, and changed-path proof in this checkpoint.
- Perform the required independent exact-head read-only QA handoff.
- Stop before PR creation, merge, deployment, workflow dispatch, live provider/generator, CRM sync, replay, C5-C, observation window, or Activation.

## Next Action

Audit the recovered nine-file snapshot against the accepted RED branch and run the focused fixture-only contracts. If any stop condition is encountered, return to Phase 2 without advancing implementation.

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
