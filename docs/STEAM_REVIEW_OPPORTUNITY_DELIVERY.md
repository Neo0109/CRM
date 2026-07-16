# V7.1 Steam Review Opportunity Delivery

Date: 2026-07-16

Rule version: `sourcing-rules-v7.1`

This is the PR 6 delivery layer for the accepted PR 5 `steam-schinese-reviews-v1` audit source. It activates `ea_mobile_high_traction` and `china_heat_ops` through a separate full-catalog workflow without adding any trigger or execution step to the Daily automation.

## Authoritative Entrypoints

- Machine-readable rule: `automations/rules/steam-review-opportunities.json`
- Accepted source/audit contract: `docs/STEAM_REVIEW_OPPORTUNITY_SOURCE.md`
- Delivery preparation and receipt contract: `automations/jobs/steam_review_opportunity_delivery.mjs`
- Independent workflow: `.github/workflows/steam-review-opportunities.yml`
- Audit artifact: `data/steam_review_opportunities/YYYY-MM-DD.json`
- Delivery receipt: `data/steam_review_opportunity_runs/YYYY-MM-DD-SLOT.json`
- Audit schema validator: `npm run validate:steam-review-opportunities -- --file=...`
- Receipt schema validator: `npm run validate:steam-review-opportunity-run -- --file=...`

The active Daily entrypoint remains `automations/jobs/online_daily_runner.mjs -> automations/jobs/online_daily_v4.mjs`. Neither `.github/workflows/sync-daily-report.yml` nor `.github/workflows/daily-report-watchdog.yml` references this channel.

## Run Modes

- `mode=backfill` is the first full-catalog cohort and writes new Leads with `sourcing_run_type=initial_backfill`.
- `mode=scheduled` is the recurring cohort and writes new Leads with `sourcing_run_type=scheduled`.
- `mode=auto` remains `backfill` until the repository contains a receipt with all of:
  - `mode=backfill`
  - `scan_complete=true`
  - `status=success`
  - `sync_response.synced=true`
- After that strict initial receipt exists, `auto` resolves to `scheduled`.

The production workflow never passes `maxPages`. Every production mode therefore scans until the public catalog reports its end. A bounded local source audit remains incomplete and can never reach CRM sync.

### Exact-artifact sync retry

The optional manual `retry_from_slot` input is a delivery-only recovery path. It never calls the Steam source audit or any Steam endpoint. It accepts a prior receipt only when that receipt has `status=sync_failed`, `scan_complete=true`, `sync_response.synced=false`, zero created/deduplicated/updated counts, and the same artifact path and SHA-256 as the committed complete artifact for the requested date. Candidate counts are rebuilt and must match the failed receipt before an import payload is written.

The retry preserves the failed receipt's backfill or scheduled mode, writes a new slot-specific receipt, and still uses only the create-only CRM endpoint and the strict final gate. A missing, incomplete, already-synced, partially-written, count-mismatched, path-mismatched, or digest-mismatched receipt is rejected before CRM access. Scheduled runs and ordinary manual runs keep using a fresh full scan; the retry input is never set automatically.

## Steam Rate-Limit Policy

The workflow applies a 2100ms minimum interval across one shared request scheduler for catalog pages, simplified-Chinese review summaries, and required AppDetails lookups. The scheduler serializes request series so concurrent candidate evaluation cannot create request bursts.

HTTP 429 responses preserve the response status and parse `Retry-After` as either seconds or an HTTP date. A rate-limited request pauses the shared scheduler, then retries with the greater of the server cooldown or bounded exponential backoff, plus jitter. The retry budget is ten attempts and the exponential component is capped at 60 seconds; a longer server `Retry-After` is never shortened.

AppDetails HTTP-200 responses with a missing app entry, `success` other than true, or missing required `data` use the same bounded exponential backoff and jitter retry budget; exhaustion remains a terminal source failure. AppDetails is requested only when the catalog identifies the candidate as Early Access, because store EA confirmation is required only for `ea_mobile_high_traction` (including dual-rule matches). A non-EA catalog candidate may still qualify through `china_heat_ops` from the official simplified-Chinese review summary, without an irrelevant AppDetails request. Any required official evidence that remains unavailable after retries still makes `scan_complete=false`.

The job timeout is 360 minutes. This hotfix does not add bounded batches or continuation state because the rate-limited full scan remains a single strict artifact; if production evidence shows the safe scan cannot finish in that window, continuation must be added without allowing any partial artifact to sync.

## Selection And Import

Every current artifact record with `decision=qualified` is eligible in initial backfill. There is no minimum, maximum, ranking cutoff, quota, or truncation.

For a scheduled run, the delivery layer reads only prior complete audit artifacts whose exact content is paired with a strict successful delivery receipt. The receipt records `artifact_sha256`, and suppression history requires both the repository artifact path and SHA-256 digest to match:

- An AppID absent from successfully delivered artifacts is a new discovery and remains eligible.
- An AppID previously present but not qualified is eligible the first time it crosses either threshold.
- An AppID already qualified in an exact artifact with a matching strict success receipt is suppressed from the scheduled import payload.
- A failed, incomplete, or otherwise unmatched receipt never authenticates an artifact for suppression. Its newly qualified AppIDs remain eligible on the next scan and are retried through create-only import.

The digest binding matters for manual same-date reruns: an older success receipt for the same repository path cannot authenticate newer artifact content written by a later failed run.

Every eligible AppID maps to one Lead. If both rules match, `sourcing_lane=china_heat_ops`, while both rule names remain in the immutable audit and the Lead `rule_fit` text.

The workflow calls only:

```text
POST /api/leads/import-daily-report?mode=create-only
```

Create-only is the final dedupe and immutability boundary. Existing Steam AppIDs or dedupe keys contribute to `skipped_existing`; they are not merged or updated. A valid response must report `updated=0`.

The independent workflow authenticates this create-only call only through the Bearer `CRM_AUTOMATION_TOKEN` path. `CRM_ACCESS_TOKEN` is not a Bearer fallback for this workflow. If `CRM_AUTOMATION_TOKEN` is missing, the workflow writes an explicit `synced=false` response, produces a `status=sync_failed` receipt, and fails the final delivery gate. The original human/session access path remains compatible outside this automation call; PR 6 does not create or rotate any secret.

## Scan Failure Boundary

The preparation layer writes an import payload only when the validated audit has `scan_complete=true`. Any catalog, official-review, or AppDetails failure makes the audit incomplete and prevents the CRM request entirely.

The audit artifact may still be committed for diagnosis. A committed artifact alone never enters suppression history: only an exact SHA-256 match in a strict successful receipt can do so. The independent workflow records a non-success receipt and fails without changing CRM data; unmatched qualified items remain retryable. Daily generation and Daily sync remain unaffected.

## Receipt Contract

Each run records these independent metrics:

- `catalog_scan_count`
- `catalog_entries_seen`
- `qualified_count`
- `previously_qualified_count`
- `import_candidate_count`
- `deduplicated_count`
- `created_count`
- `updated_count`
- `artifact_sha256`
- structured `sync_response`

A successful run is valid only when all of the following are true:

```text
scan_complete=true
status=success
sync_response.synced=true
updated_count=0
created_count + deduplicated_count = import_candidate_count
```

The workflow validates this receipt before committing it and repeats the same strict checks in its final blocking step. Scheduled suppression additionally requires that the receipt's `artifact_path` and `artifact_sha256` identify the exact stored artifact.

## Fixed Verification

CI uses only fixed fixtures and static workflow contracts. It never runs a live Steam scan or calls production CRM. The workflow test also extracts the create-only sync shell and checks it with `bash -n`, protecting inline script delimiters before production.

```bash
node --test automations/test/steamReviewOpportunityDelivery.test.mjs
node --test automations/test/steamReviewOpportunityWorkflow.test.mjs
npm run verify:all
git diff --check
```
