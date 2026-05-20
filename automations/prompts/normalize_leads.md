读取当天 daily_report.json。

目标：
1. 对所有 leads 做去重，项目名优先，其次 Steam AppID / 官网链接。
2. 已存在项目：更新 bucket / stage / public_signals / exposure_trail / notes。
3. 新项目：写入 leads.json 或数据库。
4. 保留 first_seen，不要被覆盖。
5. 输出导入结果摘要：新增多少、更新多少、淘汰多少。

注意：
- `推进池` 默认 stage 为 `active`。
- `观察池` 默认 stage 为 `watch`。
- `淘汰池` 默认 stage 为 `rejected`。
- 缺少的布尔字段补为 `false`。
- 缺少的可空字段补为 `null`。
