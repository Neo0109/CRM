import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./PRODUCT_ROADMAP_AUDIT.md", import.meta.url), "utf8");

test("documents the current CRM product surfaces before selecting new work", () => {
  for (const label of [
    "Leads Review",
    "Lead Detail",
    "quick actions",
    "线索助手",
    "行业雷达",
    "Steam 趋势",
    "自动化诊断",
    "Sourcing 学习",
    "Weekly Report",
    "Calendar",
    "导出",
    "Settings"
  ]) {
    assert.match(source, new RegExp(label));
  }
});

test("uses a business-value scoring matrix instead of another refactor queue", () => {
  for (const dimension of ["BD 判断效率", "减少漏跟进", "减少噪音/误判", "上线风险", "实现复杂度"]) {
    assert.match(source, new RegExp(dimension));
  }
  assert.match(source, /不是继续“为重构而重构”/);
});

test("locks the next feature priorities and defers risky settings work", () => {
  assert.match(source, /1\.\s+跟进闭环增强/);
  assert.match(source, /2\.\s+Lead Assistant 质量增强/);
  assert.match(source, /3\.\s+Sourcing Learning 可视化增强/);
  assert.match(source, /暂缓/);
  assert.match(source, /不恢复在线设置页/);
  assert.match(source, /邮箱验证码/);
  assert.match(source, /账号后台/);
});

test("keeps the roadmap audit docs-only and separates future implementation PRs", () => {
  assert.match(source, /不改运行时代码/);
  assert.match(source, /不运行 live generator/);
  assert.match(source, /下一轮真正功能 PR/);
});
