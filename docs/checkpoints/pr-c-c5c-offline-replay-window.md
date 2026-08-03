# PR C C5-C Offline Replay Window Recovery Checkpoint

Date: 2026-08-03 (Asia/Shanghai)
Phase: Phase 4 exact-head verification recovery
Status: implementation GREEN exists; full verification interrupted and not yet claimable
Branch: codex/pr-c-c5c-offline-replay-window
Exact base: 9dfce284903a72ba61fac1937acc69ab7f6d04c4
Implementation authority: 800f615fd30546eae4f03c89838e59416406c6a5

## Current Goal

Recover from the interrupted compact task without repeating completed work, then finish exact-head verification for the bounded C5-C deterministic offline replay/window implementation. Stop before PR creation, merge, deploy, workflow dispatch, live generator/provider execution, CRM sync, production replay/data writes, the 15-day observation window, or Activation.

## Completed

- Re-pinned remote `main` and this branch through the GitHub API.
- Current `main`/merge base is `9dfce284903a72ba61fac1937acc69ab7f6d04c4`, the merged shadow-only C5-B authority.
- C5-C branch is exactly three commits ahead and zero behind:
  1. `1040985f911fb68627069d9ec4ad04af637ca1ce` — accepted offline replay/window RED.
  2. `59ca1ccb550f149eb00e5071f6123bd1f6481f32` — added the missing deterministic replay-binding RED.
  3. `800f615fd30546eae4f03c89838e59416406c6a5` — minimal implementation GREEN.
- Exact compare contains nine C5-C job/test/schema paths and no checkpoint path before this recovery record.
- The interrupted run visibly completed the exact-`800f615f` focused suite at 43/43, the V7.3 union at 72/72, syntax checks for the four modified/added job MJS files, and replay-window schema JSON parsing.
- No C5-C PR exists. C5-C is not in `main`, not deployed, not live, and not activated.

The completed test counters above are recovered run evidence. They do not imply that commands whose result was lost during the transport failure passed.

## Remaining

- From a fresh GitHub API snapshot of exact implementation authority `800f615fd30546eae4f03c89838e59416406c6a5`, run:
  - `npm run test:daily-v4`
  - `npm run verify:all`
- Recompute and record:
  - exact `main...800f615f` compare and the nine-path scope proof;
  - denylist/no-production-data/no-lockfile/no-Activation guards;
  - independent `git diff --check`;
  - the 38-path behavior manifest/hash claimed by the interrupted run, or report any mismatch.
- If any pending check fails, stop at diagnosis/proposal; do not broaden implementation.
- If all pending checks pass, update this checkpoint with exact evidence and stop for independent QA/next-phase confirmation.

## Next Action

Create one disposable, clean snapshot downloaded from GitHub at exact SHA `800f615fd30546eae4f03c89838e59416406c6a5`; run only the pending full checks and boundary/hash proof. Do not rerun the already completed focused/syntax/schema suite unless a pending check exposes a contradiction.

## Git Status

- Remote `main`: `9dfce284903a72ba61fac1937acc69ab7f6d04c4`
- Branch pre-checkpoint head: `800f615fd30546eae4f03c89838e59416406c6a5`
- Ahead/behind before this docs-only checkpoint: 3/0
- Implementation diff paths: exactly 9
- PR: none for C5-C
- Production authority: V7.2
- Local CRM checkout/worktree: not used or modified

This is an in-progress recovery record. It is not final GREEN evidence and does not authorize a PR, merge, deployment, live replay, observation, or Activation.
