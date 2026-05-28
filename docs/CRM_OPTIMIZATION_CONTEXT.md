# CRM Optimization Context

Date: 2026-05-28

This document is a handoff note for future CRM optimization conversations. It preserves the context from daily-report automation debugging, online sourcing-rule cleanup, the v1.8 funnel workflow change, and the v1.8.1 sync-state protection fix.

## Current Repository

- GitHub repository: `Neo0109/CRM`
- Production CRM domain used by automation: `https://crm-pages.pages.dev`
- Daily automation workflow: `.github/workflows/sync-daily-report.yml`
- Current generator: `automations/jobs/online_daily_v4.mjs`
- Rule guard runner: `automations/jobs/online_daily_runner.mjs`
- Human current rules: `docs/SOURCING_RULES_CURRENT.md`
- Canonical V3 rules: `docs/SOURCING_RULES_V3.md`
- Machine-readable rules: `automations/rules/daily-report.json`
- Current product version after the latest workflow fix: `v1.8.1`

## What Happened

On 2026-05-28, the morning automated daily report did not appear.

Observed from GitHub:

- The latest generated automation commit was for `2026-05-27`.
- No `Generate 2026-05-28 online CRM automation` commit existed when checked.
- These files were missing:
  - `data/reports/2026-05-28.json`
  - `data/radar/2026-05-28.json`
  - `data/steam_trends/2026-05-28.json`

The failure therefore happened before Cloudflare CRM sync could import the report. Cloudflare sync reads the generated GitHub raw report file; it cannot generate the report by itself.

## Sourcing Rules V3 Iteration

The latest sourcing-logic iteration is `sourcing-rules-v3`, committed as `Add Sourcing Rules V3 automation` on 2026-05-27 22:38:52 Asia/Shanghai.

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
- Workflow path filters should include rule files so rule-only changes exercise the automation.

Known remaining cleanup:

- `online_daily_v4.mjs` still contains hard-coded V3 logic.
- Future work should gradually move thresholds, source weights, radar categories, exclusion guardrails, and scoring knobs into `automations/rules/daily-report.json`.

## CRM Product Logic V1.8

The CRM funnel was changed from mixed automatic buckets to an explicit human review workflow:

- Qualified sourced leads enter `未处理` first.
- `未处理` quick actions: `待评测`, `淘汰`.
- `待评测` quick action: `测试中`.
- `测试中` quick actions: `跟进`, `观望`, `淘汰`.
- `观察池` quick actions: `待评测`, `跟进中`, `淘汰`.
- `淘汰池` quick actions: `观望`, `待评测`.

Important implementation points:

- Backend `Bucket` includes `待评测` and `测试中`.
- `leadsFromReport` maps report `push_pool` and `watch_pool` into CRM `观察池` + `review_status: 未处理` so automation does not bypass human review.
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
- Header version now reads `Neo's BD Matrix · v1.8.1`.

Version record: `docs/releases/v1.8.1-sync-state-and-tab-order.md`.

## Principle For Future Changes

When daily report rules change, update the rule source and online automation together. A rules iteration must not silently break scheduled generation.

For product-flow changes, keep automation broad and keep human decisions explicit. Do not let daily automation automatically promote leads into downstream human workflow buckets unless the user explicitly asks for that behavior.

Most importantly, for existing leads, automation should enrich rather than reroute. Bucket and review-state decisions are human state and should be preserved unless the user explicitly changes them in the CRM.
