# 自定义模型

通过 `~/.pi/agent/models.json` 添加自定义 Provider 和模型（Ollama、vLLM、LM Studio、代理等）。

## 目录

- [最小示例](#最小示例)
- [完整示例](#完整示例)
- [支持的 API](#支持的-api)
- [Provider 配置](#provider-配置)
- [模型配置](#模型配置)
- [覆盖内置 Provider](#覆盖内置-provider)
- [Per-model 覆盖](#per-model-覆盖)
- [OpenAI 兼容性](#openai-兼容性)

## 最小示例

对于本地模型（Ollama、LM Studio、vLLM），每个模型只需要 `id`：

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "llama3.1:8b" },
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

`apiKey` 是必需的，但 Ollama 会忽略它，所以任意值均可。

## 完整示例

需要特定值时可覆盖默认值：

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        {
          "id": "llama3.1:8b",
          "name": "Llama 3.1 8B (Local)",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 32000,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
```

文件在每次打开 `/model` 时重新加载。可在会话期间编辑，无需重启。

## 支持的 API

| API | 说明 |
|-----|------|
| `openai-completions` | OpenAI Chat Completions（兼容性最广） |
| `openai-responses` | OpenAI Responses API |
| `anthropic-messages` | Anthropic Messages API |
| `google-generative-ai` | Google Generative AI |

在 Provider 级别设置 `api`（作为所有模型的默认值），或在模型级别设置（每个模型覆盖）。

## Provider 配置

| 字段 | 说明 |
|------|------|
| `baseUrl` | API 端点 URL |
| `api` | API 类型（见上表） |
| `apiKey` | API 密钥（见值解析） |
| `headers` | 自定义请求头（见值解析） |
| `authHeader` | 设为 `true` 自动添加 `Authorization: Bearer <apiKey>` |
| `models` | 模型配置数组 |
| `modelOverrides` | 应用于此 Provider 内置模型的 per-model 覆盖 |

### 值解析

`apiKey` 和 `headers` 字段支持三种格式：

- **Shell 命令：** `"!command"` 执行命令并使用 stdout 输出
  ```json
  "apiKey": "!security find-generic-password -ws 'anthropic'"
  "apiKey": "!op read 'op://vault/item/credential'"
  ```
- **环境变量：** 使用指定变量的值
  ```json
  "apiKey": "MY_API_KEY"
  ```
- **字面值：** 直接使用
  ```json
  "apiKey": "sk-..."
  ```

### 自定义请求头

```json
{
  "providers": {
    "custom-proxy": {
      "baseUrl": "https://proxy.example.com/v1",
      "apiKey": "MY_API_KEY",
      "api": "anthropic-messages",
      "headers": {
        "x-portkey-api-key": "PORTKEY_API_KEY",
        "x-secret": "!op read 'op://vault/item/secret'"
      },
      "models": [...]
    }
  }
}
```

## 模型配置

| 字段 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | 是 | -- | 模型标识符（传递给 API） |
| `name` | 否 | `id` | 模型选择器中的显示名称 |
| `api` | 否 | Provider 的 `api` | 覆盖 Provider 的 API 类型 |
| `reasoning` | 否 | `false` | 是否支持扩展思考 |
| `input` | 否 | `["text"]` | 输入类型：`["text"]` 或 `["text", "image"]` |
| `contextWindow` | 否 | `128000` | 上下文窗口大小（token） |
| `maxTokens` | 否 | `16384` | 最大输出 token |
| `cost` | 否 | 全部为零 | `{"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}`（每百万 token） |

## 覆盖内置 Provider

通过代理路由内置 Provider，无需重新定义模型：

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/v1"
    }
  }
}
```

所有内置 Anthropic 模型保持可用。现有的 OAuth 或 API 密钥认证继续工作。

要将自定义模型合并到内置 Provider 中，包含 `models` 数组：

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/v1",
      "apiKey": "ANTHROPIC_API_KEY",
      "api": "anthropic-messages",
      "models": [...]
    }
  }
}
```

合并语义：
- 内置模型保留
- 自定义模型按 `id` 在 Provider 内进行 upsert
- 如果自定义模型 `id` 与内置模型 `id` 匹配，自定义模型替换该内置模型
- 如果自定义模型 `id` 是新的，则与内置模型并列添加

## Per-model 覆盖

使用 `modelOverrides` 自定义特定内置模型，而无需替换 Provider 的完整模型列表。

```json
{
  "providers": {
    "openrouter": {
      "modelOverrides": {
        "anthropic/claude-sonnet-4": {
          "name": "Claude Sonnet 4 (Bedrock Route)",
          "compat": {
            "openRouterRouting": {
              "only": ["amazon-bedrock"]
            }
          }
        }
      }
    }
  }
}
```

`modelOverrides` 支持每个模型的以下字段：`name`、`reasoning`、`input`、`cost`（部分）、`contextWindow`、`maxTokens`、`headers`、`compat`。

行为说明：
- `modelOverrides` 应用于内置 Provider 模型
- 未知的模型 ID 会被忽略
- 可以将 Provider 级别的 `baseUrl`/`headers` 与 `modelOverrides` 结合使用
- 如果同时为 Provider 定义了 `models`，自定义模型在内置覆盖之后合并。具有相同 `id` 的自定义模型将替换被覆盖的内置模型条目

## OpenAI 兼容性

对于部分兼容 OpenAI 的 Provider，使用 `compat` 字段：

```json
{
  "providers": {
    "local-llm": {
      "baseUrl": "http://localhost:8080/v1",
      "api": "openai-completions",
      "compat": {
        "supportsUsageInStreaming": false,
        "maxTokensField": "max_tokens"
      },
      "models": [...]
    }
  }
}
```

| 字段 | 说明 |
|------|------|
| `supportsStore` | Provider 是否支持 `store` 字段 |
| `supportsDeveloperRole` | 使用 `developer` 还是 `system` 角色 |
| `supportsReasoningEffort` | 是否支持 `reasoning_effort` 参数 |
| `supportsUsageInStreaming` | 是否支持 `stream_options: { include_usage: true }`（默认：`true`） |
| `maxTokensField` | 使用 `max_completion_tokens` 还是 `max_tokens` |
| `openRouterRouting` | OpenRouter 路由配置，传递给 OpenRouter 用于模型/Provider 选择 |
| `vercelGatewayRouting` | Vercel AI Gateway 路由配置，用于 Provider 选择（`only`、`order`） |

示例：

```json
{
  "providers": {
    "openrouter": {
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "OPENROUTER_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "openrouter/anthropic/claude-3.5-sonnet",
          "name": "OpenRouter Claude 3.5 Sonnet",
          "compat": {
            "openRouterRouting": {
              "order": ["anthropic"],
              "fallbacks": ["openai"]
            }
          }
        }
      ]
    }
  }
}
```

Vercel AI Gateway 示例：

```json
{
  "providers": {
    "vercel-ai-gateway": {
      "baseUrl": "https://ai-gateway.vercel.sh/v1",
      "apiKey": "AI_GATEWAY_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "moonshotai/kimi-k2.5",
          "name": "Kimi K2.5 (Fireworks via Vercel)",
          "reasoning": true,
          "input": ["text", "image"],
          "cost": { "input": 0.6, "output": 3, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 262144,
          "maxTokens": 262144,
          "compat": {
            "vercelGatewayRouting": {
              "only": ["fireworks", "novita"],
              "order": ["fireworks", "novita"]
            }
          }
        }
      ]
    }
  }
}
```
