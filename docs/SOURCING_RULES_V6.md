# Sourcing Rules V6

Date: 2026-06-02

Active supplement: `sourcing-rules-v6.1`, updated 2026-06-03.

## One-Line Standard

The daily report must create a practical BD review queue, not a token list. Steam, domestic media, Bilibili, TapTap-style pages, indienova, official posts, and credible game-media links are all valid first-pass discovery sources.

## What Changed From V5

V6 keeps the domestic-first, testing-first workflow from V5, and fixes the low-volume failure mode:

- Steam is no longer allowed to dominate daily sourcing volume.
- Domestic media and Bilibili product signals get a strict pass plus an expanded pass.
- Expanded candidates may enter `未处理` when they clearly point to a concrete game/product moment, even if the project name still needs manual cleanup.
- If Steam search or AppDetails is unavailable, the report must transparently fall back to domestic media/Bilibili review candidates instead of collapsing to one or two leads.
- If Steam and media sources are healthy but the strong/normal review pool is just below the floor, domestic candidates with concrete playable/product signals may be backfilled into `未处理` as low-confidence first-pass review items.
- The generator must fail fast when push/watch review candidates are below the configured minimum.
- The generator must fail fast when domestic media/Bilibili signals are healthy but too few become lead candidates.

## Lead Volume Standard

Small push pools are acceptable; a tiny daily review queue is not.

The automation should produce enough `push_pool + watch_pool` candidates for a real BD review session when upstream sources are healthy. A day with one or two non-dropped leads is considered a bad automation run, not a useful report.

Default cloud thresholds:

- Minimum review candidates: `18`
- Minimum media/Bilibili lead candidates when domestic signals are healthy: `10`
- Steam scan budget: `260` candidates
- Steam AppDetails enrichment budget: `90` candidates
- Low-confidence domestic review backfill score: `18`

If these thresholds cannot be met, the workflow should fail rather than silently overwrite the day's report with low-signal output.

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
- Treat `Demo 已上线`, `试玩上线`, `测试开启`, or `商店页已上线` as review/test signals, not full release signals.
- Deduplicate against existing CRM project names, loose Chinese project keys, Steam AppIDs, source URLs, and backend dedupe keys.
- Apply timeliness. Old videos or old news should not create fresh leads unless they contain a current playable build, new demo, update, publishing window, or business-relevant event.

Examples:

- A Bilibili discovery such as "浣熊推币机" is useful, but if the enriched Steam cross-check shows the game is already fully released, it should be dropped or used as market background.
- If a Bilibili video points to a project that was previously sourced from Steam, such as "极简塔防", the new video should enrich existing context or be ignored instead of creating a duplicate.
- Old-news examples such as "纪元117:多玛和平" should be filtered unless there is a current, actionable product event.

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

## Industry Radar

Industry Radar remains a compact China + overseas news board.

`行业新闻` is for macro or large-scope industry events. Concrete games, IP moments, recommended/fun products, publisher gossip, legal/company anecdotes, and former "发行八卦" items belong in `今日亮点`.

## Guardrails

- Daily generation must log Steam scan volume, enriched Steam volume, media signal count, media/Bilibili lead count, and configured volume thresholds.
- Rules-only changes must live in GitHub and trigger the cloud workflow.
- Rule JSON, runner version guard, generator behavior, and workflow thresholds must be updated together.
- The automation should fail loudly before syncing if sources are healthy but candidate volume is too low.
- Bilibili/media expansion must increase useful discovery volume, not pad the report with stale videos, generic collections, or already-mature titles.
- Bilibili/media candidates must pass the V6.1 verification gate before becoming fresh `未处理` leads.
