# PR 1 Lead/API Contract Checkpoint

Date: 2026-07-15 18:09 CST

Last updated: 2026-07-15 19:05 CST

Authoritative plan: `/Users/neo/Downloads/PLAN.md`

Phase status: PR 1 Step 1 and Step 2 implementation and verification are complete. Step 2 is ready for its authorized local commit; PR 1 has no remaining implementation steps.

## Current Goal

Implement and commit only PLAN.md PR 1 Step 2: add `POST /api/leads/import-daily-report?mode=create-only` with create-only persistence and explicit skip accounting.

## Scope

- Only create Leads whose Steam AppID, canonical dedupe keys, and generated ID do not match an existing Lead.
- Count matching incoming rows in `skipped_existing` without merging or rewriting any existing Lead fields.
- Return `synced=true` for successful `mode=create-only` responses.
- Preserve the existing default import behavior when `mode=create-only` is omitted.
- Continue storing the complete Lead object under the existing `crm_leads.data` JSON column.
- Add no Supabase migration, schema column, workflow, UI, or sourcing-rule change.

Explicitly out of scope:

- No PR 2 UI behavior.
- No workflow or production-data changes.
- No push or PR creation.

## Completed

- PR 1 Step 1 was committed as `c603634254fffb3dd2d02f40a5c18ef6945f4acc`.
- Added the minimal create-only tests before implementation. The red run failed because the canonical helper, backend repository create method, query-mode route, and `synced=true` response did not yet exist.
- Added canonical `createOnlyIncomingLeadSet` behavior that:
  - compares existing and in-request Leads through the established Steam AppID/project/link dedupe keys plus Lead ID;
  - returns only newly created Leads for persistence;
  - counts all matches in `skipped_existing`;
  - leaves the existing Lead array and fields unchanged;
  - reports `updated=0` and create-only import stats.
- Added Functions API routing for exact `mode=create-only` requests while leaving the default merge branch unchanged.
- Added a create-only Supabase REST write using `resolution=ignore-duplicates`, with rows still shaped as `{ id, data, updated_at }` and the Lead stored inside `data`.
- Added backend canonical-model parity, Express route handling, and repository create writes using `ignoreDuplicates: true`; the JSON fallback appends only new normalized Leads.
- Confirmed a successful create-only response includes `synced=true`, while the default response and merge write preference remain unchanged.
- Verification passed:
  - initial focused red run: expected failure before implementation
  - focused green run: 18/18
  - CRM core: 27/27
  - backend: 21/21
  - API direct tests: 2/2
  - Functions typecheck: passed
  - frontend and backend workspace typechecks: passed
  - `git diff --check`: passed before the checkpoint update

## Remaining

- No remaining PR 1 implementation steps.
- Commit this verified Step 2 with `feat: add create-only daily report import`.
- Do not enter PR 2, push, or create a PR in this task.

## Next Action

Run the final post-checkpoint `git diff --check`, review the staged file set, commit with the authorized message, and stop.

## Git Status

- Worktree: `/Users/neo/Documents/GitHub/CRM-pr1-lead-api-contract`
- Branch: `codex/pr1-lead-api-contract`
- Upstream comparison before the Step 2 commit: `origin/main` (`ahead 1, behind 2`)
- HEAD before the Step 2 commit: `c603634254fffb3dd2d02f40a5c18ef6945f4acc`
- Expected post-commit state: clean worktree with Step 1 and Step 2 as two local commits; branch remains unpushed.

```text
## codex/pr1-lead-api-contract...origin/main [ahead 1, behind 2]
 M app/backend/src/lib/backendLeadModel.ts
 M app/backend/src/lib/leadRepository.ts
 M app/backend/src/server.ts
 M app/backend/test/backendLeadModelParity.test.ts
 M app/backend/test/backendRepository.test.ts
 M app/backend/test/serverContract.test.ts
 M docs/checkpoints/pr1-lead-api-contract.md
 M functions/_lib/crm.ts
 M functions/_lib/leadModel.ts
 M functions/api/leads/import-daily-report.ts
 M functions/test/leadModel.test.ts
?? functions/test/importDailyReport.test.ts
```
