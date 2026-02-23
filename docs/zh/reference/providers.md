# 身份认证与 Provider

Pi 支持通过 OAuth 的订阅型 Provider 和通过环境变量或认证文件的 API 密钥型 Provider。对于每个 Provider，Pi 了解所有可用模型。模型列表随每次 Pi 发布更新。

## 目录

- [订阅](#订阅)
- [API 密钥](#api-密钥)
- [认证文件](#认证文件)
- [云 Provider](#云-provider)
- [自定义 Provider](#自定义-provider)
- [凭证解析顺序](#凭证解析顺序)

## 订阅

在交互模式下使用 `/login`，然后选择 Provider：

- Claude Pro/Max
- ChatGPT Plus/Pro (Codex)
- GitHub Copilot
- Google Gemini CLI
- Google Antigravity

使用 `/logout` 清除凭证。令牌存储在 `~/.pi/agent/auth.json` 中，过期时自动刷新。

### GitHub Copilot

- 按 Enter 使用 github.com，或输入你的 GitHub Enterprise Server 域名
- 如果出现"model not supported"错误，请在 VS Code 中启用：Copilot Chat → 模型选择器 → 选择模型 → "Enable"

### Google Provider

- **Gemini CLI**：通过 Cloud Code Assist 使用标准 Gemini 模型
- **Antigravity**：提供 Gemini 3、Claude 和 GPT-OSS 模型的沙盒环境
- 两者对任何 Google 账户免费，受速率限制
- 对于付费的 Cloud Code Assist：设置 `GOOGLE_CLOUD_PROJECT` 环境变量

### OpenAI Codex

- 需要 ChatGPT Plus 或 Pro 订阅
- 仅限个人使用；生产用途请使用 OpenAI Platform API

## API 密钥

### 环境变量或认证文件

通过环境变量设置：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

| Provider               | 环境变量               | `auth.json` 键名         |
| ---------------------- | ---------------------- | ------------------------ |
| Anthropic              | `ANTHROPIC_API_KEY`    | `anthropic`              |
| Azure OpenAI Responses | `AZURE_OPENAI_API_KEY` | `azure-openai-responses` |
| OpenAI                 | `OPENAI_API_KEY`       | `openai`                 |
| Google Gemini          | `GEMINI_API_KEY`       | `google`                 |
| Mistral                | `MISTRAL_API_KEY`      | `mistral`                |
| Groq                   | `GROQ_API_KEY`         | `groq`                   |
| Cerebras               | `CEREBRAS_API_KEY`     | `cerebras`               |
| xAI                    | `XAI_API_KEY`          | `xai`                    |
| OpenRouter             | `OPENROUTER_API_KEY`   | `openrouter`             |
| Vercel AI Gateway      | `AI_GATEWAY_API_KEY`   | `vercel-ai-gateway`      |
| ZAI                    | `ZAI_API_KEY`          | `zai`                    |
| OpenCode Zen           | `OPENCODE_API_KEY`     | `opencode`               |
| Hugging Face           | `HF_TOKEN`             | `huggingface`            |
| Kimi For Coding        | `KIMI_API_KEY`         | `kimi-coding`            |
| MiniMax                | `MINIMAX_API_KEY`      | `minimax`                |
| MiniMax（中国区）      | `MINIMAX_CN_API_KEY`   | `minimax-cn`             |

### 认证文件

将凭证存储在 `~/.pi/agent/auth.json` 中：

```json
{
  "anthropic": { "type": "api_key", "key": "sk-ant-..." },
  "openai": { "type": "api_key", "key": "sk-..." },
  "google": { "type": "api_key", "key": "..." },
  "opencode": { "type": "api_key", "key": "..." }
}
```

文件以 `0600` 权限创建（仅用户可读写）。认证文件中的凭证优先于环境变量。

### 密钥解析

`key` 字段支持三种格式：

- **Shell 命令：** `"!command"` 执行命令并使用 stdout（进程生命周期内缓存）
  ```json
  { "type": "api_key", "key": "!security find-generic-password -ws 'anthropic'" }
  { "type": "api_key", "key": "!op read 'op://vault/item/credential'" }
  ```
- **环境变量：** 使用指定变量的值
  ```json
  { "type": "api_key", "key": "MY_ANTHROPIC_KEY" }
  ```
- **字面值：** 直接使用
  ```json
  { "type": "api_key", "key": "sk-ant-..." }
  ```

OAuth 凭证也存储在此文件中，在 `/login` 后自动管理。

## 云 Provider

### Azure OpenAI

```bash
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_BASE_URL=https://your-resource.openai.azure.com
# 或使用资源名称代替 base URL
export AZURE_OPENAI_RESOURCE_NAME=your-resource

# 可选
export AZURE_OPENAI_API_VERSION=2024-02-01
export AZURE_OPENAI_DEPLOYMENT_NAME_MAP=gpt-4=my-gpt4,gpt-4o=my-gpt4o
```

### Amazon Bedrock

```bash
# 方式 1：AWS Profile
export AWS_PROFILE=your-profile

# 方式 2：IAM Keys
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...

# 方式 3：Bearer Token
export AWS_BEARER_TOKEN_BEDROCK=...

# 可选区域（默认 us-east-1）
export AWS_REGION=us-west-2
```

也支持 ECS 任务角色（`AWS_CONTAINER_CREDENTIALS_*`）和 IRSA（`AWS_WEB_IDENTITY_TOKEN_FILE`）。

```bash
pi --provider amazon-bedrock --model us.anthropic.claude-sonnet-4-20250514-v1:0
```

如果连接到 Bedrock API 代理，可以使用以下环境变量：

```bash
# 设置 Bedrock 代理的 URL（标准 AWS SDK 环境变量）
export AWS_ENDPOINT_URL_BEDROCK_RUNTIME=https://my.corp.proxy/bedrock

# 如果代理不需要认证则设置
export AWS_BEDROCK_SKIP_AUTH=1

# 如果代理仅支持 HTTP/1.1 则设置
export AWS_BEDROCK_FORCE_HTTP1=1
```

### Google Vertex AI

使用应用默认凭证：

```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=your-project
export GOOGLE_CLOUD_LOCATION=us-central1
```

或将 `GOOGLE_APPLICATION_CREDENTIALS` 设置为服务账户密钥文件。

## 自定义 Provider

**通过 models.json：** 添加 Ollama、LM Studio、vLLM 或任何支持已知 API（OpenAI Completions、OpenAI Responses、Anthropic Messages、Google Generative AI）的 Provider。详见 [自定义模型](models.md)。

**通过扩展：** 对于需要自定义 API 实现或 OAuth 流程的 Provider，创建扩展。

## 凭证解析顺序

为 Provider 解析凭证时的优先级：

1. CLI `--api-key` 标志
2. `auth.json` 条目（API 密钥或 OAuth 令牌）
3. 环境变量
4. `models.json` 中的自定义 Provider 密钥
