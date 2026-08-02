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

No package/test-runner wiring is expected because Daily V4 already discovers `automations/test/*.mjs`. If a new dependency, package change, or additional path becomes necessary, stop and return to proposal.

## Exact Denylist

C5-B must not change or generate:

- `automations/jobs/online_daily_v4_rules.mjs`
- `automations/rules/daily-report.json`
- `automations/jobs/online_daily_v4_decision.mjs`
- `automations/jobs/online_daily_v4_candidate_audit.mjs`
- `automations/jobs/online_daily_v4_reports.mjs`
- `scripts/validate-daily-contract.mjs`
- `automations/test/onlineDailyV73ActivationReplayContract.test.mjs`
- `automations/test/onlineDailyV7Activation.test.mjs`
- `scripts/test-sourcing-v6-3.mjs`
- `docs/SOURCING_RULES_CURRENT.md`
- `docs/SOURCING_RULES_V7_2.md`
- Radar or Steam Trends source/reader text
- `package.json`, any lockfile, frontend/backend/functions code, UI/API, Supabase, CRM sync endpoints
- any existing evidence/checkpoint ref or PR #107 metadata
- any file under `data/reports`, `data/radar`, `data/steam_trends`, `data/sourcing_candidates`, or `data/automation_runs` in the implementation PR
- any replay corpus generated by tests
- C5-C replay/window manifests, observation outputs, Activation, PR D/E, AI editing, quotas, backfill, minimum Lead logic, or zero-day bypass

The only future production data path introduced by deployed C5-B is `data/sourcing_replay_corpus/YYYY-MM-DD/<run-id>-<attempt>-<slot>.json`.

## Collector Data Flow

### 1. Eligibility

The capture hook receives explicit run context: report date, timezone, input commit SHA, GitHub event, workflow run ID, run attempt, slot, URL, Node version, and fixed budgets.

- scheduled afternoon: capture
- automatic watchdog that actually performs recovery generation: capture
- watchdog observation with no generation: do not create a corpus
- morning: operating evidence only; do not create a C5-B corpus
- `workflow_dispatch`, forced watchdog, or any manual run: excluded from acceptance and do not create an acceptance corpus even if the caller labels the slot afternoon/watchdog
- missing/invalid run identity: fail closed without affecting V7.2

This makes manual exclusion an event-and-slot rule, not a caller-controlled label.

### 2. Production-first boundary

The existing V7.2 flow builds and writes, byte-for-byte as before:

1. `data/sourcing_candidates/YYYY-MM-DD.json`
2. `data/reports/YYYY-MM-DD.json`
3. `data/radar/YYYY-MM-DD.json`
4. `data/steam_trends/YYYY-MM-DD.json`

Only after all four writes succeed may the additive shadow hook run. Production object and payload hashes are captured before shadow execution.

### 3. Clone and normalize

The collector receives deep clones only of:

- every deduped enriched/reused Steam candidate presented to regular admission;
- every deduped media/Bilibili candidate presented to regular admission;
- the public media signals required by the targeted provider;
- privacy-safe candidate-state fields required for first_seen, scheduler lane, attempts, snapshot status, and freshness;
- public-history/private-CRM match outcomes only as booleans/reason/digest.

The collector never receives the full CRM dedupe index, tokens, raw runtime cache, private Lead identity, notes, owner/contact data, raw HTML, response headers, or credentials.

The candidate universe is the complete deduped normalized universe actually presented to the two shadow regular lanes. Every record retains all origin signal IDs; Steam/media duplicates become one `multi_source` record rather than disappearing.

### 4. First pass: both regular lanes

For every candidate, capture separately:

- V7.3 indie_prelaunch exact input, full gate output, failed details, missing evidence, exclusions, next actions, evaluator dependency hash;
- retained V7.2 china_joint exact input and full output;
- the regular-lane winner and deterministic selection reason;
- ranking tuple, while recording `qualification_affected_by_ranking=false`.

Official/developer/publisher/keyword/unclassified evidence is never eligible for an independent-quality slot. Bilibili independent evidence is eligible only when positively classified `media` or `trusted_creator`. Two distinct eligible source IDs remain mandatory.

### 5. Bounded second pass

Use the rehomed exact orchestrator with an injected recording provider.

Frozen limits:

- selected candidates: maximum 12
- requested actions: one to three per candidate
- provider retry: zero
- no paid AI provider
- only the four approved public actions
- hard exclusions: never selected
- same evaluator before and after

For every eligible/selected/omitted/attempted candidate, capture deterministic order and tie-break fields. For every attempt, capture:

- requested gate/action records;
- allowlisted patch fields;
- bounded public official/media signals supplied;
- provider contract and request metrics;
- normalized raw result before filtering;
- filtered patch;
- success/error/timeout;
- merged final input;
- final output;
- decision/gate change;
- candidate-specific transaction ID.

Provider errors are transactions: final decision remains first pass, error is recorded, and production remains unaffected. An unrecordable or privacy-invalid transaction makes the corpus incomplete; it does not trigger a retry or a production fallback.

### 6. Final shadow decision

Run the shadow-only V7.3 decision/pool module on post-second-pass clones.

- all and only fully qualified candidates may be shadow formal;
- both indie_prelaunch and china_joint remain valid regular lanes;
- dedupe suppression is recorded;
- formal count must equal shadow push-pool count after documented suppression;
- shadow Lead payload is privacy-stripped and hashed only;
- no shadow payload is returned to the production generator, report builder, CRM sync, UI/API, or Supabase;
- day Lead count is never an evaluator input;
- no quota, backfill, minimum, ranking cutoff, or zero-day branch exists.

### 7. Pending core and receipt-time finalization

The post-output hook writes a privacy-validated pending core only under `data/runtime`; it is never committed.

The existing receipt commit block remains the only finalization point because the complete Replay Corpus Contract requires the matching receipt and `sync_response.synced` result.

Within that existing block:

1. write the normal receipt exactly as today;
2. call a non-throwing C5-B finalizer;
3. bind report, sourcing-candidate, optional Radar/Steam provenance, and receipt paths to canonical payload SHA-256 and Git-compatible blob SHA;
4. set delivery health from the actual receipt, retaining only `{synced: boolean}` from the sync response;
5. compute the sorted behavior manifest and behavior hash;
6. validate schema, cross-record rules, privacy, counts, publication parity, and hashes;
7. write `data/sourcing_replay_corpus/YYYY-MM-DD/<run-id>-<attempt>-<slot>.json`;
8. add that exact file, when present, to the existing receipt commit.

The replay-corpus self Git blob SHA remains `null` as allowed by C5-A; its canonical payload SHA is mandatory. C5-C later binds the committed corpus blob in the window manifest.

No new workflow step, trigger, dispatch, concurrency group, permission, sync call, retry, or deployment is allowed. Workflow edits are limited to passing existing run metadata, invoking the safe finalizer inside current receipt plumbing, conditionally adding the exact corpus path, preserving it across the existing rebase/stash boundary, and listing it in the summary.

### 8. Failure isolation

- Per-candidate provider failure: record transaction; retain first pass.
- Shadow core construction/privacy/hash failure: produce an incomplete/corrupt core when possible; never throw into V7.2.
- Finalizer failure: warn and leave the production receipt commit path intact; no corpus is preferable to a fabricated binding.
- Daily generation failure before normalized candidates exist: the existing failed receipt is the rejected-attempt evidence; do not fabricate a corpus.
- Git add checks the exact file before adding it, so missing shadow output cannot fail the receipt step.
- Production report, validation, sync, and receipt outcomes are never derived from shadow status.
- Any incomplete/missing automatic eligible corpus makes that date ineligible and resets the later window.

## Behavior Manifest and Hash Freeze

`behavior_manifest` is a canonical sorted map of path to Git blob SHA for every loaded transitive decision/capture dependency.

The collector owns an explicit dependency-path constant and fails closed when:

- a declared path is missing;
- an imported decision/capture module is undeclared;
- a schema/rule/provider classifier is absent;
- a hash cannot be computed;
- the same dependency path resolves to unexpected content.

The exact GREEN implementation head freezes new/adapted blob SHAs and the resulting `behavior_contract_sha256`. Data-only main commits may change `input_commit_sha` without changing the behavior hash. Any decision, provider, classifier, budget, schema, collector, or replay dependency change invalidates the future window.

## Privacy Boundary

Allowed:

- public Steam/Bilibili/media URLs with credentials and secret query parameters removed;
- bounded normalized public titles/summaries actually used;
- public source roles and evidence families;
- public official business entrypoints;
- candidate-state dates/statuses/attempt counts/scheduler lane;
- CRM/history match booleans, reason code, and non-reversible digest;
- hashes and deterministic IDs.

Forbidden:

- full CRM index or Lead payload;
- Lead identity, private notes, owner, email, phone, WeChat, WeCom, QQ, personal contact data;
- tokens, cookies, authorization or response headers, credentials, secrets, signed URLs;
- raw HTML or raw provider/network responses;
- unbounded bodies, runtime cache, environment dump, or logs;
- post-decision silent truncation.

The collector uses explicit field construction plus the C5-A recursive privacy validator. If a field influenced a decision but cannot be retained safely and losslessly, capture is incomplete and implementation stops for a new proposal.

## RED to GREEN Plan

Write RED first with fixture providers only. No test may invoke live Steam, Bilibili, media, CRM, sync, or any network provider.

| Test gate | Required RED proof | Minimal GREEN contract |
| --- | --- | --- |
| production non-mutation | shadow mutates a nested candidate/state/pool/report/payload reference or changes canonical production hashes | deep clone boundary; before/after hashes and byte-identical V7.2 outputs |
| provider failure isolation | thrown/timeout provider rejects generator/finalizer or changes production decision | captured failed transaction, first-pass fallback, non-throwing outer boundary |
| collector/finalizer failure isolation | missing/invalid corpus prevents receipt write/commit | conditional exact-path add; receipt and V7.2 status preserved |
| full candidate capture | Steam/media/multi-source or non-formal candidate disappears | decision-universe, origin, identity, both-lane, and summary parity |
| full transaction capture | eligible/selected/omitted/attempted list or candidate-specific transaction is missing/mismatched | deterministic IDs/order and one bound transaction per attempt |
| hard exclusions and quality roles | hard exclusion selected or official/developer/publisher/keyword/unclassified occupies independent slot | same evaluator; media/trusted_creator-only Bilibili independent slots; two distinct source IDs |
| privacy exclusion | CRM/private contact/header/HTML/secret URL survives serialization | explicit field allowlist plus recursive privacy rejection; incomplete status on unsafe loss |
| hash/schema parity | behavior/payload/artifact hash, schema-v3, C5-A schema, count, or shadow publication parity diverges | exact schemas/validator; canonical hashes; cross-record validation |
| budget parity | reused snapshot counts as fresh/network; provider exceeds 12/1-3/zero-retry | exact limits and ID-list parity |
| afternoon eligibility | scheduled afternoon success does not produce the exact run path | event+slot eligibility and receipt-time finalization |
| watchdog eligibility | automatic watchdog recovery with generation cannot produce the exact run path, or observation-only watchdog replaces it | only actual automatic recovery generation is eligible |
| manual exclusion | workflow_dispatch/forced/manual label can create an acceptance corpus or rescue a date | event-name exclusion independent of slot label |
| workflow boundary | push trigger/new schedule/new step/new sync/retry is introduced | triggers remain schedule/workflow_dispatch; existing commit plumbing only |
| no live tests | any focused test can reach global fetch or real provider | injected fixtures; network sentinel throws on any live access |

The accepted RED snapshot must fail only for these missing C5-B behaviors. GREEN must be the smallest implementation inside the allowlist.

## Verification Gates

All verification uses an exact GitHub API snapshot in a disposable directory, never a local CRM checkout/worktree.

Required:

1. Final start-gate recheck of latest main, proposal/implementation refs, PR queue, workflow blobs, production rule blobs, behavior source, QA checkpoint, and receipt.
2. Allowlist-only compare from implementation base to head.
3. Denylist blob-SHA guard.
4. `jq empty` for replay schemas, shadow candidate schema, and shadow rule JSON.
5. `node --check` for every added/modified MJS file.
6. Exact archived focused tests for obtainable evidence, second-pass orchestration, and Replay Corpus Contract.
7. New shadow candidate-audit, collector, and integration tests, all GREEN.
8. Focused union covering Blocker 2, Blocker 3, C5-A, and C5-B.
9. Static workflow assertions:
   - no `push` trigger;
   - existing cron values unchanged;
   - workflow_dispatch inputs unchanged;
   - permissions/concurrency unchanged;
   - production runner arguments, validation, sync, receipt status, and failure gate unchanged;
   - only the corpus path/finalizer metadata plumbing added.
10. Fixture-only provider scan; global network sentinel GREEN.
11. `npm run test:daily-v4`.
12. `npm run verify:all`.
13. `git diff --check`.
14. No generated production data, replay corpus, lockfile, or unapproved file in the implementation diff.
15. Production V7.2 object/payload golden hashes unchanged in integration tests.
16. Independent exact-head QA after implementation; P0=0 and P1=0 required before any merge/deploy proposal.

No live generator/provider, workflow dispatch, CRM sync, production replay, or deployment is part of verification.

## Definition of Done

C5-B implementation is done only when:

- it starts from a freshly verified latest main;
- all exact reusable blobs match this proposal or a re-diagnosed approved update;
- all new/adapted blobs and one behavior hash are frozen at exact GREEN head;
- the complete candidate universe, both regular lanes, bounded transactions, final decisions, evidence provenance, budgets, hashes, and privacy boundary validate;
- V7.2 rule, generator identity, reports, pools, payloads, validation, sync, receipt, UI/API, and Supabase behavior are unchanged;
- automatic afternoon/watchdog and manual exclusion tests pass;
- shadow/provider/finalizer failures cannot fail V7.2 delivery;
- allowlist/denylist and all verification gates pass;
- one implementation checkpoint records RED, GREEN, full verification, and exact remote state;
- implementation stops without PR creation unless separately authorized in the unified Phase 3/4 approval;
- merge, deployment, collection window, C5-C, and Activation remain separate approvals.

## Rollback

Rollback is a normal revert of the later C5-B implementation merge commit.

- Revert the post-output hook, safe finalizer/commit-path additions, and shadow-only modules/contracts/tests.
- Do not revert or alter V7.2 reports, candidate state, receipt, sync, PR B, or existing Leads.
- Do not delete already committed replay corpora; retain them as failed/pre-window evidence.
- No CRM cleanup, workflow dispatch, data replay, or Supabase action is required.
- If a shadow failure occurs before a revert, production continues; the affected date is ineligible.
- If rollback or any behavior change happens during a later active window, close that window as failed and restart only after C5-B and C5-C are redeployed with one frozen behavior hash.

## Stop Conditions

Stop and return to proposal if any of the following occurs:

- main, behavior source, QA ref, PR #107 base/head, workflow blob, proposal branch/path, or implementation base drifts unexpectedly;
- a non-data main change touches any dependency or allowlisted/denylisted integration path;
- an exact reusable blob cannot be rehomed without semantic change;
- lossless capture requires private CRM data, raw HTML, headers, secrets, personal contact data, or post-decision truncation;
- the shadow path can mutate, delay beyond the bounded contract, fail, or replace V7.2 report/pool/payload/sync behavior;
- provider requests, actions, retries, signals, or transactions cannot be bounded and fully recorded;
- a new workflow trigger, step, permission, dispatch, sync, retry, or deployment is proposed;
- any production rule/schema/report/reader text or activation-sensitive denylist path must change;
- any quota, backfill, minimum Lead, zero-day bypass, relaxed independent-quality role, or Bilibili official/developer/publisher substitution is proposed;
- C5-A schema/validator and runtime corpus cannot reach hash/schema/count/privacy parity;
- implementation needs a new dependency, package/test-runner change, or path outside the allowlist;
- a later active window sees behavior, schema, provider, budget, selector, or collector hash drift.

## Independent QA Boundary

After Phase 4 implementation and exact verification, an independent read-only QA reviewer may inspect the remote exact head.

Required QA questions:

- Is every changed path on the allowlist and every denylist blob unchanged?
- Can any reference flow from shadow back into production objects?
- Can any provider/collector/finalizer failure change V7.2 exit, report, validation, sync, or receipt?
- Are every candidate, lane, transaction, evidence ID, role, URL, decision, count, and hash bound?
- Are official/developer/publisher/keyword/unclassified excluded from independent quality and Bilibili limited to media/trusted_creator?
- Can workflow_dispatch/manual/forced runs become acceptance eligible?
- Did any live provider, workflow, sync, replay, deployment, UI/API, or Supabase path run?
- Does exact-head focused/Daily/verify-all evidence reproduce?

Any P0/P1 finding blocks merge/deploy and returns to Phase 2.

## Sequence After C5-B

1. Phase 3/4 approval may authorize only the bounded C5-B implementation and exact verification.
2. Independent QA and a separate merge/deployment decision follow.
3. Only after deployed C5-B is stable may C5-C offline replay/window work start under a separate proposal/approval boundary.
4. The 15-consecutive-Shanghai-day window does not start from C5-B-only data.
5. The window starts only after both C5-B and C5-C are deployed and the complete behavior dependency manifest/hash is frozen.
6. Any incomplete date or behavior/schema/budget drift closes the window as failed and restarts it on a later complete date.
7. Activation remains a separate decision after corpus integrity, deterministic replay, quality/safety, 10-of-15 liveness, three-day coverage, and human review gates.

## Phase 3/4 Approval Boundary

One decision only:

Approve the frozen C5-B design and authorize one bounded small-TDD Phase 4 implementation from the then-latest exact remote main, limited to the 21-path allowlist and all stated denylist, failure-isolation, privacy, RED-to-GREEN, verification, checkpoint, and independent-QA gates, with no PR creation, merge, deployment, workflow dispatch, live provider, CRM sync, production replay, C5-C, 15-day window, or V7.3 activation?

Until that single approval is explicit, stop here.
