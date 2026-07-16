# Sourcing Rules V7.2: Indie And China Joint Admission

Date: 2026-07-16

Active rule version: `sourcing-rules-v7.2-china-joint`

Machine source: `automations/rules/daily-report.json`

Runtime entrypoint: `automations/jobs/online_daily_runner.mjs -> automations/jobs/online_daily_v4.mjs`

## Purpose

V7.2 runs `indie_prelaunch` and `china_joint` against the same regular Steam and media discovery evidence. The two lanes have separate non-compensating qualification gates, share one dedupe/publication boundary, and apply no lane quota, formal minimum, formal maximum, total cap, backfill, or ranking cutoff.

Every newly discovered and deduped project that completely passes either lane enters `push_pool` with `priority=null`. Ranking changes reading order only. A project that fails or still lacks evidence for both lanes remains outside every formal Lead pool and is retained in `data/sourcing_candidates/YYYY-MM-DD.json`.

## Indie Prelaunch Lane

The eleven V7.0 `indie_prelaunch` gates remain unchanged:

1. `identity_and_dedupe`
2. `prelaunch_window`
3. `publisher_china_capacity_clear`
4. `non_narrative_product`
5. `non_india_team`
6. `official_demo_or_playtest`
7. `official_gameplay`
8. `independent_quality_proof`
9. `non_steam_business_entry`
10. `concrete_china_bilibili_value`
11. `overseas_china_demand`

Their evidence meanings remain recorded in `docs/SOURCING_RULES_V7_0.md`. A project already qualified for `indie_prelaunch` keeps that lane when it also passes `china_joint`; this preserves existing prelaunch classification while deduping the project to one formal Lead. Every formal regular Lead carries the active V7.2 rule version.

## China Joint Lane

All four `china_joint` gates are required:

1. `identity_and_dedupe`: a normalized project identity and stable Steam AppID or project dedupe key exist.
2. `traction_or_proven_team_event`: at least one locked data path below passes.
3. `current_china_opportunity`: current evidence confirms a China publishing, license/版号, localization, marketing, mobile, or joint-operation need.
4. `mature_china_partner_clear`: evidence confirms that no mature China partner already occupies the opportunity.

The data gate passes through exactly one or more of these paths:

- Steam recommendations `>= 5000`; rating does not affect this path.
- Steam recommendations `>= 1500` and the public Steam rating is `Very Positive` or `Overwhelmingly Positive`.
- The team has at least one verified major-title record and the current project has a current official product event.

Boundary behavior is strict: `4999` does not pass the first path; `1499` does not pass the second path; ordinary `Positive` does not replace `Very Positive`; a major-title record without a current official event, or an event without a verified record, does not pass the third path.

## Evidence Contract

- Recommendation count comes from normalized Steam AppDetails recommendations.
- Rating is normalized from the public Steam store/search review label; only `very_positive` and `overwhelmingly_positive` satisfy the 1,500 path.
- A major-title record must carry a concrete title/value, verification URL, and `verified=true`.
- A current official product event must carry a concrete value, source URL, `official=true`, and `current=true`.
- Current China-opportunity evidence must use one of `china_publishing`, `china_license`, `china_localization`, `china_marketing`, `china_mobile`, or `china_joint_operations`, and must be marked `current=true`.
- Steam descriptions or media text can create China-opportunity evidence only when they name China/Chinese scope, a permitted business need, and current intent such as seeking, needing, or partnering.
- A fetched Steam publisher list can establish a clear China-partner state only when no known mature China operator/publisher is present. Missing AppDetails or unresolved occupancy remains `unknown` and cannot pass.
- Released, near-window, Early Access, narrative-led, or India-led status does not independently reject `china_joint`; those are lane-specific `indie_prelaunch` gates. The joint lane still cannot bypass its data, China-need, or partner-clear gates.

## Publication And Audit Contract

- Qualified route: `push_pool`.
- Unqualified route: sourcing-candidate audit only.
- `watch_pool` and `drop_pool` remain empty for new automated decisions.
- Automatic priority remains `null` and human-owned.
- Cross-source and cross-lane duplicates resolve to one formal Lead.
- The same selected admission result supplies the published Lead and candidate-audit decision.
- The blocking invariant remains `new_qualified_count === push_pool_count`.

The fixed same-day acceptance fixture contains five qualified `indie_prelaunch` projects and four qualified `china_joint` projects. It must publish exactly nine formal Leads. Fixed no-China-demand and mature-China-partner-occupied projects must publish zero formal Leads and retain their exclusion reasons in the candidate audit.

## Health And Automation Boundaries

Zero formal Leads is healthy when discovery, artifacts, and synchronization are valid. Formal Lead count never creates degraded status or a retry. Missing or invalid Daily/Radar/Steam Trends/candidate artifacts, source failure, qualified/push mismatch, write failure, or a receipt without both `status=success` and `sync_response.synced=true` remains blocking.

- The primary Daily workflow trigger boundary remains `schedule` and `workflow_dispatch` only.
- Discovery budgets may bound network work, but no post-qualification lane or total formal-output quota may discard a passing project.
- The candidate audit is never imported into CRM.
- No Lead/API, UI, Supabase schema, migration, credential, or production-data contract changes in V7.2.
- The PR 6 Steam review-opportunity workflow, rules, artifacts, and independent delivery path are not read, modified, dispatched, or reused by V7.2.
- PR 8 precision/feedback work remains out of scope.
