# PR 5 Steam Simplified-Chinese Review Source Checkpoint

Date: 2026-07-16 00:35 CST

Last updated: 2026-07-16 00:59 CST

Authoritative plan: `PLAN.md`

Plan SHA-256: `bdcb4ff6c07ccb19ddfe4f261c4ea08bf0346bdcb762680c3bda7ef8aa053217`

Delivery protocol: `/Users/neo/Documents/GitHub/CRM/docs/CODEX_DELIVERY_WORKFLOW.md` at planning commit `ef2dd37344e40df79e4bc5e2d4e9b234d429026b`

Phase status: Phase 1 diagnosis, Phase 2 bounded proposal, and the user-authorized Phase 3 approval are complete. Phase 4 implementation and documentation alignment are complete: source, pure decision, dedicated artifact/schema/validator/writer, standalone runner, fixed-fixture CI contract, and traceability docs are green. Final repository verification remains.

## Current Goal

Deliver only PLAN.md PR 5: add a deterministic Steam simplified-Chinese review data-source and audit-artifact path that can prefilter publicly searchable Steam PC catalog entries, confirm qualifying projects through official review totals, and require current Early Access to be confirmed by both Steam catalog/tag evidence and official store state, without importing or synchronizing any result to CRM.

## Scope

- Page through a publicly searchable Steam PC game catalog through an injectable network boundary.
- Treat simplified-Chinese catalog/search summaries only as prefilter signals.
- Confirm prefiltered projects through the official Steam review endpoint using `language=schinese` and `purchase_type=all`, preserving positive, negative, total, and calculated positive-rate evidence.
- Require current Early Access to be confirmed independently by Steam catalog/tag evidence and official store AppDetails state.
- Evaluate and record the locked threshold boundaries:
  - EA: at least 1,000 simplified-Chinese reviews and at least 80% positive.
  - China heat: at least 10,000 simplified-Chinese reviews at any positive rate.
- Generate only a schema-valid, deterministic sourcing audit artifact; do not publish Leads or call any CRM import/sync endpoint.
- Keep CI and tests fully fixture-backed with no live Steam dependency.
- Update only directly required source, pure decision, artifact/schema/contract, fixture, test, documentation, and this checkpoint surfaces.

Explicitly out of scope:

- No PR 6 workflow, schedule, `workflow_dispatch`, backfill orchestration, rescan state, create-only CRM import, or sync receipt.
- No formal Lead publication, Daily/Radar/Steam Trends generation changes, existing production workflow changes, or automation trigger changes.
- No PR 7 `china_joint`, PR 8 feedback loop, or PR 9 visual-AI work.
- No frontend, Lead/API, export, Supabase schema, database migration, production-data, secret, account, or permission changes.
- No local generation of real production reports and no direct production sync.

## Why This Slice

- Current problem: AppDetails exposes only aggregate recommendation information, so the system cannot prove the simplified-Chinese review-count and positive-rate thresholds locked for the later EA/high-traction and China-heat lanes.
- Cost of leaving it unresolved: PR 6 would have to mix live catalog collection, review evidence normalization, eligibility decisions, workflow orchestration, and CRM import in one failure domain; threshold decisions would be untestable without live Steam.
- Reason for this boundary: PR 4 already activated deterministic V7.0 independent-game admission and PR 3 established a never-imported candidate audit boundary. PR 5 can therefore add only the missing source evidence and audit contract before any workflow or CRM behavior is enabled.
- Implementation principle: use TDD around pure threshold and evidence-normalization functions; isolate network pagination and endpoint adapters behind injectable fetch; use search-page data only to reduce official review calls; require two independent EA facts; validate artifacts against a versioned schema; keep CI on fixed fixtures.
- Architectural benefit: network volatility cannot alter pure rule tests, live Steam failures cannot break the existing daily report chain, and PR 6 can consume a stable audited dataset without expanding CRM or production-data blast radius.

## Baseline

- Repository: `Neo0109/CRM`.
- Remote `main`: `b36e11fda7aa167e53bde0de0f58508d3f7b524c` (`Activate V7.0 indie admission and health contract (#90)`).
- Completed plan slices: PR 0 quality quarantine; PR 1 Lead/API contract (`#87`); PR 2 manual priority UI (`#88`); PR 3 candidate audit artifacts (`#89`); PR 4 V7.0 indie admission (`#90`).
- Open PR queue: unrelated PR `#71` only.
- Latest main Build: success, run `29431050099`, head SHA `b36e11fda7aa167e53bde0de0f58508d3f7b524c`.
- Latest main Cloudflare Pages deployment check: success for head SHA `b36e11fda7aa167e53bde0de0f58508d3f7b524c`.
- Actions queue at baseline: no queued or in-progress runs.
- Production health baseline: HTTP `200`, `ok=true`, version `v2.7.6-sourcing-evidence-integrity`, storage `supabase`.
- Branch: `codex/pr5-steam-schinese-review-source`.
- Worktree: `/Users/neo/Documents/GitHub/CRM-pr5-steam-schinese-review-source`.
- Starting HEAD: `b36e11fda7aa167e53bde0de0f58508d3f7b524c`.

## Diagnosis And Bounded Proposal

- The current Daily Steam source calls only the first 50-result page for each curated query/filter, localizes several discovery pages to simplified Chinese, and parses a localized review label, but it does not page through the publicly searchable PC catalog or preserve a numeric catalog review summary.
- Current AppDetails enrichment exposes only aggregate `details.recommendations.total`. It cannot prove `language=schinese`, cannot split positive and negative counts, and therefore cannot execute either locked PR 5 threshold.
- PR 3 deliberately reserved `positive_reviews`, `negative_reviews`, `total_reviews`, `positive_rate`, `language`, and `purchase_type` fields in the existing Daily sourcing-candidate schema, but left them `null` and documented that no new review network collection was in PR 3 scope.
- The existing Daily generator writes `data/sourcing_candidates/YYYY-MM-DD.json` as the fourth artifact for V7.0 indie admission. Reusing that same path for a full-catalog review scan would overwrite or couple the Daily audit, violating the PR 5/PR 6 separation.
- The smallest safe source boundary is therefore a new standalone `steam_review_opportunity_source` module plus a dedicated `data/steam_review_opportunities/YYYY-MM-DD.json` schema and writer. It will not be imported by the current Daily generator, either production workflow, or any CRM function.
- Catalog collection will use the existing public Steam `search/results` shape with `category1=998`, `os=win`, `cc=cn`, `l=schinese`, and an injectable fetch implementation. Pagination will stop only when the reported total is covered or the source explicitly returns no more results; bounded/test scans must record `scan_complete=false`.
- The localized catalog review summary is a prefilter only. It can trigger an official lookup but can never qualify a record. The prefilter selects a catalog EA-tagged item at 1,000+ summarized reviews or any item at 10,000+ summarized reviews.
- Official confirmation will call `appreviews/<appid>` with documented `filter=all`, `language=schinese`, `purchase_type=all`, `review_type=all`, and a minimal first page. The artifact will store `total_positive`, `total_negative`, `total_reviews`, and a positive rate calculated from the raw counts.
- Current Early Access will require two independent facts: the catalog result carries the Steam EA tag and AppDetails/store metadata independently identifies Early Access. A single signal is auditable but cannot satisfy `ea_mobile_high_traction`.
- Pure qualification will implement the locked boundaries without ranking or limits: 999 reviews fails EA; 1,000 at 79.99% fails EA; 1,000 at 80% passes EA; 10,000 passes `china_heat_ops` at any positive rate. When both match, `china_heat_ops` is primary and all matched rules remain recorded.
- The artifact will contain scan completeness/counts, per-AppID source evidence, official review evidence, both EA facts, matched rules, primary lane, and exclusion/missing-evidence reasons. It is an audit dataset only and will expose no CRM payload or sync behavior.
- Phase 4 will add one fixed input fixture, pure/network-boundary tests, schema/contract tests, and a static guard proving no existing workflow, Daily generator, import job, or CRM sync path references the new artifact.

## Completed

- Read the complete repository `AGENTS.md`, authoritative remote-main `PLAN.md`, and explicitly required delivery protocol.
- Confirmed the PLAN.md hash and locked PR 5 scope, threshold boundaries, fixture-only CI rule, artifact-only output, and no-CRM-sync boundary.
- Fetched current `origin/main`, confirmed PR 4 is merged, and confirmed only unrelated PR `#71` remains open.
- Confirmed the latest main Build and Cloudflare Pages deployment checks succeeded and no Action is queued or in progress.
- Verified the initial production `/api/health` baseline is healthy.
- Created this branch and independent worktree from current `origin/main` without modifying the dirty planning checkout or existing PR0-PR4 worktrees.
- Created this checkpoint before multi-file diagnosis or implementation.
- Completed the bounded read-only diagnosis across the existing Steam search/AppDetails source, network adapter, Daily orchestrator, V7 admission, candidate-audit builder/schema, contract validator, workflow/import boundary, fixtures, and verification entrypoint.
- Verified the pre-existing Steam-source and candidate-audit baseline is green: 14/14 focused tests.
- Confirmed Steam's official review-list contract returns `query_summary.total_positive`, `total_negative`, and `total_reviews`, and documents both `language` and `purchase_type`; selected only documented request parameters.
- Recorded the exact standalone source/artifact implementation boundary above without changing current Daily, workflow, Lead, or sync behavior.
- Added the fixed catalog-page, official review-summary, AppDetails, and exact-threshold fixture for five deterministic candidates; the fixture JSON parses successfully.
- Added focused source-contract tests for localized count/EA-tag parsing, complete pagination, prefilter-only catalog evidence, the documented official review query, raw-count rate calculation, two-fact EA confirmation, all locked threshold edges, full-set retention, and fixed-fixture collection.
- Captured the focused red run: `node --test automations/test/steamReviewOpportunitySource.test.mjs` fails only with `ERR_MODULE_NOT_FOUND` for the planned `steam_review_opportunity_source.mjs`.
- Added `steam_review_opportunity_source.mjs` with an injectable public-PC-catalog paginator, deterministic AppID dedupe, localized review-count/EA-tag parsing, prefilter-only catalog evidence, documented official simplified-Chinese review-summary requests, raw-count positive-rate normalization, and explicit source-failure tracking.
- Added the pure EA/high-traction and China-heat evaluator with two-fact current-EA confirmation, exact locked thresholds, both-rule preservation, and `china_heat_ops` primary-lane precedence.
- Added fixed-fixture orchestration that retains every prefilter hit without caps, records missing official evidence instead of promoting it, and makes overall scan completeness false on any catalog/review/AppDetails failure.
- Focused source contract is green: 7/7. Combined new source, existing Steam source, and existing sourcing-candidate audit regression set is green: 21/21; standalone `git diff --check` is also green.
- Added the focused artifact red contract for exact scan/decision counts, deterministic snake-case evidence shape, AppID uniqueness, raw-review/count integrity, false-complete rejection, sanitized dedicated-path writing, JSON-schema validation, the fixed-fixture Build entrypoint, and static proof that Daily/workflow/import/CRM paths do not consume this artifact.
- Captured the artifact red run: `node --test automations/test/steamReviewOpportunityArtifact.test.mjs` fails only with `ERR_MODULE_NOT_FOUND` for the planned `steam_review_opportunity_artifact.mjs`.
- Added the versioned `steam_review_opportunities` JSON schema and deterministic builder/integrity validator. It enforces scan/count parity, unique AppIDs, raw positive-plus-negative totals, calculated positive rate, exact language/purchase/source facts, EA two-fact qualification, both-rule/primary-lane consistency, and `scan_complete=false` whenever a source failure exists.
- Added the dedicated writer through the existing recursive private-field sanitizer and the standalone `steam_review_opportunity_audit.mjs` runner. Its only default output is `data/steam_review_opportunities/YYYY-MM-DD.json`; bounded scans remain explicitly incomplete.
- Added `validate-steam-review-opportunities.mjs`, root/automation package entrypoints, and a Build step that runs only the two fixed-fixture PR 5 tests. No production daily workflow, Daily generator, import job, or CRM sync path references the new artifact.
- Restored ignored workspace dependencies with `npm install --package-lock=false`; no tracked lockfile or dependency artifact was created. The audit reported two pre-existing dependency vulnerabilities, which are unrelated and were not auto-fixed or widened into this PR.
- Corrected null evidence preservation so an unavailable official review summary cannot become a synthetic `0%` value; the integrity contract now requires every unknown official metric to remain `null`.
- Combined new source/artifact, existing Steam source, and existing sourcing-candidate audit regression set is green: 27/27. Dedicated JSON-schema validation and standalone `git diff --check` are green.
- Added `docs/STEAM_REVIEW_OPPORTUNITY_SOURCE.md` as the human-readable source/artifact contract and linked it from the current-rule entrypoint.
- Updated current and V7.0 rule documentation to state precisely that the PR 5 source exists but is audit-only, is not consumed by V7.0 or any current production workflow/import path, and cannot activate EA/high-traction or China-heat publication before PR 6.
- Extended the fixed artifact guard to require the current-rule pointer, explicit non-import boundary, and fixture-only CI statement. The combined focused regression set remains green: 27/27.

## Remaining

- Implement each verified step, updating this checkpoint and committing after each step as required by the delivery protocol.
- Run all focused tests, relevant typechecks, schema/contract checks, `npm run verify:all`, and standalone `git diff --check`.
- Audit the full diff against PLAN.md PR 5, push, open a ready PR to `main`, wait for all checks, resolve only in-scope failures, and verify clean mergeability plus zero unresolved review threads.
- Squash merge only when all delivery guards pass.
- Verify merged `main`, Build/deployment, production `/api/health`, and PR 5 online acceptance evidence; update this checkpoint and stop before PR 6.

## Next Action

Commit the documentation-alignment step, then run the complete required validation set: focused PR 5 tests, full Daily V4, frontend/backend/Functions typechecks, Daily and dedicated schema/contracts, `npm run verify:all`, standalone `git diff --check`, and final scope audit against `origin/main`.

## Git Status

```text
## codex/pr5-steam-schinese-review-source...origin/main [ahead 6]
 M automations/test/steamReviewOpportunityArtifact.test.mjs
 M docs/SOURCING_RULES_CURRENT.md
 M docs/SOURCING_RULES_V7_0.md
 M docs/checkpoints/pr5-steam-schinese-review-source.md
?? docs/STEAM_REVIEW_OPPORTUNITY_SOURCE.md
```
