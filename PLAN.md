# CRM Sourcing 精准度修复方案：广泛扫描、符合即推荐

## 核心原则与当前基线

- 取消所有正式 Lead 数量上限和最低数量要求。
- 每天可以是 0 条，也可以是 3、10 或更多条；所有新发现、非重复且完整通过准入门的项目都应推荐。
- 排序只决定展示和人工查看顺序，不能因为排名靠后而淘汰合格项目。
- 不符合条件的项目不得为了填充日报进入 CRM，只保留在候选审计文件。
- 健康度衡量改为：来源扫描是否完整、规则是否正确执行、文件是否合法、同步是否成功，不再用正式 Lead 数量判断。
- 规划快照：远端 `main = 4b41b26a79a00b6c2b608c4acacc8eedca68f87d`；open PR 仅有无关的 `#71`；PR `#84/#86` 已完成。
- 每个编号对应一个独立 task 和 PR；确认本方案后，当前 task 只实施 PR 0。

## 已锁定的规则与接口

### 常规业务通道

- `indie_prelaunch`：独立游戏前置发行。
- `china_joint`：2A/3A 中国联合发行、营销或运营合作。
- 两个通道都不设每日上限，也不设保底数量。
- 所有通过完整资格门的新项目进入正式推荐。
- 自动化只写 `priority=null`，优先级由人工填写。

### EA 与中文热度通道

- `ea_mobile_high_traction`：
  - 确认当前仍处 EA；
  - 简中评论数 `≥1000`；
  - 简中好评率 `≥80%`。
- `china_heat_ops`：
  - EA 或已正式发行；
  - 简中评论数 `≥10000`；
  - 好评率只展示，不参与准入。
- 这两个通道同样不限数量；发行商、题材、地区、视觉表现和手游化判断只作为风险信息，不阻止推荐。
- 同时命中两条规则时只创建一个 Lead，以 `china_heat_ops` 为主通道，并保留全部 `matched_rules`。
- 评论口径使用 Steam `language=schinese`、`purchase_type=all` 的公开评论摘要，好评率按原始正评数除以总评论数计算。[Steamworks 评论接口](https://partner.steamgames.com/doc/store/getreviews?language=english)

### Lead/API 契约

- `priority: "P0" | "P1" | "P2" | "P3" | null`
- `sourcing_lane: "indie_prelaunch" | "china_joint" | "ea_mobile_high_traction" | "china_heat_ops" | null`
- `sourcing_rule_version: string | null`
- `sourcing_run_type: "scheduled" | "initial_backfill" | null`
- 新增 `POST /api/leads/import-daily-report?mode=create-only`：
  - 只写新 Lead；
  - 已有 Steam AppID/去重键计入 `skipped_existing`；
  - 不重写已有记录；
  - 成功响应包含 `synced=true`。
- 字段仍保存在现有 `crm_leads.data` JSON 中，不做 Supabase migration。

## 小步实施顺序

### PR 0：恢复日报契约并进入质量隔离

- 问题：内部 `_...` 字段泄漏和假 Steam 商店页候选导致生成失败；只修校验会把现有低质量池同步到 CRM。
- 修改：
  - 序列化前递归删除所有 `_` 开头字段。
  - 拒绝提到 Steam 商店页但没有规范 Steam URL/AppID 的内容。
  - 启用 `sourcing-rules-v6.8-quality-quarantine`：日报、Radar、Steam Trends 正常生成，但 Lead 池暂时为空。
  - 去除 quarantine 期间的 Lead 数量失败条件。
- 原理与收益：先恢复可验证的生成和同步链路，再开放新准入规则，避免修复事故时扩大噪声。
- 验证：回归 fixture、`test:daily-v4`、schema 校验、`verify:all`；定时运行必须有三类文件且回执同时满足 `status=success`、`sync_response.synced=true`。

### PR 1：Lead/API 产品契约

- 问题：必填优先级和缺失来源字段会把自动判断伪装成人工结论，也无法区分规则版本和回填 cohort。
- 修改：实现 nullable priority、sourcing provenance 和 create-only 导入模式。
- 原理与收益：以显式状态替代自动默认；create-only 只 upsert 新记录，保护历史 Lead。
- 验证：CRM core、backend、API、类型检查及 `verify:all`；原有导入接口默认行为保持兼容。

### PR 2：人工优先级 UI

- 问题：接口允许 null 后，前端需要提供明确的人工工作流。
- 修改：
  - 列表、详情、筛选显示“未标注”。
  - null 排在 P0–P3 之后。
  - 人工可以设置或清空优先级。
  - 导出不得出现字面量 `null`。
- 原理与收益：优先级回归人工决策，不再与自动资格判断混用。
- 验证：frontend 单测、typecheck、build、`verify:all` 和浏览器验收。

### PR 3：候选审计文件

- 问题：当前候选发现和正式推荐混合，无法确认系统究竟扫描了多少项目、为何排除。
- 修改：新增 `data/sourcing_candidates/YYYY-MM-DD.json` 及 schema，记录：
  - `formal | candidate | excluded`
  - AppID、去重键、通道、规则版本
  - 命中规则、缺失证据、排除原因
  - 来源链接、Steam 评论摘要、EA 状态、视觉状态
- 原理与收益：建立 source、decision、report、CRM import 四层边界；候选文件永不自动同步 CRM。
- 验证：结构、去重、空正式池、未知证据和损坏文件测试。

### PR 4：V7.0 独立游戏前置发行准入

- 问题：现有加分模型允许来源、标签和截图数量绕过产品质量，18 条目标还会把弱项目回填成 P2。
- 修改：
  - 删除 `minReviewLeads`、回填、P3→P2 和任何正式数量目标。
  - 新项目必须完整满足：
    - 身份和去重键明确；
    - 未正式发售、非 EA、窗口大于 60 天或 TBA；
    - 无成熟发行/中国能力占位；
    - 非叙事主导、非印度团队；
    - 有官方 Demo/Playtest 和官方实机证据；
    - 至少一项独立质量证明；
    - 有非 Steam 商务入口；
    - 有具体中国/B站增量价值；
    - 海外项目还要有明确中国需求。
  - 所有通过者进入 `push_pool`，`priority=null`；未通过者只进候选文件。
- 原理与收益：资格门不可由加分绕过；广泛扫描与严格准入解耦。
- 验收不变量：
  - `new_qualified_count === push_pool_count`
  - fixture 中 0、2、7 个合格项目必须分别输出 0、2、7 条，不能截断。
  - 历史 7 个缺少强数据的 Steam 弱样本均不能成为正式 Lead。

### PR 5：Steam 简中评论数据源

- 问题：当前只有 AppDetails 总推荐数，无法执行简中评论阈值。
- 修改：
  - 分页扫描公开可搜索的 Steam PC 游戏目录，简中页面摘要只用于预筛。
  - 对预命中项目调用官方评论接口确认正评、差评、总评论数。
  - 当前 EA 必须由 Steam EA 标签和官方商店 EA 状态二次确认。
  - 本 PR 仅生成数据审计 artifact，不同步 CRM。
- 原理与收益：网络采集与纯规则判断分离；CI 使用固定 fixture，不依赖实时 Steam。
- 边界测试：
  - `999 / 80%` 不通过 EA。
  - `1000 / 79.99%` 不通过 EA。
  - `1000 / 80%` 通过 EA。
  - `10000 / 任意好评率` 通过中文热度规则。

### PR 6：V7.1 EA/中文热度全量通道

- 问题：全目录扫描如果塞进主日报，会扩大失败面并拖慢常规推荐。
- 修改：
  - 新增独立 Steam review opportunity workflow，仅含 `schedule` 和 `workflow_dispatch`。
  - 主日报 workflow 触发器和执行链保持不变。
  - 首次 `mode=backfill` 完整扫描公开目录；扫描不完整时不写 CRM。
  - 扫描完成后通过 create-only 导入所有新命中项目，不设上限。
  - 后续定时复扫，只导入新发现或首次跨过阈值的项目。
  - 独立记录目录扫描量、合格量、去重数、创建数和同步回执。
- 原理与收益：高覆盖数据扫描独立运行；即使 Steam 扫描失败，常规日报仍可生成和同步。
- 验证：最终回执必须满足 `scan_complete=true`、`status=success`、`sync_response.synced=true`；已有 Lead 不得发生字段变化。

### PR 7：V7.2 2A/3A 中国联合发行准入

- 问题：只扫描早期独立游戏会漏掉已有数据基础、但仍存在中国联合发行空间的项目。
- 修改：
  - 与独立游戏并行扫描，不设通道配额或总量上限。
  - 数据条件：
    - Steam 推荐数 `≥5000`；或
    - 推荐数 `≥1500` 且达到 Very/Overwhelmingly Positive；或
    - 团队已有经验证大作记录，并出现当前官方产品事件。
  - 必须同时确认当前仍存在中国发行、版号、本地化、营销、手游或联合运营需求，并且没有成熟中国伙伴占位。
  - 所有完整通过者正式推荐；排序只决定阅读顺序。
- 原理与收益：两条业务线共享证据模型，但各自保留不可绕过的商业资格门。
- 验证：构造同日 5 个独立项目和 4 个联合发行项目全部合格的 fixture，必须输出 9 条；无中国需求或已占位项目不得进入正式池。

### PR 8：精度与人工反馈闭环

- 问题：取消数量限制后，更需要证明“全部符合即推荐”没有降低整体质量。
- 修改：
  - 正向：进入待评测、测试中、跟进中、推进池，或评测达到 B+ 及以上。
  - 负向：淘汰或 C+ 及以下。
  - 未处理、观察中和未完成评测不进入分母。
  - 常规通道目标精度保持 `≥80%`，但不以截断数量达成；低于目标时收紧错误规则，而非设置推荐上限。
  - EA/热度通道和 `initial_backfill` 单独统计转化率。
  - 少于 30 个已解决样本标记 provisional，不自动修改规则。
- 原理与收益：用真实人工结果约束准入质量，而不是用每日条数制造表面稳定。
- 验证：`test:sourcing-learning`、cohort 分离、分母边界和 `verify:all`。

### PR 9：视觉 AI 手动旁路

- 问题：视觉 AI 有辅助价值，但会产生费用且不能成为推荐链路依赖。
- 修改：
  - 只保留独立 `workflow_dispatch` 审计能力。
  - 不修改日报、不调用 CRM import、不撤回或降级 Lead。
  - 当前不创建新 API key，生产调用默认禁用；CI 仅使用 fake provider。
  - 未来启用时再显式配置 key、模型和调用预算。[OpenAI 图像输入](https://platform.openai.com/docs/guides/images-vision)、[Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- 原理与收益：保留未来能力，但默认零成本、零阻塞、零推荐影响。

## 检查、上线与 checkpoint 协议

- 每个 PR 运行对应窄测试及 `npm run verify:all`；规则 PR 额外运行 Daily V4、schema 和 fixture 校验。
- 不在本地生成或同步真实日报，不直接修改 Supabase；所有代码通过 GitHub PR 交付。
- 每阶段开始前重新确认远端 `main`、open PR、Actions 队列和当前 checkpoint。
- 每阶段结束更新 Current Goal、Completed、Remaining、Next Action、Git Status，然后停止。
- 生产验收记录远端 SHA、Actions URL/head SHA、artifact 路径、扫描量、合格量、排除原因分布、`/api/health` 和成功同步回执。
- 正式 Lead 为 0 不再构成 degraded；只有来源扫描异常、结构损坏、写入失败或 `synced!=true` 才属于交付失败。
- 若 V7 出现回归，回退到质量隔离状态，不能恢复旧的数量回填机制。


## Approved Radar media expansion (2026-09-06)

The user explicitly authorized this independent PR in the current session. Deliver 30–40 China/global curated external news items with a hard limit of 40; enforce source=3, region=24, topic=12 and shared Bilibili=3 caps with China/global targets of 16 each. Prefer 24h and admit no older than 72h; verify missing publication dates from article metadata; suppress prior 7-day URL/title duplicates, excluding same-day reruns; merge only same-product/same-event videos. Add AUTOMATON WEST, GamesRadar+ and repaired Chuapp website collection exclusively to Radar after GitHub Actions source verification. Preserve source media inputs and Lead admission, Steam Trends, UI, API/schema and all daily workflow triggers. New Radar networking has a 90-second deadline, bounded concurrency, isolated errors and no count failure gate. Run fixed regressions, all Daily tests, schemas and npm run verify:all; review exact PR head, then normal merge/deploy and real Radar/synced=true receipt verification. Checkpoint: docs/checkpoints/pr-radar-media-expansion.md. Only this PR is authorized in this task; stop after acceptance.

## Approved V7.2.3 official gameplay value (2026-09-06)

The user explicitly approved this single independent sourcing PR. Add deriveOfficialGameplayChinaBilibiliValue({ appId, details }) in the existing indie-admission module, consuming only official full-game Steam AppDetails bound to the exact AppID. Preserve prior evidence and results; use short description and gameplay body only as a fallback for concrete operation/result mechanisms (co-op, management, deckbuilding, physics puzzles/traversal, skill combat, survival shooting with systems). Reject vague tags, marketing, negation and other-game comparisons. This is a content opportunity only, not quality/traction/cooperation proof. Keep every hard gate, unlimited strict qualification, at most one review soft gap, review cap 3/day, all data contracts, existing seven-day cache TTL and workflow triggers. No new requests, search expansion, Radar, Bilibili identity or cross-platform release work. Freeze five official samples; validate same-input before/after, negative admission cases, dedupe/count parity and V7.3 compatibility. Run focused tests, test:daily-v4, verify:all, types/contracts/diff, then create one PR, review, merge and verify normal deployment and health. Do not force generation or synchronization. The 5–10/week business goal remains pending seven natural days after cache turnover and must never trigger automatic gate relaxation. Checkpoint: docs/checkpoints/pr-v723-official-gameplay-value.md.
