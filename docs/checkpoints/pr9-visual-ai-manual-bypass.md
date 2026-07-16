# PR 9 Visual AI Manual Bypass Checkpoint

## Current Goal

Implement PLAN.md PR 9 as an isolated `workflow_dispatch` visual-audit capability with zero-cost, zero-blocking, and zero-recommendation-impact defaults.

## Baseline

- `origin/main`: `4af49d648e903567b4ff90d66a55f04c865b58e5`
- Completed plan modules: PR 0 through PR 8 (PR 8 completion supplied by the user; it must not be rechecked or modified)
- Open PR queue: unrelated PR #71 only
- Branch: `codex/pr9-visual-ai-manual-bypass`
- Worktree: `/Users/neo/Documents/GitHub/CRM-pr9-visual-ai-manual-bypass`
- Authorization: PLAN.md PR 9 implementation, delivery, squash merge, and production acceptance are approved

## This PR Only

- Add a standalone visual AI audit workflow whose only trigger is `workflow_dispatch`.
- Keep production AI calls disabled by default.
- Require explicit key, model, and budget configuration before any future real-provider call can be eligible.
- Use only a fake provider in CI and tests.
- Add trigger, fake-provider, no-key safe-exit, no-import, and lead/priority/pool immutability tests.

## Explicitly Out of Scope

- PR 8 inspection, modification, or reimplementation
- Main daily report behavior or workflow structure
- Radar or Steam Trends
- CRM import or production CRM writes
- Formal recommendation admission, withdrawal, or demotion
- Lead priority or pool changes
- Schedules, push triggers, or any automatic trigger for visual AI
- API key creation/configuration, paid calls, database migrations, production data changes, or permission changes

## Completed

- Read AGENTS.md, PLAN.md, and docs/CODEX_DELIVERY_WORKFLOW.md.
- Confirmed remote `main` SHA and unrelated open PR queue.
- Created the independent PR 9 branch and worktree from current `origin/main`.
- Recorded the implementation and no-touch boundaries before code exploration.
- Inspected only the adjacent automation, workflow, candidate-audit, provider, schema, and verification conventions.
- Confirmed the existing product screenshot assistant is coupled to the CRM API and its existing `OPENAI_API_KEY`; PR 9 will neither reuse nor modify that path.

## Implementation Decision

- Problem: a visual model can add human-review context, but sharing the product assistant or sourcing orchestration would let cost, network failure, or model output enter production paths.
- Impact if untreated: a missing key or provider outage could block delivery, an implicit credential could create unexpected spend, and model output could accidentally mutate recommendation-owned fields.
- Selected slice: add one standalone manual workflow, one read-only audit core/CLI, one advisory-only artifact schema/validator, and focused contract tests.
- Method: red/green TDD; dependency-injected fake provider; explicit provider eligibility gate; immutable input snapshots; advisory output allowlist; workflow `contents: read` permission and artifact upload only.
- Safety/architecture benefit: no scheduler or product entrypoint imports the audit; no CRM credential/import URL is exposed; missing approval/key/model/budget exits with `real_requests=0`; audit results cannot represent Lead withdrawal, priority, or pool mutations.
- Real-call eligibility (future only): manual `openai` selection, repository approval flag, distinct `VISUAL_AI_API_KEY`, explicit model, and positive request/image/output-token budgets must all be present. This PR will not configure or use them.
- TDD red evidence: `node --test automations/test/visualAi*.test.mjs` failed as expected because the manual workflow, audit modules, and schema do not yet exist and Build does not yet run the focused suite.
- Green implementation: added the dispatch-only read-only workflow, immutable advisory audit core/CLI, deterministic fake provider, dormant gated OpenAI adapter, artifact schema/validator, Build fake-provider step, and operating-boundary documentation.
- Focused evidence: `node --test automations/test/visualAi*.test.mjs` passes 13/13 tests.
- Default CLI evidence: explicit `provider=disabled` writes a valid `status=skipped`, `skip_reason=provider_disabled`, `real_ai_requests=0` artifact.
- Fake CLI evidence: deterministic fake execution writes a valid `status=completed`, `real_ai_requests=0` artifact without network access.
- CI/test isolation: even negative real-eligibility tests inject only the fake provider; no test instantiates or calls the real adapter.
- Protected Daily, watchdog, Steam opportunity, Radar, Steam Trends, and CRM import entrypoints remain unmodified.
- Final focused verification: `npm run test:daily-v4` passes 168/168 tests, including all 13 PR 9 tests.
- Type verification: root frontend/backend typecheck and Functions typecheck pass.
- Schema/contract verification: Daily contract passes for `2026-07-16`; the manual audit workflow YAML parses; disabled and fake artifacts both pass the dedicated validator with `real_ai_requests=0`.
- Repository gate: `npm run verify:all` passes all configured tests, typechecks, contracts, temporary frontend build, and diff check.
- Scope check: branch diff contains only the standalone visual audit workflow/modules/tests/schema/validator/docs/checkpoint, package script entries, and the Build fake-provider test step.
- Publication routing: local `gh` push was rejected because its OAuth token lacks workflow-file scope. No remote branch or PR was created by that attempt. Per repository policy, publication is continuing through the installed GitHub App/API without changing credentials or permissions.

## Remaining

- Push, open the PR, wait for checks/reviews, confirm diff scope, and squash merge.
- Verify Build, Cloudflare, production `/api/health`, default zero real AI requests, and unaffected daily/CRM paths.
- Record final remote SHA and acceptance evidence.

## Next Action

Publish the verified final tree as one GitHub App commit on `codex/pr9-visual-ai-manual-bypass`, create the PR, and confirm the remote tree exactly matches the local verified tree.

## Git Status

- HEAD: `c7cb4cc` (`docs: record PR 9 verification`)
- Working tree: publication-route checkpoint update ready to commit; implementation is otherwise clean
