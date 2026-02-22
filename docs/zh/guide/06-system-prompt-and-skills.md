# 06 - 系统提示词与技能

## 为什么需要系统提示词和技能？

如果把 AI Agent 比作一个新员工，那么**系统提示词（System Prompt）** 就是公司的员工手册——它定义了这个员工是谁、应该怎么行为、有什么底线。而**技能（Skills）** 则是这个员工的专业培训材料——它为特定领域提供深度知识和行为规范。

没有系统提示词的 Agent 就像一个没有岗位说明的员工：它很聪明，但不知道自己的角色是什么，不知道该用什么语气说话，不知道哪些事该做哪些事不该做。结果就是行为不可预测——有时过于啰嗦，有时过于简洁，有时做了不该做的事。

系统提示词和技能系统共同解决了 Agent 行为控制的两个层面：
- **系统提示词**：定义 Agent 的"人格"和全局行为准则（"你是谁"）
- **技能**：提供可组合的领域知识模块（"你会什么"）

这种分层设计的好处是：你可以用同一个系统提示词搭配不同的技能组合，快速创建行为一致但能力不同的 Agent。

## 你将学到

- `systemPromptOverride` 如何注入自定义系统提示词
- `loadSkillsFromDir()` 如何发现 `.md` 文件作为技能
- `skillsOverride` 如何将技能注入资源加载器
- 技能 frontmatter 格式（`name`、`description`、`disable-model-invocation`）
- 如何编写高质量的系统提示词和技能文件

## 系统提示词的作用

系统提示词在 Agent 的消息流中位于最前面——它是 AI 模型在每次对话中看到的"第一段话"。这段话决定了模型在后续所有交互中的行为倾向。

:::tip 提示
系统提示词不是"建议"，而是"指令"。现代 LLM（如 Claude、GPT-4）被训练为高度遵守系统提示词中的指令。你可以把它理解为 AI 的"操作系统级配置"——应用层（用户消息）很难覆盖系统层（系统提示词）的设定。
:::

一个好的系统提示词通常包含以下要素：

| 要素 | 作用 | 示例 |
|------|------|------|
| **身份定义** | 告诉 AI 它是谁 | "You are WeatherBot, a friendly weather assistant." |
| **行为准则** | 定义交互风格 | "Always greet the user warmly." |
| **工具使用指导** | 什么时候该用什么工具 | "When asked about weather, use the get_weather tool first." |
| **限制条件** | 不该做的事 | "Never make up weather data. If unsure, say so." |
| **输出格式** | 期望的回复结构 | "Structure responses as: conditions, humidity, forecast." |

## 技能文件格式

如果说系统提示词定义了 Agent 的"性格"，那么技能就是它的"专业知识库"。

技能是带有 YAML frontmatter 的 Markdown 文件。这个设计非常巧妙：Markdown 既是人类可读的文档格式，也是 LLM 最擅长理解的文本格式。YAML frontmatter 则提供了结构化的元数据，让框架可以程序化地管理技能。

```markdown
---
name: weather-expert
description: Provides weather forecasting expertise
---

When discussing weather, always structure your response as a brief weather report:

1. **Current conditions**: Temperature and sky condition
2. **Humidity**: Current humidity level
3. **Forecast**: Brief outlook for the next 24 hours
4. **Advisory**: Any relevant weather advisories or tips

Keep the tone professional but friendly, like a TV weather presenter.
```

### Frontmatter 字段详解

| 字段 | 必需 | 说明 |
|------|------|------|
| `name` | 是 | 技能的唯一标识符，建议使用 kebab-case（如 `weather-expert`） |
| `description` | 是 | 简短描述技能的功能，帮助框架和开发者理解技能用途 |
| `disable-model-invocation` | 否 | 设为 `true` 时，该技能不会被模型主动触发，仅在显式调用时生效 |

### 发现规则

框架通过以下规则自动发现技能文件：

- 技能目录根目录下的 `.md` 文件
- 子目录中的 `SKILL.md` 文件（递归查找）

```
skills/
├── weather-expert.md          ← 直接被发现
├── coding/
│   └── SKILL.md               ← 通过子目录发现
├── writing/
│   └── SKILL.md               ← 通过子目录发现
└── README.md                  ← 被忽略（不叫 SKILL.md）
```

这种设计允许你用两种方式组织技能：
- **简单技能**：单个 `.md` 文件放在根目录
- **复杂技能**：独立子目录，`SKILL.md` 是入口，同目录下可以放其他辅助文件

## 技能 vs. 插件：设计哲学对比

你可能会问：技能和其他框架中的"插件"有什么区别？

| 维度 | 传统插件 | 技能（Skills） |
|------|---------|--------------|
| **形式** | 代码（JavaScript/Python） | 纯文本（Markdown） |
| **修改方式** | 需要编程能力 | 任何人都能编辑 |
| **加载时机** | 编译时/启动时 | 运行时动态加载 |
| **作用机制** | 修改程序行为 | 修改 AI 的理解和响应方式 |
| **组合方式** | 接口/依赖注入 | 简单拼接到 Prompt 中 |

技能的核心哲学是：**用自然语言而非代码来"编程" AI 的行为。** 这大大降低了定制 Agent 行为的门槛——产品经理、领域专家甚至终端用户都可以编写技能文件，不需要懂编程。

## 加载技能

使用 `loadSkillsFromDir()` 函数从目录中加载所有技能：

```typescript
import { loadSkillsFromDir } from '@mariozechner/pi-coding-agent'

const SKILLS_DIR = path.join(import.meta.dirname, 'skills')
const { skills, diagnostics } = loadSkillsFromDir({
  dir: SKILLS_DIR,
  source: 'tutorial',
})

console.log(`加载了 ${skills.length} 个技能:`)
skills.forEach((s) => console.log(`  - ${s.name}: ${s.description}`))
```

`diagnostics` 数组包含加载过程中的警告和错误信息（如 frontmatter 格式不正确、缺少必要字段等）。在开发阶段，建议将诊断信息打印出来，帮助你排查技能文件的问题。

:::warning 注意
`loadSkillsFromDir()` 不会在技能文件有问题时抛出异常——它会静默跳过有问题的文件，并把错误信息放到 `diagnostics` 中。如果你发现某个技能没有被加载，先检查 `diagnostics` 输出。
:::

## 将技能注入资源加载器

资源加载器（`DefaultResourceLoader`）是 Agent 获取系统提示词和技能的统一入口。我们需要把自定义的系统提示词和加载的技能都注入到这里：

```typescript
const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => [
    'You are WeatherBot, a friendly weather assistant.',
    'Always greet the user warmly.',
    'When asked about weather, use the get_weather tool first.',
  ].join('\n'),
  noExtensions: true,
  noPromptTemplates: true,
  noThemes: true,
  // 启用技能
  noSkills: skills.length === 0,
  ...(skills.length > 0 && {
    skillsOverride: () => ({ skills, diagnostics: [] }),
  }),
})
await resourceLoader.reload()
```

### 底层原理

让我们理解各个配置项的含义：

- **`systemPromptOverride`**：接收一个**函数**（不是字符串）。这样设计是为了支持动态系统提示词——你可以根据当前时间、用户偏好、环境变量等生成不同的提示词。

- **`noExtensions`、`noPromptTemplates`、`noThemes`**：这些选项禁用了 `pi-coding-agent` 的内置资源。在教程中我们不需要它们，设为 `true` 可以确保 Agent 的行为完全由我们的系统提示词和技能控制。

- **`noSkills`**：控制是否启用技能系统。注意我们使用了条件逻辑——只有当成功加载了技能时才启用。

- **`skillsOverride`**：将我们手动加载的技能注入框架。同样是一个函数，返回技能列表和诊断信息。

- **`resourceLoader.reload()`**：必须在创建 Agent 会话之前调用，它会实际执行系统提示词和技能的加载。

:::tip 提示
`systemPromptOverride` 接收函数而非字符串，这意味着你可以实现非常动态的行为。例如，白天使用活泼的语气，晚上使用安静的语气；或者根据用户的历史对话调整 Agent 的专业领域重点。
:::

## 编写高质量系统提示词的技巧

系统提示词是 Agent 行为最重要的控制手段。以下是一些实践中总结的技巧：

**1. 身份先行**：第一句话定义 Agent 的身份。模型会把第一印象贯穿整个对话。

```
You are WeatherBot, a friendly weather assistant.   ← 好：身份明确
You should help users with weather questions.        ← 差：身份模糊
```

**2. 正面指令优于负面指令**：告诉 AI "应该做什么"比"不应该做什么"更有效。

```
Always cite your data sources.           ← 好：正面指令
Don't forget to cite your data sources.  ← 差：负面指令
```

**3. 使用结构化格式**：列表、编号、Markdown 标题都能帮助模型更好地理解复杂指令。

**4. 保持简洁**：系统提示词占用 context window。过长的提示词不仅浪费 token，还可能让模型"迷失"在过多的指令中。

## 编写技能的最佳实践

**1. 单一职责**：每个技能文件只处理一个领域。`weather-expert.md` 只管天气，不要混入其他知识。

**2. 提供具体示例**：LLM 从示例中学习的效果远好于抽象描述。

```markdown
When asked about weather, respond like this:

**Tokyo Weather Report**
- Current: 22°C, Sunny ☀️
- Humidity: 45%
- Forecast: Clear skies expected through tomorrow
- Advisory: Great day for outdoor activities!
```

**3. 描述写清楚**：`description` 字段应该简明扼要地说清楚这个技能做什么。框架和未来的 AI 调度系统会用这个字段来决定是否激活某个技能。

## 技能组合：构建能力矩阵

技能系统最强大的特性是**组合性**。你可以像搭积木一样，为同一个 Agent 组合不同的技能：

```
基础 Agent
├── weather-expert.md      → 天气领域知识
├── travel-advisor.md      → 旅行建议
└── local-customs.md       → 当地文化习俗

同一个 Agent + 不同技能组合 = 不同的专家：
- 天气 Agent   = 基础 + weather-expert
- 旅行 Agent   = 基础 + weather-expert + travel-advisor + local-customs
- 文化 Agent   = 基础 + local-customs
```

在代码层面，这就是简单地控制传入哪些技能文件到 `skillsOverride` 中。

## 完整代码

```typescript
import * as path from 'node:path'
import { Type } from '@sinclair/typebox'
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
  loadSkillsFromDir,
  type ToolDefinition,
} from '@mariozechner/pi-coding-agent'
import { createModel } from '../../shared/model'

const model = createModel()

// 从 skills/ 目录加载技能
const SKILLS_DIR = path.join(import.meta.dirname, 'skills')
const { skills, diagnostics } = loadSkillsFromDir({ dir: SKILLS_DIR, source: 'tutorial' })

console.log(`📚 加载了 ${skills.length} 个技能:`)
skills.forEach((s) => console.log(`   - ${s.name}: ${s.description}`))

// 天气工具（与第 03 章相同但内联）
const weatherTool: ToolDefinition = {
  name: 'get_weather',
  label: 'Get Weather',
  description: 'Get current weather for a city.',
  parameters: Type.Object({
    city: Type.String({ description: 'City name' }),
  }),
  execute: async (_toolCallId, params) => {
    const { city } = params as { city: string }
    const data: Record<string, object> = {
      tokyo: { temp: '22°C', condition: 'Sunny', humidity: '45%', forecast: 'Clear skies' },
      london: { temp: '14°C', condition: 'Overcast', humidity: '82%', forecast: 'Rain expected' },
    }
    const weather = data[city.toLowerCase()] || { temp: '20°C', condition: 'Clear', humidity: '50%' }
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ city, ...weather }) }],
      details: {},
    }
  },
}

// 带系统提示词 + 技能的资源加载器
const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => [
    'You are WeatherBot, a friendly weather assistant.',
    'Always greet the user warmly.',
    'When asked about weather, use the get_weather tool first.',
  ].join('\n'),
  noExtensions: true,
  noPromptTemplates: true,
  noThemes: true,
  noSkills: skills.length === 0,
  ...(skills.length > 0 && {
    skillsOverride: () => ({ skills, diagnostics: [] }),
  }),
})
await resourceLoader.reload()

const { session } = await createAgentSession({
  model,
  tools: [],
  customTools: [weatherTool],
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
})

// 流式输出及工具事件
session.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    process.stdout.write(event.assistantMessageEvent.delta)
  }
  if (event.type === 'tool_execution_start') {
    console.log(`\n🔧 ${event.toolName}(${JSON.stringify(event.args)})`)
  }
  if (event.type === 'tool_execution_end') {
    console.log(`✅ 完成\n`)
  }
})

const question = process.argv[2] || "What's the weather like in London today?"
console.log(`You: ${question}\n`)
process.stdout.write('Agent: ')

await session.prompt(question)

console.log()
process.exit(0)
```

## 运行

```bash
bun run ch06

# 或使用自定义问题：
bun run ch06 "How's the weather in Tokyo?"
```

## 预期行为

Agent 以 "WeatherBot" 身份响应，使用天气工具，并按照 weather-expert 技能的格式（温度、湿度、预报、建议）组织回复。

你会注意到两个层面的效果叠加：
1. **系统提示词的效果**：Agent 自称 WeatherBot，语气友好，会先用工具再回答
2. **技能的效果**：回复按照天气报告的格式组织（当前状况、湿度、预报、建议）

这就是系统提示词和技能协同工作的力量——提示词定义"谁"，技能定义"怎么做"。

## 常见错误

**1. `resourceLoader.reload()` 忘记 `await`**

```typescript
// 错误：reload 还没完成就创建会话了，技能不会被加载
resourceLoader.reload()
const { session } = await createAgentSession({ ... })

// 正确：等待 reload 完成
await resourceLoader.reload()
const { session } = await createAgentSession({ ... })
```

**2. 技能文件缺少 frontmatter**

```markdown
<!-- 错误：没有 frontmatter，框架不知道技能名称 -->
When discussing weather, always structure your response...

<!-- 正确：必须有 name 和 description -->
---
name: weather-expert
description: Provides weather forecasting expertise
---

When discussing weather, always structure your response...
```

**3. `noSkills` 设为 `true` 但同时提供了 `skillsOverride`**

```typescript
// 错误：noSkills: true 会完全禁用技能系统，skillsOverride 被忽略
const resourceLoader = new DefaultResourceLoader({
  noSkills: true,
  skillsOverride: () => ({ skills, diagnostics: [] }),
})

// 正确：要使用技能就必须 noSkills: false
const resourceLoader = new DefaultResourceLoader({
  noSkills: false,
  skillsOverride: () => ({ skills, diagnostics: [] }),
})
```

## 小结

本章的核心收获：

1. **系统提示词是 Agent 的"操作系统"**——它定义了 Agent 的身份、行为准则和全局约束，是控制 Agent 行为最有力的手段
2. **技能是可组合的知识模块**——用 Markdown 编写，通过 YAML frontmatter 管理元数据，可以像积木一样自由组合
3. **技能的核心哲学是"用自然语言编程"**——降低了定制 Agent 行为的门槛，非程序员也能参与
4. **`DefaultResourceLoader` 是集中管理 Prompt 和技能的枢纽**——通过 `systemPromptOverride` 和 `skillsOverride` 注入自定义内容
5. **系统提示词定义"谁"，技能定义"怎么做"**——两者协同工作，构成完整的 Agent 行为控制体系

## 下一章

[第 07 章：多会话管理](/zh/guide/07-multi-session) —— 管理多个对话会话。
