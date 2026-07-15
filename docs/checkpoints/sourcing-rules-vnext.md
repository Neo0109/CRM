# Sourcing Rules VNext Checkpoint

Date: 2026-07-15

Status: Read-only root-cause diagnosis complete. No rule, product behavior, UI, Lead data, or workflow trigger has been changed.

## Baseline

- Remote repository: `Neo0109/CRM`
- Remote baseline: `origin/main` = `f564a9b722eb35c251b0c869f5bdc010f27cfc2e`
- Local branch: `codex/sourcing-rules-vnext` at the same commit
- Open PR queue: `#71 Move Weekly Report styles to owner stylesheet` only; unrelated to Sourcing
- Previously completed relevant slices: PR `#84` Steam evidence integrity and PR `#86` non-game animation Lead gate
- Current active rules: `docs/SOURCING_RULES_CURRENT.md`
- Proposed inputs: `docs/SOURCING_RULES_INPUT.md`

## Current Goal

- Diagnose why current CRM daily Sourcing promotes low-quality Steam games, including incorrect P1 decisions and quantity-driven P2 output.
- Reconstruct the user's historical rules from seven screenshots and compare them with the complete remote-main rule, scoring, pool-routing, and daily-generation chain.
- Produce an approval-ready rule interpretation and file-level modification plan without changing active rules, code, UI, product behavior, existing Lead data, or workflow triggers.

## Completed

- Created `docs/SOURCING_RULES_INPUT.md` as a draft input workspace.
- Created this checkpoint file.
- Added Sourcing maintenance guidance to `AGENTS.md`.
- Added the long-task checkpoint protocol to `AGENTS.md`.
- Added context-budget management requirements to `AGENTS.md`.
- Added task-size control requirements to `AGENTS.md`.
- Added task-scope control requirements to `AGENTS.md`.
- Verified remote `main`, local checkout identity, current branch, dirty state, and open PR queue.
- Verified PR `#84` and PR `#86` are merged and will not be reopened without concrete regression evidence.
- Preserved all pre-existing local documentation changes; no active Sourcing rule or product code has been modified.
- Re-verified through the connected GitHub source that remote `main` remains `f564a9b722eb35c251b0c869f5bdc010f27cfc2e` and the only open PR is unrelated PR `#71`.
- Re-verified the local checkout is `Neo0109/CRM`, branch `codex/sourcing-rules-vnext`, and local `HEAD` matches the remote-main baseline.
- Read all seven screenshots in sequence and reconstructed the historical rule evolution.
- Identified the historical decision order as: commercial intervention window -> product quality and Bilibili amplification value -> verified evidence/contact/report completeness.
- Confirmed the historical service standard was explicitly quality-first: weak volume was not required, report slots could remain sparse, and known/user-supplied projects were not valid new leads without incremental information.
- Classified screenshot rules into hard exclusions, positive preferences, observation/verification conditions, and exceptions; detailed comparison with executable rules is pending.
- Read the active rule entrypoint, canonical V6 document, machine-readable rule JSON, daily prompt, runner, generator, Steam source/enrichment, media/Bilibili source/enrichment, score/decision, pool construction, dedupe, report builder, schemas, validator, CRM importer, and frontend bucket workflow.
- Confirmed the cloud entrypoint does not execute `automations/prompts/daily_scan.md`; that prompt is only printed by the standalone `daily:prompt` helper. The active generator is deterministic JavaScript.
- Confirmed most prose guardrails in `automations/rules/daily-report.json` are not interpreted by the generator. Runtime config currently consumes media sources, media age/low-score thresholds, probe config, and Radar diversity; business rules are duplicated as hard-coded heuristics.
- Confirmed Steam `strongGameplay` is a genre/description keyword match and `highVisual` means four screenshots or one movie, not a quality judgment. A domestic Upcoming candidate can reach P1 without review-quality, Demo-quality, or commercial-need proof.
- Confirmed media P1 uses duplicated source/topic keywords: media source score is added again to Bilibili/domestic/Demo/genre bonuses, so relevance metadata can cross the P1 threshold without product-quality evidence.
- Confirmed media leads without Steam cross-check hard-code `early_access=false`, `narrative_heavy=false`, `india_team=false`, and use the source URL as a fallback contact, allowing exclusion/contact requirements to appear satisfied without proof.
- Confirmed the active report and generator still label themselves V6.5 while the validated rule version is V6.7, weakening traceability.
- Confirmed schemas and contract tests validate shape, links, non-empty contact arrays, dedupe, release text, and volume, but do not validate visual quality, Demo/review quality, gameplay completeness, developer need, Bilibili incremental value, or P1 precision.
- Confirmed both push and watch pools import into the same `未处理` inbox and retain P1/P2, so weak P2 items still consume the user's review queue; the existing `观察池` is a human decision bucket, not an upstream pre-Lead funnel.
- Re-verified remote `main` on 2026-07-15 at `f564a9b722eb35c251b0c869f5bdc010f27cfc2e`; open PR `#71` remains unrelated.
- Confirmed production `/api/health` is healthy at `v2.7.6-sourcing-evidence-integrity` with `storage=supabase`.
- Confirmed 2026-07-14 produced no valid daily report: morning, afternoon, and watchdog receipts all have `status=generation_failed`, no report path, and no sync response; remote `main` has no `data/reports/2026-07-14.json`.
- Classified the 2026-07-14 failure as `generation`: private evidence fields leaked into report/Steam Trends payloads and failed schema validation, so the run never reached validation/sync success.
- Quantified the seven latest available reports from 2026-07-05 through 2026-07-13: 21 non-drop review Leads, including 14 P1 and 7 P2.
- Confirmed all 7 direct Steam candidates in that sample explicitly say they lack wishlist/reputation/community strong data, yet 4 of those 7 were promoted to P1.
- Confirmed none of the 21 review Leads carries numeric product-quality evidence such as review count, positive-review rate, wishlist volume, concurrent-player peak, or sales.
- Confirmed report samples match the code-level diagnosis: P1 can be awarded from domestic/source/genre/screenshot metadata even when `strongData` is false, while media/Bilibili source scores can assign P1 without verified product-quality evidence.
- Confirmed current CRM review volume includes historical inventory: because 2026-07-14 never synced, current low-quality Leads cannot be treated as a successful post-V6.7 production sample and substantially reflect 2026-07-13-or-earlier imports.
- Confirmed prompt compression is not the cause of the active cloud behavior: the workflows invoke `online_daily_runner.mjs`, which imports the deterministic `online_daily_v4.mjs`; `daily_scan.md` is not executed by the cloud path.
- Identified the primary product-objective mismatch: the runtime optimizes discovery/review volume and source relevance, while the user needs precision among the few Leads that consume BD attention.
- Identified the primary ranking mismatch: P1 thresholds can be crossed by domestic/source/genre/screenshot/detail/contact points without any positive quality/traction evidence; negative `strongData=false` is reported as a risk but does not block P1.
- Identified the quantity-forcing mechanism: a target of 18 review Leads triggers backfill from otherwise dropped domestic candidates and upgrades P3 to P2 before import.
- Identified the routing mismatch: candidate generation and formal recommendation are not separated; both push and watch pools are imported into the same `未处理` queue, so P2 is operational work rather than a low-cost observation pool.
- Identified the rule-execution mismatch: much of the human and JSON rule prose is documentation/guardrail text, while business decisions remain duplicated as hard-coded heuristics; important requirements can be stated without being executable gates.
- Identified the evaluation mismatch: tests protect structure, penalties, pool stability, volume targets, and known regressions, but there is no expert-labeled golden set or Precision@K/P1 acceptance gate preventing visually weak products from ranking highly.
- Researched primary sources for the corrective pattern: two-stage candidate generation/ranking, expert relevance judgments, top-K ranking evaluation, simple observable objectives, and human-feedback learning.

## Remaining

- Present the diagnosis and evidence to the user.
- If the user approves a separate implementation task, convert the diagnosis into an approval-ready rule/architecture plan and TDD slice without mixing in UI or workflow-trigger changes.

## Next Action

- Present the root-cause diagnosis. Do not implement until the user approves a separate change task.

## Git Status

- Branch: `codex/sourcing-rules-vnext`
- Base/remote truth: `origin/main` at `f564a9b722eb35c251b0c869f5bdc010f27cfc2e`
- Pre-existing local changes: modified `AGENTS.md`; untracked `docs/SOURCING_RULES_INPUT.md` and `docs/checkpoints/`.
- This checkpoint update is documentation-only and required by the Long Task Checkpoint Protocol.
- No business code, active rule, generated report, existing Lead data, or workflow has been changed.
- Current working tree remains: modified `AGENTS.md`; untracked `docs/SOURCING_RULES_INPUT.md` and `docs/checkpoints/`.

## Scope

- Read-only root-cause diagnosis and approval plan for the next sourcing-rules iteration.
- Keep current executable rules, historical inputs, and proposed rules visibly separated.

## Explicit Non-Scope

- CRM product behavior.
- CRM UI.
- Existing lead data.
- GitHub Actions trigger structure.

## Validation

- Baseline, screenshot sequence, executable rule-chain checks, production health, receipt classification, production sample/hypothesis validation, and primary-source external research complete.

## Root-Cause Conclusion

1. The system optimizes candidate/review volume, not BD attention precision.
2. Steam P1 is a metadata score, not a product-quality score: source, domestic classification, genre keywords, screenshots/movie presence, details, and contact can outweigh missing traction evidence.
3. Media/Bilibili P1 similarly rewards source/topic relevance and can assert unknown exclusion fields as false before verification.
4. The 18-Lead target explicitly backfills weak domestic drops into P2 and both P1/P2 enter `未处理`, converting a discovery funnel into mandatory human review.
5. Rule prose, machine-readable rule text, runtime heuristics, report labels, and tests are not governed by one executable decision contract.
6. The current production queue mixes historical imports with current expectations; 2026-07-14 never produced or synced a valid post-V6.7 report.

## Screenshot Rule Reconstruction

- Initial contract: PC-first/mobile-support discovery for Bilibili publishing, with verified facts, concrete direct contact, risk analysis, investment/publishing judgment, explicit Bilibili fit, and no vague or guessed fields.
- Priority principle: product potential, quality, differentiation, competitive context, commercial timing, and publishing value outrank team/contact/funding completeness.
- Business lanes: early independent-game publishing is high-risk/high-share and requires very early leverage; proven 2A/3A China joint publishing/marketing is lower-share but supported by a larger revenue base.
- Hard exclusions by default: narrative-led games, India-based developers, already-commercialized PC Early Access, unverified status/contact, bare links, vague language, and recycled known titles without incremental information.
- Early Access exception: only a narrow mobile/China-license or otherwise non-replaceable publishing-leverage case; public traction alone is not sufficient.
- Positive preference: pre-launch projects with a strong Demo or other verified quality signal, clear content/China-market amplification room, and a credible reason the developer still needs a publisher.
- Report exemplar: two qualified leads were acceptable; the report did not fill a quota with weak projects and asked focused questions where thresholds were genuinely undecided.
- Latest correction: discovery must come from the sourcing system, information value outranks template completion, and user-supplied/already-known projects must be deduped rather than reissued as new leads.

## Rollout Status

- Not implemented.
- Not active in production.
