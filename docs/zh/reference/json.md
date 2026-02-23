# JSON 事件流模式

```bash
pi --mode json "Your prompt"
```

将所有会话事件以 JSON 行的形式输出到 stdout。适用于将 Pi 集成到其他工具或自定义 UI 中。

## 事件类型

事件定义在 `AgentSessionEvent` 中：

```typescript
type AgentSessionEvent =
  | AgentEvent
  | { type: "auto_compaction_start"; reason: "threshold" | "overflow" }
  | {
      type: "auto_compaction_end";
      result: CompactionResult | undefined;
      aborted: boolean;
      willRetry: boolean;
      errorMessage?: string;
    }
  | {
      type: "auto_retry_start";
      attempt: number;
      maxAttempts: number;
      delayMs: number;
      errorMessage: string;
    }
  | {
      type: "auto_retry_end";
      success: boolean;
      attempt: number;
      finalError?: string;
    };
```

基础事件来自 `AgentEvent`：

```typescript
type AgentEvent =
  // 智能体生命周期
  | { type: "agent_start" }
  | { type: "agent_end"; messages: AgentMessage[] }
  // 轮次生命周期
  | { type: "turn_start" }
  | {
      type: "turn_end";
      message: AgentMessage;
      toolResults: ToolResultMessage[];
    }
  // 消息生命周期
  | { type: "message_start"; message: AgentMessage }
  | {
      type: "message_update";
      message: AgentMessage;
      assistantMessageEvent: AssistantMessageEvent;
    }
  | { type: "message_end"; message: AgentMessage }
  // 工具执行
  | {
      type: "tool_execution_start";
      toolCallId: string;
      toolName: string;
      args: any;
    }
  | {
      type: "tool_execution_update";
      toolCallId: string;
      toolName: string;
      args: any;
      partialResult: any;
    }
  | {
      type: "tool_execution_end";
      toolCallId: string;
      toolName: string;
      result: any;
      isError: boolean;
    };
```

## 消息类型

基础消息类型：

- `UserMessage` - 用户消息
- `AssistantMessage` - 助手消息
- `ToolResultMessage` - 工具结果消息

扩展消息类型：

- `BashExecutionMessage` - Bash 执行消息
- `CustomMessage` - 自定义消息
- `BranchSummaryMessage` - 分支摘要消息
- `CompactionSummaryMessage` - 压缩摘要消息

## 输出格式

每行是一个 JSON 对象。第一行是会话头部：

```json
{
  "type": "session",
  "version": 3,
  "id": "uuid",
  "timestamp": "...",
  "cwd": "/path"
}
```

随后是事件，按发生顺序输出：

```json
{"type":"agent_start"}
{"type":"turn_start"}
{"type":"message_start","message":{"role":"assistant","content":[],...}}
{"type":"message_update","message":{...},"assistantMessageEvent":{"type":"text_delta","delta":"Hello",...}}
{"type":"message_end","message":{...}}
{"type":"turn_end","message":{...},"toolResults":[]}
{"type":"agent_end","messages":[...]}
```

## 示例

```bash
pi --mode json "List files" 2>/dev/null | jq -c 'select(.type == "message_end")'
```
