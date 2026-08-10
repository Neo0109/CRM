# v2.8 沟通跟进工作台 checkpoint

## Current Goal

完成阶段 1（数据/API）：在不接触 sourcing 规则、日报 workflow、前端或真实业务数据的前提下，实现沟通记录模型、Cloudflare Functions API、本地 Express 等价接口及其窄测试。

## Remote Base

- Repository: `Neo0109/CRM`
- Base branch: `main`
- Base SHA: `04e5b24a775657a2b30ec7dfede1884eafd601e7`
- Product branch: `codex/product-communication-follow-up`
- Open PR at start: 0

## Allowed Scope

- `functions/_lib/` 中的 Interaction 模型与仓储
- `functions/api/interactions*` 的认证 GET/POST API
- `app/backend/` 中的本地 Express 等价 API、仓储与测试
- 必要的本地数据忽略规则
- 本 checkpoint

## Explicitly Out of Scope

- sourcing `PLAN.md`、规则文件和当前 3 个未提交文件
- 自动日报 workflow、Radar、Steam Trends、live generator
- 前端页面、导航、日历议程和产品版本号
- Supabase migration、RLS、Data API grants 或真实 Supabase 数据写入
- PR 创建、ready、merge、deploy

## Completed

- 用户已批准 v2.8 总体方案及阶段 1 实施。
- 已重新确认远端 `main@04e5b24a`、无 open PR、目标分支此前不存在。
- 已从该精确 SHA 创建隔离产品分支。

## Remaining

- 先写 Interaction 模型/校验与仓储测试。
- 实现 Cloudflare Functions GET/POST。
- 实现 Express 本地兼容及忽略的本地 JSON 存储。
- 运行阶段 1 窄测试与 typecheck。
- 回填验证证据并停在阶段边界。

## Next Action

读取远端基线中的相关模型、认证、仓储和测试契约，按 TDD 实现阶段 1。

## Git Status

远端产品分支干净，指向批准基线。当前共享本地工作树保持在 sourcing 分支且不作为写入目标：

```text
## codex/sourcing-rules-vnext...origin/codex/sourcing-rules-vnext [ahead 1]
 M docs/checkpoints/sourcing-rules-vnext.md
?? docs/SOURCING_RULES_PROPOSAL.md
?? docs/checkpoints/pr0-quality-quarantine.md
```
