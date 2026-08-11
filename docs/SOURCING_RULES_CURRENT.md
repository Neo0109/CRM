# Current Daily Report Rules

Date: 2026-08-11

The current daily report rule version is `sourcing-rules-v7.2.1-media-product-domain`.

Canonical human-readable rule document:

```text
docs/SOURCING_RULES_V7_2_1.md
```

Machine-readable automation rule source:

```text
automations/rules/daily-report.json
```

Active automation entrypoint:

```text
automations/jobs/online_daily_runner.mjs -> automations/jobs/online_daily_v4.mjs
```

The pre-v4 daily generators are archived in git history. Do not use `online_daily.mjs`, `online_daily_v2.mjs`, or `online_daily_v3.mjs` as development or workflow entrypoints.

V7.2.1 keeps broad discovery active and evaluates `indie_prelaunch` and `china_joint` in parallel. Before candidate conversion, IT之家、证券时报、澎湃新闻 apply the `game_product` candidate-domain gate defined in the canonical document; failed broad-media items remain Radar-only. Every deduped project that completely passes either unchanged V7.2 lane enters `push_pool` with `priority=null`; neither lane has a quota and the combined formal pool has no total cap. Missing or contradictory evidence cannot be offset by score and remains only in the candidate audit. A zero-Lead day is neither a failure nor `degraded`; missing/invalid artifacts, source failure, qualified/push mismatch, write failure, and a receipt without both `status=success` and `sync_response.synced=true` remain unhealthy.

The standalone `steam-schinese-reviews-v1` audit source is not imported by the active Daily runner or either Daily workflow. V7.1 consumes its validated artifact and activates EA/high-traction and China-heat publication only through the separate `.github/workflows/steam-review-opportunities.yml`, `automations/rules/steam-review-opportunities.json`, and the delivery contract in `docs/STEAM_REVIEW_OPPORTUNITY_DELIVERY.md`.

## Operating Principle

The daily report is for a Bilibili game publishing BD owner. It must reduce BD judgment cost. It should not produce generic trend text, internal automation notes, or category filler.

Every important output should answer:

- What is the product or external signal?
- Is it domestic or overseas, and does it realistically fit Bilibili BD signing probability?
- What are its strengths and weaknesses?
- What public data or source supports the judgment?
- What is the gameplay loop, content hook, or BD implication?
- Can Bilibili amplify it through creators, video content, community, localization, events, or China publishing context?
- What should BD do next?

## Inbox Rule

Automatic daily reports are discovery plus deterministic admission, not final human prioritization. Every project that completely passes either V7.2 lane enters the formal `push_pool` and `未处理` inbox with `priority=null`.

The scan preserves all candidate evidence and decisions in `data/sourcing_candidates/YYYY-MM-DD.json`. Failed or unknown candidates stay only there; the candidate audit is not a Lead payload and is never read by the automatic CRM sync path. The automation must not place new leads into `观察池`, `待评测`, `跟进中`, or `推进池`.

The default operating flow is efficiency-first: first test or inspect the game, then decide. If the game does not pass playtest/content judgment, move it to `淘汰池` immediately. Do not require the BD owner to补官网、邮箱、联系人或长资料 before the product itself has passed the first test.

Contact methods must prefer real business touch points: official email, official site, official support URL, Discord, X/Twitter, or Bilibili. Steam store and SteamDB links belong in `links`, not `contact_methods`. A Steam community discussion URL may remain a discovery fallback, but it does not satisfy the V7.0 non-Steam business-entry gate; do not invent contact details.

Domestic media and Bilibili product signals are first-class discovery sources, not only radar background. A named game or source label is never enough for formal publication: the normalized project must pass the same eleven V7.0 gates as a Steam candidate. A non-Steam project identity may be used for dedupe, but every other mandatory product, quality, contact, and China-value proof still applies.

Bilibili search results must still be concrete games. Steam Next Fest signup tutorials, wishlist-growth data sharing, courses, or generic developer-experience videos are useful methodology references, but they should not be inserted into the lead queue as products.

Already released projects cannot enter `indie_prelaunch`. They may enter `china_joint` only when one locked data path, a current China opportunity, and a clear mature-China-partner state all pass.

New candidates launching in fewer than 60 days cannot enter `indie_prelaunch`. Demo, playtest, or store-page-live signals only prove testability for that lane. The independent `china_joint` lane does not use the prelaunch window gate, but it still requires its complete data and commercial qualification chain.

For Bilibili video leads, the automation must do one more verification pass before creating a CRM candidate:

- Open/enrich the Bilibili video metadata and description when possible, because the description often contains Steam store links, official sites, Discord, email, TapTap/indienova, or other contact clues.
- Treat recommendation-UP videos as discovery signals only. Search for matching official, developer, studio, or publisher Bilibili videos/posts and prefer those when they match the concrete project.
- Extract Steam AppID, Steam store URL, official links, and real contact methods from the video description before writing the lead.
- Extract Steam/TapTap/official/community links from any Bilibili description, media body, gameplay text, or source summary into structured `links`. Do not leave Steam store links buried inside long text fields.
- Cross-check Steam release state when a Steam link/AppID is available. If Steam or the original Bilibili text shows the product is already fully released or launching in fewer than 60 days, it must not enter a formal pool; retain the failed gate in the candidate audit or keep it as market background.
- Do not treat `Demo 已上线`, `试玩上线`, `测试开启`, or `商店页已上线` as full release. Those are still valid review/test signals.
- Deduplicate against existing CRM projects, Steam AppIDs, source URLs, and backend dedupe keys before creating a new lead. A slightly different Bilibili title for a previously sourced Steam product should enrich or be ignored, not create a duplicate.
- Bilibili video signals must be timely. Old videos or old news should not create new leads unless they contain a current playable build, new demo, update, publishing window, or business-relevant event.

Domestic products are the default sourcing priority. Domestic developer Demo/test signals are useful only while there is still a real cooperation window, because cooperation, efficiency, visual/cultural fit, creator communication, and signing probability are materially better before the launch window closes.

Overseas products require independent public-quality proof, a concrete China/Bilibili value case, and explicit official China demand. Creative novelty or a generic mobile-adaptation idea alone is not enough.

The 60-day window is a hard filter for fresh automation-sourced leads. Domestic products can be discovered earlier or over a longer horizon, but if the confirmed release date is fewer than 60 days away, the project remains outside formal pools and only its candidate-audit decision is retained.

## Update Protocol

Rules are living product infrastructure.

When the report logic is iterated:

1. Update the canonical rule document.
2. Update `automations/rules/daily-report.json` when machine-readable expectations change.
3. Update the online generator or wrapper in the same PR/commit if behavior must change.
4. Keep `.github/workflows/sync-daily-report.yml` watching rule files so a rules-only change can exercise the automation.
5. Confirm the next automation run logs the active rule version.

Rule changes must live in GitHub, not on a local machine, because the operator may switch computers.

## Execution Requirements

The online generator must preserve the product intent of these rules:

- Domestic Steam keyword searches must use actual search-term filtering, not just China-locale generic popular lists.
- The same Steam AppID should keep the strongest discovery source, especially domestic keyword, Demo, or Next Fest signals.
- Daily generation should dedupe against a meaningful recent history window so stale CRM items do not keep returning as "updates" and crowd out new discoveries.
- V7.2 must keep scanning broad enough for source and evidence diagnostics, publish every and only fully qualified project across both regular lanes, and never use a lane quota or formal minimum/maximum as a health signal.
- Daily generation must log both Steam scan volume and media/Bilibili product-lead volume so a low-output day can be diagnosed quickly.
- Daily generation must write a schema-validated candidate audit with one deduped record per Steam AppID or normalized project key, explicit `formal | candidate | excluded` decisions, unknown evidence, matched rules, and exclusion reasons. Only the Daily report pools are eligible for CRM synchronization.
- Steam is not allowed to be a single point of failure. If Steam is temporarily unreachable but domestic media/Bilibili sources produce concrete product leads, the automation must still generate a useful report from those sources instead of leaving the day blank.
- Bilibili candidates must be enriched from video descriptions before candidate creation, then checked for Steam release status, duplicate CRM history, and stale source age.
- Bilibili probe candidates from configured official, developer, publisher, media, trusted creator, and keyword sources must prefer official/developer/publisher evidence when the same Steam AppID or video/link appears more than once.
- Candidate fields must stay useful for decision work: `priority_reason` is empty unless there is a concise human-useful priority reason, `rule_fit` gives the rule judgment and insight, `gameplay` is compact genre/tag text, `progress` is a short status such as `试玩 Demo` / `EA` / `正式上线` / `即将发售`, and `next_action` / `notes` default empty for human BD input.
- Industry Radar is a compact China + overseas news board. `行业新闻` is reserved for macro market/platform/regulatory/company-level news. Concrete game recommendations, fun products, IP moments, legal/company gossip, and former `发行八卦` items belong in `今日亮点`.
- Radar output should be broad enough to show trends, not just a few similar cards. When sources are available, include both domestic and global signals across macro news, product highlights, AI/tooling, memes/community, and Bilibili trends.
- Steam Trends is a Steam market board, not a sourcing-rule mirror. It must cover category risers, Steam official/community windows such as Demo/Next Fest, publisher/developer slate signals, public data quality, and concrete BD implications.
- Steam Trends market insights must cite Steam, SteamDB, AppDetails, official event pages, or observable public data. They must not cite CRM rule docs or internal automation changes.

## Current Known Gap

`automations/jobs/online_daily_runner.mjs` is the active cloud entrypoint and `online_daily_v4.mjs` is the active generator. The rule JSON is the online source and run guard; future cleanup should keep configurable thresholds, category definitions, media-source weights, source expansion, and exclusion rules in the rule file where practical.

Domestic media and Bilibili sources now feed both the radar and the lead generator through structured evidence. The next calibration task is production monitoring: confirm successful receipts keep `steam_evidence_lost = 0` and review any exact-title lookup misses without weakening the integrity gate.

## Historical V6 Low-Volume Fix (superseded by V7.0)

Earlier V6 versions treated a tiny daily queue as a degraded quality signal. V7.0 permanently removes formal Lead quantity from health while preserving the non-Lead artifact checks below.

Historical cloud thresholds were:

- Steam scan budget: `260`
- Historical target `push_pool + watch_pool`: `18`（V7.0 已删除）
- Historical minimum media/Bilibili leads when domestic signals are healthy: `10`（V7.0 已删除）

The generator now uses both strict and expanded domestic media/Bilibili extraction. Expanded candidates may enter `未处理` when they point to a concrete product moment, even if the project name later needs manual cleanup. Obvious non-products such as tutorials, wishlist-growth lessons, recruitment, financial reports, discounts, hardware posts, and generic ranking filler remain excluded.

## V6.1 Bilibili Verification Gate

V6.1 closes the Bilibili false-positive loop: a Bilibili video is a discovery signal, not proof that the project is new or still in a BD window.

Before creating a Bilibili/media lead, the automation must enrich the video description, extract links/contact methods, dedupe against CRM history, and cross-check Steam when a Steam AppID or store URL is present. Already fully released products, old videos without a current event, and previously sourced projects must not reappear as fresh `未处理` leads.

## V6.2 Official Source, Field Hygiene, And Stability

V6.2 keeps the first-version sourcing ambition but adds guardrails so sourcing quality work does not destabilize automation.

- Official source first: Bilibili recommendation videos can reveal a product, but official/developer/studio/publisher Bilibili sources are preferred for final evidence when available.
- Link hygiene: Steam, SteamDB, TapTap, official-site, Discord, email, and other useful links must be structured into `links` or `contact_methods` instead of staying buried in `gameplay`, `progress`, or notes.
- Field hygiene: generated media leads should keep `priority_reason`, `rule_fit`, `gameplay`, `progress`, `bilibili_fit`, `amplification`, `risks`, and `verdict` concise. `next_action` and `notes` are for human BD work and should stay empty by default.
- Stability: low review volume is a sourcing/rule/upstream degradation signal, not a reason to suppress otherwise valid outputs. The generator must publish with visible diagnostics while logging candidate totals, duplicate filters, released filters, official-source hits, final import candidates, and source diagnostics. Empty source output, schema damage, write failure, and CRM sync failure remain blocking.
- Hard failures remain hard: schema breakage, generated file write failure, or CRM sync authentication/write failure must still fail the workflow.

## V6.3 Backfill Hygiene And Token Guard

V6.3 keeps the V6.2 sourcing behavior and tightens two operational edges:

- Review backfill is allowed only as a clean first-pass `未处理` candidate before volume diagnostics. It must not write rule-version labels, fallback diagnostics, or automation receipts into user-facing fields such as `notes`, `next_action`, `verdict`, `priority_reason`, or `rule_fit`.
- Backfilled leads should still explain BD value through gameplay strength, income upside, market heat, Bilibili amplification, team/region fit, and signing probability.
- GitHub Actions and Cloudflare sync paths should prefer `CRM_AUTOMATION_TOKEN`; `CRM_ACCESS_TOKEN` remains only a backwards-compatible fallback where explicitly wired.
- Product version, daily-report rule version, and GitHub workflow health are separate concerns. A sourcing-rule update must not bump the product UI version or change unrelated product features.

## V6.4 Bilibili Probe

V6.4 adds a configurable Bilibili sourcing probe without changing CRM UI, schema, sync behavior, or GitHub Actions triggers.

- The probe can scan configured official, developer, publisher, media, trusted creator, and keyword sources.
- Video details must be enriched before scoring so descriptions can contribute Steam, SteamDB, official-site, and contact evidence.
- Blacklisted UID/BVID/keywords, stale videos, generic recommendation collections, and non-official videos without required product-window keywords are filtered before lead creation.
- When multiple Bilibili signals point to the same Steam AppID, BVID, or source link, official/developer/publisher sources must beat recommendation or keyword sources.
- Probe diagnostics must be visible in automation summary fields, but probe counts and rule labels must not be written into user-facing lead fields.

## V6.5 Window Hygiene

V6.5 keeps the V6.4 Bilibili probe and restores the BD window gate:

- Fresh Steam or Bilibili/media candidates with confirmed launch dates fewer than 60 days away must be routed to `drop_pool` or market background.
- Demo/试玩/测试 signals still matter for product inspection, but they no longer override a near-launch cooperation window.
- `priority_reason`, `next_action`, and `notes` are human-owned fields. Automation should keep them empty by default and put rule judgments in `rule_fit`, `risks`, `drop_reason`, `progress`, and `release_window`.

## V6.6 Steam Evidence Integrity

V6.6 makes the full Bilibili detail the authoritative evidence input instead of asking Lead construction to rediscover links from display text.

- Extract one structured `BilibiliEvidence` object immediately after detail enrichment and before any summary truncation or field formatting. Preserve source URLs, extracted URLs, Steam AppID, official site, email, and contact clues.
- If evidence contains a Steam Store, Steam Community app, or SteamDB app URL, the final Lead must contain a resolved `steam_app_id` plus canonical Store and SteamDB links. Auto-repair missing structured fields; if consistency still cannot be established, block the candidate and increment `steam_evidence_lost`.
- Resolve Demo AppIDs through Steam `fullgame.appid` before release checks. The Demo date is evidence that a build is playable, not the full game's release date. The `404幸存者 Demo` regression resolves `4039970` to full game `4038790`.
- Deduplicate repeated BVIDs by resolved Steam entity while retaining all useful Bilibili source URLs and preferring official/developer evidence.
- Route film, screenplay, actor/director, adaptation, update/DLC, promotion, guide, and review items to `radar_only`. Treat `过审` as a game Lead signal only with edition-number, 新闻出版署, or network-game approval context.
- Account for every detected Steam link as a structured Lead, Demo conversion, released/radar-only filter, duplicate merge, or integrity failure. Successful receipts must report `steam_evidence_lost = 0`.

## V6.7 Non-Game Animation Lead Gate

V6.7 adds one narrow semantic gate for standalone animation/series signals without changing the existing sourcing funnel.

- Animation, anime, comic, series/season, broadcast, dubbing, and voice-cast signals are `radar_only` when no independent game-product evidence exists.
- The gate reads the content itself: title, summary, description/detail, dynamic text, owner name, and tags. A configured source label such as a Bilibili game-search query is not game evidence.
- Quoted titles, PV/trailer, new-work, launch, reservation, and official-source status alone do not prove that the item is a game.
- Steam/AppID/SteamDB, TapTap, indienova, 好游快爆, an explicit game product class, or `游戏` combined with Demo/试玩/实机/测试/商店页/愿望单/版号/Playtest is independent game evidence and keeps the item eligible for the existing Lead paths.
- Filtered animation signals stay visible in Radar as non-game animation/IP observation cards; their copy must not ask BD to inspect gameplay or试玩.
- Existing scoring, source queries, Steam resolution, dedupe, release-window logic, CRM schema/UI, product version, and existing Lead records remain unchanged.
- The runner imports the exported rule version used by the loader so a rule bump cannot leave the cloud wrapper on a stale hard-coded version.

## Historical V6.8 Quality Quarantine

V6.8 was the temporary publication boundary before V7.0 activation. It remains documented only for historical receipts and regression compatibility.

- Continue the normal Steam and media/Bilibili scan, evidence normalization, dedupe, and source-health checks.
- Continue generating the dated Daily report, Industry Radar, Steam Trends, and `data/sourcing_candidates/YYYY-MM-DD.json` candidate-audit artifacts.
- Publish empty `push_pool`, `watch_pool`, `drop_pool`, and Steam Trends `crm_candidates` arrays.
- Do not treat zero or low formal Lead counts as failure or `degraded` while this exact rule version is active.
- Do not restore quantity backfill, P3-to-P2 promotion, or minimum recommendation counts.
- Keep empty source output, missing files, schema damage, write failure, sync failure, and the strict successful-receipt contract blocking.
- Keep the candidate audit outside every automatic CRM import path; it is an observability artifact for source, decision, and exclusion evidence only.
- Workflow triggers remained limited to `schedule` and `workflow_dispatch`; V6.8 did not change product code, UI, CRM schema, existing Leads, or production data.

## V7.0 Quality-Gated Indie Admission

- All eleven gate IDs and their evidence meaning are canonical in `docs/SOURCING_RULES_V7_0.md` and mirrored by `automations/rules/daily-report.json`.
- Scores, labels, tags, screenshots, movies, and field completeness can order discovery only; they cannot compensate for a failed or unknown gate.
- Every qualified deduped project enters `push_pool`; `watch_pool` and `drop_pool` remain empty for new V7.0 decisions.
- Every unqualified project remains only in the sourcing-candidate audit with missing gate IDs or hard exclusion reasons.
- Automatic priority stays `null`, and `new_qualified_count === push_pool_count` is a blocking contract.
- Formal Lead count has no minimum, maximum, cap, backfill, truncation, or health threshold.

## V7.2 2A/3A China Joint Admission

- The unchanged lane baseline is `docs/SOURCING_RULES_V7_2.md`; the active composite contract is `docs/SOURCING_RULES_V7_2_1.md`, mirrored by `automations/rules/daily-report.json` and executed by the regular Daily V4 decision layer.
- `indie_prelaunch` keeps its eleven V7.0 gates. `china_joint` adds four independent gates: identity/dedupe, one locked data path, a current China business opportunity, and confirmed absence of mature China-partner occupancy.
- The three data paths are exactly: Steam recommendations `>=5000`; recommendations `>=1500` with `Very Positive` or `Overwhelmingly Positive`; or a verified major-title team record plus a current official product event.
- Current China opportunity means verified publishing, license/版号, localization, marketing, mobile, or joint-operation need. No current China need and known mature China-partner occupancy are hard exclusions from `china_joint`; unknown evidence cannot pass.
- Both lanes use the same dedupe/publication boundary. An already-qualified indie project keeps `indie_prelaunch`; otherwise a complete joint pass publishes as `china_joint`.
- Every complete pass is formal. Ranking affects reading order only; neither lane nor their combined formal output has a quota, minimum, maximum, backfill, or cutoff.
- Fixed acceptance requires the same-day 5-indie + 4-joint fixture to publish all 9 formal Leads, while no-demand and occupied-partner fixtures publish none.
- The active provenance version is `sourcing-rules-v7.2.1-media-product-domain` for every new regular formal Lead and candidate-audit record.

## V7.2.1 Broad-Media Game-Product Domain

- IT之家、证券时报、澎湃新闻 carry `candidate_domain_gate: "game_product"`; game-vertical sources are unchanged.
- A marked broad-media item may enter candidate routing only with a normalized Steam/SteamDB/TapTap/indienova/好游快爆 identity or structured game ID, or with all three semantic elements: concrete project name, explicit game-product category, and a concrete Demo/试玩/实机/Playtest/测试/商店页/愿望单/版号/首曝/开发日志 event.
- `B站`、`官方`、`授权`、`发行`、`合作`、`需求`、`上线` alone or combined never satisfy the domain gate.
- Failure is `radar_only` with reason `non_game_broad_media`; the item stays available to Radar diversity but never enters strict, China-joint, expanded, rescue, enrichment, candidate audit, V7.3 second pass, or a formal Lead lane.
- Radar keeps its existing schema. The reason code is represented in classifier diagnostics and rendered as explicit non-game context in the Radar card text.
- Strict, expanded, and rescue routing is disjoint, so one deduped media item is converted and enriched at most once.

## PR 5 Steam Simplified-Chinese Review Audit Source

- Page through public Steam PC/Windows catalog results in the simplified-Chinese China storefront context; dedupe by AppID and record whether the reported catalog end was reached.
- Use the localized catalog review summary only to prefilter official lookups. It is never qualification evidence.
- Confirm positive, negative, and total review counts through the official `appreviews/<appid>` summary with `language=schinese` and `purchase_type=all`; calculate positive rate from the raw counts.
- Treat current Early Access as confirmed only when both the catalog EA tag and official AppDetails/store state say EA.
- Preserve every prefilter decision in `data/steam_review_opportunities/YYYY-MM-DD.json` under `schemas/steam_review_opportunities.schema.json` with no cap or truncation.
- Keep unknown official evidence `null`, mark bounded or failed collection `scan_complete=false`, and never synchronize this artifact to CRM.
- Run `node --test automations/test/steamReviewOpportunity*.test.mjs`; CI uses only fixed catalog/review/AppDetails fixtures and never calls live Steam.
- The full source, threshold, artifact, and validation contract is canonical in `docs/STEAM_REVIEW_OPPORTUNITY_SOURCE.md`; the separate V7.1 workflow/import contract is canonical in `docs/STEAM_REVIEW_OPPORTUNITY_DELIVERY.md`.

## V7.1 EA / Chinese Heat Independent Delivery

- The machine-readable rule source is `automations/rules/steam-review-opportunities.json`; the delivery entrypoint is `automations/jobs/steam_review_opportunity_delivery.mjs`.
- `.github/workflows/steam-review-opportunities.yml` contains only `schedule` and `workflow_dispatch`. The Daily workflow triggers and execution chain remain unchanged.
- Production collection is always an unbounded full-catalog scan. `scan_complete=false` prevents creation of any CRM import payload and prevents any CRM request.
- The first `backfill` run delivers every qualified AppID with `sourcing_run_type=initial_backfill`; no count limit or ranking cutoff exists.
- Later scheduled runs retain only new discoveries and AppIDs crossing a threshold for the first time. Suppression history advances only for a prior complete artifact whose path and `artifact_sha256` match a strict receipt with `status=success` and `sync_response.synced=true`; failed or unmatched artifacts remain eligible for retry.
- The final API boundary is `POST /api/leads/import-daily-report?mode=create-only`; existing Lead matches are skipped and must never be updated.
- This workflow sends Bearer authentication only from `CRM_AUTOMATION_TOKEN`; it never falls back to `CRM_ACCESS_TOKEN`. A missing automation token produces an explicit failed sync response and `status=sync_failed` receipt, then fails the run.
- Independent receipts under `data/steam_review_opportunity_runs/` record scan, qualification, prior-qualified suppression, import, dedupe, creation, update, and structured sync metrics.
- Success requires `scan_complete=true`, `status=success`, `sync_response.synced=true`, `updated_count=0`, and created-plus-deduplicated parity with the import candidate count.
- A manual `retry_from_slot` may reuse a committed complete artifact only when the named prior receipt proves `sync_failed`, `synced=false`, zero CRM writes, matching candidate counts, and an exact path plus `artifact_sha256` match. This path rebuilds the create-only payload without calling Steam or rerunning the source audit; all ordinary and scheduled executions remain full scans.
- Production Steam requests share a 2100ms scheduler, honor `Retry-After`, and retry 429 with bounded exponential backoff plus jitter. Required AppDetails HTTP-200 logical payload gaps use the same bounded retry policy. AppDetails is fetched only after official review evidence confirms the catalog-EA candidate still meets the locked 1,000-review and 80% positive-rate gates, making store-state confirmation decision-relevant; any still-missing required evidence keeps the scan incomplete.

## Source Health And Calibration

Each cloud run records fetch attempts, successes, failures, raw signals, retained signals, final Lead candidates, fallback use, and conversion rates per media source. Bilibili probe diagnostics separately record logical UP/keyword source health, request retries, rate-limit retries, and fallback-query use.

- Bilibili `412`/`429` and transient server responses use capped backoff instead of immediate source loss. Keyword sources may use an explicit configured fallback query after retries are exhausted.
- Request concurrency and inter-batch delay are configured in `automations/rules/bilibili-probe.json`; they must remain capped so one run does not amplify rate limiting.
- Sources that repeatedly fail from GitHub Actions are disabled explicitly with a reason instead of producing the same warning every day. `游戏茶馆` uses its reachable homepage; the unreachable `手游那点事`, legacy GamesBeat feed, and GitHub-egress-blocked `澎湃新闻` source stay disabled until a verified replacement exists.
- The historical 18-candidate target is removed. The V7.0 prelaunch gate enforces the 60-day/TBA window, while `release_window_health` continues recording domestic, overseas, and media near-launch samples for diagnosis.
