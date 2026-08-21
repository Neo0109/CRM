# Steam Direct Link Button Checkpoint

## Current Goal

Deliver the approved global invariant for the Leads review UI: every Lead that can display `Steam已验` also exposes a direct canonical Steam store shortcut.

## Completed

- Phase 1 Diagnosis: confirmed badge/link extraction divergence and pre-dedupe truncation on remote `main`.
- Phase 2 Proposal and Phase 3 Approval completed.
- Phase 4 baseline: remote `main` was `dd989f25173f0777afd735946d4bb22e777901a5`; open PR queue was empty.
- Production baseline: `/api/health` was healthy at `v2.8-communication-follow-up` with `storage=supabase`.
- TDD red: the invariant test failed because `buildLeadLinkShortcuts` did not exist.
- Implementation prepared: shared canonical Steam resolver, Steam-first shortcut builder, list/detail wiring, regression tests, and `v2.8.1-steam-direct-link-button` version governance.

## Remaining

- Verify the exact remote branch head with focused tests, frontend typecheck/build, `verify:all`, and diff checks.
- Open the product PR and require green GitHub Actions.
- Merge, confirm deployment health, run the read-only invariant audit when authenticated data is available, and complete visual acceptance when access permits.

## Next Action

Create the atomic implementation commit, verify its exact head, then open the PR.

## Git Status

- Truth source: remote GitHub only.
- Branch: `codex/steam-direct-link-button`.
- Base: `dd989f25173f0777afd735946d4bb22e777901a5`.
- Local CRM worktree: read-only and intentionally untouched.
- Scope exclusions: sourcing rules, Daily V4, API/schema, Supabase, automation, and per-record Lead data.
