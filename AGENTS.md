# Codex Cloud 工作规则

1. 当前仓库为 Neo0109/CRM，默认基于 `main` 工作。
2. 不要破坏 GitHub Actions 自动日报结构。
3. 自动日报规则、产品功能迭代、UI 迭代要分开处理。
4. 修改后必须运行相关检查。
5. 完成后创建 PR，不要直接修改 `main`。
6. 自动日报主 workflow 只能由 `schedule` 或 `workflow_dispatch` 触发，不要重新加入产品代码 `push` 触发。
7. 日报健康以生成文件、结构校验、候选量和 `synced=true` 回执为准，不要只用 `created_unprocessed` 判失败。

## 重构计划审批说明标准

提出或执行 CRM 模块化重构计划时，先给出总体进度 checkpoint：当前 `origin/main`、已完成模块、open PR、这次只碰的模块，以及明确不碰的范围。

每个计划操作都要说明以下内容，方便审批时直观看到必要性和收益：

1. 当前模块的具体问题：例如职责混杂、隐式全局依赖、测试困难、文件过大、线上/本地边界不清、重复逻辑或诊断不可定位。
2. 不处理的负面影响：例如改一个来源误伤主流程、网络波动拖累纯逻辑测试、PR 冲突面扩大、问题排查只能靠 live run、后续模块继续堆成大文件。
3. 计划操作的具体原因：说明为什么要拆这个函数/模块/测试入口，为什么这一刀优先于其他候选，为什么不重复优化已完成模块。
4. 操作原理：说明采用的工程方法，如 TDD 先红后绿、纯逻辑与 orchestration 分离、显式参数替代隐式全局、source/decision/report/volume 分层、无依赖单测保护 parser/normalizer/decision。
5. 架构收益：说明如何降低 blast radius、稳定线上行为、让主脚本回到编排职责、让新增来源或 UI/API 改动能在小模块内完成、让回归测试不依赖 live generator。

说明要结合当前模块写具体事实，避免泛泛而谈。继续遵守按模块小 PR 推进：先确认最新 `main` 和队列状态，不回头重复拆已完成模块，除非有明确回归证据或未完成范围。

## Sourcing 规则长期维护

1. `docs/SOURCING_RULES_CURRENT.md` 是当前生效规则的人类可读入口，必须指向真实的机器规则源与自动化入口。
2. `docs/SOURCING_RULES_INPUT.md` 只用于整理下一版规则输入、证据和待决策项，不代表已生效线上行为。
3. Sourcing 规则迭代必须在 `docs/checkpoints/` 中记录基线、本次范围、明确不碰范围、验证证据和上线状态。
4. 规则文档、机器可读规则和生成器行为必须保持可追溯；未经验证的输入不得直接标记为当前生效规则。
5. Sourcing 规则变更不得夹带 CRM 产品功能或 UI 迭代，也不得改变自动日报 workflow 的触发边界。

## Long Task Checkpoint Protocol

对于超过一个阶段的任务（诊断、架构设计、规则调整、大规模修改）：

- 不得只依赖聊天上下文保存状态；
- 必须创建 checkpoint 文件记录：
  - Current Goal
  - Completed
  - Remaining
  - Next Action
  - Git Status
- 每完成一个阶段必须更新 checkpoint；
- 任务恢复时优先读取 checkpoint，而不是重新推理历史聊天。

## Context Budget Management

对于预计超过 15 分钟或涉及多个文件读取的任务：

- 不允许连续探索超过一个阶段。
- 每完成一个阶段（通常不超过 10 分钟）必须更新 checkpoint。
- 在进行：
  - 大量文件读取；
  - 网络搜索；
  - 多轮代码分析；
  - 架构推理；
  前必须先保存当前状态。

禁止等待系统自动 compact 后再保存状态。

## Task Size Control

- 单次任务不得同时包含：
  - 大量文件读取；
  - 图片解析；
  - 外部搜索；
  - 架构设计；
  - 代码修改。
- 当任务包含多个阶段时，每个阶段必须创建独立任务。
- checkpoint 用于跨任务恢复，不用于支持无限增长的单一任务。

## Task Scope Control

单次任务必须限制在一个可验证目标。

禁止一个任务同时包含：
- 架构分析；
- 多模块修改；
- 规则调整；
- 测试修复；
- PR 创建。

大型需求必须拆成多个 checkpoint 阶段。
每个阶段完成后停止等待确认。

## Phase Boundary

任何业务系统修改必须经过：

Phase 1:
Diagnosis
（只读分析）

Phase 2:
Proposal
（方案设计）

Phase 3:
Approval
（用户确认）

Phase 4:
Implementation
（代码修改）

不得从 Diagnosis 直接进入 Implementation。
