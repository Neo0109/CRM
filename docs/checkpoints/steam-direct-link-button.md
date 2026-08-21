# Steam Direct Link Button Checkpoint

## Current Goal

Deliver the approved global invariant for the Leads review UI: every Lead that can display `Steam已验` also exposes a direct canonical Steam store shortcut.

## Completed

- Phase 1 Diagnosis: confirmed badge/link extraction divergence and pre-dedupe truncation on remote `main`.
- Phase 2 Proposal and Phase 3 Approval completed.
- Phase 4 baseline: remote `main` remains `dd989f25173f0777afd735946d4bb22e777901a5`; open PR queue remains empty.
- Production baseline: `/api/health` was healthy at `v2.8-communication-follow-up` with `storage=supabase`.
- TDD red: the invariant test failed because `buildLeadLinkShortcuts` did not exist.
- Implementation commit `f5cb623e4e6d87fbc97e86ce3790d1ca6fe5073b`: shared canonical Steam resolver, Steam-first shortcut builder, list/detail wiring, regression tests, and `v2.8.1-steam-direct-link-button` version governance.
- Exact-head verification passed: 37 focused tests, full frontend tests, frontend and Functions typechecks, CRM core tests, frontend build, `verify:all`, and `git diff --check origin/main...HEAD`.

## Remaining

- Open the product PR and require green GitHub Actions on the exact PR head.
- Merge, confirm the main/deployment commit and production health.
- Run the read-only invariant audit when authenticated Lead data is available and complete visual acceptance when access permits.

## Next Action

Open the PR from `codex/steam-direct-link-button` to `main`, then follow the exact head through Actions.

## Git Status

- Truth source: remote GitHub only.
- Branch: `codex/steam-direct-link-button`.
- Base: `dd989f25173f0777afd735946d4bb22e777901a5`.
- Verified implementation head: `f5cb623e4e6d87fbc97e86ce3790d1ca6fe5073b`.
- Local CRM worktree: read-only and intentionally untouched.
- Scope exclusions: sourcing rules, Daily V4, API/schema, Supabase, automation, and per-record Lead data.
