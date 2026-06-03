# Codex Cloud 工作规则

1. 当前仓库为 Neo0109/CRM，默认基于 `main` 工作。
2. 不要破坏 GitHub Actions 自动日报结构。
3. 自动日报规则、产品功能迭代、UI 迭代要分开处理。
4. 修改后必须运行相关检查。
5. 完成后创建 PR，不要直接修改 `main`。
6. 自动日报主 workflow 只能由 `schedule` 或 `workflow_dispatch` 触发，不要重新加入产品代码 `push` 触发。
7. 日报健康以生成文件、结构校验、候选量和 `synced=true` 回执为准，不要只用 `created_unprocessed` 判失败。
