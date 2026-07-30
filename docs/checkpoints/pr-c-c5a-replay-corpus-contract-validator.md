# PR C5-A Replay Corpus Contract and Validator

Date: 2026-07-30
Phase: Phase 4 C5-A review repair complete; PR #107 open
Branch: codex/pr-c-c5a-replay-corpus-contract-validator
Repository workflow: GitHub App/API only; no local CRM checkout/worktree read or write

## Current Goal

Completed: implement Replay Corpus Contract v1 as a pure, deterministic repository boundary with per-run and window JSON Schemas, canonical JSON and SHA-256 helpers, corpus/window validators, cross-record privacy and integrity checks, and fixed fixture tests.

This task remained limited to C5-A. It did not implement the shadow collector, generator/orchestrator wiring, replay harness, canonical-run selector, 15-day collection, live providers, workflow changes, Blocker 2/3 integration, rule changes, production data, CRM sync, UI/API/Supabase, PR creation, merge, or deployment.

## Overall Progress Checkpoint

- Final remote main recheck: `f93a937aaaa7e688f233ab4ba0b9a97930c7b0c7`; unchanged from the approved start gate.
- Frozen PR C parent: `e0d0b2ac71849ac135d68f124c17e7262772c144`.
- Blocker 2 completed branch: `63ad52bba4ce4dcd3964117286d277a71dc2d2ef`; not integrated here.
- Blocker 3 completed branch: `043c62fdd1c9e10c235e79723ee5aca6cea541c7`; not integrated here.
- Replay diagnosis: `f9b34cc83623f25327a2148c8d833ef65c96a753`.
- Approved Proposal head final recheck: `85fdc7e77c7bec879d2da65d9781b55bb09b670f`; exact and unchanged.
- Open PR queue final recheck: unrelated PR #71 only.
- Completed module: Replay Corpus Contract v1 schemas, canonicalization, pure validation, privacy/integrity checks, and deterministic fixtures.
- Explicitly untouched: collectors, selectors, replay execution, live sources, existing candidate schema/evaluator/provider/scheduler, machine rules, workflows, data, CRM/product surfaces, PR/merge/deployment.

## Completed

- Re-read and matched every approved remote start SHA.
- Confirmed the target implementation branch did not exist before creation.
- Read the complete Proposal at its exact approved head.
- Confirmed the Proposal branch is exactly three commits ahead of the replay diagnosis and changes one approved checkpoint path only.
- Confirmed the repository does not contain `docs/CODEX_DELIVERY_WORKFLOW.md` at the approved head or current main; no `PLAN.md`-authorized PR creation is in scope.
- Created this durable checkpoint before implementation multi-file analysis.
- Read the exact-SHA `package.json`, `scripts/verify-all.mjs`, current candidate schema, and nearest V7.3 audit test/module conventions.
- Confirmed `test:daily-v4` and `verify:all` already discover `automations/test/*.mjs`; no global test wiring change was needed.
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
- Exact focused GREEN snapshot checks at `c79b3fe9a7d7e7bd9317e4a32524c6ec3be58a70`:
  - both schema files parse with `jq empty`: PASS;
  - both implementation/test `node --check` commands: PASS;
  - `node --test automations/test/onlineDailyV73ReplayCorpusContract.test.mjs`: PASS, 16 tests passed, zero failed.
- Exact full-verification GitHub API snapshot SHA: `50a9507521f6c4f687fce5d818e5c4258d526c76`.
- The full-verification snapshot was created with `mktemp` from the GitHub API tarball for that exact SHA and initialized only as a disposable baseline for repository checks.
- The repository has no `package-lock.json`; declared dependencies were installed with `npm install --package-lock=false`. No lockfile was generated.
- Exact full-verification results:
  - both schema `jq empty` checks: PASS;
  - both required `node --check` commands: PASS;
  - focused contract test: PASS, 16/16;
  - `npm run test:daily-v4`: PASS, 222/222;
  - `npm run verify:all`: PASS, including frontend/backend/functions tests, Daily V4, automation diagnostics, Lead Assistant, Sourcing Learning, Daily heartbeat, all three typechecks, sourcing-v6-4 compatibility, July 15-29 liveness replay, Daily contract validation, temporary frontend build, and diff-check;
  - final `git diff --check`: PASS;
  - snapshot `git status --short`: clean;
  - explicit module purity scan for fs/http/https/env/current-time/random dependencies: PASS;
  - `package-lock.json` absence after installation: PASS.
- Exact compare from Proposal head through full-verification head: ahead by six, behind by zero, with exactly five changed paths:
  - `schemas/sourcing_replay_corpus.schema.json`
  - `schemas/sourcing_replay_window.schema.json`
  - `automations/jobs/online_daily_v7_3_replay_corpus_contract.mjs`
  - `automations/test/onlineDailyV73ReplayCorpusContract.test.mjs`
  - `docs/checkpoints/pr-c-c5a-replay-corpus-contract-validator.md`
- Made no local CRM checkout/worktree reads or writes.

## Remaining

No work remains inside the approved C5-A implementation scope.

The following remain separately unauthorized and untouched:

- PR creation, review, merge, deployment, or production activation;
- C5-B shadow collector or generator/orchestrator integration;
- C5-C replay harness, canonical-run selector, acceptance calculations, or 15-day observation;
- Blocker 2/3 integration, workflow/data/rule/product changes, or live-source execution.

## Next Action

Stop at the completed C5-A handoff. A later task may separately authorize PR creation/review or begin C5-B/C under their own phase and checkpoint boundaries.

## Git Status

- Branch parent: `85fdc7e77c7bec879d2da65d9781b55bb09b670f`.
- Initial checkpoint commit: `a21267d3eac1d40203c9bdfb49345077aa2fb72b`.
- Valid RED commit: `7514af3628c43d4ae68109357e570edc558ea07a`.
- GREEN implementation commit: `c79b3fe9a7d7e7bd9317e4a32524c6ec3be58a70`.
- Exact full-verification head before this final checkpoint update: `50a9507521f6c4f687fce5d818e5c4258d526c76`.
- This final checkpoint update changes only the already-approved checkpoint path; its exact remote commit SHA is reported in the handoff.
- No `package.json`, `scripts/verify-all.mjs`, `package-lock.json`, workflow, existing schema, evaluator/provider/scheduler, rules, data, UI/API, or Supabase change exists.
- No PR exists for this branch.
- No merge, deployment, workflow, production artifact, or local checkout mutation occurred.


## PR Review Repair Checkpoint — 2026-07-31

### Current Goal

Address all five user-approved, unresolved, non-outdated review findings on PR #107 while preserving Replay Corpus Contract v1 purity and the original five-path C5-A boundary.

This repair remains limited to schema, pure validator, deterministic fixtures, and this checkpoint. It does not add a collector, generator/orchestrator wiring, replay harness, canonical-run selector, live providers, workflow changes, production data, CRM sync, UI/API/Supabase, Blocker 2/3 integration, merge, deployment, or activation.

### Completed

- User explicitly approved addressing all five review findings.
- Rechecked PR #107 through the GitHub App/API: open, non-draft, mergeable without conflicts, base `codex/pr-c-c5-v73-replay-corpus-contract-v1` at `85fdc7e77c7bec879d2da65d9781b55bb09b670f`, head `feea0f62bc331326190d157d9fb1aa8a32ca5c86` before this checkpoint update.
- Rechecked the Proposal-to-head compare: eight commits ahead, zero behind, exactly the original five approved paths.
- Rechecked current `main`: `f93a937aaaa7e688f233ab4ba0b9a97930c7b0c7`; direct main integration remains out of scope.
- Re-read thread-aware GraphQL state: five review threads are unresolved and non-outdated.
- Confirmed the five actionable defects against the exact remote implementation and approved Proposal:
  - complete windows do not require every retained date to be canonical and healthy;
  - `requested_actions` is modeled as strings instead of the evaluator's `{ gate_id, action }` records;
  - hard-excluded candidates are not rejected from second-pass eligibility/selection/attempt sets;
  - replay-corpus self binding requires an impossible embedded Git blob SHA;
  - attempted candidate transaction references are not bound to the same candidate.
- Confirmed no GitHub Actions workflow run or commit status was attached to the pre-repair PR head; prior exact-snapshot verification remains evidence but is not represented as PR CI.
- Made no local CRM checkout/worktree read or write.

### Remaining

- Add focused negative tests for all five findings and prove valid RED from an exact GitHub API snapshot.
- Implement the minimal schema/validator/fixture changes and prove focused GREEN.
- Run both schema parses, both required syntax checks, the focused suite, `npm run test:daily-v4`, `npm run verify:all`, and `git diff --check` from an exact disposable snapshot.
- Update this checkpoint with final evidence.
- Reply to and resolve all five review threads only after verification passes.

### Next Action

Modify only `automations/test/onlineDailyV73ReplayCorpusContract.test.mjs` to add five precise RED cases. Preserve the accepted positive fixture shape until the GREEN step so failures prove the missing review contracts rather than setup drift.

### Git Status

- Repair starting head: `feea0f62bc331326190d157d9fb1aa8a32ca5c86`.
- PR: #107, open, no merge or deployment.
- Approved Proposal base: `85fdc7e77c7bec879d2da65d9781b55bb09b670f`.
- Allowed paths remain exactly the original five C5-A paths.
- No collector, harness, workflow, rule, data, CRM/product, or production mutation is authorized.


#### Review Repair RED Evidence

- The first RED commit `c3ac487caffc767db822f512b60d686c7843e3be` is not accepted as valid RED because the two-candidate transaction fixture left `artifact_bindings.replay_corpus.record_count` at one and produced an unrelated setup error.
- Valid RED commit: `abd89047daffc4cc90ec1940e3e1b2633987e9a2`.
- Exact disposable snapshot source: GitHub API tarball for that SHA under a fresh `mktemp` directory; no local CRM checkout/worktree read or write.
- Both schema `jq empty` checks: PASS.
- Implementation and focused-test `node --check`: PASS.
- Focused suite: expected FAIL, 23 total, 16 passed and 7 failed.
- The seven failures are contract-local and cover exactly the review gaps: self-binding schema, structured requested-action schema, nullable self Git blob SHA, structured action runtime validation, hard-exclusion second-pass rejection, candidate-specific transaction binding, and complete-window canonical enforcement.
- No import, path, syntax, environment, or remaining fixture-setup failure exists in the accepted RED run.
- Next action: implement the minimal schema/validator/positive-fixture changes, then rerun the exact focused suite for GREEN.
- Branch head before this RED checkpoint update: `abd89047daffc4cc90ec1940e3e1b2633987e9a2`; PR #107 remains open and unmerged.


#### Review Repair GREEN Evidence

- Minimal atomic GREEN commit: `d5879d9356c363a9c42d31ba3d73069fb0b08a45`.
- GREEN changed only the two replay schemas, the pure replay-contract module, and the focused fixture test.
- The corpus schema now gives the replay-corpus self binding a nullable Git blob SHA while retaining required canonical payload SHA-256, record count, and validation status; all non-self artifact bindings still require a Git blob SHA.
- Requested actions are now closed `{ gate_id, action }` records with the exact evaluator gate and action enums, preserving the existing decision-path output without lossy conversion.
- The pure validator rejects hard-excluded candidates from eligible, selected, and attempted second-pass sets; requires an attempted candidate to reference its own transaction; and requires every retained window date to be canonical and healthy.
- The positive fixture now mirrors the real structured requested-action shape and uses an unavailable self Git blob SHA until a later window manifest binds the committed corpus blob.
- Exact disposable GREEN snapshot source: GitHub API tarball for `d5879d9356c363a9c42d31ba3d73069fb0b08a45` under a fresh `mktemp` directory.
- Both schema `jq empty` checks: PASS.
- Implementation and focused-test `node --check`: PASS.
- Focused suite: PASS, 23/23.
- Next action: run the required full regression and purity/scope checks from an exact GitHub API snapshot after this checkpoint update.
- Branch head before this GREEN checkpoint update: `d5879d9356c363a9c42d31ba3d73069fb0b08a45`; PR #107 remains open, unmerged, and undeployed.


#### Review Repair Full Verification

- Exact full-verification head: `bae54c9631a0f6e3181234a5f8e3d6d48c9b8e6d`.
- The disposable repository was created under a fresh `mktemp` directory by committing the exact Proposal SHA `85fdc7e77c7bec879d2da65d9781b55bb09b670f` as the baseline and then overlaying the exact full-verification head.
- Proposal-to-head changed-path guard: PASS, exactly the original five approved paths.
- Proposal-to-head staged `git diff --check`: PASS.
- Both schema `jq empty` checks: PASS.
- Implementation and focused-test `node --check`: PASS.
- The repository has no `package-lock.json`; `npm install --package-lock=false --no-audit --no-fund` installed the declared dependencies without generating one.
- Focused contract suite: PASS, 23/23.
- `npm run test:daily-v4`: PASS, 229/229.
- `npm run verify:all`: PASS, including frontend/backend/functions tests, Daily V4, automation diagnostics, Lead Assistant, Sourcing Learning, Daily heartbeat, all typechecks, sourcing-v6-4 compatibility, July 15-29 liveness replay, Daily contract validation, temporary frontend build, and diff-check.
- Explicit pure-module scan for filesystem/network/environment/current-time/locale/random dependencies: PASS.
- Final working-tree `git diff --check`: PASS.
- Final disposable snapshot status: clean.
- `package-lock.json` absence after installation: PASS.
- No local CRM checkout/worktree read or write occurred.

### Review Repair Remaining

- Reply to each of the five review threads with the implemented contract and validation evidence.
- Resolve those five threads after the replies succeed.
- Recheck PR head/base, thread state, changed paths, mergeability, workflow/status state, and no-merge/no-deployment boundary.

### Review Repair Next Action

Use the verified exact head to complete the authorized GitHub review-thread writes. Do not merge, retarget, deploy, activate, or start C5-B/C.

### Review Repair Git Status

- Repair-start checkpoint: `6fb9cad7d7d162bfb222db48bdd4674130724281`.
- Valid RED: `abd89047daffc4cc90ec1940e3e1b2633987e9a2`.
- RED checkpoint: `4e70ffee214b98976adbac736183bf8a84c0320b`.
- Atomic GREEN: `d5879d9356c363a9c42d31ba3d73069fb0b08a45`.
- GREEN checkpoint and exact full-verification head: `bae54c9631a0f6e3181234a5f8e3d6d48c9b8e6d`.
- This final checkpoint update changes only the already-approved checkpoint path; its exact commit is reported in the final handoff.
- PR #107 remains open. No merge, deployment, workflow run, production artifact, or activation occurred.
