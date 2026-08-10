# v2.8 沟通跟进工作台 checkpoint

## Current Goal

阶段 1（数据/API）与阶段 2（前端/日历）均已完成并在精确远端提交上验证。当前停在阶段 2 边界，等待用户确认；未进入阶段 3。

## Remote Base

- Repository: `Neo0109/CRM`
- Base branch: `main`
- Approved base SHA: `04e5b24a775657a2b30ec7dfede1884eafd601e7`
- Product branch: `codex/product-communication-follow-up`
- Stage 1 checkpoint head: `a7d004b9904966d292f21ba23e4c4d5bc7d2a5e1`
- Stage 2 implementation head before this checkpoint update: `f5d33852e3b4791feceb0b33c2a7497fafe378c8`
- Stage 2 comparison: product branch was ahead 21 and behind 0 relative to the approved base before this closeout commit
- Remote `main` remained exactly `04e5b24a775657a2b30ec7dfede1884eafd601e7`
- Open PR at end of stage: 0

## Allowed Scope

### Stage 1

- `functions/_lib/` 中的 Interaction 模型与仓储
- `functions/api/interactions.ts` 的认证 GET/POST API
- `app/backend/` 中的本地 Express 等价 API、仓储与测试
- `.gitignore` 中的本地沟通历史忽略规则

### Stage 2

- `app/frontend/` 中的沟通跟进页面、纯筛选/排序/表单校验、API 类型与测试
- `App.tsx` 顶级导航与 API 返回 Lead 的状态回写
- `CalendarLauncher.tsx` 与 `calendar.css` 的议程下一步展示和入口文案
- 规范版本命令生成的产品版本、health、入口资源戳、CHANGELOG 与产品上下文文件
- 本 checkpoint

## Explicitly Out of Scope

- Stage 3 独立验收、`verify:all`、PR 创建、ready、merge、deploy
- sourcing `PLAN.md`、规则文件和共享工作树的 3 个未提交文件
- 自动日报 workflow、Radar、Steam Trends、live generator
- Supabase migration、RLS、Data API grants 或真实 Supabase 数据写入
- 邮件/微信自动同步、AI 摘要、关系评分、Kanban、沟通统计或周报导出
- GUI 截图、Computer Use 或生产视觉验收

## Completed

### Stage 1 — Data / API

- 新增共享 `InteractionEvent` 模型、固定字段、渠道白名单和安全长度校验。
- 服务端生成 `actor`、`created_at` 与 `__crm_interaction_event__<request_id>` 幂等系统行 ID。
- 覆盖摘要-only、仅下一步、带日期三种行为；带日期时只更新现有 Lead 日历字段。
- 拒绝日期早于沟通日期、日期无下一步、非法渠道、越界字段和不在 `跟进中/推进池` 的 Lead。
- 新增认证 `GET/POST /api/interactions`，默认 50、最大 100、opaque cursor、沟通时间倒序。
- POST 重查 Lead 与池子，重用 request ID 时返回已存事件；跨 Lead 冲突或移出允许池子返回 409。
- 生产仓储继续使用 `crm_leads` 系统行；有 Lead 变化时，事件行与 Lead 行通过一次批量 upsert 写入。
- Supabase 查询按 JSONB `data->>lead_id` 分页；存储错误不回显响应正文。
- 本地 Express 接入等价 GET/POST；本地沟通历史只写被忽略的 `data/interactions.local.json`。

### Stage 2 — Frontend / Calendar

- 新增顶级导航“沟通跟进”和独立双栏工作台，只展示 `跟进中` 与 `推进池` Lead。
- 左侧支持项目/团队/联系方式搜索、Owner、池子和到期状态筛选；默认按逾期、今日、7 天内、缺下一步或日期、未来提醒排序。
- 右侧展示 Lead/团队/Owner/池子/优先级、联系方式、现有下一步和提醒日期。
- 时间线按所选 Lead 懒加载并缓存，使用 AbortController、请求序号和 Lead ID 三重约束隔离快速切换竞态；支持空历史、失败重试和分页加载。
- 沟通表单实现渠道、沟通时间、对象、摘要、下一步与日期；前端复刻 120/2000/500 字限制及日期约束。
- 保存期间禁用重复提交；同一 Lead 的失败重试复用 request ID，避免服务端已落库但响应丢失时重复新增。
- 保存失败保留表单；409 明确提示 Lead 已移出允许池子并刷新 App Lead 列表。
- 保存成功将 API 返回的 Lead 回写 App 全局状态，并把返回 Interaction 合并进当前 Lead 时间线。
- 日历 Lead 议程卡新增 `next_action`，文案明确手动确认或在沟通记录中设置日期都会进入日历。
- 第一版沟通历史保持追加式，不提供编辑或删除。
- 已运行规范版本命令，产品版本为 `v2.8-communication-follow-up`。

## Verification Evidence

### Stage 1 evidence

- `npm run test:crm-core`: 44/44 passed。
- `npm run test:backend`: 28/28 passed。
- `npm run typecheck:functions`: passed。
- `npm run typecheck --workspace app/backend`: passed。
- `git diff --check 04e5b24a775657a2b30ec7dfede1884eafd601e7...HEAD`: passed。

### Stage 2 exact-head evidence

- Exact implementation commit: [`f5d33852`](https://github.com/Neo0109/CRM/commit/f5d33852e3b4791feceb0b33c2a7497fafe378c8)。
- `npm run version:product -- --minor --slug communication-follow-up --summary "新增沟通跟进工作台，并将下次跟进同步到日历"`: produced `v2.8-communication-follow-up`。
- `npm run test:frontend`: 125/125 passed。
- `npm run typecheck --workspace app/frontend`: passed。
- `npm run typecheck --workspace app/backend`: passed。
- `npm run typecheck:functions`: passed。
- `npm run build`: frontend Vite build and backend TypeScript build passed。
- `git diff --no-index --check` over all 20 Stage 2 implementation files: passed。
- GitHub compare `a7d004b...f5d33852`: ahead 1 / behind 0; exactly 20 files, all inside Stage 2 Allowed Scope。
- A fresh non-Git tarball of exact remote `f5d33852` matched the tested staging snapshot byte-for-byte after excluding dependencies/build output, then independently passed the same 125 frontend tests, three typechecks, and build。
- Read-only production baseline before the branch change: `/api/health` returned HTTP 200, `ok=true`, `storage=supabase`, version `v2.7.6-sourcing-evidence-integrity`; no deployment or visual acceptance was attempted。
- No live generator was run and no real Supabase write was performed。

## Remaining

### Stage 3 — Independent Acceptance / Draft PR

- Only after explicit user confirmation, run the separately approved Stage 3 acceptance, including `verify:all` and any final exact-head checks required by that phase.
- Reconfirm remote `main`, product branch, open PR and Actions state before deciding whether to create a draft PR.
- Do not ready, merge or deploy without separate authorization.

## Next Action

停止并等待用户确认阶段 2。不得自动进入阶段 3。

## Git Status

远端产品分支已包含阶段 1 与阶段 2 实现，尚未创建 PR。共享 sourcing 工作树在阶段 2 结束时仍与开工前完全一致：

```text
## codex/sourcing-rules-vnext...origin/codex/sourcing-rules-vnext [ahead 1]
 M docs/checkpoints/sourcing-rules-vnext.md
?? docs/SOURCING_RULES_PROPOSAL.md
?? docs/checkpoints/pr0-quality-quarantine.md
```
