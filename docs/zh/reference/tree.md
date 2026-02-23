# 会话树导航

`/tree` 命令提供基于树的会话历史导航。

## 概述

会话以树形结构存储，每个条目都有 `id` 和 `parentId`。"叶子"指针跟踪当前位置。`/tree` 允许你导航到任意节点，并可选择对离开的分支生成摘要。

### 与 `/fork` 的区别

| 特性 | `/fork`                                | `/tree`                                |
| ---- | -------------------------------------- | -------------------------------------- |
| 视图 | 用户消息的扁平列表                     | 完整树结构                             |
| 操作 | 将路径提取到**新的会话文件**           | 在**同一会话**中更改叶子               |
| 摘要 | 从不                                   | 可选（提示用户）                       |
| 事件 | `session_before_fork` / `session_fork` | `session_before_tree` / `session_tree` |

## 树 UI

```
├─ user: "Hello, can you help..."
│  └─ assistant: "Of course! I can..."
│     ├─ user: "Let's try approach A..."
│     │  └─ assistant: "For approach A..."
│     │     └─ [compaction: 12k tokens]
│     │        └─ user: "That worked..."  ← active
│     └─ user: "Actually, approach B..."
│        └─ assistant: "For approach B..."
```

### 控制

| 按键          | 操作                                     |
| ------------- | ---------------------------------------- |
| ↑/↓           | 导航（深度优先顺序）                     |
| Enter         | 选择节点                                 |
| Escape/Ctrl+C | 取消                                     |
| Ctrl+U        | 切换：仅显示用户消息                     |
| Ctrl+O        | 切换：显示全部（包括 custom/label 条目） |

### 显示

- 高度：终端高度的一半
- 当前叶子标记为 `← active`
- 标签内联显示：`[label-name]`
- 默认过滤器隐藏 `label` 和 `custom` 条目（Ctrl+O 模式下显示）
- 子节点按时间戳排序（最早的优先）

## 选择行为

### 用户消息或自定义消息

1. 叶子设置为所选节点的**父节点**（如果是根节点则为 `null`）
2. 消息文本放入**编辑器**供重新提交
3. 用户编辑并提交，创建新分支

### 非用户消息（助手、压缩等）

1. 叶子设置为**所选节点**
2. 编辑器保持空白
3. 用户从该点继续

### 选择根用户消息

如果用户选择了最初的第一条消息（没有父节点）：

1. 叶子重置为 `null`（空对话）
2. 消息文本放入编辑器
3. 用户实际上从头开始

## 分支摘要

切换分支时，用户会看到三个选项：

1. **不生成摘要** - 立即切换，不进行摘要
2. **摘要** - 使用默认提示生成摘要
3. **自定义提示摘要** - 打开编辑器输入额外的聚焦指令，追加到默认摘要提示中

### 摘要范围

从旧叶子回溯到与目标的公共祖先的路径：

```
A → B → C → D → E → F  ← 旧叶子
        ↘ G → H        ← 目标
```

被放弃的路径：D → E → F（生成摘要）

摘要在以下情况停止：

1. 公共祖先（始终停止）
2. 压缩节点（如果先遇到）

### 摘要存储

存储为 `BranchSummaryEntry`：

```typescript
interface BranchSummaryEntry {
  type: "branch_summary";
  id: string;
  parentId: string; // 新的叶子位置
  timestamp: string;
  fromId: string; // 被放弃的旧叶子
  summary: string; // LLM 生成的摘要
  details?: unknown; // 可选的钩子数据
}
```

## 实现

### AgentSession.navigateTree()

```typescript
async navigateTree(
  targetId: string,
  options?: {
    summarize?: boolean;
    customInstructions?: string;
    replaceInstructions?: boolean;
    label?: string;
  }
): Promise<{ editorText?: string; cancelled: boolean }>
```

选项说明：

- `summarize`：是否为被放弃的分支生成摘要
- `customInstructions`：摘要生成器的自定义指令
- `replaceInstructions`：如果为 true，`customInstructions` 替换默认提示而非追加
- `label`：附加到分支摘要条目（或不摘要时附加到目标条目）的标签

流程：

1. 验证目标，检查无操作（target === 当前叶子）
2. 查找旧叶子和目标之间的公共祖先
3. 收集要摘要的条目（如果请求）
4. 触发 `session_before_tree` 事件（钩子可取消或提供摘要）
5. 如果需要，运行默认摘要生成器
6. 通过 `branch()` 或 `branchWithSummary()` 切换叶子
7. 更新智能体：`agent.replaceMessages(sessionManager.buildSessionContext().messages)`
8. 触发 `session_tree` 事件
9. 通过会话事件通知自定义工具
10. 返回结果，如果选择了用户消息则包含 `editorText`

### SessionManager

- `getLeafUuid(): string | null` - 当前叶子（空时为 null）
- `resetLeaf(): void` - 将叶子设为 null（用于根用户消息导航）
- `getTree(): SessionTreeNode[]` - 完整树，子节点按时间戳排序
- `branch(id)` - 更改叶子指针
- `branchWithSummary(id, summary)` - 更改叶子并创建摘要条目

### InteractiveMode

`/tree` 命令显示 `TreeSelectorComponent`，然后：

1. 提示是否摘要
2. 调用 `session.navigateTree()`
3. 清除并重新渲染聊天
4. 如果适用，设置编辑器文本

## 扩展钩子

### `session_before_tree`

```typescript
interface TreePreparation {
  targetId: string;
  oldLeafId: string | null;
  commonAncestorId: string | null;
  entriesToSummarize: SessionEntry[];
  userWantsSummary: boolean;
  customInstructions?: string;
  replaceInstructions?: boolean;
  label?: string;
}

interface SessionBeforeTreeEvent {
  type: "session_before_tree";
  preparation: TreePreparation;
  signal: AbortSignal;
}

interface SessionBeforeTreeResult {
  cancel?: boolean;
  summary?: { summary: string; details?: unknown };
  customInstructions?: string; // 覆盖自定义指令
  replaceInstructions?: boolean; // 覆盖替换模式
  label?: string; // 覆盖标签
}
```

扩展可以通过从 `session_before_tree` 处理程序返回来覆盖 `customInstructions`、`replaceInstructions` 和 `label`。

### `session_tree`

```typescript
interface SessionTreeEvent {
  type: "session_tree";
  newLeafId: string | null;
  oldLeafId: string | null;
  summaryEntry?: BranchSummaryEntry;
  fromHook?: boolean;
}
```

### 示例：自定义摘要生成器

```typescript
export default function (pi: HookAPI) {
  pi.on("session_before_tree", async (event, ctx) => {
    if (!event.preparation.userWantsSummary) return;
    if (event.preparation.entriesToSummarize.length === 0) return;

    const summary = await myCustomSummarizer(
      event.preparation.entriesToSummarize,
    );
    return { summary: { summary, details: { custom: true } } };
  });
}
```

## 错误处理

- 摘要生成失败：取消导航，显示错误
- 用户中止（Escape）：取消导航
- 钩子返回 `cancel: true`：静默取消导航
