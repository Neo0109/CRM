# Sourcing CRM

面向 B站游戏发行 BD sourcing 的轻量 CRM，用来承接“前置发现 + 大漏斗筛选 + 正式推进”的工作流。

## 当前能力

- Leads 列表：搜索、池子、区域、阶段、Owner、发售窗口过滤
- Lead 详情：B站适配度、放大作用、发行结构、曝光轨迹、风险和下一步动作
- JSON 导入：支持每日扫描日报和 leads 数组
- 去重合并：项目名优先，其次 Steam AppID / 链接
- 导出：JSON / CSV
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

1. 用 `automations/prompts/daily_scan.md` 生成当天日报 JSON。
2. 在 CRM 页面粘贴 JSON 导入，或保存到 `data/reports/` 后运行：

```bash
npm run import:daily -- data/reports/daily_report.example.json
```

3. 在 CRM 中筛选推进池、观察池、淘汰池，补充 Owner / Due Date / 下一步动作。
