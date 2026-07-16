# PR 7 Checkpoint: V7.2 2A/3A 中国联合发行准入

## Current Goal

Implement only PLAN.md PR 7: add the unbounded `china_joint` admission lane alongside `indie_prelaunch`, with locked evidence and commercial gates, then deliver and accept it through an isolated PR.

## Overall Progress Checkpoint

- Baseline `origin/main`: `99697feb3ba7b11d5af1265884bd42869845870c`.
- Completed plan modules: PR 0 through PR 6 are accepted; PR 6 is out of scope and must not be rechecked, modified, or rerun.
- Open PR queue at start: unrelated PR `#71` only; it remains untouched.
- This PR touches only the PR 7 `china_joint` rule, its shared-evidence integration with the existing independent-game scan, fixed fixtures/tests, rule documentation, and this checkpoint.
- Explicitly out of scope: PR 6 Steam review workflow and artifacts, Daily workflow trigger boundaries, UI/product work, database migrations, production-data writes, credentials/permissions, and PR 8 or later work.

## Diagnosis And Approved Proposal

- Current gap from PLAN.md: the production rule admits early independent projects but has no explicit 2A/3A China joint-publishing lane, so projects with established traction and an unoccupied China opportunity cannot be formally recommended through the regular scan.
- Impact if left unchanged: the regular pipeline systematically misses qualified joint-publishing, licensing, localization, marketing, mobile, or co-operation opportunities even when their product evidence is stronger than the indie threshold.
- Approved operation: extend the regular decision layer with `china_joint` in parallel with `indie_prelaunch`, without a lane quota or total cap. A project must pass one locked data path and both locked commercial gates; every complete pass is formal and ranking affects reading order only.
- Engineering method: add fixed red/green decision and integration fixtures, reuse the existing evidence/decision/report boundaries, keep lane-specific commercial gates explicit, and protect the unbounded union with a same-day 5 indie + 4 joint fixture.
- Architecture benefit: shared normalized evidence can serve both lanes while each lane retains non-bypassable admission rules, limiting blast radius to the regular sourcing decision layer and keeping PR 6 and live generators independent.
- Phase 2 is the locked PLAN.md PR 7 proposal. The user's current instruction supplies Phase 3 approval and full autonomous delivery authorization within this exact scope.

## Completed

- Read AGENTS.md, PLAN.md, and docs/CODEX_DELIVERY_WORKFLOW.md.
- Confirmed the start SHA and open PR queue.
- Created branch `codex/pr7-v7-2-china-joint` and isolated worktree `/Users/neo/Documents/GitHub/CRM-pr7-v7-2-china-joint` from the latest `origin/main`.
- Recorded scope boundaries and approval state in this checkpoint.
- Completed the read-only PR 7 boundary diagnosis:
  - Daily V4 already gathers regular Steam discovery plus media/product-event evidence and enriches normalized Steam details outside PR 6.
  - `buildPools` has no formal output quota or backfill; its missing behavior is that it evaluates only `indie_prelaunch`.
  - Existing Steam enrichment already exposes exact recommendation counts, public rating text, developer/publisher identity, current source context, explicit China-demand text, and partner-occupancy state needed by PR 7.
  - The locked `5000` and `1500 + Very/Overwhelmingly Positive` traction paths exist only as a legacy boolean helper, not as an auditable non-compensating `china_joint` admission decision.
  - Candidate audit currently recomputes only the indie decision, so PR 7 must introduce one shared selected-admission result used by both formal publication and audit routing.
  - The active machine/human rule chain remains V7.0 and needs a V7.2 canonical entrypoint; schemas and Lead model already permit `china_joint`, so no migration or API-contract expansion is needed.
- Added the fixed PR 7 red-test contract:
  - exact `5000`, `1500 + Very Positive`, `1500 + Overwhelmingly Positive`, and verified-major-title plus current-official-event boundaries;
  - negative `4999`, `1499`, ordinary Positive, missing event, and missing track-record boundaries;
  - mandatory current China-opportunity and mature-China-partner-clear gates;
  - Steam and official-media evidence adapters;
  - the required same-day fixture with exactly 5 qualified indie projects plus 4 qualified joint projects, all 9 required in the formal pool;
  - no-China-demand and occupied-China-partner exclusions in both formal output and candidate audit.
- Confirmed the expected red state with `node --test automations/test/onlineDailyV7ChinaJointAdmission.test.mjs`: it fails because the two new PR 7 admission modules do not yet exist.
- Implemented the focused PR 7 decision slice:
  - added an auditable `china_joint` evaluator with four non-compensating gates and exact boundary handling for all three locked data paths;
  - requires structured current China business-opportunity evidence and a confirmed clear mature-China-partner state;
  - maps regular Steam and official-media evidence without importing or changing the PR 6 Steam review-opportunity path;
  - added a shared regular-lane selector used by both `buildPools` and candidate audit, preserving an already-qualified indie classification before admitting the new joint lane;
  - keeps the published union deduped and unbounded, with `priority=null` and one active V7.2 provenance version.
- Focused green evidence: `node --test automations/test/onlineDailyV7ChinaJointAdmission.test.mjs` passes 6/6, including the required 9-formal fixture and both exclusion cases.
- Activated the complete regular V7.2 chain:
  - active runtime/machine version is `sourcing-rules-v7.2-china-joint`, with canonical `docs/SOURCING_RULES_V7_2.md` and the current-rule pointer updated;
  - machine rules preserve all eleven indie gates and add the four joint gates, exact thresholds, allowed China-opportunity types, null priority, and null min/max formal limits;
  - Daily/Radar/Steam Trends copy reports both lanes, while heartbeat parity accepts active V7.2 and historical V7.0 artifacts;
  - Steam enrichment records mature-China-partner occupancy separately from general mature publishers;
  - global media signals with a concrete current China cooperation need enter regular enrichment, and a released/near-window or globally published project is retained only when the full `china_joint` decision passes;
  - removed the post-enrichment media candidate selection cap so no qualified project can be discarded by a per-source or total formal-output quota.
- Updated only PR 7-scoped stale assertions for the active version, canonical document, reports, source mapping, and heartbeat fixture.
- Narrow activation regression passed 62/62 across the new joint fixture, preserved indie contracts, activation, rules, reports, candidate audit, Steam source, media source, and media enrichment.
- Additional media-lane regression passed 13/13, including global China-opportunity discovery and released high-traction joint qualification.
- Resumed the interrupted PR 7 delivery from the isolated worktree without reimplementing or refactoring the completed V7.2 rule chain:
  - confirmed `/Users/neo/Documents/GitHub/CRM-pr7-v7-2-china-joint` on `codex/pr7-v7-2-china-joint` at `1701285` with `origin/main` still `99697feb3ba7b11d5af1265884bd42869845870c`;
  - confirmed the only uncommitted files were two PR 7-scoped stale Daily V4 assertions for the active regular rule version/private admission field and V7.2 documentation/report copy;
  - left the unrelated modified `codex/sourcing-rules-vnext` main checkout and open PR `#71` untouched;
  - confirmed there were no queued or in-progress Actions before final validation.
- Completed the full PR 7 local validation contract:
  - `npm run test:daily-v4` passed 155/155;
  - `npm run validate:daily -- --date=2026-07-15` passed the standalone Daily schema/contract check with no warnings;
  - frontend, backend, and Functions typechecks all passed;
  - `npm run verify:all` passed all repository tests, diagnostics, typechecks, sourcing/Daily contracts, temporary production frontend build, and its integrated diff check;
  - standalone `git diff --check` passed.

## Remaining

- Commit, push, open PR, wait for checks/reviews/mergeability, and squash merge.
- Verify post-merge Build, Cloudflare deployment, production `/api/health`, and PR 7 online acceptance; record final evidence and stop before PR 8.

## Next Action

Commit the two validated stale-assertion fixes plus this checkpoint, push the complete PR 7 branch, and open the ready PR against `main`.

## Git Status

- Branch: `codex/pr7-v7-2-china-joint` tracking `origin/main`.
- Worktree: isolated at `/Users/neo/Documents/GitHub/CRM-pr7-v7-2-china-joint`.
- Commits on branch: setup `27ef1fc`, diagnosis `fe5cd0d`, red contract `436f863`, green decision `7019ed2`, and V7.2 activation `1701285`.
- Expected uncommitted change before the final local commit: `automations/test/onlineDailyV4Decision.test.mjs`, `automations/test/onlineDailyV4QualityQuarantine.test.mjs`, and this checkpoint only.
