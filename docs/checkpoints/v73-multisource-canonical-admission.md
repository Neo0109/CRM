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
- Traced the mismatch to two competing canonicalization policies: the selector filters and ranks source-lane admissions before dedupe, while the collector independently sorts merged regular admissions and retains the first Steam entry on an exact tie.
- Reproduced the live `steam:3473430` shape offline: the Steam lane has four supported gaps and is provider-ineligible, while the same-dedupe media lane has only `independent_quality_proof` missing and is eligible. The selector calls the injected fake provider with `source_type=media`, but the collector persists `_All Our Broken Parts` from Steam instead of `爱与机器人维修技术` from media.
- Added the RED integration fixture across selector order, collector candidate state, receipt finalization, and collector-v2 stored/recomputed replay. The four focused V7.3/corpus files run 90/91 with exactly the expected canonical-winner assertion failing; all pre-existing tests remain green.
- Published RED commit `95acb4aa3394fc7a5912b90e902a9a8995314634`.
- Centralized same-dedupe source selection in `selectV73CanonicalSecondPassCandidates`: provider-eligible sources win over ineligible sources, then the existing actionability, action-count, score, dedupe-key, and source-type ordering remains exact.
- Bound the selector's deterministic `{dedupe_key, source_type}` winners directly into the collector decision universe. Both first and final admissions now remain on that same source, so collector eligibility/rejection and collector-v2 replay consume the exact provider-selected admission input.
- The live-shape fixture is GREEN: provider source is media, the stored project is `爱与机器人维修技术`, candidate eligibility is true with no rejection, receipt finalization is complete, the corpus validates, and stored/recomputed replay hashes match.
- Local validation is green: focused V7.3/corpus files 91/91, all V7.3 tests 121/121, Daily V4 336/336, syntax checks, replay-schema JSON parsing, and full `npm run verify:all` exit 0. The full verification used an external no-index adapter only for its final `git diff --check`, because the authorized snapshot intentionally has no `.git` directory.
- Scope audit shows exactly four repository changes: two V7.3 implementation files, one V7.3 test file, and this checkpoint. Workflow, provider, rule, CRM, schema, synchronization, and generated-data trees are unchanged.

## Remaining

- Publish the GREEN commit and one Ready PR.
- Wait for remote checks and root Release Captain independent QA; do not merge.

## Next Action

Publish the bounded GREEN commit and Ready PR, then stop for root independent QA.

## Git Status

- Branch: `codex/v73-multisource-canonical-admission`.
- Base: `cb4c5298e3ea916fdaa5546a3c70212534a10ca4`.
- RED head: `95acb4aa3394fc7a5912b90e902a9a8995314634`.
- Expected PR scope: four files (two implementation, one test, one checkpoint).
- Working medium: disposable non-git snapshot; all repository mutations use the GitHub API.
