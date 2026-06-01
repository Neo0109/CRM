# Cloud Automation Runbook

Date: 2026-06-01

## Operating Principle

Production daily reports must run in cloud workflows. Local Codex automations on a Mac or Windows machine are not allowed to generate, commit, push, or sync production daily reports unless the owner explicitly re-enables them for emergency diagnostics.

This keeps daily sourcing stable across different computers and prevents local network, permission, or sandbox differences from breaking production data.

## Daily Report Ownership

Cloud-owned files:

- `data/reports/YYYY-MM-DD.json`
- `data/radar/YYYY-MM-DD.json`
- `data/steam_trends/YYYY-MM-DD.json`
- `data/automation_runs/YYYY-MM-DD-*.json`

The source of truth is GitHub `main`. Cloudflare Pages and Supabase sync from that source.

## Structure Contract

Daily report structure is a product contract. Rule versions may change sourcing strategy, scoring, wording, and source coverage, but must not casually change the report shape.

Contract guard:

```bash
node scripts/validate-daily-contract.mjs --date=YYYY-MM-DD
```

The contract checks:

- Report, radar, and Steam trends files exist for the same date.
- JSON follows the repository schemas closely enough for runtime use.
- Non-dropped daily leads enter `bucket = 未处理` and `stage = new`.
- Dropped leads enter `bucket = 淘汰池` and `stage = rejected`.
- Leads are deduped across pools.
- Leads include at least one verification link.
- Steam store and SteamDB URLs stay in `links`, not `contact_methods`.
- Industry Radar does not put internal automation/rule notes under `行业新闻`.
- Industry Radar uses `今日亮点` for concrete games, recommendations, fun products, IP/company/legal gossip, and former `发行八卦` items. `行业新闻` is reserved for macro market/platform/regulatory/company-level news.
- Industry Radar and Steam Trends must both have enough items; a network-failed run that writes empty Steam trends is invalid.

`automations/jobs/online_daily_runner.mjs` runs this contract automatically after generation, so the cloud job fails before committing broken structure.

## Watchdog

Watchdog command:

```bash
node scripts/daily-report-watchdog.mjs --date=YYYY-MM-DD
```

The watchdog checks:

- Required files exist.
- A successful sync receipt exists.
- Candidate counts are above the minimum useful threshold.
- Radar and Steam Trends are above the minimum useful thresholds.

If unhealthy, it returns `needs_run = true` with reasons.

The intended cloud workflow is `.github/workflows/daily-report-watchdog.yml`, which checks after the morning and afternoon report windows and regenerates/syncs if the day is missing or too weak.

## Codex Task Policy

Feature development should use Codex Cloud against `Neo0109/CRM`:

1. Start a Codex task from the GitHub repository entry.
2. Use `Neo0109/CRM` and the desired base branch, normally `main`.
3. Let Codex create a `codex/...` branch and PR.
4. Review Cloudflare Preview.
5. Merge to `main` after acceptance.

Local Codex should be used for UI inspection, screenshots, emergency diagnostics, or explicit local-only tasks.
