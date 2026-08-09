# PR C5-B live corpus privacy projection repair

## Delivery state

- Base authority: `main@79a25601665f1dea51fe68d25b1fc50ef58ca95e`
- Accepted RED: `1be01c0ca0c0813b61a7b3cffe55884162b8dfce`
- Exact code and QA authority: `b088cbe16e766d017c7da81ce3d35ff9c980e95b`
- Branch: `codex/c5b-live-corpus-privacy-projection`
- Production authority remains V7.2.
- Delivery stops at a draft PR. This checkpoint does not authorize ready, review, merge, deploy, workflow dispatch, live-provider access, CRM sync, production replay writes, observation, or V7.3 activation.

## Root cause and bounded repair

Eligible automatic afternoon runs repeatedly failed before the pending core was written with `PRIVACY_PRIVATE_CONTACT`. The collector built `shadowCandidateArtifact` for the in-memory decision universe and also serialized that full audit artifact into the pending replay core. Reused candidate-state evidence snapshots can contain `contactMethods` email values, so the replay privacy validator correctly rejected the pending payload.

The repair keeps `shadow_candidate_artifact` available in the in-memory return value because existing second-pass behavior uses that diagnostic contract. A new `pendingCoreForWrite` projection removes only that transient field before privacy validation and pending-file serialization. The privacy validator, candidate-state artifact, production sourcing artifact, selector, evaluator, gates, publication logic, finalizer tuple, workflow, and V7.2 production path are unchanged.

## TDD record

1. RED added a realistic candidate-state snapshot containing `contactMethods` with an email and required the safe collector to produce a pending core without the transient audit field or private contact material.
2. The RED failed with `C5-B privacy boundary rejected the shadow core: PRIVACY_PRIVATE_CONTACT`; expected `pending`, actual `error`.
3. The first narrow removal passed the collector suite but exposed one V7.3 compatibility dependency: the in-memory second-pass test reads `core.shadow_candidate_artifact.scan_summary`.
4. The corrective implementation retained the in-memory audit contract while projecting only the persisted pending core. The privacy regression and the existing in-memory contract both pass.

## Exact scope

Code authority `b088cbe1` relative to the base is ahead 3, behind 0, with the merge base exactly equal to the base. The code diff is exactly two paths:

1. `automations/jobs/online_daily_v7_3_shadow_collector.mjs`
2. `automations/test/onlineDailyV73ShadowCollector.test.mjs`

This checkpoint document is the only third delivery path.

Explicitly excluded:

- `.github/workflows/**`
- `data/**`
- replay privacy validator or JSON schemas
- candidate-state persistence or production sourcing candidate artifacts
- Daily V4 rules, decisions, admission, provider, or synchronization behavior
- API, UI, Supabase, migrations, packages, or lockfiles
- PR #110 C5-C offline replay/window implementation
- PR #107 disposition
- workflow dispatch/rerun, live provider, CRM sync, production replay/write, observation, activation, merge, or deployment

## Verification

All checks used a disposable snapshot of the exact remote code; the local CRM checkout was not modified and was not used as state authority.

- touched job/test `node --check`: GREEN
- collector suite: 23/23 GREEN
- collector + replay-corpus contract + shadow integration: 55/55 GREEN
- all `onlineDailyV73*.test.mjs`: 75/75 GREEN
- Daily V4: 256/256 GREEN
- `npm run verify:all`: GREEN, including its final diff-check after temporary git metadata was added to the disposable tarball snapshot
- fresh exact-`b088cbe1` QA snapshot: 2/2 GREEN
  - private candidate audit state is absent from the persisted pending core
  - the bounded second pass still exposes the deep-cloned in-memory audit result
- remote compare allowlist: exactly the two approved code/test paths before this checkpoint
- denylist: no workflow, data, schema, production rule, API/UI/Supabase, package, or lockfile path changed
- independent finding count: P0=0 / P1=0 / P2=0

The first Daily V4 attempt in the bare tarball lacked `ajv`; after attaching an existing read-only dependency directory to the disposable snapshot, the required rerun passed 256/256. No package or lockfile was created in the repository.

## Remaining gate

This repair removes the confirmed pre-pending privacy blocker in code, but live corpus liveness remains unproven until a separately approved merge is followed by a natural eligible automatic afternoon run. Do not dispatch or rerun a workflow to manufacture that proof. PR #110 overlaps the collector path and must be updated on top of the repair before its ready/merge gate is reconsidered.
