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
- Read the exact-SHA `package.json`, `scripts/verify-all.mjs`, current candidate schema, and nearest V7.3 audit test/module conventions.
- Confirmed `test:daily-v4` and `verify:all` already discover `automations/test/*.mjs`; no global test wiring change is needed.
- Created a permissive schema/validator scaffold plus deterministic positive and negative fixtures.
- Corrected one new-test schema path error before accepting RED evidence; the earlier `9a7164e480eb93aa8fdd5a09ca39e4e4581a68f5` run is not treated as valid RED.
- Valid RED commit: `7514af3628c43d4ae68109357e570edc558ea07a`.
- Exact RED snapshot checks:
  - `node --check automations/jobs/online_daily_v7_3_replay_corpus_contract.mjs`: PASS.
  - `node --check automations/test/onlineDailyV73ReplayCorpusContract.test.mjs`: PASS.
  - `node --test automations/test/onlineDailyV73ReplayCorpusContract.test.mjs`: expected FAIL, 16 tests failed and zero passed.
- RED failures were contract-local and precise: schema closure/version enums; recursive canonical ordering; rejection of undefined/function/cycle/NaN/Infinity; corpus/window self-hash; provenance; second-pass transaction completeness; duplicate candidate/evidence/transaction IDs; privacy; summary/parity/evidence resolution; complete/incomplete state explanations; reused-budget accounting; 15-day window length/continuity; behavior drift; manual-only canonical selection.
- Minimal GREEN implementation commit: `c79b3fe9a7d7e7bd9317e4a32524c6ec3be58a70`.
- GREEN implementation:
  - adds strict per-run and window JSON Schemas with `contract_version=1`, closed contract objects, closed event/slot/status/role/family enums, and explicit normalized JSON payload zones;
  - adds recursive canonical JSON with sorted object keys, preserved array order, and rejection of unsupported/non-finite/cyclic values;
  - defines corpus self-hash exclusion at `integrity.payload_sha256` and `artifact_bindings.replay_corpus.payload_sha256`, and window self-hash exclusion at `integrity.payload_sha256`;
  - adds pure behavior/payload SHA-256 and byte/text metrics;
  - adds strict schema-shape, cross-record, evidence-role, second-pass, publication-parity, budget, privacy, integrity, and static window validators with stable error codes and JSON-pointer paths;
  - imports only `node:crypto`; no filesystem, network, environment, current-time, locale, or random dependency.
- Exact GREEN snapshot checks at `c79b3fe9a7d7e7bd9317e4a32524c6ec3be58a70`:
  - both schema files parse with `jq empty`: PASS;
  - both implementation/test `node --check` commands: PASS;
  - `node --test automations/test/onlineDailyV73ReplayCorpusContract.test.mjs`: PASS, 16 tests passed, zero failed.
- Made no local CRM checkout/worktree reads or writes.

## Remaining

- Run `npm run test:daily-v4` from a disposable exact-head GitHub API snapshot.
- Run `npm run verify:all` from the same exact-head snapshot after installing declared dependencies.
- Run the required focused syntax/test checks and `git diff --check` from that exact head.
- Compare the branch to the exact Proposal head and prove the five-path allowlist.
- Update this checkpoint with the full verification SHA, results, final scope, and handoff.

## Next Action

Create a fresh disposable `mktemp` GitHub API snapshot of the exact branch head containing this GREEN checkpoint, install only repository-declared dependencies, and run the complete required verification without generating or committing production data.

## Git Status

- Branch parent: `85fdc7e77c7bec879d2da65d9781b55bb09b670f`.
- Initial checkpoint commit: `a21267d3eac1d40203c9bdfb49345077aa2fb72b`.
- Valid RED commit: `7514af3628c43d4ae68109357e570edc558ea07a`.
- GREEN implementation commit: `c79b3fe9a7d7e7bd9317e4a32524c6ec3be58a70`.
- Allowed implementation paths:
  - `schemas/sourcing_replay_corpus.schema.json`
  - `schemas/sourcing_replay_window.schema.json`
  - `automations/jobs/online_daily_v7_3_replay_corpus_contract.mjs`
  - `automations/test/onlineDailyV73ReplayCorpusContract.test.mjs`
  - `docs/checkpoints/pr-c-c5a-replay-corpus-contract-validator.md`
- No `package.json`, `scripts/verify-all.mjs`, `package-lock.json`, workflow, existing schema, evaluator/provider/scheduler, rules, data, UI/API, or Supabase change is intended.
- No PR exists for this branch.
- No merge, deployment, workflow, production artifact, or local checkout mutation is in scope.
