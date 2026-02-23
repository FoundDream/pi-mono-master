# 自定义 Provider

通过扩展或 `models.json` 配置文件，Pi 支持注册和自定义 Provider，以便接入任意 LLM 服务。

## 概述

自定义 Provider 可以通过两种方式注册：

1. **配置文件**：在 `~/.pi/agent/models.json` 中声明 Provider 和模型
2. **扩展 API**：在扩展中调用 `pi.registerProvider()` 进行编程式注册

## 快速参考示例

一个本地 Ollama Provider 的最小配置：

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

## 覆盖已有 Provider

你可以覆盖内置 Provider 的设置，将请求路由到代理服务器或修改默认值。自定义配置会与内置定义合并：

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/anthropic/v1"
    }
  }
}
```

这会保留所有内置 Anthropic 模型，但将请求路由到你的代理服务器。只有你指定的字段会被覆盖，其他字段保持默认值。

你也可以添加自定义请求头：

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

### 值解析格式

`apiKey` 和 `headers` 的值支持三种格式：

| 格式       | 示例                        | 说明                                      |
| ---------- | --------------------------- | ----------------------------------------- |
| Shell 命令 | `"!op read op://vault/key"` | 执行命令，使用 stdout 输出（以 `!` 前缀） |
| 环境变量   | `"$MY_API_KEY"`             | 从环境变量读取（以 `$` 前缀）             |
| 字面值     | `"sk-abc123"`               | 直接使用                                  |

## 注册新 Provider

完整的 Provider 定义包含所有可用字段：

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
      }
    }
  }
}
```

## API 类型

Pi 支持以下 API 类型：

| API 类型               | 说明                             |
| ---------------------- | -------------------------------- |
| `openai-completions`   | OpenAI Chat Completions API      |
| `openai-responses`     | OpenAI Responses API             |
| `anthropic-messages`   | Anthropic Messages API           |
| `google-generative-ai` | Google Generative AI (AI Studio) |
| `bedrock-anthropic`    | AWS Bedrock Anthropic            |
| `bedrock-openai`       | AWS Bedrock OpenAI 兼容          |
| `vertex-anthropic`     | Google Vertex AI Anthropic       |
| `vertex-google`        | Google Vertex AI 原生            |
| `azure-openai`         | Azure OpenAI Service             |
| `mistral`              | Mistral AI API                   |

## Compat 选项

许多 Provider 提供 OpenAI 兼容 API，但存在细微差异。使用 `compat` 字段处理这些差异：

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

### Compat 标志

| 标志                     | 默认值  | 说明                           |
| ------------------------ | ------- | ------------------------------ |
| `disableStreaming`       | `false` | 回退到非流式请求               |
| `disableTools`           | `false` | 从请求中移除工具定义           |
| `disableSystemMessages`  | `false` | 将系统消息转换为用户消息       |
| `disableVision`          | `false` | 从消息中剥离图片内容           |
| `forceSimpleToolResults` | `false` | 简化工具结果格式以增强兼容性   |
| `skipProviderMetadata`   | `false` | 跳过解析 Provider 特有的元数据 |
| `forceMaxTokens`         | `false` | 在请求中始终包含 `max_tokens`  |

## OAuth 支持

扩展可以通过 `pi.registerProvider()` 注册支持 OAuth 的 Provider：

```typescript
import { pi, ExtensionContext } from "@anthropic-ai/pi";

export default (ctx: ExtensionContext) => {
  pi.registerProvider({
    name: "my-oauth-provider",
    baseUrl: "https://api.example.com/v1",
    api: "openai-completions",
    oauth: {
      clientId: "your-client-id",
      authorizationUrl: "https://auth.example.com/authorize",
      tokenUrl: "https://auth.example.com/token",
      scopes: ["read", "write"],
      callbackPort: 8420,
    },
    models: {
      "my-model": {
        name: "My OAuth Model",
        contextWindow: 128000,
        maxTokens: 8192,
      },
    },
  });
};
```

OAuth 流程会在用户首次使用该 Provider 时自动触发浏览器授权，token 会被安全存储并自动刷新。

## 自定义流式 API

如果你的 API 不符合标准的 OpenAI 或 Anthropic 格式，可以使用自定义流式模式。Provider 需要实现 Server-Sent Events (SSE) 流式传输。

### 流式事件格式

```
event: content_block_delta
data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hello"}}

event: content_block_delta
data: {"type": "content_block_delta", "delta": {"type": "tool_use", "id": "call_1", "name": "bash", "input": "{\"command\": \"ls\"}"}}

event: message_stop
data: {"type": "message_stop"}
```

### 内容块类型

流式响应可以包含以下内容块类型：

- **文本内容**：`{"type": "text_delta", "text": "..."}`
- **工具调用**：`{"type": "tool_use", "id": "...", "name": "...", "input": "..."}`
- **思考内容**：`{"type": "thinking", "thinking": "..."}`

### 工具调用流程

1. 模型在流式响应中发出 `tool_use` 内容块
2. Pi 执行工具并收集结果
3. 工具结果作为 `tool_result` 消息发送回 API
4. 模型继续生成后续响应

## 测试参考

配置完 Provider 后，可以通过以下方式测试：

```bash
# 列出可用模型
pi /models

# 使用指定 Provider 和模型启动会话
pi --provider my-provider --model my-model

# 使用 provider:model 简写语法
pi --model my-provider:my-model

# 验证连接
pi --model my-provider:my-model "say hello"
```

## ProviderConfig 参考

```typescript
interface ProviderConfig {
  /** API 基础 URL */
  baseUrl: string;
  /** API 类型 */
  api: ApiType;
  /** API 密钥（支持 $ENV、!command 和字面值） */
  apiKey?: string;
  /** 自定义认证头名称（默认：Authorization Bearer） */
  authHeader?: string;
  /** 附加 HTTP 请求头 */
  headers?: Record<string, string>;
  /** 模型 ID 到模型配置的映射 */
  models?: Record<string, ProviderModelConfig>;
  /** 内置模型的逐模型覆盖 */
  modelOverrides?: Record<string, Partial<ProviderModelConfig>>;
  /** OpenAI 兼容性选项 */
  compat?: CompatOptions;
  /** OAuth 配置 */
  oauth?: OAuthConfig;
}
```

## ProviderModelConfig 参考

```typescript
interface ProviderModelConfig {
  /** 模型标识符（默认使用对象键名） */
  id?: string;
  /** 人类可读的显示名称 */
  name?: string;
  /** 覆盖 Provider 级别的 API 类型 */
  api?: ApiType;
  /** 是否支持扩展思考 */
  reasoning?: boolean;
  /** 支持的输入类型：["text"] 或 ["text", "image"] */
  input?: ("text" | "image")[];
  /** 最大上下文窗口（token 数） */
  contextWindow?: number;
  /** 每次响应的最大输出 token 数 */
  maxTokens?: number;
  /** 每百万 token 的费用（美元） */
  cost?: {
    /** 每百万输入 token 的费用 */
    input: number;
    /** 每百万输出 token 的费用 */
    output: number;
    /** 每百万缓存读取 token 的费用 */
    cacheRead?: number;
    /** 每百万缓存写入 token 的费用 */
    cacheWrite?: number;
  };
}
```
