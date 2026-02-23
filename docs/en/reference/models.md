# Custom Models

Add custom model providers via `~/.pi/agent/models.json`. This file defines providers, their API endpoints, authentication, and available models.

## Minimal Example

A local Ollama provider with one model:

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "models": {
        "llama3.1": {}
      }
    }
  }
}
```

## Full Example

A provider definition with all available fields:

```json
{
  "providers": {
    "my-provider": {
      "baseUrl": "https://api.example.com/v1",
      "api": "openai-completions",
      "apiKey": "sk-xxx",
      "authHeader": "X-Api-Key",
      "headers": {
        "X-Custom-Header": "value"
      },
      "models": {
        "my-model-large": {
          "name": "My Model (Large)",
          "api": "openai-completions",
          "reasoning": true,
          "input": ["text", "image"],
          "contextWindow": 128000,
          "maxTokens": 8192,
          "cost": {
            "input": 3.0,
            "output": 15.0,
            "cacheRead": 0.3,
            "cacheWrite": 3.75
          }
        },
        "my-model-small": {
          "name": "My Model (Small)"
        }
      },
      "modelOverrides": {
        "gpt-4o": {
          "maxTokens": 16384
        }
      }
    }
  }
}
```

## Supported APIs

| API                    | Description                      |
| ---------------------- | -------------------------------- |
| `openai-completions`   | OpenAI Chat Completions API      |
| `openai-responses`     | OpenAI Responses API             |
| `anthropic-messages`   | Anthropic Messages API           |
| `google-generative-ai` | Google Generative AI (AI Studio) |

## Provider Configuration

### Fields

| Field            | Type   | Required | Description                                                             |
| ---------------- | ------ | -------- | ----------------------------------------------------------------------- |
| `baseUrl`        | string | Yes      | API base URL                                                            |
| `api`            | string | Yes      | API type (see table above)                                              |
| `apiKey`         | string | No       | API key for authentication                                              |
| `authHeader`     | string | No       | Custom auth header name (default: `Authorization` with `Bearer` prefix) |
| `headers`        | object | No       | Additional HTTP headers for all requests                                |
| `models`         | object | No       | Map of model ID to model configuration                                  |
| `modelOverrides` | object | No       | Per-model overrides applied to built-in models                          |

### Value Resolution

The `apiKey` and `headers` values support three formats:

| Format               | Example                     | Description                                 |
| -------------------- | --------------------------- | ------------------------------------------- |
| Shell command        | `"!op read op://vault/key"` | Runs command, uses stdout (prefix with `!`) |
| Environment variable | `"$MY_API_KEY"`             | Reads from environment (prefix with `$`)    |
| Literal              | `"sk-abc123"`               | Used as-is                                  |

### Custom Headers Example

```json
{
  "providers": {
    "custom-api": {
      "baseUrl": "https://api.example.com/v1",
      "api": "openai-completions",
      "apiKey": "$CUSTOM_API_KEY",
      "headers": {
        "X-Organization": "my-org",
        "X-Project": "!cat .project-id"
      },
      "models": {
        "custom-model": {}
      }
    }
  }
}
```

## Model Configuration

### Fields

| Field           | Type     | Default    | Description                                   |
| --------------- | -------- | ---------- | --------------------------------------------- |
| `id`            | string   | (key)      | Model identifier (defaults to the object key) |
| `name`          | string   | (id)       | Human-readable display name                   |
| `api`           | string   | (provider) | Override the provider-level API type          |
| `reasoning`     | boolean  | `false`    | Whether the model supports extended thinking  |
| `input`         | string[] | `["text"]` | Supported input types: `"text"`, `"image"`    |
| `contextWindow` | number   | `128000`   | Maximum context window in tokens              |
| `maxTokens`     | number   | `8192`     | Maximum output tokens per response            |
| `cost`          | object   | -          | Cost per million tokens                       |

### Cost Object

| Field        | Type   | Description                          |
| ------------ | ------ | ------------------------------------ |
| `input`      | number | Cost per 1M input tokens (USD)       |
| `output`     | number | Cost per 1M output tokens (USD)      |
| `cacheRead`  | number | Cost per 1M cache-read tokens (USD)  |
| `cacheWrite` | number | Cost per 1M cache-write tokens (USD) |

## Overriding Built-in Providers

You can override built-in providers to route traffic through a proxy or modify defaults. The custom configuration is merged with the built-in definition:

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/anthropic/v1"
    }
  }
}
```

This keeps all built-in Anthropic models but routes requests through your proxy. Only the fields you specify are overridden; everything else retains its default value.

## Per-Model Overrides

Use `modelOverrides` to adjust specific models within a provider without redefining them entirely:

```json
{
  "providers": {
    "openai": {
      "modelOverrides": {
        "gpt-4o": {
          "maxTokens": 16384,
          "contextWindow": 256000
        }
      }
    }
  }
}
```

## OpenAI Compatibility

Many providers offer OpenAI-compatible APIs with slight differences. Use the `compat` field to handle these:

```json
{
  "providers": {
    "my-compat-provider": {
      "baseUrl": "https://api.example.com/v1",
      "api": "openai-completions",
      "apiKey": "$API_KEY",
      "compat": {
        "disableStreaming": false,
        "disableTools": false,
        "disableSystemMessages": false,
        "disableVision": false,
        "forceSimpleToolResults": true,
        "skipProviderMetadata": false,
        "forceMaxTokens": false
      },
      "models": {
        "compat-model": {}
      }
    }
  }
}
```

### Compat Flags

| Flag                     | Default | Description                                   |
| ------------------------ | ------- | --------------------------------------------- |
| `disableStreaming`       | `false` | Fall back to non-streaming requests           |
| `disableTools`           | `false` | Remove tool definitions from requests         |
| `disableSystemMessages`  | `false` | Convert system messages to user messages      |
| `disableVision`          | `false` | Strip image content from messages             |
| `forceSimpleToolResults` | `false` | Simplify tool result format for compatibility |
| `skipProviderMetadata`   | `false` | Skip parsing provider-specific metadata       |
| `forceMaxTokens`         | `false` | Always include `max_tokens` in requests       |

## OpenRouter

```json
{
  "providers": {
    "openrouter": {
      "baseUrl": "https://openrouter.ai/api/v1",
      "api": "openai-completions",
      "apiKey": "$OPENROUTER_API_KEY",
      "models": {
        "anthropic/claude-sonnet-4-20250514": {
          "name": "Claude Sonnet (via OpenRouter)",
          "contextWindow": 200000,
          "maxTokens": 8192
        },
        "google/gemini-2.5-pro-preview": {
          "name": "Gemini 2.5 Pro (via OpenRouter)",
          "contextWindow": 1048576,
          "maxTokens": 65536
        }
      }
    }
  }
}
```

## Vercel AI Gateway

```json
{
  "providers": {
    "vercel-gateway": {
      "baseUrl": "https://gateway.vercel.ai/v1",
      "api": "openai-completions",
      "apiKey": "$VERCEL_API_KEY",
      "headers": {
        "X-Vercel-AI-Gateway-Provider": "anthropic"
      },
      "models": {
        "claude-sonnet-4-20250514": {
          "name": "Claude Sonnet (via Vercel)",
          "api": "anthropic-messages",
          "contextWindow": 200000,
          "maxTokens": 8192
        }
      }
    }
  }
}
```
