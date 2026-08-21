# Steam Direct Link Button Checkpoint

## Current Goal

Implement the approved global invariant for the Leads review UI: every Lead that can display `Steam已验` must also expose a direct canonical Steam store shortcut.

## Completed

- Phase 1 Diagnosis: confirmed badge/link extraction divergence and pre-dedupe truncation on remote `main`.
- Phase 2 Proposal: approved global shared-resolver and shortcut-priority plan.
- Phase 3 Approval: user explicitly requested implementation.
- Phase 4 baseline: remote `main` is `dd989f25173f0777afd735946d4bb22e777901a5`; open PR queue is empty.
- Production baseline: `/api/health` is healthy at `v2.8-communication-follow-up` with `storage=supabase`.

## Remaining

- Add failing frontend regression/invariant tests.
- Implement shared Steam target resolution and Lead shortcut ordering.
- Bump product version to `v2.8.1-steam-direct-link-button`.
- Run exact-head verification, open PR, pass Actions, merge, deploy, and perform production acceptance.

## Next Action

Commit the failing tests on the isolated remote branch, then implement the smallest frontend slice.

## Git Status

- Truth source: remote GitHub only.
- Branch: `codex/steam-direct-link-button`.
- Base: `dd989f25173f0777afd735946d4bb22e777901a5`.
- Local CRM worktree: read-only and intentionally untouched.
- Scope exclusions: sourcing rules, Daily V4, API/schema, Supabase, automation, and per-record Lead data.
