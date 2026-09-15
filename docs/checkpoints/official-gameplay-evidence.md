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
1. Freeze official metadata samples and 46-candidate audit; add RED contracts.
2. Implement metadata extraction and shared-budget refresh; focused GREEN.
3. Full verification, exact-head review, PR, normal squash merge/deploy.
4. Record evidence recovery, strict/review counts, actual CRM additions when a new normal run exists; zero strict additions leaves business goal unmet.

## Next Action
Verify official category mapping and runtime budget/state boundaries; add focused failing tests.

## Git Status
Remote branch codex/official-gameplay-evidence from 742f496fad982e9da5a76bb0f43adbbc733033d1. Local checkout read-only; the existing three draft paths are unchanged.
