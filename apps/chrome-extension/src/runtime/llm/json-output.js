export const JSON_OBJECT_SCHEMA = {
  type: "object",
  additionalProperties: true,
};

export function shouldUseJsonOutput(promptStage = "") {
  return typeof promptStage === "string" && promptStage.trim().length > 0;
}

export function decorateSystemPromptForJsonOutput(systemPrompt = "") {
  const base = typeof systemPrompt === "string" ? systemPrompt.trim() : "";
  const jsonInstruction = "Return valid JSON only.";
  if (!base) return jsonInstruction;
  if (/json/i.test(base)) return base;
  return `${base}\n\n${jsonInstruction}`;
}

export function getOpenAiJsonModeConfig() {
  return {
    text: {
      format: {
        type: "json_object",
      },
    },
  };
}

export function getDeepSeekJsonModeConfig() {
  return {
    type: "json_object",
  };
}

export function getClaudeJsonModeConfig() {
  return {
    format: {
      type: "json_schema",
      schema: JSON_OBJECT_SCHEMA,
    },
  };
}

export function getGeminiJsonModeConfig() {
  return {
    responseFormat: {
      text: {
        mimeType: "application/json",
        schema: JSON_OBJECT_SCHEMA,
      },
    },
  };
}
