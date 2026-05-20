import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const promptPath = path.resolve(dirname, "../prompts/daily_scan.md");
const reportDate = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const prompt = await readFile(promptPath, "utf8");

console.log(prompt.replaceAll("{{report_date}}", reportDate));
