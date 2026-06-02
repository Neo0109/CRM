# Daily Report V6 Steam Gate Fix

Date: 2026-06-02

## Root Cause

The cloud workflow proved that Steam fetch was no longer fully down: the failed run scanned 256 Steam candidates and enriched 90 AppDetails records. The remaining failure was the V6 review-volume gate: only 15 leads entered `push_pool + watch_pool`, below the required 18.

The low review count came from two issues:

- Steam reliability had two layers: local Node fetch could fail DNS/TLS against Steam, and previous high concurrency could trigger Steam 403/429 rate limits.
- After Steam fetch was stabilized, the classifier still punished domestic candidates too hard for Early Access and short release windows, so valid first-pass review items could be dropped before a human saw them.

## Changes

- Keep the Steam curl fallback and low-concurrency AppDetails enrichment.
- Add a low-confidence domestic review backfill path when sources are healthy but the review queue is slightly below the floor.
- Backfilled leads enter only `未处理`; they do not become `观察池`, `待评测`, `跟进中`, or `推进池`.
- Reduce Early Access and short-window penalties for domestic candidates so they can be inspected or tested first.
- Align the primary daily workflow and watchdog workflow arguments.
- Accept either `CRM_AUTOMATION_TOKEN` or `CRM_ACCESS_TOKEN` in GitHub Actions.
- Configure git identity in receipt steps so failed generation does not produce a misleading secondary git error.

## Guardrail

Backfill is for domestic concrete candidates only. It must not pad the report with generic news, tutorials, old Bilibili videos, ranking filler, or overseas products without PC validation/mobile-adaptation angles.
