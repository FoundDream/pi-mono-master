# Custom Provider API

Register custom LLM providers programmatically using the extension API.

## Overview

Use `pi.registerProvider()` within an extension to add or override providers at runtime. This is more powerful than `models.json` because it supports custom authentication flows, OAuth, and fully custom streaming APIs.

## Quick Reference

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerProvider({
    name: "my-provider",
    baseUrl: "https://api.example.com/v1",
    api: "openai-completions",
    apiKey: process.env.MY_API_KEY,
    models: [
      {
        id: "my-model",
        name: "My Model",
        contextWindow: 128000,
        maxTokens: 8192,
      },
    ],
  });
}
```

## Override Existing Provider

### Override Base URL

Route an existing provider through a proxy:

```typescript
pi.registerProvider({
  name: "anthropic",
  baseUrl: "https://my-proxy.example.com/anthropic/v1",
});
```

### Override Headers

Add custom headers to an existing provider:

```typescript
pi.registerProvider({
  name: "openai",
  headers: {
    "X-Organization": "my-org-id",
    "X-Project": "my-project",
  },
});
```

### Override Both

```typescript
pi.registerProvider({
  name: "anthropic",
  baseUrl: "https://my-proxy.example.com/v1",
  headers: {
    "X-Proxy-Auth": process.env.PROXY_TOKEN,
  },
});
```

## Register New Provider

A full example registering a new provider with multiple models:

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerProvider({
    name: "my-cloud",
    baseUrl: "https://api.mycloud.example.com/v1",
    api: "openai-completions",
    apiKey: process.env.MYCLOUD_API_KEY,
    authHeader: "X-Api-Key",
    headers: {
      "X-Client-Version": "1.0.0",
    },
    compat: {
      forceSimpleToolResults: true,
    },
    models: [
      {
        id: "mycloud-large",
        name: "MyCloud Large",
        api: "openai-completions",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 200000,
        maxTokens: 16384,
        cost: {
          input: 3.0,
          output: 15.0,
          cacheRead: 0.3,
          cacheWrite: 3.75,
        },
      },
      {
        id: "mycloud-small",
        name: "MyCloud Small",
        input: ["text"],
        contextWindow: 64000,
        maxTokens: 4096,
        cost: {
          input: 0.25,
          output: 1.25,
          cacheRead: 0.025,
          cacheWrite: 0.3,
        },
      },
    ],
  });
}
```

## API Types

The `api` field specifies which wire protocol to use:

| API Type | Description |
|----------|-------------|
| `anthropic-messages` | Anthropic Messages API |
| `openai-completions` | OpenAI Chat Completions API |
| `openai-responses` | OpenAI Responses API |
| `azure-openai-responses` | Azure OpenAI Responses API |
| `openai-codex-responses` | OpenAI Codex Responses API |
| `google-generative-ai` | Google AI Studio (Generative AI) |
| `google-gemini-cli` | Google Gemini CLI API |
| `google-vertex` | Google Vertex AI |
| `bedrock-converse-stream` | Amazon Bedrock Converse Stream API |

## Compat Options

For OpenAI-compatible APIs with behavioral differences:

```typescript
pi.registerProvider({
  name: "my-compat",
  baseUrl: "https://api.example.com/v1",
  api: "openai-completions",
  compat: {
    disableStreaming: false,       // Fall back to non-streaming
    disableTools: false,           // Strip tool definitions
    disableSystemMessages: false,  // Convert system to user messages
    disableVision: false,          // Strip image content
    forceSimpleToolResults: true,  // Simplify tool result format
    skipProviderMetadata: false,   // Skip provider metadata parsing
    forceMaxTokens: false,         // Always include max_tokens
  },
  models: [{ id: "model-v1" }],
});
```

## Auth Header

By default, the API key is sent as `Authorization: Bearer <key>`. Override with `authHeader`:

```typescript
pi.registerProvider({
  name: "custom-auth",
  baseUrl: "https://api.example.com",
  api: "openai-completions",
  apiKey: "my-key",
  authHeader: "X-Api-Key",  // Sends: X-Api-Key: my-key
  models: [{ id: "model-v1" }],
});
```

## OAuth Support

For providers requiring OAuth authentication, implement the `oauth` field:

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerProvider({
    name: "oauth-provider",
    baseUrl: "https://api.provider.com/v1",
    api: "openai-completions",
    oauth: {
      login: async (callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> => {
        // Start OAuth flow
        const authUrl = "https://provider.com/oauth/authorize?client_id=xxx&redirect_uri=...";

        // Open browser for user authentication
        callbacks.openUrl(authUrl);

        // Wait for the redirect callback
        const code = await callbacks.waitForCallback();

        // Exchange code for tokens
        const response = await fetch("https://provider.com/oauth/token", {
          method: "POST",
          body: JSON.stringify({
            grant_type: "authorization_code",
            code,
            client_id: "xxx",
          }),
        });
        const tokens = await response.json();

        return {
          apiKey: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        };
      },

      refreshToken: async (credentials: OAuthCredentials): Promise<OAuthCredentials> => {
        const response = await fetch("https://provider.com/oauth/token", {
          method: "POST",
          body: JSON.stringify({
            grant_type: "refresh_token",
            refresh_token: credentials.refreshToken,
          }),
        });
        const tokens = await response.json();

        return {
          apiKey: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        };
      },

      getApiKey: (credentials: OAuthCredentials): string => {
        return credentials.apiKey;
      },

      modifyModels: (models: ProviderModelConfig[]): ProviderModelConfig[] => {
        // Optionally filter or modify available models based on subscription
        return models;
      },
    },
    models: [
      { id: "pro-model", name: "Pro Model" },
      { id: "basic-model", name: "Basic Model" },
    ],
  });
}
```

### OAuthLoginCallbacks

```typescript
interface OAuthLoginCallbacks {
  /** Open a URL in the user's browser */
  openUrl(url: string): void;
  /** Wait for the OAuth redirect callback, returns the authorization code */
  waitForCallback(): Promise<string>;
  /** Display a message to the user */
  showMessage(message: string): void;
}
```

### OAuthCredentials

```typescript
interface OAuthCredentials {
  /** The access token / API key */
  apiKey: string;
  /** Refresh token for obtaining new access tokens */
  refreshToken?: string;
  /** Token expiration timestamp (milliseconds since epoch) */
  expiresAt?: number;
  /** Additional provider-specific data */
  [key: string]: unknown;
}
```

## Custom Streaming API

For providers with non-standard APIs, implement a custom streaming function:

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerProvider({
    name: "custom-stream",
    streamSimple: async function* (request) {
      const response = await fetch("https://api.example.com/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_KEY}`,
        },
        body: JSON.stringify({
          prompt: request.messages,
          max_tokens: request.maxTokens,
          tools: request.tools,
        }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const data = JSON.parse(line);

          if (data.type === "text") {
            // Yield text content
            yield {
              type: "content",
              content: {
                type: "text",
                text: data.text,
              },
            };
          } else if (data.type === "tool_call") {
            // Yield tool call
            yield {
              type: "content",
              content: {
                type: "tool-call",
                id: data.id,
                name: data.name,
                arguments: JSON.stringify(data.arguments),
              },
            };
          } else if (data.type === "done") {
            // Yield final usage/cost
            yield {
              type: "usage",
              usage: {
                inputTokens: data.usage.input_tokens,
                outputTokens: data.usage.output_tokens,
              },
              cost: {
                input: data.usage.input_tokens * 0.000003,
                output: data.usage.output_tokens * 0.000015,
              },
            };
          }
        }
      }
    },
    models: [
      {
        id: "custom-model",
        name: "Custom Model",
        contextWindow: 128000,
        maxTokens: 8192,
      },
    ],
  });
}
```

### Stream Event Types

The `streamSimple` generator yields events of these types:

| Event Type | Fields | Description |
|------------|--------|-------------|
| `content` | `content: { type: "text", text }` | Text content delta |
| `content` | `content: { type: "tool-call", id, name, arguments }` | Tool call request |
| `usage` | `usage: { inputTokens, outputTokens }`, `cost?: { input, output }` | Token usage and cost |

## Testing

Custom providers can be tested using the test utilities in the pi-coding-agent package:

| Test File | Purpose |
|-----------|---------|
| `test/providers/custom-provider.test.ts` | Registration and configuration |
| `test/providers/oauth.test.ts` | OAuth flow |
| `test/providers/streaming.test.ts` | Custom streaming |
| `test/providers/compat.test.ts` | Compatibility flags |

## ProviderConfig Reference

The full TypeScript interface for provider configuration:

```typescript
interface ProviderConfig {
  /** Provider name (used as identifier) */
  name: string;
  /** API base URL */
  baseUrl?: string;
  /** API type */
  api?: "anthropic-messages" | "openai-completions" | "openai-responses"
    | "azure-openai-responses" | "openai-codex-responses"
    | "google-generative-ai" | "google-gemini-cli"
    | "google-vertex" | "bedrock-converse-stream";
  /** API key for authentication */
  apiKey?: string;
  /** Custom authorization header name */
  authHeader?: string;
  /** Additional HTTP headers */
  headers?: Record<string, string>;
  /** OpenAI compatibility flags */
  compat?: {
    disableStreaming?: boolean;
    disableTools?: boolean;
    disableSystemMessages?: boolean;
    disableVision?: boolean;
    forceSimpleToolResults?: boolean;
    skipProviderMetadata?: boolean;
    forceMaxTokens?: boolean;
  };
  /** OAuth configuration */
  oauth?: {
    login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials>;
    refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials>;
    getApiKey(credentials: OAuthCredentials): string;
    modifyModels?(models: ProviderModelConfig[]): ProviderModelConfig[];
  };
  /** Custom streaming implementation */
  streamSimple?: (request: StreamRequest) => AsyncGenerator<StreamEvent>;
  /** Available models */
  models?: ProviderModelConfig[];
}
```

## ProviderModelConfig Reference

The full TypeScript interface for model configuration:

```typescript
interface ProviderModelConfig {
  /** Model identifier */
  id: string;
  /** Human-readable display name */
  name?: string;
  /** Override the provider-level API type */
  api?: string;
  /** Whether the model supports extended thinking / reasoning */
  reasoning?: boolean;
  /** Supported input modalities */
  input?: ("text" | "image")[];
  /** Maximum context window in tokens */
  contextWindow?: number;
  /** Maximum output tokens per response */
  maxTokens?: number;
  /** Cost per million tokens (USD) */
  cost?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
}
```
