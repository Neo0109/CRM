# Radar media expansion — approved delivery checkpoint

## Current Goal
Implement the user-approved China + global Radar expansion to 30–40 curated external items (hard cap 40), via one GitHub API-only PR.

## Completed
- User explicitly approved implementation, tests, cloud source verification and normal PR delivery.
- Remote main dc52d62af9bb524bf0ac013a906cf93089a17164; no open PR at baseline.
- Production health ok (v2.8.1-steam-direct-link-button); latest daily sync success.
- Diagnosis: hard-coded 14-item report truncation, selector overshoot/fallback cap bypass, cross-day repeats, undated navigation links.
- Existing Lead admission, Steam Trends, UI/API/schema and main daily workflow triggers are outside this change.

## Remaining
- Add fixed-fixture failing tests and isolated Radar-only sources (AUTOMATON WEST, GamesRadar+, Chuapp homepage).
- Implement 40/24-region/3-source/12-topic/3-total-Bilibili caps, 16+16 regional targets, 24h preference/72h max age, 7-day history suppression (exclude same day), article metadata and event video dedupe.
- Bound added network work to 90 seconds; preserve original source inputs/Lead and Steam outputs.
- Run focused tests, schemas, verify:all and diff checks; verify new sources in GitHub Actions before activation.
- Create/review PR, merge after exact-head checks, verify deployment and daily Radar/sync receipt; record final evidence.

## Next Action
Run the committed fixed Radar regressions in cloud CI to capture the red baseline, then implement the isolated Radar path. Existing Build omits full Daily tests, so add a dedicated read-only Radar verification workflow; daily workflows remain unchanged.

## Git Status
- Branch: codex/radar-media-expansion, based on dc52d62af9bb524bf0ac013a906cf93089a17164.
- Local checkout remains read-only with pre-existing user changes in sourcing draft/checkpoint files.
- All repository mutations go through GitHub API; no local real report generation or direct CRM sync.
