import "dotenv/config";
import type { Model, Api } from "@mariozechner/pi-ai";

const PROVIDER_MAP: Record<
  string,
  { api: string; provider: string; envKey: string }
> = {
  openai: {
    api: "openai-completions",
    provider: "openai",
    envKey: "OPENAI_API_KEY",
  },
  anthropic: {
    api: "anthropic-messages",
    provider: "anthropic",
    envKey: "ANTHROPIC_API_KEY",
  },
  google: {
    api: "google-generative-ai",
    provider: "google",
    envKey: "GOOGLE_API_KEY",
  },
  deepseek: {
    api: "openai-completions",
    provider: "deepseek",
    envKey: "OPENAI_API_KEY",
  },
};

/**
 * Create a pi-ai Model from environment variables.
 * Reads AI_PROVIDER and AI_MODEL from .env (defaults to Anthropic Claude Sonnet).
 */
export function createModel(): Model<Api> {
  const provider = process.env.AI_PROVIDER || "anthropic";
  const modelId = process.env.AI_MODEL || "claude-sonnet-4-6";
  const m = PROVIDER_MAP[provider] ?? PROVIDER_MAP.anthropic;

  // Verify the API key is set
  if (!process.env[m.envKey]) {
    console.error(`Missing ${m.envKey} — set it in .env or export it`);
    process.exit(1);
  }

  return {
    id: modelId,
    name: modelId,
    api: m.api as Api,
    provider: m.provider,
    baseUrl: "",
    reasoning: false,
    input: ["text"] as ("text" | "image")[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  };
}
