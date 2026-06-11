# Sourcing Learning Loop V1

## Scope

This release adds a deterministic learning loop for human BD decisions. It does not change daily-report scheduling, sourcing generation rules, login, or product version.

## Behavior

- Current leads in `未处理`, `待评测`, `测试中`, `观察池`, `跟进中`, and `推进池` are treated as the active learning cohort.
- Historical leads already in `淘汰池` are not backfilled into the initial cohort.
- Future manual changes to workflow fields create system decision events:
  - `bucket`, `stage`, `review_status`
  - `priority`
  - `evaluation_grade`, `evaluation_result`, `evaluated_at`
  - `drop_reason`
  - `owner`, `due_date`, `next_action`
- Notes-only edits do not create learning events.
- Events are stored as system rows with `__crm_decision_event__` ids in the existing `crm_leads` Supabase table, so no table migration is required.

## UX

- The right detail panel has an optional `淘汰原因（若淘汰）` dropdown for first-pass or final rejection context.
- The automation diagnostics page includes a `Sourcing 学习` section showing current cohort size, event count, funnel, grade distribution, and drop reasons.
- The learning report only gives sample accumulation until there are at least 30 resolved positive/negative samples.

## Important Boundaries

- This module supports later human analysis of sourcing-rule weights; it does not call OpenAI APIs and does not automatically rewrite sourcing rules.
- Sourcing rules, automation workflows, and product UI should continue to be changed in separate PRs unless a task explicitly asks to connect them.
- Old dirty notes are intentionally left for manual cleanup.
