# PR C V7.3 Replay Corpus Contract v1 Proposal

Date: 2026-07-30  
Phase: Phase 2 Proposal complete; Phase 3 explicit approval required  
Branch: codex/pr-c-c5-v73-replay-corpus-contract-v1  
Frozen parent: f9b34cc83623f25327a2148c8d833ef65c96a753  
Repository workflow: GitHub App/API only; no local CRM checkout/worktree read or write

## Current Goal

Define an approval-ready V7.3 Replay Corpus Contract v1 and a replacement acceptance-window policy that can prove what the exact V7.3 decision chain would have produced from immutable public evidence, without later web calls, semantic invention, quantity pressure, or production mutation.

This checkpoint is the only path changed by this Phase 2 task. It does not implement a collector, schema, validator, replay harness, evaluator, provider, workflow, production artifact, integration, PR, merge, deployment, live source call, generator run, or CRM sync.

## Executive Recommendation

Approve the following four-part policy as one bounded Phase 3 decision:

1. **Evidence authority:** use the current V7.3 official-product gate plus two independent public quality sources. Persist evidence-family metadata for audit and later calibration, but do not add family diversity as a third admission gate in Contract v1.
2. **Evidence source:** replace the impossible July 15-29 historical replay with a prospective immutable V7.3 shadow corpus. Shadow decisions must never enter the production report, candidate pools, Lead payload, or CRM sync.
3. **Acceptance window:** use 15 consecutive Asia/Shanghai natural dates. An incomplete date invalidates that window; the next candidate window starts on the first subsequent complete date. Do not skip, extend around, backfill, or replace missing dates.
4. **Activation boundary:** only a later replay/acceptance task may decide whether the completed window supports V7.3 activation. Contract, shadow collection, replay tooling, observation, and activation remain separate approvals and small PRs.

## Overall Progress Checkpoint

- Remote main at Phase 2 start: f93a937aaaa7e688f233ab4ba0b9a97930c7b0c7.
- Frozen PR C parent: e0d0b2ac71849ac135d68f124c17e7262772c144.
- Blocker 2 completed branch: 63ad52bba4ce4dcd3964117286d277a71dc2d2ef; not integrated.
- Blocker 3 completed branch: 043c62fdd1c9e10c235e79723ee5aca6cea541c7; not integrated.
- Replay diagnosis branch: f9b34cc83623f25327a2148c8d833ef65c96a753; exactly one diagnosis checkpoint commit ahead of the frozen PR C parent.
- Open PR queue at Phase 2 start: unrelated PR #71 only.
- Current module: replay-corpus authority, provenance, completeness, canonical-run selection, and acceptance-window policy only.
- Explicitly untouched: blocker integration, admission/ranking/quantity implementation, candidate lifecycle behavior, workflow triggers, CRM sync, product/UI/API, Supabase, production artifacts, PR D/E, existing Leads, merge, deployment, and activation.

## Concrete Problem

The July 15-29 artifacts can repeat the old zero-output liveness summary, but cannot repeat V7.3 decisions:

- July 15 has no sourcing-candidate artifact.
- The other 14 dates contain only schema-v1 audit summaries.
- Existing schema v3 adds failed-gate and next-action summaries but still omits the exact first-pass evidence pack, source role/family, second-pass selection order, provider input signals, fetched patch/error, and final-pass transaction.
- PR B snapshots preserve normalized Steam enrichment for seven days, but do not preserve the media candidate universe or the run-wide targeted second pass.
- The current activation replay test reads old output counts; it does not call the V7.3 evaluator over real historical candidates.
- The original two-evidence-family wording and the current two-independent-source evaluator accept different populations.

The blocker is therefore missing decision input history, not missing harness code.

## Cost of Inaction

Without a prospective lossless corpus:

- Blocker 2 and Blocker 3 can be code-GREEN while the integrated rule still lacks real acceptance evidence.
- A harness could be deterministic only by promoting old markers into invented evidence.
- The 10-of-15 target, weak-sample quality, second-pass behavior, and 85% evidence coverage would remain unprovable.
- Future rule/provider changes could silently change the accepted population without a comparable baseline.
- Integration would prove code health but not authentic product output, and a zero day could create pressure to weaken gates or add backfill.

## Why This Operation Is Necessary and Next

Blocker 2 has closed source-role leakage, and Blocker 3 has closed schema-v3 inheritance of PR B integrity. The remaining blocker is evidence needed to validate their combined V7.3 behavior. A shadow corpus is the smallest architecture boundary that can acquire that evidence without activating V7.3, writing Leads, or changing the current V7.2 production decision.

The contract must precede collector or harness implementation because it defines which facts are authoritative, what is forbidden to retain, how a day becomes eligible, and which missing states invalidate acceptance.

## Engineering Principle

Use an immutable event/corpus boundary:

- Capture normalized facts before admission.
- Persist exact evaluator inputs and outputs, not reconstructed interpretations.
- Separate public evidence provenance from the decision result.
- Capture second-pass selection and provider transactions as bounded immutable events.
- Replay through the same pure evaluator with network disabled.
- Bind every artifact through canonical JSON and content hashes.
- Keep production delivery health, shadow business liveness, and human precision as distinct dimensions.
- Treat unknown observed evidence as a valid captured value; treat missing capture as an invalid corpus.
- Never let a replay or shadow result feed production publication.

This keeps the existing sourcing-candidate audit focused on operations while the replay corpus owns acceptance evidence.

## Evidence-Authority Policy Options

| Option | Acceptance meaning | Effect on current V7.3 | Replay implication | Decision |
| --- | --- | --- | --- | --- |
| A. Two evidence families with at least one product family | An official Demo can provide one family and one external preview another | Lowers the current two-independent-source boundary and makes Blocker 2 less decisive | Requires a new evaluator and a new population baseline | Not recommended |
| B. Official Demo/Playtest or gameplay plus two independent public sources | Product testability is mandatory and quality requires two positively independent sources | Preserves the current machine rule, evaluator, V7.3 document, and Blocker 2 intent | Replay can compare the exact already-approved decision function | **Recommended for Contract v1** |
| C. Official product gate, two independent sources, and two distinct evidence families | Adds semantic diversity on top of current source diversity | Tightens the rule and may materially reduce output | Requires separate calibration and rule approval before the corpus can be interpreted | Defer to a later rule proposal |

### Authoritative Contract v1 Choice

Under the recommended Option B:

- official Demo/Playtest or official gameplay remains one mandatory any-of gate;
- quality_proofs must contain at least two distinct positively independent public source identifiers;
- project official, developer, publisher, keyword, missing-role, and unclassified Bilibili signals never consume an independent-quality slot;
- Bilibili media and trusted_creator roles may qualify; external non-Bilibili media remains eligible;
- evidence_family is mandatory provenance with the values playability, product_performance, external_validation, early_market_signal, team_execution, or user_feedback;
- evidence-family diversity is reported, not used as an admission gate in v1;
- a later proposal may analyze whether family diversity should become policy, but it cannot reinterpret this acceptance window after collection begins.

Explicit user approval is required before this choice becomes authoritative.

## Artifact Separation

The following are proposed future implementation paths; this Phase 2 task creates none of them:

- schemas/sourcing_replay_corpus.schema.json
- data/sourcing_replay_corpus/YYYY-MM-DD/<run-id>-<attempt>-<slot>.json
- schemas/sourcing_replay_window.schema.json
- data/sourcing_replay_windows/<start-date>_<end-date>.json

The existing data/sourcing_candidates/YYYY-MM-DD.json remains the operational candidate/state audit. The replay corpus is separate because it has different retention, immutability, provenance, and acceptance responsibilities.

Per-run artifacts are append-only and keyed by GitHub workflow run identity. A later immutable window manifest selects canonical runs and binds their hashes. No acceptance process may overwrite an earlier run, delete a failed attempt, or select only favorable output.

## V7.3 Replay Corpus Contract v1

### 1. Run Identity and Contract Header

Every per-run corpus requires:

| Field | Contract |
| --- | --- |
| contract_version | Integer 1 |
| corpus_id | Stable report-date/run-id/run-attempt/slot identity |
| report_date | Asia/Shanghai YYYY-MM-DD |
| timezone | Literal Asia/Shanghai |
| captured_at | ISO timestamp |
| event_name | schedule, watchdog, or workflow_dispatch |
| run_slot | morning, afternoon, watchdog, or manual label |
| workflow_run_id / run_attempt / run_url | Exact GitHub run identity |
| input_commit_sha | Repository commit checked out before generation |
| node_version | Runtime major/minor used by the decision path |
| active_production_rule_version | The actual production rule for the underlying Daily run |
| shadow_rule_version | Literal sourcing-rules-v7.3-obtainable-evidence |
| collector_contract_version | Versioned shadow collector contract |
| behavior_contract_sha256 | Canonical hash of the exact decision dependency manifest |
| capture_status | complete, incomplete, corrupt, or unreplayable |
| capture_errors | Structured stage/code/message list; empty when complete |

Data-only commits may change input_commit_sha between days. Window continuity is governed by behavior_contract_sha256, not the whole repository commit.

### 2. Behavior Dependency Manifest

behavior_manifest is a sorted map of repository path to exact blob SHA for every transitive decision dependency, including:

- V7.3 evaluator and regular-admission composition;
- retained V7.2 china_joint evaluator;
- Steam/media evidence normalizers;
- targeted second-pass selector/provider with the approved Blocker 2 classification;
- dedupe/publication selection;
- candidate-state snapshot contract;
- machine-readable rule JSON;
- source-role classifier and provider configuration;
- corpus builder, schema, canonicalizer, and replay harness version.

The manifest builder must fail closed if a loaded decision module is absent from the declared dependency set. behavior_contract_sha256 is the hash of that canonical sorted manifest. Any behavior hash change invalidates an active 15-day window and requires a new one.

### 3. Artifact Bindings and Delivery Health

artifact_bindings records path, Git blob SHA when available, canonical payload SHA-256, record count, and validation result for:

- report;
- sourcing-candidate artifact;
- replay corpus;
- Radar and Steam Trends for provenance only;
- the matching automation receipt.

delivery_health separately records generation_status, validation_status, receipt status, sync_response.synced, source-health summaries, and failure stage.

A corpus may faithfully capture a provider error and still be capture_status=complete. Source health remains a separate field. A date becomes acceptance-eligible only when the canonical underlying Daily run has successful generation and validation plus status=success and sync_response.synced=true.

### 4. Budgets and Discovery Universe

budgets freezes every decision-relevant limit:

- maxCandidates;
- maxSteamDetails;
- PR B lane allocation and snapshot TTL;
- second-pass maximum candidates, currently 12;
- actions per second-pass candidate, currently one to three;
- provider/source request and retry limits.

discovery_summary records raw/retained counts and failures by source. The corpus retains every deduped normalized Steam and media candidate presented to either regular lane, not only the selected or formal candidates.

To control repository growth:

- retain normalized decision inputs and referenced public signals only;
- deduplicate repeated evidence into a run-level evidence_catalog;
- reference catalog evidence IDs from candidate records;
- never store raw HTML, response headers, cookies, tokens, secrets, runtime cache files, or full private CRM indexes;
- do not truncate a field after it influenced a decision; an artifact exceeding the approved byte budget is incomplete rather than silently lossy.

### 5. Evidence Catalog

Each evidence_catalog item requires:

- evidence_id;
- evidence_type and gate_id;
- canonical public URL with credentials and tracking secrets removed;
- source_id;
- source_role: official, developer, publisher, media, trusted_creator, keyword, or unclassified;
- evidence_family;
- captured_at;
- public title/normalized bounded summary used by the provider;
- content_sha256 over the retained normalized public content;
- source_status and any fetch error;
- official_public_business_entry boolean when the item is a non-Steam contact/entrypoint.

Only positively classified media or trusted_creator Bilibili evidence, or eligible external media, may be referenced by an independent quality proof. Public official business endpoints may be retained; private/personal contact data may not.

Generic source_links cannot substitute for a gate-level evidence reference.

### 6. Candidate Record

Every candidate record requires the following sections.

#### Identity and discovery

- candidate_id, project, steam_app_id, dedupe_key, source_type, source lane, and all origin signal IDs;
- first_seen, last_seen, scheduler lane, enrichment status/attempts, snapshot status, and whether evidence was fresh or reused;
- the exact normalized candidate payload presented to decision functions;
- discovery score and all ranking inputs, while recording that ranking never changes qualification.

#### Privacy-safe dedupe boundary

- history_match and crm_preexisting_match booleans;
- match_basis reason code;
- a non-public-boundary digest/reference for audit when available;
- no full CRM dedupe index, Lead identity, private notes, owner, or contact data.

Replay treats the captured external CRM-match outcome as a frozen boundary input. It does not claim to reconstruct the private CRM index.

#### First pass

- exact indie evaluator input and complete output;
- exact china_joint evaluator input and complete output;
- all gate results, failed_gate_details, missing evidence, hard exclusions, matched rules, and next actions;
- shared regular-lane selection result;
- score/rank tuple used for later second-pass ordering.

Both indie_prelaunch and china_joint must be captured. Replaying only the indie evaluator cannot reproduce the final regular formal pool.

#### Second pass

For every candidate, record eligibility and rejection reason. At run level record the complete sorted eligible list, selected list, omitted list, selector version, maximum candidate count, and deterministic tie-break fields.

For every attempted candidate, record:

- requested actions;
- allowlisted patch fields;
- the exact bounded official/media normalized signals supplied to the provider;
- provider contract/version and request metrics;
- raw normalized provider result before field filtering;
- filtered fetched patch;
- error or timeout, including a null success value;
- merged final evaluator input;
- final evaluator output;
- whether the decision changed and which gate changed.

A provider error is a captured transaction whose final decision remains the first pass. It is not permission to retry during offline replay.

#### Publication and risk

- shadow decision: formal, candidate, or excluded;
- selected sourcing lane;
- shadow push-pool membership;
- suppression due to public-history/private-CRM dedupe boundary;
- stable shadow Lead payload hash without sending the payload;
- risk_flags array, present even when empty;
- explicit proof that day-level Lead count was not an evaluator input.

Shadow publication is advisory evidence only. It must not enter the production report, push/watch/drop pools, CRM payload, or sync.

### 7. Run-Wide Invariants

A complete corpus must prove:

- candidate records equal the complete deduped decision universe;
- every candidate has both regular-lane inputs/results;
- formal count equals shadow push-pool count after documented dedupe suppression;
- second-pass eligible, selected, attempted, qualified, and failed counts match their lists;
- selection is capped at 12 and each selected candidate has one to three allowlisted actions;
- hard-excluded candidates are never selected;
- the same evaluator dependency hash is used before and after second pass;
- reused snapshots consume zero fresh Steam detail requests;
- every independent proof resolves to an evidence item with an allowed independent role;
- every gate-level claim resolves to a concrete evidence ID/URL or remains unknown;
- unknown evidence is never converted into an invented pass;
- no quota, minimum, backfill, truncation, or zero-day branch exists in the decision path.

### 8. Integrity Envelope

integrity requires:

- canonical_json_version;
- payload_sha256 computed without the self-hash field;
- ordered candidate and evidence counts;
- all artifact binding hashes;
- no duplicate corpus_id, candidate_id, evidence_id, or transaction ID;
- strict schema validation with additional properties rejected;
- byte size and inline text-character totals;
- complete/corrupt reason codes.

The window manifest records each selected corpus path, Git blob SHA, payload SHA-256, behavior hash, underlying receipt binding, and every rejected attempt for that date.

## Shadow Collection Boundary

The prospective corpus resolves the deployment deadlock by running V7.3 as a non-publishing shadow over the same normalized candidate universe used by the accepted Daily run.

Required isolation:

- active production rules and CRM output remain unchanged during shadow collection;
- shadow objects are cloned and cannot mutate production candidates/state;
- shadow formal decisions are written only to the replay corpus;
- shadow failure cannot alter or block the existing V7.2 report/sync, but it marks the date ineligible and resets the acceptance window;
- existing sync-daily-report workflow triggers remain schedule and workflow_dispatch only;
- no product UI/API/Supabase surface consumes the corpus;
- no paid AI provider is allowed;
- public second-pass requests retain the fixed candidate/action/request budgets and are fully recorded.

The shadow behavior dependency set must represent the intended final V7.3 composite, including the completed Blocker 2 source-role behavior and Blocker 3 validation boundary. Activation may not silently substitute a different behavior hash after the window passes.

## Canonical Daily Run Selection

A date must retain every acceptance-eligible automatic attempt. Selection is deterministic and must not depend on Lead count.

1. Morning runs are retained only as operating evidence and cannot be the canonical acceptance run.
2. A successful scheduled afternoon run with complete corpus, successful validation, accepted receipt, and synced=true is eligible.
3. If the afternoon run is missing or unhealthy and an automatic watchdog performs a later recovery generation, the latest complete successful automatic watchdog recovery is eligible.
4. A watchdog that only observes health and performs no generation does not replace the afternoon corpus.
5. workflow_dispatch/manual/forced runs are excluded from the acceptance window. They remain visible as recovery evidence but cannot rescue a date or improve the 10-of-15 numerator.
6. If neither an eligible afternoon run nor an eligible automatic watchdog recovery exists, the date is incomplete.
7. Actual captured timestamps order attempts; no fixed wall-clock cutoff is used. This is necessary because the observed afternoon schedule can execute materially later than its nominal cron time.
8. Ties use numeric workflow_run_id and run_attempt after captured_at. Lead count, formal count, score, or business result is never a selector input.

## Acceptance-Window Policy

### Options

| Policy | Benefit | Defect | Decision |
| --- | --- | --- | --- |
| Extend until 15 complete dates | Shorter expected latency | Excludes failed dates and changes a 15-calendar-day liveness denominator | Reject |
| Fifteen consecutive Shanghai dates; restart after an incomplete date | Preserves calendar liveness and exposes collection/automation failure | A failure adds collection latency | **Recommend** |

### Recommended Window Contract

- Start on the first Asia/Shanghai date whose eligible canonical shadow corpus is complete after the approved collector is deployed.
- Require 15 consecutive natural dates and one canonical run per date.
- Require one unchanged behavior_contract_sha256 and corpus contract version across the entire window.
- Any incomplete/corrupt/unreplayable date, behavior hash change, manual-only recovery, or missing accepted production receipt closes the window as failed.
- Retain a failed-window manifest and restart on the first subsequent complete date; never delete the failed evidence.
- July 15-29 remains an old-production liveness baseline only and contributes zero dates to the new window.
- Do not reconstruct, backfill, replace, or relabel a missing date.
- Do not change the rule, provider classification, budget, selector, corpus schema, or acceptance denominator while a window is active.

## Acceptance Matrix

Acceptance is evaluated in order. A later gate cannot compensate for an earlier failure.

### Gate 0 — Corpus Completeness and Integrity

- 15/15 consecutive dates have eligible canonical runs.
- Every canonical run is capture_status=complete and passes strict schema, cross-record, privacy, and hash validation.
- Every underlying production run has generation/validation success, receipt status=success, and sync_response.synced=true.
- All 15 runs share the exact behavior contract and corpus contract.
- Every earlier automatic/manual attempt remains listed; selection is reproducible and independent of output.

Failure means no replay or numeric claim is permitted.

### Gate 1 — Offline Deterministic Replay

From an exact repository snapshot with network and AI disabled:

- reconstruct every first-pass input directly from the corpus;
- reproduce indie and china_joint gate outputs;
- reproduce run-wide second-pass ordering and selection;
- use captured provider inputs/results without refetching;
- reproduce merged final passes, shadow formal pool, lane, and payload hashes;
- produce byte-identical canonical replay output in two independent runs;
- produce zero unapproved file or production writes.

Any mismatch reports the exact candidate, stage, field, and behavior hash and fails acceptance.

### Gate 2 — Quality and Safety Invariants

- Every indie shadow Lead passes all nine V7.3 gates.
- Every china_joint shadow Lead passes the complete retained V7.2 commercial chain.
- Every independent quality proof has a distinct source ID and eligible independent role.
- Official/developer/publisher/keyword/unclassified evidence cannot occupy an independent slot.
- Every Lead has gate-level URLs/provenance and an explicit risk_flags array.
- Hard exclusions never receive second pass.
- Same-evaluator, 12-candidate, one-to-three-action, and allowlisted-field invariants hold.
- No candidate is upgraded because a day or window is zero.
- No quota, backfill, low-quality fallback, ranking cutoff, or minimum formal count exists.

### Gate 3 — Shadow Business Liveness

Only after Gates 0-2 pass:

- at least 10 of the 15 canonical dates have shadow_new_lead_count greater than zero;
- shadow_new_lead_count is the final deduped regular shadow push-pool count and includes both indie_prelaunch and china_joint;
- report the total shadow Leads, lane distribution, source distribution, gate blockers, and second-pass conversion;
- do not treat the target as permission to modify admission or rerun a date.

If fewer than 10 dates are nonzero, the corpus remains valid diagnosis evidence, but V7.3 activation acceptance fails. The next action is a new diagnosis/proposal, not threshold relaxation.

### Gate 4 — Three-Day Steam Evidence Coverage

For every complete rolling three-date segment inside the 15-day window:

- denominator = unique valid Steam dedupe keys observed in the canonical decision universes for those three dates;
- numerator = denominator keys that have at least one fresh-success or contract-valid reused Steam evidence snapshot used by an evaluator in that segment;
- coverage = numerator / denominator and must be at least 85%;
- reused snapshots must not increment fresh detail requests or the scheduled network budget;
- report churn, new/backlog/retry-refresh lanes, reuse, failures, and snapshot rejection reasons.

A low-coverage result does not permit a larger hidden budget. It requires separate scheduler/source diagnosis.

### Gate 5 — Human Review and Provisional Status

Human evidence audit and production precision remain separate:

- evidence audit reviews every shadow formal Lead when the window produces 30 or fewer; otherwise use a deterministic SHA-based stratified sample of at least 30 plus every risk-flagged Lead;
- review source role, gate-to-URL attribution, project identity, business entry, China/Bilibili thesis, and risk flags;
- historical seven weak samples remain synthetic/curated controls unless real immutable evidence was captured prospectively; they cannot be labeled production replay;
- resolved business precision continues to use the existing Sourcing Learning regular cohort;
- fewer than 30 resolved outcomes remains provisional;
- only a mature regular cohort uses the existing 80% target;
- no sample size or precision result may automatically rewrite rules, add quantity control, or backfill Leads.

## Architecture Benefit

- Separates operational candidate state from acceptance evidence and avoids turning the candidate artifact into a second event log.
- Lowers blast radius by keeping shadow output outside report publication and CRM sync.
- Makes source ownership, semantic family, gate claim, and URL provenance explicit instead of inferred from text.
- Makes second-pass selection/provider behavior reproducible without later network calls.
- Allows data commits to continue while a stable behavior hash protects the window.
- Exposes failed collection dates rather than biasing the denominator.
- Gives future rule changes a comparable immutable baseline and prevents a code-GREEN-only activation claim.
- Keeps UI, API, Supabase, CRM import, existing Leads, and workflow trigger boundaries untouched.

## Bounded Future TDD PR Sequence

No item below is authorized by this Proposal alone.

### PR C5-A — Pure Contract and Validator

Scope:

- add the corpus/window JSON schemas;
- add canonical JSON/hash helpers and a strict pure validator;
- add complete/incomplete/corrupt fixed fixtures;
- no generator, provider, workflow, production artifact, or rule behavior.

TDD:

- RED for missing evidence provenance, missing second-pass transaction, duplicate IDs, bad hashes, forbidden private fields, and count/parity failures;
- GREEN with schema/validator only;
- focused tests, typechecks, verify:all, and diff-check.

### PR C5-B — Isolated Shadow Collector

Scope:

- construct lossless per-run corpus from cloned normalized candidates;
- use the intended V7.3 composite including Blocker 2 behavior;
- capture both regular lanes and bounded second pass;
- persist acceptance-eligible afternoon/watchdog artifacts and failed-attempt status;
- add the new data path to existing commit plumbing without changing workflow triggers;
- keep active production decisions, reports, pools, payloads, sync, UI/API, and Supabase unchanged.

TDD:

- prove shadow formal output cannot mutate production objects or payloads;
- prove shadow/provider failure isolation;
- prove every candidate and second-pass transaction is captured;
- prove private CRM index and forbidden runtime/network data are absent;
- run only fixture providers in tests; no live calls.

### PR C5-C — Offline Replay and Window Manifest

Scope:

- replay exact corpus with network disabled;
- select canonical runs;
- calculate integrity, determinism, quality, liveness, coverage, and review manifests;
- retain failed windows;
- no production rule or data mutation.

TDD:

- RED for missing dates, manual-only recovery, behavior drift, selector cherry-picking, replay mismatch, coverage denominator errors, and zero-day influence;
- GREEN with pure replay/window modules and fixed fixtures;
- full verification and diff-check.

### Observation/Acceptance Task — No Opportunistic Code Fixes

- collect the first valid 15-consecutive-day window;
- validate exact remote artifacts and hashes;
- perform the deterministic replay and human evidence audit;
- report pass/fail/provisional status;
- stop for explicit activation approval.

V7.3 integration/activation, PR creation, merge, deployment, and production acceptance remain later separate tasks.

## Explicitly Untouched

- Current production rule activation and the V7.2 decision path.
- Blocker 1, Blocker 2, or Blocker 3 integration.
- The V7.3 evaluator threshold or any gate.
- PR B state/scheduler/snapshot semantics and fixed budgets.
- Workflow schedule/workflow_dispatch trigger boundary.
- CRM sync/recovery semantics.
- Product UI/API, Supabase, Sourcing Learning behavior, existing Leads, priorities, or buckets.
- Radar, Steam Trends, Steam review opportunity workflow, PR D/E, AI editing, or live generation.
- PR creation, merge, deployment, and production data.

## Stop Conditions

Stop and require a new proposal if:

- the evidence-authority option is not explicitly approved;
- the intended shadow behavior cannot be frozen to one dependency hash;
- lossless capture requires raw HTML, secrets, full private CRM data, or post-decision truncation;
- shadow output can affect production candidates, report pools, payloads, or sync;
- implementation requires a new workflow trigger rather than existing automatic slots;
- the exact first/second-pass transaction cannot be captured within the approved bounded public-data budget;
- any task attempts to repair an acceptance failure opportunistically;
- a later active window sees behavior/schema/budget drift.

## Completed

- Reconfirmed all remote start gates and the open PR queue.
- Created this proposal branch from the exact replay diagnosis head.
- Wrote a durable checkpoint before multi-file analysis.
- Inspected the frozen rule, evaluator, regular-lane composition, second-pass provider, completed Blocker 2 role boundary, candidate schema/audit, PR B snapshot/state, completed Blocker 3 boundary, workflows, receipt behavior, and existing learning/provisional contract.
- Compared all three evidence-authority options and recorded Option B as the recommendation.
- Defined the field-level per-run corpus, privacy boundary, run invariants, canonical selector, consecutive-window policy, acceptance matrix, stop conditions, and future small-TDD-PR sequence.
- Made no implementation, integration, PR, merge, deployment, live-source, generator, sync, production-data, local-checkout, or product change.

## Remaining

No work remains in Phase 2 after the final exact-head and one-file allowlist verification.

The following require explicit later authorization:

- Phase 3 approval of the four-part Executive Recommendation;
- any PR C5-A/B/C implementation;
- collection of a 15-day window;
- replay acceptance;
- PR C integration or activation.

## Next Action

Stop at the Phase 3 boundary and ask one approval question:

Approve Option B evidence authority, prospective non-publishing shadow corpus, the 15-consecutive-Shanghai-day restart policy, and the bounded C5-A/B/C implementation sequence as one Phase 3 decision?

Do not enter implementation from this task.

## Git Status

- Proposal branch parent: f9b34cc83623f25327a2148c8d833ef65c96a753.
- Initial checkpoint commit: aaa930f7a3a6793519fdae41d1c0bbff4fdead8e.
- Read-only-analysis checkpoint commit: b14a6578434b21285a34f15d2ac628d40a2da3f7.
- Allowed changed path: docs/checkpoints/pr-c-v73-replay-corpus-contract-v1.md only.
- No PR exists for this branch.
- The final proposal head will be verified once without another checkpoint commit and reported externally.
