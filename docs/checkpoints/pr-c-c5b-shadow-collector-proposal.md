# PR C C5-B Shadow Collector Proposal

Date: 2026-08-02
Phase: RC-C5B-PROP — Phase 1 Diagnosis + Phase 2 Proposal complete
Status: proposal only; stopped before Phase 3/4 implementation approval
Release Captain: this task
Base policy: remote GitHub main, refs, PRs, Actions, and production artifacts are the only repository/production truth

## Current Goal

Design a shadow-safe C5-B collector from the latest remote `main` without merging or rebasing the archived V7.3 behavior source, and stop before implementation.

This checkpoint authorizes no collector code, PR, merge, deployment, workflow dispatch, live generator/provider, CRM sync, production replay, or V7.3 activation.

## Overall Progress Checkpoint

- Remote production `main`: `1fc883e36ce8725d345061b8f8f64aef28e36bad`.
- Production remains V7.2.
- Completed modules already available as frozen remote evidence:
  - PR B candidate-state/fair-enrichment is on production `main`.
  - C5-A Replay Corpus Contract v1 is complete on the archived stack.
  - Blocker 2 independent-quality source-role behavior is complete on the archived stack.
  - Blocker 3 schema-v3 boundary is complete on the archived stack.
  - Final independent QA is complete and GREEN for archival use.
- Open PR queue:
  - PR #107: open, mergeable, unmerged; original stacked base/head unchanged.
  - PR #71: unrelated Weekly Report CSS PR; outside C5-B.
- This proposal touches only C5-B Shadow Collector planning.
- Explicitly untouched: C5-C, 15-day observation, Activation, PR D/E, AI editing, UI/API, Supabase, Radar, Steam Trends, production workflows/runs/data, PR metadata, and all existing evidence refs.

## Phase 1 Diagnosis

### Remote start gates

| Gate | Current evidence | Result |
| --- | --- | --- |
| main | `1fc883e36ce8725d345061b8f8f64aef28e36bad` | exact |
| main drift from frozen baseline `3928de8472ffb15b609acc138c9340329234e686` | ahead 16, behind 0; 20 changed paths, all dated files under `data/automation_runs`, `data/reports`, `data/radar`, `data/steam_trends`, and `data/sourcing_candidates` | data-only, no code overlap |
| frozen behavior ref | `codex/pr-c-int-c5a-rehome@0dc5627f97106bd0e54ff4bff57648f6fb4c2606` | exact |
| Final QA ref | `codex/pr-c-final-qa-checkpoint@d74ee4b69bb3d71f1a8dbd9e1038b73cc3765b3b` | exact |
| Final QA file | `docs/checkpoints/pr-c-final-integration-qa.md`, blob `46625a1527cbc5b065bed41de567dd20fd9415f9` | exact |
| PR #107 | base `codex/pr-c-c5-v73-replay-corpus-contract-v1@85fdc7e77c7bec879d2da65d9781b55bb09b670f`; head `codex/pr-c-c5a-replay-corpus-contract-validator@176f6a715a2410b974147c84ef94f58775dd3c2d`; open, mergeable, unmerged | unchanged |
| proposal branch | `codex/pr-c-c5b-shadow-collector-proposal` | absent before creation |
| proposal path on main | `docs/checkpoints/pr-c-c5b-shadow-collector-proposal.md` | absent before creation |
| commit statuses | main, behavior source, Final QA, and PR #107 head all expose no combined statuses | no status evidence claimed |
| PR-triggered Actions | behavior source, Final QA, and PR #107 head expose no PR-triggered runs | no CI run claimed |

The Final QA checkpoint records independent findings P0=0 and P1=0. It also records exact-head verification at `0dc5627`: 20 changed MJS syntax checks GREEN, both replay schemas GREEN, focused union 53/53, Daily V4 238/238, and `npm run verify:all` all 16 tasks GREEN. Those are archived exact-head results, not production activation evidence.

### Current production evidence

Latest accepted production receipt:

- file: `data/automation_runs/2026-08-02-afternoon.json`
- blob: `15934cd8cd0a02adc3f5558e29104ed93e31d448`
- run: `30740153627`
- URL: `https://github.com/Neo0109/CRM/actions/runs/30740153627`
- event/slot: scheduled afternoon
- generation: success
- validation: success
- job `generate-and-sync`: completed/success
- receipt status: success
- `sync_response.synced`: true
- report date: 2026-08-02
- active product summary: Sourcing V7.2
- current-day candidates: 294 total; formal 0, candidate 84, excluded 210
- rolling seven days: zero nonzero days and zero new Leads
- consecutive zero days: 15
- `business_liveness_status`: `unhealthy-business-liveness`

Current production artifact blobs:

| Artifact | Blob |
| --- | --- |
| `data/reports/2026-08-02.json` | `45991956511546c22cc24a58a50462c2f509dec6` |
| `data/radar/2026-08-02.json` | `d582f7a01d06e5e037d0252016e8ad9e27751784` |
| `data/steam_trends/2026-08-02.json` | `388be24cff8b58ed009bb647716793e918904e72` |
| `data/sourcing_candidates/2026-08-02.json` | `c8043567825637d9c5da44bd62cd85636f0808e8` |

Classification: delivery and sync are healthy, while Sourcing admission/product output is degraded and business liveness is unhealthy. This is not permission to relax quality gates.

No production endpoint, GUI, screenshot, local checkout, live provider, workflow dispatch, replay, or sync call was used in this diagnosis.

## Concrete Problem

The archived `0dc5627` stack is a valid V7.3 shadow behavior source but is not merge-safe:

1. It changes `online_daily_v4_rules.mjs` so the active `RULE_VERSION` becomes V7.3.
2. It changes `automations/rules/daily-report.json` from V7.2 to V7.3.
3. It routes the production generator's candidates through the V7.3 second pass and uses those mutated shadow candidates to build production pools, reports, candidate audit, Radar, Steam Trends, and Lead payloads.
4. It changes production decision, report, candidate-schema, and daily-contract code to understand or publish V7.3.
5. It has no isolated per-run collector that binds the normalized universe, both regular lanes, every second-pass transaction, final shadow decision, production artifacts, receipt, behavior hash, and privacy boundary into Replay Corpus Contract v1.

Therefore `0dc5627` cannot be merged, rebased, cherry-picked wholesale, or activated. C5-B must rehome only the intended behavior into a non-publishing side path from current `main`.

## Cost of Inaction

Without C5-B:

- the 15-day acceptance window cannot start because there is no prospective, lossless, hash-bound decision corpus;
- historical V7.2 artifacts cannot reproduce V7.3 first-pass and provider transactions;
- a future activation decision would rely on code-GREEN evidence rather than real accepted-run evidence;
- provider failures, missing evidence, dedupe boundaries, and second-pass selection cannot be audited deterministically;
- zero formal Leads can continue to be observed without proving whether V7.3 would improve obtainable evidence while preserving quality;
- directly merging the archived stack would activate V7.3 and expand the blast radius into production reports, payloads, sync, reader text, and schemas.

## Why This Operation Is Necessary and Next

C5-A already froze the strict corpus and window contract. C5-B is now the smallest next operation because it supplies the missing prospective evidence without entering C5-C replay/window logic or Activation.

It is earlier than Radar/Steam Trends copy repair because those reader strings are a P2 activation prerequisite, not a shadow-collector prerequisite. It is earlier than C5-C because offline replay cannot operate until C5-B creates complete run corpora.

## Engineering Principle

- Start from the then-latest remote `main`.
- Rehome exact archived blobs where they are already pure or behavior-complete.
- Adapt only where a production import would otherwise resolve to a V7.2 module.
- Keep production and shadow object graphs disjoint through deep cloning.
- Execute shadow capture only after the four V7.2 production payloads have been built and written.
- Finalize the corpus inside existing receipt commit plumbing only after the matching receipt exists.
- Catch every shadow/provider/finalization failure and preserve the V7.2 exit, report, validation, receipt, and sync result.
- Use explicit run context and deterministic hashes.
- Fail corpus acceptance closed; never relax production admission.

## Architecture Benefit

- Production `online_daily_v4.mjs` remains the V7.2 orchestrator.
- V7.3 decisions become advisory data only and cannot enter CRM payloads.
- The shadow collector owns capture, hashing, privacy, and failure isolation.
- C5-C receives immutable, network-free inputs.
- A behavior-manifest change becomes visible and resets the future window.
- Source-role, evidence-family, gate, URL, and transaction attribution become auditable.
- The blast radius is limited to one post-output hook, two existing receipt/commit paths, and a new data directory.
- New source/provider work remains isolated from production report, UI/API, and sync modules.

## Shadow-Safe Stack From Latest main

C5-B must not merge or rebase `0dc5627`. A future implementation branch must be created from the then-current exact `main` only after the unified Phase 3/4 approval and a fresh start-gate recheck.

### Exact reusable archived blobs

These contents may be copied byte-for-byte from `0dc5627`; their target path is shadow-only or absent on main.

| Role | Archived source blob | Future target |
| --- | --- | --- |
| V7.3 obtainable-evidence evaluator | `fc1749b39c490fb55c6bb7e7a7b89932d5294b50` | `automations/jobs/online_daily_v7_3_obtainable_evidence.mjs` |
| V7.3 regular two-lane composition | `bd5effb034571175ba3e34be96431fa02f731ba0` | `automations/jobs/online_daily_v7_3_regular_admission.mjs` |
| bounded second-pass orchestrator | `63c7f47f09cd7addecce6a5ce04f6578e74e4f39` | `automations/jobs/online_daily_v7_3_second_pass_orchestrator.mjs` |
| Replay Corpus Contract v1 pure validator/canonicalizer | `c58ada5ebc8005c570c5c79f0b3945803ae5ed60` | `automations/jobs/online_daily_v7_3_replay_corpus_contract.mjs` |
| corpus schema | `7b96f828bead30fa97fc1c45861eae8bdb894729` | `schemas/sourcing_replay_corpus.schema.json` |
| window schema, retained for contract parity but not implemented by C5-B | `ab188c52d0c99f92c9825b681987857ae07a770f` | `schemas/sourcing_replay_window.schema.json` |
| schema-v3 candidate contract, shadow-only copy | `4ee236dd5cdb302510db4910b934f1a487b4066b` | `schemas/sourcing_candidates_v3_shadow.schema.json` |
| V7.3 machine rule, shadow-only copy | `99b65a523880fd00576024a6f38bb5a106fc6281` | `automations/rules/daily-report-v7-3-shadow.json` |
| V7.3-capable decision implementation, path-independent content | `0926c60d138d162909028a6093143516611a983a` | `automations/jobs/online_daily_v7_3_shadow_decision.mjs` |
| obtainable-evidence focused test | `f9c976354f71bad728cee3e1d31faae088f0ffd2` | `automations/test/onlineDailyV73ObtainableEvidence.test.mjs` |
| second-pass focused test | `208de9f34ca06ee2fb4655c3bbe8711ff0b667ee` | `automations/test/onlineDailyV73SecondPassOrchestrator.test.mjs` |
| Replay Corpus Contract focused test | `69a8bfafe55d37f96d6e640f0e6f245782691f08` | `automations/test/onlineDailyV73ReplayCorpusContract.test.mjs` |

The archived V7.3 candidate-audit blob `372dddc288a1f49a7ab50d526f8d1d04c12db2af` is reference material, not a byte-for-byte rehome: at its original ref it imports the V7.3-modified `online_daily_v4_decision.mjs`; on current main the same relative import would resolve to V7.2. The future shadow copy must retarget that import to `online_daily_v7_3_shadow_decision.mjs`, keep all other winner/schema-v3 semantics unchanged, and receive a new blob SHA frozen at GREEN.

### Current-main transitive dependency floor

The behavior manifest must include every loaded transitive dependency. The current expected floor is:

| Path | Current main blob |
| --- | --- |
| `automations/jobs/online_daily_v7_indie_admission.mjs` | `a6e4502b5f678c2244565ec7c227c78f730cf2aa` |
| `automations/jobs/online_daily_v7_2_china_joint_admission.mjs` | `f71d3280f764241887231842d9bfc571edf4dda8` |
| `automations/jobs/online_daily_v7_2_regular_admission.mjs` | `2e3a46f23a671b60c9ee342fb292018d5a4ac856` |
| `automations/jobs/online_daily_v4_candidate_state.mjs` | `eed6c86930acce5e4ae42902a80fa4df9dee3174` |
| `automations/jobs/online_daily_v4_enrichment_scheduler.mjs` | `c63221f75658529607c7adfb9324065c97cad862` |
| `automations/jobs/online_daily_v4_dedupe.mjs` | `989dd04b14760de07287a7ff38579f7e50e92b59` |
| `automations/jobs/online_daily_v4_media_sources.mjs` | `f209d3883c828b5170f9101757126925edebc491` |
| `automations/jobs/online_daily_v4_media_leads.mjs` | `6088483726fac6001933dab44cffcbd704a8c045` |
| `automations/jobs/online_daily_v4_steam_source.mjs` | `0cc45a9788aed679c91be97a95e90b0391d18468` |
| `automations/jobs/online_daily_v4_source_utils.mjs` | `4d5a2ea26a8d0b31abb67a13fc30016769f87307` |
| `automations/jobs/bilibili_probe.mjs` | `f6c2f233f86fbc6d43b075c6fb2e6d2d535ed4cf` |
| `automations/jobs/online_daily_v4_artifacts.mjs` | `36f0e94da95d0ddeafeb1b322c15399890684eaa` |

If current main changes any decision dependency before implementation, Phase 4 must stop and re-diagnose; it may not silently retain this table.

## Activation-Sensitive V7.2 Entries That Must Remain Production Authority

| Path | Frozen production invariant |
| --- | --- |
| `automations/jobs/online_daily_v4_rules.mjs` (`0d76e678a322dca98d709677a739de7d38a62135`) | `RULE_VERSION` remains `sourcing-v7.2-china-joint` |
| `automations/rules/daily-report.json` (`04a63e7d8e644835948ef348ed7e01bb1ac84624`) | active rule/doc remain V7.2 |
| `automations/jobs/online_daily_v4_decision.mjs` (`b326be1cb67b36985616ec54a489d30ec958a8c3`) | production pools and Lead payloads remain V7.2 |
| `automations/jobs/online_daily_v4_candidate_audit.mjs` (`f6e4403f937eaec60e935c01ea37bd8eeacd40d2`) | production candidate artifact stays current schema/behavior |
| `automations/jobs/online_daily_v4_reports.mjs` (`2d78c1d1605fd5ad6a89e68a85e5c2b20fa3d7e1`) | Daily/Radar/Steam reader content remains V7.2 |
| `scripts/validate-daily-contract.mjs` (`e05e38be25c22ebcd24e9acebfa9012d79e491a3`) | production daily validation stays current |
| `automations/jobs/online_daily_v4.mjs` (`5864b38f5d88969d85ccb47492b56ee564798cb6`) | comment, `generatorName`, `sourcingRuleVersion`, production objects, pool construction, report builders, and four production write paths remain V7.2; only an additive non-throwing post-output shadow hook is permitted |
| `.github/workflows/sync-daily-report.yml` (`72282bc6964e1b0744624b1903d2c5f4d26d416e`) | schedules, dispatch inputs, validation, sync, receipt, and failure semantics unchanged |
| `.github/workflows/daily-report-watchdog.yml` (`3a01348ed0b8fc45798e59ceb60dff3a03f94be4`) | watchdog schedule/dispatch, needs-run guard, sync, receipt, and recovery semantics unchanged |

## Phase 4 Exact Path Allowlist

A future C5-B implementation may change only these paths.

### Rehomed or new modules/contracts

1. `automations/jobs/online_daily_v7_3_obtainable_evidence.mjs`
2. `automations/jobs/online_daily_v7_3_regular_admission.mjs`
3. `automations/jobs/online_daily_v7_3_second_pass_orchestrator.mjs`
4. `automations/jobs/online_daily_v7_3_replay_corpus_contract.mjs`
5. `automations/jobs/online_daily_v7_3_shadow_decision.mjs`
6. `automations/jobs/online_daily_v7_3_shadow_candidate_audit.mjs`
7. `automations/jobs/online_daily_v7_3_shadow_collector.mjs`
8. `automations/rules/daily-report-v7-3-shadow.json`
9. `schemas/sourcing_candidates_v3_shadow.schema.json`
10. `schemas/sourcing_replay_corpus.schema.json`
11. `schemas/sourcing_replay_window.schema.json`

### Tests and implementation checkpoint

12. `automations/test/onlineDailyV73ObtainableEvidence.test.mjs`
13. `automations/test/onlineDailyV73SecondPassOrchestrator.test.mjs`
14. `automations/test/onlineDailyV73ReplayCorpusContract.test.mjs`
15. `automations/test/onlineDailyV73ShadowCandidateAuditContract.test.mjs`
16. `automations/test/onlineDailyV73ShadowCollector.test.mjs`
17. `automations/test/onlineDailyV73ShadowIntegrationContract.test.mjs`
18. `docs/checkpoints/pr-c-c5b-shadow-collector.md`

### Minimal integration hooks

19. `automations/jobs/online_daily_v4.mjs`
20. `.github/workflows/sync-daily-report.yml`
21. `.github/workflows/daily-report-watchdog.yml`

No package/test-runner wiring is expected because Daily V4 already discovers `automations/test