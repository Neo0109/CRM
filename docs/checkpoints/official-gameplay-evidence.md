# Official gameplay metadata evidence

## Current Goal
Implement the user-approved official-information-only gameplay evidence plan in one sourcing PR. No video/frame analysis or model calls.

## Baseline and scope
- Remote main: 742f496fad982e9da5a76bb0f43adbbc733033d1; open PR queue empty. PR #126 content-value recognition and #127 Radar are completed and preserved.
- Scope: official Steam trailer category/description and identity, verified same-game Bilibili evidence, modern playback URLs, bounded missing-gameplay refresh including cached candidates, fixed tests and a 46-candidate evidence audit.
- Preserve every other admission gate, formal/review distinction, public CRM API/UI/database, workflow triggers and existing manual visual-AI isolation.

## Completed
- Diagnosis and proposal completed; the user explicitly approved implementation and independent PR delivery.
- Refreshed remote main/PRs/Actions; health HTTP 200, ok=true, v2.8.1-steam-direct-link-button.
- Read local delivery protocol (not present on remote main); use GitHub App/API and disposable exact-commit test snapshots only.

## Remaining
1. Verify category enum and finish 46-row same-input admission/publication audit.
2. Fix compatibility manifests for the approved modules; install test dependencies and run full verification.
3. Exact-head review, PR, normal squash merge/deploy and scheduled-run acceptance.

## Next Action
Resume from branch edd319b: inspect the frozen 46 samples, validate category mapping, fix compatibility contracts, then verify:all. Do not restart diagnosis or broaden admission gates.

## Git Status
Remote branch codex/official-gameplay-evidence from 742f496fad982e9da5a76bb0f43adbbc733033d1. Local checkout read-only; the existing three draft paths are unchanged.

## Sample collection
- Collected official store metadata for all 46 frozen candidate identities. No video download, frame extraction or AI calls occurred.
- Added RED contracts for category-based recognition, bound descriptions, modern URLs, Bilibili identity, shared budget, cached evidence and failure cooldown.

## RED / implementation
- Exact branch RED failed with ERR_MODULE_NOT_FOUND for the new official metadata helper, before implementation.
- Implemented pure source-bound metadata extraction and shared-budget refresh with an additive per-candidate lookup ledger. Existing media official lookup phase receives half the 12-slot ceiling; unused capacity goes to gameplay refresh, so neither path adds a second budget.
- No change to the 7-day broad evidence snapshot TTL. Cached missing-gameplay candidates receive a separate targeted lookup and same-day cooldown.

## Recovery checkpoint (2026-09-16)
- Recovered the approved user request from task 01a0a480-58ee-7953-bf43-d1c5d6d845ca and verified remote branch edd319b0071ecb554b8791cdd20bac4e4f715bb0. No PR yet.
- Remote main is 96c09553ad9601b01a9225d9988dc1cf86bf9aa7; the only drift since 742f496 is scheduled data and sync receipts. Build of edd319b passed; production health is HTTP 200 / ok=true.
- Previous focused tests: 8/8. Preliminary frozen-sample evidence recovery: 18/46; formal/review/publication impact not yet verified.
- Full-test failures are stale production hash/dependency-closure assertions plus missing ajv in the disposable snapshot. These must be resolved and all checks rerun before PR delivery.
- Local CRM checkout remains read-only with its three pre-existing draft paths. Test snapshot: /tmp/crm-official-gameplay-20260915. Frozen metadata: /tmp/crm-gameplay-audit-20260915/audit.json.

## Recovery verification progress
- Added RED cases proving two real defects: malformed trailer entries aborted extraction, and explicit cached admission evidence masked newly recovered gameplay.
- Fixes ignore malformed trailer entries, bind modern media to the official trailer ID, and merge only gameplay into a matching explicit admission snapshot without mutating its input.
- Updated approved production hashes and the V7.3 dependency manifest for the two new modules; all original rule hashes and shadow isolation assertions remain enforced.
- Test dependencies installed after a transient npm registry reset. Next: 46-row audit fixtures and full validation.
