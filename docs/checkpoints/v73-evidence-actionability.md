# V7.3 Evidence Actionability — Release Captain Checkpoint

## Current Goal

Implement privacy-safe V7.3 evidence diagnostics, actionability-first second-pass selection, and a backward-compatible replay collector v2 on remote `main@1a660c049503058a5746a58e2ceed4ef27f351b9`, then open one ready PR to `main`.

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
- Evidence-derived 60-candidate comparison re-evaluates every stored first-pass input with the real V7.3 evaluator and the natural transaction's bounded signals. Repeated results are identical, all 60 currently have `actionable_gate_count=0`, and their exact legacy order is preserved.
- GREEN command: `node --test automations/test/onlineDailyV73SecondPassOrchestrator.test.mjs automations/test/onlineDailyV73ShadowCollector.test.mjs automations/test/onlineDailyV73ReplayCorpusContract.test.mjs automations/test/onlineDailyV73OfflineReplay.test.mjs`.
- GREEN result: 81 tests passed, 0 failed. No live fetch, provider, workflow, CRM, or Supabase call was made.

## Remaining

- Run focused tests, `npm run test:daily-v4`, and `npm run verify:all` in the disposable exact-base snapshot.
- Publish the GREEN checkpoint and implementation through the GitHub API, run final exact-head validation, then open one ready PR to `main`.

## Next Action

Run the required full validation gates, publish the exact tested snapshot, and stop at one ready PR without merge or deploy.

## Git Status

- Remote truth: `Neo0109/CRM main@1a660c049503058a5746a58e2ceed4ef27f351b9`.
- Remote open PRs: `0`.
- Planned branch: `codex/v73-evidence-actionability`.
- Remote branch corrected RED head: `d7d924da1bdd68673a9089cf1abfe6d81e0fd860`.
- Local CRM checkout: read-only and intentionally ignored.
- Working implementation area: disposable non-git snapshot only.

## Frozen Scope

- Allowed: V7.3 second-pass orchestrator; directly required shadow collector/replay-contract modules; replay-corpus schema; focused V7.3 tests; this checkpoint.
- Not allowed: V7.2 admission changes, provider-contract expansion, workflow edits or dispatch, CRM/Supabase writes, generated production data, media-rule Wave 2, merge, or deploy.
