# v2.8 沟通跟进工作台 checkpoint

## Current Goal

阶段 1（数据/API）已完成并验证。当前停在阶段边界，等待用户确认后再进入阶段 2（前端/日历）。

## Remote Base

- Repository: `Neo0109/CRM`
- Base branch: `main`
- Base SHA: `04e5b24a775657a2b30ec7dfede1884eafd601e7`
- Product branch: `codex/product-communication-follow-up`
- Stage 1 implementation head before this checkpoint update: `0eef33daf21cebcf01a837579537c84ff61f77ba`
- End-of-stage comparison: remote `main` remains identical to the approved base; product branch is ahead and not behind
- Open PR at end of stage: 0

## Allowed Scope

- `functions/_lib/` 中的 Interaction 模型与仓储
- `functions/api/interactions.ts` 的认证 GET/POST API
- `app/backend/` 中的本地 Express 等价 API、仓储与测试
- `.gitignore` 中的本地沟通历史忽略规则
- 本 checkpoint

## Explicitly Out of Scope

- sourcing `PLAN.md`、规则文件和当前 3 个未提交文件
- 自动日报 workflow、Radar、Steam Trends、live generator
- 前端页面、导航、日历议程和产品版本号
- Supabase migration、RLS、Data API grants 或真实 Supabase 数据写入
- PR 创建、ready、merge、deploy

## Completed

- 新增共享 `InteractionEvent` 模型、固定字段、渠道白名单和安全长度校验。
- 服务端生成 `actor`、`created_at` 与 `__crm_interaction_event__<request_id>` 幂等系统行 ID。
- 覆盖摘要-only、仅下一步、带日期三种行为；带日期时只更新现有 Lead 日历字段。
- 拒绝日期早于沟通日期、日期无下一步、非法渠道、越界字段和不在 `跟进中/推进池` 的 Lead。
- 新增认证 `GET/POST /api/interactions`，默认 50、最大 100、opaque cursor、沟通时间倒序。
- POST 重查 Lead 与池子，重用 request ID 时返回已存事件；跨 Lead 冲突或移出允许池子返回 409。
- 生产仓储继续使用 `crm_leads` 系统行；有 Lead 变化时，事件行与 Lead 行通过一次批量 upsert 写入。
- Supabase 查询按 JSONB `data->>lead_id` 分页；存储错误不回显响应正文。
- 本地 Express 接入等价 GET/POST；无显式认证配置时使用服务端固定的 `Local CRM` actor，有配置时解析认证用户。
- 本地沟通历史只写 `data/interactions.local.json`，该文件已忽略；第一版没有 PATCH/PUT/DELETE。
- 正常 Lead 读取、导出与 sourcing learning 继续由既有 `__crm_` 系统行过滤保护。
- 没有运行 live generator，没有修改或写入真实 Supabase 数据。

## Verification Evidence

- TDD red: 新测试最初因 `interactionModel.ts` 尚不存在而失败。
- `npm run test:crm-core`: 44/44 passed。
- `npm run test:backend`: 28/28 passed。
- `npm run typecheck:functions`: passed。
- `npm run typecheck --workspace app/backend`: passed。
- `git diff --check 04e5b24a775657a2b30ec7dfede1884eafd601e7...HEAD`: passed。
- GitHub compare: 变更文件仅限本 checkpoint 的 Allowed Scope；远端 `main` 未漂移。

## Remaining

### Stage 2 — Frontend / Calendar

- 新增“沟通跟进”顶级导航和独立页面。
- 实现项目筛选排序、按需时间线、沟通表单、快速切换竞态与保存状态。
- 将 API 返回的 Lead 回写 App 状态，并在日历议程卡展示 `next_action`。
- 运行规范版本命令升级到 `v2.8-communication-follow-up`。
- 更新 checkpoint 并再次停在阶段边界。

### Stage 3 — Independent Acceptance / Draft PR

- 运行三端完整验收、临时目录 build、`verify:all` 等批准命令。
- 重新确认远端基线后创建 draft PR；不 ready、不合并、不部署。

## Next Action

等待用户确认阶段 1 结果。获得确认后，只开始阶段 2（前端/日历），不提前执行阶段 3。

## Git Status

远端产品分支已包含阶段 1 实现与验证，尚未创建 PR。当前共享本地工作树完全保持在原 sourcing 分支，状态与开工前一致：

```text
## codex/sourcing-rules-vnext...origin/codex/sourcing-rules-vnext [ahead 1]
 M docs/checkpoints/sourcing-rules-vnext.md
?? docs/SOURCING_RULES_PROPOSAL.md
?? docs/checkpoints/pr0-quality-quarantine.md
```
