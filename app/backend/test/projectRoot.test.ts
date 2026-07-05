import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { findProjectRoot } from "../src/lib/projectRoot.ts";

const rootDir = path.resolve(import.meta.dirname, "../../..");

describe("backend project root helper", () => {
  it("finds the repository root from source and nested dist locations", () => {
    assert.equal(findProjectRoot(path.join(rootDir, "app/backend/src")), rootDir);
    assert.equal(findProjectRoot(path.join(rootDir, "app/backend/dist/app/backend/src")), rootDir);
  });
});
