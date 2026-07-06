# CRM Product Roadmap Audit

Date: 2026-07-06

This audit is a docs-only product-value checkpoint after the architecture cleanup queue. It does not change runtime code, API behavior, schema, workflows, generated daily data, or frontend UI. 简单说：不改运行时代码。

## Why This Exists

The CRM refactor queue has brought the main technical boundaries under control: Daily V4, Bilibili probe, Functions core, Lead Assistant, Automation Diagnostics, frontend shell, CSS tokens, legacy backend, shared Lead/User models, settings boundary, docs boundaries, and verify-all are now on `main`.

The next risk is not a specific oversized module. The next risk is choosing work by code neatness instead of BD value. This audit turns the scattered product candidates in PRD, optimization context, frontend entrypoints, and changelog into a short product roadmap so the next PR is not continuing "for refactor's sake". 中文说法就是：不是继续“为重构而重构”.

## Current Product Surfaces

- Leads Review: primary BD review workspace for searching, filtering, bucket navigation, owner and due-date triage.
- Lead Detail: right-side decision workspace for product evidence, contacts, links, evaluation result, next action, owner, due date, and drop reason.
- quick actions: fast movement between `未处理`, `待评测`, `测试中`, `观察池`, `跟进中`, `推进池`, and `淘汰池`.
- 线索助手: manual or AI-assisted lead creation from text, links, Steam context, and optional image context.
- 行业雷达: daily market and product signal board for compact external awareness.
- Steam 趋势: Steam market board for BD-relevant trend and event context.
- 自动化诊断: read-only health panel for daily files, sourcing volume, sync receipts, and root-cause hints.
- Sourcing 学习: feedback loop surface for human decision outcomes, rating distribution, drop reasons, and sample accumulation.
- Weekly Report: weekly funnel summary that should reflect sourced, tested, followed-up, active, and dropped leads.
- Calendar: opt-in reminder surface for leads that have explicit due dates or follow-up commitments.
- 导出: JSON, CSV, and password-protected Excel export for external review or backup.
- Settings: Cloudflare-managed operations guide and export entry. It is not an online account, password, or verification-code management surface.

## Scoring Matrix

Scores use 1-5, where higher is better. `上线风险` and `实现复杂度` are inverted into product desirability: 5 means lower risk or lower complexity.

| Candidate | BD 判断效率 | 减少漏跟进 | 减少噪音/误判 | 上线风险 | 实现复杂度 | Product Read |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 跟进闭环增强 | 5 | 5 | 3 | 4 | 4 | Highest. It turns existing fields into an actionable work list. |
| Lead Assistant 质量增强 | 4 | 3 | 4 | 3 | 3 | Strong. It reduces manual entry cost, but touches AI parsing and import behavior. |
| Sourcing Learning 可视化增强 | 3 | 3 | 5 | 4 | 3 | Strong, but it needs more accumulated outcome samples to avoid over-reading weak data. |
| 前端真实流程截图审计 | 3 | 3 | 3 | 5 | 4 | Useful when a specific screen feels wrong; not the next broad product PR by itself. |
| 完整在线设置页 / 邮箱验证码 / 账号后台 | 1 | 1 | 1 | 1 | 1 | Deferred. It expands security surface without improving BD review throughput. |

## Recommended Next Feature Order

1. 跟进闭环增强

   Make the CRM answer "本周该做什么" from fields that already exist: `due_date`, `next_action`, `owner`, `calendar_enabled`, evaluation result, and bucket state. This should connect Leads Review, Calendar, and Weekly Report into one clearer loop without changing sourcing automation. The practical output should be a compact follow-up lane or weekly action list that highlights overdue testing leads, upcoming due dates, missing next actions, and leads waiting on owner action.

2. Lead Assistant 质量增强

   Improve the assisted intake flow so pasted text, Steam links, official-site links, and screenshot descriptions produce fewer incomplete leads. The main value is reducing manual lead creation cost. This should remain conservative: do not auto-promote buckets, do not bypass human review, and do not let AI overwrite human workflow fields.

3. Sourcing Learning 可视化增强

   Make human outcome learning easier to read: drop reasons, evaluation grades, positive/negative samples, and repeated sourcing failure modes. This should help adjust future sourcing rules, but the UI must clearly label small sample sizes as directional rather than statistically stable.

4. Screenshot-based product audit

   Run this only when there is a concrete flow to inspect, such as Leads Review triage, Weekly Report, Calendar reminders, or Lead Assistant intake. This requires fresh screenshots and is intentionally separate from this docs-only audit.

## Deferred Or Rejected For Now / 暂缓项

- Do not restore the full online settings page: 不恢复在线设置页。
- Do not add 邮箱验证码 UX.
- Do not build an 账号后台 or complex permissions console.
- Do not move `CRM_USERS_JSON`, login passwords, or `EXCEL_EXPORT_PASSWORD` back into CRM write APIs.
- Do not combine a product feature PR with Daily V4 rules, schema changes, Supabase migrations, or generated data.

These items are deferred because they increase security and support burden while doing little for the core BD workflow: earlier discovery, faster judgment, and fewer missed follow-ups.

## Next PR Boundary

下一轮真正功能 PR 默认从 `跟进闭环增强` 开始。

The next real feature PR should be 跟进闭环增强 unless new evidence shows a more urgent product problem. That feature should start with TDD around existing lead fields and current frontend contracts, then add the smallest UI surface that turns due dates and next actions into a work queue.

This audit itself is complete when the docs contract passes, `verify-all` passes, and `git diff --check` is clean. It must not run live generator jobs; 不运行 live generator, and must not write `data/reports`, `data/radar`, or `data/steam_trends`.
