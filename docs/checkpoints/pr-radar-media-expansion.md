# Radar media expansion — approved delivery checkpoint

## Current Goal
Implement the user-approved China + global Radar expansion to 30–40 curated external items (hard cap 40), via one GitHub API-only PR.

## Completed
- User explicitly approved implementation, tests, cloud source verification and normal PR delivery.
- Remote main dc52d62af9bb524bf0ac013a906cf93089a17164; no open PR at baseline.
- Production health ok (v2.8.1-steam-direct-link-button); latest daily sync success.
- Diagnosis: hard-coded 14-item report truncation, selector overshoot/fallback cap bypass, cross-day repeats, undated navigation links.
- Red TDD evidence: run https://github.com/Neo0109/CRM/actions/runs/33977686914 at 93a7aa8 fails fixed tests with 14 vs 40, selector 4 vs 2, Bilibili 30 vs 3.
- Isolated Radar implementation prepared; remote Chuapp HTML identifies publication via friendly_time[data-time], covered by fixture.
- Existing Lead admission, Steam Trends, UI/API/schema and main daily workflow triggers are outside this change.

## Remaining
- Add fixed-fixture failing tests and isolated Radar-only sources (AUTOMATON WEST, GamesRadar+, Chuapp homepage).
- Implement 40/24-region/3-source/12-topic/3-total-Bilibili caps, 16+16 regional targets, 24h preference/72h max age, 7-day history suppression (exclude same day), article metadata and event video dedupe.
- Bound added network work to 90 seconds; preserve original source inputs/Lead and Steam outputs.
- Run focused tests, schemas, verify:all and diff checks; verify new sources in GitHub Actions before activation.
- Create/review PR, merge after exact-head checks, verify deployment and daily Radar/sync receipt; record final evidence.

- Implementation focused tests: 10/10 passed in Actions run 33978233339. Full suite exposes stale C5-B exact production-file fingerprints and the new Radar-only import path; update only approved Radar fingerprints, preserve all non-Radar rule fields via an additional semantic SHA-256 guard, keep collector code/manifest unchanged.
- Cloud source smoke: AUTOMATON WEST 30 entries and Chuapp 25 entries/date passed. GamesRadar feed parsed successfully; publisher summaries may be omitted by the publisher, so record availability rather than requiring every feed item to have a summary.

- GitHub Actions source smoke 33978569943 passed all three URLs (AUTOMATON 30, GamesRadar 50, Chuapp 25). Sources are now enabled only in Radar configuration.
- Added a fixture/fix for whitespace-wrapped RSS CDATA so GamesRadar publisher summaries survive parsing; exclude its non-game entertainment sections.
- Focused fixtures 13/13 and 370/371 full Daily tests passed before the final verified report-file fingerprint correction. Collector production code and its 41-path manifest are unchanged.

## Next Action
Run all checks and source smoke on the activated exact PR head; review scope and merge only when checks pass. Then verify deployment and a normal cloud-produced daily Radar artifact/sync receipt.

## Git Status
- Branch: codex/radar-media-expansion, based on dc52d62af9bb524bf0ac013a906cf93089a17164.
- Local checkout remains read-only with pre-existing user changes in sourcing draft/checkpoint files.
- All repository mutations go through GitHub API; no local real report generation or direct CRM sync.
