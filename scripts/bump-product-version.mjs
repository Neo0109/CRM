import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "config/product-version.json");
const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function hasArg(name) {
  return args.includes(name);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function writeText(relativePath, value) {
  fs.writeFileSync(path.join(root, relativePath), value);
}

function bumpVersion(current) {
  const match = current.match(/^v(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error(`Unsupported product version: ${current}`);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = match[3] === undefined ? null : Number(match[3]);

  if (hasArg("--major")) return `v${major + 1}.0`;
  if (hasArg("--patch")) return patch === null ? `v${major}.${minor}.1` : `v${major}.${minor}.${patch + 1}`;
  return `v${major}.${minor + 1}`;
}

function replaceRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Could not update ${label}`);
  return source.replace(pattern, replacement);
}

const manifest = JSON.parse(readText("config/product-version.json"));
const nextVersion = readArg("--set") ?? bumpVersion(manifest.version);
const slug = readArg("--slug") ?? manifest.slug;
const summary = readArg("--summary") ?? "Product iteration";
const healthVersion = `${nextVersion}-${slug}`;
const labelPrefix = manifest.labelPrefix ?? "Neo's BD Matrix";
const brandLabel = `${labelPrefix} · ${nextVersion}`;

manifest.version = nextVersion;
manifest.slug = slug;
manifest.labelPrefix = labelPrefix;
writeText("config/product-version.json", `${JSON.stringify(manifest, null, 2)}\n`);

writeText("app/frontend/src/productVersion.ts", [
  `export const productVersion = ${JSON.stringify(nextVersion)};`,
  `export const productReleaseSlug = ${JSON.stringify(slug)};`,
  `export const productHealthVersion = ${JSON.stringify(healthVersion)};`,
  `export const productVersionLabel = \`${labelPrefix} · \${productVersion}\`;`,
  ""
].join("\n"));

for (const file of ["functions/index.ts", "functions/[[path]].ts"]) {
  let source = readText(file);
  source = replaceRequired(source, /const brandLabel = "Neo's BD Matrix · v[^"]+";/, `const brandLabel = ${JSON.stringify(brandLabel)};`, file);
  writeText(file, source);
}

for (const file of ["functions/api/health.ts", "app/backend/src/server.ts"]) {
  let source = readText(file);
  source = replaceRequired(source, /version: "v[^"]+"/, `version: ${JSON.stringify(healthVersion)}`, file);
  writeText(file, source);
}

let context = readText("docs/CRM_OPTIMIZATION_CONTEXT.md");
context = replaceRequired(
  context,
  /Current product version after the version governance update: `v[^`]+`/,
  `Current product version after the latest product iteration: \`${nextVersion}\``,
  "docs/CRM_OPTIMIZATION_CONTEXT.md"
);
writeText("docs/CRM_OPTIMIZATION_CONTEXT.md", context);

let changelog = readText("docs/CHANGELOG.md");
const changelogLine = `- 产品可见版本升级为 \`${nextVersion}\`（\`${healthVersion}\`）：${summary}`;
if (!changelog.includes(changelogLine)) {
  changelog = replaceRequired(changelog, /(## Unreleased\n\n### 产品变化\n\n)/, `$1${changelogLine}\n`, "docs/CHANGELOG.md");
  writeText("docs/CHANGELOG.md", changelog);
}

console.log(`Product version bumped to ${nextVersion} (${healthVersion})`);
