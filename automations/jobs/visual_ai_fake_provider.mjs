const defaultResult = {
  visual_summary: "Fake provider completed a deterministic manual visual audit.",
  strengths: ["Fixture-only visual strength"],
  risks: ["Fixture-only visual risk"],
  questions_for_human: ["Confirm the visual evidence manually."],
  confidence: "low"
};

export function createFakeVisualAiProvider({ result = defaultResult, onCall } = {}) {
  return {
    kind: "fake",
    async audit(request) {
      if (typeof onCall === "function") onCall(request);
      return structuredClone(result);
    }
  };
}
