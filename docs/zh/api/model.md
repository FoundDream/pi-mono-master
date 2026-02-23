# createModel()

从环境变量创建 `Model<Api>` 对象。这是所有章节共用的模型工厂函数。

## 源码位置

`shared/model.ts`

## 用法

```typescript
import { createModel } from '../../shared/model'

const model = createModel()
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AI_PROVIDER` | `anthropic` | 提供商名称：`anthropic`、`openai`、`google`、`deepseek` |
| `AI_MODEL` | `claude-sonnet-4-6` | 所选提供商的模型 ID |

## 提供商映射

| 提供商 | API | 环境变量 Key |
|--------|-----|-------------|
| `anthropic` | `anthropic-messages` | `ANTHROPIC_API_KEY` |
| `openai` | `openai-completions` | `OPENAI_API_KEY` |
| `google` | `google-generative-ai` | `GOOGLE_API_KEY` |
| `deepseek` | `openai-completions` | `OPENAI_API_KEY` |

## 返回类型

返回 `@mariozechner/pi-ai` 的 `Model<Api>` 对象：

```typescript
interface Model<A extends Api> {
  id: string
  name: string
  api: A
  provider: string
  baseUrl: string
  reasoning: boolean
  input: ('text' | 'image')[]
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number }
  contextWindow: number
  maxTokens: number
}
```

## 完整实现

```typescript
import 'dotenv/config'
import type { Model, Api } from '@mariozechner/pi-ai'

const PROVIDER_MAP: Record<string, { api: string; provider: string; envKey: string }> = {
  openai: { api: 'openai-completions', provider: 'openai', envKey: 'OPENAI_API_KEY' },
  anthropic: { api: 'anthropic-messages', provider: 'anthropic', envKey: 'ANTHROPIC_API_KEY' },
  google: { api: 'google-generative-ai', provider: 'google', envKey: 'GOOGLE_API_KEY' },
  deepseek: { api: 'openai-completions', provider: 'deepseek', envKey: 'OPENAI_API_KEY' },
}

export function createModel(): Model<Api> {
  const provider = process.env.AI_PROVIDER || 'anthropic'
  const modelId = process.env.AI_MODEL || 'claude-sonnet-4-6'
  const m = PROVIDER_MAP[provider] ?? PROVIDER_MAP.anthropic

  if (!process.env[m.envKey]) {
    console.error(`Missing ${m.envKey} — set it in .env or export it`)
    process.exit(1)
  }

  return {
    id: modelId,
    name: modelId,
    api: m.api as Api,
    provider: m.provider,
    baseUrl: '',
    reasoning: false,
    input: ['text'] as ('text' | 'image')[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  }
}
```

## 错误处理

如果所需的 API Key 环境变量未设置，`createModel()` 会打印错误并退出进程：

```
Missing ANTHROPIC_API_KEY — set it in .env or export it
```
