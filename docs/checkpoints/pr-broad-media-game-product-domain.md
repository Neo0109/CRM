# Broad Media Game-Product Domain Gate Checkpoint

## Current Goal

Deliver one bounded sourcing-precision PR that keeps broad non-game media Radar-eligible while preventing it from becoming a media candidate, entering enrichment, or becoming a V7.3 second-pass target.

## Overall Progress Checkpoint

- Frozen base: `origin/main@102dc567b73f9c871a0412ec42015b3eccb8b107`.
- Wave 1: PR #115 merged and reported deployed healthy before this wave.
- Open PR queue at start: 0.
- This wave touches only broad-media candidate-domain routing, the active rule version and machine/human rule documents, focused fixtures/tests, legitimate heartbeat/current-version references, and this checkpoint.
- Explicitly out of scope: formal V7.2 admission thresholds, workflow triggers, provider calls, CRM/Supabase writes, UI/API/schema expansion, deployment, manual reruns, and historical replay fixtures that intentionally model prior production versions.

## Completed

- Confirmed exact remote `main` SHA and zero open PRs through the GitHub API.
- Confirmed the required external contract:
  - active version `sourcing-rules-v7.2.1-media-product-domain`;
  - broad-source marker `candidate_domain_gate: "game_product"`;
  - failed disposition `radar_only`;
  - failed reason `non_game_broad_media`.
- Frozen the approved evidence rule: broad media may enter candidate routing only with structured game identity, or a concrete project name plus explicit game-product category plus a concrete product event.
- Added the RED fixture/test contract covering the exact Chevrolet false positive, generic company/financial news, five concrete broad-media game-event positives, structured identity, game-vertical and animation controls, Radar retention, candidate/audit/formal/second-pass exclusion, and strict/expanded duplicate processing.
- Captured the expected RED result with no network/provider access: `node --test automations/test/onlineDailyV4BroadMediaGameProductDomain.test.mjs` failed 6/6 bounded subtests on the old version, missing gate helpers, missing Radar-only routing, missing enrichment seam, and duplicate lane processing.
- Implemented exported broad-media domain helpers, source-marker propagation, pre-enrichment fail-closed routing, a no-candidate enrichment short circuit, and disjoint strict/expanded/rescue lane partitioning.
- Bumped the active runtime/machine/Heartbeat/current-doc contract to `sourcing-rules-v7.2.1-media-product-domain`; added canonical `docs/SOURCING_RULES_V7_2_1.md`; left the formal V7.2 admission gates unchanged.
- Resolved one focused compatibility ripple: unmarked global game media retains the pre-existing China-joint discovery behavior, while every marked broad-media non-lead disposition remains unable to bypass the domain gate.
- Root review caught and closed one scope regression with an accepted focused RED: the first GREEN reused the strict broad-media helper for standalone-animation filtering, which tightened an unmarked game-vertical path. The legacy private `hasIndependentGameProductEvidence()` boundary is restored for `non_game_animation_series`; the strict helper remains confined to sources marked `candidate_domain_gate=game_product`.
- Added a regression control proving an unmarked animation-styled GameLook signal retains legacy candidate eligibility while a true non-game animation series remains Radar-only.
- GREEN evidence is offline and provider-free: the focused contract passes 7/7 and `npm run test:daily-v4` passes 305/305.
- Post-review focused union passes 29/29; the exact full `npm run verify:all` passes all declared tasks, including frontend/backend/functions typechecks, Daily V4 305/305, historical liveness replay, daily contract validation, the temporary frontend build, and diff-check.
- Machine rules and the focused JSON fixture parse successfully; the exact frozen-main-to-snapshot whitespace check is GREEN.
- Historical replay/window fixtures and the V7.2 baseline document retain their producing version; Heartbeat keeps the old version allowlisted for historical compatibility while recognizing V7.2.1.

### PR #116 Blocking P1 Repair

- Exact-head QA at `a7fe1e3eedb9489d0a34a5a99cdf908ad44c1157` found four bounded admission defects: missing project fields normalized to the literal `undefined`; arbitrary structured IDs and broad 3839/好游快爆 paths counted as identity; marked-source failures could receive legacy downstream reasons instead of the exact broad-media reason; and non-Bilibili dedupe could discard the marker based on input order.
- Added adversarial fixtures for the three exact unnamed generic headlines, malformed Steam/TapTap/game IDs, `/news/` and arbitrary 快爆 routes, valid normalized platform identities, two explicit unquoted-title forms, marked film/animation/update/approval/unresolved-store failures, and both marked/unmarked dedupe orders.
- Accepted provider-free RED: the focused contract now has 11 subtests, with 7 failing on the old head and 4 legacy controls green. Failures independently prove helper false positives, missing unquoted extraction, non-uniform reason precedence, order-dependent marker loss, and one leaked end-to-end candidate/enrichment path.
- Implemented the bounded GREEN: project fields ignore non-string/missing values and reject literal/generic/event-only names; a pure explicit unquoted-title extractor feeds both the domain decision and tagged Lead project; platform IDs and generic game IDs use narrow numeric/namespaced validation.
- Normalized link admission now parses URL hosts/path segments. Steam/SteamDB require `app/<positive numeric>`; TapTap requires numeric `app|game`; indienova accepts a concrete non-reserved `g|game|games` ID including percent-encoding; 3839/好游快爆 accepts only numeric `a`, `shouyou`, `game(s)`, `app(s)`, or `product(s)` routes.
- Marked domain failure now precedes downstream topic taxonomy. Dedupe conservatively preserves `candidate_domain_gate=game_product` when either duplicate carries it, while two unmarked non-Bilibili items retain the previous primary-object behavior.
- Post-repair focused contract passes 11/11, the impacted union passes 58/58, and `npm run test:daily-v4` passes 309/309. All tests remain provider/network-free.
- Exact `npm run verify:all` passes every declared task after the repair, including frontend/backend/functions checks, Daily V4 309/309, historical liveness replay, daily contract validation, temporary frontend build, and frozen-base diff-check.

### Final Named-Project Binding And Namespace RED

- Review of coherent GREEN `7e73727454a80f8c0bdba9fbdbdc80972446ef6f` found one named-project binding asymmetry and one namespace-validity gap: structured names admitted the item but were not reused as tagged `Lead.project`; namespace prefixes allowed arbitrary non-product suffixes.
- Added a structured `project_name: "雾港纪事"` end-to-end fixture and invalid `steam:abc`, `taptap:company-news`, `kuaibao:news`, and `3839:report` identities.
- Accepted focused RED: 12 subtests produced 3 failures and 9 legacy greens, proving the absent shared extractor export, false namespace admission, and resulting broad-negative disposition leak.
- Final bounded GREEN exports one pure `extractGameProductDomainProjectName(item)` and reuses it in both the gate and tagged Lead conversion, ordered as validated structured name, quoted name, then explicit unquoted name. Identity-only admission falls back to legacy title extraction.
- Steam/TapTap/快爆/3839 namespaced IDs now require positive numeric suffixes; indienova reuses the concrete non-reserved slug validator, including an explicit `indienova:news` negative. Focused passes 12/12, impacted union 59/59, and Daily V4 passes 310/310.
- The repeated exact `npm run verify:all` after the final binding repair passes all declared tasks with Daily V4 310/310.

### Generic Project Descriptor P1 RED

- Exact-head QA at `17151a4d2f8d296a68fc0a7b54b2f29482deffe2` found that wholly generic descriptors can still satisfy the shared project-name validator through structured, quoted, and explicit unquoted paths. Reproductions include news/update/team/product descriptors, quantified generic titles, and Han prefixes whose old trailing JavaScript `\b` check is not Chinese-safe.
- Added one provider-free adversarial contract covering all three name paths for the required Chinese and English descriptors, plus end-to-end exclusion from candidate, enrichment, candidate audit/formal records, and V7.3 second pass. Distinctive controls retain exact project binding for `星海远征`, `雾港纪事`, `Lost Dream Chronicle`, and names that contain ordinary words without being wholly generic.
- Accepted focused RED: 13 subtests produce exactly 1 new failure and 12 existing greens; the first observed leak is structured `最新消息` returning as the project name. The same test matrix contains quoted and unquoted variants for every descriptor and the Han-prefix cases.
- Implemented one shared normalized predicate inside the existing concrete-project validator. It applies to structured, quoted, and explicit unquoted paths; performs NFKC/case/separator normalization; rejects exact news/update/team/product labels, placeholder/quantified descriptor grammar, and reporting/team prefixes at an explicit separator or end boundary; and does not reject a distinctive name merely because it contains an ordinary word.
- Extended the same matrix for `某公司`, `某团队`, `某工作室`, `一家团队`, `一款产品`, `一款新游`, `这款游戏`, `旗下新作`, `项目动态`, and whitespace/punctuation variants such as `最新 消息` and `行业：资讯`. Machine rules and both active documents now declare the normalization, placeholder, generic-descriptor, prefix, extraction-order, and shared Lead-binding contract.
- Final provider/network-free GREEN: focused passes 13/13; the expanded impacted union passes 92/92; `npm run test:daily-v4` passes 311/311; and the exact `npm run verify:all` passes every declared task, including typechecks, historical liveness replay, Daily contract validation, temporary frontend build, and frozen-base diff-check.
- Machine/fixture JSON parsing, changed-module syntax checks, and the exact frozen-main whitespace check pass. The updated `daily-report.json` Git blob is `9c9170bb546bbf8529a5c2ba37ee4dd2b3b524d2`, and the shadow integration behavior floor matches it.
- Published coherent GREEN `48e4e09e838746b6c59d46db90708ec926db3ef7` with tree `a76fb036d8602e564e3fe7be14577f19e6f11605`. GitHub compare confirms the exact frozen base, 22 changed files, and 22/22 remote blobs match the verified disposable snapshot with zero mismatches.
- Exact-head remote acceptance is GREEN: Cloudflare Pages passed, and both frontend check runs passed (`31506242107 / 93828423157` and `31506246645 / 93828438916`). The only remaining review thread was an outdated nullish-project P1 already closed by string filtering, literal sentinel rejection, focused unit coverage, and end-to-end zero-candidate coverage; thread `PRRT_kwDOSiiYJ86YQzlH` is now resolved.
- Nonblocking follow-up, deliberately not expanded into this repair: non-Bilibili dedupe currently preserves the conservative domain marker but does not union a valid Steam link carried only by the secondary duplicate, creating false-negative/input-order asymmetry. This should be addressed as a separate evidence-merge item after PR #116.

### Compositional Generic-Token P1 RED

- Follow-up QA superseded coherent GREEN `48e4e09e838746b6c59d46db90708ec926db3ef7` and its validation-only child after reproducing compositional descriptor bypasses that were not matched by a one-layer exact/regex grammar: `全新游戏项目`, `最新游戏项目`, `多个游戏项目`, `一款全新游戏`, `这款新游戏`, `某公司项目`, `公司最新消息`, `官方最新消息`, and `游戏最新消息`.
- Extended the same structured/quoted/unquoted and end-to-end zero-candidate matrix with every reproduced Chinese composition and English equivalents such as `latest game project`, `company latest news`, `official game update`, `new publishing project`, and `development team update`. Added distinctive residue controls `新月计划` and `Project Echo` alongside the existing real-name controls.
- Accepted provider-free RED: the focused contract remains 13 subtests with exactly the generic-name subtest failing and 12 existing subtests green; the first observed leak is structured `全新游戏项目` returning as the project name.
- Replaced the one-layer exact/regex grammar with one whole-string dynamic-program segmentation predicate shared by structured, quoted, and explicit unquoted project-name validation. It normalizes NFKC, case, whitespace, punctuation, and symbols, then attempts complete coverage with a curated vocabulary for qualifiers/quantifiers, organizations/teams, game/product/project nouns, news/update/message labels, business/license/publishing labels, and English equivalents.
- The predicate rejects only a fully segmentable normalized descriptor; any non-generic residue prevents generic classification. Exact project binding stays green for `星海远征`, `雾港纪事`, `Lost Dream Chronicle`, `行业动态模拟器`, `New Game Chronicle`, `新月计划`, and `Project Echo`. The separately approved reporting-prefix boundary remains explicit and Chinese-safe.
- Final provider/network-free GREEN after the DP repair: focused passes 13/13; the expanded impacted union passes 92/92; `npm run test:daily-v4` passes 311/311; and the exact `npm run verify:all` passes every declared task. Machine/fixture JSON parsing, changed-module syntax checks, and the exact frozen-main whitespace check pass.
- Machine rules and both active documents now declare whole-name segmentation, the six vocabulary categories, and distinctive-residue admission. The updated `daily-report.json` Git blob is `154950188e56135a43368be06b79a5044e6e1873`, and the shadow integration behavior floor matches it.
- Published coherent DP GREEN `7ae72dd0c6800bb6f64b50a7c718bf723f6c5afb` with tree `6ccfad3167b23c35e619c29922bdd28db8103561`. GitHub compare confirms the exact frozen base, and all 22 remote changed-file blobs match the verified disposable snapshot with zero mismatches.
- Exact-head remote acceptance is GREEN: Cloudflare Pages passed, and both frontend check runs passed (`31507098943 / 93831355404` and `31507102754 / 93831368992`). The PR has no unresolved review threads.

### Region, Promotion, Organization, And Count Modifier P1 RED

- Independent QA superseded validation-only head `61dafb40861c366773ae4b4c42de5189ec9a039c`. Exact reproduction: `国产手游 一家开发团队最新更新 开启 Playtest` matched the short `手游` category, rejected the generic between-category/event text, then incorrectly accepted the leftover pre-category `国产` as the project, producing domain evidence, a candidate, and enrichment eligibility.
- Added one bounded three-path matrix for region modifiers (`国产/中国/国人/国内/海外/进口/全球/亚洲/本土`), promotion/placeholder modifiers (`首款/热门/精品/重磅/年度新游/神秘新作/年度力作/未命名新作/尚未命名项目/代号项目/备受期待作品`), high-frequency genre/platform modifiers (`二次元/武侠/卡牌/策略/肉鸽/模拟经营/移动/PC`), organization-only values, Bilibili aliases, and generic count shapes.
- The unquoted end-to-end matrix covers short categories after region/promotion/genre/platform/organization/platform-alias modifiers; both orders and punctuation for every `B站/哔哩哔哩/bilibili/Bili Bili/B·站` plus `官方/授权/发行/合作/需求/上线`; and `两款/三款/十款/10款 + 手游/国产手游/独立游戏`. Every negative must return exact `radar_only/non_game_broad_media` and produce zero candidate, enrichment, audit/formal record, or V7.3 second pass.
- Distinctive-residue controls preserve true names and before-category forms, including `星海远征 国产手游开启 Playtest`, `雾港纪事 海外独立游戏开放 Demo`, `代号：鸢`, `神秘海域`, `中国式家长`, `上海之夏`, `腾讯极光计划`, genre-token names, `PC小队`, `纪元10：余烬`, and `Project Echo`.
- Accepted provider-free RED: the focused contract now has 14 subtests, with exactly 2 failing and 12 existing subtests green. The failures independently show structured `国产` accepted as a project and the exact unquoted production reproduction extracting `国产`.
- Expanded the same P1 before overall GREEN with an unquoted slot-framing contract. Name-before-category reproductions cover Chinese temporal/announcement connectors (`正式/即将/今日`) and English connectors (`announces/officially reveals/launches`); category-before-name controls cover leading `新作` and trailing `今日`, in both Chinese and English. Each case must bind the exact project into `Lead.project`.
- Accepted the connector RED after the modifier implementation turned its two failures green: focused now has 15 subtests with exactly the new connector subtest failing and 14 green; `星海远征 国产独立游戏正式公布 Demo` incorrectly extracts `正式` instead of `星海远征`.
- Deferred P2, deliberately not included in this P1: a real unquoted project name that itself contains a category token can make the first category match bind the wrong project, for example `手游模拟器 国产独立游戏公开 Demo` or `PC Game Tycoon 国产独立游戏公开 Demo`. This requires a separate category-selection design, not expansion of the modifier repair.

## Remaining

- Publish the expanded RED checkpoint, finish shared unquoted slot-framing cleanup on top of the modifier/count/organization and approved category-prefix repair, then rerun focused/impacted/Daily V4/full verification.
- Publish a new coherent GREEN and complete exact remote acceptance. Leave PR #116 ready for Release Captain acceptance; do not merge or deploy.

## Next Action

Publish the expanded RED checkpoint, finish the bounded P1 repair, then rerun provider-free validation.

## Git Status

- Delivery branch: `codex/broad-media-game-product-domain`.
- Remote mutation method: GitHub Git Data API only.
- Local CRM worktree: read-only and untouched.
- Disposable snapshot: non-git temporary directory.
- RED commit parent: `1034028cf6a481337794039e4752ddf01d0eb382`.
- GREEN commit parent: `6e998999c0ea5679a12fe29e6bcfb27f5fa862bc`.
- Published coherent GREEN before review: `4faf9101eec936822e9610ef8f856846bc5f1d10`.
- Blocking P1 RED: `2e54d5d4884f9ebcb57f29e8303c871b67e983ec`.
- Coherent P1 GREEN before full verification: `7e73727454a80f8c0bdba9fbdbdc80972446ef6f` (tree `f38345c24aaa42ac41744500d62c8389d4450514`).
- Final binding/namespace RED: `20fad7acb082867ef3ff0ee54b7286ef823b7227` (tree `2eb97efa97b40c86cf34e23353dd49a223c49617`).
- Last fully verified head before generic-descriptor QA: `17151a4d2f8d296a68fc0a7b54b2f29482deffe2` (tree `6df28f908dd569a12260d8af089dc1c4a1350112`).
- Generic-descriptor RED: `644257e541dadf35c674a4e1b32b1bd09ec3e4ab` (tree `5471529422e5594f00f5336a5d47692746bf606e`).
- Coherent generic-descriptor GREEN before final validation-only checkpoint: `48e4e09e838746b6c59d46db90708ec926db3ef7` (tree `a76fb036d8602e564e3fe7be14577f19e6f11605`).
- Superseded validation-only checkpoint: `de05087f83f9e6e36b0526eecdb18b0869e2a692` (tree `6df27c14fc24219618151c507d3d9da329425614`).
- Compositional generic-token RED: `1636646a7695d21777c47ca0dc7ca9afb98928bf` (tree `9fad837148cbdc674f4a2e37bc94a5b99edc9852`).
- Coherent compositional generic-token GREEN before final validation-only checkpoint: `7ae72dd0c6800bb6f64b50a7c718bf723f6c5afb` (tree `6ccfad3167b23c35e619c29922bdd28db8103561`).
- Superseded compositional validation-only checkpoint: `61dafb40861c366773ae4b4c42de5189ec9a039c` (tree `a9c38bf70d6ef63ded5c4b43c8fee95766b17285`).
