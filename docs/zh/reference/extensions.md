# 扩展

扩展是 TypeScript 模块，可以在运行时增强 Pi 的能力。扩展可以添加自定义工具、注入系统提示、注册 Provider、控制会话行为等。

## 概述

扩展是导出默认函数的 TypeScript 文件，该函数接收 `ExtensionContext` 参数并注册事件监听器和功能。

:::warning
扩展以完整的系统权限运行。只安装你信任的扩展，因为它们可以执行任意代码、访问文件系统和网络。
:::

## 放置位置

| 位置 | 作用域 | 说明 |
|------|--------|------|
| `~/.pi/agent/extensions/*.ts` | 全局 | 所有项目生效 |
| `.pi/extensions/*.ts` | 项目级 | 仅当前项目生效 |
| 包中的扩展 | 依赖包 | 通过 `pi install` 安装 |

扩展支持热重载：修改文件后 Pi 会自动重新加载扩展，无需重启。

## 基础结构

扩展必须使用 `default export` 导出一个函数：

```typescript
import { ExtensionContext } from "@anthropic-ai/pi";

export default (ctx: ExtensionContext) => {
  // 在此注册事件监听器、工具等
};
```

## 事件系统

Pi 提供丰富的事件系统，扩展可以监听各种生命周期事件：

### 会话事件

```typescript
export default (ctx: ExtensionContext) => {
  // 会话开始时触发
  ctx.on("session:start", (event) => {
    console.log("Session started:", event.sessionId);
  });

  // 会话结束时触发
  ctx.on("session:end", (event) => {
    console.log("Session ended:", event.sessionId);
  });
};
```

### 消息事件

```typescript
export default (ctx: ExtensionContext) => {
  // 用户消息发送前
  ctx.on("message:beforeSend", (event) => {
    console.log("User message:", event.message);
  });

  // 模型响应完成后
  ctx.on("message:afterResponse", (event) => {
    console.log("Model response:", event.response);
  });
};
```

### 工具事件

```typescript
export default (ctx: ExtensionContext) => {
  // 工具执行前
  ctx.on("tool:beforeExecute", (event) => {
    console.log("Tool call:", event.toolName, event.args);
  });

  // 工具执行后
  ctx.on("tool:afterExecute", (event) => {
    console.log("Tool result:", event.result);
  });
};
```

### 所有事件类别

| 事件类别 | 事件名称 | 说明 |
|----------|----------|------|
| 会话 | `session:start` | 会话开始 |
| 会话 | `session:end` | 会话结束 |
| 消息 | `message:beforeSend` | 消息发送前 |
| 消息 | `message:afterResponse` | 收到响应后 |
| 工具 | `tool:beforeExecute` | 工具执行前 |
| 工具 | `tool:afterExecute` | 工具执行后 |
| 压缩 | `compaction:before` | 上下文压缩前 |
| 压缩 | `compaction:after` | 上下文压缩后 |
| 通知 | `notification:received` | 收到通知 |

## 自定义工具

扩展可以通过 `registerTool` 注册新的工具，供模型在对话中调用：

```typescript
import { ExtensionContext } from "@anthropic-ai/pi";
import { Type } from "@sinclair/typebox";

export default (ctx: ExtensionContext) => {
  ctx.registerTool({
    name: "get_weather",
    description: "Get current weather for a location",
    input: Type.Object({
      location: Type.String({ description: "City name or coordinates" }),
      units: Type.Optional(
        Type.Union([Type.Literal("celsius"), Type.Literal("fahrenheit")], {
          description: "Temperature units",
          default: "celsius",
        })
      ),
    }),
    async execute({ location, units }) {
      const response = await fetch(
        `https://api.weather.example.com/current?q=${encodeURIComponent(location)}&units=${units}`
      );
      const data = await response.json();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  });
};
```

### 工具输入校验

工具参数使用 [TypeBox](https://github.com/sinclairzx81/typebox) 定义 JSON Schema，确保类型安全和运行时验证。

### 工具返回格式

工具 `execute` 函数必须返回包含 `content` 数组的对象：

```typescript
return {
  content: [
    { type: "text", text: "文本结果" },
    { type: "image", data: base64String, mimeType: "image/png" },
  ],
};
```

## UI 集成

扩展可以通过 `ctx.ui` 与终端界面交互：

```typescript
export default (ctx: ExtensionContext) => {
  // 显示通知
  ctx.ui.notify("Extension loaded successfully");

  // 显示进度
  const progress = ctx.ui.createProgress("Processing files...");
  progress.update(50, "Halfway done...");
  progress.complete("Done!");
};
```

## 状态管理

扩展可以使用持久化状态在会话之间保存数据：

```typescript
export default (ctx: ExtensionContext) => {
  // 读取状态
  const state = ctx.state.get("myExtension") ?? { counter: 0 };

  // 更新状态
  state.counter++;
  ctx.state.set("myExtension", state);
};
```

## 消息注入

扩展可以在发送给模型的消息中注入额外上下文：

```typescript
export default (ctx: ExtensionContext) => {
  ctx.on("message:beforeSend", (event) => {
    // 注入系统消息
    event.addSystemMessage(
      "Always respond in formal English when discussing technical topics."
    );
  });
};
```

## 会话控制

扩展可以控制会话的各个方面：

```typescript
export default (ctx: ExtensionContext) => {
  // 设置自定义系统提示前缀
  ctx.setSystemPromptPrefix("You are a specialized code reviewer.");

  // 配置工具权限
  ctx.setToolPermissions({
    bash: { requireConfirmation: true },
    write: { requireConfirmation: false },
  });
};
```

## Provider 注册

扩展可以编程式注册自定义 Provider：

```typescript
import { pi, ExtensionContext } from "@anthropic-ai/pi";

export default (ctx: ExtensionContext) => {
  pi.registerProvider({
    name: "my-local-llm",
    baseUrl: "http://localhost:8080/v1",
    api: "openai-completions",
    models: {
      "local-model": {
        name: "Local Model",
        contextWindow: 32768,
        maxTokens: 4096,
      },
    },
  });
};
```

详情请参阅[自定义 Provider](./custom-provider) 文档。

## 错误处理

扩展应妥善处理错误以避免中断 Pi 的运行：

```typescript
export default (ctx: ExtensionContext) => {
  ctx.registerTool({
    name: "risky_operation",
    description: "An operation that might fail",
    input: Type.Object({
      target: Type.String(),
    }),
    async execute({ target }) {
      try {
        const result = await performOperation(target);
        return {
          content: [{ type: "text", text: result }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  });
};
```

未捕获的扩展错误会被 Pi 拦截并记录，但不会崩溃整个应用。

## 模式兼容性

扩展应考虑 Pi 的不同运行模式：

| 模式 | 说明 | 注意事项 |
|------|------|----------|
| 交互模式 | 标准对话模式 | 所有功能可用 |
| 非交互模式 | 管道/脚本模式 | UI 交互不可用 |
| 无头模式 | 无终端界面 | 仅工具和消息事件有效 |

```typescript
export default (ctx: ExtensionContext) => {
  if (ctx.mode === "interactive") {
    // 仅在交互模式下注册 UI 相关功能
    ctx.ui.notify("Extension ready");
  }

  // 工具和事件监听在所有模式下都有效
  ctx.registerTool({
    /* ... */
  });
};
```
