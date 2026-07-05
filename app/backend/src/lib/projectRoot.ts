import { accessSync } from "node:fs";
import path from "node:path";

export function findProjectRoot(startPath: string) {
  let current = path.resolve(startPath);

  while (true) {
    if (exists(path.join(current, "package.json")) && exists(path.join(current, "schemas")) && exists(path.join(current, "app"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) throw new Error(`Unable to locate project root from ${startPath}`);
    current = parent;
  }
}

function exists(candidate: string) {
  try {
    accessSync(candidate);
    return true;
  } catch {
    return false;
  }
}
