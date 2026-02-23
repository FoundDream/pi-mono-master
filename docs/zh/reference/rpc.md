# RPC 模式

RPC 模式通过 stdin/stdout 上的 JSON 协议实现编码智能体的无头操作。适用于将智能体嵌入其他应用、IDE 或自定义 UI。

**Node.js/TypeScript 用户注意**：如果你正在构建 Node.js 应用，建议直接使用 `@mariozechner/pi-coding-agent` 中的 `AgentSession`，而不是启动子进程。

## 启动 RPC 模式

```bash
pi --mode rpc [options]
```

常用选项：

- `--provider <name>`：设置 LLM Provider（anthropic、openai、google 等）
- `--model <pattern>`：模型模式或 ID（支持 `provider/id` 和可选的 `:<thinking>`）
- `--no-session`：禁用会话持久化
- `--session-dir <path>`：自定义会话存储目录

## 核心协议

- **命令**：发送到 stdin 的 JSON 对象，每行一个
- **响应**：带有 `type: "response"` 的 JSON 对象，指示命令成功/失败
- **事件**：智能体事件以 JSON 行的形式流式输出到 stdout

所有命令支持可选的 `id` 字段用于请求/响应关联。如果提供，对应的响应将包含相同的 `id`。

## 命令

### 提示相关

#### prompt

向智能体发送用户提示。立即返回；事件异步流式传输。

```json
{ "id": "req-1", "type": "prompt", "message": "Hello, world!" }
```

带图片：

```json
{
  "type": "prompt",
  "message": "What's in this image?",
  "images": [
    { "type": "image", "data": "base64-encoded-data", "mimeType": "image/png" }
  ]
}
```

**流式传输期间**：如果智能体已在流式传输，必须指定 `streamingBehavior` 来排队消息：

```json
{ "type": "prompt", "message": "New instruction", "streamingBehavior": "steer" }
```

- `"steer"`：中断智能体。消息在当前工具执行后送达，跳过剩余工具。
- `"followUp"`：等待智能体完成。消息仅在智能体停止后送达。

如果智能体正在流式传输且未指定 `streamingBehavior`，命令返回错误。

**扩展命令**：如果消息是扩展命令（如 `/mycommand`），即使在流式传输期间也立即执行。

**输入展开**：技能命令（`/skill:name`）和提示模板（`/template`）在发送/排队前展开。

响应：

```json
{ "id": "req-1", "type": "response", "command": "prompt", "success": true }
```

#### steer

排队一条引导消息以中断智能体。在当前工具执行后送达，跳过剩余工具。

```json
{ "type": "steer", "message": "Stop and do this instead" }
```

带图片：

```json
{
  "type": "steer",
  "message": "Look at this instead",
  "images": [
    { "type": "image", "data": "base64-encoded-data", "mimeType": "image/png" }
  ]
}
```

响应：

```json
{ "type": "response", "command": "steer", "success": true }
```

#### follow_up

排队一条后续消息，在智能体完成后处理。

```json
{ "type": "follow_up", "message": "After you're done, also do this" }
```

响应：

```json
{ "type": "response", "command": "follow_up", "success": true }
```

#### abort

中止当前智能体操作。

```json
{ "type": "abort" }
```

响应：

```json
{ "type": "response", "command": "abort", "success": true }
```

#### new_session

开始新的会话。可被 `session_before_switch` 扩展事件处理程序取消。

```json
{ "type": "new_session" }
```

带可选父会话追踪：

```json
{ "type": "new_session", "parentSession": "/path/to/parent-session.jsonl" }
```

响应：

```json
{
  "type": "response",
  "command": "new_session",
  "success": true,
  "data": { "cancelled": false }
}
```

### 状态相关

#### get_state

获取当前会话状态。

```json
{ "type": "get_state" }
```

响应：

```json
{
  "type": "response",
  "command": "get_state",
  "success": true,
  "data": {
    "model": {...},
    "thinkingLevel": "medium",
    "isStreaming": false,
    "isCompacting": false,
    "steeringMode": "all",
    "followUpMode": "one-at-a-time",
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "abc123",
    "sessionName": "my-feature-work",
    "autoCompactionEnabled": true,
    "messageCount": 5,
    "pendingMessageCount": 0
  }
}
```

`model` 字段是完整的 Model 对象或 `null`。`sessionName` 字段是通过 `set_session_name` 设置的显示名称，未设置时省略。

#### get_messages

获取对话中的所有消息。

```json
{ "type": "get_messages" }
```

响应：

```json
{
  "type": "response",
  "command": "get_messages",
  "success": true,
  "data": {"messages": [...]}
}
```

### 模型相关

#### set_model

切换到特定模型。

```json
{
  "type": "set_model",
  "provider": "anthropic",
  "modelId": "claude-sonnet-4-20250514"
}
```

#### cycle_model

循环切换到下一个可用模型。如果只有一个模型可用，返回 `null`。

```json
{ "type": "cycle_model" }
```

#### get_available_models

列出所有已配置的模型。

```json
{ "type": "get_available_models" }
```

### 思考相关

#### set_thinking_level

设置推理/思考级别。

```json
{ "type": "set_thinking_level", "level": "high" }
```

级别：`"off"`、`"minimal"`、`"low"`、`"medium"`、`"high"`、`"xhigh"`

注意：`"xhigh"` 仅被 OpenAI codex-max 模型支持。

#### cycle_thinking_level

循环切换思考级别。如果模型不支持思考，返回 `null`。

```json
{ "type": "cycle_thinking_level" }
```

### 队列模式

#### set_steering_mode

控制引导消息（来自 `steer`）的送达方式。

```json
{ "type": "set_steering_mode", "mode": "one-at-a-time" }
```

模式：

- `"all"`：在下一个中断点送达所有引导消息
- `"one-at-a-time"`：每次中断送达一条引导消息（默认）

#### set_follow_up_mode

控制后续消息（来自 `follow_up`）的送达方式。

```json
{ "type": "set_follow_up_mode", "mode": "one-at-a-time" }
```

模式：

- `"all"`：智能体完成时送达所有后续消息
- `"one-at-a-time"`：每次完成送达一条后续消息（默认）

### 压缩相关

#### compact

手动压缩对话上下文以减少 token 使用。

```json
{ "type": "compact" }
```

带自定义指令：

```json
{ "type": "compact", "customInstructions": "Focus on code changes" }
```

响应：

```json
{
  "type": "response",
  "command": "compact",
  "success": true,
  "data": {
    "summary": "Summary of conversation...",
    "firstKeptEntryId": "abc123",
    "tokensBefore": 150000,
    "details": {}
  }
}
```

#### set_auto_compaction

启用或禁用上下文接近满时的自动压缩。

```json
{ "type": "set_auto_compaction", "enabled": true }
```

### 重试相关

#### set_auto_retry

启用或禁用临时错误（过载、速率限制、5xx）时的自动重试。

```json
{ "type": "set_auto_retry", "enabled": true }
```

#### abort_retry

中止正在进行的重试（取消延迟并停止重试）。

```json
{ "type": "abort_retry" }
```

### Bash

#### bash

执行 shell 命令并将输出添加到对话上下文。

```json
{ "type": "bash", "command": "ls -la" }
```

响应：

```json
{
  "type": "response",
  "command": "bash",
  "success": true,
  "data": {
    "output": "total 48\ndrwxr-xr-x ...",
    "exitCode": 0,
    "cancelled": false,
    "truncated": false
  }
}
```

**Bash 结果如何到达 LLM：**

`bash` 命令立即执行并返回 `BashResult`。内部创建的 `BashExecutionMessage` 存储在智能体的消息状态中。此消息不会发出事件。

当下一个 `prompt` 命令发送时，所有消息（包括 `BashExecutionMessage`）在发送给 LLM 之前会被转换。这意味着：

1. Bash 输出包含在**下一个提示**的 LLM 上下文中，而非立即
2. 可以在一个提示之前执行多个 bash 命令；所有输出都将被包含
3. `BashExecutionMessage` 本身不会发出事件

#### abort_bash

中止正在运行的 bash 命令。

```json
{ "type": "abort_bash" }
```

### 会话相关

#### get_session_stats

获取 token 使用和费用统计。

```json
{ "type": "get_session_stats" }
```

响应：

```json
{
  "type": "response",
  "command": "get_session_stats",
  "success": true,
  "data": {
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "abc123",
    "userMessages": 5,
    "assistantMessages": 5,
    "toolCalls": 12,
    "toolResults": 12,
    "totalMessages": 22,
    "tokens": {
      "input": 50000,
      "output": 10000,
      "cacheRead": 40000,
      "cacheWrite": 5000,
      "total": 105000
    },
    "cost": 0.45
  }
}
```

#### export_html

将会话导出为 HTML 文件。

```json
{ "type": "export_html" }
```

带自定义路径：

```json
{ "type": "export_html", "outputPath": "/tmp/session.html" }
```

#### switch_session

加载不同的会话文件。可被 `session_before_switch` 扩展事件处理程序取消。

```json
{ "type": "switch_session", "sessionPath": "/path/to/session.jsonl" }
```

#### fork

从之前的用户消息创建新的分支。

```json
{ "type": "fork", "entryId": "abc123" }
```

响应：

```json
{
  "type": "response",
  "command": "fork",
  "success": true,
  "data": { "text": "The original prompt text...", "cancelled": false }
}
```

#### get_fork_messages

获取可用于分支的用户消息。

```json
{ "type": "get_fork_messages" }
```

#### get_last_assistant_text

获取最后一条助手消息的文本内容。

```json
{ "type": "get_last_assistant_text" }
```

#### set_session_name

设置当前会话的显示名称。

```json
{ "type": "set_session_name", "name": "my-feature-work" }
```

### 命令查询

#### get_commands

获取可用命令（扩展命令、提示模板和技能）。这些可以通过在 `prompt` 命令中加 `/` 前缀来调用。

```json
{ "type": "get_commands" }
```

响应：

```json
{
  "type": "response",
  "command": "get_commands",
  "success": true,
  "data": {
    "commands": [
      {
        "name": "session-name",
        "description": "Set or clear session name",
        "source": "extension",
        "path": "/home/user/.pi/agent/extensions/session.ts"
      },
      {
        "name": "fix-tests",
        "description": "Fix failing tests",
        "source": "prompt",
        "location": "project",
        "path": "/home/user/myproject/.pi/agent/prompts/fix-tests.md"
      },
      {
        "name": "skill:brave-search",
        "description": "Web search via Brave API",
        "source": "skill",
        "location": "user",
        "path": "/home/user/.pi/agent/skills/brave-search/SKILL.md"
      }
    ]
  }
}
```

每个命令包含：

- `name`：命令名称（通过 `/name` 调用）
- `description`：人类可读的描述（扩展命令为可选）
- `source`：命令类型 - `"extension"`、`"prompt"` 或 `"skill"`
- `location`：加载来源（可选）- `"user"`、`"project"` 或 `"path"`
- `path`：命令源的绝对文件路径（可选）

## 事件流

事件在智能体运行期间以 JSON 行的形式流式输出到 stdout。事件不包含 `id` 字段（仅响应包含）。

### 事件类型

| 事件                    | 说明                                    |
| ----------------------- | --------------------------------------- |
| `agent_start`           | 智能体开始处理                          |
| `agent_end`             | 智能体完成（包含所有生成的消息）        |
| `turn_start`            | 新轮次开始                              |
| `turn_end`              | 轮次完成（包含助手消息和工具结果）      |
| `message_start`         | 消息开始                                |
| `message_update`        | 流式更新（text/thinking/toolcall 增量） |
| `message_end`           | 消息完成                                |
| `tool_execution_start`  | 工具开始执行                            |
| `tool_execution_update` | 工具执行进度（流式输出）                |
| `tool_execution_end`    | 工具完成                                |
| `auto_compaction_start` | 自动压缩开始                            |
| `auto_compaction_end`   | 自动压缩完成                            |
| `auto_retry_start`      | 自动重试开始（临时错误后）              |
| `auto_retry_end`        | 自动重试完成（成功或最终失败）          |
| `extension_error`       | 扩展抛出错误                            |

### message_update（流式传输）

在助手消息流式传输期间发出。包含部分消息和流式增量事件。

```json
{
  "type": "message_update",
  "message": {...},
  "assistantMessageEvent": {
    "type": "text_delta",
    "contentIndex": 0,
    "delta": "Hello ",
    "partial": {...}
  }
}
```

`assistantMessageEvent` 字段包含以下增量类型之一：

| 类型             | 说明                                                  |
| ---------------- | ----------------------------------------------------- |
| `start`          | 消息生成开始                                          |
| `text_start`     | 文本内容块开始                                        |
| `text_delta`     | 文本内容片段                                          |
| `text_end`       | 文本内容块结束                                        |
| `thinking_start` | 思考块开始                                            |
| `thinking_delta` | 思考内容片段                                          |
| `thinking_end`   | 思考块结束                                            |
| `toolcall_start` | 工具调用开始                                          |
| `toolcall_delta` | 工具调用参数片段                                      |
| `toolcall_end`   | 工具调用结束（包含完整 `toolCall` 对象）              |
| `done`           | 消息完成（reason: `"stop"`、`"length"`、`"toolUse"`） |
| `error`          | 发生错误（reason: `"aborted"`、`"error"`）            |

### 图像支持

`prompt`、`steer`、`follow_up` 命令的 `images` 字段是可选的。每个图像使用 `ImageContent` 格式：

```json
{ "type": "image", "data": "base64-encoded-data", "mimeType": "image/png" }
```

### tool_execution 事件

```json
{
  "type": "tool_execution_start",
  "toolCallId": "call_abc123",
  "toolName": "bash",
  "args": { "command": "ls -la" }
}
```

执行期间，`tool_execution_update` 事件流式传输部分结果：

```json
{
  "type": "tool_execution_update",
  "toolCallId": "call_abc123",
  "toolName": "bash",
  "args": { "command": "ls -la" },
  "partialResult": {
    "content": [{ "type": "text", "text": "partial output so far..." }],
    "details": { "truncation": null, "fullOutputPath": null }
  }
}
```

使用 `toolCallId` 关联事件。`tool_execution_update` 中的 `partialResult` 包含截至目前的累积输出（非仅增量），允许客户端在每次更新时直接替换显示内容。

## 扩展 UI 子协议

扩展可以通过 `ctx.ui.select()`、`ctx.ui.confirm()` 等请求用户交互。在 RPC 模式中，这些被转换为基于基础命令/事件流之上的请求/响应子协议。

有两类扩展 UI 方法：

- **对话方法**（`select`、`confirm`、`input`、`editor`）：在 stdout 上发出 `extension_ui_request`，并阻塞直到客户端在 stdin 上发回匹配 `id` 的 `extension_ui_response`。
- **即发即忘方法**（`notify`、`setStatus`、`setWidget`、`setTitle`、`set_editor_text`）：在 stdout 上发出 `extension_ui_request`，但不期望响应。

### 扩展 UI 请求（stdout）

所有请求都有 `type: "extension_ui_request"`、唯一 `id` 和 `method` 字段。

#### select

```json
{
  "type": "extension_ui_request",
  "id": "uuid-1",
  "method": "select",
  "title": "Allow dangerous command?",
  "options": ["Allow", "Block"],
  "timeout": 10000
}
```

#### confirm

```json
{
  "type": "extension_ui_request",
  "id": "uuid-2",
  "method": "confirm",
  "title": "Clear session?",
  "message": "All messages will be lost.",
  "timeout": 5000
}
```

#### input

```json
{
  "type": "extension_ui_request",
  "id": "uuid-3",
  "method": "input",
  "title": "Enter a value",
  "placeholder": "type something..."
}
```

#### editor

```json
{
  "type": "extension_ui_request",
  "id": "uuid-4",
  "method": "editor",
  "title": "Edit some text",
  "prefill": "Line 1\nLine 2\nLine 3"
}
```

#### notify

显示通知。即发即忘，无需响应。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-5",
  "method": "notify",
  "message": "Command blocked by user",
  "notifyType": "warning"
}
```

`notifyType` 字段为 `"info"`、`"warning"` 或 `"error"`。

#### setStatus

设置或清除状态栏中的状态条目。即发即忘。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-6",
  "method": "setStatus",
  "statusKey": "my-ext",
  "statusText": "Turn 3 running..."
}
```

#### setWidget

设置或清除编辑器上方或下方的小部件。即发即忘。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-7",
  "method": "setWidget",
  "widgetKey": "my-ext",
  "widgetLines": ["--- My Widget ---", "Line 1", "Line 2"],
  "widgetPlacement": "aboveEditor"
}
```

#### setTitle

设置终端窗口/标签页标题。即发即忘。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-8",
  "method": "setTitle",
  "title": "pi - my project"
}
```

#### set_editor_text

设置输入编辑器中的文本。即发即忘。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-9",
  "method": "set_editor_text",
  "text": "prefilled text for the user"
}
```

### 扩展 UI 响应（stdin）

响应仅针对对话方法（`select`、`confirm`、`input`、`editor`）发送。`id` 必须与请求匹配。

#### 值响应（select、input、editor）

```json
{ "type": "extension_ui_response", "id": "uuid-1", "value": "Allow" }
```

#### 确认响应（confirm）

```json
{ "type": "extension_ui_response", "id": "uuid-2", "confirmed": true }
```

#### 取消响应（任意对话方法）

```json
{ "type": "extension_ui_response", "id": "uuid-3", "cancelled": true }
```

## 错误响应

命令失败时返回 `success: false` 的响应：

```json
{
  "type": "response",
  "command": "set_model",
  "success": false,
  "error": "Model not found: invalid/model"
}
```

解析错误：

```json
{
  "type": "response",
  "command": "parse",
  "success": false,
  "error": "Failed to parse command: Unexpected token..."
}
```

## 示例：基本客户端（Python）

```python
import subprocess
import json

proc = subprocess.Popen(
    ["pi", "--mode", "rpc", "--no-session"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    text=True
)

def send(cmd):
    proc.stdin.write(json.dumps(cmd) + "\n")
    proc.stdin.flush()

def read_events():
    for line in proc.stdout:
        yield json.loads(line)

# 发送提示
send({"type": "prompt", "message": "Hello!"})

# 处理事件
for event in read_events():
    if event.get("type") == "message_update":
        delta = event.get("assistantMessageEvent", {})
        if delta.get("type") == "text_delta":
            print(delta["delta"], end="", flush=True)

    if event.get("type") == "agent_end":
        print()
        break
```

## 示例：交互式客户端（Node.js）

```javascript
const { spawn } = require("child_process");
const readline = require("readline");

const agent = spawn("pi", ["--mode", "rpc", "--no-session"]);

readline.createInterface({ input: agent.stdout }).on("line", (line) => {
  const event = JSON.parse(line);

  if (event.type === "message_update") {
    const { assistantMessageEvent } = event;
    if (assistantMessageEvent.type === "text_delta") {
      process.stdout.write(assistantMessageEvent.delta);
    }
  }
});

// 发送提示
agent.stdin.write(JSON.stringify({ type: "prompt", message: "Hello" }) + "\n");

// Ctrl+C 时中止
process.on("SIGINT", () => {
  agent.stdin.write(JSON.stringify({ type: "abort" }) + "\n");
});
```
