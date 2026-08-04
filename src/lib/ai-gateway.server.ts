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
export const OPENROUTER_MODEL = "openai/gpt-oss-20b:free";

/** All configured OpenRouter keys, in priority order (primary first). */
export function getOpenRouterKeys(): string[] {
  return [process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_API_KEY_2]
    .map((k) => (k ?? "").trim())
    .filter((k) => k.length > 0);
}

/** Quick health probe: is this key currently usable? */
async function isKeyUsable(key: string): Promise<boolean> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${key}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Returns the first healthy OpenRouter key, falling back to the next one when
 * the primary is invalid, out of credits, or unreachable.
 */
export async function pickOpenRouterKey(): Promise<string | null> {
  const keys = getOpenRouterKeys();
  for (const key of keys) {
    if (await isKeyUsable(key)) return key;
  }
  return keys[0] ?? null;
}

/** Runs `fn` with each configured key until one succeeds. */
export async function withOpenRouterFallback<T>(
  fn: (key: string) => Promise<T>,
): Promise<T> {
  const keys = getOpenRouterKeys();
  if (keys.length === 0) throw new Error("Missing OPENROUTER_API_KEY");
  let lastError: unknown;
  for (const key of keys) {
    try {
      return await fn(key);
    } catch (err) {
      lastError = err;
      console.error("OpenRouter key failed, trying next key", err);
    }
  }
  throw lastError;
}

