# Sourcing Rules V7.3: Obtainable Evidence and Targeted Second Pass

Date: 2026-07-30

Rule version: `sourcing-rules-v7.3-obtainable-evidence`

Machine rule source: `automations/rules/daily-report.json`

Runtime entrypoint: `automations/jobs/online_daily_runner.mjs -> automations/jobs/online_daily_v4.mjs`

V7.3 is the active contract on the PR C branch. It is not production behavior until the PR is fully verified, merged, and deployed from `main`.

## Purpose

V7.3 keeps the quality boundary established by V7.0/V7.2 while replacing evidence conjunctions that an unreleased project cannot reasonably satisfy with explicit, obtainable public-evidence gates.

The rule has two independent formal lanes:

- `indie_prelaunch`: the V7.3 obtainable-evidence model.
- `china_joint`: the retained V7.2 2A/3A commercial qualification model.

Every deduped project that completely passes either lane enters `push_pool` with `priority=null`. Ranking changes reading order only. There is no lane quota, formal minimum, formal maximum, total cap, backfill, or weaker fallback lane.

## V7.3 Indie Prelaunch Gates

All nine gates are required:

1. `identity_and_dedupe`
2. `prelaunch_window`
3. `publisher_china_capacity_clear`
4. `non_narrative_product`
5. `non_india_team`
6. `official_playable_or_gameplay`
7. `independent_quality_proof`
8. `non_steam_business_entry`
9. `concrete_china_bilibili_value`

The first five gates preserve the hard identity, release-window and Early Access, publisher-capacity, narrative-first, and India-led exclusions. A confirmed hard failure cannot be repaired by a second pass.

### Official playable or gameplay

This gate is an `any_of` family. At least one of the following must be supported by official public evidence:

- official Demo or Playtest;
- official gameplay.

The two evidence types are alternatives, not cumulative requirements. Passing this family does not compensate for any other gate.

### Independent quality

Quality proof requires at least two independent public sources. Duplicate citations or multiple records from the same source do not satisfy the minimum.

### China demand and value

Explicit official China-cooperation demand is a positive signal, not a mandatory `indie_prelaunch` wording gate.

A concrete China/Bilibili value thesis remains mandatory. Generic statements about localization, marketing, mobile potential, or “fit for China” do not satisfy it.

The retained `china_joint` lane still requires a verified current China opportunity under its own commercial gates.

## Targeted Public-Evidence Second Pass

The second pass may run only when the first V7.3 decision is not formal, is not hard-excluded, and exposes one to three named obtainable evidence actions.

At most 12 candidates may be selected in one Daily run. The only allowed public actions are:

- `fetch_official_playable_or_gameplay`
- `fetch_independent_quality_evidence`
- `fetch_non_steam_business_entry`
- `research_china_bilibili_value`

The provider may return only evidence fields associated with the requested actions. The normalized evidence is merged into the candidate, then the same `evaluateV73IndiePrelaunchAdmission` decision function runs again.

The second pass must never:

- bypass a hard exclusion;
- lower or replace a gate;
- cache or manufacture a formal decision;
- create a Lead because the Daily count is zero;
- backfill `push_pool`, `watch_pool`, or `drop_pool`;
- invoke paid AI editing or any PR D provider.

## Retained China Joint Lane

The `china_joint` lane preserves the V7.2 contract:

- identity and dedupe;
- one locked traction or proven-team event path;
- a verified current China publishing, license, localization, marketing, mobile, or joint-operation opportunity;
- confirmed absence of mature China-partner occupancy.

A complete V7.3 indie pass keeps `indie_prelaunch`. Otherwise a complete joint pass publishes as `china_joint`. Both formal results are stamped with `sourcing-rules-v7.3-obtainable-evidence`.

## Candidate Audit and Publication

V7.3 candidate artifacts use sourcing-candidate schema version 3 and preserve the PR B candidate-state and fair-enrichment metrics.

Near-miss records expose:

- `failed_gate_details`;
- `next_evidence_actions`.

Hard exclusions expose no second-pass action. Failed or unknown candidates remain only in `data/sourcing_candidates/YYYY-MM-DD.json`, which is not a CRM import payload.

Only complete formal decisions enter `push_pool`. New automatic Leads remain in `未处理` with `priority=null`; automation does not place them into human-owned review or follow-up buckets.

## Health and Delivery Boundary

Formal Lead count is not transport health. Zero Leads neither fails the run nor marks it `degraded`.

Missing or invalid artifacts, source failure, qualified/push mismatch, write failure, and a receipt without both `status=success` and `sync_response.synced=true` remain blocking.

V7.3 does not change:

- PR B candidate lifecycle state, seven-day compatible snapshot reuse, retry cooldown, or 4:3:2 enrichment scheduling;
- CRM sync or recovery semantics;
- workflow triggers;
- UI, API, Supabase, existing Leads, or production data;
- Radar, Steam Trends, or the separate Steam review workflow.

No live generator or workflow dispatch is required to verify this rule. Deterministic fixtures, the fixed July 15-29 replay, historical weak-sample rejection, focused contracts, and later full CI are the acceptance path.
