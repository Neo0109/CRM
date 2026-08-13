# V7.3 second-pass eligibility binding hotfix

## Current Goal

Repair the post-PR #115 replay-corpus finalizer regression in which candidate-level `second_pass.eligible` and run-level `second_pass.eligible_ids` are computed from different action allowlists.

## Baseline

- Remote `main`: `6ed0d13eb904152459389fefdf2194f4df1678ea`.
- Open PRs before this hotfix: none.
- Natural afternoon runs:
  - `31575984116` on 2026-08-12 failed the isolated C5-B finalizer with `SECOND_PASS_CANDIDATE_FLAG_MISMATCH` at candidate index 118.
  - `31679854877` on 2026-08-13 failed the same isolated finalizer check at candidate index 105.
- Both daily deliveries remained healthy: generation and validation succeeded, receipt status is `success`, `sync_response.synced=true`, and production `/api/health` is HTTP 200 with `ok=true` and `storage=supabase`.
- Neither failed run committed its replay corpus.

## Problem and Cost of Inaction

PR #115 made run-level `eligible_ids` authoritative from the actual provider selector, but candidate-level flags and offline replay still use a wider patch-field action set. A candidate asking for `verify_prelaunch_window` together with supported public evidence actions is rejected by the selector yet marked eligible by the collector and replay engine. The fail-closed contract then rejects every matching natural corpus. Leaving the split in place prevents the three-day Activation window from starting and hides all new evidence diagnostics, even though the production report and CRM sync continue to work.

## Scope

- Export one pure provider-selector eligibility predicate from `online_daily_v7_3_second_pass_orchestrator.mjs`.
- Reuse it in the selector candidate filter, shadow collector candidate flag/rejection, and offline replay eligibility/rejection.
- Add a mixed-action regression fixture covering `verify_prelaunch_window` plus two supported public actions.
- Preserve historical collector v1 compatibility, max-12 selection, actionability ordering, deterministic tie keys, privacy projection, integrity validation, and provider failure isolation.

## Explicit Non-Goals

- Do not expand the four-action provider contract or add project-level evidence collection.
- Do not lower any V7.2/V7.3 formal Lead gate.
- Do not modify CRM/UI/API/Supabase schemas, synchronization, workflow triggers, provider authority, or production data.
- Do not mix the broad-media product-domain work from PR #116 into this hotfix.
- Do not manually dispatch or rerun an automation.

## Why This Operation

The defect is duplicated policy, not a bad gate decision. The selector is the existing transport-authority boundary, so a single pure predicate must define eligibility for all stored and replayed views. Reusing that predicate fixes the observed mismatch without changing which candidates receive provider calls. It also prevents future allowlist drift from producing a corpus that validates locally but cannot replay.

## Engineering Method

Use TDD: first add a fixture that reproduces the mixed-action natural shape and proves the current code disagrees, then centralize the pure predicate and make selector, collector, and offline replay consume it. Validate the focused V7.3 contract before the full Daily V4 and repository verification gates.

## Architecture Benefit

A single provider-selector boundary reduces the blast radius of action-policy changes, keeps capture and offline replay mechanically consistent with live orchestration, and leaves the main collector responsible for composition rather than redefining provider eligibility.

## Completed

- Completed read-only diagnosis from remote logs and committed artifacts.
- Reproduced the same first-pass decision deterministically from both natural dates.
- Created branch `codex/v73-second-pass-eligibility-binding` from the exact post-PR #116 `main` SHA.

## Remaining

- Commit RED mixed-action coverage.
- Implement the shared predicate and reach GREEN.
- Run focused V7.3, Daily V4, and `verify:all` gates.
- Publish a ready PR for independent Release Captain acceptance; do not merge in this phase.

## Next Action

Add the failing mixed-action fixtures without changing production code.

## Git Status

- Branch: `codex/v73-second-pass-eligibility-binding`.
- Base: `6ed0d13eb904152459389fefdf2194f4df1678ea`.
- Working medium: disposable non-git snapshot; all repository writes use the GitHub API.
