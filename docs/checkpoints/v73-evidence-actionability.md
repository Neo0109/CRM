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
  - deterministic no-network comparison across the real 2026-08-11 corpus's 60 eligible candidates;
  - collector v2 evidence diagnostics while preserving `provider_status=success` for an empty allowlisted patch;
  - historical collector v1 acceptance and mandatory v2 transaction/summary diagnostics.
- RED command: `node --test automations/test/onlineDailyV73SecondPassOrchestrator.test.mjs automations/test/onlineDailyV73ShadowCollector.test.mjs automations/test/onlineDailyV73ReplayCorpusContract.test.mjs`.
- RED result: 64 tests, 59 passed, 5 expected failures. Failures are limited to the missing v2 schema/validator, selector prioritization/comparator, and collector v2 diagnostics.

## Remaining

- Implement the bounded V7.3 changes and update the replay-corpus schema.
- Run focused tests, `npm run test:daily-v4`, and `npm run verify:all` in the disposable exact-base snapshot.
- Publish one GitHub-API commit on `codex/v73-evidence-actionability` and open one ready PR to `main`.

## Next Action

Implement the minimal orchestrator, collector, replay-contract, schema, and offline-replay changes required to turn the frozen RED contracts GREEN without expanding the provider contract or changing V7.2.

## Git Status

- Remote truth: `Neo0109/CRM main@1a660c049503058a5746a58e2ceed4ef27f351b9`.
- Remote open PRs: `0`.
- Planned branch: `codex/v73-evidence-actionability`.
- Remote branch checkpoint head before RED publication: `6656fff7a8c1ee2891ad4aeb68ef37346cf26699`.
- Local CRM checkout: read-only and intentionally ignored.
- Working implementation area: disposable non-git snapshot only.

## Frozen Scope

- Allowed: V7.3 second-pass orchestrator; directly required shadow collector/replay-contract modules; replay-corpus schema; focused V7.3 tests; this checkpoint.
- Not allowed: V7.2 admission changes, provider-contract expansion, workflow edits or dispatch, CRM/Supabase writes, generated production data, media-rule Wave 2, merge, or deploy.
