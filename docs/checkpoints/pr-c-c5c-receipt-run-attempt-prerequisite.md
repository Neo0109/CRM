# PR C / C5-C receipt run_attempt prerequisite — Phase 4 implementation checkpoint

Status: **implementation and independent exact-head QA complete; no PR created**

## Authority and phase boundary

- User-approved proposal authority at the mandatory opening gate: e27c86e6b4901e19ad20e226e851a4424dfe2577.
- Opening GitHub App gate: remote main was exactly e27c86e6b4901e19ad20e226e851a4424dfe2577; compare status was identical with zero drift paths.
- Open PRs at the opening gate: #107 and #71. Neither overlapped this prerequisite's six-path allowlist.
- Frozen C5-C merge base: 9dfce284903a72ba61fac1937acc69ab7f6d04c4.
- Frozen C5-C code/QA authority: a972963f27c61e88994ba0168c5140720eab011c.
- Frozen C5-C docs-only head: 385fabd33f7abb3ae491f19821572af7b7cc1e7e.
- This independent prerequisite branch: codex/c5c-receipt-run-attempt-prerequisite.
- Accepted RED authority: feb811f68d46465c1e5b93d92bf45c7859e7dbdf.
- Implementation and independent QA authority: b8ce3a617731640446d7e60fd2bf0dcd7f947491.
- Production authority remains V7.2. No C5-C implementation diff was carried into this branch.

The opening gate passed before implementation began. A later read-only authority recheck found that live main had advanced to c731d55e743081681232230303acbeff36423013, two commits ahead of the approved base, only in:

- data/automation_runs/2026-08-04-watchdog.json
- data/radar/2026-08-04.json
- data/reports/2026-08-04.json
- data/sourcing_candidates/2026-08-04.json
- data/steam_trends/2026-08-04.json

This post-start drift is data-only and has zero overlap with the prerequisite allowlist. It was not incorporated, rebased, or used to replace the approved base. A future PR-creation phase must re-run the updated authority gate and obtain separate user approval.

## Approval context

### Concrete problem

Both production workflows wrote receipts without receipt.run_attempt. The C5-B finalizer therefore selected the lexicographically latest pending core for a date and slot and the workflow corpus path defaulted a missing attempt to 1. Multiple retries of the same workflow run could bind a receipt to the wrong pending core.

### Cost of leaving it unresolved

A wrong-attempt corpus could appear schema-valid while binding the wrong run, making C5-C offline replay evidence non-deterministic. Missing or historical receipt fields could also be silently repaired by caller or corpus assumptions instead of failing closed.

### Necessity and principle

The workflow runtime is the only authority for github.run_attempt. Each workflow must serialize that value directly as a normalized positive safe JSON integer. The finalizer must read and validate the receipt tuple before selecting an exact pending core, then require the core to match the receipt rather than scan, default, backfill, or resolve online.

### Architecture benefit

Receipt identity, pending-core identity, and corpus identity now share one deterministic tuple. The finalizer remains offline and fail-soft, while V7.2 generation, validation, sync, receipt bytes, triggers, schedules, step order, and sync blocks retain their existing ownership and behavior.

## Implemented contract

- Both workflows expose the github.run_attempt expression as GITHUB_RUN_ATTEMPT_VALUE.
- Both normalize it with Number, require Number.isSafeInteger and a value greater than zero, and write receipt.run_attempt as a JSON number.
- All shell attempt fallbacks and collector nullish attempt defaults in the approved production paths were removed.
- The finalizer reads and parses the receipt before pending-core selection.
- It validates report_date, slot, run_id, and strict numeric run_attempt.
- It selects exactly data/runtime/<date>-c5b-shadow-<run_id>-<run_attempt>-<slot>.json.
- It requires matching corpus_id, workflow_run_id, run_attempt, report_date, run_slot, and matching event_name when the receipt contains that field.
- Missing or invalid receipt identity, tuple mismatch, forged exact-path core, or missing exact core returns error with no corpus.
- The finalizer does not write or repair receipts and has no directory guessing, backfill, network call, GitHub resolver, or activation path.
- Historical receipts and production data were not modified.

## TDD evidence

### Baseline

At the approved base:

- collector node --check: GREEN
- focused two tests plus Daily Leads liveness: 20/20 GREEN

### Accepted RED

At feb811f68d46465c1e5b93d92bf45c7859e7dbdf:

- exactly the two approved test paths changed
- test files and collector passed node --check
- focused two-test run: 30 tests, 15 pass and 15 intended contract failures
- failures covered exact-attempt selection, missing/invalid attempt, tuple/event/core mismatch, missing workflow runtime plumbing, default-to-1, and receipt-before-pending ordering
- existing validation/module-load fail-soft, receipt-byte, V7.2 exit, trigger, cron, step, sync, and no-network guards stayed green

### GREEN and root acceptance

At b8ce3a617731640446d7e60fd2bf0dcd7f947491:

- collector node --check: GREEN
- focused two tests plus Daily Leads liveness: 34/34 GREEN
- npm run test:daily-v4: 255/255 GREEN
- unrelaxed npm run verify:all: 16/16 tasks GREEN
- no repository package install and no package-lock.json
- whitespace and exact-path guards: GREEN
- no run-attempt fallback remained in the three production paths

A GREEN-writer transport disconnect occurred only while attempting the remote commit. GitHub recheck proved the branch was still at RED. Root recovered the already verified disposable snapshot and created one atomic GitHub App blob/tree/commit/ref update; no partial remote production commit existed.

### Independent exact-head zero-write QA

Independent QA re-downloaded the GitHub API snapshot at b8ce3a617731640446d7e60fd2bf0dcd7f947491 and made no GitHub, source, data, PR, merge, dispatch, or production writes.

- findings: P0=0 / P1=0 / P2=0
- collector node --check: GREEN
- focused two tests plus Daily Leads liveness: 34/34 GREEN
- npm run test:daily-v4: 255/255 GREEN
- unrelaxed npm run verify:all: 16/16 tasks GREEN
- trigger and cron headers: byte-equivalent
- workflow step order: 12/12 sync and 13/13 watchdog
- sync blocks: byte-equivalent
- base-to-code-head changed paths: exactly five, all allowed
- no lockfile, install, fallback, receipt repair, directory guess, online resolver, C5-C implementation path, or V7.3 activation wiring

## Exact path boundary

Code/QA head b8ce3a617731640446d7e60fd2bf0dcd7f947491 changes exactly:

- .github/workflows/sync-daily-report.yml
- .github/workflows/daily-report-watchdog.yml
- automations/jobs/online_daily_v7_3_shadow_collector.mjs
- automations/test/onlineDailyV73ShadowCollector.test.mjs
- automations/test/onlineDailyV73ShadowIntegrationContract.test.mjs

This checkpoint is the sixth and final allowlisted path:

- docs/checkpoints/pr-c-c5c-receipt-run-attempt-prerequisite.md

All other paths are forbidden and unchanged, including online_daily_v4.mjs, C5-C offline replay/window/corpus-contract code, tests, schemas, and prior checkpoint; sourcing rules; Daily V4 behavior; API/UI/Supabase; data/**; other workflows; and package or lock files.

## Hard stop and next authority gate

This checkpoint is implementation evidence only. It is not a PR, merge, deployment, workflow dispatch, live receipt observation, production write, C5-C P1-1 resumption, 15-day observation start, or V7.3 activation.

Stop here. Before creating a PR, separately obtain user approval, recheck the then-current main SHA and exact drift/overlap, and do not silently rebase or replace the approved authority.
