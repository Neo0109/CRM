export function sanitizeArtifactPayload(payload) {
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeArtifactPayload(item));
  }
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  return Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => !key.startsWith("_"))
      .map(([key, value]) => [key, sanitizeArtifactPayload(value)])
  );
}

export function serializeArtifact(payload) {
  return `${JSON.stringify(sanitizeArtifactPayload(payload), null, 2)}\n`;
}
