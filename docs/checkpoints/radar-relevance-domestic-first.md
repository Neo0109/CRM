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

## Remaining
- Add failing fixtures for actual relevance problems, multilingual/reprint events, distinct progress, publisher identity, cap fallback, history and independent collector copies.
- Implement the bounded Radar behavior, rules and replay diagnostics.
- Run cloud focused tests, full Daily tests, schema/type/verify:all/diff checks; review exact PR and merge.
- Verify normal deployment and one cloud acceptance run with actual content and synced=true receipt.

## Next Action
Create regression fixtures and a draft PR, then implement the approved Radar slice. Update this checkpoint after each verification stage.

## Git Status
- Base 2ed65ed3aa8e3bd7e2c3d5f961fc05b0916d0a44; branch codex/radar-relevance-domestic-first, GitHub API only.
- Local checkout read-only; existing user draft/checkpoint changes must remain untouched.
