# 05 - 确认模式

## 为什么需要确认模式？

想象一下：你让 AI 助手帮你整理文件，它理解了你的意图——但理解得有点"过于积极"，直接把你重要的工作文件删了。或者，你让它帮忙发一封邮件，它在你还没检查内容的情况下就直接发了出去。

这就是 **人机协作（Human-in-the-Loop）** 模式要解决的核心问题。

在 AI Agent 的世界里，有一条至关重要的原则：**AI 可以建议，但不可代替人类做不可逆的决策。** 确认模式就是这一原则的代码实现——它在"AI 决策"和"实际执行"之间插入了一道人工审核的关卡。

这个模式广泛应用于生产级 AI Agent 中：
- **Claude Code** 在执行 bash 命令前会请求用户确认
- **GitHub Copilot Workspace** 在修改文件前需要用户审批
- **AirJelly Desktop** 在创建日历事件、设置提醒等操作时都会弹出确认对话框

本章将教你构建一个优雅的、基于 Promise 阻塞的确认机制。

## 你将学到

- 如何创建"确认等待器" —— 一个返回阻塞 Promise 的函数
- 如何将它接入工具的 `execute()` 使危险操作需要用户审批
- 生产环境中用于日历事件、提醒、文件操作等的模式
- 确认模式的安全性考量和 UX 设计原则

## 工作原理

让我们先从全局视角理解确认模式的数据流：

```
用户: "Delete /tmp/old.log"
  → Agent 调用 delete_file 工具
    → execute() 打印警告并调用 waitForConfirmation()
    → Promise 阻塞，直到用户输入 'y' 或 'n'
    → 如果 'y': 执行操作，返回成功
    → 如果 'n': 返回 "用户已取消"，Agent 确认
```

关键洞察：**整个 Agent 的执行链被"暂停"了。** `session.prompt()` 返回的 Promise 不会 resolve，因为工具的 `execute()` 函数内部在 `await` 一个尚未 resolve 的 Promise。这就像在高速公路上设了一个收费站——所有车辆必须停下来刷卡才能通过。

:::tip 提示
确认模式之所以有效，是因为 `pi-coding-agent` 的工具执行是 **异步的**。`execute()` 函数返回 Promise，框架会 `await` 这个 Promise。我们只需要确保这个 Promise 在用户确认前不会 resolve，整个 Agent 的执行链就自然而然地被阻塞了。
:::

## 确认等待器模式

核心模式 —— 一个创建阻塞 Promise 的工厂函数，通过 stdin 输入来 resolve：

```typescript
function createConfirmationWaiter() {
  let pendingResolve: ((v: { confirmed: boolean }) => void) | null = null

  const waiter = (): Promise<{ confirmed: boolean }> =>
    new Promise((resolve) => {
      pendingResolve = resolve
    })

  // 监听 stdin 输入来 resolve 待确认的 Promise
  const stdinListener = (data: Buffer) => {
    if (pendingResolve) {
      const input = data.toString().trim().toLowerCase()
      const confirmed = input === 'y' || input === 'yes'
      pendingResolve({ confirmed })
      pendingResolve = null
    }
  }
  process.stdin.on('data', stdinListener)

  return { waiter, cleanup: () => process.stdin.off('data', stdinListener) }
}
```

### 底层原理

这段代码的精髓在于 **闭包 + Promise 的组合**。让我们逐步拆解：

1. **`pendingResolve` 变量**：这是一个"悬空的 resolve 函数"。当 `waiter()` 被调用时，一个新的 Promise 被创建，但它的 `resolve` 函数被存到了外部变量中，而不是立即调用。此时 Promise 处于 **pending** 状态——它既不成功也不失败，只是在等待。

2. **`stdinListener` 监听器**：这是另一半拼图。它持续监听用户输入，当用户按下回车时，它检查是否有"悬空的 resolve 函数"。如果有，它调用 `pendingResolve({ confirmed: true/false })` 来 resolve 那个 Promise。

3. **`cleanup` 函数**：移除 stdin 监听器，防止内存泄漏。

你可以把它想象成一个"接力赛"：
- `waiter()` 创建了一个接力棒（Promise），但接力棒需要有人来接（resolve）
- `stdinListener` 是等在跑道另一端的队友，当用户输入到来时，它接过接力棒完成这一棒

:::warning 注意
`pendingResolve` 在被调用后会被设为 `null`。这是为了防止同一个 Promise 被 resolve 两次。如果用户快速连续输入两次，只有第一次输入会生效。这是一个重要的防御性编程细节。
:::

## 方案对比：为什么选择 Promise 阻塞？

在设计确认机制时，有几种常见方案：

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Promise 阻塞（本章）** | 代码简洁，工具内部自包含 | 阻塞了整个 Agent 执行 |
| **回调 + 状态机** | 不阻塞主线程 | 代码复杂，状态管理困难 |
| **事件驱动 + 队列** | 可并发处理多个确认 | 过度设计，CLI 场景不需要 |
| **超时自动拒绝** | 防止无限等待 | 用户可能错过确认窗口 |

对于 CLI Agent 来说，Promise 阻塞方案是最优选择：它简单、直观，而且恰好符合 CLI 的单线程交互模型——用户同一时间只能回答一个问题。

:::tip 提示
如果你在构建 GUI 应用（如 AirJelly Desktop），则需要更复杂的方案：通过 IPC 将确认请求发送到渲染进程，在 UI 上弹出确认对话框，再将结果通过 IPC 返回。但底层的 Promise 阻塞原理是完全一样的。
:::

## 示例：删除文件工具

现在让我们看看如何将确认等待器接入到具体的工具中。注意 `waitForConfirmation` 是通过参数注入的——这是**依赖注入**模式，让工具的定义和确认机制解耦：

```typescript
import { Type } from '@sinclair/typebox'
import type { ToolDefinition } from '@mariozechner/pi-coding-agent'

export function createDeleteFileTool(
  waitForConfirmation: () => Promise<{ confirmed: boolean }>
): ToolDefinition {
  return {
    name: 'delete_file',
    label: 'Delete File',
    description: 'Delete a file at the given path. This is irreversible and requires user confirmation.',
    parameters: Type.Object({
      path: Type.String({ description: 'File path to delete' }),
      reason: Type.String({ description: 'Why this file should be deleted' }),
    }),
    execute: async (_toolCallId, params) => {
      const { path, reason } = params as { path: string; reason: string }

      console.log(`\n⚠️  Agent 想要删除: ${path}`)
      console.log(`   原因: ${reason}`)
      console.log('   确认？[y/N]')

      // 阻塞直到用户响应
      const { confirmed } = await waitForConfirmation()

      if (!confirmed) {
        console.log('   ❌ 用户已取消\n')
        return {
          content: [{ type: 'text' as const, text: 'User cancelled the deletion.' }],
          details: {},
        }
      }

      // 实际应用中这里会真正删除文件
      console.log(`   ✅ 已删除（模拟）\n`)
      return {
        content: [{ type: 'text' as const, text: `Successfully deleted ${path}` }],
        details: {},
      }
    },
  }
}
```

有几个设计细节值得注意：

1. **`reason` 参数**：我们要求 Agent 提供删除原因。这不仅让用户在确认时有更多信息做判断，也迫使 AI 在工具调用时"三思而后行"——因为它必须生成一个合理的理由。

2. **默认拒绝 `[y/N]`**：大写 `N` 表示默认选项是拒绝。这是 Unix 世界的惯例——对于危险操作，默认应该是"不执行"。

3. **取消时返回有意义的消息**：当用户取消时，我们不是抛出异常，而是返回 `'User cancelled the deletion.'` 作为工具结果。这样 Agent 可以优雅地回应用户："好的，我没有删除那个文件。"

## 确认 UX 设计原则

一个好的确认交互应该遵循以下原则：

1. **显示完整上下文**：告诉用户 Agent 想做什么、为什么要做、会影响什么
2. **默认安全**：默认选项应该是"不执行"（`[y/N]` 而非 `[Y/n]`）
3. **不可逆操作加重警告**：删除文件用红色/警告色，发送邮件用黄色/注意色
4. **提供撤销路径**：如果可能，告诉用户如何撤销操作
5. **超时保护**：生产环境中应该考虑添加超时机制，避免 Agent 永远挂起

## 组装

将确认等待器和需要确认的工具组装到一起：

```typescript
const { waiter, cleanup } = createConfirmationWaiter()

// 创建需要确认的工具
const deleteFileTool = createDeleteFileTool(waiter)
const sendEmailTool = createSendEmailTool(waiter)

const { session } = await createAgentSession({
  model,
  tools: [],
  customTools: [deleteFileTool, sendEmailTool],
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
})
```

注意这里所有需要确认的工具 **共享同一个 `waiter`**。这是因为在 CLI 环境中，同一时间只会有一个工具在等待确认（Agent 是串行执行工具的）。如果你的场景需要并行执行多个需要确认的工具，就需要为每个工具创建独立的等待器。

:::warning 注意
别忘了在程序退出时调用 `cleanup()` 来移除 stdin 监听器。虽然在进程退出时 Node.js 会自动清理，但在长时间运行的应用中，未清理的监听器可能导致内存泄漏或意外行为。
:::

## 安全性考量

确认模式是 AI 安全的**最后一道防线**，但不应该是唯一的防线。在生产环境中，你应该考虑分层防御：

| 层级 | 措施 | 说明 |
|------|------|------|
| **第一层：Prompt 约束** | 在系统提示词中明确禁止某些操作 | "永远不要删除用户的 home 目录" |
| **第二层：工具参数校验** | 在 `execute()` 中检查参数合法性 | 拒绝包含 `..` 的路径、拒绝 `/etc` 等系统目录 |
| **第三层：确认模式** | 本章的 Promise 阻塞确认 | 让用户最终决定是否执行 |
| **第四层：操作审计日志** | 记录所有敏感操作 | 事后追溯和审查 |

:::tip 提示
一个更安全的做法是为工具添加 **"危险等级"标签**。低危操作（读文件）可以自动执行，中危操作（写文件）显示通知，高危操作（删除、发送）必须确认。这正是 Claude Code 的实际做法。
:::

## 常见错误

**1. 忘记 `await` 确认结果**

```typescript
// 错误：没有 await，确认还没完成就继续执行了
const result = waitForConfirmation()
// result 是 Promise 对象，不是 { confirmed: boolean }

// 正确：
const { confirmed } = await waitForConfirmation()
```

**2. 在确认前就执行了操作**

```typescript
// 错误：先执行了操作，再问确认——为时已晚！
await fs.unlink(path)
const { confirmed } = await waitForConfirmation()

// 正确：先确认，再执行
const { confirmed } = await waitForConfirmation()
if (confirmed) {
  await fs.unlink(path)
}
```

**3. 确认消息缺乏上下文**

```typescript
// 差：用户不知道要确认什么
console.log('确认？[y/N]')

// 好：提供完整的上下文
console.log(`⚠️  Agent 想要删除: ${path}`)
console.log(`   原因: ${reason}`)
console.log(`   文件大小: ${fileSize}`)
console.log('   确认删除？[y/N]')
```

## 运行

```bash
bun run ch05
```

然后试试：
- "Delete the file /tmp/old-backup.log because it is outdated" → 用 `y` 或 `n` 确认
- "Send an email to alice@example.com about the meeting" → 用 `y` 或 `n` 确认

## 小结

本章的核心收获：

1. **确认模式是 AI Agent 安全性的关键组成部分**——AI 可以建议，但不可逆操作必须由人类决定
2. **Promise 阻塞是实现确认的最简方式**——利用 JavaScript 异步机制，创建一个"悬空"的 Promise，在用户确认后才 resolve
3. **依赖注入让工具与确认机制解耦**——`waitForConfirmation` 通过参数传入，工具本身不关心确认的具体实现
4. **安全是分层的**——确认模式只是其中一层，还需要 Prompt 约束、参数校验、审计日志等配合
5. **UX 设计很重要**——好的确认交互提供充足上下文、默认安全、不让用户困惑

## 下一章

[第 06 章：系统提示词与技能](/zh/guide/06-system-prompt-and-skills) —— 用提示词和技能控制 Agent 行为。
