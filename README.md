# Sourcing CRM

面向 B站游戏发行 BD sourcing 的轻量 CRM，用来承接“前置发现 + 大漏斗筛选 + 正式推进”的工作流。

## 当前能力

- Leads 列表：搜索、池子、区域、阶段、Owner、发售窗口过滤
- Lead 详情：B站适配度、放大作用、发行结构、曝光轨迹、风险和下一步动作
- 月度视野表：从活跃项目预填，人工整理后按月确认留档并导出三列 Excel
- 自动同步：每日自动化报告可一键同步到 CRM（Supabase）
- Sourcing 证据完整性：B站完整详情中的 Steam 证据先结构化再建 Lead；Demo 解析到正式本体，影视/旧作新闻只进入雷达
- 去重合并：项目名优先，其次 Steam AppID / 链接
- 导出：全量 JSON / CSV / Excel，以及已确认月份的视野表 Excel
- 线上存储：部署后使用 Supabase 作为共享数据库
- 本地备用：未配置 Supabase 时使用 `data/leads.json`

## 快速启动

```bash
npm install
npm run dev
```

默认地址：

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8787`

## 线上部署

多电脑使用时，建议部署为线上服务并使用 Supabase 存储 leads。

部署说明见：

```text
docs/DEPLOY.md
```

## 目录

```text
app/
  frontend/      React CRM 页面
  backend/       Node API，本地读写 data/leads.json 或线上 Supabase
data/
  leads.json
  reports/
automations/
  prompts/
  jobs/
schemas/
docs/
```

## 每日流程

1. GitHub Actions 通过 `.github/workflows/sync-daily-report.yml` 定时或手动触发日报；`cloudflare/daily-report-heartbeat/worker.mjs` 在 GitHub schedule 延迟/丢弃时负责外部心跳补触发 watchdog。
2. 云端 workflow 运行 `automations/jobs/online_daily_runner.mjs -> online_daily_v4.mjs`，先校验 `automations/rules/daily-report.json`，再生成日报、行业雷达和 Steam 趋势，并同步到 CRM。
3. 打开 CRM 进入 review 工作台；自动化非淘汰线索先进入 `未处理` inbox，人工再决定观察、待评测、跟进、推进或淘汰。

手动兜底导入只用于云端自动化异常后的已知日报文件：

```bash
npm run import:daily -- data/reports/YYYY-MM-DD.json
```
