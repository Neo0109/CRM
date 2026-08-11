# V7.3 Evidence Actionability — Release Captain Checkpoint

## Current Goal

Implement privacy-safe V7.3 evidence diagnostics, actionability-first second-pass selection, and a backward-compatible replay collector v2 on remote `main@1a660c049503058a5746a58e2ceed4ef27f351b9`, then open one ready PR to `main`.

## Completed

- Frozen remote baseline: `main@1a660c049503058a5746a58e2ceed4ef27f351b9`.
- Confirmed open PR queue is empty and target branch `codex/v73-evidence-actionability` does not exist.
- Created a disposable non-git snapshot from the exact remote base; the local CRM checkout remains read-only.
- Completed Wave 1 diagnosis: all 12 natural-run attempts were transport-successful no-ops on `independent_quality_proof`; no V7.2, privacy, workflow, provider transport, or CRM failure was found.

## Remaining

- Add RED focused tests for v2 diagnostics, summary outcome counts, v1 compatibility, stable actionability-first selection, and the 60-eligible offline comparison.
- Implement the bounded V7.3 changes and update the replay-corpus schema.
- Run focused tests, `npm run test:daily-v4`, and `npm run verify:all` in the disposable exact-base snapshot.
- Publish one GitHub-API commit on `codex/v73-evidence-actionability` and open one ready PR to `main`.

## Next Action

Inspect only the directly involved V7.3 contracts and tests, then add the RED contract tests before implementation.

## Git Status

- Remote truth: `Neo0109/CRM main@1a660c049503058a5746a58e2ceed4ef27f351b9`.
- Remote open PRs: `0`.
- Planned branch: `codex/v73-evidence-actionability`.
- Local CRM checkout: read-only and intentionally ignored.
- Working implementation area: disposable non-git snapshot only.

## Frozen Scope

- Allowed: V7.3 second-pass orchestrator; directly required shadow collector/replay-contract modules; replay-corpus schema; focused V7.3 tests; this checkpoint.
- Not allowed: V7.2 admission changes, provider-contract expansion, workflow edits or dispatch, CRM/Supabase writes, generated production data, media-rule Wave 2, merge, or deploy.
