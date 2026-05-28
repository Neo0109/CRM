# CRM Optimization Context

Date: 2026-05-28

This document is a handoff note for future CRM optimization conversations. It preserves the context from the daily-report automation debugging and rule-online-source cleanup.

## Current Repository

- GitHub repository: `Neo0109/CRM`
- Production CRM domain used by automation: `https://crm-pages.pages.dev`
- Daily automation workflow: `.github/workflows/sync-daily-report.yml`
- Current generator: `automations/jobs/online_daily_v4.mjs`
- Rule guard runner: `automations/jobs/online_daily_runner.mjs`
- Human current rules: `docs/SOURCING_RULES_CURRENT.md`
- Canonical V3 rules: `docs/SOURCING_RULES_V3.md`
- Machine-readable rules: `automations/rules/daily-report.json`

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

The latest logic iteration was `sourcing-rules-v3`, committed as `Add Sourcing Rules V3 automation` on 2026-05-27 22:38:52 Asia/Shanghai.

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

## Principle For Future Changes

When daily report rules change, update the rule source and online automation together. A rules iteration must not silently break scheduled generation.
