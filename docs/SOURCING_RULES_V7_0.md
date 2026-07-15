# Sourcing Rules V7.0: Quality-Gated Indie Admission

Date: 2026-07-15

Active rule version: `sourcing-rules-v7.0-quality-gated-indie`

Machine source: `automations/rules/daily-report.json`

Runtime entrypoint: `automations/jobs/online_daily_runner.mjs -> automations/jobs/online_daily_v4.mjs`

## Purpose

V7.0 separates broad discovery from formal recommendation. Discovery scores, source labels, tags, screenshots, movie counts, and field completeness may order enrichment work, but none of them can compensate for a missing admission gate.

Every newly discovered, deduped `indie_prelaunch` project that passes every mandatory gate is published to `push_pool`. Every project that fails a gate or still has unknown evidence remains outside all formal Lead pools and is retained only in `data/sourcing_candidates/YYYY-MM-DD.json`.

## Mandatory Admission Gates

All eleven gates are non-compensating:

1. `identity_and_dedupe`: a normalized project identity and stable Steam AppID or project dedupe key are present.
2. `prelaunch_window`: the full game is unreleased, is not in Early Access, and has either a TBA window or a release window more than 60 days away.
3. `publisher_china_capacity_clear`: no mature publisher or established China-capability partner already occupies the opportunity.
4. `non_narrative_product`: the project is not narrative-led or visual-novel-led.
5. `non_india_team`: the project is not led by an India-based team.
6. `official_demo_or_playtest`: an official Demo or Playtest is verifiable.
7. `official_gameplay`: official gameplay, 实机, 玩法, or 试玩 evidence is verifiable; screenshots and generic announcement or cinematic trailers are insufficient.
8. `independent_quality_proof`: at least one independent public quality proof is verified. Current source projection accepts verified Steam recommendations of at least 500 or Metacritic of at least 75.
9. `non_steam_business_entry`: at least one public business entrypoint exists outside Steam Store or SteamDB, such as an official email, website, community, or social contact.
10. `concrete_china_bilibili_value`: the evidence states a concrete gameplay-linked China/Bilibili content, community, localization, marketing, or publishing value.
11. `overseas_china_demand`: an overseas project has explicit official China publishing, localization, marketing, operations, or partnership demand. Domestic projects mark this gate not applicable.

Unknown evidence does not pass. A hard contradiction in release state, publisher/China occupancy, narrative position, or team region is `excluded`; incomplete positive evidence is `candidate`.

## Publication Contract

- Qualified route: `push_pool`.
- Unqualified route: sourcing-candidate audit only.
- `watch_pool` and `drop_pool` are empty for new V7.0 decisions.
- Automatic `priority` is always `null`; priority remains human-owned.
- Every formal Lead carries `sourcing_lane=indie_prelaunch`, the active rule version, and run provenance.
- No formal minimum, maximum, cap, quota, backfill, truncation, or P3-to-P2 promotion exists.
- Cross-source duplicates resolve to one formal Lead.

The blocking invariant is:

```text
new_qualified_count === push_pool_count
```

The same admission result supplies both the Daily pool and candidate-audit decision, so formal audit records and published Leads must have exact dedupe-key equality.

## Health Contract

Zero formal Leads is healthy when discovery and delivery are otherwise valid. Formal Lead count never creates a warning, degraded state, retry, or recovery dispatch.

The following remain blocking:

- source discovery produces no usable Steam or domestic media/Bilibili input;
- a required Daily, Radar, Steam Trends, or sourcing-candidate artifact is missing or invalid;
- candidate-audit counts or dedupe integrity are wrong;
- `new_qualified_count` differs from `push_pool_count`;
- artifact write, CRM authentication, import, or synchronization fails;
- no receipt satisfies both `status=success` and `sync_response.synced=true`.

Radar and Steam Trends retain their independent minimum content contracts because they are market artifacts, not formal Lead quotas.

## Automation Boundaries

- The primary Daily workflow remains triggerable only by `schedule` and `workflow_dispatch`.
- The candidate audit is never imported into CRM.
- No production report is generated or synchronized from a developer checkout.
- No Lead/API, frontend, Supabase schema, migration, or production-data behavior changes in V7.0.
- The standalone PR 5 simplified-Chinese review audit source is documented in `docs/STEAM_REVIEW_OPPORTUNITY_SOURCE.md`, but it is not consumed by V7.0. EA/high-traction and China-heat publication/import, `china_joint`, the learning loop, and visual-AI work remain outside V7.0.

## Regression Contract

- Fixtures with 0, 2, and 7 qualified projects must publish exactly 0, 2, and 7 formal Leads.
- The seven recorded weak Steam samples without independent strong data must remain outside formal Lead pools.
- Ranking changes may reorder qualified output but may never remove a qualified project or admit an unqualified project.
