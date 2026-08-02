# PR C C5-B Shadow Collector Amended Implementation

Date: 2026-08-03 (Asia/Shanghai)
Phase: Phase 4 implementation
Status: in progress — focused and Daily V4 GREEN; full verification pending
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
