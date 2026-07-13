import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

export function createOpenRouterProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://webbai.lovable.app",
      "X-Title": "webbai",
    },
  });
}

// Best-in-class free model on OpenRouter (strong reasoning + tool calling).
// If OpenRouter rate-limits or deprecates it, swap for another ":free" model.
export const OPENROUTER_MODEL = "deepseek/deepseek-chat-v3.1:free";
