# Steam Simplified-Chinese Review Opportunity Source

Date: 2026-07-16

Source contract: `steam-schinese-reviews-v1`

This source is the audit-only data layer approved in PLAN.md PR 5. It does not activate the `ea_mobile_high_traction` or `china_heat_ops` CRM lanes. Workflow scheduling, backfill state, create-only import, and synchronization remain PR 6 work.

## Entrypoints And Artifact

- Source and pure decision: `automations/jobs/steam_review_opportunity_source.mjs`
- Artifact builder and integrity contract: `automations/jobs/steam_review_opportunity_artifact.mjs`
- Standalone writer: `automations/jobs/steam_review_opportunity_audit.mjs`
- JSON schema: `schemas/steam_review_opportunities.schema.json`
- Output: `data/steam_review_opportunities/YYYY-MM-DD.json`
- Schema/integrity validator: `scripts/validate-steam-review-opportunities.mjs`

The artifact is an evidence and decision audit. It is not a Daily report, sourcing-candidate replacement, Lead payload, automation receipt, or CRM import input.

## Collection Contract

1. Page through the public Steam search results endpoint with the PC-game and Windows filters (`category1=998`, `os=win`) and simplified-Chinese China storefront context (`cc=cn`, `l=schinese`).
2. Preserve each unique Steam AppID once and record page/catalog coverage.
3. Parse the localized catalog review summary only as a prefilter. It may trigger an official lookup but can never qualify a project.
4. Prefilter either:
   - a catalog Early Access-tagged project with at least 1,000 summarized reviews; or
   - any project with at least 10,000 summarized reviews.
5. Confirm every prefilter hit through the official public review endpoint with `filter=all`, `language=schinese`, `purchase_type=all`, and `review_type=all`.
6. Store the official `total_positive`, `total_negative`, and `total_reviews` facts and calculate positive rate as `total_positive / total_reviews * 100`.
7. Fetch official AppDetails/store metadata separately. Current Early Access requires both the catalog EA tag and official store/AppDetails EA state.

The official review response contract is documented by [Steamworks User Reviews - Get List](https://partner.steamgames.com/doc/store/getreviews?language=english).

## Pure Qualification Contract

- `ea_mobile_high_traction` requires confirmed current EA, at least 1,000 simplified-Chinese reviews, and at least 80% positive.
- `china_heat_ops` requires at least 10,000 simplified-Chinese reviews; positive rate is recorded but does not gate admission.
- When both match, `china_heat_ops` is the primary lane and both matched rules remain in the artifact.
- The source does not cap, rank away, truncate, or backfill matching projects.
- Missing official evidence becomes `needs_evidence`; catalog text cannot substitute for the official review summary or the second EA fact.

Locked edge cases:

- `999 / 80%`: not qualified for EA.
- `1000 / 79.99%`: not qualified for EA.
- `1000 / 80%`: qualified for EA when both EA facts are confirmed.
- `10000 / any positive rate`: qualified for China heat.

## Completeness And Safety

- `scan_complete=true` is valid only when pagination reaches the reported catalog end and every selected official review/AppDetails lookup succeeds.
- A bounded `--maxPages` scan or any catalog/review/AppDetails failure records `scan_complete=false` and explicit source failures.
- Unknown review metrics remain `null`; the validator rejects synthetic zeroes, count drift, duplicate AppIDs, invalid lane precedence, and a false complete scan.
- The writer uses the shared recursive private-field sanitizer.
- The current Daily runner, production daily workflows, report import, and CRM sync code do not reference `steam_review_opportunities`.
- CI runs only fixed fixture pages, review responses, and AppDetails. It never calls live Steam.

## Local Contract Checks

```bash
node --test automations/test/steamReviewOpportunity*.test.mjs
npm run validate:steam-review-opportunities -- --file=data/steam_review_opportunities/YYYY-MM-DD.json
```

Do not run the live full-catalog writer as a substitute for PR 6 production workflow/backfill delivery, and do not synchronize this artifact to CRM.
