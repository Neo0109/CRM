# Source Coverage Observe Checkpoint

## Current Goal

Deliver Phase 1 of the approved CRM resilience plan: structured source-response classification and `source_coverage` receipts in `observe` mode. The calculated state is diagnostic only in this PR; it must not block report writes or CRM sync.

## Completed

- Diagnosis, proposal, and user approval are complete.
- Remote base is `main` at `3c24111a989b52dc0b3e7e6ee94109f49f2f2ba7`.
- No open pull requests existed when this phase started.
- Created remote branch `codex/source-coverage-observe` from the exact base.
- Confirmed the local VNext sourcing draft remains outside this task and untouched.

## Remaining

- Add operational source-health configuration without changing sourcing admission rules.
- Add response classification for ok, payment required, forbidden, rate limited, Cloudflare challenge, parse mismatch, upstream error, and network error.
- Add the schema-v1 `source_coverage` calculation and write it to automation receipts in observe mode.
- Add Actions Summary diagnostics without changing workflow triggers.
- Add and run focused tests, then the repository acceptance commands required for this phase.
- Open, review, merge, deploy, and observe three natural scheduled runs before proposing enforcement.

## Next Action

Create a clean API staging copy from the exact remote base, add failing tests first, and implement the smallest Stage 1 observe slice.

## Git Status

- Remote working branch: `codex/source-coverage-observe`
- Base SHA: `3c24111a989b52dc0b3e7e6ee94109f49f2f2ba7`
- Local checkout: dirty VNext draft; read-only and not used for commits.

## Scope Boundaries

- Allowed: automation network/source-health modules, operational health configuration, automation receipts and summaries, focused tests, and this checkpoint.
- Not allowed: Lead admission/V7.2.2 logic, formal Lead quantities, Supabase or sync semantics, sourcing-rule drafts, product UI/API, Cloudflare bot settings, or workflow trigger changes.
- No payment, browser bypass, User-Agent impersonation, or implicit replacement-site discovery.
