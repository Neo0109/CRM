# Daily Report V6.4 - Bilibili Sourcing Probe

Date: 2026-06-29

## Motivation

Sourcing quality depends on finding timely, official, decision-grade product signals. Recommendation UP videos can reveal games, but they often lack official links, may be stale, and can duplicate existing Steam-sourced leads. V6.4 adds a Bilibili probe layer so the daily report can explain where Bilibili candidates came from and why some were filtered.

## Changes

- Added `automations/rules/bilibili-probe.json` for Bilibili source configuration:
  - official UIDs
  - developer UIDs
  - publisher UIDs
  - media UIDs
  - trusted creator UIDs
  - keywords
  - required keywords
  - UID/BVID blacklists
  - maximum video age
- Added `automations/jobs/bilibili_probe.mjs` to collect candidates from UP lists and keyword search, enrich public video detail metadata, extract links, apply filters, and emit media-style signals.
- Updated `online_daily_v4.mjs` to merge Bilibili probe signals into the existing media/Bilibili candidate pool.
- Updated the rule guard to require `sourcing-rules-v6.4-bili-probe`.
- Added Bilibili probe diagnostics for raw candidates, detail successes/failures, official-source hits, link extraction, stale filters, blacklist filters, duplicate filters, source failures, and final candidates.

## Guardrails

- The implementation does not import or depend on external crawler code.
- The implementation does not add SQLite, Streamlit, email notification, or login-cookie crawling.
- Product version, login, UI structure, lead schema, manual review flow, and GitHub Actions schedule are unchanged.
- Bilibili source failures are diagnostics, not hard failures, unless they combine with schema/write/sync authentication failures elsewhere in the workflow.
- Old leads are not batch-cleaned. The rule only improves new candidate generation.

## Verification

- `scripts/test-bilibili-probe.mjs` covers official-source priority, Steam link extraction, old-video filtering, blacklist filtering, generic-collection filtering, duplicate filtering, and single-source failure resilience.
- Existing sourcing field-hygiene checks now assert the active generator publishes `sourcing-rules-v6.4-bili-probe`.
