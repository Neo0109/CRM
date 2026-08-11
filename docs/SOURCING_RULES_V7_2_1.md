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

One pure named-project extractor validates structured project fields first, then a quoted name, then a conservative explicit unquoted title. It ignores missing and non-string fields and rejects literal missing markers, generic category nouns, event-only phrases, and wholly generic descriptors after NFKC/case/whitespace/punctuation normalization. The generic boundary uses whole-string dynamic-program segmentation against one curated vocabulary covering qualifier/quantifier, organization/team, game/product/project, market/platform/industry, news/update/message, business/license/publishing, and English-equivalent tokens. A name is generic only when every normalized character can be covered by those tokens, closing compositional forms such as `全新游戏项目`, `一款全新游戏`, `某公司项目`, `公司最新消息`, `手游市场`, `PC游戏平台`, `console game market`, and `latest game project`; normalized spelling such as `最新 消息` or `行业：资讯` cannot bypass it. Generic qualifiers `原创`, `自研`, `知名`, and `头部` are insufficient when they cover the whole name.

Count segmentation consumes a complete generic count phrase from one shared grammar. It accepts up to two bounded prefixes from `第/约/近/超/超过/逾/至少/至多/最多/共/合计/累计/数/上/大约/不下/不少于`, an Arabic numeral, Chinese numeral including `几`, or indefinite `若干` core, an optional pre-classifier `余/多/来`, a 款、个、部、项、批 classifier, and an optional post-classifier `以上/以下/以内/左右/上下/起/余`. It also recognizes `成百上千` magnitude forms and whole generic series labels `一批`, `一系列`, and `若干批`. Thus `若干款`, `几十款`, `十几款`, `10款以上`, `百款左右`, `大约十款`, `不下10款`, `至少上百款`, and `成百上千款手游` cannot pass or fall through to a legacy downstream rejection; category-prefix recognition reuses the same source and routes them early as broad-media Radar-only. A distinctive name such as `纪元10：余烬`, `余烬10`, or `第七史诗` remains valid because it leaves non-generic residue.

Region, promotion, genre, and platform-only modifiers—including 国产、海外、首款、热门、二次元、策略、移动, and PC—are generic when they cover the entire proposed name. Bilibili aliases and organization-only labels are also insufficient. The organization predicate shares one runtime company vocabulary with the existing domestic-company sourcing signal, including 网易、腾讯、朝夕光年、莉莉丝、心动、鹰角、库洛、叠纸、沐瞳、灵犀、祖龙、完美世界, and 中手游. A company alone or the same company followed only by role tokens such as 旗下、互娱、娱乐、互动、数字、文化、信息、软件、传媒、网络、游戏、科技、股份、控股、事业群、事业部、部门、中心 is rejected. A known media source—including 第一财经、中国证券报、南方周末, and 经济观察报—or a bounded 新闻、日报、时报、周报、晚报、电视台、广播、通讯社、媒体、新闻网、资讯、财经、证券报、周末、观察报 suffix shape is also a source entity, not a project; a bare `报` suffix is rejected only when its prefix has a conservative media-report shape, not for an arbitrary title. Source/attribution prose ending in 消息、报道、显示、称、宣布、透露、指出, or 表示 is rejected across structured, quoted, and unquoted paths, including before-category forms such as `IT之家消息 国产手游…`. Generic category-tail ecosystem roles such as 生态、赛道、板块、领域、品类 and `ecosystem/sector/category/field/segment` are insufficient across all three name paths. A real name such as `中国式家长`, `腾讯极光计划`, `莉莉丝深空计划`, `灵犀互娱：星火`, `新闻大亨`, `财经大亨`, `南方周末物语`, `生态迷城`, `武侠乂`, `新月计划`, `行业动态模拟器`, `Project Echo`, or `New Game Chronicle` is retained because the full name has distinctive residue rather than only a role.

Category recognition and unquoted extraction share one lexical-start scanner and one longest-first explicit vocabulary. A category may start only at the beginning of text, after an explicit separator, or at the beginning of a complete approved modifier/count prefix; English categories also require a Unicode letter/number boundary at the end. This prevents `NPC game` from exposing `PC game`, `automobile game` from exposing `mobile game`, and `云端游戏/终端游戏/高端游戏` from exposing `端游`. The vocabulary still includes mobile, PC, console, independent, domestic, network, handheld, web, mini-game, VR/ARPG, and common genre-product forms; longer forms such as 客户端游戏 and 移动端游戏 are consumed before the shorter 端游 token. A bare `游戏` is not an explicit category. Approved region/promotion/genre/platform modifiers and generic counts are consumed as part of a category phrase so they cannot fall back as the project name.

For an unquoted category-to-event slot, leading name introducers and trailing temporal/announcement connectors are stripped only at the slot edges. The category-first `新作` introducer may be glued to the name, so `国产手游新作星海远征公布 Demo` still binds exactly to `星海远征`; this trim is never applied globally. Chinese connectors include `预计/今日将/将/将会/计划于/计划在/计划将在/即将于/拟于/拟在/有望/有望于/宣布将/宣布将在/宣布计划`; English framing includes `will/shall/plans to/plans on launching/is set to/is expected to/is going to announce/will be launching/scheduled to launch` plus bounded announce/reveal/launch forms. Both name-before/category and category-before/name forms must store the exact project; `国产手游 星海远征 计划将在公布 Demo` remains eligible but binds only `星海远征`.

Quoted extraction considers every `《…》` entity in text order and selects the first role-valid project that has a later product event. It rejects source/organization/media roles and bounded document/policy/report suffix roles first; a nearer media or policy quote can never override an earlier valid project. Document-role suffixes include 办法、条例、规范、白皮书、报告、备忘录、协议、通知、指南、意见、倡议、要点、决定、规划, and 纲要. The suffix boundary uses conservative length plus a bounded qualifier grammar for short forms such as `保密/补充/框架协议`, `联合声明`, `整改通知`, and `用户公约`; long policy variants such as `关于游戏产业发展的指导意见` fail without enumerating their body, while the short distinctive game title `逆光协议` remains valid. Therefore both `《证券时报》…《星海远征》…Demo` and `《星海远征》…《央视新闻》…Demo` bind `星海远征`; a source-only or policy-only quote cannot become a project. The same extracted name is reused as the tagged media Lead project; identity-only admission may retain the legacy title fallback when no project name is required.

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
- shared lexical-start and longest-first category recognition consumes approved modifiers, rejects embedded category substrings, and preserves exact project binding in both category orders;
- complete generic count phrases, region/promotion/genre/platform modifiers, Bilibili aliases, organization-only labels, media/source/attribution/document roles, market/platform/industry/ecosystem roles, and connector-only names remain excluded across structured, quoted, and unquoted paths with exact `radar_only/non_game_broad_media` before downstream taxonomy;
- first-role-valid quote order and expanded Chinese/English slot connectors bind the exact project in both category orders;
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
