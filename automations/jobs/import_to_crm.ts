import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const reportPath = process.argv[2];

if (!reportPath) {
  console.error("Usage: npm run import:daily -- data/reports/YYYY-MM-DD.json");
  process.exit(1);
}

const apiUrl = process.env.CRM_API_URL ?? "http://localhost:8787";
const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(dirname, "../..");
const absolutePath = path.isAbsolute(reportPath) ? reportPath : path.resolve(rootDir, reportPath);
const report = JSON.parse(await readFile(absolutePath, "utf8"));

const response = await fetch(`${apiUrl}/api/leads/import-daily-report`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(report)
});

if (!response.ok) {
  const payload = await response.text();
  throw new Error(`Import failed: ${response.status} ${payload}`);
}

const result = await response.json();
console.log(JSON.stringify(result, null, 2));
