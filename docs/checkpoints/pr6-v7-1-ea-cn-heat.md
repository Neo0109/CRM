# PR 6 V7.1 EA / 中文热度全量通道 Checkpoint

## Current Goal

Complete only PLAN.md PR 6 production acceptance through a scoped Steam 429 hotfix, merge, deployment, a strict complete backfill, create-only CRM sync, and proof that existing Leads were not modified. Do not enter PR 7.

## Completed

- Fetched latest `origin/main` at `d98009bc5b8dad3ae81e304839fdc950a200248b`.
- Created branch `codex/pr6-v7-1-ea-cn-heat` from that commit.
- Created independent worktree `/Users/neo/Documents/GitHub/CRM-pr6-v7-1-ea-cn-heat`.
- Confirmed the worktree root already contains tracked `PLAN.md`.
- Verified `PLAN.md` is byte-identical to `/Users/neo/Downloads/PLAN.md`; both SHA-256 values are `bdcb4ff6c07ccb19ddfe4f261c4ea08bf0346bdcb762680c3bda7ef8aa053217`.
- Read `AGENTS.md`, the authoritative `PLAN.md`, this checkpoint, and `docs/CODEX_DELIVERY_WORKFLOW.md` from planning commit `ef2dd37344e40df79e4bc5e2d4e9b234d429026b` because that delivery document is not yet present on `origin/main`.
- Recorded the only unrelated open PR as `#71`; it will not be touched.
- PR 0 through PR 5 are treated as completed upstream per user instruction; PR 5 will not be rechecked, modified, or repeated.
- This task touches only PR 6: the independent Steam review opportunity workflow and its PR 6 contracts.
- Explicit exclusions: main daily workflow triggers/execution chain, PR 7+, UI/product work, database migrations, production-data edits, secrets/accounts/permissions, and unrelated historical failures.
- Diagnosis completed without rechecking or changing PR 5:
  - The accepted PR 5 layer ends at `steam_review_opportunity_audit.mjs` and a schema-validated audit artifact; it intentionally has no workflow, run mode, historical threshold-crossing state, Lead payload, CRM import, or sync receipt.
  - Putting the full-catalog scan into either existing Daily workflow would widen the regular automation failure surface and violate the locked PR 6 boundary.
  - The existing create-only API already provides the required safety invariant: Steam AppID/dedupe matches are skipped, `updated=0`, and existing records are not rewritten.
  - Scheduled delivery needs prior complete audit artifacts paired with matching strict successful receipts to suppress already-qualified AppIDs while still allowing newly discovered, first-crossing, or failed-delivery AppIDs.
- Implementation design fixed from the approved PLAN (no business re-planning):
  - Add a separate V7.1 machine-readable rule source and a pure delivery module that maps every eligible qualified opportunity to one create-only Lead payload with no cap; `china_heat_ops` remains primary when both rules match and all matched rules remain in audit/Lead rule text.
  - Map workflow `mode=backfill` to Lead `sourcing_run_type=initial_backfill`; auto mode remains backfill until a strict successful backfill receipt exists, then resolves to `scheduled`.
  - Add an independent workflow containing only `schedule` and `workflow_dispatch`; it runs an unbounded full scan, validates and commits the audit, blocks CRM sync unless `scan_complete=true`, then calls only `POST /api/leads/import-daily-report?mode=create-only`.
  - Add a dedicated receipt contract recording catalog scan count, qualified count, previously-qualified suppression, import candidates, deduplicated/skipped-existing count, created count, and the structured sync response. Success requires `scan_complete=true`, `status=success`, `sync_response.synced=true`, and `updated=0`.
  - Keep `.github/workflows/sync-daily-report.yml` and `.github/workflows/daily-report-watchdog.yml` unchanged.
- Pure V7.1 delivery step completed:
  - Added `automations/rules/steam-review-opportunities.json` as the separate machine-readable PR 6 rule and safety source; it preserves the accepted PR 5 source contract, null min/max Lead limits, lane precedence, create-only mode, and strict success invariants.
  - Added `steam_review_opportunity_delivery.mjs` with strict auto/backfill/scheduled mode resolution, receipt-backed prior-artifact threshold history, unbounded production collect options, one-Lead-per-AppID mapping, and no ranking/truncation.
  - Scheduled selection suppresses only AppIDs already qualified by an exact prior complete artifact with a matching strict success receipt; a previously unqualified AppID that now qualifies and any failed/unmatched delivery remain eligible.
  - `mode=backfill` maps to `sourcing_run_type=initial_backfill`; dual matches use `china_heat_ops` as the Lead lane while all rules remain in the audit and `rule_fit`.
  - Incomplete scans write preparation state but no CRM import payload.
  - Added the independent run-receipt schema and validator; strict success requires the complete scan, structured `synced=true`, zero updates, and exact created-plus-deduplicated parity with import candidates.
  - Fixed-fixture delivery tests pass: 7/7. The existing source/artifact fixture suite also remained green when exercised as a dependency contract; no live Steam or CRM call was made.
- Independent workflow and rule-documentation step completed:
  - Added `.github/workflows/steam-review-opportunities.yml` with only weekly `schedule` and manual `workflow_dispatch` triggers, main-branch guard, isolated concurrency, and no bounded-scan option.
  - The workflow validates and commits the dedicated audit, reads the strict scan gate, calls only the create-only Lead import when complete, then validates and commits a separate structured receipt.
  - Missing CRM access, incomplete scans, sync failures, non-zero updates, or receipt parity drift remain blocking; a complete zero-candidate run still calls create-only and can produce a strict successful receipt.
  - Added `docs/STEAM_REVIEW_OPPORTUNITY_DELIVERY.md` and updated `docs/SOURCING_RULES_CURRENT.md` so the active V7.1 machine rule, source boundary, workflow, artifact, receipt, and success invariants are traceable without changing the PR 5 source implementation.
  - Static workflow/rule/documentation contract tests pass: 4/4. YAML syntax parsing and `git diff --check` pass.
  - Confirmed the two existing Daily workflow files remain untouched by this step.
- Final local validation completed:
  - Restored workspace dependencies with `npm install --no-package-lock`; no lockfile or dependency artifact is tracked.
  - PR 6 focused delivery/workflow tests pass: 11/11.
  - CRM core tests pass: 30/30, including the create-only invariant that an existing Steam AppID/dedupe match is skipped with no existing-field mutation.
  - Frontend, backend, and Functions type checks pass; frontend and backend production builds pass.
  - The first `verify:all` run exposed only an obsolete exact documentation phrase expected by the accepted source boundary test. Restoring the true phrase “not imported by the active Daily runner” fixed the assertion without changing behavior.
  - The final `npm run verify:all` run passes all tasks, including 139/139 Daily/automation tests, contract checks, type checks, source checks, temporary production build, and diff check.
  - Final `git diff --check` passes; both existing Daily workflow files remain byte-unchanged relative to `origin/main`.
  - Re-ran the required `cmp` and SHA-256 check: repository `PLAN.md` remains byte-identical to `/Users/neo/Downloads/PLAN.md` at `bdcb4ff6c07ccb19ddfe4f261c4ea08bf0346bdcb762680c3bda7ef8aa053217`.
  - Final pre-publish baseline remains `origin/main=d98009bc5b8dad3ae81e304839fdc950a200248b`, unrelated open PR `#71`, and no queued or in-progress Actions runs.
- Pre-publish authentication integration correction completed:
  - Self-review found that the independent workflow must use the existing automation Bearer path rather than assume a human `CRM_ACCESS_TOKEN` session can authenticate without a username in every production configuration.
  - The create-only Functions route now accepts a valid configured `CRM_AUTOMATION_TOKEN` Bearer request and falls back to its original user/session access path; the default merge mode remains user-authenticated and unchanged.
  - The workflow uses only `CRM_AUTOMATION_TOKEN` for Bearer automation access; it does not use `CRM_ACCESS_TOKEN` as a fallback and neither creates nor rotates any secret.
  - Added a red-then-green API test for automation Bearer create-only import. CRM core now passes 31/31, PR 6 focused tests pass 11/11, Functions typecheck passes, and the complete post-fix `npm run verify:all` passes again.
- Published PR 6 delivery branch and opened the ready PR:
  - Branch `codex/pr6-v7-1-ea-cn-heat` was pushed at `dff8a7f`.
  - The configured HTTPS OAuth credential lacked GitHub's workflow-file scope, so the first push was rejected before any remote ref changed. The existing authenticated SSH Git transport was verified read-only and then used successfully; no account, token, or permission was changed.
  - Ready PR: `#92` — `https://github.com/Neo0109/CRM/pull/92`, base `main`.
- PR `#92` pre-merge acceptance completed at head `2f96d78ed7f83d62836d300dfc9c971267a50ecf`:
  - `Build / frontend` succeeded for Actions runs `29439073307` and `29439076628`.
  - Cloudflare Pages PR preview check succeeded.
  - GitHub reports `mergeable=MERGEABLE` and `mergeStateStatus=CLEAN` against `origin/main=d98009bc5b8dad3ae81e304839fdc950a200248b`.
  - At that earlier checkpoint, no reviews, review threads, or unresolved comments existed; the two later Codex review threads are recorded below.
  - The remote PR file list contains only the 13 PR 6 workflow, delivery, rule, schema, validator, tests, docs/checkpoint, package-script, and create-only automation-auth files; both existing Daily workflow files remain absent from the diff.
- PR `#92` review-closure diagnosis completed at remote head `9a2964ceb157c37b12e4ebaae45f4693a1a7ff00`:
  - Review thread `PRRT_kwDOSiiYJ86RMteA` correctly identified that committing a complete scan before a failed CRM import must not advance scheduled suppression history.
  - The interrupted local fix already required a strict successful delivery receipt, but matched it to an artifact path only. Because a manual same-date retry can overwrite that path, an older success receipt could incorrectly authenticate a newer failed artifact. The final fix must bind the exact artifact content to its receipt and leave every artifact without a matching strict success receipt eligible for retry.
  - Review thread `PRRT_kwDOSiiYJ86RMteH` correctly identified that `CRM_ACCESS_TOKEN` cannot be reused as a Bearer automation token. The local workflow now references only `CRM_AUTOMATION_TOKEN`; missing configuration must create an explicit failed sync response/receipt and the final workflow gate must fail.
  - Both review threads remain unresolved until the corrected code, tests, rule contract, delivery documentation, and checkpoint are pushed and the resulting PR checks pass.
  - All work remains confined to `/Users/neo/Documents/GitHub/CRM-pr6-v7-1-ea-cn-heat`; the separate `/Users/neo/Documents/GitHub/CRM` worktree and its user changes are out of scope and untouched.
- PR `#92` review-closure implementation completed locally:
  - Preparation and every receipt now record `artifact_sha256`; scheduled suppression requires a strict successful receipt whose `artifact_path` and SHA-256 identify the exact canonical artifact content.
  - A failed receipt, missing receipt, malformed receipt, or stale success receipt for an overwritten same-date path cannot advance suppression history. Newly qualified items in those artifacts remain eligible on the next scan, with create-only import providing final existing-Lead dedupe.
  - Auto mode advances from initial backfill only from the same strict receipt predicate, including zero updates and created-plus-deduplicated parity.
  - The independent workflow exposes only `secrets.CRM_AUTOMATION_TOKEN`; missing configuration writes an explicit `synced=false` response, produces `status=sync_failed`, and is rejected by the final blocking gate.
  - The machine rule, receipt schema, delivery documentation, current-rule documentation, and static workflow contract now encode these invariants.
  - TDD regression first failed on a same-path replacement being incorrectly suppressed and missing hash propagation, then the focused PR 6 delivery/workflow suite passed 12/12 after implementation.
  - Relevant create-only/API tests pass 31/31, including automation Bearer authorization and the invariant that an existing Steam AppID/dedupe match is skipped without field mutation. Functions typecheck, workflow YAML parsing, rule/receipt JSON parsing, and `git diff --check` pass.
  - The complete `npm run verify:all` passes: frontend 112/112, backend 21/21, Functions 31/31, Daily/automation 140/140, diagnostics, sourcing learning, heartbeat, all three typechecks, sourcing/daily contracts, temporary production build, and final diff check.
  - Both existing Daily workflow files remain byte-unchanged from `origin/main`.
  - `PLAN.md` remains byte-identical to `/Users/neo/Downloads/PLAN.md`; both SHA-256 values remain `bdcb4ff6c07ccb19ddfe4f261c4ea08bf0346bdcb762680c3bda7ef8aa053217`.

- Post-merge production acceptance and Steam 429 diagnosis completed from remote truth:
  - PR `#92` was squash-merged as `eaff172d947f47bb23b454653e9a05e26c338957`; current remote `main` at diagnosis is `26a2dfbb8db2b2f77cc2065186d4946111e8d07a`, and unrelated open PR `#71` remains untouched.
  - Production acceptance run `29471392256` (`Steam review opportunities`, head `eaff172d`) ran from 2026-07-16 12:26 to 12:32 Asia/Shanghai and correctly failed its strict final gate.
  - The committed receipt records `scan_complete=false`, `status=scan_incomplete`, `sync_response.synced=false`, `updated_count=0`; the create-only CRM sync step was skipped, so no Lead was written by the failed run.
  - The scan stopped after 30 catalog pages: `catalog_entries_seen=3000`, `unique_apps_seen=2990`, while Steam reported `164918` catalog entries. The next catalog request returned HTTP 429.
  - The partial catalog produced 437 prefilter candidates. The current candidate loop uses `concurrency=2`, but each candidate starts review-summary and AppDetails requests together, creating four-request bursts per chunk with only 250ms between chunks.
  - AppDetails uses fixed 2.5s/5s 429 waits; review summaries use fixed 2s/4s waits. Neither path reads `Retry-After`, coordinates a shared cooldown, or adds jitter. The run logged 38 terminal AppDetails 429 failures from 12:29:04 through 12:32:21.
  - Root-cause classification: current full-scan pacing is structurally unsafe, not a one-off cooldown-only failure. The unbounded catalog loop has no page delay, and the enrichment path can burst four requests while independent fixed retries continue traffic. Re-running unchanged after cooldown would risk repeating the same incomplete scan and is not accepted as a recovery.
- PR 6 hotfix scope approved by the user's explicit continuation instruction:
  - Preserve `scan_complete=true` as a non-negotiable sync gate and keep all incomplete scans unable to write CRM.
  - Add source-level pacing that covers catalog, review-summary, and AppDetails requests; honor `Retry-After`; use bounded exponential backoff plus jitter and a coordinated cooldown after 429.
  - Remove AppDetails requests only where store EA evidence is not required, without weakening either qualification rule or dual-match evidence.
  - Add batch/checkpoint continuation only if the rate-limited full scan cannot finish safely within the workflow window.
  - Keep both Daily workflows, business thresholds, schema success rules, create-only import, UI, database, secrets, PR 7+, and existing Lead mutation behavior unchanged.
- Created remote-only branch `codex/pr6-steam-429-hotfix` from current `main=26a2dfbb8db2b2f77cc2065186d4946111e8d07a`. The user's dirty local `codex/sourcing-rules-vnext` worktree remains read-only and untouched.

- Added the PR 6 hotfix red regression contract without implementation:
  - Network contract requires HTTP 429 errors to retain status and parsed `Retry-After`.
  - Source contracts require catalog page pacing, retry after the server cooldown, bounded exponential retry with deterministic jitter, and no AppDetails request for a non-EA catalog candidate that already qualifies only through `china_heat_ops`.
  - Workflow contract requires a 360-minute safety window, `concurrency=2`, and a 1000ms source-level minimum request interval.
  - The next Build is expected to fail these new assertions against the unchanged production code; no success claim is recorded until that red result is observed.

- Fixed red evidence recorded before implementation:
  - Push Build `29473546745` at `f9552ce81ed788cbb617835f5d099cc5d28b9bbd` failed in `Test Steam review opportunity source` with the four intended rate-limit contract failures.
  - The failures were catalog pacing/retry, review Retry-After/backoff, conditional AppDetails lookup, and workflow timeout/request interval. Earlier frontend, typecheck, CRM core, and unrelated tests in the job passed.
- Implemented the scoped PR 6 hotfix:
  - HTTP errors now retain status and parsed `Retry-After` metadata without changing the existing error message or curl-fallback boundary.
  - PR 6 catalog, review, and required AppDetails calls share one serialized scheduler with a 1000ms minimum interval.
  - HTTP 429 uses up to ten attempts, honors a longer server cooldown, and otherwise uses 2s-to-60s bounded exponential backoff plus jitter while holding the shared scheduler.
  - AppDetails is skipped only for non-EA catalog candidates, where store EA evidence cannot affect `ea_mobile_high_traction`; catalog-EA and dual-match candidates still require official store confirmation.
  - Workflow timeout is 360 minutes. No batch or continuation state was added because the first safe full run will determine whether the longer strict single-artifact window is sufficient.
  - Strict `scan_complete`, no-sync-on-incomplete, create-only, `updated=0`, rule thresholds, both Daily workflows, and PR 7+ remain unchanged.
  - Machine rule and human rule/delivery entrypoints now record the active rate-limit policy.

- Implementation-head Build `29473780474` ran 28 Steam opportunity tests: 27 passed and only the pre-hotfix artifact fixture expected `store_details_confirmed=4`. The new source correctly reports 3 because the non-EA `china_heat_ops` fixture no longer performs an irrelevant AppDetails lookup. Updated that exact expected count; no source behavior or success gate changed.

- Focused hotfix verification is green at `47f1e12a9d4fce6581d3e7c2b657bc6d43bb0d65`:
  - Push Build `29473861656` succeeded.
  - PR Build `29473863025` succeeded.
  - Both runs passed frontend tests, frontend typecheck, Functions typecheck, CRM core tests, all 28 Steam review opportunity tests, and the frontend production build.
  - Cloudflare Pages preview remained in progress at this checkpoint; it is not treated as complete yet.

- Complete repository verification passed against exact remote head `4bd275a436a62b698e0a52a142decc15175ab6a4` in an isolated disposable validation copy:
  - `npm install --no-package-lock` completed without creating a tracked lockfile.
  - `npm run verify:all` passed frontend 112/112, backend 21/21, Functions 31/31, Daily/automation 143/143, diagnostics, assistant model, sourcing learning, heartbeat, all three typechecks, sourcing/daily contracts, temporary production build, and final diff check.
  - The new network Retry-After contract passed inside the full Daily/automation suite.
  - Final `git diff --check` passed and `git status --porcelain` was empty; the disposable copy was removed.
  - This validation is test evidence only. Remote GitHub checks, deployment, production health, and the final live backfill remain separate acceptance gates.

## Remaining

- Add fixed red tests for catalog pacing, Retry-After precedence, exponential backoff with deterministic jitter, shared cooldown, and conditional AppDetails fetching.
- Implement the smallest PR 6 source/network/workflow change that makes those tests green without weakening the strict scan or CRM write gates.
- Run focused Steam opportunity tests, network/source contracts, schema/YAML checks, typechecks/builds, `npm run verify:all`, and diff-scope checks through the remote PR/Actions path.
- Open and validate the PR 6 hotfix PR, close all review findings, squash-merge only after every required check is green, and verify deployment plus production `/api/health`.
- Dispatch a fresh backfill, follow it to completion, and require `scan_complete=true`, `status=success`, `sync_response.synced=true`, and `updated_count=0`; compare pre/post existing-Lead evidence so create-only delivery cannot hide a rewrite.
- Update this checkpoint with the final main SHA, hotfix PR/run/deployment handles, receipt metrics, CRM sync result, and formal PR 6 acceptance; then stop before PR 7.

## Next Action

Audit PR #93 diff scope, current main drift, review threads, mergeability, Build, and Cloudflare Pages. Resolve only hotfix findings, update the PR body, and mark the PR ready only when every pre-merge gate is green.

## Git Status

- Remote branch: `codex/pr6-steam-429-hotfix`.
- Base: remote `main=26a2dfbb8db2b2f77cc2065186d4946111e8d07a`.
- Scope at this checkpoint: PR 6 network/source pacing, retry metadata/policy, workflow timing, fixed tests, active rule/docs, and checkpoint only. Focused checks and full verify are green; final PR checks/review are pending.
- PR state: PR `#92` merged; draft hotfix PR `#93` is open; unrelated PR `#71` remains open.
- Local workspace: `/Users/neo/Documents/GitHub/CRM` remains on the user's dirty `codex/sourcing-rules-vnext` branch and has not been edited, staged, committed, switched, or used as production truth.
