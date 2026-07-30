# PR C V7.3 Replay Corpus Contract v1 Proposal

Date: 2026-07-30  
Phase: Phase 2 Proposal in progress; no implementation, integration, or PR creation  
Branch: `codex/pr-c-c5-v73-replay-corpus-contract-v1`  
Frozen parent: `f9b34cc83623f25327a2148c8d833ef65c96a753`  
Repository workflow: GitHub App/API only; no local CRM checkout/worktree read or write

## Current Goal

Design an approval-ready `V7.3 Replay Corpus Contract v1` and a replacement acceptance-window policy that can support honest, immutable, deterministic V7.3 replay without inventing evidence or weakening admission quality.

This task may change only this proposal checkpoint. It does not implement a collector, schema, validator, replay harness, evaluator, provider, workflow, production artifact, integration, PR, merge, deployment, live source call, generator run, or CRM sync.

## Overall Progress Checkpoint

- Remote `main`: `f93a937aaaa7e688f233ab4ba0b9a97930c7b0c7`.
- Frozen PR C parent: `e0d0b2ac71849ac135d68f124c17e7262772c144`.
- Blocker 2 completed branch: `63ad52bba4ce4dcd3964117286d277a71dc2d2ef`; not integrated.
- Blocker 3 completed branch: `043c62fdd1c9e10c235e79723ee5aca6cea541c7`; not integrated.
- Replay diagnosis branch: `f9b34cc83623f25327a2148c8d833ef65c96a753`; exactly one checkpoint commit ahead of the frozen PR C parent.
- Open PR queue: unrelated PR `#71` only.
- Current module: replay-corpus authority, provenance, completeness, and acceptance-window policy only.
- Explicitly untouched: blocker integration, admission/ranking/quantity policy implementation, candidate lifecycle implementation, workflow triggers, CRM sync, product/UI/API, Supabase, production artifacts, PR D/E, existing Leads, merge, and deployment.

## Completed

- Reconfirmed every remote start gate and branch SHA.
- Reconfirmed the proposal branch did not exist.
- Reconfirmed the replay diagnosis branch differs from its frozen parent only by `docs/checkpoints/pr-c-v73-production-replay-diagnosis.md`.
- Created this independent Phase 2 proposal branch from the exact replay diagnosis head.
- Created this durable checkpoint before multi-file contract analysis.

## Remaining

- Inspect the frozen remote rule, evaluator, second-pass, candidate-state/schema, and delivery contracts.
- Compare the three evidence-authority policy options and recommend one for explicit approval.
- Define the field-level replay corpus, privacy/integrity constraints, completeness states, acceptance window, validation contract, and later bounded TDD PR sequence.
- Update this checkpoint with the complete Proposal, validate its exact remote head and one-file allowlist, then stop at the Phase 3 approval boundary.

## Next Action

Read only the minimum frozen remote files needed to design the contract. Do not enter implementation.

## Git Status

- Proposal branch starts exactly at `f9b34cc83623f25327a2148c8d833ef65c96a753`.
- Allowed changed path: `docs/checkpoints/pr-c-v73-replay-corpus-contract-v1.md` only.
- No PR exists for this branch.
