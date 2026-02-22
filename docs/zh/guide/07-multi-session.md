# 07 - 多会话管理

## 为什么需要多会话？

在真实的使用场景中，用户和 AI Agent 的交互不会只有一个话题。你可能早上让 Agent 帮你规划日程，下午让它帮你调试代码，晚上让它帮你写邮件。如果所有对话都堆在一个会话里，会产生两个严重问题：

1. **上下文污染**：Agent 在回答代码问题时，脑子里还装着你早上的日程信息。这不仅浪费 token，还可能让模型"分心"，降低回答质量。
2. **上下文窗口溢出**：每个 LLM 都有上下文窗口限制（如 128K token）。长时间的单会话最终会撞到这个天花板。

多会话管理就像手机上的"多标签页"——每个标签页是一个独立的对话上下文，互不干扰。你可以随时创建新标签、切换标签、回到旧标签继续之前的对话。

本章将教你构建一个支持会话列表、创建、切换的完整多会话 CLI 体验。

## 你将学到

- `SessionManager.list()` —— 枚举所有已保存的会话
- `SessionManager.open()` —— 按路径打开特定会话
- `SessionManager.create()` —— 创建新会话
- `session.dispose()` —— 切换会话前的清理
- 构建多会话 CLI 体验
- 会话生命周期管理的最佳实践

## 会话生命周期

在深入代码之前，让我们先理解一个会话从创建到销毁的完整生命周期：

```
创建 (create)
  │
  ▼
活跃 (active) ←──── 恢复 (open)
  │                    ▲
  │ session.prompt()   │
  │ session.prompt()   │
  │     ...            │
  │                    │
  ▼                    │
挂起 (suspended) ──────┘
  │ session.dispose()
  │
  ▼
持久化 (persisted on disk)
```

关键概念：

- **创建**：`SessionManager.create()` 在磁盘上创建一个新的 JSONL 文件
- **活跃**：Agent 会话正在运行，可以接收 `prompt()` 调用
- **挂起**：调用 `session.dispose()` 后，会话被安全地保存到磁盘，Agent 相关的资源被释放
- **恢复**：`SessionManager.open()` 从磁盘加载一个已有的会话，恢复所有历史消息

:::tip 提示
`dispose()` 这个名字来自"可处置资源"（Disposable Pattern），这是一个在 C#、Java 等语言中广泛使用的资源管理模式。它的含义是："我用完了这个资源，请帮我做必要的清理工作。"在这里，清理工作包括：保存未写入的消息、关闭内部的订阅、释放内存中的对话历史。
:::

## 命令

我们将在 REPL 中实现以下命令：

| 命令 | 说明 |
|------|------|
| `/sessions` | 列出所有已保存的会话及消息数 |
| `/new` | 创建新会话 |
| `/open <n>` | 打开列表中第 N 个会话 |
| `/quit` | 退出 |

## 核心模式

### 列出会话

`SessionManager.list()` 是一个**静态方法**——它不属于任何特定的会话实例，而是扫描指定目录中的所有会话文件：

```typescript
const sessions = await SessionManager.list(process.cwd(), SESSION_DIR)

sessions.forEach((s, i) => {
  const name = s.name || s.firstMessage.slice(0, 50) || '(空)'
  const date = s.modified.toLocaleDateString()
  console.log(`${i + 1}. [${s.messageCount} 条消息, ${date}] ${name}`)
})
```

这里有一个实用的 UX 技巧：我们用 `s.firstMessage.slice(0, 50)` 作为会话的"预览标题"。如果用户没有给会话命名（大多数时候不会），那么第一条消息就是最好的标识——它通常能告诉你这个会话是关于什么的。

### 切换会话

切换会话是多会话管理中最关键（也最容易出错）的操作。核心原则只有一条：**切换前必须 `dispose()` 当前会话。**

```typescript
// 切换到新会话
session.dispose()
sessionManager = SessionManager.create(process.cwd(), SESSION_DIR)
session = await buildSession(sessionManager)

// 切换到已有会话
session.dispose()
sessionManager = SessionManager.open(target.path, SESSION_DIR)
session = await buildSession(sessionManager)
```

### 底层原理：为什么 `dispose()` 是必须的？

想象一下不调用 `dispose()` 会发生什么：

1. **事件订阅泄漏**：旧会话的 `subscribe()` 回调仍然活跃，新会话的文本输出可能会被旧会话的回调拦截
2. **JSONL 文件未完成写入**：`SessionManager` 使用缓冲写入来提高性能，`dispose()` 会触发最终的 flush
3. **内存占用累积**：每个会话对象持有完整的消息历史，不 dispose 意味着内存只增不减

你可以把 `dispose()` 想象成"保存并关闭文档"——你不会在打开新文档之前忘记保存当前的工作。

:::warning 注意
如果在 `session.prompt()` 正在执行时调用 `dispose()`，可能导致未定义行为。最佳实践是：确保当前没有正在进行的 prompt 调用，然后再 dispose。在本章的 REPL 实现中，由于我们使用 `await session.prompt()`，所以可以保证 prompt 完成后再处理下一个命令。
:::

### SessionInfo 字段

`SessionManager.list()` 返回的每个条目包含以下信息：

```typescript
interface SessionInfo {
  path: string          // 会话文件完整路径
  id: string            // 唯一会话 ID
  name?: string         // 用户定义的名称
  created: Date
  modified: Date
  messageCount: number
  firstMessage: string  // 第一条用户消息的预览
}
```

这些字段足以构建一个实用的会话列表 UI。`path` 字段特别重要——它是 `SessionManager.open()` 需要的参数，用来定位并加载特定的会话文件。

## 会话组织的实践建议

在实际应用中，随着会话数量增长，你会需要更好的组织策略：

| 策略 | 适用场景 | 实现方式 |
|------|---------|---------|
| **按时间排序** | 通用场景 | 用 `modified` 字段排序（默认行为） |
| **按主题分组** | 项目管理、客服 | 使用不同的 `SESSION_DIR` |
| **定期清理** | 长期运行的应用 | 删除超过 N 天的会话文件 |
| **限制会话数量** | 资源受限环境 | 保留最近 N 个会话，自动删除最旧的 |

:::tip 提示
在 AirJelly Desktop 中，每个"任务"（Task）都有自己独立的会话目录。这样，关于项目 A 的对话和关于项目 B 的对话被自然地隔离开来。你也可以采用类似的策略——按项目、按用户、或按功能模块创建不同的会话目录。
:::

## 完整代码

```typescript
import * as path from 'node:path'
import * as readline from 'node:readline'
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
  type AgentSession,
  type SessionInfo,
} from '@mariozechner/pi-coding-agent'
import { createModel } from '../../shared/model'

const SESSION_DIR = path.join(import.meta.dirname, '.sessions')
const model = createModel()

// --- 辅助函数 ---

async function createResourceLoader() {
  const rl = new DefaultResourceLoader({
    systemPromptOverride: () => 'You are a helpful assistant. Be concise.',
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
  })
  await rl.reload()
  return rl
}

async function buildSession(sm: SessionManager): Promise<AgentSession> {
  const resourceLoader = await createResourceLoader()
  const { session } = await createAgentSession({
    model,
    tools: [],
    customTools: [],
    sessionManager: sm,
    resourceLoader,
  })
  session.subscribe((event) => {
    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
      process.stdout.write(event.assistantMessageEvent.delta)
    }
  })
  return session
}

// --- 状态 ---

let sessionManager = SessionManager.create(process.cwd(), SESSION_DIR)
let session = await buildSession(sessionManager)
let cachedSessions: SessionInfo[] = []

// --- 带命令的 REPL ---

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

const ask = () => {
  rl.question('You: ', async (input) => {
    const trimmed = input.trim()

    if (trimmed === '/sessions') {
      cachedSessions = await SessionManager.list(process.cwd(), SESSION_DIR)
      cachedSessions.forEach((s, i) => {
        const name = s.name || s.firstMessage.slice(0, 50) || '(空)'
        console.log(`  ${i + 1}. [${s.messageCount} 条消息] ${name}`)
      })
      ask(); return
    }

    if (trimmed === '/new') {
      session.dispose()
      sessionManager = SessionManager.create(process.cwd(), SESSION_DIR)
      session = await buildSession(sessionManager)
      console.log('📝 已创建新会话\n')
      ask(); return
    }

    if (trimmed.startsWith('/open ')) {
      const idx = parseInt(trimmed.split(' ')[1]) - 1
      if (cachedSessions[idx]) {
        session.dispose()
        sessionManager = SessionManager.open(cachedSessions[idx].path, SESSION_DIR)
        session = await buildSession(sessionManager)
        console.log(`📂 已打开会话 ${idx + 1}\n`)
      }
      ask(); return
    }

    if (trimmed === '/quit') { rl.close(); process.exit(0) }
    if (!trimmed) { ask(); return }

    process.stdout.write('\nAgent: ')
    await session.prompt(trimmed)
    console.log('\n')
    ask()
  })
}

ask()
```

### 代码解读

让我们关注几个重要的设计决策：

**1. `buildSession` 辅助函数**

每次切换会话都需要：创建资源加载器 → 创建 Agent 会话 → 订阅事件。我们把这些步骤封装成 `buildSession()` 函数，避免重复代码。这也保证了每次会话切换的一致性——你不会因为漏掉某一步而产生 bug。

**2. `cachedSessions` 缓存**

注意 `/sessions` 命令会把结果存到 `cachedSessions` 中，而 `/open <n>` 命令从这个缓存中读取。这样设计的原因是：用户通常会先 `/sessions` 看列表，然后根据列表编号 `/open 3`。如果每次 `/open` 都重新扫描文件系统，可能因为并发写入导致列表顺序变化，用户打开的会话不是他们看到的那个。

**3. `let` 而非 `const` 声明状态**

`sessionManager` 和 `session` 被声明为 `let`，因为它们需要在切换时被重新赋值。这是多会话管理中不可避免的可变状态——每次切换会话，旧的 session 对象被 dispose，新的 session 对象取而代之。

## 运行

```bash
bun run ch07
```

## 试一试

1. 和 Agent 聊点什么（例如："My name is Alice, and I'm working on Project X"）
2. 运行 `/new` 创建新会话
3. 聊不同的话题（例如："Tell me about TypeScript generics"）
4. 运行 `/sessions` 查看两个会话
5. 运行 `/open 1` 切回第一个会话
6. 问 "What was I working on?" —— Agent 记住了第一段对话！

这个体验揭示了多会话的核心价值：**上下文隔离 + 上下文持久化**。每个会话有自己独立的记忆，不受其他会话的干扰，而且即使在会话之间切换也不会丢失任何信息。

## 常见错误

**1. 忘记在切换前 `dispose()`**

```typescript
// 错误：直接创建新会话，旧会话的资源泄漏
sessionManager = SessionManager.create(process.cwd(), SESSION_DIR)
session = await buildSession(sessionManager)

// 正确：先 dispose 旧会话
session.dispose()
sessionManager = SessionManager.create(process.cwd(), SESSION_DIR)
session = await buildSession(sessionManager)
```

**2. `/open` 使用了过期的会话列表**

```typescript
// 潜在问题：如果两次 /open 之间创建了新会话，缓存可能过期
// 建议：在 /new 之后清空缓存
if (trimmed === '/new') {
  session.dispose()
  sessionManager = SessionManager.create(process.cwd(), SESSION_DIR)
  session = await buildSession(sessionManager)
  cachedSessions = []  // 清空缓存，强制用户重新 /sessions
}
```

**3. 在 prompt 执行期间切换会话**

```typescript
// 危险：如果 prompt 还在执行，dispose 可能导致问题
// 在 GUI 应用中，应该先 abort() 再 dispose()
session.abort()
session.dispose()
```

## 小结

本章的核心收获：

1. **多会话是专业 Agent 应用的标配**——它解决了上下文污染和上下文窗口溢出两个核心问题
2. **`SessionManager` 提供了完整的会话 CRUD 操作**——`create()`、`open()`、`list()` 覆盖了所有常见场景
3. **`dispose()` 是会话切换的必要步骤**——它确保旧会话的资源被正确释放，类似于"保存并关闭文档"
4. **会话状态用 `let` 管理是合理的**——多会话管理本质上涉及可变状态，关键是确保状态转换的原子性
5. **缓存会话列表避免了竞态条件**——用户看到的列表和打开的会话保持一致

## 下一章

[第 08 章：完整 CLI Agent](/zh/guide/08-full-cli-agent) —— 将所有内容整合为生产级 Agent。
