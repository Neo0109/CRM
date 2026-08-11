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
- TapTap game/app link with a positive numeric product ID;
- indienova `g`, `game`, or `games` product link with a concrete non-reserved product identifier, including percent-encoded names;
- 3839/好游快爆 canonical numeric product paths: `a`, `shouyou`, `game(s)`, `app(s)`, or `product(s)`;
- a positive numeric structured Steam/TapTap ID;
- a positive numeric generic game ID; namespaced `steam:`, `taptap:`, `kuaibao:`, and `3839:` IDs also require a positive numeric suffix, while `indienova:` requires the same concrete non-reserved slug grammar as its product URL.

A bare platform word, arbitrary company/news identifier, TapTap nonnumeric path, indienova reserved route such as `/games/news`, 3839/好游快爆 `/news/` route, or arbitrary domain path is not a normalized identity. When a product URL is embedded in prose, trailing ASCII or Chinese closing punctuation is removed before URL parsing; the remaining host, route, and ID must still pass the same strict validation. Punctuation therefore cannot turn an indienova reserved slug such as `news.` into a product identity.

### B. Concrete semantic product evidence

All three elements are required in the same item:

1. an extractable concrete project name;
2. an explicit game-product category such as independent game, domestic game, online game, mobile game, PC game, or console game;
3. a concrete product event: Demo, 试玩, 实机, Playtest, 测试, 商店页, 愿望单, 版号, 首曝, or 开发日志.

One pure named-project extractor validates structured project fields first, then a quoted name, then a conservative explicit unquoted title. It ignores missing and non-string fields and rejects literal missing markers, generic category nouns, event-only phrases, and wholly generic descriptors after NFKC/case/whitespace/punctuation normalization. The generic boundary uses whole-string dynamic-program segmentation against one curated vocabulary covering qualifier/quantifier, organization/team, game/product/project, news/update/message, business/license/publishing, and English-equivalent tokens. A name is generic only when every normalized character can be covered by those tokens, closing compositional forms such as `全新游戏项目`, `一款全新游戏`, `某公司项目`, `公司最新消息`, and `latest game project`; normalized spelling such as `最新 消息` or `行业：资讯` cannot bypass it. Arabic digits or Chinese numerals followed by a classifier such as 款、个、部、项 are handled as one generic count transition, so `10款手游` and `十款独立游戏` cannot pass while a distinctive name such as `纪元10：余烬` remains valid.

Region, promotion, genre, and platform-only modifiers—including 国产、海外、首款、热门、二次元、策略、移动, and PC—are generic when they cover the entire proposed name. Bilibili aliases and organization-only labels are also insufficient: known platform/publisher names and a conservative 公司、集团、工作室、团队、企业、厂商、制作组 suffix shape are rejected unless distinctive project residue remains. A real name such as `中国式家长`, `腾讯极光计划`, `武侠乂`, `新月计划`, `行业动态模拟器`, `Project Echo`, or `New Game Chronicle` is retained because the full name is not generic.

Category recognition and unquoted extraction share one longest-first explicit vocabulary. It includes mobile, PC, console, independent, domestic, network, handheld, web, mini-game, VR/ARPG, and common genre-product forms; longer forms such as 客户端游戏 and 移动端游戏 are consumed before the shorter 端游 token. A bare `游戏` is not an explicit category. Approved region/promotion/genre/platform modifiers and generic count prefixes are consumed as part of the category phrase so they cannot fall back as the project name.

For an unquoted category-to-event slot, leading name introducers and trailing temporal/announcement connectors are stripped only at the slot edges. This binds both `国产手游新作 星海远征公布 Demo` and `星海远征 国产独立游戏正式公布 Demo` to `星海远征`, and likewise supports English `mobile game Project Echo announces Demo` forms without globally rewriting legitimate names. Quoted extraction considers every `《…》` entity, rejects source/organization and wholly generic document/policy/report roles, then chooses the valid project bound nearest to the product event. The same extracted name is reused as the tagged media Lead project; identity-only admission may retain the legacy title fallback when no project name is required.

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

For marked sources, this failed domain decision runs before unresolved-store, film, animation, released-content, approval, and other legacy topic taxonomy. Every failed marked item therefore receives the single exact `non_game_broad_media` reason. A marked item that passes the domain gate remains subject to the unchanged downstream taxonomy.

## Routing And Dedupe Boundary

The gate runs before `mediaSignalToLead` and before enrichment. Candidate lane assignment is disjoint and ordered:

1. strict, including a qualifying China-joint discovery signal;
2. expanded when not already strict;
3. rescue when not already strict or expanded.

One deduped media item is converted and enriched at most once even if its text satisfies more than one lane predicate.

Gate provenance uses conservative precedence during dedupe: if any member of a duplicate component carries `candidate_domain_gate: "game_product"`, the merged signal carries it regardless of input order. Dedupe computes the transitive component across all existing title, link, AppID, and BVID keys, so a title-to-link bridge cannot split one media item into two rows or bypass the gate. Two unmarked signals retain the previous merge behavior. This rule does not add new secondary-evidence union semantics beyond the existing merge contract.

## Formal Admission Is Unchanged

V7.2.1 does not alter the eleven `indie_prelaunch` gates, the four `china_joint` gates, their locked data paths, qualification semantics, publication route, priority ownership, parity invariant, or zero-formal-Lead health policy. The new version identifies the changed upstream candidate universe and behavior contract.

Historical candidate artifacts and replay-corpus fixtures retain the rule version that produced them. The Heartbeat accepts those historical V7 versions while recognizing V7.2.1 as the active production version.

## Acceptance Contract

Fixed offline tests must prove:

- the exact Chevrolet false positive remains Radar-only with `non_game_broad_media`;
- generic financial/company reporting containing ambiguous business terms remains Radar-only;
- concrete broad-media 版号, Demo, Playtest, 实机, and 商店页 examples remain candidate-eligible, including a domestic game without a Steam AppID;
- normalized Steam and other supported structured identities remain eligible;
- missing/generic/event-only names, normalized generic descriptors across structured/quoted/unquoted paths, arbitrary structured IDs, and non-product platform routes remain in Radar only;
- explicit unquoted project names are extracted into the stored Lead project;
- shared longest-first category recognition consumes approved modifiers and preserves exact project binding in both category orders;
- generic region/promotion/genre/platform/count, Bilibili-alias, organization-only, source/document, and connector-only names remain excluded across structured, quoted, and unquoted paths;
- prose URL punctuation is normalized before, but never weakens, strict product-route validation;
- marked failures use one reason before downstream topic taxonomy, and dedupe preserves the marker in both input orders;
- transitive title/link duplicate bridges collapse to one conservatively marked component;
- a failed broad item creates no candidate, enrichment call, candidate-audit record, second-pass selection, or formal Lead;
- strict/expanded/rescue processing is disjoint;
- non-game animation filtering, Steam evidence integrity, candidate audit, and Radar diversity regressions remain green;
- tests use fixed fixtures and spies only, with no live provider or network access.

## Automation Boundaries

- Daily workflows remain limited to `schedule` and `workflow_dispatch`.
- No provider, CRM, Supabase, or production write is part of rule validation.
- No formal Lead count minimum, maximum, quota, backfill, or degraded threshold is introduced.
- Missing/invalid artifacts, source failure, qualified/push mismatch, write failure, and unsuccessful synchronization remain blocking.
