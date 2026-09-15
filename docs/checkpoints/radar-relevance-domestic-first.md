# Radar relevance and domestic-report preference

## Current Goal
Implement the user-approved 2026-09-15 Radar-only plan: game relevance first; one representative per confirmed news event, preferring qualified domestic coverage within the existing media pool.

## Completed
- Read-only diagnosis and user decisions completed in this thread, followed by explicit implementation authorization.
- Refreshed main 2ed65ed3aa8e3bd7e2c3d5f961fc05b0916d0a44; no open PR. Since diagnosis at da0f4a0 only 2026-09-15 generated artifacts changed, not product code.
- Scope: independent Radar candidate snapshot/scoring, evidence-based article event matching, domestic representative fallback within caps, seven-day history, metadata prioritization, tests and rule documentation.
- Confirmed preferences: include gameplay, demos, trailers, reviews and ordinary updates; no forced domestic percentage; no new web-search provider or paid AI.
- Existing Lead source collection/admission and Steam results, API/cards/UI and daily workflow triggers remain outside scope.
- Prior coverage baseline 2026-09-14: 35 external (11 domestic publisher/24 foreign publisher), with unrelated content and repeated news.
- Skills/routing: crm-production-guardian; remote GitHub/API edits only. No GUI or local real generation.

- TDD red cloud proof: https://github.com/Neo0109/CRM/actions/runs/34924129519; all existing 16 tests pass, all eight new behavior fixtures fail before implementation.
- PR 127 created as Draft. Independent snapshot, pure editorial module, conservative event groups, domestic representative fallback and metadata priority implemented on the branch.
- Original admission SHA-256 projection and collector 41-path behavior manifest remain unchanged; only approved generator/radar-rule fingerprints refreshed. New pure editorial module is a Radar-only dependency exclusion.

- Implementation head 233831fea7dacdecfc1cfa3ced782a083f90f77b passed Radar 24/24, full Daily 389/389 and all verify:all tasks in run 34924817486.
- Manual archived replay review found false negatives for valid named-game previews/ports/studio news lacking the word game. Added 16 actual archived positive fixtures and stronger genre/platform/article-section evidence, without publisher-wide exemptions.
- Added distinct-game, distinct-mod and coarse-year event safeguards; incomplete/uncertain attribution stays conservative. Historical-card replay strips old presentation boilerplate before curation.

- Recovery exact-head review: c085338 passed Radar 26/26, full Daily 391/391, types/contracts/verify:all/diff; reviewed all four replay editions.
- Confirmed three additional regressions in cloud run 34925991771: Roblox platform awards excluded; different unregistered games sharing a publisher/date merged; independent review citation treated as duplicate. Existing 26 fixtures remained green. Added narrow fixes preserving uncertain events.

## Remaining
- Inspect latest cloud archived replay and exact-head diff for content correctness.
- Record final verification and review, then merge this approved PR and verify deployment.
- Verify actual cloud Radar output and a successful synced=true receipt.

## Next Action
Resume from c085338d24a859de22f201807d4ea34ca96c371a; read cloud run 34925244483 replay logs and review the event matching boundary. The prior context failed during compaction; its corrective implementation is already committed.

## Git Status
- Base 2ed65ed3aa8e3bd7e2c3d5f961fc05b0916d0a44; branch codex/radar-relevance-domestic-first, GitHub API only.
- Local checkout read-only; existing user draft/checkpoint changes must remain untouched.
