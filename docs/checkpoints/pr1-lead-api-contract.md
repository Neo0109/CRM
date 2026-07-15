# PR 1 Lead/API Contract Checkpoint

Date: 2026-07-15 18:09 CST

Last updated: 2026-07-15 18:46 CST

Authoritative plan: `/Users/neo/Downloads/PLAN.md`

Phase status: PR 1 Step 1 implementation and verification are complete. This checkpoint is included in the authorized local Step 1 commit; create-only import, UI work, push, and PR creation remain out of scope.

## Current Goal

Implement and commit only PLAN.md PR 1 Step 1: make Lead priority nullable and add sourcing provenance fields in the existing `crm_leads.data` JSON contract, using a minimal red-green TDD slice.

## Scope

Planned PR 1 contract scope, for a later approved implementation phase:

- Make Lead priority nullable: `"P0" | "P1" | "P2" | "P3" | null`.
- Add sourcing provenance fields:
  - `sourcing_lane: "indie_prelaunch" | "china_joint" | "ea_mobile_high_traction" | "china_heat_ops" | null`
  - `sourcing_rule_version: string | null`
  - `sourcing_run_type: "scheduled" | "initial_backfill" | null`
- Add `POST /api/leads/import-daily-report?mode=create-only` so only new Leads are written; existing Steam AppIDs or deduplication keys count toward `skipped_existing`, existing records are not rewritten, and a successful response includes `synced=true`.
- Keep these fields in the existing `crm_leads.data` JSON; do not add a Supabase migration.
- Preserve the default behavior of the existing import endpoint when `mode=create-only` is not requested.
- Later verification scope: CRM core, backend, API, type checks, and `npm run verify:all`.

Explicitly out of scope for this Step 1 implementation:

- No create-only import endpoint; that is the next PR 1 step.
- No UI, sourcing-rule, workflow, production-data, or Supabase migration changes.
- No push or PR creation.
- No PR 2 or later PLAN.md work.

## Completed

- Fetched and confirmed the latest remote baseline: `origin/main = 02c4bca2579fc60b35b3fefdb9899fbe69a3a89a`.
- Read the authoritative PLAN.md Lead/API contract and PR 1 scope.
- Created isolated worktree `/Users/neo/Documents/GitHub/CRM-pr1-lead-api-contract` and branch `codex/pr1-lead-api-contract` directly from the latest `origin/main`.
- Created the preparation checkpoint without modifying business code.
- Received explicit user approval to implement and commit PR 1 Step 1 only.
- Located `functions/_lib/leadModel.ts` as the canonical Lead model; the backend model delegates to it, and both Functions and backend repositories continue writing the normalized object into the existing `crm_leads.data` JSON payload.
- Added the minimal Lead contract test first. The red run failed because explicit `priority=null` normalized to `P2`.
- Implemented nullable priority plus `sourcing_lane`, `sourcing_rule_version`, and `sourcing_run_type` normalization and JSON-schema support without adding database columns or migrations.
- Kept omitted legacy priority behavior compatible (`P2` for the default `未处理` bucket) while preserving explicit `null`.
- The narrow green run passed 5/5 in `functions/test/leadModel.test.ts`.
- Added backend repository assertions proving the four contract fields remain nested inside the existing `crm_leads.data` JSON object; no new row columns or migration were introduced.
- Confirmed the backend adapter still delegates to the canonical Functions Lead model and exports the sourcing provenance types.
- Updated both Lead JSON schemas to accept nullable priority and optional nullable provenance fields without making current Daily V4 artifacts require the new fields.
- Kept null priority sorting deterministic in canonical and weekly-report data logic without implementing PR 2 UI labels, filters, or editing behavior.
- Verification passed:
  - canonical Lead tests: 5/5
  - backend model/parity/repository tests: 11/11
  - focused backend repository rerun: 2/2
  - Functions typecheck: passed
  - frontend and backend workspace typechecks: passed
  - sourcing Lead and daily-report schema contract checks: passed
  - `git diff --check`: passed after the final checkpoint update

## Remaining

- Implement create-only import only in the next separately authorized PR 1 step.
- Handle PR 2 UI behavior only in its own later task.
- Do not push or create a PR until separately authorized.

## Next Action

Commit the verified Step 1 changes with `feat: add sourcing provenance to lead contract`, then stop. Do not enter the create-only import step, push, or create a PR.

## Git Status

- Worktree: `/Users/neo/Documents/GitHub/CRM-pr1-lead-api-contract`
- Branch: `codex/pr1-lead-api-contract`
- Upstream: `origin/main`
- HEAD/base before the Step 1 commit: `02c4bca2579fc60b35b3fefdb9899fbe69a3a89a`
- Expected post-commit state: clean worktree with one local Step 1 commit on this branch; the branch remains unpushed.

```text
## codex/pr1-lead-api-contract...origin/main [behind 2]
 M app/backend/src/lib/backendLeadModel.ts
 M app/backend/test/backendRepository.test.ts
 M functions/_lib/leadModel.ts
 M functions/api/reports/weekly.ts
 M functions/test/leadModel.test.ts
 M schemas/daily_report.schema.json
 M schemas/sourcing_lead.schema.json
?? docs/checkpoints/pr1-lead-api-contract.md
```
