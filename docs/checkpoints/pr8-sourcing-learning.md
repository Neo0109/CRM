# PR 8 Checkpoint — 精度与人工反馈闭环

## Current Goal

将已完成的 PR 8 功能合并与线上验收证据写回 checkpoint，并通过独立 checkpoint-only PR 交付；完成后停止，不进入 PR 9。

## Baseline

- `origin/main`: `0382d7de9a31b186153e27630684115d6beeb19df`
- Worktree: `/Users/neo/Documents/GitHub/CRM-pr8-sourcing-learning`
- Branch: `codex/pr8-sourcing-learning`
- PR 7: 按用户提供的已完成状态作为边界；不重新检查、不修改、不重复实施。
- Feature PR: [#100](https://github.com/Neo0109/CRM/pull/100)
- Feature merge SHA: `c2a75272cc2ee634b5fff34786f0cc184f856d81`
- Final-acceptance worktree: `/Users/neo/Documents/GitHub/CRM-pr8-final-acceptance`
- Final-acceptance branch: `codex/pr8-final-acceptance`

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
- 已推送 `codex/pr8-sourcing-learning` 并创建 ready PR [#100](https://github.com/Neo0109/CRM/pull/100)，base=`main`、head=`codex/pr8-sourcing-learning`。
- 远端 PR diff 已复核为同一组 8 个 PR 8 文件；创建时 GitHub 报告 `mergeable=MERGEABLE`，Build / Cloudflare checks 正在运行。
- PR #100 最终交付已完成：
  - final head `aa3f1fc309c55972889b34b1471662bd3ca1b54f` 的两条 Build checks 和 Cloudflare Pages check 均为 success；review threads=0、reviews=0、mergeability=`CLEAN/MERGEABLE`。
  - PR #100 于 `2026-07-17 00:56:02 Asia/Shanghai` squash merge，merge SHA=`c2a75272cc2ee634b5fff34786f0cc184f856d81`。
- 合并后部署已验收：
  - Build run [`29517658845`](https://github.com/Neo0109/CRM/actions/runs/29517658845) 针对 merge SHA 完成并 success。
  - Cloudflare Pages deployment `e0c849fc-0856-4dd1-9c2e-fdb2f8c1562b` 针对同一 SHA 完成并 success；生产 preview 为 `https://e0c849fc.crm-pages.pages.dev`。
  - `2026-07-17 00:57:20 Asia/Shanghai` 请求 `https://crm-pages.pages.dev/api/health` 返回 HTTP 200、`ok=true`、`storage=supabase`、用户配置状态 `valid`。
- PR 8 线上契约验收通过：
  - 未登录请求 `/api/sourcing-learning` 返回预期 HTTP 401 `CRM login required`，受保护路由存在且未放宽鉴权。
  - 生产 HTML 标题为 `BD 决策工作台`，实际引用 `/assets/index.js?v=20260713-sourcing-evidence-integrity-v276`。
  - 该生产 bundle 已包含 `精度与 cohort`、`常规 Sourcing`、`EA 高热`、`中文热度`、`initial_backfill`、`常规通道 provisional`、`未完成评测`、`不使用数量控制` 和禁止自动修改规则文案。
  - 生产 bundle、同 SHA Cloudflare 成功部署、HTTP 200 health 与完整 CI/TDD 共同证明 PLAN.md PR 8 的 cohort 分离、分母边界、provisional 和 guardrail 已上线。
  - 浏览器成功加载生产标题；受保护页面的深层 DOM/API 只读桥接连续超时，因此视觉细节验收记录为 incomplete，未冒充已读取真实生产样本。PLAN.md 未要求以真实样本量作为上线门槛，线上契约验收仍为 pass。

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

- 提交、推送并合并本 checkpoint-only PR。
- 验证 checkpoint merge 后的最终 `main`、Build、Cloudflare Pages 和生产 `/api/health`，随后停止。

## Explicitly Out of Scope

- PR 7 的任何重新检查、修改或重复实施。
- PR 9 及后续工作。
- 自动日报 workflow 触发边界、产品 UI、数据库 migration、生产数据修改。
- 数量上限、最低数量、合格项目截断或 backfill。
- 少于 30 个已解决样本时自动修改生产规则。

## Next Action

提交本最终验收记录，创建 checkpoint-only PR，检查其 CI/review/mergeability/diff 后 squash merge；验证最终 main 部署与 health 后停止，不进入 PR 9。

## Git Status

- HEAD: `c2a75272cc2ee634b5fff34786f0cc184f856d81`
- Feature PR: #100 merged。
- Working tree: 仅本 checkpoint 的最终验收更新待提交。
- Checkpoint PR: 尚未创建。
