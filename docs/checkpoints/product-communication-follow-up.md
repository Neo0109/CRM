# v2.8 沟通跟进工作台 checkpoint

## Current Goal

阶段 1（数据/API）、阶段 2（前端/日历）与阶段 3（独立验收 / draft PR）均已完成。独立验收发现并修复 1 个 P1 幂等载荷绑定问题，最终验证全绿；draft PR #113 已创建。当前停止在 draft 边界，未 ready、未合并、未部署。

## Remote Base

- Repository: `Neo0109/CRM`
- Base branch: `main`
- Approved base SHA: `04e5b24a775657a2b30ec7dfede1884eafd601e7`
- Product branch: `codex/product-communication-follow-up`
- Stage 1 checkpoint head: `a7d004b9904966d292f21ba23e4c4d5bc7d2a5e1`
- Stage 2 implementation head before this checkpoint update: `f5d33852e3b4791feceb0b33c2a7497fafe378c8`
- Stage 2 final checkpoint head / Stage 3 incoming head: `72567bfdb9b5b0fc063f738af48ba54d7fd3af76`
- Stage 3 validated code head before this checkpoint update: `1b30e266ad12bd1530efed94e5073922ed2b3da5`
- Stage 2 comparison: product branch was ahead 21 and behind 0 relative to the approved base before this closeout commit
- Remote `main` remained exactly `04e5b24a775657a2b30ec7dfede1884eafd601e7`
- Stage 3 validated comparison: product branch ahead 23 / behind 0, 36 changed files, all inside the approved v2.8 scope
- Draft PR: [#113](https://github.com/Neo0109/CRM/pull/113), open and draft, base `main`

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

- PR ready、merge、deploy 与生产视觉验收
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
- 保存期间禁用重复提交；同一 Lead 的失败重试仅在规范化载荷不变时复用 request ID，载荷变化时换新 ID，避免服务端已落库但响应丢失时重复新增或静默覆盖用户修改。
- 保存失败保留表单；409 明确提示 Lead 已移出允许池子并刷新 App Lead 列表。
- 保存成功将 API 返回的 Lead 回写 App 全局状态，并把返回 Interaction 合并进当前 Lead 时间线。
- 日历 Lead 议程卡新增 `next_action`，文案明确手动确认或在沟通记录中设置日期都会进入日历。
- 第一版沟通历史保持追加式，不提供编辑或删除。
- 已运行规范版本命令，产品版本为 `v2.8-communication-follow-up`。

### Stage 3 — Independent Acceptance / Draft PR

- 通过 GitHub App/API 重查远端 `main`、产品分支、open PR、Actions 与本 checkpoint；开工时精确匹配批准状态，无远端漂移。
- 从远端 SHA 下载 base/head 非 Git tarball，在隔离临时目录执行测试、typecheck、build、scope、whitespace 与 `verify:all`。
- 独立 DoD 审查覆盖导航与允许池、筛选排序、Lead 上下文与联系方式、懒加载时间线、表单约束、空历史、失败保留、重复提交、快速切换竞态、409、API Lead 回写以及日历 `next_action` 与文案。
- 发现 P1：保存失败后，旧 request ID 未绑定原载荷；用户修改后重试可能收到旧幂等事件，前端却清空新表单并提示成功。
- 通过 GitHub API 提交最小修复 [`1b30e266`](https://github.com/Neo0109/CRM/commit/1b30e266ad12bd1530efed94e5073922ed2b3da5)：相同规范化载荷复用 ID，变化载荷生成新 ID，并增加回归测试。
- 修复后完整复验全绿，无剩余 P0/P1 DoD 阻塞；创建并保持 draft PR #113。

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

### Stage 3 exact-head evidence

- Exact validated code head: [`1b30e266`](https://github.com/Neo0109/CRM/commit/1b30e266ad12bd1530efed94e5073922ed2b3da5)。
- GitHub push Build [31446744503](https://github.com/Neo0109/CRM/actions/runs/31446744503): success。
- Fresh non-Git head archive SHA-256: `282263ca42b22f08934d0538988aecf3b408c7509acb3769c6a3c5b80a0d3b9b`。
- `npm run test:frontend`: 126/126 passed（包含新增幂等载荷回归）。
- `npm run test:backend`: 28/28 passed。
- `npm run test:crm-core`: 44/44 passed。
- frontend / backend / functions 三端 typecheck: passed。
- `npm run build`: frontend Vite build and backend TypeScript build passed。
- base/head `git diff --no-index --check`: passed；36 个变更文件全部位于批准范围。
- 排除 `node_modules` 与 `dist` 后，测试快照源码与远端归档逐字节一致。
- `npm run verify:all`: exit 0；其中 frontend 126/126、backend 28/28、functions 44/44、Daily V4 287/287，三端 typecheck、静态 sourcing contract、固定历史窗口离线 replay、daily contract、临时 frontend build 与 diff-check 均完成。
- 离线 liveness replay 仍打印既有历史窗口的 `unhealthy-business-liveness` 诊断；该 task 本身成功，且它属于未修改的 sourcing 历史证据，不是本产品 DoD 或 delivery failure。
- 未运行 live generator、未写真实 Supabase、未使用 Computer Use / 截图 / GUI 视觉验收。

## Remaining

### Post-PR boundary

- PR #113 必须保持 draft；不得 ready、合并或部署，除非收到新的明确授权。
- 生产部署与 GUI 视觉验收未执行，也不属于本阶段完成条件。

### Non-blocking backlog

- P2：缺 `next_action`、但 `due_date` 在 7 天后的 Lead，展示状态为“缺下一步或日期”时仍会被“未来提醒”筛选命中。复现结果为 `displayedStatus=missing` 且 `futureFilterIds` 包含该 Lead；不影响记录、幂等、409、Lead 回写或日历同步，不阻塞本 PR。

## Next Action

保持 PR #113 为 draft 并停止。等待新的明确授权后，才可进入 ready / merge / deploy 或另开有界 P2 修复。

## Git Status

远端产品分支已包含阶段 1/2 实现、阶段 3 P1 修复与本 checkpoint；PR #113 为 open + draft。共享 sourcing 工作树在阶段 3 结束时仍与开工前完全一致：

```text
## codex/sourcing-rules-vnext...origin/codex/sourcing-rules-vnext [ahead 1]
 M docs/checkpoints/sourcing-rules-vnext.md
?? docs/SOURCING_RULES_PROPOSAL.md
?? docs/checkpoints/pr0-quality-quarantine.md
```
