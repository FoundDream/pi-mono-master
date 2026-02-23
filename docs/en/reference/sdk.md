---
title: SDK
---

# SDK

The pi SDK provides programmatic access to agent capabilities through the `@mariozechner/pi-coding-agent` package. Use it to embed pi in applications, build custom interfaces, or create automated workflows.

## Installation

```bash
npm install @mariozechner/pi-coding-agent
```

## Quick Start

```typescript
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

const authStorage = AuthStorage.create();
const modelRegistry = new ModelRegistry(authStorage);

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

session.subscribe((event) => {
  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "text_delta"
  ) {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("What files are in the current directory?");
```

## Core Concepts

### createAgentSession()

The primary factory function that initializes an `AgentSession`. It discovers extensions, skills, and templates via `DefaultResourceLoader` unless overridden.

```typescript
interface CreateAgentSessionOptions {
  /** Working directory for project-local discovery. Default: process.cwd() */
  cwd?: string;
  /** Global config directory. Default: ~/.pi/agent */
  agentDir?: string;
  /** Auth storage for credentials. Default: new AuthStorage(agentDir/auth.json) */
  authStorage?: AuthStorage;
  /** Model registry. Default: new ModelRegistry(authStorage, agentDir/models.json) */
  modelRegistry?: ModelRegistry;
  /** Model to use. Default: from settings, else first available */
  model?: Model<any>;
  /** Thinking level. Default: from settings, else 'medium' (clamped to model capabilities) */
  thinkingLevel?: ThinkingLevel;
  /** Models available for cycling (Ctrl+P in interactive mode) */
  scopedModels?: Array<{ model: Model<any>; thinkingLevel: ThinkingLevel }>;
  /** Built-in tools to use. Default: codingTools [read, bash, edit, write] */
  tools?: Tool[];
  /** Custom tools to register (in addition to built-in tools). */
  customTools?: ToolDefinition[];
  /** Resource loader. When omitted, DefaultResourceLoader is used. */
  resourceLoader?: ResourceLoader;
  /** Session manager. Default: SessionManager.create(cwd) */
  sessionManager?: SessionManager;
  /** Settings manager. Default: SettingsManager.create(cwd, agentDir) */
  settingsManager?: SettingsManager;
}

interface CreateAgentSessionResult {
  /** The created session */
  session: AgentSession;
  /** Extensions result (for UI context setup in interactive mode) */
  extensionsResult: LoadExtensionsResult;
  /** Warning if session was restored with a different model than saved */
  modelFallbackMessage?: string;
}
```

### AgentSession Interface

Core capabilities:

| Category        | Methods                                                                                 | Description                                          |
| --------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Messaging       | `prompt()`, `steer()`, `followUp()`                                                     | Send instructions to the agent                       |
| Custom Messages | `sendCustomMessage()`, `sendUserMessage()`                                              | Inject custom or user messages                       |
| Events          | `subscribe()`                                                                           | Receive streaming output and lifecycle notifications |
| Model Control   | `setModel()`, `cycleModel()`, `setThinkingLevel()`, `cycleThinkingLevel()`              | Switch models and thinking                           |
| State           | `state`, `messages`, `isStreaming`, `model`, `thinkingLevel`                            | Access conversation data                             |
| Tools           | `getActiveToolNames()`, `getAllTools()`, `setActiveToolsByName()`                       | Manage active tools                                  |
| Queue           | `clearQueue()`, `pendingMessageCount`, `getSteeringMessages()`, `getFollowUpMessages()` | Manage message queues                                |
| Session         | `newSession()`, `switchSession()`, `fork()`, `navigateTree()`                           | Manage session lifecycle                             |
| Compaction      | `compact()`, `abortCompaction()`, `setAutoCompactionEnabled()`                          | Context compaction                                   |
| Bash            | `executeBash()`, `abortBash()`                                                          | Execute shell commands                               |
| Lifecycle       | `abort()`, `dispose()`, `reload()`                                                      | Control agent lifecycle                              |

### Prompting Behavior

During active streaming, prompts require explicit `streamingBehavior`:

- **`"steer"`**: Interrupts current operation, delivered after existing tool executions complete. Remaining tool calls in the current turn are skipped.
- **`"followUp"`**: Queued for delivery after the agent finishes all processing (no more tool calls or steering messages).

```typescript
interface PromptOptions {
  /** Whether to expand file-based prompt templates (default: true) */
  expandPromptTemplates?: boolean;
  /** Image attachments */
  images?: ImageContent[];
  /** When streaming, how to queue the message. Required if streaming. */
  streamingBehavior?: "steer" | "followUp";
  /** Source of input for extension input event handlers. Defaults to "interactive". */
  source?: InputSource;
}
```

File-based prompt templates expand automatically before sending. Extension commands execute immediately but cannot be queued.

### Events

Subscribe to lifecycle events via `session.subscribe()`:

```typescript
type AgentSessionEvent =
  // Core agent events
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
    }
  // Session-specific events
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

The `AssistantMessageEvent` provides fine-grained streaming deltas:

| Event Type                                           | Description                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| `start`                                              | Assistant message streaming begins                             |
| `text_start` / `text_delta` / `text_end`             | Text content streaming                                         |
| `thinking_start` / `thinking_delta` / `thinking_end` | Thinking/reasoning streaming                                   |
| `toolcall_start` / `toolcall_delta` / `toolcall_end` | Tool call streaming                                            |
| `done`                                               | Message complete (stop reason: `stop`, `length`, or `toolUse`) |
| `error`                                              | Message errored (stop reason: `aborted` or `error`)            |

## Configuration

### Model Selection

```typescript
import { getModel } from "@mariozechner/pi-ai";

const model = getModel("anthropic", "claude-opus-4-5");
const { session } = await createAgentSession({
  model,
  thinkingLevel: "medium",
});
```

You can cycle models at runtime:

```typescript
// Cycle forward through available models
const result = await session.cycleModel("forward");
// result: { model, thinkingLevel, isScoped }

// Set a specific model
await session.setModel(getModel("openai", "gpt-4o"));

// Set thinking level
session.setThinkingLevel("high");
```

### Tools

Use factory functions when specifying custom `cwd` with explicit tools:

```typescript
import {
  createCodingTools,
  createReadOnlyTools,
  createReadTool,
  createBashTool,
} from "@mariozechner/pi-coding-agent";

const cwd = "/path/to/project";

// Full coding tool set (read, bash, edit, write)
const { session } = await createAgentSession({
  cwd,
  tools: createCodingTools(cwd),
});

// Read-only tools (read, grep, find, ls)
const { session: readOnlySession } = await createAgentSession({
  cwd,
  tools: createReadOnlyTools(cwd),
});
```

Available tool sets and factory functions:

| Export                     | Tools Included          | Description                   |
| -------------------------- | ----------------------- | ----------------------------- |
| `codingTools`              | read, bash, edit, write | Default tool set              |
| `readOnlyTools`            | read, grep, find, ls    | Safe read-only access         |
| `createCodingTools(cwd)`   | read, bash, edit, write | With custom working directory |
| `createReadOnlyTools(cwd)` | read, grep, find, ls    | With custom working directory |
| `createReadTool(cwd)`      | read                    | Individual tool factory       |
| `createBashTool(cwd)`      | bash                    | Individual tool factory       |
| `createEditTool(cwd)`      | edit                    | Individual tool factory       |
| `createWriteTool(cwd)`     | write                   | Individual tool factory       |
| `createGrepTool(cwd)`      | grep                    | Individual tool factory       |
| `createFindTool(cwd)`      | find                    | Individual tool factory       |
| `createLsTool(cwd)`        | ls                      | Individual tool factory       |

### Custom Tools

```typescript
import { Type } from "@sinclair/typebox";

const myTool: ToolDefinition = {
  name: "my_tool",
  description: "Custom functionality",
  parameters: Type.Object({ input: Type.String() }),
  execute: async (toolCallId, params, onUpdate, ctx, signal) => ({
    content: [{ type: "text", text: `Result: ${params.input}` }],
    details: {},
  }),
};

const { session } = await createAgentSession({
  customTools: [myTool],
});
```

### Extensions

```typescript
const loader = new DefaultResourceLoader({
  additionalExtensionPaths: ["/path/to/extension.ts"],
  extensionFactories: [
    (pi) => {
      pi.on("agent_start", () => console.log("Agent starting"));
      pi.on("turn_end", (event) => {
        console.log(
          "Turn ended with",
          event.toolResults.length,
          "tool results",
        );
      });
    },
  ],
});
```

### Session Management

```typescript
// In-memory (no persistence)
const sm = SessionManager.inMemory();

// Persistent sessions (new session in default directory)
const sm = SessionManager.create(process.cwd());

// Continue most recent session, or create new if none
const sm = SessionManager.continueRecent(process.cwd());

// Open specific session file
const sm = SessionManager.open("/path/to/session.jsonl");

// Fork from another project's session
const sm = SessionManager.forkFrom("/source/session.jsonl", process.cwd());

// List available sessions for a directory
const sessions = await SessionManager.list(process.cwd());
// sessions: SessionInfo[] with path, id, cwd, name, created, modified, messageCount, firstMessage

// List all sessions across all project directories
const allSessions = await SessionManager.listAll();
```

### Authentication

Priority order:

1. Runtime overrides via `authStorage.setRuntimeApiKey()`
2. Stored credentials in `auth.json`
3. Environment variables
4. Custom provider fallback resolvers

```typescript
const authStorage = AuthStorage.create("/custom/path/auth.json");
authStorage.setRuntimeApiKey("anthropic", "sk-...");

const { session } = await createAgentSession({
  authStorage,
});
```

### Settings

```typescript
// In-memory settings (no file persistence)
const settingsManager = SettingsManager.inMemory({
  compaction: { enabled: false },
  retry: { enabled: true, maxRetries: 5 },
});

// File-based settings
const settingsManager = SettingsManager.create(process.cwd());

const { session } = await createAgentSession({
  settingsManager,
});
```

## Run Modes

### InteractiveMode

Full terminal UI with editor and chat:

```typescript
import { InteractiveMode } from "@mariozechner/pi-coding-agent";

const mode = new InteractiveMode(session, {
  initialMessage: "Hello",
  verbose: true,
});
await mode.run();
```

### runPrintMode

Single-shot execution with text or JSON output:

```typescript
import { runPrintMode } from "@mariozechner/pi-coding-agent";

// Text mode - outputs final response only
await runPrintMode(session, {
  mode: "text",
  initialMessage: "List all TypeScript files",
});

// JSON mode - outputs all events as JSON lines
await runPrintMode(session, {
  mode: "json",
  initialMessage: "Hello",
  messages: ["Follow up question"],
});
```

### runRpcMode

JSON-RPC subprocess integration for embedding in other applications:

```typescript
import { runRpcMode } from "@mariozechner/pi-coding-agent";

// Starts listening on stdin, outputs on stdout
await runRpcMode(session);
```

### RpcClient

High-level client for communicating with an RPC-mode agent process:

```typescript
import { RpcClient } from "@mariozechner/pi-coding-agent";

const client = new RpcClient({
  cwd: "/path/to/project",
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
});

await client.start();

client.onEvent((event) => {
  if (event.type === "message_update") {
    // Handle streaming updates
  }
});

const events = await client.promptAndWait("What files are here?");
await client.stop();
```
