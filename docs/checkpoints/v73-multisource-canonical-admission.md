# V7.3 multi-source canonical admission binding

## Current Goal

Repair the collector-v2 replay-corpus mismatch for one dedupe key observed through both Steam and media when those source lanes produce different first-pass admissions. Bind selector ordering, candidate eligibility/rejection, and offline replay to the same canonical source/admission winner.

## Baseline

- Remote `main`: `cb4c5298e3ea916fdaa5546a3c70212534a10ca4`.
- Base tree: `64a3724300234dfb410274217be8dba8d0a2c482`.
- Open PRs before this hotfix: none.
- Production `/api/health`: HTTP 200, `ok=true`, version `v2.8-communication-follow-up`, `storage=supabase`.
- Live regression shape: dedupe key `steam:3473430` appears in Steam and media with source admissions that disagree.

## Problem and Cost of Inaction

The selector independently ranks source-lane entries and then deduplicates them, while the collector merges matching sources into one candidate and chooses its first-pass input by a different implicit source order. Offline replay evaluates the stored collector input. If the two source admissions disagree, run-level `eligible_order` can describe one lane while candidate-level eligibility/rejection and replay describe the other. The fail-closed corpus contract then rejects a natural run and prevents the Activation observation window from advancing.

## Scope

- Reproduce the exact Steam-plus-media, same-dedupe shape for `steam:3473430` with differing admissions.
- Define one deterministic canonical source/admission winner.
- Reuse that winner for selector eligibility/order, collector candidate eligibility/rejection and stored first-pass input, and collector-v2 offline replay.
- Preserve existing max-12, actionability-first ordering, dedupe stability, provider failure isolation, privacy, integrity, and historical collector-v1 behavior.

## Explicit Non-Goals

- Do not change provider authority, supported actions, sourcing rules, formal Lead gates, workflows, CRM/UI/API, Supabase, schemas, synchronization, or generated data.
- Do not dispatch or rerun workflows, call a provider, deploy, merge, or write production data.
- Do not combine any other Activation or sourcing-quality repair into this PR.

## Engineering Method

Use TDD RED to encode the live multi-source fixture and prove selector/collector/replay disagreement. Implement the smallest pure canonical-binding change, then run focused V7.3/corpus tests, Daily V4, and the full repository verification contract.

## Completed

- Reconfirmed the exact remote base, empty PR queue, recent completed Actions, and healthy production API.
- Created `codex/v73-multisource-canonical-admission` from the frozen base.
- Created a disposable non-git snapshot; the user's CRM worktree remains read-only.

## Remaining

- Trace the live source/admission binding and publish a RED commit.
- Implement the minimal shared canonical winner and reach GREEN.
- Run all required local and remote checks.
- Publish one Ready PR for root Release Captain independent QA; do not merge.

## Next Action

Add the failing `steam:3473430` mixed-source fixture without changing production code.

## Git Status

- Branch: `codex/v73-multisource-canonical-admission`.
- Base: `cb4c5298e3ea916fdaa5546a3c70212534a10ca4`.
- Working medium: disposable non-git snapshot; all repository mutations use the GitHub API.
