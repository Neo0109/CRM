# Visual AI Manual Audit

## Purpose

The visual AI audit is an optional human-review aid. It is deliberately isolated from recommendation admission, the Daily report, Radar, Steam Trends, CRM import, and production CRM writes.

Its only entrypoint is `.github/workflows/visual-ai-manual-audit.yml`, and that workflow can only be started with `workflow_dispatch`. The workflow has `contents: read` permission and uploads one ephemeral advisory JSON artifact; it does not commit files.

## Current Default

- Provider: `disabled`
- Real AI requests: `0`
- CRM import calls: `0`
- Lead, priority, and pool mutations: `0`
- Missing configuration outcome: successful safe exit with `status=skipped`
- CI/test provider: `fake`

The fake provider is deterministic and performs no network request. It exists only to verify the audit contract and workflow wiring.

## Real-Provider Boundary

The dormant real-provider adapter is ineligible unless every gate below is explicitly configured:

1. The manual dispatch selects `openai`.
2. Repository variable `VISUAL_AI_PRODUCTION_APPROVED` is exactly `true`.
3. The distinct secret `VISUAL_AI_API_KEY` is present.
4. A model is supplied for that dispatch.
5. Positive request, image, and output-token budgets are supplied for that dispatch.

Missing any gate produces an advisory artifact with `status=skipped` and `real_ai_requests=0`. This PR does not create or configure the approval variable, secret, model, or budgets. Enabling them requires separate explicit user approval.

## Advisory Contract

The output may contain only:

- a visual summary;
- strengths and risks;
- questions for a human reviewer;
- confidence;
- `recommendation_impact: "none"`.

The result schema has no Lead admission, withdrawal, decision, priority, bucket, or sourcing-pool action fields. A supplied Lead snapshot is never passed to the provider; only its SHA-256 integrity digest is recorded.

## Validation

```sh
node --test automations/test/visualAi*.test.mjs
npm run validate:visual-ai-audit -- --file=/path/to/visual-ai-manual-audit.json
```

The repository-wide `npm run verify:all` suite also includes the visual audit tests through the automation test glob.
