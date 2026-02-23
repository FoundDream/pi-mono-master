# 02 - 流式输出

使用事件订阅模型实现实时打字机效果。

## 为什么流式输出至关重要？

当你使用 ChatGPT 或 Claude 的网页版时，你会注意到文字是**逐字逐句地"打"出来**的，而不是等 AI 想完了才一次性显示。这不仅仅是一个"好看的特效" —— 它是现代 AI 应用的**基本用户体验要求**。

为什么？让我们用数字说话：

- 一个中等长度的 AI 回答（约 500 字）通常需要 **3-8 秒**才能完全生成
- 如果用户在这 3-8 秒内看到的是空白屏幕或转圈图标，他们会觉得"卡了"
- 而流式输出让用户在 **几十毫秒内**就能看到第一个字符，**感知延迟减少了 10-100 倍**

这就是所谓的 **TTFT（Time To First Token）** —— 从发送请求到看到第一个输出字符的时间。流式输出不会让 AI 思考得更快，但它让用户**感觉**快了很多。这和餐厅的逻辑一样：与其让顾客干等 20 分钟然后一次上齐所有菜，不如先上个凉菜，让他们边吃边等。

在这一章中，你将学会如何利用 `pi-coding-agent` 的事件系统实现流式输出，把上一章的"等完了才显示"升级为实时的打字机效果。

## 你将学到

- `session.subscribe()` 如何实时传递事件
- `message_update` → `text_delta` 事件用于流式文本输出
- Agent 生命周期事件：`agent_start`、`agent_end`
- 使用 `process.stdout.write()` 实现流式输出（每个 chunk 不换行）
- 流式输出与缓冲输出的架构差异

## 事件系统架构

`pi-coding-agent` 采用**发布-订阅（Pub/Sub）**模式来分发事件。当 Agent 处理一个 prompt 时，它会按照时间顺序发出一系列事件，你的监听器可以实时接收并处理它们。

```
┌──────────────────────────────────────────────────────┐
│                    Agent Session                      │
│                                                      │
│  prompt("...") 触发:                                 │
│                                                      │
│  ┌─────────────┐                                     │
│  │ agent_start │ ─── "我开始处理了"                    │
│  └──────┬──────┘                                     │
│         ↓                                            │
│  ┌──────────────────┐                                │
│  │ message_update   │ ─── text_delta: "CPU "         │
│  │ message_update   │ ─── text_delta: "是一种 "       │
│  │ message_update   │ ─── text_delta: "处理器..."     │
│  │ ...              │     （持续发出，直到生成完毕）     │
│  └──────┬───────────┘                                │
│         ↓                                            │
│  ┌─────────────┐                                     │
│  │  agent_end  │ ─── "我处理完了"                     │
│  └─────────────┘                                     │
│                                                      │
│  → prompt() 的 Promise resolve                       │
└──────────────────────────────────────────────────────┘
         ↓ 事件流
┌──────────────────────────────────────────────────────┐
│              你的 subscribe() 监听器                   │
│                                                      │
│  收到 agent_start  → 显示 "[开始思考...]"              │
│  收到 text_delta   → process.stdout.write(delta)     │
│  收到 text_delta   → process.stdout.write(delta)     │
│  ...                                                 │
│  收到 agent_end    → 显示 "[完成]"                    │
└──────────────────────────────────────────────────────┘
```

### 核心事件类型

| 事件             | 触发时机                    | 包含的数据                                       |
| ---------------- | --------------------------- | ------------------------------------------------ |
| `agent_start`    | Agent 开始处理用户的 prompt | 无额外数据                                       |
| `message_update` | Agent 产生了新的输出内容    | `assistantMessageEvent`（包含 delta 类型和内容） |
| `agent_end`      | Agent 完成了本轮回答        | 无额外数据                                       |

其中 `message_update` 事件的 `assistantMessageEvent` 有多种类型，本章我们只关注 `text_delta` —— 代表一小段新生成的文本。在后续的工具章节中，你还会遇到工具调用相关的事件类型。

## 完整代码

```typescript
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
} from "@mariozechner/pi-coding-agent";
import { createModel } from "../../shared/model";

const model = createModel();

const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => "You are a helpful assistant. Respond in detail.",
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
});
await resourceLoader.reload();

const { session } = await createAgentSession({
  model,
  tools: [],
  customTools: [],
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
});

// 订阅事件 —— 将 delta 实时写入 stdout（打字机效果）
session.subscribe((event) => {
  if (event.type === "message_update") {
    const { assistantMessageEvent } = event;
    switch (assistantMessageEvent.type) {
      case "text_delta":
        // 将每个文本 chunk 直接写入 stdout（不换行）
        process.stdout.write(assistantMessageEvent.delta);
        break;
    }
  }

  // 你也可以监听 Agent 生命周期事件
  if (event.type === "agent_start") {
    console.log("[Agent 开始思考...]\n");
  }
  if (event.type === "agent_end") {
    console.log("\n\n[Agent 完成]");
  }
});

const question =
  process.argv[2] || "Explain how a CPU executes instructions, step by step.";
console.log(`You: ${question}\n`);

await session.prompt(question);

console.log();
process.exit(0);
```

## 逐步解析

### 缓冲输出 vs. 流式输出

上一章中，我们将所有的 `text_delta` 拼接成一个字符串，等 Agent 完全说完后再一次性打印：

```typescript
// 第 01 章的方式：缓冲输出
let response = "";
session.subscribe((event) => {
  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "text_delta"
  ) {
    response += event.assistantMessageEvent.delta; // 拼接到字符串
  }
});
await session.prompt("...");
console.log("Agent:", response); // 一次性打印
```

而本章的关键改变只有一处 —— 我们将每个 delta **直接写入 stdout**：

```typescript
// 第 02 章的方式：流式输出
process.stdout.write(assistantMessageEvent.delta);
```

:::tip `process.stdout.write()` vs `console.log()`
`console.log()` 会在末尾自动加换行符 `\n`，而 `process.stdout.write()` 不会。对于流式输出，我们**必须**使用 `process.stdout.write()`，否则每个 delta（可能只有一两个字）都会独占一行，输出结果会变得不可读。
:::

这个改变虽然微小，但效果截然不同：用户从"等几秒后看到一大段文字"变成了"立刻开始看到文字逐渐浮现"。

### 事件流的时间线

让我们看看一个典型的事件流是什么样子的：

```
agent_start
  → message_update (text_delta: "The ")
  → message_update (text_delta: "CPU ")
  → message_update (text_delta: "first ")
  → message_update (text_delta: "fetches the ")
  → message_update (text_delta: "instruction ")
  → ... 更多 delta ...
  → message_update (text_delta: "from memory.")
agent_end
```

每个 `text_delta` 事件携带的文本量是**不固定的** —— 有时只有一个词，有时是半句话。这取决于 AI 模型底层的 tokenizer 和网络传输情况。你的代码不应该假设每个 delta 的大小。

### 生命周期事件的作用

```typescript
if (event.type === "agent_start") {
  console.log("[Agent 开始思考...]\n");
}
if (event.type === "agent_end") {
  console.log("\n\n[Agent 完成]");
}
```

`agent_start` 和 `agent_end` 是 Agent 的**生命周期事件**。它们本身不携带输出内容，但对于构建良好的用户体验非常重要：

- **`agent_start`**：可以用来显示加载指示器（如旋转动画）、禁用输入框等
- **`agent_end`**：可以用来隐藏加载指示器、重新启用输入框、执行清理操作等

在更复杂的场景中（如 Agent 使用工具时），一次 `prompt()` 调用可能会触发**多轮** `agent_start`/`agent_end`。每当 Agent 调用工具后继续思考时，就会产生一对新的生命周期事件。

## 底层原理：事件是如何传递的？

当你调用 `session.prompt()` 时，框架会：

1. 将用户消息添加到会话历史中
2. 调用 AI 模型的**流式 API**（如 Anthropic 的 `/messages` 端点加上 `stream: true` 参数）
3. AI 模型以 Server-Sent Events (SSE) 的形式返回数据
4. 框架解析每个 SSE 事件，将其转换为 `pi-coding-agent` 的事件格式
5. 通过事件总线将事件分发给所有 `subscribe()` 注册的监听器

这意味着事件是**异步、渐进式**传递的。你的监听器不是在 `prompt()` 返回后一次性收到所有事件，而是在 Agent 生成过程中**实时**收到每一个事件。

```
AI 模型 (SSE)          pi-coding-agent           你的监听器
─────────────         ─────────────────          ───────────
data: {"delta":"The "}  → text_delta 事件  →  stdout.write("The ")
data: {"delta":"CPU "}  → text_delta 事件  →  stdout.write("CPU ")
data: {"delta":"is "}   → text_delta 事件  →  stdout.write("is ")
...
data: [DONE]            → agent_end 事件   →  显示 "[完成]"
```

## 常见错误

### 忘记用 `switch` 或 `if` 过滤事件类型

`subscribe()` 监听器会收到**所有类型**的事件，不只是 `text_delta`。如果你不检查 `event.type`，可能会在处理非 `message_update` 事件时出错：

```typescript
// 错误：没有检查事件类型
session.subscribe((event) => {
  process.stdout.write(event.assistantMessageEvent.delta); // event 可能没有 assistantMessageEvent!
});

// 正确：先检查事件类型
session.subscribe((event) => {
  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "text_delta"
  ) {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});
```

### 流式输出中的错误处理

在真实应用中，AI 模型的流式响应可能中途中断（网络问题、API 限流等）。虽然 `pi-coding-agent` 框架会处理大部分底层错误，但你应该为生产环境添加错误事件的监听：

```typescript
session.subscribe((event) => {
  if (event.type === "error") {
    console.error("Agent 出错:", event.error);
    // 可以在这里实现重试逻辑或优雅降级
  }
});
```

:::warning 注意
在流式输出过程中，如果网络中断，用户可能只看到回答的前半部分。好的用户体验应该在这种情况下显示明确的错误提示，而不是让用户以为回答已经结束了。
:::

## 运行

```bash
bun run ch02

# 或使用自定义问题：
bun run ch02 "What is quantum computing?"
```

本章支持通过命令行参数传入自定义问题。如果不传参数，默认会询问"CPU 是如何执行指令的"。

## 预期行为

文本在终端中逐字出现，类似 ChatGPT 的打字效果。你应该能明显感觉到文字是"一点点冒出来的"，而不是突然出现一大段。

如果你仔细观察，还会注意到：

- 开头先显示 `[Agent 开始思考...]`
- 然后文字逐渐出现
- 最后显示 `[Agent 完成]`

## 小结

在这一章中，你学到了：

- **流式输出是现代 AI 应用的标配** —— 它大幅降低感知延迟，提升用户体验
- **事件驱动模型的威力** —— 通过 `subscribe()` + 事件类型过滤，你可以灵活处理各种 Agent 行为
- **`process.stdout.write()` vs `console.log()`** —— 流式输出必须用前者，避免不必要的换行
- **生命周期事件**（`agent_start`/`agent_end`）—— 用于构建加载状态和 UI 反馈
- **底层原理** —— 事件来自 AI 模型的 SSE 流，通过框架的事件总线实时分发

从缓冲输出到流式输出，代码改动只有一行，但用户体验的提升是质的飞跃。在下一章中，我们将学习如何赋予 Agent **使用工具**的能力 —— 让它不只是"说话"，还能"做事"。

## 下一章

[第 03 章：自定义工具](/zh/guide/03-custom-tools) —— 用工具定义赋予 Agent 能力。
