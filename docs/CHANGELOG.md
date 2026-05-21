# Changelog

## v1.2 - 设置、安全导出、待处理工作流与趋势助手

发布日期：2026-05-21

### 已完成

- 新增 CRM 设置页，可维护绑定邮箱、Excel 导出密码和登录密码。
- 新增设置接口 `/api/settings`，配置保存在 Supabase 的 CRM 设置行里，不依赖单台电脑本地数据。
- 新增验证码接口 `/api/settings-verification`。修改登录密码或 Excel 导出密码时，会校验绑定邮箱验证码；邮件发送依赖 Cloudflare 环境变量 `RESEND_API_KEY` 和 `CRM_FROM_EMAIL`。
- 新增独立密码保护的 Excel 导出接口 `/api/export/excel`，导出字段包含地区、处理状态、联系方式、Steam/SteamDB 链接、备注和规则判断。
- 新增 `跟进中` 池子、未处理状态和 review 时间字段；未处理 leads 会像未读邮件一样持续保留并优先展示。
- 列表与详情页新增 `跟进`、`淘汰`、`已看` 快捷动作，可直接把 lead 放入对应池子。
- 联系方式清洗规则升级：Steam/SteamDB 不再混入联系方式，只保留真实联系方式；游戏链接统一放到链接字段。
- 有 Steam AppID 的 lead 会自动保留游戏本体 Steam 商店和 SteamDB 链接，并过滤其他 Steam AppID 链接，减少 DLC/重复项干扰。
- 新增 Steam 趋势页和 `/api/steam-trends` 接口，读取每日 `data/steam_trends/YYYY-MM-DD.json`，并把适合 CRM 的候选自动合并进 Supabase。
- 新增 Steam 趋势自动化 prompt 与 schema：`automations/prompts/steam_trends.md`、`schemas/steam_trends.schema.json`。
- 新增线索助手入口和 `/api/lead-assistant` 接口，可输入关键词、线索说明、Steam 链接和截图备注；接口会抽取 Steam AppID、真实联系方式，并从 Steam appdetails 补项目名、团队、类型、发行商和发售信息后直接写入 CRM。
- 线索助手会跳过 Steam 返回的非 game 类型，降低 DLC/工具/原声带误入库概率。
- 前端版本号升级为 `v1.2`，全局字体改为更适合中文阅读的系统字体栈。

### 后续增强

- 线索助手当前支持截图备注保存；真正的截图 OCR/视觉识别可以在后续接入 OpenAI Vision 或其他 OCR 服务。
- Steam 趋势数据依赖每日自动化写入 `data/steam_trends/YYYY-MM-DD.json`，上线后需要把自动化任务指向新的 Steam 趋势 prompt。

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
