# PR C5-A Replay Corpus Contract and Validator

Date: 2026-07-30  
Phase: Phase 4 implementation in progress  
Branch: codex/pr-c-c5a-replay-corpus-contract-validator  
Repository workflow: GitHub App/API only; no local CRM checkout/worktree read or write

## Current Goal

Implement Replay Corpus Contract v1 as a pure, deterministic repository boundary: per-run and window JSON Schemas, canonical JSON and SHA-256 helpers, corpus/window validators with cross-record privacy and integrity checks, and fixed fixture tests.

This task is limited to C5-A. It does not implement the shadow collector, generator/orchestrator wiring, replay harness, canonical-run selector, 15-day collection, live providers, workflow changes, Blocker 2/3 integration, rule changes, production data, CRM sync, UI/API/Supabase, PR creation, merge, or deployment.

## Overall Progress Checkpoint

- Remote main: `f93a937aaaa7e688f233ab4ba0b9a97930c7b0c7`; unchanged from the approved start gate.
- Frozen PR C parent: `e0d0b2ac71849ac135d68f124c17e7262772c144`.
- Blocker 2 completed branch: `63ad52bba4ce4dcd3964117286d277a71dc2d2ef`; not integrated here.
- Blocker 3 completed branch: `043c62fdd1c9e10c235e79723ee5aca6cea541c7`; not integrated here.
- Replay diagnosis: `f9b34cc83623f25327a2148c8d833ef65c96a753`.
- Approved Proposal head: `85fdc7e77c7bec879d2da65d9781b55bb09b670f`; exact and unchanged.
- Proposal differs from replay diagnosis only at `docs/checkpoints/pr-c-v73-replay-corpus-contract-v1.md`.
- Open PR queue: unrelated PR #71 only.
- Current module: Replay Corpus Contract v1 schemas, canonicalization, pure validation, privacy/integrity checks, and deterministic fixtures.
- Explicitly untouched: collectors, selectors, replay execution, live sources, existing candidate schema/evaluator/provider/scheduler, machine rules, workflows, data, CRM/product surfaces, PR/merge/deployment.

## Completed

- Re-read and matched every approved remote start SHA.
- Confirmed the target implementation branch did not exist.
- Read the complete Proposal at its exact approved head.
- Confirmed the Proposal branch is exactly three commits ahead of the replay diagnosis and changes one approved checkpoint path only.
- Confirmed the repository does not contain `docs/CODEX_DELIVERY_WORKFLOW.md` at the approved head or current main; no `PLAN.md`-authorized PR creation is in scope.
- Created this durable checkpoint before implementation multi-file analysis.
- Made no local CRM checkout/worktree reads or writes.

## Remaining

- Inspect the minimal exact-SHA repository surfaces needed to fit existing test and schema conventions.
- Commit a meaningful RED test/scaffold boundary and record the precise failing assertions.
- Implement the minimal pure schemas, canonicalizer, corpus validator, privacy validator, window validator, and fixed fixtures.
- Run focused GREEN validation.
- Run the complete required verification from a disposable `mktemp` GitHub API snapshot of the exact implementation SHA.
- Verify the final changed-path allowlist and update this checkpoint with exact evidence.

## Next Action

Read only the minimum exact-SHA package/test/schema conventions required for C5-A, then create the RED commit without modifying global test wiring.

## Git Status

- Branch parent: `85fdc7e77c7bec879d2da65d9781b55bb09b670f`.
- Allowed implementation paths:
  - `schemas/sourcing_replay_corpus.schema.json`
  - `schemas/sourcing_replay_window.schema.json`
  - `automations/jobs/online_daily_v7_3_replay_corpus_contract.mjs`
  - `automations/test/onlineDailyV73ReplayCorpusContract.test.mjs`
  - `docs/checkpoints/pr-c-c5a-replay-corpus-contract-validator.md`
- No PR exists for this branch.
- No merge, deployment, workflow, production artifact, or local checkout mutation is in scope.
