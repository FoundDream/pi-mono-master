# 03 - 自定义工具

使用 TypeBox 参数 Schema 定义你自己的工具。

## 什么是"工具调用"？为什么它是 Agent 的核心？

到目前为止，我们的 Agent 只能"说话" —— 接收问题，生成文字回答。但现实世界中的很多任务光靠"说"是不够的。如果用户问"东京现在天气怎么样？"，Agent 光凭训练数据无法给出**实时**的天气信息。它需要**去查** —— 调用一个天气 API，获取实时数据，然后基于数据来回答。

这就是**工具调用（Tool Calling / Function Calling）**的核心思想：

> **你不需要让 AI 知道所有的答案，你只需要让它知道去哪里找答案。**

工具调用的运作方式如下：

```
用户: "东京现在天气怎么样？"
  ↓
Agent 思考: "我需要查天气，我有一个 get_weather 工具可以用"
  ↓
Agent 生成工具调用: get_weather({ city: "Tokyo" })
  ↓
框架执行工具，得到结果: { temp: "22°C", condition: "Sunny" }
  ↓
Agent 收到结果，继续思考，生成最终回答:
  "东京现在 22°C，晴天，适合出门散步！"
```

整个过程中，**AI 模型不会直接执行你的函数** —— 它只是"说"它想调用什么工具、传什么参数。实际的执行由你的代码（框架）完成，执行结果再反馈给 AI。这个设计保证了安全性：你完全控制工具的实现和权限。

用一个类比来说：**工具就像餐厅的菜单**。你（开发者）写菜单（定义工具），AI 负责点菜（决定调用什么工具和传什么参数），厨房（你的 execute 函数）负责做菜，做好了再端给 AI 看结果。

## 你将学到

- 如何定义 `ToolDefinition`，包含 name、label、description、parameters 和 execute
- 使用 `@sinclair/typebox`（不是 Zod）定义参数 Schema
- `execute()` 如何返回 `{ content: [...], details: {} }`
- 工具执行事件：`tool_execution_start`、`tool_execution_end`
- 通过 `customTools` 选项传入自定义工具

## 工具的结构

一个工具定义由五个核心部分组成：

```typescript
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

const myTool: ToolDefinition = {
  name: "tool_name", // LLM 工具调用中使用的名称（snake_case）
  label: "Tool Name", // 人类可读的标签
  description: "...", // 给 LLM 的描述，帮助它决定何时使用
  parameters: Type.Object({
    // TypeBox Schema
    param: Type.String({ description: "..." }),
  }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    const { param } = params as { param: string };
    return {
      content: [{ type: "text", text: "..." }],
      details: {},
    };
  },
};
```

让我们逐一理解每个字段：

| 字段          | 给谁看的？     | 作用                                                                       |
| ------------- | -------------- | -------------------------------------------------------------------------- |
| `name`        | AI 模型        | 工具的唯一标识符。AI 在决定调用工具时会引用这个名称。**必须是 snake_case** |
| `label`       | 用户           | 人类可读的显示名称，用于 UI 展示                                           |
| `description` | AI 模型        | **最重要的字段之一**。AI 根据这段描述来决定什么时候应该使用这个工具        |
| `parameters`  | AI 模型 + 框架 | 用 TypeBox Schema 描述工具接受的参数，AI 会根据这个 Schema 生成参数        |
| `execute`     | 框架           | 实际执行工具逻辑的异步函数。接收参数，返回结果                             |

详见 [ToolDefinition API 参考](/zh/api/tool-definition)。

### 为什么用 TypeBox 而不是 Zod？

你可能在 Vercel AI SDK 等框架中见过使用 Zod 来定义工具参数。`pi-coding-agent` 选择 [TypeBox](https://github.com/sinclairzx81/typebox) 是出于以下考虑：

- **JSON Schema 兼容性**：TypeBox 直接输出标准的 JSON Schema，而 Zod 需要额外的转换步骤。AI 模型的工具调用功能底层用的就是 JSON Schema
- **性能**：TypeBox 的编译和验证速度更快
- **类型推导**：TypeBox 的 TypeScript 类型推导非常精确

:::tip 提示
如果你已经熟悉 Zod，不用担心 —— TypeBox 的学习曲线很平滑。`Type.String()` 对应 `z.string()`，`Type.Number()` 对应 `z.number()`，`Type.Object()` 对应 `z.object()`。核心 API 几乎是一一映射的。
:::

## 设计有效工具：写好 description 是关键

AI 模型决定是否使用一个工具，**几乎完全依赖于 `description` 字段**。一个写得好的 description 可以让 AI 精准地在合适的时机调用你的工具；一个写得差的 description 会导致 AI 乱调用或者该调用时不调用。

以下是一些经验法则：

**好的 description：**

```typescript
description: "Get current weather for a city. Use this when the user asks about weather, temperature, or climate conditions for a specific location.";
```

**差的 description：**

```typescript
description: "Weather tool"; // 太模糊，AI 不知道什么时候该用
```

:::tip 编写 description 的技巧

1. **说清楚工具做什么** —— "Get current weather for a city"
2. **说清楚什么时候该用** —— "Use this when the user asks about weather..."
3. **说清楚参数格式** —— 可以在参数的 `description` 中补充示例，如 `'City name (e.g. "Tokyo", "London")'`
4. **说清楚局限性** —— 如果工具只支持部分城市，在 description 中说明
   :::

:::warning 注意
不要在 description 中使用"请"、"你应该"这类对 AI 的指令性语言。Description 是对工具功能的**客观描述**，不是对 AI 的命令。系统提示词才是下达指令的地方。
:::

## 示例：天气工具

让我们来实现第一个工具 —— 一个模拟的天气查询工具：

```typescript
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

export const weatherTool: ToolDefinition = {
  name: "get_weather",
  label: "Get Weather",
  description:
    "Get current weather for a city. Use this when the user asks about weather.",
  parameters: Type.Object({
    city: Type.String({ description: 'City name (e.g. "Tokyo", "London")' }),
  }),
  execute: async (_toolCallId, params) => {
    const { city } = params as { city: string };

    const weatherData: Record<
      string,
      { temp: string; condition: string; humidity: string }
    > = {
      tokyo: { temp: "22°C", condition: "Sunny", humidity: "45%" },
      london: { temp: "14°C", condition: "Cloudy", humidity: "78%" },
      "new york": { temp: "18°C", condition: "Partly cloudy", humidity: "55%" },
    };

    const key = city.toLowerCase();
    const weather = weatherData[key] || {
      temp: "20°C",
      condition: "Clear",
      humidity: "50%",
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ city, ...weather }),
        },
      ],
      details: {},
    };
  },
};
```

这个示例使用了硬编码的天气数据来模拟真实的 API 调用。在生产环境中，你会在 `execute` 函数中调用真正的天气 API（如 OpenWeatherMap）。

### 关于 execute 的返回值

`execute` 函数必须返回一个包含 `content` 和 `details` 的对象：

- **`content`**：一个数组，包含返回给 AI 模型的内容。最常见的类型是 `{ type: 'text', text: '...' }`。AI 会基于这些内容来构建最终回答
- **`details`**：元数据对象，可以包含任何你想附加的信息（如执行时间、数据来源等），不会发送给 AI 模型

:::tip 提示
工具返回给 AI 的内容应该是**结构化的、信息密集的**。不需要用自然语言 —— JSON 格式通常是最好的选择，因为 AI 模型非常擅长解析 JSON。让 AI 自己决定如何用自然语言向用户展示结果。
:::

## 示例：计算器工具

再来一个例子 —— 一个简单的数学表达式计算器：

```typescript
export const calculatorTool: ToolDefinition = {
  name: "calculate",
  label: "Calculator",
  description:
    "Evaluate a mathematical expression. Use for any math calculations.",
  parameters: Type.Object({
    expression: Type.String({
      description: 'Math expression to evaluate (e.g. "2 + 3 * 4")',
    }),
  }),
  execute: async (_toolCallId, params) => {
    const { expression } = params as { expression: string };
    try {
      const result = Function(`"use strict"; return (${expression})`)();
      return {
        content: [{ type: "text" as const, text: String(result) }],
        details: {},
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${e instanceof Error ? e.message : String(e)}`,
          },
        ],
        details: {},
      };
    }
  },
};
```

:::warning 注意
这里使用 `Function()` 来执行数学表达式只是为了教学演示。在生产环境中，**绝不应该**直接执行用户或 AI 生成的代码 —— 这是一个严重的安全漏洞。请使用安全的数学表达式解析库（如 `mathjs`）来替代。
:::

注意这个工具还展示了**错误处理**：当表达式无法求值时，我们返回一个包含错误信息的结果而不是抛出异常。这很重要 —— 如果 `execute` 抛出未处理的异常，AI 将不知道发生了什么；而返回结构化的错误信息，AI 可以理解出了什么问题，甚至可能自行修正并重试。

## 工具执行的完整生命周期

当 AI 决定调用一个工具时，以下是完整的执行流程：

```
1. AI 模型在响应中生成工具调用请求
   {"name": "get_weather", "arguments": {"city": "Tokyo"}}

2. 框架接收到工具调用请求
   → 发出 tool_execution_start 事件

3. 框架找到对应的工具定义，验证参数

4. 框架调用 execute() 函数
   → execute() 执行你的业务逻辑
   → 返回 { content: [...], details: {} }

5. 框架将结果返回给 AI 模型
   → 发出 tool_execution_end 事件

6. AI 模型收到工具结果，继续生成最终回答
   → 发出 text_delta 事件
```

一个关键的概念是：**工具调用可能是多轮的**。AI 可以在一次回答中调用多个工具（并行或串行），每个工具的结果都会反馈给 AI，AI 再决定是继续调用工具还是生成最终回答。

## 将工具接入会话

定义好工具后，通过 `customTools` 数组传入即可：

```typescript
const { session } = await createAgentSession({
  model,
  tools: [], // 不使用内置编码工具
  customTools: [weatherTool, calculatorTool], // 我们的自定义工具
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
});
```

就这么简单！框架会自动将工具定义转换为 AI 模型能理解的格式，并在 AI 请求调用工具时执行对应的 `execute` 函数。

:::tip `tools` vs `customTools` 的区别

- **`tools`**：框架内置的编码工具（文件读写、命令执行等），通过字符串名称引用
- **`customTools`**：你自己定义的工具，传入 `ToolDefinition` 对象数组

两者都会被注册到 Agent 的工具列表中，AI 模型可以自由选择调用哪个。
:::

## 监听工具事件

为了在终端中看到工具调用的过程，我们可以监听工具相关的事件：

```typescript
session.subscribe((event) => {
  switch (event.type) {
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      break;

    case "tool_execution_start":
      console.log(
        `\n🔧 工具调用: ${event.toolName}(${JSON.stringify(event.args)})`,
      );
      break;

    case "tool_execution_end":
      console.log(`✅ 结果: ${JSON.stringify(event.result)}\n`);
      break;
  }
});
```

`tool_execution_start` 在工具开始执行时触发，包含工具名称和参数；`tool_execution_end` 在执行完成后触发，包含返回结果。这两个事件对于调试和用户反馈都非常有用。

## 底层原理：AI 是如何"决定"调用工具的？

你可能会好奇：AI 是怎么知道什么时候该调用工具的？

答案是：当你把工具定义注册到 Agent 时，框架会将每个工具的 `name`、`description` 和 `parameters`（JSON Schema 格式）附加到发送给 AI 模型的请求中。AI 模型在训练过程中已经学会了如何阅读这些工具定义，并在合适的时机生成工具调用。

具体来说，AI 模型的响应有两种可能的格式：

1. **纯文本** —— 正常的文字回答
2. **工具调用** —— `{"name": "get_weather", "arguments": {"city": "Tokyo"}}`

AI 模型会根据用户的问题和工具的 description 来**自主决定**是直接回答还是先调用工具。这个决策过程完全发生在 AI 模型内部，开发者无法直接控制（但可以通过优化 description 和系统提示词来引导）。

## 常见错误

### 工具名称不符合规范

工具的 `name` 必须是 snake_case（如 `get_weather`），不能包含空格或特殊字符。不同的 AI 模型对名称格式有不同程度的容忍度，但 snake_case 是所有模型都支持的安全选择。

### description 太短或太模糊

如果 AI 不调用你的工具，首先检查 description —— 这是最常见的原因。AI 需要足够的信息来判断什么时候应该使用工具。

### execute 中忘记处理错误

如果 `execute` 函数抛出异常，框架会捕获它，但 AI 收到的错误信息可能不够友好。最好在 `execute` 内部用 try-catch 处理错误，返回有意义的错误信息。

### 参数类型转换问题

注意 `params` 的类型是 `unknown`，你需要自行断言或转换。虽然框架会根据 TypeBox Schema 验证参数，但 TypeScript 在编译时并不知道具体类型：

```typescript
// 推荐的方式
const { city } = params as { city: string };
```

## 运行

```bash
bun run ch03

# 或使用自定义问题：
bun run ch03 "What's the weather in London?"
```

## 预期输出

```
You: What's the weather in Tokyo? Also, what is 42 * 17?

🔧 工具调用: get_weather({"city":"Tokyo"})
✅ 结果: [{"type":"text","text":"{\"city\":\"Tokyo\",\"temp\":\"22°C\",...}"}]

🔧 工具调用: calculate({"expression":"42 * 17"})
✅ 结果: [{"type":"text","text":"714"}]

The weather in Tokyo is 22°C and sunny. And 42 × 17 = 714.
```

注意观察输出中的**时序**：AI 先判断需要两个工具，然后依次调用它们，最后基于两个工具的结果生成了一个整合的、自然语言的回答。这就是 Agent 的"自主性" —— 你只需要提供工具，AI 会自己决定如何使用它们。

## 小结

在这一章中，你学到了：

- **工具调用的核心概念** —— AI 不直接执行函数，而是"说"它想调用什么，框架负责实际执行
- **ToolDefinition 的五个核心字段** —— name、label、description、parameters、execute
- **TypeBox 的选择理由** —— 原生 JSON Schema 兼容，性能好，类型推导精确
- **description 是关键** —— AI 根据 description 决定是否调用工具，写好它比写好代码更重要
- **工具执行的完整生命周期** —— 从 AI 请求到框架执行再到结果反馈的完整链路
- **错误处理的重要性** —— 在 execute 中优雅处理错误，返回结构化的错误信息

工具调用是 Agent 从"对话机器人"进化为"智能助手"的关键能力。在下一章中，我们将解决另一个核心问题：如何让 Agent **记住对话内容** —— 即使程序重启。

## 下一章

[第 04 章：会话持久化](/zh/guide/04-session-persistence) —— 保存和恢复对话。
