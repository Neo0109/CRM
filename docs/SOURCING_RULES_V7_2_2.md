# Sourcing Rules V7.2.2 — Bounded Near-Pass Review

Date: 2026-08-14

Active rule version: `sourcing-rules-v7.2.2-near-pass-review`

## Unchanged strict formal contract

V7.2.2 retains the complete strict admission contracts in `docs/SOURCING_RULES_V7_0.md` and `docs/SOURCING_RULES_V7_2.md`, plus the broad-media product-domain gate in `docs/SOURCING_RULES_V7_2_1.md`.

- Every deduped project that completely passes either `indie_prelaunch` or `china_joint` is a `strict_formal` Lead.
- Strict formal Leads are selected, deduped, and published first without a minimum, maximum, lane quota, backfill, score threshold, or ranking cutoff.
- V7.2.2 does not lower, compensate for, or reinterpret any strict formal gate.

## Near-pass review boundary

Only after strict formal dedupe, the Daily decision layer may append at most three `near_pass_review` Leads. A review Lead must have a numeric Steam AppID, the exact stable key `steam:<appid>`, and must not duplicate a strict formal or higher-ranked review Lead.

### Indie prelaunch

Every hard requirement must pass:

- prelaunch with a TBA or over-60-day window;
- not Early Access;
- publisher/China-capability occupancy clear;
- non-narrative and non-India-led;
- at least one official Demo/Playtest or official gameplay proof;
- at least one non-Steam business entry;
- concrete China/Bilibili value.

Exactly one soft gap is allowed:

- `independent_quality_proof`; or
- `overseas_china_demand`, only when the project is overseas.

A project with zero gaps, two gaps, or any hard failure is not an indie near-pass review Lead.

### China joint

Every hard requirement must pass:

- current China opportunity;
- mature China partner confirmed clear;
- current official product event;
- official playable/gameplay evidence;
- non-Steam business entry.

The only permitted missing gate is `traction_or_proven_team_event`. Any other or additional gap blocks review publication.

## Deterministic publication order

Review candidates are deduped and sorted by:

1. `independent_quality_proof` gap;
2. `overseas_china_demand` gap;
3. `traction_or_proven_team_event` gap;
4. domestic before overseas before unknown;
5. current official event first;
6. discovery score descending;
7. stable dedupe key ascending.

The cap of three applies only to review Leads. It never truncates strict formal Leads.

## Lead copy and payload boundary

Review Leads use the same existing Lead payload, bucket `未处理`, stage `new`, priority `null`, and selected sourcing lane. No CRM, UI, API, synchronization, or Daily-report schema field is added.

The review warning copy is exact:

- `rule_fit`: `Near-pass 人工复核：唯一缺失 gate=<gate_id>（<中文门槛>）；其余硬性条件已通过。`
- `risks`: `Near-pass 唯一缺口：<gate_id>（<中文门槛>）；需在首轮试玩/筛选中核验。`
- `verdict`: `仅供首轮试玩/筛选，不代表正式商务推进，试玩不成立直接淘汰。`

Gate labels are:

- `independent_quality_proof`: `独立质量证明`
- `overseas_china_demand`: `海外项目中国需求证明`
- `traction_or_proven_team_event`: `市场牵引或成熟团队事件`

## Audit and parity

Only `data/sourcing_candidates/YYYY-MM-DD.json` and its schema gain review observability:

- `publication_tier` is `strict_formal` or `near_pass_review` for a published candidate and `null` otherwise;
- `strict_formal_count` and `near_pass_review_count` are recorded in `scan_summary`;
- `new_qualified_count === push_pool_count` remains required;
- `strict_formal_count + near_pass_review_count === push_pool_count` is additionally required.

The candidate audit remains outside every CRM import and synchronization path.

## Operational boundary

This rule changes neither workflow triggers nor provider authority. It does not dispatch a workflow, call a provider, write CRM/Supabase, or manufacture natural-run evidence. V7.3 shadow/replay remains an observation system and must continue to validate against the active rule version without feeding results into formal or review publication.
