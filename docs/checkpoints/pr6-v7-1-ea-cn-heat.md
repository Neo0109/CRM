# PR 6 V7.1 EA / 中文热度全量通道 Checkpoint

## Current Goal

Deliver only PLAN.md PR 6: V7.1 EA / 中文热度全量通道, through merge, deployment, and production acceptance.

## Completed

- Fetched latest `origin/main` at `d98009bc5b8dad3ae81e304839fdc950a200248b`.
- Created branch `codex/pr6-v7-1-ea-cn-heat` from that commit.
- Created independent worktree `/Users/neo/Documents/GitHub/CRM-pr6-v7-1-ea-cn-heat`.
- Confirmed the worktree root already contains tracked `PLAN.md`.
- Verified `PLAN.md` is byte-identical to `/Users/neo/Downloads/PLAN.md`; both SHA-256 values are `bdcb4ff6c07ccb19ddfe4f261c4ea08bf0346bdcb762680c3bda7ef8aa053217`.
- Read `AGENTS.md`, the authoritative `PLAN.md`, this checkpoint, and `docs/CODEX_DELIVERY_WORKFLOW.md` from planning commit `ef2dd37344e40df79e4bc5e2d4e9b234d429026b` because that delivery document is not yet present on `origin/main`.
- Recorded the only unrelated open PR as `#71`; it will not be touched.
- PR 0 through PR 5 are treated as completed upstream per user instruction; PR 5 will not be rechecked, modified, or repeated.
- This task touches only PR 6: the independent Steam review opportunity workflow and its PR 6 contracts.
- Explicit exclusions: main daily workflow triggers/execution chain, PR 7+, UI/product work, database migrations, production-data edits, secrets/accounts/permissions, and unrelated historical failures.
- Diagnosis completed without rechecking or changing PR 5:
  - The accepted PR 5 layer ends at `steam_review_opportunity_audit.mjs` and a schema-validated audit artifact; it intentionally has no workflow, run mode, historical threshold-crossing state, Lead payload, CRM import, or sync receipt.
  - Putting the full-catalog scan into either existing Daily workflow would widen the regular automation failure surface and violate the locked PR 6 boundary.
  - The existing create-only API already provides the required safety invariant: Steam AppID/dedupe matches are skipped, `updated=0`, and existing records are not rewritten.
  - Scheduled delivery needs prior complete audit artifacts to suppress already-qualified AppIDs while still allowing newly discovered or first-crossing AppIDs.
- Implementation design fixed from the approved PLAN (no business re-planning):
  - Add a separate V7.1 machine-readable rule source and a pure delivery module that maps every eligible qualified opportunity to one create-only Lead payload with no cap; `china_heat_ops` remains primary when both rules match and all matched rules remain in audit/Lead rule text.
  - Map workflow `mode=backfill` to Lead `sourcing_run_type=initial_backfill`; auto mode remains backfill until a strict successful backfill receipt exists, then resolves to `scheduled`.
  - Add an independent workflow containing only `schedule` and `workflow_dispatch`; it runs an unbounded full scan, validates and commits the audit, blocks CRM sync unless `scan_complete=true`, then calls only `POST /api/leads/import-daily-report?mode=create-only`.
  - Add a dedicated receipt contract recording catalog scan count, qualified count, previously-qualified suppression, import candidates, deduplicated/skipped-existing count, created count, and the structured sync response. Success requires `scan_complete=true`, `status=success`, `sync_response.synced=true`, and `updated=0`.
  - Keep `.github/workflows/sync-daily-report.yml` and `.github/workflows/daily-report-watchdog.yml` unchanged.

## Remaining

- Implement the pure PR 6 delivery selection, Lead mapping, receipt contract, schemas, fixed fixtures, and narrow tests.
- Implement the independent workflow and PR 6 operational documentation.
- Run all final validation and deliver the PR.
- Commit, push, open PR, monitor CI, and squash merge.
- Verify build, Cloudflare deployment, production `/api/health`, and PR 6 online acceptance.

## Next Action

Write the PR 6 fixed-fixture tests first, then implement the pure delivery and receipt contracts until those narrow tests pass.

## Git Status

- Branch: `codex/pr6-v7-1-ea-cn-heat`
- Base: `origin/main` at `d98009bc5b8dad3ae81e304839fdc950a200248b`
- Worktree: checkpoint file newly added; `PLAN.md` unchanged and already tracked; no business implementation changes yet.
