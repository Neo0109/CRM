import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  sanitizeArtifactPayload,
  serializeArtifact
} from "../jobs/online_daily_v4_artifacts.mjs";

const fixture = JSON.parse(readFileSync(
  new URL("./fixtures/private-artifact-fields.json", import.meta.url),
  "utf8"
));
const generatorSource = readFileSync(
  new URL("../jobs/online_daily_v4.mjs", import.meta.url),
  "utf8"
);

describe("online daily v4 artifact serialization", () => {
  it("recursively removes private fields without mutating the runtime payload", () => {
    const original = structuredClone(fixture.input);

    const sanitized = sanitizeArtifactPayload(fixture.input);

    assert.deepEqual(sanitized, fixture.expected);
    assert.deepEqual(fixture.input, original);
  });

  it("serializes only the public artifact contract and preserves the trailing newline", () => {
    const serialized = serializeArtifact(fixture.input);

    assert.equal(serialized, `${JSON.stringify(fixture.expected, null, 2)}\n`);
    assert.doesNotMatch(serialized, /"_[^"]*"\s*:/);
  });

  it("routes generator artifact writes through the public-contract serializer", () => {
    assert.match(generatorSource, /import \{ serializeArtifact \} from "\.\/online_daily_v4_artifacts\.mjs";/);
    assert.match(generatorSource, /writeFile\(absolutePath, serializeArtifact\(payload\), "utf8"\)/);
    assert.doesNotMatch(generatorSource, /writeFile\(absolutePath, `\$\{JSON\.stringify\(payload/);
  });
});
