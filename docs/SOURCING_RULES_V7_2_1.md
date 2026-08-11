# Sourcing Rules V7.2.1: Broad-Media Game-Product Domain

Date: 2026-08-11

Active rule version: `sourcing-rules-v7.2.1-media-product-domain`

Machine source: `automations/rules/daily-report.json`

Runtime entrypoint: `automations/jobs/online_daily_runner.mjs -> automations/jobs/online_daily_v4.mjs`

V7.2 lane baseline: `docs/SOURCING_RULES_V7_2.md`

## Purpose

V7.2.1 adds a candidate-domain boundary for broad media without reducing Radar coverage and without changing either formal V7.2 admission lane. Broad company, capital, legal, society, technology, vehicle, and other non-game reporting may still be useful industry context, but it must not become a game-product candidate merely because its wording contains China, Bilibili, official, authorization, publishing, cooperation, need, or launch terms.

The gate is enabled only for sources carrying:

```json
{ "candidate_domain_gate": "game_product" }
```

The active broad sources are IT之家, 证券时报, and 澎湃新闻. Game-vertical sources keep their existing discovery and quality rules.

## Candidate-Domain Evidence

A marked broad-media item may enter candidate routing only through one of two evidence paths.

### A. Structured game identity

At least one normalized game-product identity exists:

- Steam or SteamDB app link;
- TapTap game/app link;
- indienova game link;
- 好游快爆 game link;
- structured Steam, TapTap, or game ID.

A bare platform word is not a normalized identity.

### B. Concrete semantic product evidence

All three elements are required in the same item:

1. an extractable concrete project name;
2. an explicit game-product category such as independent game, domestic game, online game, mobile game, PC game, or console game;
3. a concrete product event: Demo, 试玩, 实机, Playtest, 测试, 商店页, 愿望单, 版号, 首曝, or 开发日志.

`B站`, `官方`, `授权`, `发行`, `合作`, `需求`, and `上线` are insufficient evidence, alone or in combination.

## Failure Route

When a marked broad-media item lacks both evidence paths, the classifier returns:

```json
{
  "kind": "radar_only",
  "reason": "non_game_broad_media"
}
```

The item remains eligible for Radar diversity selection. It must not:

- enter strict, China-joint, expanded, or rescue candidate routing;
- be converted into a media Lead entity;
- call media/Steam enrichment;
- appear in the sourcing-candidate audit as a candidate;
- become a V7.3 second-pass target;
- enter either formal Lead lane.

Radar schemas remain unchanged. The reason code is a classifier/routing diagnostic; the Radar card renders it as explicit non-game background in its summary, relevance, and suggested action instead of adding a new artifact field.

## Routing And Dedupe Boundary

The gate runs before `mediaSignalToLead` and before enrichment. Candidate lane assignment is disjoint and ordered:

1. strict, including a qualifying China-joint discovery signal;
2. expanded when not already strict;
3. rescue when not already strict or expanded.

One deduped media item is converted and enriched at most once even if its text satisfies more than one lane predicate.

## Formal Admission Is Unchanged

V7.2.1 does not alter the eleven `indie_prelaunch` gates, the four `china_joint` gates, their locked data paths, qualification semantics, publication route, priority ownership, parity invariant, or zero-formal-Lead health policy. The new version identifies the changed upstream candidate universe and behavior contract.

Historical candidate artifacts and replay-corpus fixtures retain the rule version that produced them. The Heartbeat accepts those historical V7 versions while recognizing V7.2.1 as the active production version.

## Acceptance Contract

Fixed offline tests must prove:

- the exact Chevrolet false positive remains Radar-only with `non_game_broad_media`;
- generic financial/company reporting containing ambiguous business terms remains Radar-only;
- concrete broad-media 版号, Demo, Playtest, 实机, and 商店页 examples remain candidate-eligible, including a domestic game without a Steam AppID;
- normalized Steam and other supported structured identities remain eligible;
- a failed broad item creates no candidate, enrichment call, candidate-audit record, second-pass selection, or formal Lead;
- strict/expanded/rescue processing is disjoint;
- non-game animation filtering, Steam evidence integrity, candidate audit, and Radar diversity regressions remain green;
- tests use fixed fixtures and spies only, with no live provider or network access.

## Automation Boundaries

- Daily workflows remain limited to `schedule` and `workflow_dispatch`.
- No provider, CRM, Supabase, or production write is part of rule validation.
- No formal Lead count minimum, maximum, quota, backfill, or degraded threshold is introduced.
- Missing/invalid artifacts, source failure, qualified/push mismatch, write failure, and unsuccessful synchronization remain blocking.
