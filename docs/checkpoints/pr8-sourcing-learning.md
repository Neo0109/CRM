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
- 已完成核心 TDD 步骤：
  - 先扩展 `scripts/test-sourcing-learning.mjs`，确认红灯准确暴露 provenance、正向边界和 cohort/precision 契约缺失（9 tests 中 4 fail）。
  - 在 `functions/_lib/sourcingLearning.ts` 为新事件固化 lane/rule/run provenance，并对旧事件使用当前 Lead provenance 兼容回退。
  - 已实现互斥 cohort、resolved denominator、常规 80% 目标、30 样本 provisional、规则版本拆分和禁止数量控制/自动改规则 guardrail。
  - 已修正结果优先级：淘汰或 C+ 及以下为负向；否则待评测、测试中、跟进中、推进池或 B+ 及以上为正向；未处理、观察池和其余未明确结果不进分母。
- 核心验证已通过：
  - `npm run test:sourcing-learning`（9/9 tests pass）
  - `npm run typecheck:functions`
  - 独立 worktree 初始缺少依赖，已用 `npm install --no-package-lock --ignore-scripts` 恢复本地依赖；未改依赖版本或锁文件。
- 已完成前端 TDD 步骤：
  - 先扩展 `sourcingLearningContract` / `sourcingLearningView` 测试，确认旧视图仍以全局样本判断 readiness 且没有 cohort 展示（7 tests 中 5 fail）。
  - 已同步 API 类型，新增常规、EA 高热、中文热度、`initial_backfill`、未分类旧样本五个互斥 cohort 的精度卡片。
  - 常规通道少于 30 个 resolved 样本显示 `provisional`；达到样本门槛后才显示 80% 达标或“收紧误判规则”。
  - 正向/负向/观察/待定帮助文案已与分母边界一致，并明确低精度不使用数量控制。
- 前端窄验证已通过：
  - `npx tsx --test app/frontend/test/sourcingLearningContract.test.mjs app/frontend/test/sourcingLearningView.test.mjs`（7/7 tests pass）
  - `npm run typecheck --workspace app/frontend`
- 已完成最终本地验证：
  - `npm run test:sourcing-learning`（9/9 tests pass）
  - `npm run test:verify-all`（6/6 tests pass，确认 `sourcing-learning-test` 保持在完整验证入口）
  - `npm run verify:all` 连续两次 exit 0；覆盖 frontend/backend/functions、Daily V4、automation diagnostics、lead assistant、sourcing learning、heartbeat、三套 typecheck、Sourcing V7.2/Bilibili 契约、日报契约、临时生产构建和 diff check。
  - `git diff --check origin/main...HEAD`
- 已完成 diff 范围审计：仅 8 个 PR 8 文件（学习纯函数、前端类型/view/现有诊断块、对应测试和本 checkpoint）；没有 workflow、生成器、导入逻辑、schema、数据文件、PR 7 或 PR 9 修改。

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

提交最终验证 checkpoint，推送 `codex/pr8-sourcing-learning`，创建以 `main` 为 base 的 PR，并检查 CI、review threads、mergeability 与远端 diff 范围。

## Git Status

- HEAD: `0382d7de9a31b186153e27630684115d6beeb19df`
- Commits: `b6b97e8`, `94b3cd6`, `0504a29`，另有本 checkpoint 最终验证更新待提交。
- Working tree: 仅本 checkpoint 的最终验证更新待提交；`node_modules` 为 ignored 安装产物。
- PR: 尚未创建。
