# Radar relevance and domestic-report preference

## Current Goal
Deliver only the user-approved 2026-09-15 Radar plan: game relevance first, one representative per confirmed event, preferring complete domestic coverage in the existing source pool.

## Completed
- Diagnosis, proposal and explicit implementation approval recovered from the original task. Resume task: 01a0a325-cc9e-7ae1-97cb-0c01c22949b7.
- Baseline main: 2ed65ed3aa8e3bd7e2c3d5f961fc05b0916d0a44. Only PR #127 is in scope.
- Independent pre-Lead-filter Radar snapshot and relevance scoring for all publishers; preserve demos, trailers, reviews, updates, platform awards and development coverage.
- Conservative bilingual/reference event matching and complete domestic representative selection with cap fallback; uncertain events and distinct games, versions, mod types and reviews are retained.
- Remove 16/16 regional fill targets; preserve 40 external, 3/source, 24/region, 12/topic, 3 aggregate Bilibili, 72-hour publication eligibility and seven-day history.
- Domestic metadata priority within the existing network budget; exclude navigation/header/footer/aside links from attribution evidence.
- Formal Lead admission and Steam behavior, public API/schema/UI and daily workflow triggers unchanged. Machine-rule semantic diff is only radar_diversity.targets.
- TDD evidence: initial 8 failures at run 34924129519; recovery 3 failures (awards, unknown products, independent review) at 34925991771; attribution fixture failure at 34926216346.
- Final implementation 1e321282fbfb3380c90218d893d9e34f394ead4e verified by https://github.com/Neo0109/CRM/actions/runs/34926311405: Radar 30/30, Daily 395/395, frontend 136/136, backend 30/30, Functions 44/44; all verify:all, types/contracts/diff checks passed. Build runs 34926311406 and 34926308712, and Cloudflare preview check passed.
- Four archived editions reviewed: 9/12 36->32; 9/13 31->29; 9/14 35->30; 9/15 34->34. 9/14 removes two unrelated stories and one giveaway roundup, and merges two duplicate events.
- Archived replay uses synthetic publication times and proves curation only. It contains zero domestic substitutions; replacement/fallback is proven by fixed fixtures, with actual natural-run substitution yield still unmeasured.
- Exact implementation diff reviewed; no outstanding reviews/comments, no conflicts, no evidence-backed blocking regression.
- Production baseline health ok=true, version=v2.8.1-steam-direct-link-button, storage=supabase. The Radar API requires login (401); no GUI capture is authorized.

- PR #127 squash-merged at 3b4c3388991c092f1e351668f085d1371348bca2; remote main confirmed at that SHA.
- Main Build https://github.com/Neo0109/CRM/actions/runs/34926882636 succeeded. Cloudflare Pages check for exact merge 3b4c338 succeeded; deployment 9fd1a5c8-1a0f-4327-93bf-8a95d9c509cf.
- Post-deploy production /api/health: ok=true, version=v2.8.1-steam-direct-link-button, storage=supabase. UI version is unchanged because this is an automation-only change.
- Existing 2026-09-15 Radar contains 34 external cards. Existing watchdog receipt captured at 2026-09-15T03:07:59.409Z has status=success and parsed synced=true, but predates the new implementation and is NOT acceptance evidence for PR #127.
- Visual acceptance incomplete: the Radar API requires login, and no GUI inspection was requested or approved. Cloud content evidence remains the acceptance route.

## Remaining
- Inspect one new cloud-generated Radar edition, runtime diagnostics and receipt requiring status=success and parsed sync_response.synced=true.
- Record deployment and content acceptance here and in the PR body; do not claim actual domestic coverage uplift from fixed tests.

## Next Action
User explicitly authorized immediate manual generation and CRM sync on 2026-09-15 at approximately 12:09 Asia/Shanghai. Remote main is 3b4c3388991c092f1e351668f085d1371348bca2; no active main automation was found. Dispatch exactly one sync-daily-report.yml run on main for date 2026-09-15, slot radar-pr127-acceptance, force=true; then inspect the run and receipt. Do not dispatch a duplicate.

## Git Status
- Branch codex/radar-relevance-domestic-first; PR https://github.com/Neo0109/CRM/pull/127.
- Implementation head 1e321282fbfb3380c90218d893d9e34f394ead4e; this checkpoint-only commit does not alter the verified implementation.
- All repository changes used GitHub App/API. Local checkout stayed read-only; existing user modifications were preserved.
- This post-merge checkpoint is stored on the retained PR branch; append the later content acceptance evidence here and link its exact revision from the merged PR, without direct writes to main.
