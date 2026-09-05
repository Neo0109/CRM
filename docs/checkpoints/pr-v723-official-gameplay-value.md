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
Run the full fixed Daily/V7.3 suite, repository verification, types/contracts and diff checks on the pinned branch snapshot; then create the single PR.

## Frozen input evidence
Ten official AppDetails fixtures (five titles, english/schinese) were fetched on 2026-09-06. Each carries its exact source URL, full-game type and AppID. Only relevant public product fields are retained; contacts and media assets are omitted. Fixtures are recognition evidence, not import authorization.

## Git Status
Remote branch created from the baseline. Local checkout is read-only and retains its existing three draft paths.

## Recognition stage evidence
- Focused baseline RED: 0/7 passed before helper implementation.
- Focused GREEN: 7/7 passed, including ten frozen language variants, full-admission negatives, unlimited strict (7), capped review (3), cross-source dedupe and audit/report parity.
- The same official inputs gain a content hook only; none becomes a strict Lead from text alone. No live import conclusion is asserted.
- Baseline production health: HTTP 200, ok=true, v2.8.1-steam-direct-link-button, shared storage enabled.
