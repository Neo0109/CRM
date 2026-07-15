# PR 2 Priority UI Checkpoint

Date: 2026-07-15 CST

Authoritative plan: `/Users/neo/Downloads/PLAN.md`

Delivery protocol: `/Users/neo/Documents/GitHub/CRM/docs/CODEX_DELIVERY_WORKFLOW.md`

Phase status: PR 2 authorized; isolated branch and worktree created from current remote `main`; diagnosis and implementation pending.

## Current Goal

Deliver only PLAN.md PR 2: make nullable Lead priority an explicit human workflow in the frontend by showing “未标注” in list, detail, and filters; sorting null after P0-P3; allowing users to set or clear priority; and preventing exports from containing the literal `null`.

## Scope

- Frontend priority presentation, sorting, filtering, editing, clearing, and export behavior.
- Focused frontend regression tests and any directly required frontend contract fixtures.
- This checkpoint and the PR description/test documentation required by the delivery protocol.

Explicitly out of scope:

- PR 3 or any later PLAN.md work.
- Sourcing qualification rules, Daily V4 generation, Radar, Steam Trends, automation workflows, or trigger boundaries.
- Backend/API contract changes already delivered by PR 1.
- Supabase schema or migration work, production-data mutation, secrets, accounts, or permissions.

## Baseline

- Repository: `Neo0109/CRM`.
- Remote `main`: `6376b96aa025cf3eeb8ecb3b22ed96b6953bf669` (`feat: add Lead API contract and create-only import (#87)`).
- Main Build: success, run `29411733100`.
- Open PR queue: unrelated PR `#71` only.
- Branch: `codex/pr2-priority-ui`.
- Worktree: `/Users/neo/Documents/GitHub/CRM-pr2-priority-ui`.
- Starting HEAD: `6376b96aa025cf3eeb8ecb3b22ed96b6953bf669`.

## Completed

- Read the authoritative PLAN.md, repository AGENTS.md, and Codex autonomous delivery workflow.
- Verified GitHub CLI availability/authentication and repository identity.
- Fetched current `origin/main` and confirmed PR 1 is merged into the baseline.
- Confirmed only unrelated PR `#71` is open and no Actions run was queued or in progress at baseline inspection.
- Created this independent branch and worktree without touching the dirty planning worktree.

## Remaining

- Verify initial production `/api/health` and deployed UI baseline.
- Diagnose all frontend priority list/detail/filter/sort/edit/export paths and existing tests.
- Implement PR 2 in independently verifiable TDD steps, updating this checkpoint and committing each completed step.
- Run focused frontend tests, frontend typecheck, relevant contract/schema checks, frontend production build, `npm run verify:all`, and `git diff --check`.
- Push, open a ready PR to `main`, wait for CI, verify scope/mergeability/reviews, and squash merge when clean.
- Verify merged `main`, Build/deployment, production `/api/health`, and browser acceptance; record final evidence here and stop.

## Next Action

Inspect the existing frontend priority and export contracts plus initial production health, then write the smallest failing tests for PR 2 without changing backend, sourcing, automation, schema, or production data.

## Git Status

```text
## codex/pr2-priority-ui...origin/main
?? docs/checkpoints/pr2-priority-ui.md
```
