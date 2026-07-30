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

## Read-Only Contract Analysis Checkpoint

The following frozen remote surfaces were inspected at exact SHAs:

- Phase 1 replay diagnosis and its July 15-29 artifact inventory.
- `docs/SOURCING_RULES_V7_3.md`, `docs/SOURCING_RULES_CURRENT.md`, and `automations/rules/daily-report.json`.
- The pure V7.3 evaluator and shared regular-admission composition.
- The targeted second-pass orchestrator at the frozen parent and the completed Blocker 2 source-role branch.
- Candidate schema v3, candidate-audit builder, PR B candidate state/evidence snapshot, and completed Blocker 3 boundary.
- The morning/afternoon workflow, repeated watchdog recovery window, one current afternoon receipt, and the existing Sourcing Learning provisional contract.

Concrete findings:

1. The current V7.3 authority is an official Demo/Playtest-or-gameplay gate plus two distinct independent public quality sources. The original two-evidence-family language describes a different population.
2. Schema v3 records `failed_gate_details` and `next_evidence_actions`, but it does not persist the exact first-pass evidence pack, source roles/families, run-wide second-pass ordering, bounded provider signals, fetched patch/error, or final-pass transaction.
3. PR B's lossless seven-day snapshot materially improves Steam evidence reuse, but it is a Steam candidate-state contract, not a full cross-source replay corpus; media signals and second-pass transactions remain absent.
4. Blocker 2 prevents project-controlled or unclassified Bilibili evidence from consuming an independent-quality slot, but the replay corpus still needs explicit persisted `source_role` and `evidence_family` provenance.
5. A replay of the regular formal output must retain both `indie_prelaunch` and `china_joint` inputs/results, the shared dedupe/publication boundary, and the privacy-safe pre-existing-match decision. Replaying only the indie evaluator would not reproduce the Daily formal pool.
6. The scheduled afternoon run can execute materially after its nominal 14:17 Shanghai cron time; a fixed wall-clock cutoff would reject legitimate automatic runs. Canonical-day selection must use automatic run slots, terminal validation/sync receipts, and deterministic precedence instead.
7. The old July 15-29 liveness result remains a historical baseline only. Any new acceptance window must use prospective immutable per-run corpus artifacts and must retain failed windows rather than excluding missing dates.
8. Existing Sourcing Learning already treats fewer than 30 resolved samples as provisional and applies the 80% target only to a mature regular cohort; replay review must not create a competing precision denominator or automatic rule mutation.

## Remaining

- Compare the three evidence-authority policy options and record one recommendation for explicit approval.
- Define the field-level per-run corpus and window manifest, privacy/integrity constraints, completeness states, canonical-run selection, acceptance metrics, and later bounded TDD PR sequence.
- Update this checkpoint with the complete Proposal, validate its exact remote head and one-file allowlist, then stop at the Phase 3 approval boundary.

## Next Action

Complete the Phase 2 policy and contract design inside this checkpoint only. Do not enter implementation.

## Git Status

- Proposal branch starts exactly at `f9b34cc83623f25327a2148c8d833ef65c96a753`.
- Allowed changed path: `docs/checkpoints/pr-c-v73-replay-corpus-contract-v1.md` only.
- No PR exists for this branch.
