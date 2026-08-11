# V7.3 Evidence Actionability — Release Captain Checkpoint

## Current Goal

Repair the independent-QA binding defects and strict source-role review finding on the existing Wave 1 branch/PR while preserving the privacy-safe collector v2 envelope, historical v1 replay, and frozen provider contract.

## Completed

- Frozen remote baseline: `main@1a660c049503058a5746a58e2ceed4ef27f351b9`.
- Confirmed open PR queue is empty and target branch `codex/v73-evidence-actionability` does not exist.
- Created a disposable non-git snapshot from the exact remote base; the local CRM checkout remains read-only.
- Completed Wave 1 diagnosis: all 12 natural-run attempts were transport-successful no-ops on `independent_quality_proof`; no V7.2, privacy, workflow, provider transport, or CRM failure was found.
- Created remote branch `codex/v73-evidence-actionability` and committed this initial checkpoint at `6656fff7a8c1ee2891ad4aeb68ef37346cf26699`.
- Added focused RED contracts for:
  - actionability-first selection plus exact legacy ordering on actionability ties;
  - deterministic no-network comparison across the real 2026-08-11 corpus's 60 eligible candidates by re-evaluating each frozen first-pass input and analyzing the recorded bounded signals;
  - collector v2 evidence diagnostics while preserving `provider_status=success` for an empty allowlisted patch;
  - historical collector v1 acceptance and mandatory v2 transaction/summary diagnostics.
- Corrected the RED interface to the approved evidence outcomes: `evidence_found`, `no_project_match`, `source_role_rejected`, `quality_keyword_missing`, `insufficient_independent_sources`, and `not_requested`. Provider failures remain exclusively in `provider_status` and `second_pass_failed_count`.
- RED command: `node --test automations/test/onlineDailyV73SecondPassOrchestrator.test.mjs automations/test/onlineDailyV73ShadowCollector.test.mjs automations/test/onlineDailyV73ReplayCorpusContract.test.mjs`.
- Corrected RED result: 65 tests, 59 passed, 6 expected failures. Failures are limited to the missing pure analyzer, v2 schema/validator, selector prioritization/comparator, and collector v2 diagnostics.
- Implemented GREEN without expanding the provider contract:
  - pure evidence-availability diagnostics with the six approved outcomes and privacy-safe counts;
  - `actionability-v2` ranking before the exact frozen legacy tie keys;
  - collector contract v2 transactions and summary outcome histogram while retaining historical v1 validation;
  - offline replay support for the v2 ranking input and outcome summary.
- Root review identified a P1 gap in the first GREEN: actionability counted only the locally satisfiable quality gate even though the unchanged provider contract also performs official lookup for three requested gate actions.
- Added a focused P1 RED proving a lower-score official-lookup candidate must outrank a quality-only candidate with no local quality signal. The RED selected the legacy high-score candidate and failed as expected.
- Corrected actionability to count unique provider-backed requested gate IDs for `fetch_official_playable_or_gameplay`, `fetch_non_steam_business_entry`, and `research_china_bilibili_value`, plus the locally satisfiable quality gate. The same injected evaluator now drives both candidate admission and availability analysis; quality-absent diagnostics remain `not_requested`.
- Evidence-derived 60-candidate comparison re-evaluates every stored first-pass input with the real V7.3 evaluator and the natural transaction's bounded signals. Repeated results are identical; the corrected actual histogram is 20 candidates at actionability 0, 37 at 1, and 3 at 2. Provider-backed tiers sort first while exact legacy order remains unchanged within each tier.
- GREEN command: `node --test automations/test/onlineDailyV73SecondPassOrchestrator.test.mjs automations/test/onlineDailyV73ShadowCollector.test.mjs automations/test/onlineDailyV73ReplayCorpusContract.test.mjs automations/test/onlineDailyV73OfflineReplay.test.mjs`.
- Post-review GREEN result: 82 tests passed, 0 failed. No live fetch, provider, workflow, CRM, or Supabase call was made.
- Required final gates on the corrected exact snapshot:
  - `npm run test:daily-v4`: 293 passed, 0 failed;
  - `npm run verify:all`: exit 0, including frontend/backend/Functions tests, automation tests, typechecks, production build, Daily contract, and `git diff --check`.
- Final remote compare from the frozen base is 9 allowed files, +881/-44, with no workflow, V7.2 admission, provider-contract, CRM, Supabase, or generated-data file.
- Reconfirmed remote `main@1a660c049503058a5746a58e2ceed4ef27f351b9`, branch head `058fa58d2825351a0c3897b899b74b3047b8f98a`, and open PR count 0 before final checkpoint publication.
- Opened ready PR #115 and stopped without merge; pre-repair head was `c6f5c9f2c001ce45ed7a119b8e3e73aa48821570` (tree `d58bf8e19267fb4bf3beb1b92f8998fdff750b2c`).
- Independent QA found a P1 binding defect: offline replay trusted stored `ranking_inputs.actionable_gate_count`, the stored decision view omitted that count, and collector v2 did not persist one globally frozen bounded signal projection for independent recomputation.
- Codex review thread `discussion_r3758019597` found a second P1: non-Bilibili `official`, `developer`, `keyword`, and `unclassified` signals were accepted as independent quality proof even though only `media` and `trusted_creator` are authorized.
- Added repair RED contracts for:
  - one capped global `second_pass.bounded_signals` projection shared by analyzer, provider request, each transaction, and replay;
  - mandatory v2 `actionability-v2`, eligible-candidate actionability counts, selected transaction/count cross-binding, and canonical global/transaction signal equality;
  - independent offline recomputation from frozen first-pass input, requested actions, and global bounded signals, with count/order tamper mutations required to raise `REPLAY_MISMATCH`;
  - rejection of `official`, `developer`, `keyword`, and `unclassified` independent-quality signals across all signal origins.
- Repair RED command: `node --test automations/test/onlineDailyV73SecondPassOrchestrator.test.mjs automations/test/onlineDailyV73ShadowCollector.test.mjs automations/test/onlineDailyV73ReplayCorpusContract.test.mjs automations/test/onlineDailyV73OfflineReplay.test.mjs`.
- Repair RED result: 85 tests, 79 passed, 6 expected failures. Failures are confined to the missing global bounded-signal field/schema, v2 validator binding, independent replay recomputation, and strict non-media source-role rejection.
- Published the coherent repair RED to the existing branch at `8d69f43058764d97a4276f21dca0e875c927df3e` (tree `aa51a661f8de67bc97b411e97f5fa55b77ecb16c`).
- Implemented repair GREEN within the approved Wave 1 files:
  - collector v2 now creates one privacy-safe 24-signal projection and reuses it unchanged for analysis, provider input, run-level `second_pass.bounded_signals`, and every transaction;
  - schema and validator require `actionability-v2` plus nonnegative counts for every v2 eligible candidate, bind selected candidate counts to transaction diagnostics, and require canonical global/transaction signal equality;
  - offline replay imports the pure availability analyzer and recomputes actionability from frozen first-pass inputs, evaluator-derived requested actions, and run-level bounded signals; stored and replay views expose the count so recomputed count/order mutations raise `REPLAY_MISMATCH`;
  - independent quality now accepts only explicitly classified `media` or `trusted_creator` signals for every origin; `official`, `developer`, `keyword`, and `unclassified` are rejected.
- Repair focused GREEN: 85 tests passed, 0 failed. Historical collector v1 replay remains covered, and no live network/provider/workflow/CRM/Supabase action was used.

## Remaining

- Publish the checkpointed GREEN on the same branch, run `test:daily-v4` and `verify:all`, publish the final checkpoint, update PR #115, and resolve the review thread only after all fixes are pushed.

## Next Action

Publish the checkpointed GREEN through the GitHub API, then run the required full gates on the exact snapshot.

## Git Status

- Remote truth: `Neo0109/CRM main@1a660c049503058a5746a58e2ceed4ef27f351b9`.
- Remote PR: ready PR #115, open and unmerged.
- Branch: `codex/v73-evidence-actionability`.
- Remote branch repair RED head: `8d69f43058764d97a4276f21dca0e875c927df3e`.
- Local CRM checkout: read-only and intentionally ignored.
- Working implementation area: disposable non-git snapshot only.

## Frozen Scope

- Allowed: V7.3 second-pass orchestrator; directly required shadow collector/replay-contract modules; replay-corpus schema; focused V7.3 tests; this checkpoint.
- Not allowed: V7.2 admission changes, provider-contract expansion, workflow edits or dispatch, CRM/Supabase writes, generated production data, media-rule Wave 2, merge, or deploy.
