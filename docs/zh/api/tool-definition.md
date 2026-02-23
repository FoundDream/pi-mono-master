# ToolDefinition

`@mariozechner/pi-coding-agent` 的 `ToolDefinition` 接口定义了 Agent 可以调用的自定义工具。

## 接口

```typescript
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
```

| 字段          | 类型       | 说明                                          |
| ------------- | ---------- | --------------------------------------------- |
| `name`        | `string`   | LLM 工具调用中使用的名称（使用 `snake_case`） |
| `label`       | `string`   | 人类可读的标签                                |
| `description` | `string`   | 给 LLM 的描述，帮助它决定何时使用该工具       |
| `parameters`  | `TObject`  | 定义接受参数的 TypeBox Schema                 |
| `execute`     | `Function` | LLM 调用工具时执行的异步函数                  |

## Execute 签名

```typescript
execute: async (
  toolCallId: string, // 此次工具调用的唯一 ID
  params: Record<string, any>, // 匹配 Schema 的已解析参数
  signal?: AbortSignal, // 用于取消的中止信号
  onUpdate?: Function, // 进度更新回调
) => {
  return {
    content: [{ type: "text", text: "..." }],
    details: {},
  };
};
```

### 返回值

```typescript
{
  content: Array<{ type: 'text'; text: string } | { type: 'image'; ... }>
  details: Record<string, any>
}
```

## 参数 Schema

工具使用 `@sinclair/typebox`（不是 Zod）定义参数：

```typescript
import { Type } from "@sinclair/typebox";

// 字符串参数
Type.String({ description: "City name" });

// 数字参数
Type.Number({ description: "Temperature in Celsius" });

// 枚举参数
Type.Union([Type.Literal("celsius"), Type.Literal("fahrenheit")], {
  description: "Temperature unit",
});

// 可选参数
Type.Optional(Type.String({ description: "Optional note" }));

// 多字段对象
Type.Object({
  city: Type.String({ description: "City name" }),
  unit: Type.Optional(
    Type.String({ description: "Unit (celsius/fahrenheit)" }),
  ),
});
```

## 最简示例

```typescript
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

const greetTool: ToolDefinition = {
  name: "greet",
  label: "Greet",
  description: "Greet a person by name.",
  parameters: Type.Object({
    name: Type.String({ description: "Person name" }),
  }),
  execute: async (_toolCallId, params) => {
    const { name } = params as { name: string };
    return {
      content: [{ type: "text" as const, text: `Hello, ${name}!` }],
      details: {},
    };
  },
};
```

## 带确认的工具

对于危险操作，接受一个 `waitForConfirmation` 回调：

```typescript
function createDangerousTool(
  waitForConfirmation: () => Promise<{ confirmed: boolean }>,
): ToolDefinition {
  return {
    name: "dangerous_action",
    label: "Dangerous Action",
    description: "Requires user confirmation before executing.",
    parameters: Type.Object({
      action: Type.String({ description: "Action to perform" }),
    }),
    execute: async (_toolCallId, params) => {
      const { action } = params as { action: string };

      console.log(`⚠️  确认: ${action} [y/N]`);
      const { confirmed } = await waitForConfirmation();

      if (!confirmed) {
        return {
          content: [{ type: "text" as const, text: "Cancelled by user." }],
          details: {},
        };
      }

      return {
        content: [{ type: "text" as const, text: `Done: ${action}` }],
        details: {},
      };
    },
  };
}
```

详见 [第 05 章：确认模式](/zh/guide/05-confirmation-pattern)。

## 注册工具

将自定义工具传递给 `createAgentSession()`：

```typescript
const { session } = await createAgentSession({
  model,
  tools: [],                        // 内置编码工具（空 = 无）
  customTools: [greetTool, ...],    // 你的自定义工具
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
})
```

## 工具事件

工具执行时，会话会发出你可以监听的事件：

```typescript
session.subscribe((event) => {
  if (event.type === "tool_execution_start") {
    console.log(`🔧 ${event.toolName}(${JSON.stringify(event.args)})`);
  }
  if (event.type === "tool_execution_end") {
    console.log(`✅ 结果: ${JSON.stringify(event.result)}`);
  }
});
```

详见 [第 03 章：自定义工具](/zh/guide/03-custom-tools)。
