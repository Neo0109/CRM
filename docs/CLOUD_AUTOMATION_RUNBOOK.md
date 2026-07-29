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
- `data/sourcing_candidates/YYYY-MM-DD.json`
- `data/automation_runs/YYYY-MM-DD-*.json`

The source of truth is GitHub `main`. Cloudflare Pages and Supabase sync from that source.

The primary daily report workflow must be independent from product/UI iteration:

- `.github/workflows/sync-daily-report.yml` may only use `schedule` and `workflow_dispatch`.
- Product feature, auth, UI, or documentation pushes must not trigger production daily report generation.
- `.github/workflows/daily-report-watchdog.yml` is the GitHub-hosted self-healing layer and may run repeatedly during the workday; it should do nothing when the day is already healthy.
- `cloudflare/daily-report-heartbeat/worker.mjs` is the non-GitHub-schedule heartbeat. It checks GitHub `main` at 11:00 Asia/Shanghai and dispatches the watchdog if the day is missing, V7 qualified/push parity is invalid, or there is no synced receipt.
- A successful CRM sync is proven only by a `data/automation_runs/YYYY-MM-DD-*.json` receipt with `status=success` and a parseable `sync_response.synced=true`.

## Production Deduplication

Daily generation must avoid filling today's candidate slots with projects that already exist in the production CRM. Recent report-history dedupe is not enough because leads can enter production through manual import, Steam Trends, lead assistant, or other non-report channels.

Cloudflare Pages exposes a protected automation endpoint:

```bash
GET /api/leads/dedupe-index
Authorization: Bearer $CRM_AUTOMATION_TOKEN
```

Configure the same secret value in:

- Cloudflare Pages variable: `CRM_AUTOMATION_TOKEN`
- GitHub Actions secret: `CRM_AUTOMATION_TOKEN`

When the GitHub secret is present, daily workflows fetch the production dedupe index before generation and pass it to `online_daily_runner.mjs`. If the secret is missing, the generator falls back to report-history dedupe only and logs that degraded state.

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
- Steam Trends uses Steam market-board structure: `market_insights`, `genre_signals`, and candidate samples. It must not cite CRM rule docs or internal automation notes as market signals.
- Industry Radar and Steam Trends must both have enough items; a network-failed run that writes empty Steam trends is invalid.
- `data/sourcing_candidates/YYYY-MM-DD.json` records deduped discovery decisions, missing evidence, and exclusion reasons. It is validated and published with the other dated artifacts but is never used as a CRM import payload.
- V7 requires `new_qualified_count === push_pool_count`; the recorded push count must also equal the Daily report `push_pool`, while `watch_pool` and `drop_pool` remain empty.

`automations/jobs/online_daily_runner.mjs` runs this contract automatically after generation, including the required candidate-audit schema and integrity checks, so the cloud job fails before committing broken structure.

## Watchdog

Watchdog command:

```bash
node scripts/daily-report-watchdog.mjs --date=YYYY-MM-DD
```

The watchdog checks:

- Required files exist.
- A successful sync receipt exists.
- Formal Lead quantity has no minimum or maximum and never changes delivery health by itself.
- V7 candidate-audit `new_qualified_count` and `push_pool_count` must match the Daily report, and any mismatch is blocking.
- Radar, Steam Trends, Steam market insights, and Steam genre signals report degraded warnings when below their targets.

Production dedupe can turn many daily candidates into updates instead of newly created leads. The watchdog records `created_unprocessed`, `updated_unprocessed_visible`, and `visible_unprocessed` for diagnosis, but none of those counts is a health gate. Missing/invalid files, V7 qualified/push mismatch, and missing successful sync receipts decide whether recovery is needed.

Daily receipts separately record `business_liveness_status`, `new_lead_count`, `consecutive_zero_days`, and `top_blocking_gates`. The deterministic replay command is:

```bash
npm run replay:daily-leads-liveness -- --from=2026-07-15 --to=2026-07-29
```

Two consecutive complete zero-Lead days are `degraded`; three are `unhealthy-business-liveness`. This business status is observability only: it does not change V7.2 admission, request low-quality backfill, set watchdog `needs_run`, dispatch recovery, or alter CRM sync success.

For source-quality diagnosis, inspect the generator's `diagnostics.media_source_health`, nested `diagnostics.bilibili_probe.source_health`, retry counters, and `release_window_health`. These distinguish an upstream fetch failure from aggressive filtering, duplicate removal, weak product conversion, and near-launch routing. A source with repeated cloud failures should be disabled or replaced in the rule file; do not raise a global publication threshold to compensate for one unhealthy source.

If unhealthy, it returns `needs_run = true` with reasons.

The intended GitHub workflow is `.github/workflows/daily-report-watchdog.yml`, which checks repeatedly after the morning report window and regenerates/syncs when required files or a successful sync receipt are missing.

## External Heartbeat

GitHub scheduled workflows can be delayed or dropped during Actions incidents. The Cloudflare heartbeat in `cloudflare/daily-report-heartbeat/` provides an independent trigger path without generating data locally or calling CRM sync directly.

Deploy it as a Worker with its `wrangler.toml` cron (`0 3 * * *`, 11:00 Asia/Shanghai). Configure one secret:

```bash
GITHUB_TOKEN=<fine-grained token with Actions write access to Neo0109/CRM>
```

Optional environment overrides:

- `GITHUB_OWNER` defaults to `Neo0109`.
- `GITHUB_REPO` defaults to `CRM`.
- `GITHUB_BRANCH` defaults to `main`.
- `GITHUB_WORKFLOW_FILE` defaults to `daily-report-watchdog.yml`.

The heartbeat checks `data/reports/YYYY-MM-DD.json`, `data/radar/YYYY-MM-DD.json`, `data/steam_trends/YYYY-MM-DD.json`, `data/sourcing_candidates/YYYY-MM-DD.json`, and `data/automation_runs/YYYY-MM-DD-*.json` on GitHub `main`. Formal Lead quantity never degrades health. For V7 artifacts it requires candidate-audit `new_qualified_count` and `push_pool_count` to equal the Daily report `push_pool`, with empty `watch_pool` and `drop_pool`. It dispatches `daily-report-watchdog.yml` only when required files are missing, report/candidate JSON or V7 parity is invalid, or no receipt has `status=success` and `sync_response.synced=true`.

## Codex Task Policy

Feature development should use Codex Cloud against `Neo0109/CRM`:

1. Start a Codex task from the GitHub repository entry.
2. Use `Neo0109/CRM` and the desired base branch, normally `main`.
3. Let Codex create a `codex/...` branch and PR.
4. Review Cloudflare Preview.
5. Merge to `main` after acceptance.

Local Codex should be used for UI inspection, screenshots, emergency diagnostics, or explicit local-only tasks.
