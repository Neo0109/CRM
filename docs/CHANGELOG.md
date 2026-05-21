# Changelog

## v1.1 - Review 工作台与行业雷达

发布日期：2026-05-21

### 产品变化

- 新增版本记录机制，本次版本为 `v1.1`。
- Leads 列表改为 review 工作台，新增地区、联系方式、备注、推荐理由/规则判断、链接和移池操作。
- 联系方式从单一文本升级为多联系方式结构，支持微信/QQ、Email、电话、官网、Steam、Discord、B站、X/Twitter、其他。
- 地区拆分为 `中国 / 海外` 和具体 `country / city`，自动导入时会尽量推断。
- 支持在列表和详情里把 lead 在推进池、观察池、淘汰池之间移动。
- 详情页升级为全量可编辑表单，覆盖项目、团队、地区、池子、阶段、优先级、联系方式、链接、产品判断、备注等。
- 新增“行业雷达”页面，用于展示游戏行业新闻、发行八卦、AI 游戏、新梗热点和 B站趋势。
- 每条推荐 lead 要求保留 Steam 链接、SteamDB 链接、官网或其他可判断画面/背景的链接；缺链接会在列表中高亮。
- 自动补链：lead 有 Steam AppID 时，系统会自动补上 Steam 商店页，避免只给 SteamDB 或漏掉可看画面的入口。
- 前端不再显示手动 JSON 导入口，默认走“每日自动化生成日报 -> 自动同步 Supabase -> 打开 CRM 即可 review”的流程。

### 数据结构

- 新增 `region`、`city`、`contact_methods`、`priority_reason`、`rule_fit` 字段。
- 保留旧字段 `public_signals` 和 `contact` 以兼容历史数据。
- 新增 `schemas/industry_radar.schema.json`。

### 自动化

- 每日扫描 prompt 会要求补齐联系方式、地区、推荐理由、规则判断和可验证链接。
- 每日自动化继续写入 `data/reports/YYYY-MM-DD.json` 并同步到 Supabase。
- 行业雷达自动化结果预留写入 `data/radar/YYYY-MM-DD.json`。
