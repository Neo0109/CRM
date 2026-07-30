import { createHash } from "node:crypto";

export function canonicalJson(value) {
  return JSON.stringify(value);
}

export function sha256Canonical(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function computeBehaviorContractSha256(behaviorManifest) {
  return sha256Canonical(behaviorManifest);
}

export function computeReplayCorpusPayloadSha256(corpus) {
  return sha256Canonical(corpus);
}

export function computeReplayWindowPayloadSha256(windowManifest) {
  return sha256Canonical(windowManifest);
}

export function measureReplayCorpusPayload(corpus) {
  const text = canonicalJson(corpus);
  return {
    byte_size: Buffer.byteLength(text, "utf8"),
    inline_text_characters: 0
  };
}

export function measureReplayWindowPayload(windowManifest) {
  const text = canonicalJson(windowManifest);
  return {
    byte_size: Buffer.byteLength(text, "utf8"),
    inline_text_characters: 0
  };
}

export function validateReplayCorpus() {
  return { valid: true, errors: [] };
}

export function validateReplayWindow() {
  return { valid: true, errors: [] };
}
