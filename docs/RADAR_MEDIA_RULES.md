# Industry Radar media rules

Machine source: `automations/rules/daily-report.json` (`radar_diversity` and `radar_sources`). Entry: `automations/jobs/online_daily_v4_radar.mjs`, called by the normal Daily V4 generator. Lead rules retain their existing V7.2.2 version and media_sources inputs.

- Target 30–40 external items; hard maximum 40, single source 3, topic 12, region 24, all Bilibili entrypoints together 3. China/global each have a soft target of 16. A short day remains valid and no diversity caps are relaxed to fill slots.
- Prefer publication within 24 hours of captured_at; never include over 72 hours, future or unknown publication. Undated article copies may fetch publisher JSON-LD/meta/time evidence. Collection time is never substituted for publication time.
- Suppress normalized URL or title matches from the preceding seven calendar dates in Asia/Shanghai. Same-day artifacts never enter suppression history. Video dedupe uses quoted product, event kind, venue/year or publication day and explicit chapter/version, rather than Steam AppID alone.
- Only concrete article/video links qualify. Navigation/column pages and generic sale/guide filler cannot fill the edition. Existing public fields and categories remain unchanged; publisher summary is preferred. The optional internal Steam direction card is counted separately.
- AUTOMATON WEST, GamesRadar+ and Chuapp website are configured only in radar_sources. Cloud read-only source checks must pass before enabling them. Shared media arrays and sourcing diagnostics are never modified by Radar collection.
- Added requests use at most four workers, eight seconds per request, at most 60 undated-article lookups and a hard 90-second budget. Source errors and unknown dates reduce coverage, not delivery health. No credentials, paid provider or CRM request is used.
- Diagnostics include source results, metadata requests, stale/unknown/future/duplicate exclusions, region/source selection and elapsed budget. They are emitted to the workflow log and data/runtime/YYYY-MM-DD-radar-diagnostics.json.

Verification: fixed fixtures in onlineDailyV4Radar.test.mjs, the full Daily test suite and npm run verify:all. The separate Radar verification workflow runs fixtures and repository checks; its source-smoke job only reads public media. The normal daily workflow remains schedule/workflow_dispatch only.
