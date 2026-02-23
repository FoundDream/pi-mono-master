# createModel()

Creates a `Model<Api>` object from environment variables. This is the shared model factory used across all chapters.

## Source

`shared/model.ts`

## Usage

```typescript
import { createModel } from "../../shared/model";

const model = createModel();
```

## Environment Variables

| Variable      | Default             | Description                                                |
| ------------- | ------------------- | ---------------------------------------------------------- |
| `AI_PROVIDER` | `anthropic`         | Provider name: `anthropic`, `openai`, `google`, `deepseek` |
| `AI_MODEL`    | `claude-sonnet-4-6` | Model ID for the selected provider                         |

## Provider Map

| Provider    | API                    | Env Key             |
| ----------- | ---------------------- | ------------------- |
| `anthropic` | `anthropic-messages`   | `ANTHROPIC_API_KEY` |
| `openai`    | `openai-completions`   | `OPENAI_API_KEY`    |
| `google`    | `google-generative-ai` | `GOOGLE_API_KEY`    |
| `deepseek`  | `openai-completions`   | `OPENAI_API_KEY`    |

## Return Type

Returns a `Model<Api>` object from `@mariozechner/pi-ai`:

```typescript
interface Model<A extends Api> {
  id: string;
  name: string;
  api: A;
  provider: string;
  baseUrl: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
}
```

## Full Implementation

```typescript
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

export function createModel(): Model<Api> {
  const provider = process.env.AI_PROVIDER || "anthropic";
  const modelId = process.env.AI_MODEL || "claude-sonnet-4-6";
  const m = PROVIDER_MAP[provider] ?? PROVIDER_MAP.anthropic;

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
```

## Error Handling

If the required API key environment variable is not set, `createModel()` prints an error and exits the process:

```
Missing ANTHROPIC_API_KEY — set it in .env or export it
```
