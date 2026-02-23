---
title: RPC Mode
---

# RPC Mode

RPC mode provides a JSON-based protocol for headless operation, enabling integration of pi into other applications as a subprocess.

## Starting

```bash
pi --mode rpc [options]
```

Options:

| Flag                | Description                                   |
| ------------------- | --------------------------------------------- |
| `--provider <name>` | Provider to use (e.g., `anthropic`, `openai`) |
| `--model <id>`      | Model ID to use                               |
| `--continue`        | Resume the most recent session                |
| `--session <path>`  | Open a specific session file                  |

## Core Protocol

Communication uses JSON lines over stdin/stdout:

- **Commands**: JSON objects sent on stdin with a `type` field and optional `id` for correlation
- **Responses**: JSON objects on stdout with `type: "response"`, matching `id`, and `success: true/false`
- **Events**: `AgentSessionEvent` objects streamed on stdout as they occur
- **Extension UI**: `extension_ui_request` objects on stdout, `extension_ui_response` on stdin

All messages are newline-delimited JSON (one JSON object per line).

## Commands

### Prompting

#### prompt

Send a message to the agent.

```json
{
  "type": "prompt",
  "message": "What files are in this directory?",
  "id": "req-1"
}
```

Optional fields:

- `images`: Array of `ImageContent` objects to attach
- `streamingBehavior`: `"steer"` or `"followUp"` (required when agent is already streaming)

Response:

```json
{ "type": "response", "command": "prompt", "success": true, "id": "req-1" }
```

#### steer

Queue a steering message to interrupt the agent mid-run. Delivered after current tool execution completes; remaining tool calls are skipped.

```json
{
  "type": "steer",
  "message": "Actually, focus on the src/ directory only",
  "id": "req-2"
}
```

Optional fields:

- `images`: Array of `ImageContent` objects

#### follow_up

Queue a follow-up message to be processed after the agent finishes. Delivered only when the agent has no more tool calls or steering messages.

```json
{
  "type": "follow_up",
  "message": "Now explain the architecture",
  "id": "req-3"
}
```

Optional fields:

- `images`: Array of `ImageContent` objects

#### abort

Abort the current operation and wait for the agent to become idle.

```json
{ "type": "abort", "id": "req-4" }
```

#### new_session

Start a new session. Clears all messages and creates a fresh session.

```json
{ "type": "new_session", "id": "req-5" }
```

Optional fields:

- `parentSession`: Path to parent session for lineage tracking

Response:

```json
{
  "type": "response",
  "command": "new_session",
  "success": true,
  "data": { "cancelled": false },
  "id": "req-5"
}
```

### State

#### get_state

Get the current session state.

```json
{ "type": "get_state", "id": "req-6" }
```

Response:

```json
{
  "type": "response",
  "command": "get_state",
  "success": true,
  "data": {
    "model": {
      "id": "claude-sonnet-4-20250514",
      "name": "Claude Sonnet 4",
      "provider": "anthropic",
      "...": "..."
    },
    "thinkingLevel": "medium",
    "isStreaming": false,
    "isCompacting": false,
    "steeringMode": "all",
    "followUpMode": "all",
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "uuid",
    "sessionName": "My Session",
    "autoCompactionEnabled": true,
    "messageCount": 10,
    "pendingMessageCount": 0
  },
  "id": "req-6"
}
```

#### get_messages

Get all messages in the current session.

```json
{ "type": "get_messages", "id": "req-7" }
```

Response:

```json
{"type": "response", "command": "get_messages", "success": true, "data": {"messages": [...]}, "id": "req-7"}
```

### Model

#### set_model

Set the model by provider and ID.

```json
{
  "type": "set_model",
  "provider": "anthropic",
  "modelId": "claude-opus-4-5",
  "id": "req-8"
}
```

Response includes the full model object:

```json
{"type": "response", "command": "set_model", "success": true, "data": {"id": "claude-opus-4-5", "provider": "anthropic", "..."}, "id": "req-8"}
```

#### cycle_model

Cycle to the next model. Uses scoped models if configured (via `--models` flag), otherwise cycles through all available models.

```json
{ "type": "cycle_model", "id": "req-9" }
```

Response:

```json
{
  "type": "response",
  "command": "cycle_model",
  "success": true,
  "data": {
    "model": { "provider": "openai", "id": "gpt-4o" },
    "thinkingLevel": "medium",
    "isScoped": false
  },
  "id": "req-9"
}
```

Returns `null` data if only one model is available.

#### get_available_models

Get a list of all available models.

```json
{ "type": "get_available_models", "id": "req-10" }
```

Response:

```json
{"type": "response", "command": "get_available_models", "success": true, "data": {"models": [...]}, "id": "req-10"}
```

### Thinking

#### set_thinking_level

Set the thinking/reasoning level.

```json
{ "type": "set_thinking_level", "level": "high", "id": "req-11" }
```

Valid levels: `"off"`, `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"` (xhigh only for specific models).

#### cycle_thinking_level

Cycle to the next thinking level.

```json
{ "type": "cycle_thinking_level", "id": "req-12" }
```

Response:

```json
{
  "type": "response",
  "command": "cycle_thinking_level",
  "success": true,
  "data": { "level": "high" },
  "id": "req-12"
}
```

Returns `null` data if the model does not support thinking.

### Queue Modes

#### set_steering_mode

Control how multiple steering messages are delivered.

```json
{ "type": "set_steering_mode", "mode": "one-at-a-time", "id": "req-13" }
```

Modes:

- `"all"` - Deliver all queued steering messages at once
- `"one-at-a-time"` - Deliver one steering message per turn

#### set_follow_up_mode

Control how multiple follow-up messages are delivered.

```json
{ "type": "set_follow_up_mode", "mode": "all", "id": "req-14" }
```

Same modes as `set_steering_mode`.

### Maintenance

#### compact

Manually compact the session context.

```json
{ "type": "compact", "id": "req-15" }
```

Optional fields:

- `customInstructions`: Custom focus for the compaction summary

Response:

```json
{
  "type": "response",
  "command": "compact",
  "success": true,
  "data": {
    "summary": "...",
    "firstKeptEntryId": "uuid",
    "tokensBefore": 50000
  },
  "id": "req-15"
}
```

#### set_auto_compaction

Enable or disable auto-compaction.

```json
{ "type": "set_auto_compaction", "enabled": true, "id": "req-16" }
```

#### set_auto_retry

Enable or disable auto-retry for transient errors (rate limits, overloaded, server errors).

```json
{ "type": "set_auto_retry", "enabled": true, "id": "req-17" }
```

#### abort_retry

Cancel an in-progress retry.

```json
{ "type": "abort_retry", "id": "req-18" }
```

### Execution

#### bash

Execute a bash command. The result is added to the agent's context.

```json
{ "type": "bash", "command": "ls -la", "id": "req-19" }
```

Response:

```json
{
  "type": "response",
  "command": "bash",
  "success": true,
  "data": {
    "stdout": "...",
    "stderr": "",
    "exitCode": 0,
    "signal": null,
    "cancelled": false,
    "truncated": false
  },
  "id": "req-19"
}
```

#### abort_bash

Cancel a running bash command.

```json
{ "type": "abort_bash", "id": "req-20" }
```

### Session

#### get_session_stats

Get statistics about the current session.

```json
{ "type": "get_session_stats", "id": "req-21" }
```

Response:

```json
{
  "type": "response",
  "command": "get_session_stats",
  "success": true,
  "data": {
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "uuid",
    "userMessages": 5,
    "assistantMessages": 5,
    "toolCalls": 12,
    "toolResults": 12,
    "totalMessages": 22,
    "tokens": {
      "input": 15000,
      "output": 8000,
      "cacheRead": 5000,
      "cacheWrite": 3000,
      "total": 31000
    },
    "cost": 0.15
  },
  "id": "req-21"
}
```

#### export_html

Export the session to an HTML file.

```json
{ "type": "export_html", "id": "req-22" }
```

Optional fields:

- `outputPath`: Custom output path

Response:

```json
{
  "type": "response",
  "command": "export_html",
  "success": true,
  "data": { "path": "/path/to/export.html" },
  "id": "req-22"
}
```

#### switch_session

Switch to a different session file.

```json
{
  "type": "switch_session",
  "sessionPath": "/path/to/other-session.jsonl",
  "id": "req-23"
}
```

Response:

```json
{
  "type": "response",
  "command": "switch_session",
  "success": true,
  "data": { "cancelled": false },
  "id": "req-23"
}
```

#### fork

Create a fork from a specific entry. Creates a new session file with the path up to that entry.

```json
{ "type": "fork", "entryId": "uuid-of-entry", "id": "req-24" }
```

Response:

```json
{
  "type": "response",
  "command": "fork",
  "success": true,
  "data": { "text": "original user message text", "cancelled": false },
  "id": "req-24"
}
```

#### get_fork_messages

Get all user messages available for forking.

```json
{ "type": "get_fork_messages", "id": "req-25" }
```

Response:

```json
{
  "type": "response",
  "command": "get_fork_messages",
  "success": true,
  "data": {
    "messages": [
      { "entryId": "uuid-1", "text": "First message" },
      { "entryId": "uuid-3", "text": "Second message" }
    ]
  },
  "id": "req-25"
}
```

#### get_last_assistant_text

Get the text content of the last assistant message.

```json
{ "type": "get_last_assistant_text", "id": "req-26" }
```

Response:

```json
{
  "type": "response",
  "command": "get_last_assistant_text",
  "success": true,
  "data": { "text": "Here are the files..." },
  "id": "req-26"
}
```

#### set_session_name

Set a display name for the current session.

```json
{ "type": "set_session_name", "name": "Auth Feature", "id": "req-27" }
```

#### get_commands

Get available commands (extension commands, prompt templates, skills).

```json
{ "type": "get_commands", "id": "req-28" }
```

Response:

```json
{
  "type": "response",
  "command": "get_commands",
  "success": true,
  "data": {
    "commands": [
      {
        "name": "review",
        "description": "Review code changes",
        "source": "prompt",
        "location": "project",
        "path": "/project/.pi/prompts/review.md"
      },
      {
        "name": "deploy",
        "description": "Deploy to staging",
        "source": "skill",
        "location": "user",
        "path": "~/.pi/agent/skills/deploy.md"
      }
    ]
  },
  "id": "req-28"
}
```

## Event Stream

While the agent is running, events are emitted as JSON lines on stdout. These are the same `AgentSessionEvent` types described in the [JSON Event Stream](/reference/json) documentation:

| Event Type              | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `agent_start`           | Agent begins processing                           |
| `agent_end`             | Agent finishes (includes all messages)            |
| `turn_start`            | New turn begins                                   |
| `turn_end`              | Turn complete (includes message and tool results) |
| `message_start`         | Assistant message streaming begins                |
| `message_update`        | Streaming delta (text, thinking, tool call)       |
| `message_end`           | Assistant message complete                        |
| `tool_execution_start`  | Tool begins executing                             |
| `tool_execution_update` | Tool progress update                              |
| `tool_execution_end`    | Tool execution complete                           |
| `auto_compaction_start` | Auto-compaction triggered                         |
| `auto_compaction_end`   | Auto-compaction finished                          |
| `auto_retry_start`      | Auto-retry triggered (transient error)            |
| `auto_retry_end`        | Auto-retry finished                               |

## Image Support

The `prompt`, `steer`, and `follow_up` commands accept an `images` array for attaching images:

```json
{
  "type": "prompt",
  "message": "What's in this image?",
  "images": [
    {
      "type": "image",
      "data": "iVBORw0KGgo...",
      "mimeType": "image/png"
    }
  ],
  "id": "req-30"
}
```

The `data` field must contain base64-encoded image data. Supported MIME types include `image/png`, `image/jpeg`, `image/gif`, and `image/webp`.

## Streaming Behavior

When the agent is actively streaming, new prompt messages must specify how they should be delivered:

- **`"steer"`**: Interrupts the agent mid-run. Delivered after the current tool execution completes. Remaining queued tool calls for the current turn are skipped, and the steering message is injected before the next LLM call.

- **`"followUp"`**: Queued until the agent finishes. Delivered only when the agent has no more tool calls and no steering messages pending.

If the agent is not streaming, `streamingBehavior` is not required and the prompt is sent directly.

## Extension UI Sub-protocol

Extensions may need user input during execution. The RPC mode surfaces these requests as special events:

### Dialog Methods (require response)

These methods block the extension until a response is sent:

| Method    | Fields                                   | Expected Response                                                            |
| --------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| `select`  | `title`, `options: string[]`, `timeout?` | `{"type": "extension_ui_response", "id": "...", "value": "selected option"}` |
| `confirm` | `title`, `message`, `timeout?`           | `{"type": "extension_ui_response", "id": "...", "confirmed": true}`          |
| `input`   | `title`, `placeholder?`, `timeout?`      | `{"type": "extension_ui_response", "id": "...", "value": "user input"}`      |
| `editor`  | `title`, `prefill?`                      | `{"type": "extension_ui_response", "id": "...", "value": "editor content"}`  |

To cancel any dialog:

```json
{ "type": "extension_ui_response", "id": "request-id", "cancelled": true }
```

### Fire-and-Forget Methods (no response needed)

These methods are informational and do not require a response:

| Method            | Fields                                                                | Description           |
| ----------------- | --------------------------------------------------------------------- | --------------------- |
| `notify`          | `message`, `notifyType?: "info" \| "warning" \| "error"`              | Show a notification   |
| `setStatus`       | `statusKey`, `statusText: string \| undefined`                        | Set/clear status text |
| `setWidget`       | `widgetKey`, `widgetLines: string[] \| undefined`, `widgetPlacement?` | Set/clear widget      |
| `setTitle`        | `title`                                                               | Set terminal title    |
| `set_editor_text` | `text`                                                                | Set editor text       |

### Extension UI Request Format

```json
{
  "type": "extension_ui_request",
  "id": "ext-req-1",
  "method": "confirm",
  "title": "Deploy to production?",
  "message": "This will update the live server. Continue?",
  "timeout": 30000
}
```

### Extension UI Response Format

```json
{ "type": "extension_ui_response", "id": "ext-req-1", "confirmed": true }
```

## Error Responses

When a command fails, the response includes an error message:

```json
{
  "type": "response",
  "command": "set_model",
  "success": false,
  "error": "No API key available for provider 'anthropic'",
  "id": "req-8"
}
```

All error responses have `success: false` and include an `error` string describing what went wrong.

## RpcClient

For programmatic access from Node.js, use the `RpcClient` class instead of raw stdin/stdout communication:

```typescript
import { RpcClient } from "@mariozechner/pi-coding-agent";

const client = new RpcClient({
  cwd: "/path/to/project",
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
});

await client.start();

// Subscribe to events
const unsubscribe = client.onEvent((event) => {
  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "text_delta"
  ) {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

// Send prompt and wait for completion
const events = await client.promptAndWait("What files are here?");

// Or send prompt and handle events via callback
await client.prompt("Explain the codebase");
await client.waitForIdle(60000); // timeout in ms

// Other operations
const state = await client.getState();
await client.setModel("openai", "gpt-4o");
await client.setThinkingLevel("high");
await client.compact("Focus on recent changes");
const stats = await client.getSessionStats();
const messages = await client.getMessages();
const commands = await client.getCommands();

// Cleanup
unsubscribe();
await client.stop();
```
