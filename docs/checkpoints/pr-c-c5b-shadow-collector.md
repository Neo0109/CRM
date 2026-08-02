# PR C C5-B Shadow Collector Implementation Checkpoint

Date: 2026-08-02
Phase: RC-C5B-IMPL — Phase 4
Status: implementation branch opened; start gates GREEN; RED not yet committed
Release Captain: this task
Branch: `codex/pr-c-c5b-shadow-collector`
Exact base: `1fc883e36ce8725d345061b8f8f64aef28e36bad`

## Authority and Scope

The complete implementation contract is `docs/checkpoints/pr-c-c5b-shadow-collector-proposal.md` from `codex/pr-c-c5b-shadow-collector-proposal@60647b5b50ec63add8ceea6b0a32851704cf607d`, blob `59b5f399aba749086f37c1f41ed1a24033fb4447`.

This branch is limited to the proposal's exact 21-path allowlist, Exact Denylist, data flow, privacy boundary, RED-to-GREEN gates, verification gates, Definition of Done, rollback, stop conditions, and independent-QA boundary.

No PR, merge, deployment, workflow dispatch, live generator/provider, CRM sync, production replay, C5-C, observation window, PR D/E, or V7.3 activation is authorized.

## Fresh Remote Start Gates

- Remote `main`: `1fc883e36ce8725d345061b8f8f64aef28e36bad`.
- Frozen baseline comparison: `3928de8472ffb15b609acc138c9340329234e686..main` is ahead 16, behind 0; all 20 changed paths are dated production data only.
- Frozen behavior source: `codex/pr-c-int-c5a-rehome@0dc5627f97106bd0e54ff4bff57648f6fb4c2606`.
- Final QA: `codex/pr-c-final-qa-checkpoint@d74ee4b69bb3d71f1a8dbd9e1038b73cc3765b3b`; checkpoint blob `46625a1527cbc5b065bed41de567dd20fd9415f9`; P0=0/P1=0.
- PR #107: open, unmerged, mergeable; base `85fdc7e77c7bec879d2da65d9781b55bb09b670f`, head `176f6a715a2410b974147c84ef94f58775dd3c2d`.
- Open PR queue remains #107 plus unrelated #71.
- Proposal branch is ahead 2/behind 0 from current main; diff is only the proposal checkpoint file.
- The implementation branch and this checkpoint path were absent before branch creation.
- Main, behavior, Final QA, and PR #107 head expose no combined statuses; behavior, Final QA, and PR #107 head expose no PR-triggered workflow runs.
- All 12 current-main transitive dependency-floor blobs and all 9 activation-sensitive V7.2/workflow blobs match the proposal exactly.
- All 13 archived reusable/reference blobs are accessible by exact blob SHA.

## Production Evidence at Start

Latest accepted receipt remains `data/automation_runs/2026-08-02-afternoon.json`, blob `15934cd8cd0a02adc3f5558e29104ed93e31d448`, run [30740153627](https://github.com/Neo0109/CRM/actions/runs/30740153627).

- event/slot: scheduled afternoon
- job `generate-and-sync`: completed/success
- generation/validation/status: success
- `sync_response.synced=true`
- active summary: Sourcing V7.2
- current day: 294 candidates; formal 0, candidate 84, excluded 210
- rolling seven days: zero nonzero days, zero new Leads
- consecutive zero days: 15
- `business_liveness_status=unhealthy-business-liveness`

Delivery and sync are healthy; admission/product output is degraded. This does not authorize relaxed quality gates, quota, backfill, a minimum Lead count, or a zero-day bypass.

## TDD Sequence

1. Rehome only the exact proposal-authorized archived blobs.
2. Add fixture-only RED tests with a global network sentinel for production non-mutation, provider/collector/finalizer failure isolation, full candidate/lane/transaction capture, hard exclusions, privacy rejection, hash/schema/count/publication/budget parity, automatic afternoon/watchdog eligibility, manual exclusion, and workflow boundary.
3. Adapt the shadow candidate audit only by retargeting the decision import to the shadow decision module.
4. Implement the smallest shadow collector/finalizer and additive production-first integration hooks.
5. Run the complete proposal verification gates from disposable exact GitHub API snapshots.
6. Freeze RED/GREEN/full-verification evidence, new/adapted blob SHAs, behavior hash, final head/diff/status, and the independent-QA boundary here.

## Stop Boundary

Any proposal stop condition ends implementation and returns to proposal. This task stops after the remote implementation checkpoint and exact verification. It does not create a PR.
