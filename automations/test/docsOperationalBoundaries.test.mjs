import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("../..", import.meta.url)));

function readRepoFile(repoPath) {
  return readFileSync(resolve(rootDir, repoPath), "utf8");
}

function assertManualImportIsFallbackOnly(source, label) {
  const importIndex = source.indexOf("npm run import:daily");
  if (importIndex === -1) return;

  const fallbackIndex = source.search(/手动兜底|manual fallback|fallback import/i);
  assert.notEqual(fallbackIndex, -1, `${label} should label import:daily as a manual fallback`);
  assert.ok(
    fallbackIndex < importIndex,
    `${label} should mention the manual fallback boundary before showing import:daily`
  );
}

describe("operational documentation boundaries", () => {
  it("documents the active cloud daily-report entrypoint in README", () => {
    const readme = readRepoFile("README.md");

    assert.match(readme, /\.github\/workflows\/sync-daily-report\.yml/);
    assert.match(readme, /online_daily_runner\.mjs\s*->\s*online_daily_v4\.mjs/);
    assert.match(readme, /automations\/rules\/daily-report\.json/);
    assert.doesNotMatch(
      readme,
      /automations\/prompts\/daily_scan\.md/,
      "README should not describe the legacy prompt as the current daily entrypoint"
    );
    assertManualImportIsFallbackOnly(readme, "README");
  });

  it("keeps SOP daily sync focused on GitHub Actions and treats import as fallback only", () => {
    const sop = readRepoFile("docs/SOP.md");

    assert.match(sop, /\.github\/workflows\/sync-daily-report\.yml/);
    assert.match(sop, /online_daily_runner\.mjs\s*->\s*online_daily_v4\.mjs/);
    assert.doesNotMatch(
      sop,
      /automations\/prompts\/daily_scan\.md/,
      "SOP should not point operators at the legacy daily prompt as the active path"
    );
    assertManualImportIsFallbackOnly(sop, "SOP");
  });

  it("documents Cloudflare as the settings and password control plane", () => {
    const deploy = readRepoFile("docs/DEPLOY.md");

    assert.match(deploy, /CRM_USERS_JSON/);
    assert.match(deploy, /EXCEL_EXPORT_PASSWORD/);
    assert.match(deploy, /Cloudflare (Pages )?(Variables|variables) (and|\/) (Secrets|secrets)/);
    assert.match(deploy, /CRM 设置页/);
    assert.match(deploy, /不在线修改|不再在线修改|does not edit/i);
    assert.match(deploy, /登录密码/);
    assert.match(deploy, /导出密码/);
  });
});
