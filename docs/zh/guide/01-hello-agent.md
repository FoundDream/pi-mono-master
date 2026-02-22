# 01 - Hello Agent

最简单的 Agent —— 一个提示，一个回复，退出。

## 为什么从这里开始？

想象你在学开车 —— 你不会一上来就在高速公路上练习并线和超车。你会先在空旷的停车场里学习最基本的操作：启动、踩油门、踩刹车、熄火。

这一章就是你的"停车场"。我们将构建最简单的 Agent：**发送一条消息，收到一个回复，然后退出**。没有流式输出，没有工具调用，没有会话持久化 —— 纯粹是为了理解 Agent 的核心骨架。

但不要小看这个"Hello World"。在这短短几十行代码中，隐藏着 Agent 系统的三大核心概念：**Model（模型）**、**ResourceLoader（资源加载器）** 和 **SessionManager（会话管理器）**。理解它们之间的协作关系，是构建更复杂 Agent 的基础。

## "Agent" 到底是什么？

在深入代码之前，让我们先搞清楚一个根本性的问题：**Agent 和普通的 API 调用有什么区别？**

当你直接调用 OpenAI 或 Anthropic 的 API 时，你做的事情本质上是：

```
你（开发者） → 发送 prompt → AI API → 收到回复 → 结束
```

这是一个**单次请求-响应**的模式。API 不记得你之前说过什么，不知道自己能使用什么工具，也没有任何"自主性"。每次调用都是独立的、无状态的。

而 **Agent** 则完全不同。Agent 是一个**拥有自主决策能力的 AI 实体**，它：

- **有记忆** —— 知道之前的对话内容（会话管理）
- **有工具** —— 能调用外部函数来完成任务（工具系统）
- **有人格** —— 通过系统提示词定义行为准则（资源加载器）
- **能循环** —— 可以在"思考 → 使用工具 → 观察结果 → 继续思考"的循环中自主运作

用一个类比来说：**API 调用就像对讲机 —— 你说一句，对方回一句；而 Agent 则像你雇了一个助理 —— 你告诉他任务，他会自己想办法、用工具、分步骤完成。**

`pi-coding-agent` 框架就是帮你搭建这个"助理"的基础设施。

## 你将学到

- 如何从环境变量创建 `Model`
- 如何用自定义系统提示词配置 `DefaultResourceLoader`
- 如何用 `createAgentSession()` 创建 Agent 会话
- 如何订阅事件并收集响应
- 如何用 `session.prompt()` 发送提示

## 核心架构：三驾马车

一个 `pi-coding-agent` 会话由三个核心组件协作构成：

```
┌─────────────────────────────────────────────────────┐
│                  createAgentSession()                │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   Model     │  │ResourceLoader│  │  Session    │ │
│  │  (大脑)     │  │  (人格配置)   │  │  Manager   │ │
│  │             │  │              │  │  (记忆)     │ │
│  │ 连接哪个AI  │  │ 系统提示词    │  │ 消息存储    │ │
│  │ 用什么模型  │  │ 技能/扩展    │  │ 会话恢复    │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
│                         ↓                           │
│                  Agent Session                      │
│            subscribe() / prompt()                   │
└─────────────────────────────────────────────────────┘
```

| 概念 | 类比 | 说明 |
|------|------|------|
| `Model` | 大脑 | 决定使用哪个 AI 模型（Claude、GPT-4、Gemini 等）|
| `DefaultResourceLoader` | 人格/技能配置 | 控制系统提示词、技能、扩展。定义 Agent "是谁"、"能做什么" |
| `SessionManager` | 记忆系统 | 管理对话历史的存储方式 —— 内存中还是持久化到文件 |
| `createAgentSession()` | 组装工厂 | 将以上组件组装成一个可用的 Agent 会话 |
| `session.subscribe()` | 订阅通知 | 注册事件监听器，接收 Agent 产生的各种事件 |
| `session.prompt()` | 交谈 | 发送用户消息；返回一个在 Agent 完成后 resolve 的 Promise |

## 完整代码

```typescript
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
} from '@mariozechner/pi-coding-agent'
import { createModel } from '../../shared/model'

const model = createModel()

// ResourceLoader 控制系统提示词、技能、扩展等
// 这里我们禁用所有功能，只设置一个简单的系统提示词
const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => 'You are a helpful assistant. Be concise.',
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
})
await resourceLoader.reload()

// 创建内存会话（不做文件持久化）
const { session } = await createAgentSession({
  model,
  tools: [],          // 不使用编码工具（read、write、bash、edit）
  customTools: [],    // 不使用自定义工具
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
})

// 订阅事件并收集完整响应
let response = ''
session.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    response += event.assistantMessageEvent.delta
  }
})

// 发送一条提示并等待完成
await session.prompt('What is the Fibonacci sequence? Explain in 2 sentences.')

console.log('Agent:', response)
process.exit(0)
```

## 逐步解析

### 1. 创建模型 —— 连接 AI 的大脑

```typescript
const model = createModel()
```

`createModel()` 从 `.env` 文件读取 `AI_PROVIDER` 和 `AI_MODEL`，返回一个 `Model<Api>` 对象。

这个对象并不直接调用 API —— 它更像是一份"说明书"，描述了你要使用的模型的元信息（ID、提供商、上下文窗口大小、最大输出 token 数等）。`pi-coding-agent` 框架会在需要时根据这份"说明书"来实际发起 API 请求。

:::tip 提示
如果你切换模型（比如从 Claude 换成 GPT-4o），**只需修改 `.env` 文件**，代码完全不用改。这就是模型抽象层的威力。
:::

### 2. 配置资源加载器 —— 定义 Agent 的人格

```typescript
const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => 'You are a helpful assistant. Be concise.',
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
})
await resourceLoader.reload()
```

`DefaultResourceLoader` 是 Agent 行为的核心配置点。你可以把它想象成 Agent 的"性格设定"和"技能背包"：

- **`systemPromptOverride`**：覆盖默认的系统提示词。系统提示词是 Agent 的"行为准则"，它告诉 AI 自己是谁、应该如何表现。
- **`noExtensions`、`noSkills` 等**：禁用框架自带的各种可选功能。在学习阶段，我们把所有"花活"关掉，只保留最核心的对话能力。

:::warning 注意
`await resourceLoader.reload()` 这一步不能省略！它会触发资源加载器从配置中加载系统提示词和其他资源。如果忘记调用，Agent 创建时会拿不到正确的系统提示词。
:::

### 3. 创建会话 —— 把所有组件组装起来

```typescript
const { session } = await createAgentSession({
  model,
  tools: [],
  customTools: [],
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
})
```

`createAgentSession()` 是将所有组件连接在一起的"组装工厂"。它接收模型、工具列表、会话管理器和资源加载器，返回一个可用的 `session` 对象。

这里有两个工具相关的参数值得注意：

- **`tools: []`** —— 不使用框架内置的编码工具（如文件读写、命令执行等）。在后续章节中我们会启用它们。
- **`customTools: []`** —— 不使用自定义工具。第 03 章会详细讲解如何定义自己的工具。

`SessionManager.inMemory()` 表示不做持久化 —— 会话仅存在于内存中，程序退出后一切消失。这是最简单的会话管理模式。

### 4. 订阅事件并发送提示 —— 与 Agent 对话

```typescript
session.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    response += event.assistantMessageEvent.delta
  }
})

await session.prompt('What is the Fibonacci sequence? Explain in 2 sentences.')
```

这里体现了 `pi-coding-agent` 的**事件驱动模型**。与直接 `await` 一个 API 响应不同，Agent 的响应是通过**事件流**传递的：

1. 你先通过 `subscribe()` 注册一个事件监听器
2. 然后通过 `prompt()` 发送用户消息
3. Agent 开始处理后，会不断发出事件（文本片段、工具调用、完成信号等）
4. 你的监听器接收并处理这些事件
5. 当 `prompt()` 返回的 Promise resolve 时，表示 Agent 完成了本轮回答

为什么用事件模型而不是简单的 `await response`？因为 Agent 不只是产生文本 —— 它还可能调用工具、发出进度通知、处理错误等。事件模型让你能灵活地处理所有这些不同类型的信息。

## 底层原理：createAgentSession 做了什么？

当你调用 `createAgentSession()` 时，框架在背后做了以下事情：

1. **加载会话上下文** —— 从 `SessionManager` 中读取已有的消息历史（如果有的话）
2. **构建系统提示词** —— 从 `ResourceLoader` 中获取系统提示词，将其注入到消息列表的开头
3. **注册工具** —— 将 `tools` 和 `customTools` 中的工具定义转换为 AI 模型能理解的格式
4. **创建事件总线** —— 建立事件分发机制，让 `subscribe()` 注册的监听器能收到事件
5. **返回 session 对象** —— 包含 `prompt()`、`subscribe()` 等方法的交互接口

整个过程可以类比为**组装一台电脑**：Model 是 CPU，ResourceLoader 是 BIOS 配置，SessionManager 是硬盘，tools 是外设。`createAgentSession()` 把它们组装起来，返回一台可以开机使用的"电脑"。

## 常见错误

### 忘记 `await resourceLoader.reload()`

如果你省略了这一步，Agent 可能使用空的系统提示词，导致行为不符合预期。这个错误很隐蔽，因为程序不会报错，只是 Agent 的回答可能变得"不像话"。

### 忘记 `process.exit(0)`

由于 `pi-coding-agent` 内部可能存在活跃的定时器或连接，如果不显式调用 `process.exit(0)`，Node.js/Bun 进程可能不会自动退出，导致程序"卡住"。

### 把 `subscribe()` 放在 `prompt()` 之后

事件监听器必须在发送 prompt **之前**注册。如果你先 `prompt()` 再 `subscribe()`，你会错过 Agent 已经发出的事件，得到一个空的 response。

## 运行

```bash
bun run ch01
```

## 预期输出

```
Agent: The Fibonacci sequence is a series of numbers where each number is the sum
of the two preceding ones, starting from 0 and 1: 0, 1, 1, 2, 3, 5, 8, 13, 21, ...
It appears frequently in mathematics and nature, from spiral patterns in shells to
the branching of trees.
```

:::tip 提示
由于 LLM 的输出具有一定随机性，你每次运行得到的具体文字可能不同，但内容大意应该一致。如果你希望输出更稳定，可以在调用模型时设置较低的 `temperature` 值。
:::

## 小结

在这一章中，你学到了：

- **Agent 与 API 调用的本质区别** —— Agent 拥有记忆、工具和自主决策能力
- **三大核心组件** —— Model（大脑）、ResourceLoader（人格配置）、SessionManager（记忆系统）
- **事件驱动模型** —— Agent 通过事件流传递响应，而不是简单的请求-响应
- **`createAgentSession()`** 是将所有组件组装在一起的枢纽函数

这些概念将贯穿整个教程。接下来，我们将在此基础上添加**流式输出**，让 Agent 的回复像 ChatGPT 一样逐字显现。

## 下一章

[第 02 章：流式输出](/zh/guide/02-streaming) —— 添加实时打字机效果。
