# V7.2.3 official gameplay value checkpoint

## Current Goal
Implement the user-approved official Steam gameplay fallback to increase worthwhile Leads by an observed 5–10/week without a quota or weakened admission.

## Baseline and scope
- Remote main: 2f3d6ce4567efe46eb577badca316f908f9ed43f; Radar #124 is merged and outside this PR.
- Branch: codex/v723-official-gameplay-value; one independent sourcing PR.
- Allowed: shared indie-admission pure helper, Steam/media fallback wiring, active rule metadata/docs, frozen fixtures and focused regressions, this checkpoint and PLAN appendix.
- Excluded: search/network expansion, Bilibili identity, cross-platform release inference, Radar, Lead/API/UI/database/report/snapshot contracts, cache purge, workflow triggers, real generation/sync/dispatch.
- All hard gates, unlimited strict Leads, exactly one review soft gap and review cap 3/day remain in force. Existing evidence wins. Seven-day cache TTL remains unchanged.

## Completed
- User explicitly approved implementation, testing, one PR, normal merge/deploy and acceptance in this session.
- Refreshed remote main, open PR queue (empty), successful baseline Build, and daily run state.
- Preserved local dirty draft checkout; source delivery uses GitHub API only.

## Remaining
1. Freeze the five official samples and prove a focused red test.
2. Implement fallback and rule version sourcing-rules-v7.2.3-official-gameplay-value; run focused tests.
3. Daily V4, verify:all, types/contracts, V7.3 compatibility and diff checks; review exact PR head.
4. Merge, verify remote main/Build/deployment/health and update acceptance evidence.
5. Business observation after natural cache renewal: seven consecutive natural daily runs with successful sync receipts; 5–10 worthwhile additions/week remains unverified until measured.

## Next Action
Capture pinned official samples and add deterministic red tests; no live generator or CRM writes.

## Git Status
Remote branch created from the baseline. Local checkout is read-only and retains its existing three draft paths.
