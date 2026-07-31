# PR C V7.3 Historical Production Replay Feasibility Diagnosis

Date: 2026-07-30  
Phase: Phase 1 Diagnosis only  
Branch: `codex/pr-c-c4-v73-production-replay`  
Frozen parent: `e0d0b2ac71849ac135d68f124c17e7262772c144`  
Repository snapshot: GitHub API only; no local CRM checkout/worktree was read or modified

## Current Goal

Determine whether the immutable remote artifacts for 2026-07-15 through 2026-07-29 contain enough historical evidence to feed each real candidate into the V7.3 admission evaluator and the targeted second-pass decision, without live source calls, AI, semantic invention, or mutation of production artifacts.

This diagnosis does not implement a replay harness, change a rule, schema, workflow, test, or production artifact, run the generator, sync a report, create a PR, merge, or deploy.

## Executive Verdict

**The fixed 2026-07-15 through 2026-07-29 corpus cannot support an honest, repeatable V7.3 production decision replay.**

What is repeatable today is only the historical liveness summary of already-recorded V6.8/V7.0/V7.2 outputs: 15 reports with zero published Leads, 14 schema-v1 candidate artifacts, and their old missing-gate summaries. It is not a replay of the historical candidates through V7.3.

The blocking reasons are data loss, not harness absence:

1. 2026-07-15 has no candidate artifact and no recoverable run artifact containing candidate rows.
2. All 14 candidate artifacts in the target window are schema v1. They retain audit summaries, not the raw normalized evidence objects consumed by V7.3.
3. Schema v1 does not retain typed Demo/Playtest or gameplay evidence, independent-quality proofs and source roles, typed non-Steam business entrypoints, the concrete China/Bilibili thesis, evidence-to-URL attribution, raw media signals, or second-pass fetched patches.
4. The original Proposal's two-evidence-family acceptance rule is not equivalent to the frozen branch's two-independent-public-source evaluator.
5. The current activation test re-summarizes the old zero-output baseline. It never converts historical candidate records into V7.3 evidence and never calls the targeted second-pass provider on historical signals.

Therefore this checkpoint makes **no claim** that the 10-of-15 nonzero target is met.

## Frozen Boundary Verification

- Proposal path: `/Users/neo/.codex/visualizations/2026/07/29/019fae39-ee18-7371-a79d-366d352fcb6b/CRM_DAILY_LEADS_LIVENESS_PROPOSAL_CN.md`
- Observed Proposal SHA-256: `43b89ed69f9fb1127b2f749440b183717dcede49168acbab88ad167b505dde09`
- Required Proposal SHA-256: identical.
- Current remote `main`: `f93a937aaaa7e688f233ab4ba0b9a97930c7b0c7`, identical to the supplied current SHA.
- Comparing old baseline `166afdd759f5d3a4a6fff005e9293a906bda44d3` to current `main` returned exactly two commits and only:
  - `data/automation_runs/2026-07-30-afternoon.json`
  - `data/radar/2026-07-30.json`
  - `data/reports/2026-07-30.json`
  - `data/sourcing_candidates/2026-07-30.json`
  - `data/steam_trends/2026-07-30.json`
- No code, rule, schema, workflow, test, or documentation path changed in that comparison.
- `codex/pr-c-v7-3-obtainable-evidence` is identical to frozen parent `e0d0b2ac71849ac135d68f124c17e7262772c144` with zero commits/files of drift.

The diagnosis therefore continued against the immutable frozen-parent snapshot.

## Daily Artifact Availability Matrix

Receipt acceptance below means `status=success` and a parsed `sync_response.synced=true`. Each day has morning, afternoon, and watchdog receipt files. `R` is Radar item count; `S` is Steam Trends item count.

| Date | Candidate artifact | Old rule | Report pools | Accepted receipts | Related artifacts | V7.3 replay input status |
|---|---:|---|---|---:|---|---|
| 2026-07-15 | **missing** | V6.8 report only | push/watch/drop = 0/0/0 | 1/3 | R15, S8 | **unavailable** |
| 2026-07-16 | v1, 261 rows | V7.0 | 0/0/0 | 3/3 | R15, S11 | lossy audit only |
| 2026-07-17 | v1, 266 rows | V7.2 | 0/0/0 | 3/3 | R15, S12 | lossy audit only |
| 2026-07-18 | v1, 273 rows | V7.2 | 0/0/0 | 3/3 | R15, S12 | lossy audit only |
| 2026-07-19 | v1, 269 rows | V7.2 | 0/0/0 | 3/3 | R15, S12 | lossy audit only |
| 2026-07-20 | v1, 277 rows | V7.2 | 0/0/0 | 3/3 | R15, S12 | lossy audit only |
| 2026-07-21 | v1, 273 rows | V7.2 | 0/0/0 | 3/3 | R15, S12 | lossy audit only |
| 2026-07-22 | v1, 271 rows | V7.2 | 0/0/0 | 3/3 | R15, S12 | lossy audit only |
| 2026-07-23 | v1, 274 rows | V7.2 | 0/0/0 | 3/3 | R15, S12 | lossy audit only |
| 2026-07-24 | v1, 275 rows | V7.2 | 0/0/0 | 3/3 | R15, S12 | lossy audit only |
| 2026-07-25 | v1, 271 rows | V7.2 | 0/0/0 | 3/3 | R15, S12 | lossy audit only |
| 2026-07-26 | v1, 279 rows | V7.2 | 0/0/0 | 3/3 | R15, S12 | lossy audit only |
| 2026-07-27 | v1, 280 rows | V7.2 | 0/0/0 | 3/3 | R15, S12 | lossy audit only |
| 2026-07-28 | v1, 280 rows | V7.2 | 0/0/0 | 3/3 | R15, S12 | lossy audit only |
| 2026-07-29 | v1, 282 rows | V7.2 | 0/0/0 | 3/3 | R15, S12 | lossy audit only |

Window totals:

- reports: 15/15;
- candidate artifacts: 14/15;
- candidate records: 3,831, consisting of 3,017 old `candidate` and 814 old `excluded` decisions; no old formal decisions;
- automation receipt files: 45/45; accepted receipts: 43/45;
- Radar artifacts: 15/15;
- Steam Trends artifacts: 15/15;
- report push/watch/drop pools: zero on all 15 dates.

The 2026-07-15 morning and afternoon runs failed generation. The watchdog run generated and validated the report/Radar/Steam Trends and synced successfully, but it did not create a sourcing-candidate artifact. GitHub commit history for `data/sourcing_candidates/2026-07-15.json` is empty, and all three run IDs (`29389223894`, `29401469255`, `29407582358`) report zero uploaded Actions artifacts. The watchdog receipt log tail contains aggregate scan/source-health counts only, not candidate rows or normalized evidence. The day must therefore be marked `unreplayable_missing_input`, not inferred as a V7.3 zero day.

## Schema-v1 Evidence Inventory

Every schema-v1 record has exactly these audit fields:

`decision`, `source_type`, `project`, `steam_app_id`, `dedupe_key`, `sourcing_lane`, `sourcing_rule_version`, `matched_rules`, `missing_evidence`, `exclusion_reasons`, `source_links`, `steam_review_summary`, `ea_state`, and `visual_state`.

Across the 3,831 records:

- 1,260 records carry the old `steam_enriched` marker; the underlying enriched candidate object is not retained.
- 564 carry the old Demo/Playtest pass marker.
- 233 carry the old official-gameplay pass marker.
- 700 carry at least one of those two markers.
- only 3 carry the old `independent_quality_proof` pass marker.
- 1,396 carry the old non-Steam-business-entry pass marker.
- 970 carry the old concrete-China/Bilibili-value pass marker.
- all records have at least one syntactically valid HTTP(S) `source_links` item; there are 8,313 links in total.
- 3,208 records have only Steam/SteamDB/Steam Community links. Only 623 have any other domain, and 174 have a Bilibili URL.

The link presence is useful provenance for discovery, but a generic project/store link is not a typed citation proving a particular V7.3 gate. Schema v1 does not say which link proves Demo, gameplay, quality, business entry, China value, or source independence.

Radar and Steam Trends do not repair this loss. They are small reader-facing subsets: Radar has 15 items/day and Steam Trends has 8–12 items/day, compared with 251–260 Steam candidates and roughly 300+ observed media signals. Their URLs are not a lossless copy of the candidate-source corpus or the targeted second-pass inputs.

## Gate Reconstruction Matrix

Definitions:

- **Reconstructable**: direct stored data can be mapped deterministically, without external calls or semantic invention, into the V7.3 input and its provenance.
- **Partial**: an old pass/missing/fail marker or related value exists, but the raw fact, typed evidence entry, source role, or supporting URL association is missing.
- **Not reconstructable**: the required V7.3 input or historical signal is absent.

The schema-v2 column uses the real 2026-07-30 current-main artifact only as an out-of-window capability control. It is not counted as evidence for the fixed July 15–29 replay. That v2 artifact has 280 records and 260 Steam evidence snapshots; its 20 media records have no equivalent snapshot.

| V7.3 gate/input | Schema v1 in fixed window | Schema v2 capability control | Fixed-window verdict |
|---|---|---|---|
| Identity and dedupe | Direct `project` and `dedupe_key`; nullable AppID | Snapshot carries title/AppID and stable dedupe inputs | **Reconstructable** |
| Prelaunch window and EA | `ea_state` plus old pass/missing/exclusion summaries; no release date/state/window fact | Steam snapshot carries `alreadyReleased`, `releaseTooSoon`, `daysToRelease`, `comingSoon`, `earlyAccess` | **Partial** |
| Publisher/China-capacity hard exclusion | Old matched marker or generic exclusion reason; no publisher/team facts | Steam snapshot carries publishers, `publisherOccupied`, `chinaPartnerOccupied` | **Partial** |
| Non-narrative hard exclusion | Old matched marker and occasional exclusion reason; no description/genre evidence | Steam snapshot carries `narrativeHeavy`, genres, categories, description | **Partial** |
| Non-India-team hard exclusion | Old matched/missing marker; no developer-region evidence | Steam snapshot carries developers/country and `indiaTeam` | **Partial** |
| Official Demo/Playtest or gameplay | Old pass markers, generic links, and screenshot/movie counts; no typed evidence-to-URL record | Steam snapshot carries typed `officialDemoEvidence` and `officialGameplayEvidence` arrays | **Partial** |
| Independent quality and source role | Only an old marker/review summary; no `quality_proofs`, independent source ID, role, or family | Snapshot can carry `qualityProofs`, but the observed entries contain only `type`, `url`, `value`; no role/family field | **Not reconstructable** |
| Non-Steam business entry | Old pass/missing marker and sometimes a non-Steam URL; no typed contact/entrypoint association | Steam snapshot carries typed `contactMethods` | **Partial** |
| Concrete China/Bilibili value | Old pass/missing marker only; no thesis text or supporting citation | 186/260 Steam snapshots carry a value string, but no explicit evidence-to-thesis provenance | **Not reconstructable** |
| Optional China-demand signal | Not retained | Snapshot can carry `chinaDemandEvidence` | **Not reconstructable in window** |
| Candidate source URL | At least one generic URL for every record | Store/SteamDB URLs for all snapshots; website on a subset | Candidate-level **reconstructable**, gate-level provenance **partial** |
| First-pass score/ranking state | Not retained | Snapshot has candidate score but not the complete cross-source selection corpus | **Not reconstructable** |
| Raw media/Bilibili signals and source role | Not retained; `source_type` is only candidate origin, not proof role | Not retained in v2 candidate snapshot | **Not reconstructable** |
| Requested actions, fetched patch, provider result, final pass | V7.3 fields did not exist | v2 predates V7.3 and does not retain the second-pass transaction | **Not reconstructable** |
| Replay-Lead risk | Old missing/exclusion summaries only | No complete final V7.3 risk record | **Not reconstructable** |

A schema-v1 artifact can reconstruct some prior gate outcomes, but that is not equivalent to reconstructing the evidence pack that caused them. Turning `matched_rules` into invented non-empty V7.3 evidence arrays would make a harness deterministic while making its evidence false. This diagnosis rejects that approach.

Schema v2 is materially better for Steam candidates because it retains the normalized enrichment object. It could support deterministic reconstruction of many hard-gate and official-evidence inputs for records with a valid snapshot. It still cannot establish independent source role/evidence family, restore media candidates, or reproduce the targeted second pass. It therefore cannot by itself satisfy the original replay acceptance, and no schema-v2 day exists inside the fixed target window.

## Why the Current Activation Test Is Not a V7.3 Decision Replay

`automations/test/onlineDailyV73ActivationReplayContract.test.mjs` calls `analyzeDailyLeadsLivenessFromRepository` for July 15–29.

`automations/jobs/online_daily_leads_liveness.mjs` then:

1. reads the existing report and candidate JSON files;
2. computes `new_lead_count` from the already-recorded report `push_pool` plus `watch_pool`;
3. counts the already-recorded candidate decisions;
4. aggregates the already-recorded schema-v1 `missing_evidence` strings.

It does not:

- build `steamIndieAdmissionEvidence` or `mediaIndieAdmissionEvidence` from historical raw candidates;
- call `evaluateV73IndiePrelaunchAdmission` for the 3,831 historical rows;
- select historical near-misses for second pass;
- feed captured historical signals to `fetchV73TargetedEvidence`;
- merge a historical fetched patch and re-run the evaluator.

The asserted 15 consecutive zero days and top blockers are therefore an immutable **old-production liveness baseline**, which is useful, but not evidence of what V7.3 would decide.

The seven weak-sample subtest is also fixture-based rather than historical replay. The seven samples are dated July 5–13, outside the fixed window, and the fixture preserves only date, project, AppID, and former priority. The test injects each identity into an otherwise synthetic qualified V7.3 evidence pack and clears `quality_proofs`. It proves that an empty-quality fixture is rejected. It does not reconstruct or replay the seven projects' real historical evidence.

## Two Evidence Families Versus Two Independent Public Sources

The original Proposal requires at least two independent **evidence families**, with at least one from the product itself, and prohibits counting one fact twice. The named families are playability, product performance, external validation, early market signal, team execution, and user feedback.

The frozen V7.3 evaluator instead requires two distinct public **source identifiers** inside `quality_proofs`. It deduplicates by `source_id`, `source`, `publisher`, `outlet`, or URL hostname. Official playable/gameplay is a separate mandatory gate.

These are different acceptance populations:

- Under the Proposal model, an official Demo (playability family) plus one independent hands-on preview (external-validation family) could supply two semantic families.
- Under the current model, the official Demo satisfies only the playable/gameplay gate; quality still needs two independent public sources.
- The current source-count rule can accept two independent outlets from the same semantic family, so it proves source diversity but not family diversity.
- The Proposal rule proves family diversity but does not itself specify the current two-independent-source minimum.

The original 10-of-15 target cannot be calibrated against one model and accepted using the other without an explicit policy decision.

There is a second frozen-parent constraint: the exact provider at `e0d0b2a...` still projects broad official lookup results into `quality_proofs`. The existing PR C checkpoint records Blocker 2 as proposal-only, so project-controlled official/developer/publisher evidence is not yet reliably excluded from an independent slot at this parent. This diagnosis does not implement or reopen that blocker; it records that the frozen code is not an acceptance-ready source-role authority.

## Repeatability Conclusion

| Question | Conclusion |
|---|---|
| Can the artifact availability inventory be repeated? | **Yes**, at the frozen commit. |
| Can the old zero-output liveness summary be repeated? | **Yes**, as a summary of recorded old outputs. |
| Can all 15 days' real candidates be reconstructed? | **No**; July 15 is missing. |
| Can the 14 schema-v1 days be fed into V7.3 without invented evidence? | **No**. |
| Can targeted second-pass selection and evidence results be repeated? | **No**; raw signals, roles, requested actions, fetched patches, and final results are absent. |
| Can current artifacts implement an honest repeatable V7.3 production replay? | **No**. A harness over these files would be a lossy derived simulation, not the Proposal's production replay. |

## Acceptance Items That Cannot Currently Be Verified

1. **15 replay days are complete:** not verifiable because July 15 has no candidate input.
2. **At least 10 of 15 days are nonzero under V7.3:** not verifiable. No numeric pass claim is permitted.
3. **All seven historical weak samples remain rejected by real evidence replay:** not verifiable; only the synthetic empty-quality regression is available.
4. **Every replay Lead has all hard-gate results, qualifying quality evidence, source URL, and explicit risk:** not verifiable because no replay Leads can be produced from lossless evidence.
5. **Targeted second pass changes or preserves each decision deterministically:** not verifiable.
6. **Three-day coverage reaches 85% of deduped Steam candidates and valid snapshots do not consume repeated requests:** not verifiable for the fixed window; v1 lacks lifecycle/scheduler/snapshot fields, and one out-of-window v2 day is not a three-day history.
7. **Human spot-check precision/provisional status:** not verifiable without a replay output corpus.
8. **No candidate is upgraded merely because a day is zero:** the no-quota/no-backfill code invariant can be tested deterministically, but it cannot substitute for the missing real-candidate replay.

For July 15, the only honest statuses are:

- artifact availability: report/Radar/Steam Trends/receipt present;
- candidate replay input: missing;
- replay result: unknown/unreplayable;
- contribution to 10-of-15: neither assumed pass nor assumed V7.3 zero.

Even if a future partial replay found 10 nonzero days among the 14 available days, that could establish a numeric lower bound, but it would not make the specified 15-day production replay complete. Any denominator/window change requires explicit approval.

## Next-Phase Data Options and Trade-offs

| Option | What it provides | Trade-off / acceptance status |
|---|---|---|
| **A. Prospective immutable V7.3 shadow corpus (recommended)** | Capture every normalized candidate before admission, per-evidence URL/source ID/source role/evidence family, hard-gate facts, first-pass result, score, requested actions, the exact bounded second-pass input signal set, fetched patch/error, final result, risk, versions, timestamps, and manifest hashes for the first 15 complete Shanghai days. | Highest integrity and fully repeatable without later web calls; requires a new approved data contract and 15-day collection latency. This is the only option that can honestly replace the missing historical evidence. |
| **B. Deterministic v1 lower-bound corpus** | Map only directly stored identity, URLs, and old status markers; emit `unknown` for every stripped fact and never promote a marker into invented evidence. | Fast and useful for quantifying irrecoverable gaps, hard exclusions, and candidate overlap. It cannot pass 10-of-15, reproduce second pass, or serve as acceptance evidence. |
| **C. Retrospective curated evidence set** | For a bounded stratified sample, attach immutable archived pages/snapshots if they exist and have human-reviewed source roles/families and URLs. | Can help decision-quality calibration and weak-sample review. It is costly and selection-sensitive. If only current live pages are available, it measures current retrospective evidence, not what the historical run knew, and must not be labeled production replay. |

GitHub Actions artifacts do not provide a hidden recovery path for July 15. A broader search for some separate immutable archive would be a distinct diagnosis, and no such archive is established by this snapshot.

## Recommended Minimal Phase 2 Direction

Recommend one Phase 2 Proposal task only:

> **Define and approve `V7.3 Replay Corpus Contract v1` and its acceptance-window policy.**

That proposal should make one policy choice authoritative before any harness work: retain the original two-evidence-family acceptance, adopt the newer official-product-gate-plus-two-independent-sources contract, or explicitly define both as separate gates. It should then specify the lossless per-candidate/second-pass/source-role fields, completeness rules, immutable manifest, and treatment of missing days. The acceptance window should begin on the first day the approved corpus is complete; July 15 must not be silently backfilled or replaced.

Phase 2 should not implement the harness, change admission thresholds, run live sources, or modify production artifacts. Implementation would remain a later separately approved phase.

## Completed

- Verified the Proposal SHA-256.
- Reconfirmed remote main drift is limited to allowed 2026-07-30 automation artifacts.
- Reconfirmed the frozen PR C parent has zero drift.
- Inventoried all repository artifacts for July 15–29 from the frozen GitHub API snapshot.
- Parsed all candidate, report, receipt, Radar, and Steam Trends JSON remotely.
- Checked the missing July 15 candidate path in repository history and its three Actions artifact lists.
- Compared schema-v1 replay inputs with the V7.3 evaluator/second-pass requirements.
- Used the current-main July 30 schema-v2 artifact only as an out-of-window capability control.
- Diagnosed the activation test and weak-sample test boundaries.
- Recorded data options and a bounded Phase 2 recommendation.
- Made no code, rule, schema, workflow, test, production-artifact, PR, merge, deployment, generator, sync, live-source, AI, or local-checkout change.

## Remaining

No work remains in this Phase 1 diagnosis after the checkpoint commit is verified.

The following remain deliberately outside this phase:

- choosing the evidence-family versus independent-source policy;
- proposing the replay-corpus data contract;
- implementing collection or a replay harness;
- resolving separate PR C Blockers 2 or 3;
- integration, PR creation, merge, deployment, or production acceptance.

## Next Action

Stop and await explicit authorization for the single Phase 2 Proposal direction above. Do not enter Phase 2 or integration from this task.

## Git Status

- Diagnosis branch created from exact frozen parent: `codex/pr-c-c4-v73-production-replay` from `e0d0b2ac71849ac135d68f124c17e7262772c144`.
- The only repository path written by this task is `docs/checkpoints/pr-c-v73-production-replay-diagnosis.md`.
- No PR was created.
