# Sourcing CRM SOP

## 每日扫描

优先阵地：

1. Steam 新商店页 / Demo 页 / Steam News
2. GamesPress / PR 新闻稿
3. YouTube Trailer / 官方频道
4. B站 / indienova / 中文社区
5. 其他弱信号站点

样本目标：

- 原始样本池：20-50 条
- 观察池：8-15 条
- 推进池：1-3 条
- 淘汰池：同步保留原因

强筛规则：

- 排除 EA、叙事主导、印度团队。
- 海外项目必须满足高视觉或强数据。
- 已有成熟发行商且中国能力已占位，降权或淘汰。
- 发售过近，默认小于 60 天，不进推进池。
- Demo / 公开口碑低于 80%，淘汰。

## 自动同步

1. 日报主线由 `.github/workflows/sync-daily-report.yml` 定时或手动触发。
2. Workflow 运行 `automations/jobs/online_daily_runner.mjs -> online_daily_v4.mjs`，加载 `automations/rules/daily-report.json`，生成当天 `data/reports/`、`data/radar/` 和 `data/steam_trends/` 文件。
3. Workflow 完成结构校验后自动同步到 CRM；打开 CRM 直接 review（无需手动粘贴 JSON）。

## 手动兜底导入

仅当云端自动化异常、且已经确认某个日报 JSON 可用时，才使用本地手动兜底：

```bash
npm run import:daily -- data/reports/YYYY-MM-DD.json
```

## 人工处理

1. 先看推进池，补齐 Owner、Due Date、下一步动作。
2. 再看观察池，标记需要继续观察的公开信号。
3. 淘汰池只保留原因，不投入推进动作。
4. 每周复盘曝光轨迹和被淘汰原因，校准筛选规则。
