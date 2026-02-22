# 04 - 会话持久化

使用 JSONL 会话文件保存和恢复对话。

## 为什么会话持久化不可或缺？

在前三章中，我们的 Agent 都有一个致命的缺陷：**一旦程序退出，所有对话记忆都会消失**。你告诉 Agent 你叫什么名字，关掉程序再打开，它就全忘了。

这是因为 LLM（大语言模型）本身是**无状态的**。每次你调用 AI 模型的 API，它都像是一个全新的个体 —— 不记得之前说过什么、做过什么。我们在前面章节中感受到的"多轮对话"能力，实际上是框架在每次 API 调用时把**完整的对话历史**作为上下文一起发送给模型。

用一个类比来说：LLM 就像一个"失忆症患者"，每次醒来都不记得之前的事。而**会话持久化**就是它的"日记本" —— 每次对话都记录下来，下次醒来先翻翻日记，就能"想起"之前发生了什么。

在这一章中，你将学会如何使用 `SessionManager` 的持久化功能，将对话历史保存到磁盘上的 JSONL 文件中，并在程序重启后恢复。

## 你将学到

- `SessionManager.create()` —— 创建新的持久化会话
- `SessionManager.continueRecent()` —— 恢复最近的会话
- 会话如何以 JSONL 文件存储在 `.sessions/` 目录
- 使用 `readline` 构建 REPL 循环
- Agent 在恢复会话后能记住上下文

## 核心概念

| 方法 | 说明 |
|------|------|
| `SessionManager.create(cwd, dir)` | 创建新会话，写入 `dir/` 目录 |
| `SessionManager.continueRecent(cwd, dir)` | 查找并恢复最新的会话 |
| `sessionManager.buildSessionContext()` | 返回当前会话的 `{ messages }` |
| `sessionManager.getSessionFile()` | JSONL 文件的路径 |

### 会话的三种生命状态

```
┌─────────────┐     程序退出       ┌──────────────┐     continueRecent()    ┌──────────────┐
│  创建新会话  │ ──────────────→   │ JSONL 文件    │ ─────────────────────→ │  恢复旧会话  │
│  (create)   │   自动保存到磁盘   │ 存储在磁盘上  │   从文件加载消息历史   │  (continue)  │
└─────────────┘                   └──────────────┘                        └──────────────┘
      ↕                                                                         ↕
   prompt()                                                                  prompt()
   subscribe()                                                               subscribe()
```

### 为什么选择 JSONL 格式？

`pi-coding-agent` 使用 **JSONL（JSON Lines）**格式来存储会话数据 —— 每一行是一个独立的 JSON 对象，代表对话中的一条消息。

为什么不用普通的 JSON 文件或数据库？JSONL 有几个独特的优势：

1. **追加友好（append-friendly）**：新消息直接追加到文件末尾，不需要读取、解析、修改整个文件再写回。这对于实时对话场景非常重要 —— 每条消息都能立即持久化，即使程序崩溃也不会丢失之前的对话
2. **流式读取**：可以一行一行地读取和解析，不需要将整个文件加载到内存中。对于很长的对话历史，这比解析一个巨大的 JSON 数组要高效得多
3. **简单调试**：用任何文本编辑器就能查看和理解会话内容，每行就是一条完整的消息

```jsonl
{"role":"system","content":"You are a helpful assistant."}
{"role":"user","content":"My name is Alice"}
{"role":"assistant","content":"Hello Alice! Nice to meet you."}
{"role":"user","content":"What's my name?"}
{"role":"assistant","content":"Your name is Alice!"}
```

:::tip 提示
你可以直接用 `cat` 或任何文本编辑器打开 `.sessions/` 目录下的 JSONL 文件来查看对话历史。这对调试 Agent 的行为非常有帮助 —— 你可以看到 AI 实际收到了什么上下文。
:::

## 完整代码

```typescript
import * as path from 'node:path'
import * as readline from 'node:readline'
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
} from '@mariozechner/pi-coding-agent'
import { createModel } from '../../shared/model'

const SESSION_DIR = path.join(import.meta.dirname, '.sessions')
const model = createModel()

// 根据 CLI 参数决定会话策略
const arg = process.argv[2] // 'continue' 或 undefined

let sessionManager: SessionManager
if (arg === 'continue') {
  sessionManager = SessionManager.continueRecent(process.cwd(), SESSION_DIR)
  const ctx = sessionManager.buildSessionContext()
  console.log(`📂 已恢复会话（${ctx.messages.length} 条历史消息）`)
  console.log(`   会话文件: ${sessionManager.getSessionFile()}\n`)
} else {
  sessionManager = SessionManager.create(process.cwd(), SESSION_DIR)
  console.log('📝 已创建新会话')
  console.log(`   会话文件: ${sessionManager.getSessionFile()}\n`)
}

const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => 'You are a helpful assistant. Be concise. Remember our conversation context.',
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
})
await resourceLoader.reload()

const { session } = await createAgentSession({
  model,
  tools: [],
  customTools: [],
  sessionManager,
  resourceLoader,
})

// 流式输出
session.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    process.stdout.write(event.assistantMessageEvent.delta)
  }
})

// REPL 循环
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

console.log('输入你的消息（或 /quit 退出）:\n')

const ask = () => {
  rl.question('You: ', async (input) => {
    const trimmed = input.trim()
    if (trimmed === '/quit' || trimmed === '/exit') {
      console.log('\n再见！你的会话已保存。')
      rl.close()
      process.exit(0)
    }
    if (!trimmed) {
      ask()
      return
    }

    process.stdout.write('\nAgent: ')
    await session.prompt(trimmed)
    console.log('\n')
    ask()
  })
}

ask()
```

## 逐步解析

### 1. 会话策略：创建 vs. 恢复

程序启动时，根据命令行参数决定是创建新会话还是恢复已有会话：

```typescript
// 新会话 —— 创建一个新的 JSONL 文件
sessionManager = SessionManager.create(process.cwd(), SESSION_DIR)

// 恢复 —— 查找最新的会话文件并加载其消息
sessionManager = SessionManager.continueRecent(process.cwd(), SESSION_DIR)
```

`SessionManager.create()` 接收两个参数：
- **`cwd`**（当前工作目录）—— 作为会话的上下文路径，某些内置工具（如文件操作）会使用它
- **`dir`**（会话目录）—— JSONL 文件将存储在这个目录下

`SessionManager.continueRecent()` 会在指定目录中找到**最新的**会话文件并加载它。"最新"的判断依据是文件的修改时间。

### 2. 查看恢复的上下文

```typescript
const ctx = sessionManager.buildSessionContext()
console.log(`📂 已恢复会话（${ctx.messages.length} 条历史消息）`)
```

`buildSessionContext()` 返回一个包含 `messages` 数组的对象。这个数组就是从 JSONL 文件中加载的完整对话历史。当你把这个 `sessionManager` 传给 `createAgentSession()` 时，框架会自动将这些历史消息作为上下文发送给 AI 模型。

### 3. REPL 循环

REPL（Read-Eval-Print Loop）是命令行交互程序的经典模式。我们使用 Node.js 内置的 `readline` 模块来实现：

```typescript
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const ask = () => {
  rl.question('You: ', async (input) => {
    // 处理输入...
    await session.prompt(trimmed)
    ask()  // 递归调用，实现循环
  })
}

ask()
```

这里使用了**递归模式**来实现循环：每次用户输入后，处理完响应再次调用 `ask()`。这比 `while` 循环更适合 Node.js 的异步模型。

### 4. 会话文件的结构

会话以 JSONL（JSON Lines）文件存储在 `.sessions/` 目录中。每一行是一个序列化的消息条目，保存完整的对话历史。

```
chapters/04-session-persistence/.sessions/
├── session-abc123.jsonl
└── session-def456.jsonl
```

每个会话文件的文件名包含唯一标识符，确保多个会话不会冲突。

## 底层原理：持久化是如何工作的？

当你通过持久化的 `SessionManager` 调用 `session.prompt()` 时，框架会自动执行以下步骤：

1. **追加用户消息** —— 将用户的输入作为新的一行写入 JSONL 文件
2. **构建完整上下文** —— 从文件中读取所有消息，加上系统提示词，发送给 AI 模型
3. **流式接收响应** —— 像之前一样通过事件传递 AI 的回答
4. **追加助手消息** —— AI 回答完成后，将完整的回答也追加到 JSONL 文件

整个过程对你来说是**透明的** —— 你的代码和前面章节完全一样，只是把 `SessionManager.inMemory()` 换成了 `SessionManager.create()`。这就是良好抽象的力量。

```
┌─────────────────────────────────────────────┐
│                JSONL 文件                    │
│                                             │
│  第 1 次对话:                                │
│  {"role":"user","content":"我叫 Alice"}      │
│  {"role":"assistant","content":"你好!"}       │
│                                             │
│  第 2 次对话（续写）:                          │
│  {"role":"user","content":"我叫什么？"}        │
│  {"role":"assistant","content":"你叫 Alice!"} │
│                                             │
│  ← 每条消息即时追加，不需要重写整个文件          │
└─────────────────────────────────────────────┘
```

## 常见错误

### `.sessions/` 目录不存在

`SessionManager.create()` 通常会自动创建目录，但如果遇到权限问题，你需要手动创建：

```bash
mkdir -p chapters/04-session-persistence/.sessions
```

### `continueRecent` 找不到会话

如果 `.sessions/` 目录为空或不存在，`continueRecent()` 会抛出错误。在生产环境中，你应该先检查是否有可恢复的会话，如果没有则创建新会话：

```typescript
try {
  sessionManager = SessionManager.continueRecent(process.cwd(), SESSION_DIR)
} catch {
  console.log('没有找到可恢复的会话，创建新会话...')
  sessionManager = SessionManager.create(process.cwd(), SESSION_DIR)
}
```

### 上下文窗口溢出

随着对话越来越长，JSONL 文件中的消息越来越多，总 token 数可能超过模型的**上下文窗口**限制（比如 Claude Sonnet 的 200K token，GPT-4o 的 128K token）。当这种情况发生时，API 调用会失败。

:::warning 注意
在生产环境中，你需要实现**对话截断**或**摘要**策略 —— 当消息总量接近上下文窗口限制时，删除最早的消息或将它们压缩成摘要。`pi-coding-agent` 框架在底层会处理部分截断逻辑，但对于超长对话，你可能需要自行管理。
:::

## 生产环境建议

如果你要将会话持久化用于生产环境，以下是一些重要的建议：

1. **会话清理策略**：定期清理过期的会话文件，避免磁盘空间无限增长。可以基于文件修改时间设置过期策略（如 30 天未活跃的会话自动删除）

2. **并发安全**：JSONL 的追加写入在单进程中是安全的，但如果多个进程同时写入同一个会话文件，可能会导致数据损坏。确保每个会话文件同一时间只有一个进程在写入

3. **敏感信息**：会话文件包含完整的对话内容，可能包含用户的敏感信息。确保 `.sessions/` 目录有适当的文件系统权限，不要将其纳入版本控制

4. **备份**：对于重要的会话数据，考虑定期备份到安全的存储位置

:::tip 提示
在开发阶段，经常查看 `.sessions/` 目录下的 JSONL 文件是一个好习惯。它能帮你理解 Agent 实际看到的上下文是什么，对调试 Agent 的异常行为非常有帮助。
:::

## 运行

```bash
# 启动新会话（交互式 REPL）
bun run ch04

# 恢复上一个会话
bun run ch04 continue
```

## 试一试

这是一个验证持久化是否正常工作的简单实验：

1. 运行 `bun run ch04`，告诉 Agent："My name is Alice"
2. 等 Agent 回复后，输入 `/quit` 退出
3. 运行 `bun run ch04 continue`，问："What's my name?"
4. 如果一切正常，Agent 应该回答 "Alice" —— 它"记住"了！

这个实验清楚地展示了会话持久化的效果：即使程序完全退出重启，Agent 仍然能访问之前的对话上下文。

你还可以进一步实验：
- 查看 `.sessions/` 目录下生成的 JSONL 文件内容
- 多次恢复同一个会话，观察历史消息数量的增长
- 尝试不带 `continue` 参数重新运行，验证新会话确实不记得之前的对话

## 小结

在这一章中，你学到了：

- **LLM 是无状态的** —— 它本身不记得任何对话历史，"记忆"是通过每次发送完整上下文实现的
- **会话持久化的本质** —— 将对话历史保存到文件，下次启动时重新加载作为上下文
- **JSONL 格式的优势** —— 追加友好、流式读取、易于调试
- **`SessionManager` 的两种模式** —— `create()` 创建新会话，`continueRecent()` 恢复最近的会话
- **REPL 循环的实现** —— 使用 `readline` + 递归调用实现命令行交互
- **生产环境的注意事项** —— 上下文窗口限制、并发安全、敏感信息保护

会话持久化让 Agent 从"金鱼记忆"进化到了"长期记忆"。但有了记忆和工具的 Agent，如果不加约束，可能会执行一些危险的操作。在下一章中，我们将学习**确认模式** —— 让 Agent 在执行关键操作前先征得用户的同意。

## 下一章

[第 05 章：确认模式](/zh/guide/05-confirmation-pattern) —— 在执行危险操作前要求用户确认。
