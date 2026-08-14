# Sourcing V7.2.2 near-pass review Leads

## Current Goal

Add one bounded V7.2.2 review tier after unchanged strict formal publication: publish every strict formal Lead first, then append at most three deterministic near-pass review Leads after formal dedupe. Preserve all strict formal admission gates, unlimited formal publication, production payload/schema/UI/API, and natural-run boundaries.

## Baseline

- Remote `main`: `fe6823186dc42e71b4cf775d3a3d4d0225df335d`.
- Base tree: `24529dd78b3c57d319298f3aaa63c74670fbbd0c`.
- Open PRs before this wave: 0.
- Latest main Build: run `31791638142`, success.
- Production `/api/health`: HTTP 200, `ok=true`, version `v2.8-communication-follow-up`, `storage=supabase`.
- Branch: `codex/v722-near-pass-review-leads`.

## Approved Scope

- Keep strict formal gates and unlimited strict formal publication unchanged and first.
- After strict formal dedupe, append at most three review Leads.
- Indie review eligibility requires Steam AppID/stable dedupe/nonduplicate, prelaunch window, non-EA, publisher clear, non-narrative, non-India, non-Steam contact, concrete China/Bilibili value, plus Demo/Playtest or official gameplay. Permit exactly one soft gap: `independent_quality_proof`, or `overseas_china_demand` for overseas projects only.
- China-joint review eligibility requires Steam AppID, current China opportunity, mature partner clear, current official event, playable/gameplay, and non-Steam contact. Permit only missing `traction_or_proven_team_event`.
- Order by quality gap, overseas-demand gap, traction gap; then domestic first, current official event, discovery score descending, and dedupe key.
- Preserve formal dedupe first and cap only review Leads at three.
- Keep the existing Lead payload contract: bucket `未处理`, stage `new`, priority `null`, existing lane preserved, and the approved Chinese `rule_fit`, `risks`, and `verdict` warning copy.
- Add audit `publication_tier=strict_formal|near_pass_review` and metrics `strict_formal_count`, `near_pass_review_count`, plus parity of their sum; preserve `new_qualified_count == push_pool_count`.
- Upgrade rule version to `sourcing-rules-v7.2.2-near-pass-review` and synchronize machine rule, canonical rule documentation, and `docs/SOURCING_RULES_CURRENT.md`.

## Explicit Non-Goals

- No strict-gate relaxation or cap on formal Leads.
- No workflow or trigger change, provider authority/call expansion, CRM/UI/API/schema/Supabase change, manual rerun, deploy, or production write.
- No V7.3 replay/provider-contract change beyond compatibility regression verification.
- No local user-worktree edits; all repository publication uses the GitHub API.

## Verification Contract

- TDD RED/GREEN for `steam:3473430` positive and `steam:4868360` negative.
- Formal unaffected; one versus two soft gaps; review cap/order/formal dedupe; every listed hard rejection; exact labels/copy/privacy/audit/payload/parity.
- Focused sourcing tests, all V7.3/corpus tests, `npm run test:daily-v4`, `npm run verify:all`, syntax/schema/diff/workflow/scope audit.
- Create one Ready PR, wait for remote checks, and stop unmerged for root Release Captain QA.

## Completed

- Reconfirmed exact remote main/tree, empty PR queue, successful latest main Build, and healthy production API.
- Created the bounded branch from the frozen base.

## Remaining

- Create a disposable snapshot from the frozen remote base and trace the current strict admission, pool publication, candidate audit, rule, and metrics bindings.
- Add RED fixtures, implement the smallest formal-first near-pass review slice, update rule/docs, and run the full verification contract.
- Publish one Ready PR and stop for root independent QA.

## Next Action

Publish this checkpoint as the first branch commit, then create the disposable snapshot and begin read-only code tracing before RED.

## Git Status

- Branch head before checkpoint: `fe6823186dc42e71b4cf775d3a3d4d0225df335d`.
- Base: `fe6823186dc42e71b4cf775d3a3d4d0225df335d`.
- Expected scope: production sourcing decision/publication code, focused sourcing tests, machine/current rule documentation, and this checkpoint only.
- Working medium: fresh disposable non-git snapshot; user CRM worktree remains read-only.
