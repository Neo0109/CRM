# Daily Report V6.2 Source Pool Quality Patch

## Motivation

The V6.2 automation could sync successfully while still producing too few useful non-dropped sourcing candidates. The weak point was source conversion quality: Bilibili search-page fallbacks could surface space/course pages, generic commentary videos could become product leads, and the source pool did not sufficiently bias toward official/developer/store-page signals.

## Changes

- Added official/developer/store-page-oriented Bilibili source queries for domestic discovery.
- Changed Bilibili search-page parsing to accept only video links, avoiding space pages and course pages as CRM leads.
- Added stricter media-product markers so expanded candidates require concrete evidence such as a quoted game name, Steam/TapTap/official/community link, official/developer source, or studio signal.
- Filtered commentary/reaction-style titles unless they contain concrete product identity.
- Added media filtering diagnostics for raw signals, stale filters, banned filters, low-score filters, non-product filters, and expanded product candidates.

## Boundaries

This patch only changes sourcing automation and diagnostics. It does not modify login, UI structure, manual review workflow, data schema, GitHub Actions schedules, or the product-visible CRM version.
