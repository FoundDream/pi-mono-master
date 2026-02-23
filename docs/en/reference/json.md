---
title: JSON Event Stream
---

# JSON Event Stream

```bash
pi --mode json "Your prompt"
```

Outputs all session events as JSON lines to stdout. Useful for integrating pi into other tools or custom UIs.

## Event Types

Events are defined in `AgentSessionEvent`, which extends `AgentEvent` with session-specific events:

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

Base events from `AgentEvent`:

```typescript
type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end"; messages: AgentMessage[] }
  | { type: "turn_start" }
  | {
      type: "turn_end";
      message: AgentMessage;
      toolResults: ToolResultMessage[];
    }
  | { type: "message_start"; message: AgentMessage }
  | {
      type: "message_update";
      message: AgentMessage;
      assistantMessageEvent: AssistantMessageEvent;
    }
  | { type: "message_end"; message: AgentMessage }
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

### Event Lifecycle

A typical session produces events in this order:

```
agent_start
  turn_start
    message_start
      message_update (text_delta)  ×N
      message_update (toolcall_start)
      message_update (toolcall_delta)  ×N
      message_update (toolcall_end)
      message_update (done)
    message_end
    tool_execution_start
      tool_execution_update  ×N (optional)
    tool_execution_end
  turn_end
  turn_start           (if agent needs another turn)
    ...
  turn_end
agent_end
```

### AssistantMessageEvent

The `message_update` event carries an `assistantMessageEvent` field with fine-grained streaming data:

| Event Type       | Fields                                | Description              |
| ---------------- | ------------------------------------- | ------------------------ |
| `start`          | `partial`                             | Streaming begins         |
| `text_start`     | `contentIndex`, `partial`             | New text block starts    |
| `text_delta`     | `contentIndex`, `delta`, `partial`    | Text chunk received      |
| `text_end`       | `contentIndex`, `content`, `partial`  | Text block complete      |
| `thinking_start` | `contentIndex`, `partial`             | Thinking block starts    |
| `thinking_delta` | `contentIndex`, `delta`, `partial`    | Thinking chunk received  |
| `thinking_end`   | `contentIndex`, `content`, `partial`  | Thinking block complete  |
| `toolcall_start` | `contentIndex`, `partial`             | Tool call starts         |
| `toolcall_delta` | `contentIndex`, `delta`, `partial`    | Tool call argument chunk |
| `toolcall_end`   | `contentIndex`, `toolCall`, `partial` | Tool call complete       |
| `done`           | `reason`, `message`                   | Message complete         |
| `error`          | `reason`, `error`                     | Message failed           |

## Output Format

Each line is a JSON object. The first line is the session header:

```json
{
  "type": "session",
  "version": 3,
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "cwd": "/path/to/project"
}
```

Followed by events:

```json
{"type":"agent_start"}
{"type":"turn_start"}
{"type":"message_start","message":{"role":"assistant","content":[],"api":"anthropic-messages","provider":"anthropic","model":"claude-sonnet-4-20250514","usage":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"totalTokens":0,"cost":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"total":0}},"stopReason":"stop","timestamp":1705312200000}}
{"type":"message_update","message":{},"assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Hello","partial":{}}}
{"type":"message_update","message":{},"assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":" world!","partial":{}}}
{"type":"message_update","message":{},"assistantMessageEvent":{"type":"done","reason":"stop","message":{}}}
{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"Hello world!"}],"api":"anthropic-messages","provider":"anthropic","model":"claude-sonnet-4-20250514","usage":{"input":50,"output":5,"cacheRead":0,"cacheWrite":0,"totalTokens":55,"cost":{"input":0.001,"output":0.0001,"cacheRead":0,"cacheWrite":0,"total":0.0011}},"stopReason":"stop","timestamp":1705312200000}}
{"type":"turn_end","message":{},"toolResults":[]}
{"type":"agent_end","messages":[]}
```

## Examples

### Extract final text from response

```bash
pi --mode json "List files" 2>/dev/null | jq -c 'select(.type == "message_end")'
```

### Stream text deltas in real time

```bash
pi --mode json "Explain recursion" 2>/dev/null | jq -r 'select(.type == "message_update" and .assistantMessageEvent.type == "text_delta") | .assistantMessageEvent.delta'
```

### Capture tool execution results

```bash
pi --mode json "Read package.json" 2>/dev/null | jq -c 'select(.type == "tool_execution_end")'
```

### Multiple prompts

You can send additional prompts with the `-m` / `--message` flag:

```bash
pi --mode json "Create a hello.ts file" -m "Now add a test for it" 2>/dev/null
```

### Programmatic usage with Node.js

```typescript
import {
  createAgentSession,
  runPrintMode,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
});

// Capture events via subscribe
session.subscribe((event) => {
  const json = JSON.stringify(event);
  console.log(json);
});

await session.prompt("What files are in the current directory?");
```

## Notes

- Stderr is used for logging and diagnostics; redirect with `2>/dev/null` for clean JSON output
- Each JSON line is self-contained and can be parsed independently
- The `message` and `partial` fields in events contain the full message state at that point in time
- The session header is always the first line, making it easy to identify the session
- Events are emitted in real time as they occur, enabling streaming UIs
