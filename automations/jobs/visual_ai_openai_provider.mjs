const responsesUrl = "https://api.openai.com/v1/responses";

export function createOpenAiVisualAiProvider({ fetchImpl = globalThis.fetch } = {}) {
  return {
    kind: "openai",
    async audit(request, config) {
      if (typeof fetchImpl !== "function") throw new Error("OpenAI visual provider requires fetch");
      const response = await fetchImpl(responsesUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          input: [{
            role: "user",
            content: [
              { type: "input_text", text: auditPrompt(request) },
              ...request.image_urls.map((imageUrl) => ({ type: "input_image", image_url: imageUrl, detail: "high" }))
            ]
          }],
          text: {
            format: {
              type: "json_schema",
              name: "visual_ai_manual_advisory",
              strict: true,
              schema: advisoryResultSchema()
            }
          },
          store: false,
          max_output_tokens: config.maxOutputTokens
        })
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(`visual AI provider failed: ${response.status} ${details.slice(0, 300)}`);
      }

      const outputText = responseOutputText(await response.json());
      if (!outputText) throw new Error("visual AI provider returned no structured output");
      return JSON.parse(outputText);
    }
  };
}

function auditPrompt(request) {
  return `Perform a visual audit for human review only.

Project: ${request.project}
Dedupe key: ${request.dedupe_key}
Context: ${request.context || "No additional context."}

Describe visible product presentation, strengths, risks, and questions for a human reviewer. Do not recommend creating, withdrawing, promoting, demoting, reprioritizing, or moving a Lead. Do not output priority, bucket, pool, admission decision, or CRM actions.`;
}

function advisoryResultSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["visual_summary", "strengths", "risks", "questions_for_human", "confidence"],
    properties: {
      visual_summary: { type: "string" },
      strengths: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
      questions_for_human: { type: "array", items: { type: "string" } },
      confidence: { type: "string", enum: ["low", "medium", "high"] }
    }
  };
}

function responseOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const chunks = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === "string") chunks.push(part.text);
      if (typeof part?.output_text === "string") chunks.push(part.output_text);
    }
  }
  return chunks.join("\n");
}
