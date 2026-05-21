# Changelog

## v1.2 - 设置、安全导出与待处理工作流

发布日期：2026-05-21

### 已完成

- 新增 CRM 设置后端接口 `/api/settings`，用于保存绑定邮箱、Excel 导出密码和登录密码配置。
- 新增独立密码保护的 Excel 导出接口 `/api/export/excel`，导出内容包含 leads 的地区、处理状态、联系方式、Steam/SteamDB 链接、备注和规则判断等字段。
- 新增 `跟进中` 池子、未处理状态和 review 时间字段，未处理 leads 会持续保留并优先展示。
- 联系方式清洗规则升级：Steam/SteamDB 不再混入联系方式，只保留真实联系方式；游戏链接统一放到链接字段。
- 有 Steam AppID 的 lead 会自动保留游戏本体 Steam 商店和 SteamDB 链接，并过滤其他 Steam AppID 链接，减少 DLC/重复项干扰。
- 前端版本号升级为 `v1.2`，并加入跟进/淘汰/已看快捷处理动作。
- 全局字体改为更适合中文阅读的系统字体栈。

### 进行中

- 设置页前端入口、Excel 导出按钮和密码修改表单。
- 修改密码时的邮箱验证码流程。
- Steam 趋势页与趋势线索自动入库。
- 线索助手对话框，支持输入关键词/信息并生成 leads。

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
- 自动同步时会合并已有联系方式和链接，避免后续日报覆盖你人工补过的信息。
- 前端不再显示手动 JSON 导入口，默认走“每日自动化生成日报 -> 自动同步 Supabase -> 打开 CRM 即可 review”的流程。

### 数据结构

- 新增 `region`、`city`、`contact_methods`、`priority_reason`、`rule_fit` 字段。
- 保留旧字段 `public_signals` 和 `contact` 以兼容历史数据。
- 新增 `schemas/industry_radar.schema.json`。

### 自动化

- 每日扫描 prompt 会要求补齐联系方式、地区、推荐理由、规则判断和可验证链接。
- 每日自动化继续写入 `data/reports/YYYY-MM-DD.json` 并同步到 Supabase。
- 行业雷达自动化结果预留写入 `data/radar/YYYY-MM-DD.json`。
