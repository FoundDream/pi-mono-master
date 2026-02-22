# 压缩与分支摘要

LLM 的上下文窗口有限。当对话过长时，Pi 使用压缩来摘要较旧的内容，同时保留最近的工作。本页涵盖自动压缩和分支摘要两个机制。

## 概述

Pi 有两种摘要机制：

| 机制 | 触发条件 | 用途 |
|------|---------|------|
| 压缩 | 上下文超过阈值，或 `/compact` | 摘要旧消息以释放上下文 |
| 分支摘要 | `/tree` 导航 | 切换分支时保留上下文 |

两者使用相同的结构化摘要格式，并累积追踪文件操作。

## 压缩

### 触发条件

自动压缩在以下条件满足时触发：

```
contextTokens > contextWindow - reserveTokens
```

默认情况下，`reserveTokens` 为 16384 token（可在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置）。这为 LLM 的响应留出空间。

也可以通过 `/compact [instructions]` 手动触发，可选指令用于聚焦摘要。

### 工作原理

1. **找到切点**：从最新消息向后遍历，累积 token 估算，直到达到 `keepRecentTokens`（默认 20k，可配置）
2. **提取消息**：收集从上次压缩（或起始）到切点的消息
3. **生成摘要**：调用 LLM 以结构化格式生成摘要
4. **追加条目**：保存 `CompactionEntry`，包含摘要和 `firstKeptEntryId`
5. **重新加载**：会话重新加载，使用摘要 + 从 `firstKeptEntryId` 开始的消息

```
压缩前：

  entry:  0     1     2     3      4     5     6      7      8     9
        ┌─────┬─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┘
                └────────┬───────┘ └──────────────┬──────────────┘
               messagesToSummarize            保留的消息
                                   ↑
                          firstKeptEntryId (entry 4)

压缩后（追加新条目）：

  entry:  0     1     2     3      4     5     6      7      8     9     10
        ┌─────┬─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│ cmp │
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┴─────┘
               └──────────┬──────┘ └──────────────────────┬───────────────────┘
                 不发送给 LLM                        发送给 LLM
                                                         ↑
                                              从 firstKeptEntryId 开始

LLM 看到的内容：

  ┌────────┬─────────┬─────┬─────┬──────┬──────┬─────┬──────┐
  │ system │ summary │ usr │ ass │ tool │ tool │ ass │ tool │
  └────────┴─────────┴─────┴─────┴──────┴──────┴─────┴──────┘
       ↑         ↑      └─────────────────┬────────────────┘
    prompt   来自 cmp          从 firstKeptEntryId 开始的消息
```

### 分裂回合

一个"回合"从用户消息开始，包含所有助手响应和工具调用，直到下一个用户消息。通常，压缩在回合边界处切割。

当单个回合超过 `keepRecentTokens` 时，切点落在回合中间的助手消息处。这是"分裂回合"：

```
分裂回合（一个巨大的回合超出预算）：

  entry:  0     1     2      3     4      5      6     7      8
        ┌─────┬─────┬─────┬──────┬─────┬──────┬──────┬─────┬──────┐
        │ hdr │ usr │ ass │ tool │ ass │ tool │ tool │ ass │ tool │
        └─────┴─────┴─────┴──────┴─────┴──────┴──────┴─────┴──────┘
                ↑                                     ↑
         turnStartIndex = 1                  firstKeptEntryId = 7
                │                                     │
                └──── turnPrefixMessages (1-6) ───────┘
                                                      └── 保留 (7-8)

  isSplitTurn = true
  messagesToSummarize = []  （之前没有完整回合）
  turnPrefixMessages = [usr, ass, tool, ass, tool, tool]
```

对于分裂回合，Pi 生成两个摘要并合并：
1. **历史摘要**：之前的上下文（如果有）
2. **回合前缀摘要**：分裂回合的前半部分

### 切点规则

有效的切点为：
- 用户消息
- 助手消息
- BashExecution 消息
- 自定义消息（custom_message、branch_summary）

绝不在工具结果处切割（它们必须与工具调用保持在一起）。

### CompactionEntry 结构

```typescript
interface CompactionEntry<T = unknown> {
  type: "compaction";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  fromHook?: boolean;  // true 表示由扩展提供（遗留字段名）
  details?: T;         // 实现特定的数据
}

// 默认压缩使用以下结构作为 details：
interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

扩展可以在 `details` 中存储任意 JSON 可序列化数据。默认压缩追踪文件操作，但自定义扩展实现可以使用自己的结构。

## 分支摘要

### 触发条件

当你使用 `/tree` 导航到不同分支时，Pi 会提供对正在离开的工作生成摘要的选项。这会将左侧分支的上下文注入到新分支中。

### 工作原理

1. **查找公共祖先**：旧位置和新位置共享的最深节点
2. **收集条目**：从旧叶子向回遍历到公共祖先
3. **按预算准备**：包含 token 预算内的消息（最新优先）
4. **生成摘要**：调用 LLM，使用结构化格式
5. **追加条目**：在导航点保存 `BranchSummaryEntry`

```
导航前的树：

         ┌─ B ─ C ─ D (旧叶子，正在放弃)
    A ───┤
         └─ E ─ F (目标)

公共祖先：A
要摘要的条目：B, C, D

导航后（带摘要）：

         ┌─ B ─ C ─ D ─ [B,C,D 的摘要]
    A ───┤
         └─ E ─ F (新叶子)
```

### 累积文件追踪

压缩和分支摘要都会累积追踪文件。生成摘要时，Pi 从以下来源提取文件操作：
- 被摘要消息中的工具调用
- 之前的压缩或分支摘要的 `details`（如果有）

这意味着文件追踪会在多次压缩或嵌套分支摘要中累积，保留已读取和修改文件的完整历史。

### BranchSummaryEntry 结构

```typescript
interface BranchSummaryEntry<T = unknown> {
  type: "branch_summary";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  fromId: string;      // 导航来源的条目
  fromHook?: boolean;  // true 表示由扩展提供（遗留字段名）
  details?: T;         // 实现特定的数据
}

// 默认分支摘要使用以下结构作为 details：
interface BranchSummaryDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

与压缩相同，扩展可以在 `details` 中存储自定义数据。

## 摘要格式

压缩和分支摘要都使用相同的结构化格式：

```markdown
## Goal
[用户试图完成的目标]

## Constraints & Preferences
- [用户提到的要求]

## Progress
### Done
- [x] [已完成的任务]

### In Progress
- [ ] [当前工作]

### Blocked
- [问题，如果有]

## Key Decisions
- **[决策]**: [理由]

## Next Steps
1. [下一步应该做什么]

## Critical Context
- [继续所需的数据]

<read-files>
path/to/file1.ts
path/to/file2.ts
</read-files>

<modified-files>
path/to/changed.ts
</modified-files>
```

### 消息序列化

在摘要化之前，消息通过 `serializeConversation()` 序列化为文本：

```
[User]: What they said
[Assistant thinking]: Internal reasoning
[Assistant]: Response text
[Assistant tool calls]: read(path="foo.ts"); edit(path="bar.ts", ...)
[Tool result]: Output from tool
```

这样可以防止模型将其视为需要继续的对话。

## 通过扩展自定义摘要

扩展可以拦截和自定义压缩和分支摘要。

### session_before_compact

在自动压缩或 `/compact` 之前触发。可以取消或提供自定义摘要。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, signal } = event;

  // preparation.messagesToSummarize - 要摘要的消息
  // preparation.turnPrefixMessages - 分裂回合前缀（如果 isSplitTurn）
  // preparation.previousSummary - 之前的压缩摘要
  // preparation.fileOps - 提取的文件操作
  // preparation.tokensBefore - 压缩前的上下文 token
  // preparation.firstKeptEntryId - 保留消息的起始位置
  // preparation.settings - 压缩设置

  // branchEntries - 当前分支的所有条目（用于自定义状态）
  // signal - AbortSignal（传递给 LLM 调用）

  // 取消：
  return { cancel: true };

  // 自定义摘要：
  return {
    compaction: {
      summary: "Your summary...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      details: { /* 自定义数据 */ },
    }
  };
});
```

#### 将消息转换为文本

要使用你自己的模型生成摘要，可通过 `serializeConversation` 将消息转换为文本：

```typescript
import { convertToLlm, serializeConversation } from "@mariozechner/pi-coding-agent";

pi.on("session_before_compact", async (event, ctx) => {
  const { preparation } = event;

  // 将 AgentMessage[] 转换为 Message[]，然后序列化为文本
  const conversationText = serializeConversation(
    convertToLlm(preparation.messagesToSummarize)
  );

  // 发送给你的模型进行摘要
  const summary = await myModel.summarize(conversationText);

  return {
    compaction: {
      summary,
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
    }
  };
});
```

### session_before_tree

在 `/tree` 导航之前触发。无论用户是否选择摘要都会触发。可以取消导航或提供自定义摘要。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;

  // preparation.targetId - 导航目标
  // preparation.oldLeafId - 当前位置（正在放弃）
  // preparation.commonAncestorId - 共享祖先
  // preparation.entriesToSummarize - 将被摘要的条目
  // preparation.userWantsSummary - 用户是否选择摘要

  // 完全取消导航：
  return { cancel: true };

  // 提供自定义摘要（仅在 userWantsSummary 为 true 时使用）：
  if (preparation.userWantsSummary) {
    return {
      summary: {
        summary: "Your summary...",
        details: { /* 自定义数据 */ },
      }
    };
  }
});
```

## 设置

在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置压缩：

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

| 设置 | 默认值 | 说明 |
|------|--------|------|
| `enabled` | `true` | 启用自动压缩 |
| `reserveTokens` | `16384` | 为 LLM 响应预留的 token |
| `keepRecentTokens` | `20000` | 保留的最近 token（不被摘要） |

使用 `"enabled": false` 禁用自动压缩。你仍然可以通过 `/compact` 手动压缩。
