# PR 4 V7.0 Indie Admission Checkpoint

Date: 2026-07-15 22:52 CST

Last updated: 2026-07-15 22:52 CST

Authoritative plan: `PLAN.md`

Plan SHA-256: `bdcb4ff6c07ccb19ddfe4f261c4ea08bf0346bdcb762680c3bda7ef8aa053217`

Delivery protocol: `docs/CODEX_DELIVERY_WORKFLOW.md`

Phase status: Phase 4 implementation is explicitly authorized. The remote baseline, PR queue, Actions queue, production-health baseline, independent branch, and independent worktree are established. No PR 4 business code has been changed yet.

## Current Goal

Deliver only PLAN.md PR 4: replace the current bypassable independent-game scoring and quantity behavior with the V7.0 `indie_prelaunch` admission contract, so every newly discovered project that satisfies every mandatory gate becomes a formal recommendation and every project that misses any gate remains only in the sourcing-candidate audit artifact.

## Scope

- Remove `minReviewLeads`, formal-count targets, weak-project backfill, and P3-to-P2 promotion from the independent-game qualification path.
- Require every new `indie_prelaunch` recommendation to have an explicit identity/dedupe key, eligible pre-release state, no mature publisher or China-capability occupancy, non-narrative-led product positioning, non-India team evidence, official Demo/Playtest, official gameplay evidence, at least one independent quality proof, a non-Steam business contact entrypoint, a concrete China/Bilibili incremental-value case, and explicit China demand for overseas projects.
- Route every fully qualified project to `push_pool` with `priority=null`; keep all failed or unknown candidates out of formal Lead pools and in the candidate audit artifact with auditable reasons.
- Add deterministic fixtures proving 0, 2, and 7 qualified projects produce exactly 0, 2, and 7 formal recommendations without truncation, plus regressions for the seven historical weak Steam samples.
- Update only directly required rule, generator, schema/contract, fixture, test, current-rule documentation, and this checkpoint surfaces.

Explicitly out of scope:

- No PR 5+ Steam simplified-Chinese review collection, EA/high-traction, China-heat, `china_joint`, learning-loop, or visual-AI work.
- No Lead/API, frontend, export, Supabase schema, migration, or production-data changes.
- No new network data source and no local generation or direct synchronization of real production reports.
- No GitHub Actions trigger or daily automation chain changes.
- No change to the candidate artifact's never-import-to-CRM boundary.

## Why This Slice

- Current problem: the pre-V7 independent-game path uses weighted signals and a target-volume policy, so source/label/screenshot points can compensate for missing product or commercial proof, while weak candidates can be backfilled and promoted into the formal review pool.
- Cost of leaving it unresolved: formal recommendations remain noisy, qualification cannot be explained as a stable contract, zero-valid-result days are treated as shortages, and broad discovery continues to create manual CRM review load.
- Reason for this boundary: PR 3 already separated candidate auditing from CRM import, so PR 4 can now change only independent-game admission and prove its decisions without mixing in new Steam collection or later business lanes.
- Implementation principle: use TDD around a pure, deterministic admission decision; make every gate explicit and non-compensating; keep ranking presentation-only; assert exact set equality between newly qualified candidates and `push_pool`.
- Architectural benefit: discovery coverage and formal qualification become independent, the formal-pool blast radius is bounded by a single auditable decision contract, and future source or lane changes can reuse candidate evidence without reviving quantity backfill.

## Baseline

- Repository: `Neo0109/CRM`.
- Remote `main`: `6542cee2b3ea1ba9e853c3606304557f343c9155` (`Add sourcing candidate audit artifacts (#89)`).
- Completed plan slices: PR 0 quality quarantine; PR 1 Lead/API contract (`#87`); PR 2 manual priority UI (`#88`); PR 3 candidate audit artifacts (`#89`).
- Open PR queue: unrelated PR `#71` only.
- Latest main Build: success, run `29424028861`, head SHA `6542cee2b3ea1ba9e853c3606304557f343c9155`; Cloudflare Pages check succeeded.
- Actions queue at baseline: no queued or in-progress runs.
- Production health baseline: HTTP `200`, `ok=true`, version `v2.7.6-sourcing-evidence-integrity`, storage `supabase`.
- Branch: `codex/pr4-v7-indie-admission`.
- Worktree: `/Users/neo/Documents/GitHub/CRM-pr4-v7-indie-admission`.
- Starting HEAD: `6542cee2b3ea1ba9e853c3606304557f343c9155`.

## Completed

- Read the complete repository `AGENTS.md`, authoritative `PLAN.md`, and `docs/CODEX_DELIVERY_WORKFLOW.md`.
- Verified the repository `PLAN.md` is byte-identical to `/Users/neo/Downloads/PLAN.md` and recorded its SHA-256.
- Fetched current `origin/main`, confirmed PR 1-3 are merged, and confirmed only unrelated PR `#71` remains open.
- Confirmed the latest main Build and Cloudflare Pages checks succeeded and no Action is currently queued or in progress.
- Verified the initial production `/api/health` baseline is healthy.
- Created this branch and independent worktree from current `origin/main` without modifying the dirty planning worktree or existing PR worktrees.
- Created this checkpoint before multi-file diagnosis or implementation.

## Remaining

- Read the current independent-game decision, pool, candidate-audit, rule, schema, and focused-test surfaces needed to implement only PR 4.
- Write focused failing tests for the V7.0 mandatory gates, exact `new_qualified_count === push_pool_count`, the 0/2/7 fixtures, and the seven historical weak samples.
- Implement the smallest pure admission/pool changes and required rule/documentation updates, running narrow tests and committing each verified step.
- Run every PLAN.md final gate: focused tests, typechecks, schema/contract validation, Daily V4 fixtures, `npm run verify:all`, and `git diff --check`.
- Push, create a ready PR to `main`, wait for CI, resolve only in-scope failures, verify scope/reviews/mergeability, and squash merge.
- Verify merged `main`, deployment, production `/api/health`, and PR 4 online acceptance evidence; update this checkpoint and stop before PR 5.

## Next Action

Perform a bounded read-only diagnosis of the current independent-game scoring, pool construction, candidate-audit integration, machine rule, and existing fixtures/tests; then record the exact implementation boundary before writing the first red test.

## Git Status

```text
## codex/pr4-v7-indie-admission...origin/main
?? docs/checkpoints/pr4-v7-indie-admission.md
```
