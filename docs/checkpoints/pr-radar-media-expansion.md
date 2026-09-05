# Radar media expansion — PR 124 delivery checkpoint

## Current Goal
Deliver the approved China/global Radar expansion (30–40 curated external items, hard cap 40) through the single PR https://github.com/Neo0109/CRM/pull/124.

## Completed
- User explicitly approved implementation and normal PR/cloud delivery in this thread on 2026-09-06.
- Baseline main: dc52d62af9bb524bf0ac013a906cf93089a17164, no open PR before this work; production health ok.
- Radar-only collection adds AUTOMATON WEST, GamesRadar+ game articles and Chuapp website articles; all three were verified from GitHub Actions before activation.
- Strict limits: 40 external, 3/source, 24/region, 12/topic, 3 total Bilibili; regional soft targets 16+16, no backfill outside caps.
- Publication evidence: prefer 24h, maximum 72h, reject unknown/future dates; JSON-LD/meta/time and Chuapp publisher timestamp adapters; preserve RSS CDATA summaries.
- Prior seven Shanghai calendar dates suppress URL/title and same-product/same-event video repeats; same-day reruns excluded from history.
- New network requests use at most four workers, eight-second request timeouts, 60 metadata lookups, and a 90-second total budget.
- Shared source arrays, every original non-Radar machine rule, Lead admission/decision/audit, Steam Trends, public API/schema/UI and existing daily workflow triggers are unchanged. A semantic SHA-256 test protects all original sourcing rule fields; C5-B collector code and 41-path behavior manifest remain unchanged.
- TDD red proof: https://github.com/Neo0109/CRM/actions/runs/33977686914 (14 vs 40, selector 4 vs 2, Bilibili 30 vs 3).
- Code head 6dd3e9dd274c1c729a9612f2b08e89a41914ca5c passed all checks: https://github.com/Neo0109/CRM/actions/runs/33979032351 (push) and PR verification.
- Focused Radar 14/14; full Daily 372/372; frontend 136/136, backend 30/30, Functions 44/44; full npm run verify:all completed all 16 tasks including typechecks, replay, schema, temporary build and diff checks.
- Cloud source smoke: AUTOMATON 30 entries, GamesRadar 41 game articles, Chuapp 25 articles, all with publication dates and extractable publisher summaries. Check run Cloudflare Pages success on code head.
- Only the new verification step sets COREPACK_ENABLE_PROJECT_SPEC=0 to run the repository's existing pnpm-based typechecks under the explicitly pinned pnpm runtime; application/package files untouched.
- Reviewed all 15 changed files: only approved Radar code/config, focused tests, existing fingerprint assertions, independent verification workflow and documentation; no unresolved review comments.

## Remaining
- Confirm checks on this documentation-only checkpoint head, mark PR Ready and squash merge.
- Verify main merge SHA, main Build/Cloudflare deployment and production health.
- Run/inspect a normal cloud daily generation for feature acceptance after confirming no same-date active run; require dated Radar artifact and status=success plus sync_response.synced=true.
- Record actual selected count, media distribution, duplicate suppression and budget evidence; do not treat fewer than 30 qualified news items as delivery failure.

## Next Action
Recheck exact PR head checks and mergeability, then continue normal release and post-merge daily data acceptance without entering another PR.

## Git Status
- GitHub API branch: codex/radar-media-expansion; PR 124 is currently draft and unmerged.
- Local checkout remains read-only with the same pre-existing sourcing draft/checkpoint modifications.
- No local real report generation, local Git branch/commit/push, direct CRM sync, GUI access or desktop capture occurred.
