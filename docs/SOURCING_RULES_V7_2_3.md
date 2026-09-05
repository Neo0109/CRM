# Sourcing Rules V7.2.3 — Official Gameplay Content Value

Date: 2026-09-06

Active rule version: `sourcing-rules-v7.2.3-official-gameplay-value`

## Inherited admission and publication

This composite contract retains `docs/SOURCING_RULES_V7_2_2.md` including `near_pass_review`, the broad-media product-domain contract in `docs/SOURCING_RULES_V7_2_1.md`, and both strict lanes in V7.0/V7.2. Every hard gate is unchanged. Strict qualified Leads are deduped and published first without a minimum or maximum; review allows exactly one permitted soft gap and at most three Leads/day. The candidate audit is never an import payload. Publication count parity and CRM create-only dedupe remain required.

## Official gameplay fallback

Machine source: `automations/rules/daily-report.json#official_gameplay_content_value`.
Implementation: `automations/jobs/online_daily_v7_indie_admission.mjs#deriveOfficialGameplayChinaBilibiliValue({ appId, details })`.
Callers: Steam enrichment and media indie admission in the active Daily V4 path.

Only already-fetched official Steam AppDetails with `type=game` and an exact matching `steam_appid` may supply new evidence. Unbound IDs, demos, DLC, nonofficial recommendations, tags, captions and image attributes are not gameplay-body inputs. No network request is added. Keep existing explicit evidence and legacy value results; only a missing value may use this fallback. Explicit admission overrides still win.

Read `short_description` and `about_the_game`, normalize HTML/entities, discard scripts, quoted reviews, comparisons and negated gameplay paragraphs. Require concrete operation and gameplay outcome in a related paragraph. A safe short description or adjacent heading may supply genre context, but operations/outcomes cannot be assembled from unrelated paragraphs.

| Concrete evidence | Content opportunity |
| --- | --- |
| Co-op coordination that completes tasks or overcomes challenges | Group challenges and coordination guidance |
| Management/tower-defense operations that change production or defense | System explanations and efficiency/strategy reviews |
| Card choices/combinations that trigger combat effects | Build reviews and in-run decisions |
| Physics movement or object manipulation that traverses obstacles or solves puzzles | Routes, skill demonstrations and creative solutions |
| Combos, cancels or parries that generate energy or produce combat effects | Combo tutorials, Boss challenges and skill demonstrations |
| Survival/third-person shooting with weapon, resource or growth operations | Live challenges, resource decisions and combat guides |

A lone action/domestic/beautiful tag or a marketing claim is insufficient. The returned string describes a Bilibili content hook only; it does not establish fun, quality, market traction, China demand or cooperation intent. It populates the existing `chinaBilibiliValue` / `china_bilibili_value` fields and existing output copy. Lead/API/UI/database, reports and evidence-snapshot shapes are unchanged.

## Cache, compatibility and delivery

Existing candidate evidence snapshots keep the current seven-day TTL and naturally refresh. Do not flush or force-refresh old snapshots. V7.3 remains compatibility-only: no provider authority, budget, collector/replay schema or publication path is added. Daily workflow triggers remain schedule/workflow_dispatch only. Radar, search breadth, Bilibili official identity and cross-platform release inference are outside this change.

The frozen five-title fixture has English (production request language) and Simplified Chinese official inputs, source URLs and capture dates. Same-input before/after tests isolate the content-value change; synthetic full-admission negatives preserve playable/window/publisher/narrative/region/soft-gap boundaries. The fixtures are recognition evidence, not a decision that all five qualify or should be imported.

Technical acceptance: focused tests, Daily V4, verify:all, types/contracts/diff checks and unchanged V7.3 authority. Delivery evidence lives in `docs/checkpoints/pr-v723-official-gameplay-value.md`.

Business acceptance remains pending: after relevant caches naturally renew, observe seven consecutive natural daily artifacts and receipts with both `status=success` and `sync_response.synced=true`; distinguish newly published Leads, CRM dedupe skips, and worthwhile first-screen outcomes. The 5–10 additional worthwhile Leads/week target is aspirational, never a quota. If insufficient, diagnose again without automatically relaxing admission.
