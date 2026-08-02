# PR C C5-B Shadow Collector Contract Amendment

Date: 2026-08-03
Phase: RC-C5B-AMEND — Phase 2 contract repair only
Status: amendment checkpoint complete; hard stop before renewed unified Phase 3/4 approval
Release Captain: this task
Branch: codex/pr-c-c5b-shadow-collector-contract-amendment
Exact base: 1fc883e36ce8725d345061b8f8f64aef28e36bad

## Authority and scope

This checkpoint amends only the contradictory second-pass focused-test clauses in:

- original proposal branch/head: codex/pr-c-c5b-shadow-collector-proposal@60647b5b50ec63add8ceea6b0a32851704cf607d
- original proposal path/blob: docs/checkpoints/pr-c-c5b-shadow-collector-proposal.md@59b5f399aba749086f37c1f41ed1a24033fb4447
- frozen implementation branch/head: codex/pr-c-c5b-shadow-collector@a8b9b45d502583d941d1038fcb57ff3de6fcd381
- frozen implementation checkpoint/blob: docs/checkpoints/pr-c-c5b-shadow-collector.md@7ce7e4dcdba34f5b2680211b900e92e1a6429de1

Where this amendment is silent, every original C5-B data-flow, privacy, quality, eligibility, budget, failure-isolation, denylist, rollback, sequencing, and non-activation boundary remains authoritative.

This checkpoint authorizes no Phase 4 implementation. It adds no collector, schema, test, integration, workflow, rule, or production code. It creates no PR and performs no merge, deployment, workflow dispatch, live generator/provider call, CRM sync, replay, C5-C, 15-day observation, or Activation.

## Overall progress checkpoint

- Remote production main remains exactly 1fc883e36ce8725d345061b8f8f64aef28e36bad.
- Production remains V7.2.
- Original proposal ref remains exactly 60647b5b50ec63add8ceea6b0a32851704cf607d.
- Frozen implementation ref remains exactly a8b9b45d502583d941d1038fcb57ff3de6fcd381.
- Frozen behavior source remains exactly 0dc5627f97106bd0e54ff4bff57648f6fb4c2606.
- Final QA ref remains exactly d74ee4b69bb3d71f1a8dbd9e1038b73cc3765b3b; checkpoint blob 46625a1527cbc5b065bed41de567dd20fd9415f9 records P0=0/P1=0 for archival use only.
- PR #107 remains open, unmerged, mergeable, and unchanged:
  - base codex/pr-c-c5-v73-replay-corpus-contract-v1@85fdc7e77c7bec879d2da65d9781b55bb09b670f
  - head codex/pr-c-c5a-replay-corpus-contract-validator@176f6a715a2410b974147c84ef94f58775dd3c2d
- Open PR queue remains #107 plus unrelated #71.
- Original proposal is ahead 2/behind 0 from main and changes only its proposal checkpoint.
- Frozen implementation is ahead 2/behind 0 from main and changes only its implementation checkpoint.
- Main, proposal, implementation, behavior source, Final QA, and PR #107 head expose no combined status evidence.
- Proposal, implementation, behavior source, Final QA, and PR #107 head expose no PR-triggered Actions runs.
- Before creation, the amendment branch search returned no match and this amendment path returned GitHub API 404 on exact main.

Explicitly untouched: all completed PR C modules, C5-C, window selection/replay, any observation output, Activation, PR D/E, AI editing, UI/API, Supabase, Radar, Steam Trends, production workflows/runs/data, PR metadata, original checkpoints, and all evidence refs.

## Current production evidence

The latest accepted production receipt remains:

- data/automation_runs/2026-08-02-afternoon.json
- blob 15934cd8cd0a02adc3f5558e29104ed93e31d448
- GitHub Actions run 30740153627
- scheduled afternoon
- job generate-and-sync completed/success
- generation success
- validation success
- receipt status success
- sync_response.synced=true
- active summary Sourcing V7.2
- 294 candidate records: formal 0, candidate 84, excluded 210
- rolling seven days: zero nonzero days and zero new Leads
- consecutive zero days: 15
- business_liveness_status=unhealthy-business-liveness

The run job confirms generation, validation, commit, CRM sync, receipt commit, and import-quality steps completed successfully. Delivery and sync are healthy; admission/product output is degraded and business liveness is unhealthy. This evidence does not authorize relaxed quality gates, quotas, backfill, minimum Leads, or a zero-day bypass.

Current production artifact blobs remain:

- data/reports/2026-08-02.json: 45991956511546c22cc24a58a50462c2f509dec6
- data/radar/2026-08-02.json: d582f7a01d06e5e037d0252016e8ad9e27751784
- data/steam_trends/2026-08-02.json: 388be24cff8b58ed009bb647716793e918904e72
- data/sourcing_candidates/2026-08-02.json: c8043567825637d9c5da44bd62cd85636f0808e8

## Concrete contract defect

The original proposal classifies archived blob 208de9f34ca06ee2fb4655c3bbe8711ff0b667ee as an exact byte-for-byte reusable focused test and also requires it to run GREEN at automations/test/onlineDailyV73SecondPassOrchestrator.test.mjs.

The first seven test cases in that blob exercise bounded V7.3 second-pass behavior. The final test, lines 410-436, is different: it is an activation integration test named “wires the batch behind the active V7.3 rule boundary before pool and artifact decisions.”

That final test requires:

1. production RULE_VERSION to equal V73_OBTAINABLE_EVIDENCE_RULE_VERSION;
2. production automations/rules/daily-report.json.rule_version to equal V73_OBTAINABLE_EVIDENCE_RULE_VERSION;
3. production online_daily_v4.mjs to call runV73TargetedCandidateSecondPasses and fetchV73TargetedEvidence;
4. production sourcingRuleVersion to branch on V7.3;
5. production buildPools to consume v73SecondPass.steam_candidates and v73SecondPass.media_candidates;
6. production candidate-audit inputs to consume the V7.3 second-pass candidates and candidate states before artifact decisions.

Those requirements are activation semantics. They directly contradict the proposal's V7.2 production authority, Exact Denylist, four-production-writes-first boundary, additive non-throwing post-output hook, deep-cloned disjoint object graph, and prohibition on shadow return flow into production pools, reports, candidate artifacts, payloads, validation, sync, or receipt status.

Therefore 208de9f34ca06ee2fb4655c3bbe8711ff0b667ee cannot be both byte-for-byte exact and GREEN under C5-B. Changing production to satisfy it would activate V7.3. Editing it while still claiming exact reuse would falsify the blob contract. The frozen implementation correctly stopped before RED.

## Complete exact-reuse audit

The exact archived blob audit found no second production-activation test conflict.

The following eleven blobs remain byte-for-byte exact-reuse candidates under the original paths and boundaries:

1. fc1749b39c490fb55c6bb7e7a7b89932d5294b50 — obtainable-evidence evaluator
2. bd5effb034571175ba3e34be96431fa02f731ba0 — two-lane composition
3. 63c7f47f09cd7addecce6a5ce04f6578e74e4f39 — bounded second-pass orchestrator
4. c58ada5ebc8005c570c5c79f0b3945803ae5ed60 — Replay Corpus Contract validator/canonicalizer
5. 7b96f828bead30fa97fc1c45861eae8bdb894729 — replay corpus schema
6. ab188c52d0c99f92c9825b681987857ae07a770f — replay window schema retained for parity only
7. 4ee236dd5cdb302510db4910b934f1a487b4066b — shadow schema-v3 candidate contract
8. 99b65a523880fd00576024a6f38bb5a106fc6281 — V7.3 machine rule copied only to the shadow rule path
9. 0926c60d138d162909028a6093143516611a983a — path-independent V7.3-capable shadow decision
10. f9c976354f71bad728cee3e1d31faae088f0ffd2 — obtainable-evidence focused test
11. 69a8bfafe55d37f96d6e640f0e6f245782691f08 — Replay Corpus Contract focused test

The archived candidate-audit blob 372dddc288a1f49a7ab50d526f8d1d04c12db2af remains reference-only and still requires the already-proposed single import retarget to online_daily_v7_3_shadow_decision.mjs.

Blob 208de9f34ca06ee2fb4655c3bbe8711ff0b667ee is reclassified as reference-only. It is not an exact reusable implementation artifact and is not an acceptance verification target.

### Shadow-rule interpretation guard

Blob 99b65a523880fd00576024a6f38bb5a106fc6281 contains historical activation-oriented metadata, including compatibility with automations/jobs/online_daily_v4.mjs, push_pool terminology, and workflow guardrail prose. Exact reuse is allowed only as inert shadow-rule metadata at automations/rules/daily-report-v7-3-shadow.json.

For C5-B:

- push_pool in this shadow file means only the internal shadow publication classification recorded as shadow_push_pool in the corpus;
- compatible_generators and workflow prose do not authorize switching production generator or workflow authority;
- production online_daily_v4_rules.mjs and automations/rules/daily-report.json remain the sole V7.2 authority;
- no test may use the shadow file's historical prose to require production V7.3 wiring;
- if implementation needs to edit this blob, interpret it as production authority, or change a production/workflow invariant to satisfy it, stop and return to Phase 2.

No path change is required by this clarification.

## Minimal shadow-only replacement test contract

Target path remains:

automations/test/onlineDailyV73SecondPassOrchestrator.test.mjs

The target will be a new adapted test with a new blob SHA frozen at GREEN. It may reuse fixtures and the first seven shadow-compatible behavioral expectations from archived 208de9f, but it must not be represented as byte-for-byte reuse.

Required behavior coverage:

1. Expose the real bounded batch orchestrator and injected source-constrained provider interface.
2. Select at most 12 deterministic near-misses.
3. Require one to three supported requested actions per selected candidate.
4. Preserve deterministic selection order, omission reasons, tie-break data, candidate-specific transaction binding, and exact ID-list/count parity.
5. Work only on deep-cloned shadow candidates and privacy-safe candidate-state snapshots.
6. Preserve PR B state/snapshot semantics without mutating production inputs.
7. Materialize only requested normalized public evidence with public source URLs.
8. Isolate thrown, timeout, empty, and invalid provider outcomes; record the transaction and retain first-pass shadow decisions with zero retry.
9. Never select hard exclusions.
10. Exclude official, developer, publisher, keyword, and unclassified evidence from independent-quality slots.
11. Allow Bilibili independent evidence only when positively classified media or trusted_creator, with two distinct eligible source IDs.
12. Use fixtures and an injected provider only; a global network sentinel must fail any live access.
13. Prove the shadow collector invokes the second-pass orchestrator only on its cloned shadow universe and returns results only into the shadow corpus/decision path.
14. Prove second-pass outputs cannot become arguments to production buildPools, production candidate audit, reports, Lead payloads, validation, sync, or receipt status.
15. Prove the shadow rule version is V7.3 while the active production rule remains V7.2 through the separate denylist and golden-hash guards.

The replacement test must not:

- import online_daily_v4_rules.mjs as V7.3 authority;
- read automations/rules/daily-report.json expecting V7.3;
- require V7.3 second pass before production pool or artifact decisions;
- require production buildPools or production candidate audit to consume shadow objects;
- change or execute activation tests;
- reach a live Steam, Bilibili, media, CRM, sync, or other network provider.

The old final activation test at lines 410-436 is removed from C5-B acceptance. It is neither weakened nor made to pass; it remains archived evidence for a future separately approved Activation contract.

## Path allowlist amendment

The implementation allowlist remains exactly 21 paths. No path is added or removed.

Only the classification of allowlist item 13 changes:

- before: exact byte-for-byte rehome of 208de9f
- after: new shadow-only adapted test at automations/test/onlineDailyV73SecondPassOrchestrator.test.mjs, with a new blob SHA frozen at GREEN

Allowlist item 17, automations/test/onlineDailyV73ShadowIntegrationContract.test.mjs, remains responsible for the production-first additive-hook boundary and byte-identical V7.2 integration invariants.

This amendment checkpoint path belongs only to the separate amendment branch. It is not added to the future 21-path implementation diff.

## Exact denylist amendment

The Exact Denylist is unchanged.

In particular, C5-B must not change or activate:

- automations/jobs/online_daily_v4_rules.mjs
- automations/rules/daily-report.json
- automations/jobs/online_daily_v4_decision.mjs
- automations/jobs/online_daily_v4_candidate_audit.mjs
- automations/jobs/online_daily_v4_reports.mjs
- scripts/validate-daily-contract.mjs
- automations/test/onlineDailyV73ActivationReplayContract.test.mjs
- automations/test/onlineDailyV7Activation.test.mjs
- scripts/test-sourcing-v6-3.mjs
- current sourcing-rule documents or reader text
- any production data path already prohibited by the original proposal
- PR #107 or any original proposal, implementation, QA, behavior, or evidence ref

online_daily_v4.mjs and the two workflows remain allowlisted only for the original minimal post-output/finalizer metadata plumbing. They may not satisfy the archived activation assertion.

## Revised RED-to-GREEN contract

RED must be written before collector/integration implementation and must use fixtures only.

The accepted RED snapshot must include:

- the new target test blob, which is different from 208de9f;
- the eleven remaining exact rehomes and the separately adapted candidate-audit source as frozen inputs or explicit pre-RED preparation already allowed by the original sequence;
- the shadow-only replacement test failing only because the C5-B shadow collector/adapter and post-output isolation behavior do not yet exist;
- existing V7.2 production, Blocker 2, Blocker 3, C5-A, and the shadow-compatible unit expectations remaining GREEN;
- exact failure names/messages recorded in the implementation checkpoint;
- no failure that asks production RULE_VERSION, daily-report.json, pools, or candidate audit to become V7.3.

Minimal GREEN is the smallest implementation within the unchanged 21-path allowlist that makes the shadow-only contract pass while every denylist blob and production golden hash remains unchanged.

If RED cannot be isolated without an activation assertion, a live provider, a path outside the allowlist, or a semantic edit to another claimed exact blob, stop and return to Phase 2.

## Revised verification gates

The original verification gates remain, with these exact changes and additions:

1. Recheck latest main, this amendment ref, original proposal/implementation refs, PR queue, workflows, production authority blobs, behavior source, Final QA, receipt, and implementation diff.
2. Verify the implementation starts from the then-latest exact main on a fresh implementation branch; do not resume or rewrite the frozen a8b9b45 branch.
3. Verify the implementation diff is limited to the unchanged 21-path allowlist.
4. Verify every Exact Denylist blob is unchanged.
5. Parse all replay/shadow schemas and the shadow rule JSON with jq empty.
6. Run node --check on every added/modified MJS file.
7. Verify byte identity for the eleven remaining exact reusable blobs.
8. Run the exact obtainable-evidence test f9c9763 and exact Replay Corpus Contract test 69a8bfa.
9. Run the new shadow-only onlineDailyV73SecondPassOrchestrator test and freeze its new blob SHA at GREEN.
10. Do not run archived 208de9f as a C5-B GREEN requirement.
11. Statically prove the replacement test contains no production-V7.3 authority assertion and does not require second-pass return flow into production pools/artifacts.
12. Run the new shadow candidate-audit, collector, and integration tests.
13. Run the focused Blocker 2 + Blocker 3 + C5-A + C5-B union.
14. Preserve all original workflow assertions: no push trigger, cron/dispatch/permissions/concurrency unchanged, production arguments/validation/sync/receipt/failure semantics unchanged, and only existing metadata/finalizer/corpus-path plumbing used.
15. Preserve fixture-only provider scanning and a global network sentinel.
16. Run npm run test:daily-v4.
17. Run npm run verify:all.
18. Run git diff --check.
19. Prove no generated production data, replay corpus, dependency, lockfile, or unapproved path exists in the diff.
20. Prove production V7.2 object/payload golden hashes are unchanged.
21. Treat 99b65a as inert shadow metadata; fail verification if its historical production/workflow prose is used as executable activation authority.
22. Obtain independent exact-head QA with P0=0 and P1=0 before any later merge/deploy proposal.

All executable verification must use a GitHub API exact-SHA disposable /tmp snapshot and must not read or depend on a local CRM checkout/worktree.

No live generator/provider, workflow dispatch, CRM sync, replay, deployment, UI/API, or Supabase action is part of verification.

## Revised Definition of Done

C5-B Phase 4 is done only when:

- a renewed unified Phase 3/4 approval explicitly names this amendment as authority;
- implementation starts from a freshly rechecked latest exact main on a fresh branch;
- the frozen implementation branch a8b9b45 remains unchanged;
- all eleven exact reusable blobs match byte-for-byte;
- 208de9f remains reference-only and is not claimed or required as exact GREEN;
- the replacement second-pass test has a new exact GREEN blob SHA and satisfies every shadow-only clause above;
- the adapted candidate-audit blob, collector, integration modules/tests, and behavior hash are frozen at exact GREEN head;
- complete candidate, lane, transaction, evidence, budget, hash, schema, count, privacy, and publication parity validate;
- V7.2 rule, generator identity, production pools, candidate artifact, reports, payloads, validation, sync, receipt, UI/API, and Supabase behavior remain unchanged;
- automatic afternoon/watchdog eligibility and manual exclusion tests pass;
- shadow/provider/finalizer failures cannot fail V7.2 delivery;
- the unchanged allowlist and denylist plus revised verification gates pass;
- one new implementation checkpoint records exact RED, GREEN, full verification, final head/diff/status, and independent-QA handoff;
- no PR is created unless separately authorized;
- merge, deployment, C5-C, collection window, and Activation remain separate approvals.

## Rollback amendment

The original rollback remains authoritative.

A later rollback must revert the replacement test together with the C5-B implementation. It must not restore 208de9f as an active C5-B test, switch production to V7.3, modify existing V7.2 data, delete already committed pre-window corpus evidence, dispatch workflows, replay data, or touch CRM/Supabase.

The current amendment itself has no runtime or production effect. If rejected, its branch can remain as immutable proposal evidence; original proposal and frozen implementation refs remain untouched.

## Revised stop conditions

In addition to every original stop condition, stop and return to Phase 2 if:

- any implementation or test attempts to make archived 208de9f GREEN unchanged;
- the replacement test asserts production RULE_VERSION or daily-report.json is V7.3;
- shadow second-pass candidates or states are passed into production pools, candidate audit, reports, payloads, validation, sync, or receipt status;
- the replacement test cannot retain the first seven shadow-compatible behavior groups without weakening budget, hard exclusion, role, distinct-source, public-evidence, state, or failure-isolation boundaries;
- any other claimed exact blob needs semantic edits;
- 99b65a historical compatibility/workflow prose is treated as authority to change production or workflow behavior;
- a new test path, package/test-runner change, dependency, production rule/schema/report/reader change, or path outside the unchanged allowlist becomes necessary;
- fixture-only and no-network guarantees cannot be enforced;
- the frozen original proposal, implementation branch, behavior ref, Final QA ref, PR #107 metadata, or production authority drifts unexpectedly;
- implementation cannot start cleanly from then-latest exact main on a fresh branch.

## Revised independent-QA boundary

Independent exact-head QA must answer all original questions and also:

- Is 208de9f absent from the exact-reuse and GREEN requirements?
- Does the replacement test have a new blob SHA and remain shadow-only?
- Are all seven archived shadow-compatible behavior groups retained?
- Is the archived activation assertion neither weakened nor executed as C5-B acceptance?
- Are production RULE_VERSION and daily-report.json still V7.2?
- Can any shadow candidate/state/reference flow into production pool, candidate audit, report, payload, validation, sync, or receipt status?
- Is 99b65a inert shadow metadata rather than executable production/workflow authority?
- Do exact-head focused, Daily V4, verify-all, allowlist, denylist, golden-hash, and no-network evidence reproduce?

Any P0/P1 finding blocks merge/deploy and returns to Phase 2.

## Unchanged boundaries

The following remain unchanged:

- all C5-B collector data flow and eligibility rules;
- production-first four-write boundary;
- deep-clone and object-graph isolation;
- complete candidate universe and both regular lanes;
- max 12 selected candidates, one to three requested actions, zero retry, no paid AI provider;
- all hard exclusions and independent-quality source-role rules;
- two distinct eligible source IDs;
- privacy allowlist and recursive rejection;
- corpus schema/hash/count/artifact/receipt parity;
- automatic afternoon/watchdog eligibility and manual exclusion;
- non-throwing provider/collector/finalizer behavior;
- exact 21-path implementation allowlist;
- Exact Denylist;
- no PR, merge, deploy, dispatch, live provider, sync, replay, C5-C, window, or Activation in Phase 4;
- independent QA and later merge/deploy decisions remain separate.

## Renewed Phase 3/4 approval boundary

One decision only:

Approve this contract amendment as the controlling delta to the frozen C5-B proposal and authorize one bounded small-TDD Phase 4 implementation from the then-latest exact remote main on a fresh implementation branch, limited to the unchanged 21-path allowlist, the eleven exact reusable blobs, the new shadow-only replacement test at the existing path, and all original plus revised denylist, privacy, quality, failure-isolation, RED-to-GREEN, verification, Definition of Done, rollback, stop, and independent-QA gates, with no PR creation, merge, deployment, workflow dispatch, live provider, CRM sync, production replay, C5-C, 15-day window, or V7.3 activation?

Until that approval is explicit, stop here.
