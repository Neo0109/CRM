# PR 8 Checkpoint — 精度与人工反馈闭环

## Current Goal

在独立分支 `codex/pr8-sourcing-learning` 上完整实施 `PLAN.md` 的 PR 8：建立可验证的人工结果口径、分母边界与 cohort 独立统计，并提供 `test:sourcing-learning`，不通过数量上限、最低数量、截断或 backfill 达成精度目标。

## Baseline

- `origin/main`: `0382d7de9a31b186153e27630684115d6beeb19df`
- Worktree: `/Users/neo/Documents/GitHub/CRM-pr8-sourcing-learning`
- Branch: `codex/pr8-sourcing-learning`
- PR 7: 按用户提供的已完成状态作为边界；不重新检查、不修改、不重复实施。

## Completed

- 已确认最新远端 `origin/main` 与授权基线一致。
- 已确认 PR 8 之外的现有本地未提交改动留在原 worktree，不会进入本分支。
- 已创建独立 PR 8 分支、worktree 和本 checkpoint。
- 已读取 `AGENTS.md`、`PLAN.md`、`docs/CODEX_DELIVERY_WORKFLOW.md` 和现有 Sourcing Learning 实现。
- 已完成只读诊断：
  - `functions/_lib/sourcingLearning.ts` 已有人工决策事件与学习报告，但把 `待评测`、`测试中` 归为中间态，不符合 PR 8 正向口径。
  - 当前明确分母虽由正向加负向组成，但没有可审计的分母/排除契约，也没有常规通道 `>=80%` 目标状态。
  - 决策事件 snapshot 未保存 `sourcing_lane`、`sourcing_rule_version`、`sourcing_run_type`，因此无法可靠拆分常规、EA、中文热度和 `initial_backfill`。
  - 当前 readiness 使用所有 cohort 的全局样本量，可能让 EA/backfill 样本误触发常规通道结论。
  - `test:sourcing-learning` 已存在且纳入 `verify:all`，但断言仍保护旧口径，需要先改成 PR 8 契约并确认红灯。

## Approved Implementation Slice

- 先改 `scripts/test-sourcing-learning.mjs`，覆盖正负口径、分母排除、30 样本边界、常规 80% 目标、cohort 独立性和禁止数量控制/自动改规则的 guardrail。
- 在决策事件 snapshot 中固化现有 Lead provenance；不新增表、不迁移历史数据，旧事件仅以当前 Lead provenance 作兼容回退。
- 用互斥 cohort 统计避免交叉污染：
  - `regular`：`indie_prelaunch` / `china_joint`，但排除 `initial_backfill`；
  - `ea_mobile_high_traction`：非 backfill 的 EA 通道；
  - `china_heat_ops`：非 backfill 的中文热度通道；
  - `initial_backfill`：优先按 run type 独立归组；
  - `unclassified`：缺少 provenance 的旧样本，绝不默认混入常规分母。
- `resolved = positive + negative`；`未处理`、`观察池`（业务口径“观察中”）及没有明确正负结果的评测状态只计 excluded，不进入分母。
- 淘汰/C+ 及以下优先判负；其余待评测、测试中、跟进中、推进池或 B+ 及以上判正；B/B- 单独不足以形成明确正负结果。
- 每个 cohort 少于 30 个 resolved 样本均标记 `provisional`；任何样本量都不允许自动修改生产规则。
- 常规通道在非 provisional 且精度低于 80% 时，只输出“定位并收紧误判规则”，显式禁止每日上限、最低数量、合格项目截断和 backfill。
- 更新现有 Sourcing Learning 前端类型/视图，展示上述互斥 cohort 与常规精度；不改导航、自动日报、生成器、导入逻辑或其他产品 UI。

## Architecture Rationale

- 当前问题：结果分类、cohort provenance 和展示 readiness 混在一个全局汇总中，无法判断哪条规则产生误判。
- 不处理的影响：EA/backfill 会污染常规精度，未解决状态可能被误读，低精度也无法定位到规则版本。
- 本次优先原因：PR 8 的唯一目标就是建立真实人工反馈闭环；在现有纯函数上补齐契约，改动面最小且不重做已完成的生成通道。
- 操作原理：TDD 先红后绿；事件采集与纯统计分离；显式 provenance 替代推断；互斥 cohort 和 resolved denominator 保护指标。
- 架构收益：降低对日报/Steam workflow 的 blast radius；CI fixture 可独立验证；后续只能依据明确 cohort/规则误判做小范围收紧，不会退回数量控制。

## Remaining

- 读取 PR 8 的精确交付契约和仓库现状。
- 以 TDD 实现人工结果分类、分母排除、常规/EA 中文热度/initial_backfill cohort 分离和 provisional 边界。
- 实现并运行 `test:sourcing-learning`。
- 运行窄测试、类型/契约检查、`verify:all` 和 `git diff --check`。
- 提交、推送、创建并验收 PR；处理 CI、review threads、mergeability 和范围。
- squash merge 后验证 Build、Cloudflare Pages、生产 `/api/health` 和 PR 8 线上验收条件。
- 更新 checkpoint 并完成 checkpoint 交付。

## Explicitly Out of Scope

- PR 7 的任何重新检查、修改或重复实施。
- PR 9 及后续工作。
- 自动日报 workflow 触发边界、产品 UI、数据库 migration、生产数据修改。
- 数量上限、最低数量、合格项目截断或 backfill。
- 少于 30 个已解决样本时自动修改生产规则。

## Next Action

提交诊断 checkpoint；随后先修改 `test:sourcing-learning` 形成 PR 8 红灯，再实现最小纯函数与前端契约。

## Git Status

- HEAD: `0382d7de9a31b186153e27630684115d6beeb19df`
- Working tree: 仅新增并更新本 checkpoint，尚未提交。
- PR: 尚未创建。
