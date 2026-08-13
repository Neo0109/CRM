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
- Published the RED commit `4f89c750db390bf387f09fd2e9d6c6fd27b45478`: 59 focused tests produced exactly three expected failures covering the missing shared predicate export, the incorrect collector candidate flag, and the incorrect offline-replay eligibility recomputation.
- Exported the pure `isV73SecondPassProviderEligible(admission)` predicate from the provider selector and reused it for selector filtering, collector candidate flags/rejections, and collector-v2 offline replay eligibility/rejections.
- Preserved the historical collector-v1 nine-action eligibility rule in a clearly named legacy predicate; the public provider contract remains limited to the existing four actions.
- Added mixed-shape coverage for `verify_prelaunch_window` plus two supported public actions, proving exclusion from `eligible_order`, candidate `eligible=false`, exact `unsupported_or_unobtainable_gap` rejection, zero provider calls, valid corpus finalization, and stored/recomputed replay parity.
- Local validation in the disposable snapshot is green: focused files 59/59, focused core 90/90, all V7.3 tests 120/120, Daily V4 335/335, JSON schema parsing, syntax checks, and full `npm run verify:all` (with a no-index `git diff --check` adapter because the authorized snapshot intentionally has no `.git` directory).
- Scope audit shows exactly seven repository changes: three V7.3 implementation files, three V7.3 test files, and this checkpoint. No workflow, provider-contract, CRM, UI, schema, synchronization, report-data, or production-data file changed.

## Remaining

- Publish the GREEN commit and a ready PR.
- Wait for remote checks and independent Release Captain acceptance; do not merge in this phase.

## Next Action

Publish the bounded GREEN commit, open the ready PR, and hand it to the root Release Captain for independent acceptance.

## Git Status

- Branch: `codex/v73-second-pass-eligibility-binding`.
- Base: `6ed0d13eb904152459389fefdf2194f4df1678ea`.
- RED head: `4f89c750db390bf387f09fd2e9d6c6fd27b45478`.
- Expected changed files: seven (three implementation, three tests, one checkpoint).
- Working medium: disposable non-git snapshot; all repository writes use the GitHub API.
