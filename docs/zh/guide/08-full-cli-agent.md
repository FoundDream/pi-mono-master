# 08 - 完整 CLI Agent

## 大结局：从零到生产级

恭喜你走到了最后一章！

在前七章中，你逐步学习了构建 AI Agent 的核心技术：建立连接、流式输出、自定义工具、会话持久化、确认模式、系统提示词与技能、多会话管理。现在，是时候把这些积木组装成一座完整的建筑了。

本章将构建一个**生产级的 CLI Agent**——它不是教学示例，而是一个你可以真正日常使用的工具。它具备完善的错误处理、优雅的用户体验、可中止的流式输出，以及模块化的代码架构。

如果说前七章是"学习食谱中的每道菜"，那本章就是"用所有菜组成一桌完整的宴席"。

## 功能一览

| 功能                                | 来源章节 | 说明                            |
| ----------------------------------- | -------- | ------------------------------- |
| 从环境变量创建模型                  | 第 01 章 | 支持 Anthropic / OpenAI         |
| 使用 DeltaBatcher 流式输出          | 第 02 章 | 批量处理 delta，终端输出更丝滑  |
| 自定义工具（天气、时间）            | 第 03 章 | 通过 TypeBox 定义的自定义工具   |
| 会话持久化（JSONL）                 | 第 04 章 | 对话历史自动保存和恢复          |
| 工具确认模式                        | 第 05 章 | 危险操作需要用户审批            |
| 系统提示词 + 技能                   | 第 06 章 | 系统级行为控制 + 领域知识注入   |
| 多会话管理                          | 第 07 章 | 创建、切换、列表会话            |
| 编码工具（read、write、edit、bash） | 新增     | Agent 可以读写文件、执行命令    |
| Ctrl+C 中止                         | 新增     | 优雅地中止正在进行的 Agent 回复 |

## 架构概览

在编写代码之前，让我们先从高处俯瞰整个系统的架构。一个良好的架构不是偶然产生的——它是刻意设计的结果。

```
┌─────────────────────────────────────────────────────────────┐
│                        index.ts                              │
│                    (入口 & REPL 循环)                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  用户输入     │  │  Ctrl+C 信号  │  │  readline 接口    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘   │
│         │                  │                                  │
│         ▼                  ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    AgentRuntime                          │ │
│  │                    (runtime.ts)                          │ │
│  │                                                          │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │ │
│  │  │ DeltaBatcher│  │  确认等待器    │  │ 会话生命周期   │  │ │
│  │  │ (输出缓冲)  │  │ (Promise阻塞) │  │ (create/open)  │  │ │
│  │  └─────────────┘  └──────────────┘  └───────────────┘  │ │
│  │                         │                                │ │
│  │                         ▼                                │ │
│  │              ┌────────────────────┐                      │ │
│  │              │  AgentSession      │                      │ │
│  │              │  (pi-coding-agent) │                      │ │
│  │              └────────────────────┘                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    commands.ts                           │ │
│  │                  (命令解析与路由)                          │ │
│  └─────────────────────────────────────────────────────────┘ │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                     tools.ts                             │ │
│  │              (自定义工具定义集合)                           │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 文件职责

```
index.ts      — 主入口，REPL 循环，Ctrl+C 处理
runtime.ts    — AgentRuntime 类（会话生命周期、DeltaBatcher、确认）
tools.ts      — 自定义工具定义
commands.ts   — REPL 命令解析器（/sessions, /new, /open 等）
```

这种分层设计遵循了**关注点分离**（Separation of Concerns）原则：

- **`index.ts`** 只关心"如何与用户交互"（REPL、信号处理）
- **`runtime.ts`** 只关心"如何管理 Agent 的运行时状态"（会话、输出、确认）
- **`tools.ts`** 只关心"Agent 能做什么"（工具定义）
- **`commands.ts`** 只关心"用户的命令如何映射到操作"（命令路由）

:::tip 提示
当你的 Agent 项目变得复杂时，这种模块化分离尤其重要。你可以独立地添加新工具（只改 `tools.ts`）、添加新命令（只改 `commands.ts`）、或优化输出体验（只改 `runtime.ts`），而不用担心影响其他部分。
:::

## 数据流：一条消息的完整旅程

让我们追踪一条用户消息从输入到输出的完整生命周期，以此来深入理解整个系统的运作方式：

```
1. 用户在终端输入: "What's the weather in Tokyo?"
                │
2. readline 捕获输入
                │
3. handleCommand() 检查: 不是 / 命令
                │
4. runtime.prompt("What's the weather in Tokyo?")
                │
5. session.prompt() → 消息发送到 LLM
                │
6. LLM 返回流式响应:
   ├── text_delta: "Let me check"  → DeltaBatcher 缓冲 → 32ms 后刷新到终端
   ├── text_delta: " the weather"  → 合并到缓冲 → 一起刷新
   ├── tool_call: get_weather({city:"Tokyo"})
   │       │
   │       ▼
   │   7. execute() 执行天气查询
   │       │
   │       ▼
   │   8. 返回结果给 LLM
   │       │
   ├── text_delta: "The weather in Tokyo is..."  → DeltaBatcher
   └── complete
                │
9. DeltaBatcher.flush() 输出剩余文本
                │
10. REPL 显示下一个 "You: " 提示符
```

这个流程中有几个精心设计的机制值得深入探讨。

## DeltaBatcher：让终端输出像丝绸一样顺滑

### 问题：为什么需要批量处理？

当 LLM 流式返回文本时，每个 token 都是一个独立的 `text_delta` 事件。如果我们对每个 delta 都立即调用 `process.stdout.write()`，会产生两个问题：

1. **视觉卡顿**：终端的 I/O 开销不是零。频繁的小写入（每次写 1-5 个字符）会导致肉眼可见的逐字蹦出效果，而不是流畅的打字机效果。
2. **系统调用开销**：每次 `write()` 都是一个系统调用。高频小写入比低频大写入的性能差很多。

DeltaBatcher 的解决方案是：**在内存中累积 delta，然后以固定间隔（默认 32ms，约 30fps）刷新到终端。** 这就像视频播放——你不会逐帧渲染每一帧，而是按照固定帧率批量渲染。

```typescript
class DeltaBatcher {
  private pendingText = "";
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly onFlush: (text: string) => void,
    private readonly intervalMs = 32,
  ) {}

  push(delta: string): void {
    this.pendingText += delta;
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        const text = this.pendingText;
        this.pendingText = "";
        if (text) this.onFlush(text);
      }, this.intervalMs);
    }
  }

  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const text = this.pendingText;
    this.pendingText = "";
    if (text) this.onFlush(text);
  }
}
```

### 底层原理

让我们逐步拆解 DeltaBatcher 的工作机制：

1. **`push(delta)`**：每次收到一个 text_delta，文本被追加到 `pendingText` 缓冲区。如果当前没有定时器在运行，就启动一个 32ms 的定时器。

2. **定时器触发**：32ms 后（约一帧的时间），定时器回调将 `pendingText` 中累积的所有文本一次性通过 `onFlush` 输出。在这 32ms 内可能已经累积了多个 delta。

3. **`flush()`**：立即输出所有待处理的文本，无论定时器是否到期。这在 Agent 回复结束时调用，确保最后一批文本不会因为定时器延迟而"丢失"。

关键设计细节：**只在没有活跃定时器时才启动新定时器。** 这意味着第一个 push 启动定时器，后续在 32ms 内的 push 只是往缓冲区追加文本。这确保了精确的 32ms 刷新间隔，而不是每次 push 都重置计时器。

:::tip 提示
32ms 的默认间隔不是随意选的——它对应约 30fps 的刷新率，这是人眼感知"流畅动画"的最低帧率。你可以根据场景调整：较低的值（如 16ms = 60fps）更流畅但开销更大，较高的值（如 100ms）开销更小但可能感觉有延迟。
:::

:::warning 注意
DeltaBatcher 有一个微妙的生命周期问题：如果你在 Agent 回复结束后忘记调用 `flush()`，最后一批文本可能永远不会被显示——因为已经没有新的 delta 来触发下一次刷新了。在 `AgentRuntime` 中，我们在 `complete` 事件中调用 `flush()` 来避免这个问题。
:::

## AgentRuntime：统一的运行时管理器

`AgentRuntime` 是本章的核心——它把前七章学到的所有模式统一封装到一个类中。你可以把它想象成一个"Agent 的操作系统"：它管理会话的创建和切换、控制输出的缓冲和刷新、协调确认流程、处理中止信号。

```typescript
export class AgentRuntime {
  constructor(config: RuntimeConfig) { ... }

  // 确认模式
  createConfirmationWaiter(): () => Promise<{ confirmed: boolean }>
  confirmTool(): void
  cancelTool(): void

  // 发送提示
  async prompt(text: string): Promise<void>
  abort(): void

  // 会话管理
  newSession(): void
  openSession(sessionPath: string): void
  continueRecentSession(): void
  async listSessions(): Promise<SessionInfo[]>

  // 清理
  destroy(): void
}
```

### 方法分组解读

**确认模式方法** —— 来自第 05 章的确认等待器被封装到 Runtime 内部。外部代码只需调用 `confirmTool()` / `cancelTool()`，不需要关心底层的 Promise 机制。

**Prompt 方法** —— `prompt()` 是主要的交互入口。它内部会：(1) 通过 DeltaBatcher 设置输出管道，(2) 调用底层 `session.prompt()`，(3) 在完成后 flush 缓冲区。`abort()` 则中止正在进行的流式输出。

**会话管理方法** —— 来自第 07 章的多会话操作。每个方法内部都会处理 dispose/create 的完整流程。

**`destroy()`** —— 程序退出时调用，释放所有资源：dispose 当前会话、清理确认监听器、停止 DeltaBatcher。

### RuntimeConfig

```typescript
interface RuntimeConfig {
  model: Model<Api>;
  cwd: string;
  sessionDir: string;
  skillsDir?: string;
  systemPrompt: string;
  customTools?: ToolDefinition[];
  includeCodingTools?: boolean;
}
```

注意 `includeCodingTools` 选项——设为 `true` 时，Agent 将获得 `read`、`write`、`edit`、`bash` 等编码工具。这让你的 CLI Agent 瞬间拥有操作文件系统和执行命令的能力，就像 Claude Code 那样。

:::warning 注意
启用编码工具意味着 Agent 可以修改你的文件和执行系统命令。在生产环境中，你应该：(1) 使用确认模式保护危险操作，(2) 通过系统提示词限制 Agent 的操作范围，(3) 考虑在沙箱环境中运行。
:::

## Ctrl+C 中止模式

在 CLI Agent 中，有时 Agent 的回复太长或走偏了方向，用户需要中途打断。Ctrl+C（SIGINT 信号）是最自然的交互方式。

```typescript
import { createModel } from "../../shared/model";
import { AgentRuntime } from "./runtime";
import { weatherTool, createTimeTool, createDangerousTool } from "./tools";
import { handleCommand } from "./commands";

const model = createModel();

const runtime = new AgentRuntime({
  model,
  cwd: process.cwd(),
  sessionDir: SESSION_DIR,
  skillsDir: SKILLS_DIR,
  systemPrompt: "You are a versatile CLI assistant...",
  customTools: [weatherTool, createTimeTool(), createDangerousTool(waiter)],
  includeCodingTools: true,
});

// Ctrl+C 中止
process.on("SIGINT", () => {
  runtime.abort();
  console.log("\n🛑 已中止。");
});

// REPL 循环
const ask = () => {
  rl.question("You: ", async (input) => {
    if (await handleCommand(input.trim(), runtime)) {
      ask();
      return;
    }
    await runtime.prompt(input.trim());
    ask();
  });
};
ask();
```

### 底层原理：abort 是如何工作的？

中止流式输出并不像你想象的那么简单。问题在于：**LLM 的 API 调用是一个长时间运行的 HTTP 流（Server-Sent Events）。** 中止它需要：

1. **取消 HTTP 请求**：通过 `AbortController.abort()` 发送取消信号给底层的 fetch 请求
2. **停止事件处理**：告诉 `session.subscribe()` 的回调忽略后续的 delta 事件
3. **刷新未输出的文本**：调用 `DeltaBatcher.flush()` 确保已收到但未显示的文本被输出
4. **保持会话状态一致**：被中止的回复不应该损坏会话的 JSONL 文件

`pi-coding-agent` 的 `session.abort()` 方法封装了这些复杂性。从外部看，调用 `runtime.abort()` 后，当前的 `prompt()` 调用会尽快返回（通常在几百毫秒内），REPL 回到等待输入的状态。

:::tip 提示
一个优雅的做法是区分"单次 Ctrl+C"和"双击 Ctrl+C"：单次中止当前回复，双击退出程序。很多 CLI 工具（包括 Claude Code）都采用了这种交互模式。你可以通过记录上次 SIGINT 的时间戳来实现。
:::

## 命令

| 命令        | 说明                 |
| ----------- | -------------------- |
| `/sessions` | 列出所有已保存的会话 |
| `/new`      | 创建新会话           |
| `/open <n>` | 打开第 N 个会话      |
| `/continue` | 恢复最近的会话       |
| `/abort`    | 中止当前流式输出     |
| `/help`     | 显示所有命令         |
| `/quit`     | 退出                 |

## 命令处理器

命令处理器被抽取为独立模块，遵循**命令模式**（Command Pattern）：每个 slash 命令映射到一个具体的操作。`handleCommand` 返回 `true` 表示输入已被处理为命令，`false` 表示它是普通的 Agent 消息。

```typescript
export async function handleCommand(
  input: string,
  runtime: AgentRuntime,
): Promise<boolean> {
  if (!input.startsWith("/")) return false;

  switch (input.split(" ")[0]) {
    case "/help":
      printHelp();
      return true;
    case "/sessions" /* 列出会话 */:
      return true;
    case "/new":
      runtime.newSession();
      return true;
    case "/open" /* 按索引打开 */:
      return true;
    case "/continue":
      runtime.continueRecentSession();
      return true;
    case "/abort":
      runtime.abort();
      return true;
    case "/quit":
      runtime.destroy();
      process.exit(0);
    default:
      console.log("未知命令");
      return true;
  }
}
```

这种设计的好处是：添加新命令只需在 `switch` 中加一个 `case`。命令的**发现**（解析斜杠前缀）和**执行**（调用 runtime 方法）被清晰地分开。

:::tip 提示
如果你的命令数量超过 10 个，可以考虑用 Map 替代 switch-case，并从外部注册命令——这就是"命令注册表"模式，很多 CLI 框架（如 Commander.js）都采用了这种设计。
:::

## 运行

```bash
bun run ch08
```

## 试一试

```
You: What time is it?
🔧 get_current_time({})
✅ 完成
Agent: It's 2025-06-15T14:30:00.000Z

You: Read the file package.json
🔧 read({"file_path":"package.json"})
✅ 完成
Agent: Here's the contents of package.json: ...

You: /sessions
  1. [4 条消息, 6/15/2025] What time is it?

You: /new
📝 已创建新会话
```

更多可以尝试的场景：

- 让 Agent 创建一个文件，然后读取验证内容
- 用 Ctrl+C 中止一个冗长的回复
- 在多个会话之间切换，验证上下文隔离
- 触发一个需要确认的危险工具

## 常见错误

**1. Ctrl+C 退出了整个程序而非中止回复**

```typescript
// 错误：默认的 SIGINT 行为是退出进程
// 如果没有注册 handler，Ctrl+C 会直接杀掉程序

// 正确：注册 handler 来拦截信号
process.on("SIGINT", () => {
  runtime.abort();
  // 不调用 process.exit()，所以 REPL 继续运行
});
```

**2. DeltaBatcher 在会话切换后没有重新初始化**

```typescript
// 错误：旧会话的 DeltaBatcher 可能还引用着旧的输出回调
runtime.newSession();
// 如果 DeltaBatcher 没有被正确重置，输出可能混乱

// AgentRuntime 内部应该在 newSession() 中处理这个问题
// 确保你的实现在切换会话时重建 DeltaBatcher
```

**3. 在 `destroy()` 后继续使用 runtime**

```typescript
// 错误：destroy 后所有内部状态已被清理
runtime.destroy();
await runtime.prompt("Hello"); // 可能抛出异常或行为未定义

// 正确：destroy 是终结操作，之后应该退出
runtime.destroy();
process.exit(0);
```

## 下一步：扩展你的 Agent

本教程到此结束，但你的 Agent 之旅才刚刚开始。以下是一些扩展方向的灵感：

### 增强 Agent 能力

| 方向             | 说明                                   | 难度 |
| ---------------- | -------------------------------------- | ---- |
| **Web 搜索工具** | 接入搜索 API，让 Agent 能获取实时信息  | 中等 |
| **代码执行沙箱** | 用 Docker 容器隔离 bash 工具的执行环境 | 较高 |
| **多模态输入**   | 支持图片输入，让 Agent 能理解截图      | 中等 |
| **MCP 协议集成** | 接入 Model Context Protocol 工具服务器 | 中等 |

### 改善用户体验

| 方向              | 说明                             | 难度 |
| ----------------- | -------------------------------- | ---- |
| **Markdown 渲染** | 在终端中渲染 Markdown 格式的回复 | 简单 |
| **语法高亮**      | 对代码块做语法高亮               | 简单 |
| **进度指示器**    | 工具执行时显示旋转动画           | 简单 |
| **Tab 补全**      | 为 slash 命令添加 Tab 补全       | 中等 |

### 进阶架构

| 方向              | 说明                                  | 难度 |
| ----------------- | ------------------------------------- | ---- |
| **多 Agent 协作** | 多个 Agent 协同处理复杂任务           | 较高 |
| **向量记忆**      | 用向量数据库实现长期记忆              | 较高 |
| **GUI 迁移**      | 将 CLI Agent 迁移到 Electron 桌面应用 | 较高 |
| **插件系统**      | 允许第三方开发者编写工具插件          | 较高 |

:::tip 提示
如果你想看一个将这些进阶方向全部实现的真实项目，可以参考 **AirJelly Desktop**（本教程的"母项目"）。它是一个基于 Electron 的 AI 伙伴应用，实现了向量记忆、多 Agent、GUI 工具确认、技能系统等生产级功能。
:::

## 小结

恭喜你完成了整个教程！让我们回顾从第 01 章到第 08 章的完整学习路径：

1. **第 01 章 Hello Agent**：建立 LLM 连接，发送第一条消息
2. **第 02 章 流式输出**：实时显示 AI 回复，提升用户体验
3. **第 03 章 自定义工具**：给 Agent 赋予能力，让它能"做事"而不只是"说话"
4. **第 04 章 会话持久化**：保存对话历史，让 Agent 拥有记忆
5. **第 05 章 确认模式**：AI 安全的最后一道防线，人类保持控制权
6. **第 06 章 系统提示词与技能**：精确控制 Agent 的行为和知识
7. **第 07 章 多会话管理**：上下文隔离，支持多任务并行
8. **第 08 章 完整 CLI Agent**：万法归一，生产级架构

你现在掌握了构建 AI Agent 所需的全部核心模式。接下来，去构建属于你自己的 AI Agent 吧！
