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

## Remaining

- Publish the final validated binding checkpoint, then verify exact remote blobs/tree and PR checks. Leave PR #116 ready for Release Captain acceptance; do not merge or deploy.

## Next Action

Publish the final validated binding checkpoint, then complete exact remote-tree/check acceptance.

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
