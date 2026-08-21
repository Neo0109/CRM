# Steam Direct Link Button Checkpoint

## Current Goal

Completed: every Lead that displays `Steam已验` now exposes a direct canonical Steam store shortcut in the production Leads review UI.

## Completed

- Diagnosis confirmed badge/link extraction divergence and pre-dedupe truncation.
- Proposal and user approval established a global invariant rather than a Golden Swirl-specific data patch.
- TDD red commit `45bb5b8` proved the shortcut interface was absent.
- Implementation commit `f5cb623` added the shared canonical Steam resolver, Steam-first shortcut builder, list/detail wiring, regression tests, and `v2.8.1-steam-direct-link-button` version governance.
- Exact PR head `11e60baeff5704fa97fb53282ebce5f381a7cb72` passed focused tests, full frontend tests, frontend and Functions typechecks, CRM core tests, frontend build, `verify:all`, diff checks, and Build run `32499715921`.
- PR #120 squash-merged to `main` as `88433ef761da4963d070ab896614e3489942f483`; main Build run `32499905246` passed.
- Production health returned `ok=true`, `version=v2.8.1-steam-direct-link-button`, and `storage=supabase`.
- Authenticated read-only UI acceptance covered all 1,000 Leads across seven buckets: 835 displayed `Steam已验`, `steam_verified_without_direct_button=0`, and 79 displayed both Steam and B站 shortcuts.
- Golden Swirl rendered `Steam → B站` with canonical AppID 3506690 links in both list and detail; production browser logs had no errors or warnings.
- Production acceptance evidence is recorded on PR #120.

## Remaining

None for this task.

## Next Action

No action required. Reopen only if a production regression provides new evidence.

## Git Status

- Truth source: remote GitHub and production.
- Product merge: `88433ef761da4963d070ab896614e3489942f483`.
- Product PR: #120, merged.
- Local CRM worktree: read-only and untouched.
- Scope exclusions preserved: sourcing rules, Daily V4, API/schema, Supabase, automation, and per-record Lead data.
