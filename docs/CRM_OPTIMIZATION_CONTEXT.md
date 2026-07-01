# CRM Optimization Context

Date: 2026-05-28

This document is a handoff note for future CRM optimization conversations. It preserves the context from daily-report automation debugging, online sourcing-rule cleanup, the v1.8 funnel workflow change, the v1.8.1 sync-state protection fix, the v1.8.2 automation sync-receipt update, and the v1.8.3 weekly evaluation report update.

## Current Repository

- GitHub repository: `Neo0109/CRM`
- Production CRM domain used by automation: `https://crm-pages.pages.dev`
- Daily automation workflow: `.github/workflows/sync-daily-report.yml`
- Current generator: `automations/jobs/online_daily_v4.mjs`
- Rule guard runner: `automations/jobs/online_daily_runner.mjs`
- Human current rules: `docs/SOURCING_RULES_CURRENT.md`
- Canonical V6/V6.1 rules: `docs/SOURCING_RULES_V6.md`
- Machine-readable rules: `automations/rules/daily-report.json`
- Current product version after the latest product iteration: `v2.5`

## Automation Status On 2026-05-28

The user reported that the afternoon automated report did not appear in CRM.

What was verified from GitHub:

- Today's canonical generated files exist on `main`:
  - `data/reports/2026-05-28.json`
  - `data/radar/2026-05-28.json`
  - `data/steam_trends/2026-05-28.json`
- GitHub contains multiple generated commits for today's report:
  - `45bccb3325cf35fce36c8ba418423989768aeb78` at 2026-05-28 11:08 Asia/Shanghai
  - `c89ac38a7fbf6f50c8e295273ec6f7ab1cb49533` at 2026-05-28 13:49 Asia/Shanghai
  - `f866b18460ae3dd272ebf976803ea41afb0efec3` at 2026-05-28 18:09 Asia/Shanghai
- The workflow schedule is correctly expressed in UTC:
  - `30 1 * * *` = 09:30 Asia/Shanghai
  - `0 6 * * *` = 14:00 Asia/Shanghai
- The sync endpoint is unauthenticated by design and calls `syncReportFromRepository(env, reportDate)`.
- Sync reads the canonical raw GitHub file `data/reports/YYYY-MM-DD.json` and imports it into Supabase.

Current diagnosis:

- Generation was not completely absent. The generated data files and later generated commits exist.
- The product currently writes both morning and afternoon runs to the same canonical daily files. The CRM therefore shows the latest daily state, not separate morning/afternoon report cards.
- Before v1.8.2, there was no persistent run receipt after the CRM sync step. If sync failed after committing data, the repo still had generated data but no easy durable proof of the sync response.

v1.8.2 fix:

- The workflow now resolves a run slot: `morning`, `afternoon`, `manual`, or a custom dispatch slot.
- After sync, it writes a durable receipt under `data/automation_runs/YYYY-MM-DD-slot.json`.
- The receipt includes status, retry count, trigger type, schedule, GitHub run URL, generated-change flag, timestamp, and CRM sync response.
- If CRM sync does not return `"synced": true`, the workflow records the receipt and then fails the run.

Version records:

- `docs/releases/v1.8.2-automation-sync-receipts.md`

## Sourcing Rules V6.3 Iteration

The latest sourcing-logic iteration is `sourcing-rules-v6.3`, focused on official-source verification, structured link extraction, decision-grade field hygiene, automation stability, and clean low-volume backfill while preserving the V6 low-volume fix.

V6.3 intent:

- Bilibili video leads must be enriched from video descriptions before candidate creation.
- Recommendation-UP videos are discovery signals only; official/developer/studio/publisher sources should be preferred before final candidate creation.
- Steam links/AppIDs found in Bilibili or media descriptions must be used for release-state cross-checks.
- Already fully released products must not enter push/watch review candidates; use drop/background unless a post-launch review is explicitly requested.
- Existing CRM projects, Steam AppIDs, source URLs, and normalized lead keys must be used for dedupe, so a Bilibili video does not recreate a product already sourced from Steam.
- Bilibili video leads must be timely. Old videos/news only become leads when they contain a current playable build, demo, update, publishing window, or business event.
- `priority_reason`, `rule_fit`, `gameplay`, and `progress` must stay concise and decision-grade; `next_action` and `notes` stay empty by default for human BD input.
- Low volume, Steam 429, or a single media/Bilibili source failure should produce diagnostics and a low-volume valid report when effective candidates still exist; only schema, file write, or CRM sync authentication/write errors should fail the workflow.
- Low-volume backfill must not write automation bookkeeping, rule labels, candidate counts, or fallback diagnostics into visible lead fields.
- GitHub Actions and Cloudflare sync paths should prefer `CRM_AUTOMATION_TOKEN`, with `CRM_ACCESS_TOKEN` only as a compatibility fallback where supported.
- Rules, automation, and product features remain separate modules; a sourcing-rule iteration must not change login, UI, schema, or other product behavior.

## Sourcing Rules V6.2 Iteration

The previous sourcing-logic iteration was `sourcing-rules-v6.2`, focused on official-source verification, structured link extraction, decision-grade field hygiene, and automation stability while preserving the V6 low-volume fix.

## Sourcing Rules V6.1 Iteration

The previous sourcing-logic iteration was `sourcing-rules-v6.1`, focused on tightening Bilibili/media verification while preserving the V6 low-volume fix.

## Sourcing Rules V6 Iteration

The previous sourcing-logic iteration was `sourcing-rules-v6`, focused on fixing low daily sourcing volume while keeping Steam Trends as a real Steam market board and preserving domestic-first BD probability.

V6 intent:

- Domestic products are the sourcing default because cooperation, efficiency, visual/cultural fit, and signing probability are materially better.
- Domestic developer Demo/test signals are promoted.
- Overseas products only consume review slots when there is PC hit validation and a credible mobile-adaptation angle.
- The old 60-day window is not the only useful window; domestic early-stage projects can be reviewed over a longer horizon.
- Domestic source coverage expands through Chinese game media, Bilibili video/search signals, indienova, developer communities, and official studio posts.
- Steam Trends must cover category risers, Demo/Next Fest or other Steam windows, publisher/developer slate signals, public data quality, and BD actions. It must not display internal sourcing-rule notes as market insights.
- A daily report with one or two usable non-dropped leads is considered a failed automation run when Steam/media/Bilibili sources are healthy.
- Domestic media and Bilibili extraction now has a strict pass plus an expanded pass, so concrete non-Steam product moments can enter `未处理` for first-pass review.
- Steam outages or partial AppDetails failures should be visible in the report and should fall back to domestic media/Bilibili review candidates instead of producing a token queue.
- Expanded Bilibili sourcing must filter stale videos, generic recommendation collections, mature blockbuster chatter, rant/review filler, and other non-actionable content.

## Sourcing Rules V5 Iteration

The previous sourcing-logic iteration was `sourcing-rules-v5`, focused on keeping Steam Trends as a real Steam market board while preserving domestic-first BD probability.

## Sourcing Rules V4 Iteration

The previous sourcing-logic iteration was `sourcing-rules-v4`, focused on domestic-first BD probability.

## Sourcing Rules V3 Iteration

The previous sourcing-logic iteration was `sourcing-rules-v3`, committed as `Add Sourcing Rules V3 automation` on 2026-05-27 22:38:52 Asia/Shanghai.

V3 intent:

- The daily report reader is the Bilibili game publishing BD owner.
- Outputs must reduce BD judgment cost.
- Steam Trends should be BD decision cards, not generic trend summaries.
- Industry Radar must use real external signals, not internal CRM automation notes.
- User-provided news examples are calibration examples, not hard-coded daily answers.
- Push pool can be empty.
- Near-launch, PC Early Access, narrative-first, India-led, mature-publisher-occupied, or weak overseas projects should not consume push-pool time.

## Online Rule Source Cleanup

Rules should live online because the operator switches computers. Do not rely on local-only state.

The cleanup added:

- `docs/SOURCING_RULES_CURRENT.md` as the human current-rule pointer.
- `automations/rules/daily-report.json` as the machine-readable rule source.
- `automations/jobs/online_daily_runner.mjs` as a fail-fast rule guard before the existing generator.
- Workflow path filters include rule files so rule-only changes exercise the automation.

Known remaining cleanup:

- `online_daily_v4.mjs` still contains hard-coded generator logic while executing the current rule version.
- Future work should gradually move thresholds, source weights, radar categories, exclusion guardrails, and scoring knobs into `automations/rules/daily-report.json`.

## CRM Product Logic V1.8

The CRM funnel was changed from mixed automatic buckets to an explicit human review workflow:

- Qualified sourced leads enter `未处理` first.
- `未处理` quick actions: `待评测`, `观察池`, `淘汰`.
- `待评测` quick actions: `测试中`, `淘汰`.
- `测试中` quick actions: `跟进`, `观望`, `淘汰`.
- `观察池` quick actions: `待评测`, `跟进中`, `淘汰`.
- `淘汰池` quick actions: `观望`, `待评测`.

Important implementation points:

- Backend `Bucket` includes `待评测` and `测试中`.
- `leadsFromReport` maps report `push_pool` and `watch_pool` into CRM `未处理` + `review_status: 未处理` so automation never pre-assigns a human workflow bucket.
- `drop_pool` imports directly into `淘汰池`.
- Priority color is derived from `priority`: P0/P1 = high/green, P2 = medium/yellow, P3 = low/red.
- Moving a lead to `测试中` sets a default two-week due date and enables calendar visibility.
- A testing lead past due date shows an overdue warning marker.
- Detail-panel Due Date reminders only go to the calendar after explicit confirmation.

Version record: `docs/releases/v1.8.0-funnel-workflow.md`.

## CRM Product Logic V1.8.1

This follow-up fixes the rollback behavior the user noticed after iterations or refreshes.

Important implementation points:

- Existing leads keep human workflow fields during sync: `bucket`, `stage`, `priority`, `owner`, `due_date`, `calendar_enabled`, `follow_up_interval`, `review_status`, `reviewed_at`, and `next_action`.
- Daily automation may still enrich an existing lead with merged contacts, links, notes, and newly discovered context.
- Backend bucket ordering now places `观察池` before `跟进中`.
- Frontend dashboard and bucket filter visually place `观察池` before `跟进中`.
- Header version reads `Neo's BD Matrix · v1.8.1` until a visible UI version bump is made.

Version record: `docs/releases/v1.8.1-sync-state-and-tab-order.md`.

## CRM Product Logic V1.8.3

Weekly reporting now follows the explicit review funnel rather than the old push/watch/drop-only mental model.

Important implementation points:

- Leads have structured evaluation fields: `evaluation_grade`, `evaluation_result`, and `evaluated_at`.
- Evaluation grade options are `S`, `A+`, `A`, `A-`, `B+`, `B`, `B-`, `C+`, `C`, `C-`.
- The Leads Review detail panel has a dedicated `评测结果` section for product test notes and grade.
- Weekly report stats include this week's sourced count, submitted-for-test count, entered-follow-up count, current active follow-up count, and dropped count.
- Weekly follow-up cards should include a short product summary and prefer the structured evaluation result when it exists.

Version record: `docs/releases/v1.8.3-weekly-evaluation-report.md`.

## Principle For Future Changes

When daily report rules change, update the rule source and online automation together. A rules iteration must not silently break scheduled generation.

For product-flow changes, keep automation broad and keep human decisions explicit. Do not let daily automation automatically promote leads into downstream human workflow buckets unless the user explicitly asks for that behavior.

Most importantly, for existing leads, automation should enrich rather than reroute. Bucket and review-state decisions are human state and should be preserved unless the user explicitly changes them in the CRM.

For automation debugging, inspect generated daily files first, then inspect `data/automation_runs/YYYY-MM-DD-slot.json` receipts. Generated files prove the report step ran; receipts prove whether the CRM sync endpoint confirmed `synced=true`.

## Detail Panel Decision Cleanup

The Leads Review right detail panel should be a BD decision workspace, not an automation-log dump.

Important implementation points:

- Keep `评测结果` as the primary human judgment area: grade, one-line evaluation result, and optional next action.
- Keep the evidence panel read-only and compact so it supports judgment without overwhelming it.
- Keep `联系方式` and `产品与发行` structured; do not paste Steam links, Bilibili descriptions, or source traces into long gameplay or notes fields.
- Hide low-signal automation fields from the default right panel: `rule_fit`, `amplification`, `exposure_trail`, `public_signals`, raw `links`, rule-exclusion checkboxes, and standalone `verdict`.
- Preserve the underlying fields for compatibility; do not delete schema fields or erase historical data.
- New sourcing fields should keep `priority_reason` focused on BD-useful reasons such as gameplay strength, revenue upside, market heat, Bilibili amplification, and signing probability.

## Sourcing Learning Loop V1

The CRM now records human BD decisions as a sourcing-learning dataset. This is analysis support, not an automated rule writer.

Important implementation points:

- Active learning cohort includes current leads in `未处理`, `待评测`, `测试中`, `观察池`, `跟进中`, and `推进池`.
- Historical leads already in `淘汰池` are not backfilled; future manual actions on a lead can still create new events.
- Manual saves create `__crm_decision_event__...` system rows only when tracked decision fields change: bucket/stage/status, priority, evaluation grade/result/time, drop reason, owner, due date, or next action.
- Notes-only edits do not create learning events.
- The right detail panel includes `淘汰原因（若淘汰）` to keep rejection learning from becoming guesswork.
- Diagnostics expose `Sourcing 学习` with funnel, outcomes, rating distribution, and drop reasons.
- Fewer than 30 resolved positive/negative samples should be treated as sample accumulation, not a stable sourcing-weight conclusion.

Version record: `docs/releases/sourcing-learning-v1.md`.

## Codex Cloud 工作说明

本项目当前以 `Neo0109/CRM` 仓库和 `main` 分支作为 Codex Cloud 的云端工作源。后续云端任务应默认从该来源继续，保持自动日报规则、产品功能迭代和 UI 迭代分开处理，并在完成修改后通过 PR 合并，避免直接修改 `main`。
