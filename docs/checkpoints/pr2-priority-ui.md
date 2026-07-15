# PR 2 Priority UI Checkpoint

Date: 2026-07-15 CST

Authoritative plan: `/Users/neo/Downloads/PLAN.md`

Delivery protocol: `/Users/neo/Documents/GitHub/CRM/docs/CODEX_DELIVERY_WORKFLOW.md`

Phase status: PR 2 Step 1 nullable-priority UI workflow is implemented, narrowly verified, and ready to commit. Step 2 export serialization remains.

## Current Goal

Deliver only PLAN.md PR 2: make nullable Lead priority an explicit human workflow in the frontend by showing “未标注” in list, detail, and filters; sorting null after P0-P3; allowing users to set or clear priority; and preventing exports from containing the literal `null`.

## Scope

- Frontend priority presentation, sorting, filtering, editing, and clearing behavior.
- Cloud Functions and local-backend export serialization changes directly required to keep an unlabeled priority from appearing as literal `null`.
- Focused frontend regression tests and any directly required frontend contract fixtures.
- This checkpoint and the PR description/test documentation required by the delivery protocol.

Explicitly out of scope:

- PR 3 or any later PLAN.md work.
- Sourcing qualification rules, Daily V4 generation, Radar, Steam Trends, automation workflows, or trigger boundaries.
- Lead import/API contract or persistence changes already delivered by PR 1; only PR 2 export presentation is in scope.
- Supabase schema or migration work, production-data mutation, secrets, accounts, or permissions.

## Baseline

- Repository: `Neo0109/CRM`.
- Remote `main`: `6376b96aa025cf3eeb8ecb3b22ed96b6953bf669` (`feat: add Lead API contract and create-only import (#87)`).
- Main Build: success, run `29411733100`.
- Open PR queue: unrelated PR `#71` only.
- Branch: `codex/pr2-priority-ui`.
- Worktree: `/Users/neo/Documents/GitHub/CRM-pr2-priority-ui`.
- Starting HEAD: `6376b96aa025cf3eeb8ecb3b22ed96b6953bf669`.
- Initial production health: HTTP `200`, `ok=true`, version `v2.7.6-sourcing-evidence-integrity`, storage `supabase`.

## Completed

- Read the authoritative PLAN.md, repository AGENTS.md, and Codex autonomous delivery workflow.
- Verified GitHub CLI availability/authentication and repository identity.
- Fetched current `origin/main` and confirmed PR 1 is merged into the baseline.
- Confirmed only unrelated PR `#71` is open and no Actions run was queued or in progress at baseline inspection.
- Created this independent branch and worktree without touching the dirty planning worktree.
- Restored ignored local dependencies with `npm install --package-lock=false`; no lock file or tracked dependency artifact was created.
- Verified the initial production `/api/health` baseline is healthy.
- Diagnosed the PR 2 paths: frontend types did not accept null, list/detail/secondary surfaces rendered raw priority, filters had no priority dimension, the main list did not enforce priority order, the detail editor could not clear priority, and JSON exports serialized null priority literally while CSV/Excel already rendered it blank.
- Added a shared frontend nullable-priority presentation contract with `未标注`, a neutral tone, explicit selection mapping, and rank P0 -> P1 -> P2 -> P3 -> null.
- Added the priority filter, stable priority sorting, list/detail presentation, detail set/clear control, neutral CSS, and matching labels across Calendar, Weekly Report, and Assistant summaries.
- Changed manual Lead intake to default to explicit `未标注` and serialize that choice as `priority=null`, while retaining P0-P3 choices.
- Added `app/frontend/test/priorityWorkflow.test.mjs` with four TDD cases covering presentation, ordering, filtering, and set/clear wiring.
- Step 1 red test: 0/4 passed before implementation, with failures for literal `null 低`, unsorted null priority, missing filter behavior, and missing editor wiring.
- Step 1 green test: 4/4 passed.
- Related frontend regression tests passed 32/32; frontend typecheck passed; `git diff --check` passed.

## Remaining

- Commit verified Step 1.
- Implement and verify Step 2 export serialization so null priority is blank in human exports and never emitted as the literal priority value `null`.
- Run focused frontend tests, frontend typecheck, relevant contract/schema checks, frontend production build, `npm run verify:all`, and `git diff --check`.
- Push, open a ready PR to `main`, wait for CI, verify scope/mergeability/reviews, and squash merge when clean.
- Verify merged `main`, Build/deployment, production `/api/health`, and browser acceptance; record final evidence here and stop.

## Next Action

Commit Step 1, then add the smallest failing export-contract tests and implement only the priority export presentation required by PR 2.

## Git Status

```text
## codex/pr2-priority-ui...origin/main [ahead 1]
 M app/frontend/src/CalendarLauncher.tsx
 M app/frontend/src/ManualImportPage.tsx
 M app/frontend/src/WeeklyReportLauncher.tsx
 M app/frontend/src/assistantQuality.ts
 M app/frontend/src/features/leads/LeadDetail.tsx
 M app/frontend/src/features/leads/LeadsView.tsx
 M app/frontend/src/features/leads/leadConstants.ts
 M app/frontend/src/features/leads/leadFilters.ts
 M app/frontend/src/followUpQueue.ts
 M app/frontend/src/funnel-workflow.css
 M app/frontend/src/leadTriage.ts
 M app/frontend/src/types.ts
 M docs/checkpoints/pr2-priority-ui.md
?? app/frontend/src/leadPriority.ts
?? app/frontend/test/priorityWorkflow.test.mjs
```
