# Sourcing Quality Root-Cause Audit

Date: 2026-07-15

Status: Diagnosis only. No active rule, scoring logic, daily-report generation, CRM product behavior, UI, Lead data, or workflow trigger was changed.

## Scope And Evidence Boundary

This audit covers only the local execution path that determines Steam/media candidate priority and `push_pool` / `watch_pool` / `drop_pool` placement:

- `docs/SOURCING_RULES_CURRENT.md`
- `docs/SOURCING_RULES_V6.md`
- `automations/rules/daily-report.json`
- `automations/jobs/online_daily_runner.mjs`
- `automations/jobs/online_daily_v4.mjs`
- `automations/jobs/online_daily_v4_rules.mjs`
- `automations/jobs/online_daily_v4_steam_source.mjs`
- `automations/jobs/online_daily_v4_media_leads.mjs`
- `automations/jobs/online_daily_v4_media_entities.mjs`
- `automations/jobs/online_daily_v4_decision.mjs`
- Local daily reports from 2026-07-05 through 2026-07-13 when present.

No external research was performed. Historical report examples below are evidence of generated output, not a claim that every example still reproduces on the current V6.7 revision.

## Current Execution Chain

1. `online_daily_runner.mjs` loads `automations/rules/daily-report.json` and validates its schema version, rule version, compatible generator, and active rule document. It then imports `online_daily_v4.mjs` and runs the daily contract validator after generation.
2. `online_daily_v4_rules.mjs` turns the rule JSON into runtime configuration. Today this executable configuration contains media sources, media quality gates, and Radar diversity. The prose arrays such as `push_pool_guardrails` are loaded and version-checked, but they are not converted into P1/P2 decision predicates.
3. Steam discovery candidates are pre-sorted by `prioritizeSteamCandidatesForReview`. That order mainly rewards domestic-query/source labels and release-window availability so the limited AppDetails enrichment budget is spent on those candidates first.
4. `enrichSteamCandidate` converts Steam metadata into booleans. In particular:
   - `strongGameplay` is a genre/description keyword match.
   - `highVisual` means at least four screenshots or one movie.
   - `strongData` means positive-review/wishlist text or at least 500 Steam recommendations.
   - region, release window, Demo, publisher, exclusion, contact, and mobile-adaptation flags are also derived.
5. `scoreCandidate` adds source, domestic, Demo, genre-keyword, screenshot/movie, data, details, and contact points, then subtracts exclusion penalties. The enriched Steam list is sorted by this score.
6. Media/Bilibili items pass through strict, expanded, or rescue discovery filters. `mediaLeadScore` starts with the upstream item score and adds Bilibili/domestic-source focus plus Demo/product/genre keywords. A strict, domestic-context media item with score at least 52 becomes push/P1; every non-dropped remainder becomes watch/P2.
7. `buildPools` applies hard drops and Steam push eligibility, then selects media and Steam push/watch lists separately and interleaves them. There is no single cross-source quality score: Steam score and media score use different scales and separate caps.
8. Steam push becomes P1. A non-push, non-drop Steam candidate becomes watch and is P2 at score 34 or above, otherwise P3; both grades are still eligible for `watch_pool`. Media watch is always P2 regardless of its final score or confidence tier.
9. All non-dropped leads are written with `bucket = 未处理`. The generator then writes the daily report, Radar, and Steam Trends; low volume is diagnosed after pool construction.

The default target of 18 review candidates is not itself the main P2 admission gate. The broader issue happens earlier: nearly every candidate that avoids a hard drop becomes watch, and watch has no shared minimum product-quality requirement.

The explicit review-backfill path also appears internally contradictory in the current code. It requires a domestic candidate with a `dropReason`, but then excludes the current domestic hard-drop reasons (released, near launch, publisher occupied, narrative-heavy, or India team); overseas hard drops cannot pass the domestic requirement. Low-confidence volume therefore enters mainly through ordinary watch/media-watch admission rather than the named backfill path.

## Rule Conflicts

### 1. BD precision versus discovery relevance

The human rule says the report should reduce BD judgment cost and produce decision-grade candidates. The executable P1 rules do not require verified product quality, traction, developer need, or Bilibili incremental value. Source labels, domestic classification, genre keywords, screenshots/movies, details, and contact presence can cross the Steam P1 threshold even when `strongData` is false.

For media P1, a high source/item score plus Bilibili/domestic/Demo/topic keywords can cross the threshold without a verified playable build, official product entity, quality signal, or commercial need.

### 2. Machine-readable rule source versus hard-coded decisions

`daily-report.json` contains strong guardrails, but `buildDailyRuleConfig` only exposes media sources, media quality gates, and Radar diversity. P1/P2 thresholds, score weights, hard drops, watch admission, pool caps, and backfill behavior remain hard-coded in JavaScript. A guardrail can therefore be documented and version-valid without governing the decision.

### 3. P2 as observation versus P2 as mandatory review work

The desired product behavior distinguishes broad discovery from scarce formal recommendations. The current code makes media non-push candidates P2 by default and sends all non-dropped push/watch items to `未处理`. There is no upstream observation-only route for weak or incomplete candidates, so recall-oriented discovery becomes human review workload.

### 4. Quality-first output versus volume-oriented admission

The V6 document says small push pools and low-volume days are acceptable, and backfill is not permission to pad the report. The implementation diagnoses a target of 18 only after broad watch admission. Because watch admission lacks a uniform quality floor, the system can satisfy or approach volume expectations without establishing that the candidates deserve BD attention.

### 5. Unknown evidence versus false certainty

Media leads without verified Steam/product context are created with `early_access = false`, `narrative_heavy = false`, `india_team = false`, and `china_capability_occupied = false`. These values mean “not yet proven” in practice but are encoded as negative facts. The same source URL can also become a fallback contact method. This makes incomplete discovery evidence look more complete than it is.

### 6. Rule-version traceability

The runner validates V6.7 through `RULE_VERSION`, while `online_daily_v4.mjs` still labels its diagnostics and generator name as V6.5. The executable revision may contain later gates, but generated diagnostics can report an older rule identity, weakening output-to-rule traceability.

## Misclassification Examples

| Local output | Observed classification | Why it is a precision problem | Current-revision interpretation |
| --- | --- | --- | --- |
| `2026-07-13` — `仙途有约` | P1 | The report says the release window is unconfirmed and public wishlist/reputation/community strength is missing. P1 is supported by domestic/source, visual-material, and gameplay-keyword signals. | This pattern remains compatible with the current Steam score and push predicates because positive `strongData` is not mandatory. |
| `2026-07-10` — `从零开始的钓鱼人生Lift` | P1 | The report again states that the release window is not precise and strong public data is missing, while metadata proxies support priority. | This pattern remains compatible with the current code. |
| `2026-07-10` — `落幕之前` | P1 | No Steam AppID is present and the risk says project authenticity, playable build, and official source still need confirmation. The media score nevertheless produced P1. | This pattern remains compatible with media P1 because source/relevance score, not verified product quality, is the gate. |
| `2026-07-07` — `I Am the Demon King: Stop Sun Wukong` and `Fantasy World / 幻想世界` | P1 | Both were two to four days from launch and explicitly lacked strong public data, yet were sent to priority review. | These are historical false positives. The current `<60 days` hard drop should now block them, so they demonstrate prior output/rule drift rather than a confirmed current regression. |
| `2026-07-07` — `国家发改委：预计今年 AI 手机、AI 电脑销量将首超非 AI 产品` | P2 | A macro hardware/AI news headline entered the game review lane. | Historical evidence of loose media entity admission. Current filters have since changed; reproduction on V6.7 was not tested in this diagnosis. |
| `2026-07-06` — `原神` | P2 | A mature, already-known product entered the first-pass review lane without a new BD opportunity being established. | Historical evidence of identity/dedupe and P2-admission weakness; current reproduction was not tested. |

## Root Cause

The primary root cause is a stage-boundary error: candidate discovery, source relevance, product quality, and formal BD recommendation are collapsed into one score-and-pool decision.

That produces five reinforcing failures:

1. **Objective mismatch:** the runtime rewards candidate coverage and source relevance, while the user needs precision among the few items that consume BD review time.
2. **Missing admission contract:** avoiding a hard exclusion is treated as sufficient for watch/P2, instead of requiring affirmative evidence that a candidate deserves formal review.
3. **Proxy promotion:** genre keywords, screenshots/movies, source identity, domestic context, and basic metadata are treated as positive quality evidence even though they mainly prove discoverability or inspectability.
4. **Non-comparable ranking:** Steam and media use different score scales and are interleaved after separate ranking, so priority does not represent one consistent definition of expected BD value.
5. **Governance gap:** the human and JSON rule texts are not the executable decision contract. Version validation proves file compatibility, not that stated guardrails control P1/P2 behavior.

The 18-candidate target amplifies the problem culturally and operationally, but it is not the single mechanical cause. The decisive defect is that ordinary watch/P2 admission already accepts incomplete candidates before volume diagnostics run.

## Questions Requiring Confirmation

1. Must P1 require at least one verified positive product-quality or traction signal, rather than merely the absence of a hard exclusion?
2. Which signals qualify: playable Demo review, Steam review count/rating, wishlist evidence, creator response, public playtest retention, publisher-quality assessment, or an explicit expert judgment?
3. Should P2 remain a formal `未处理` recommendation, or should incomplete candidates stay in a separate upstream observation funnel that does not consume BD review slots?
4. Is zero P1 and zero formal recommendations an acceptable daily result when no candidate clears the quality bar?
5. Should the target of 18 be diagnostics-only, with an explicit prohibition against changing candidate eligibility or priority to satisfy volume?
6. For media/Bilibili candidates, what minimum entity proof is required before P1/P2: official source, verified game product, playable build, Steam/TapTap/official page, or a combination?
7. Should unknown exclusion fields be represented as `unknown`/unverified instead of `false` until evidence exists?
8. Should Steam and media share one post-enrichment admission contract and one comparable ranking definition, even if source-specific discovery scores remain separate?
9. Which historical examples should become the approved precision regression set for the later Proposal/TDD phase?

## Stage Result

Diagnosis is complete. No proposal or implementation is included in this file. The next phase must begin only after the user confirms the diagnosis and resolves the questions above.
