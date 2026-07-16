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

## Remaining

- Inspect the current regular sourcing source/decision/report/test boundaries.
- Add failing focused fixtures for all locked PR 7 gates and the 9-formal union invariant.
- Implement `china_joint` admission and parallel unbounded output.
- Run focused tests and update this checkpoint at each verifiable step.
- Run Daily V4, schema/contract, typecheck, `npm run verify:all`, and `git diff --check`.
- Commit, push, open PR, wait for checks/reviews/mergeability, and squash merge.
- Verify post-merge Build, Cloudflare deployment, production `/api/health`, and PR 7 online acceptance; record final evidence and stop before PR 8.

## Next Action

Perform the read-only PR 7 code-boundary diagnosis in this worktree, then add the focused red tests without reading or changing PR 6 implementation.

## Git Status

- Branch: `codex/pr7-v7-2-china-joint` tracking `origin/main`.
- Worktree: isolated at `/Users/neo/Documents/GitHub/CRM-pr7-v7-2-china-joint`.
- Expected change: this newly created checkpoint only.
