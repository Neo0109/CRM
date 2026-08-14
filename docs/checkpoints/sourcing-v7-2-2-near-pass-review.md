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
- Created a fresh disposable non-git snapshot from checkpoint head `50c49470779f4c1d5e85ca7449eab0a4221cee4b`; the user worktree remains untouched.
- Traced the bounded implementation seam: keep the existing strict formal conversion/dedupe/interleave path unchanged, add one pure near-pass evaluator over the existing indie and china-joint evidence, then append a separately deduped/sorted/capped review tier.
- Confirmed the positive live shape: media admission for `steam:3473430` is domestic, prelaunch, non-EA, clear, non-narrative, non-India, has Demo, non-Steam contact, and concrete Bilibili value, with only independent quality absent.
- Confirmed the negative live shape: `steam:4868360` is narrative-heavy and lacks both official playable/gameplay evidence, so it must remain outside review.
- Resolved the copy/schema boundary with the root Release Captain: CRM/Daily Lead payload, API, UI, and their schemas remain frozen; only the sourcing-candidate audit artifact/schema gains nullable `publication_tier` and the two tier counts.
- Froze the exact warning literals and Chinese gate labels for RED assertions.
- Added the bounded V7.2.2 RED suite with eight behavioral groups covering the pure evaluator contract, exact rule version/copy, `steam:3473430`, `steam:4868360`, indie and china-joint hard/soft gates, formal-first ordering, review cap/dedupe, payload privacy, and audit/schema parity.
- Captured deterministic RED evidence: `node --test automations/test/onlineDailyV722NearPassReview.test.mjs` reported 0 pass / 8 fail because V7.2.2 does not yet exist, review candidates are not appended, and tier metrics/schema fields are absent.
- Implemented one pure near-pass evaluator shared by Steam and media source shapes, including stable Steam identity, exact hard gates, one allowed soft gap, deterministic review ordering, and frozen warning copy.
- Kept the strict formal conversion/dedupe/interleave path first and unlimited; the decision layer now appends only a separately deduped, sorted, capped review tier and returns explicit strict/review counts.
- Added candidate-audit `publication_tier`, tier counts, and blocking sum/parity checks without adding any field to a Lead payload; extended only the sourcing-candidate schema.
- Captured core GREEN evidence: the new focused suite passed 8/8, including both exact live AppID shapes and all locked hard-gate variants.
- Synchronized `sourcing-rules-v7.2.2-near-pass-review` across runtime, machine rules, heartbeat compatibility, current/canonical documentation, and fixed provenance assertions while preserving the V7.2.1 broad-media rules.
- Updated Daily/Radar/Steam-Trends prose to distinguish unlimited strict formal publication from the capped, explicitly warned review queue; the report object gains no schema field.
- Added the pure evaluator to the existing V7.3 behavior-dependency manifest so behavior hashing remains closed after the authorized production import; no V7.3 selector, provider, replay, or schema contract changed.
- Broader focused sourcing regression passed 85/85 after updating only the two intentionally superseded expectations (current canonical provenance and one quality-gap publication tier).
- Full V7.3/corpus/replay focused regression passed 134/134.
- Bound audit provenance to the exact published pool order: the pool index now carries both `publication_tier` and the selected `sourcing_lane`, preventing a same-dedupe alternate source from recomputing a different audit winner.
- Extended the Daily contract validator to block missing/invalid tier counts, count-to-record mismatch, tier/push sum mismatch, published records without a tier, and unpublished records with a non-null tier.
- `npm run test:daily-v4` passed 345/345 after installing disposable-snapshot dependencies; no package lock or repository dependency file changed.
- `npm run verify:all` passed all 16 tasks. Because this authorized working snapshot intentionally has no `.git`, the last task used a temporary wrapper that runs the equivalent `/usr/bin/git diff --no-index --check` across every changed file; the first unwrapped run had already passed the preceding 15 tasks and failed only with git exit 129 at the absent-repository boundary.
- Final post-validator repeat passed `npm run test:daily-v4` 345/345 and all 16 `npm run verify:all` tasks.
- Final syntax/JSON/whitespace checks passed for every changed executable/rule/schema file; `.github`, `app`, and `functions` are byte-identical to the frozen base, and the 22-file scope contains no workflow, provider-call, CRM/Supabase write, product, or UI change.
- Reconfirmed before publication: remote `main` remains the frozen base and the open PR queue remains empty; the user worktree retains its pre-existing three entries and was never modified.

## Remaining

- Publish the final branch, create one Ready PR, wait for remote checks, and stop unmerged for root Release Captain QA.

## Next Action

Publish the final branch head and create the Ready PR.

## Git Status

- Branch head before checkpoint: `fe6823186dc42e71b4cf775d3a3d4d0225df335d`.
- Initial checkpoint head: `50c49470779f4c1d5e85ca7449eab0a4221cee4b`.
- Diagnosis checkpoint head: `f092c7aaf327a80be4dacfd5c78a9bb4ec212007`.
- RED contract head: `7bbef0cab18ccea1df32effdb5065afef6ecab46` (tree `aa057fa6a09524d69704fb469aa0e2d6dec51696`).
- Focused-GREEN implementation head: `378cc1a4051a62cb7bb42b19fac24595445457ea` (tree `a9dafc402c37be7f822b5cf8ff13f0e32524979d`).
- Base: `fe6823186dc42e71b4cf775d3a3d4d0225df335d`.
- Expected scope: production sourcing decision/publication code, focused sourcing tests, machine/current rule documentation, and this checkpoint only.
- Working medium: fresh disposable non-git snapshot; user CRM worktree remains read-only.
