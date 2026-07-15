# PR 0 Quality Quarantine Checkpoint

Date: 2026-07-15 14:33 CST

Last updated: 2026-07-15 15:17 CST

Authoritative plan: `/Users/neo/Downloads/PLAN.md`

Phase status: PR 0 Steps 1 and 2 completed and narrowly verified; Step 2 remains uncommitted and Step 3 has not started.

## Current Goal

Implement only PLAN.md PR 0: restore the Daily V4 artifact contract and enter `sourcing-rules-v6.8-quality-quarantine`, while preserving normal daily report, Radar, Steam Trends, validation, and sync behavior and publishing an empty Lead pool during quarantine.

## Scope Guardrails

- Do not change or reinterpret PLAN.md.
- Do not implement PR 1 through PR 9.
- Do not change product functionality, UI, Supabase, existing CRM Leads, production data, or workflow trigger boundaries.
- Do not run the live daily generator, dispatch workflows, call CRM sync, or generate/sync a real report locally.
- Do not push or create a PR without explicit user confirmation.
- Preserve all pre-existing local changes that are unrelated to PR 0.

## Baseline

- Repository: `Neo0109/CRM` at `/Users/neo/Documents/GitHub/CRM`.
- Local branch: `codex/sourcing-rules-vnext`.
- Local HEAD: `ecb024ad94d8be081a38344ed4735f4b4bea9910`.
- Isolated implementation worktree: `/Users/neo/Documents/GitHub/CRM-pr0-quality-quarantine`.
- Isolated implementation branch: `codex/pr0-quality-quarantine`, based on and tracking `origin/main` at `0a7567d78f74c7bcf1c1f5e9011ee80ac47dc90d`; it has not been pushed.
- Remote `main`: `0a7567d78f74c7bcf1c1f5e9011ee80ac47dc90d`.
- PLAN.md snapshot was `4b41b26a79a00b6c2b608c4acacc8eedca68f87d`; the two later `main` commits only record 2026-07-15 automation receipts.
- Open PR queue: only unrelated PR `#71` (`codex/tdd-weekly-css-ownership` -> `main`).
- Actions queue: no queued or in-progress runs at inspection time.
- Existing remote branch `codex/sourcing-v6-8-quality-quarantine` is at `cd0e3e2519cefeb70500fdd6b50237f56bd4d82b`; it contains only an older checkpoint commit, has no open PR, is one commit ahead and two receipt commits behind current `main`, and contains no PR 0 implementation.
- The 2026-07-15 morning and watchdog receipts both record `generation_failed`; their embedded contract logs show recursive `_...` fields leaking into daily-report Lead objects and Steam Trends `crm_candidates`.
- The active rule version remains `sourcing-rules-v6.7-non-game-animation-gate` in the runtime constant, machine rule JSON, and `docs/SOURCING_RULES_CURRENT.md`.
- The main workflow still has only `schedule` and `workflow_dispatch` triggers. Sync success remains gated on a response containing `synced=true`; watchdog health requires both `receipt.status === "success"` and parsed `sync_response.synced === true`.

## Completed

- Confirmed the current directory, repository root, remote, branch, HEAD, and dirty git status.
- Read `AGENTS.md` and the complete authoritative `/Users/neo/Downloads/PLAN.md` without editing either file.
- Confirmed current remote `main`, open PRs, queued/in-progress Actions, the existing PR 0-named remote branch, and the latest same-day failure receipts.
- Read the PR 0 implementation boundaries on current remote `main`: Daily V4 runner/generator, report builders, rule loader and machine rules, media evidence classification/Lead construction, volume diagnostics, contract validator, watchdog, workflow gates, schemas, current-rule documentation, package verification entrypoints, and existing regression tests.
- Confirmed the current concrete contract gap: `writeJson` serializes runtime objects directly, while schemas reject leaked private `_...` fields.
- Confirmed the current evidence gap: several media predicates accept the phrase `Steam 商店页` as product evidence even when no canonical Steam AppID/store URL exists; the final contract validator has a related check but no isolated regression fixture for rejecting the candidate before publication.
- Confirmed the current quarantine gap: the contract validator hard-fails when all three Lead pools are empty, and Lead-count warnings still mark an otherwise structurally valid zero-Lead day degraded.
- Split PR 0 into the three independently verifiable steps below.
- Re-read PLAN.md, this checkpoint, `git status`, and `git diff` before implementation, then re-confirmed remote `main`, PR queue, Actions queue, and production `/api/health`.
- Preserved the dirty `codex/sourcing-rules-vnext` worktree and created isolated local branch/worktree `codex/pr0-quality-quarantine` from current `origin/main` without pushing.
- Completed Step 1 with TDD: added a fixed nested-object/array fixture containing the exact private-field shapes seen in the 2026-07-15 failure, confirmed the initial test failed, then implemented recursive non-mutating private-field removal.
- Routed the generator's single `writeJson` artifact boundary through `serializeArtifact`, covering daily report, Radar, Steam Trends, and generation-failure JSON writes without running the live generator.
- Added a static regression assertion that the generator cannot revert to direct `JSON.stringify(payload)` artifact writes.
- Completed Step 2 with TDD: added fixed invalid and valid Steam-evidence fixtures, confirmed the initial test failed on the unresolved claim, then added a classification gate that rejects a claimed Steam store page unless a normalized Steam/SteamDB app URL or valid AppID is present.
- Kept normalized Steam Store URLs and structured numeric AppIDs eligible, and confirmed the rejection propagates through strict, expanded, rescue, and media Lead-building paths without triggering official or exact-title lookups.

## Small Steps

### Step 1 - Artifact serialization contract - Completed

- Add a fixed regression fixture for nested private fields in objects and arrays.
- Add a pure recursive artifact sanitizer and apply it at the JSON artifact serialization boundary so every key beginning with `_` is removed before write.
- Verify with the narrow artifact-contract test only; do not run a live generator.

### Step 2 - False Steam-store evidence rejection - Completed

- Add a fixed media/evidence fixture that mentions a Steam store page but contains neither a canonical Steam AppID nor a normalized Steam/SteamDB app URL.
- Reject that item before it can become a Lead while keeping valid normalized Steam evidence behavior unchanged.
- Verify with the narrow sourcing-evidence regression test only.

### Step 3 - V6.8 quality quarantine

- Align the runtime constant, generator metadata, machine rule JSON, and current-rule documentation to `sourcing-rules-v6.8-quality-quarantine`.
- Publish empty Daily Lead pools during quarantine while continuing to build Daily, Radar, and Steam Trends artifacts from the normal scan path.
- Disable Lead-count failure/degraded behavior only for the explicit quarantine rule; keep missing files, schema damage, source failure, write failure, sync failure, and the strict successful-receipt contract unchanged.
- Verify the quarantine/rule/runner/validator/watchdog behavior with narrow Daily V4 and hardening tests; do not dispatch workflows or sync CRM.

## Files Changed

- PR 0 Step 1 implementation worktree:
  - modified `automations/jobs/online_daily_v4.mjs`
  - added `automations/jobs/online_daily_v4_artifacts.mjs`
  - added `automations/test/fixtures/private-artifact-fields.json`
  - added `automations/test/onlineDailyV4Artifacts.test.mjs`
- PR 0 Step 2 implementation worktree:
  - modified `automations/jobs/online_daily_v4_media_rules.mjs`
  - added `automations/test/fixtures/steam-store-evidence-integrity.json`
  - added `automations/test/steamStoreEvidenceIntegrity.test.mjs`
- Recovery worktree:
  - updated `docs/checkpoints/pr0-quality-quarantine.md`
- Pre-existing user changes remain untouched:
  - modified `docs/checkpoints/sourcing-rules-vnext.md`
  - untracked `docs/SOURCING_RULES_PROPOSAL.md`

## Tests

- Red: `node --test automations/test/onlineDailyV4Artifacts.test.mjs` failed 2/2 because nested `_...` fields remained in the sanitized object and serialized JSON.
- Green: the same narrow test passed 3/3 after implementation, including recursive cleaning, input immutability/newline preservation, and generator-boundary wiring.
- Step 2 red: `node --test automations/test/steamStoreEvidenceIntegrity.test.mjs` failed 1/2 because an unresolved Steam-store claim was classified as `radar_only/non_game_approval_context` instead of `reject/steam_store_claim_without_normalized_evidence`; the normalized-evidence case already passed.
- Step 2 green: the same narrow test passed 2/2 after the minimal media-rule gate was added.
- Direct Step 2 regression: `node --test automations/test/sourcingEvidenceIntegrity.test.mjs` passed 13/13.
- `git diff --check` passed in the isolated implementation worktree after Steps 1 and 2.
- No live generator, real report generation, CRM sync, workflow dispatch, production write, commit, push, or PR creation was performed.
- Final PR 0 verification remains exactly: regression fixture coverage, `npm run test:daily-v4`, schema/contract validation, and `npm run verify:all`.
- Scheduled production acceptance is deferred until a later explicitly authorized PR/merge phase and must prove all three dated artifacts plus a receipt with `status=success` and `sync_response.synced=true`.

## Remaining

- Step 3: V6.8 quality quarantine and zero-Lead health behavior.
- Run PLAN.md final PR 0 verification and record results.
- Stop after PR 0; do not enter PR 1.

## Next Action

Stop after Step 2 and wait for explicit user confirmation. Do not enter Step 3, commit, push, create a PR, run the live generator, dispatch a workflow, or sync CRM in this task.

## Git Status

Recovery worktree:

```text
## codex/sourcing-rules-vnext
 M docs/checkpoints/sourcing-rules-vnext.md
?? docs/SOURCING_RULES_PROPOSAL.md
?? docs/checkpoints/pr0-quality-quarantine.md
```

Isolated implementation worktree:

```text
## codex/pr0-quality-quarantine...origin/main [ahead 1]
 M automations/jobs/online_daily_v4_media_rules.mjs
?? automations/test/fixtures/steam-store-evidence-integrity.json
?? automations/test/steamStoreEvidenceIntegrity.test.mjs
```
