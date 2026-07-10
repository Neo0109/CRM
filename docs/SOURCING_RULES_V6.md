# Sourcing Rules V6

Date: 2026-07-05

Active supplement: `sourcing-rules-v6.5-window-hygiene`, updated 2026-07-08.

## One-Line Standard

The daily report must create a practical BD review queue, not a token list. Steam, domestic media, Bilibili, TapTap-style pages, indienova, official posts, and credible game-media links are all valid first-pass discovery sources.

## What Changed From V5

V6 keeps the domestic-first, testing-first workflow from V5, and fixes the low-volume failure mode:

- Steam is no longer allowed to dominate daily sourcing volume.
- Domestic media and Bilibili product signals get a strict pass plus an expanded pass.
- Expanded candidates may enter `未处理` when they clearly point to a concrete game/product moment, even if the project name still needs manual cleanup.
- If Steam search or AppDetails is unavailable, the report must transparently fall back to domestic media/Bilibili review candidates instead of collapsing to one or two leads.
- If Steam and media sources are healthy but the strong/normal review pool is just below the floor, domestic candidates with concrete playable/product signals may be backfilled into `未处理` as low-confidence first-pass review items.
- Low review volume must trigger fallback attempts and degraded diagnostics, but must not block otherwise valid report, radar, Steam trends, or CRM sync output.
- Domestic media/Bilibili under-conversion must be logged with source and filter diagnostics instead of silently collapsing to Steam-only output.

## Lead Volume Standard

Small push pools and low-volume days are acceptable when they are clearly marked degraded and the output contracts remain valid.

The automation should target enough `push_pool + watch_pool` candidates for a real BD review session when upstream sources are healthy. A day with one or two non-dropped leads is degraded and should trigger diagnostics, while still preserving valid daily, radar, and Steam trend output.

Default cloud thresholds:

- Target review candidates: `18`
- Minimum media/Bilibili lead candidates when domestic signals are healthy: `10`
- Steam scan budget: `260` candidates
- Steam AppDetails enrichment budget: `90` candidates
- Low-confidence domestic review backfill score: `18`

If these targets cannot be met after fallback/backfill, the workflow publishes with degraded diagnostics. It still fails for empty source output, schema damage, file write failure, or CRM sync authentication/write failure. The online receipt should preserve enough diagnostics to distinguish sourcing rules, upstream source failures, over-deduplication, and media/Bilibili conversion.

Backfill is not permission to pad the report. It can only use domestic or Chinese-context candidates that still have a concrete source, playable/product signal, or domestic discovery query. Backfilled leads still enter `未处理`, never `观察池`/`待评测`/`跟进中`, and the first action is quick product judgment: inspect/test, then either promote manually or淘汰.

## Domestic Media And Bilibili

Domestic products are the default sourcing priority because cooperation, response efficiency, visual/cultural fit, creator communication, and signing probability are materially better.

Concrete domestic media or Bilibili product signals should enter the daily lead candidate pools when they include a named game or a concrete product moment such as:

- first reveal, PV, trailer, gameplay footage, Demo, playtest, public test, store page, reservation, edition approval, developer post, official site, TapTap/indienova page, or Bilibili video.

The first-pass lead does not require a Steam AppID. Original articles, Bilibili videos, TapTap pages, indienova posts, official pages, or developer posts are valid verification links.

Expanded candidates are allowed, but obvious non-products are still excluded: tutorials, Steam Next Fest signup guides, wishlist-growth lessons, courses, generic developer-experience videos, recruitment posts, financial reports, discount/deal posts, hardware news, cosplay/wallpaper, maintenance notices, old Bilibili search results, mature/irrelevant blockbuster chatter, generic recommendation collections, rant/review videos, and generic ranking filler.

### V6.1 Bilibili Verification Gate

Bilibili video leads are discovery signals, not proof that a project is new, unreleased, or still actionable.

Before creating a CRM candidate from a Bilibili/media signal, the automation must:

- Enrich the Bilibili video metadata and description when possible.
- Extract Steam store links, Steam AppIDs, official sites, TapTap/indienova pages, Discord, email, Bilibili, or other real contact clues from the description.
- Cross-check Steam release state when a Steam URL/AppID is present. Fully released products must not enter `push_pool` or `watch_pool`; route them to `drop_pool` or keep them as market background.
- Cross-check Steam launch window when a Steam URL/AppID is present. Fresh candidates launching in fewer than 60 days must not enter `push_pool` or `watch_pool`; route them to `drop_pool` with `drop_reason = 窗口不合适` or keep them as market background.
- Treat `Demo 已上线`, `试玩上线`, `测试开启`, or `商店页已上线` as review/test signals, not full release signals.
- Deduplicate against existing CRM project names, loose Chinese project keys, Steam AppIDs, source URLs, and backend dedupe keys.
- Apply timeliness. Old videos or old news should not create fresh leads unless they contain a current playable build, new demo, update, publishing window, or business-relevant event.

Examples:

- A Bilibili discovery such as "浣熊推币机" is useful, but if the enriched Steam cross-check shows the game is already fully released, it should be dropped or used as market background.
- If a Bilibili video points to a project that was previously sourced from Steam, such as "极简塔防", the new video should enrich existing context or be ignored instead of creating a duplicate.
- Old-news examples such as "纪元117:多玛和平" should be filtered unless there is a current, actionable product event.

### V6.2 Official Source And Field Hygiene

Recommendation-UP videos are useful discovery signals, but official/developer/studio/publisher sources are preferred before the lead is created. If official enrichment adds a Steam AppID, the candidate must be deduped again and cross-checked for release state before entering the final review pools.

Structured link extraction is mandatory. Steam, SteamDB, TapTap, official-site, Discord, email, and other useful links must be written into `links` or `contact_methods`; they must not remain buried in `gameplay`, `progress`, `priority_reason`, `rule_fit`, or notes.

Generated fields must be decision-grade:

- `priority_reason`: why this deserves this priority.
- `rule_fit`: why it fits or fails the current sourcing rule.
- `gameplay`: compact tags such as `Card/Deckbuilder`, `RPG`, `Strategy`, `Simulation`.
- `progress`: short state such as `试玩 Demo`, `EA`, `即将发售`, `正式上线`.
- `next_action` and `notes`: empty by default unless there is genuinely important evidence.

### V6.3 Backfill Hygiene And Automation Token Guard

V6.3 keeps the V6.2 source-quality rules and fixes two stability problems:

- Low-volume backfill can keep the daily review queue useful, but it must never expose automation bookkeeping to BD users. Do not write `V6`, fallback reasons, candidate counts, or sync diagnostics into `notes`, `next_action`, `verdict`, `priority_reason`, or `rule_fit`.
- Backfilled leads still enter `未处理` only and should be framed as clean BD questions: gameplay strength, income upside, market heat, Bilibili amplification, team/region fit, and signing probability.
- GitHub Actions and Cloudflare sync flows should prefer `CRM_AUTOMATION_TOKEN`; use `CRM_ACCESS_TOKEN` only as a backwards-compatible fallback when the workflow explicitly supports it.
- Product version, sourcing-rule version, and workflow health are separate. Rules can iterate without changing product UI version, login, schema, or manual review behavior.

### V6.4 Bilibili Probe

V6.4 adds a configurable Bilibili sourcing probe while preserving the existing daily report output shape and CRM review workflow.

- Probe sources can include configured official, developer, publisher, media, trusted creator, and keyword searches.
- Probe candidates must fetch video details before scoring so descriptions, tags, owners, public engagement, Steam links, SteamDB links, official sites, and contact clues can be extracted.
- Blacklisted UID/BVID/keywords, stale videos, generic recommendation collections, and non-official videos without required product-window keywords are filtered before candidate creation.
- When duplicate Bilibili signals point to the same BVID, source link, or Steam AppID, official/developer/publisher signals beat trusted creator or keyword signals.
- Probe diagnostics belong in automation summaries and health checks, not in user-facing lead fields.

### V6.5 Window Hygiene

V6.5 keeps V6.4's Bilibili probe, then tightens the review gate around BD usefulness:

- Demo, playtest, and store-page-live signals prove that a product can be inspected; they do not prove there is still a useful cooperation window.
- New automation-sourced candidates with confirmed launch dates fewer than 60 days away must not enter `push_pool` or `watch_pool`.
- Near-launch candidates should be dropped with `drop_reason = 窗口不合适` or kept as market background unless a human-owned CRM workflow already exists.
- Human-owned fields stay empty by default: `priority_reason`, `next_action`, and `notes` should not carry automation bookkeeping.

## Workflow

Automatic daily reports are discovery, not final human review.

- Non-dropped generated leads enter `bucket = 未处理`, `stage = new`, `review_status = 未处理`.
- Dropped leads enter `bucket = 淘汰池`, `stage = rejected`.
- Automation may rank candidates as strong-signal or ordinary review candidates, but the human reviewer decides whether something becomes `观察池`, `待评测`, `跟进中`, or `推进池`.
- The first useful action is to test or inspect the game. Contact completion and long-form evidence happen only after product judgment passes.

## Steam Trends

Steam Trends remains a Steam market board, not a sourcing-rule mirror.

It should cover category risers, Demo/Next Fest or other Steam windows, publisher/developer slate signals, public data quality, representative samples, and concrete Bilibili BD implications.

When Steam is partially or fully unavailable, the board should say so plainly and fill representative samples from the same day's domestic review candidates. The fallback is for continuity, not a claim that those products are Steam trend leaders.

Steam fetch reliability requirements:

- Steam search should run with capped concurrency instead of firing every query at once.
- Steam AppDetails enrichment should be rate-limited and capped; the daily report needs enough high-signal details for review, not hundreds of detail calls.
- If Node fetch fails on Steam with DNS/TLS/network errors, use the curl fallback before treating Steam as unavailable.
- Do not retry curl fallback for Steam `403`/`429`; those are access/rate-limit signals and should be handled by lower request volume and backoff.

Media and Bilibili source-health requirements:

- Record per-source fetch success, retained-signal rate, and final Lead conversion so a large raw funnel cannot hide a broken source mix.
- Retry Bilibili `412`/`429` with capped backoff and lower concurrency; use only configured fallback queries after the primary query exhausts retries.
- Disable or replace persistently blocked sources explicitly in the machine-readable rule file instead of accepting repeated daily failures as normal noise.
- Record near-launch samples by region before changing the 60-day rule. Candidate targets and window policy must be calibrated from successful cloud runs, not promoted into hard publication gates without a historical baseline.

## Industry Radar

Industry Radar remains a compact China + overseas news board.

`行业新闻` is for macro or large-scope industry events. Concrete games, IP moments, recommended/fun products, publisher gossip, legal/company anecdotes, and former "发行八卦" items belong in `今日亮点`.

## Guardrails

- Daily generation must log Steam scan volume, enriched Steam volume, media signal count, media/Bilibili lead count, and configured volume thresholds.
- Rules-only changes must live in GitHub and trigger the cloud workflow.
- Rule JSON, runner version guard, generator behavior, and workflow thresholds must be updated together.
- Low candidate volume should trigger fallback and logged diagnostics; it should not fail a scheduled run when valid candidates remain.
- Bilibili/media expansion must increase useful discovery volume, not pad the report with stale videos, generic collections, or already-mature titles.
- Bilibili/media candidates must pass the V6.1/V6.2/V6.3/V6.4/V6.5 verification gate before becoming fresh `未处理` leads.
- Hard failures remain hard: schema breakage, generated file write failure, and CRM sync authentication/write failure should fail the workflow.
