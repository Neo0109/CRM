# PR 4 V7.0 Indie Admission Checkpoint

Date: 2026-07-15 22:52 CST

Last updated: 2026-07-15 23:36 CST

Authoritative plan: `PLAN.md`

Plan SHA-256: `bdcb4ff6c07ccb19ddfe4f261c4ea08bf0346bdcb762680c3bda7ef8aa053217`

Delivery protocol: `docs/CODEX_DELIVERY_WORKFLOW.md`

Phase status: Phase 4 implementation is in progress. The pure V7.0 admission contract, formal-pool routing, shared candidate-audit decision, and existing-source evidence projection are implemented and narrowly green. Active machine-rule/version activation, count-health removal, documentation, and final verification remain.

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
- Completed the bounded PR 4 diagnosis across the active rule loader, machine rule, Steam enrichment, media/Bilibili enrichment, scoring/decision module, pool builder, candidate audit, report builders, Daily contract validator, watchdogs, cloud heartbeat, workflows, and focused tests.
- Confirmed the active bypass mechanisms are localized and directly in scope:
  - Steam and media discovery scores currently decide push/watch class before a mandatory evidence contract;
  - `buildPools` caps/interleaves formal output, targets `minReviewLeads`, backfills eligible drops into watch, and promotes P3 to P2;
  - both production workflows still pass `--minReviewLeads=18`, `--minMediaLeads=10`, and `--minReviewBackfillScore=18`;
  - the validator, local watchdog, cloud heartbeat, runbook, and stale tests still retain formal-count targets, although V6.8 temporarily suppresses them;
  - V6.8 currently clears all Lead pools after pre-quarantine decisions, so PR 4 must activate V7.0 rather than layer another post-decision filter.
- Confirmed the safe evidence mapping for the locked PLAN.md gates:
  - source labels, genre keywords, numeric score, screenshots, movie count, field completeness, and Steam fallback contact remain discovery/ranking signals only;
  - a formal Lead requires a normalized identity, verified pre-release/TBA window, verified non-EA state, no mature publisher/China-capability occupancy, non-narrative and non-India evidence, official Demo/Playtest evidence, explicit official gameplay evidence, verified independent public-quality data, a non-Steam business entrypoint, and a concrete gameplay-linked China/Bilibili value statement;
  - overseas candidates additionally require explicit China demand; absent or unknown evidence cannot pass;
  - hard contradictory facts become `excluded`; incomplete positive evidence remains `candidate`; neither is published to Daily Lead pools.
- Selected the smallest implementation boundary:
  - add one pure V7.0 indie-admission module with stable gate IDs and Steam/media evidence adapters;
  - keep existing scores only for discovery/enrichment order, never admission;
  - make `buildPools` publish every deduped qualified project to `push` with `priority=null` and V7.0 provenance, with `watch` and `drop` empty and no cap/backfill;
  - make candidate-audit decisions and reasons come from the same admission result, and add `new_qualified_count` / `push_pool_count` contract parity;
  - activate `sourcing-rules-v7.0-quality-gated-indie`, remove formal-count CLI/health gates while preserving non-Lead artifact/source/sync checks, and update the current human/machine rule chain;
  - keep workflow triggers, CRM import payload, schemas outside the directly required candidate-summary extension, Lead/API/UI/Supabase, and PR 5+ sources unchanged.
- Reconstructed the exact seven historical weak Steam regression samples from dated reports; every one states that strong public data is missing:
  - `Brainrot Fight` (`4867700`), `Sweet Dance` (`4560290`), `鏡` (`4869740`), `I Am the Demon King: Stop Sun Wukong` (`4785810`), `Fantasy World / 幻想世界` (`4212170`), `从零开始的钓鱼人生Lift` (`4889630`), and `仙途有约` (`4833750`).
- Added `automations/test/fixtures/v7-indie-admission.json` with one complete qualified evidence contract, one non-compensating failure per mandatory gate, exact 0/2/7 qualified-count cases, and the seven historical weak Steam samples/AppIDs.
- Added `automations/test/onlineDailyV7IndieAdmission.test.mjs` covering mandatory gate non-bypass, discovery-score irrelevance, exact qualified/push parity, no truncation/backfill, nullable automatic priority and V7 provenance, cross-source dedupe, historical weak-sample rejection, and candidate-audit formal/candidate/excluded routing.
- Captured the focused red run: `node --test automations/test/onlineDailyV7IndieAdmission.test.mjs` failed only with `ERR_MODULE_NOT_FOUND` for the planned `online_daily_v7_indie_admission.mjs`, proving the new contract is not yet implemented.
- Added `online_daily_v7_indie_admission.mjs` with eleven stable, non-compensating gate IDs, explicit pass/fail/unknown states, hard-exclusion versus missing-evidence routing, Steam/media evidence adapters, cross-source dedupe keys, and the locked `sourcing-rules-v7.0-quality-gated-indie` version.
- Kept score/source/tag/asset-count behavior available only for discovery ordering; the admission evaluator never reads discovery score.
- Replaced active `buildPools` quantity/cap/backfill behavior with one deduped set of fully qualified Steam/media projects: every qualified project is published to `push`, `watch` and `drop` stay empty, `priority=null`, and V7.0 lane/rule/run provenance is explicit.
- Removed the P3-to-P2 promotion and all per-source/total formal-pool slices from `buildPools`; `new_qualified_count` is the deduped qualified count and is constructed from the exact published push set.
- Routed V7 candidate-audit formal/candidate/excluded decisions, missing-evidence gate IDs, and hard exclusion reasons through the same evaluator; legacy V6.8 candidate fixtures retain their historical behavior.
- Updated the pre-existing decision tests to the approved V7 semantics: failed/near-window candidates are retained only in audit rather than Daily `drop_pool`, and old score-based push expectations are replaced by explicit admission evidence.
- Focused V7 test is green: 8/8.
- Related decision, candidate-audit, and V7 regression set is green: 23/23.
- Added source-level red tests for explicit official Demo/gameplay and public-quality projection; the first run failed 2/8 because the enriched Steam candidate did not yet expose those fields.
- Projected only existing first-party/verified data into admission evidence:
  - Steam `details.demos` produces official Demo evidence;
  - only Steam movie names or matched official Bilibili source text that explicitly says gameplay/实机/玩法/试玩 produces official gameplay evidence;
  - screenshots and generic announcement/cinematic trailers never produce official gameplay evidence;
  - verified Steam recommendations `>=500` or Metacritic `>=75` produce independent public-quality proof;
  - existing non-Steam email/website/community contacts remain the only business-entry candidates;
  - known systemic gameplay tags produce a concrete China/Bilibili content-and-community value statement;
  - overseas China demand is accepted only when official text contains both China/Chinese terms and publishing/localization/marketing/operations partnership intent.
- Added a cross-source regression proving an actually enriched official media candidate uses the same eleven-gate contract rather than its legacy media score/class.
- Steam source projection test is green: 8/8; focused V7 admission test is green: 9/9; combined source/admission set is green: 17/17.
- Recovered the interrupted worktree on `codex/pr4-v7-indie-admission`, confirmed remote `main` is unchanged from the PR 4 baseline, no PR already exists for this branch, and only unrelated PR `#71` is open.
- Added the focused V7 activation/health contract test and captured the expected red run: 0/5 passed because the canonical V7 rule doc is absent, V6.8 quarantine is still active, report text is still V6.8, qualified/push parity is not enforced, and the sourcing-candidate schema does not yet allow the parity counts.

## Remaining

- Activate the V7.0 machine/human rule chain and report text; remove formal-count CLI/validator/watchdog/heartbeat/workflow/runbook behavior and add candidate-summary parity schema/contract checks.
- Run every PLAN.md final gate: focused tests, typechecks, schema/contract validation, Daily V4 fixtures, `npm run verify:all`, and `git diff --check`.
- Push, create a ready PR to `main`, wait for CI, resolve only in-scope failures, verify scope/reviews/mergeability, and squash merge.
- Verify merged `main`, deployment, production `/api/health`, and PR 4 online acceptance evidence; update this checkpoint and stop before PR 5.

## Next Action

Make the focused V7 activation/health contract green by activating the machine/human rule chain and report text, disabling only V6.8 quarantine/formal-count behavior, enforcing qualified/push parity, and extending the sourcing-candidate schema for the two parity counts.

## Git Status

```text
## codex/pr4-v7-indie-admission...origin/main [ahead 5]
 M docs/checkpoints/pr4-v7-indie-admission.md
?? automations/test/onlineDailyV7Activation.test.mjs
```
