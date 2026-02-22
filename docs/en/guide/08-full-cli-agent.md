# 08 - Full CLI Agent

The grand finale -- a complete, production-quality CLI agent that combines every pattern from chapters 01 through 07 into a single cohesive application.

## Why This Chapter Matters

Over the previous seven chapters, you have learned each building block of an AI agent in isolation: model creation, streaming, custom tools, session persistence, confirmation gating, system prompts with skills, and multi-session management. Each chapter focused on one concept with minimal code.

Real applications do not work that way. In production, all of these pieces must work together harmoniously: streaming must not interfere with confirmation prompts, session switching must clean up event listeners, abort signals must propagate through tool execution, and the REPL must remain responsive during long-running operations.

This chapter shows you how to compose those building blocks into a single, well-structured CLI agent. More importantly, it introduces two new production-critical patterns:

1. **DeltaBatcher** -- a buffering layer that smooths out the character-by-character stuttering of raw LLM streaming into fluid, readable terminal output.
2. **Abort handling** -- graceful cancellation of in-progress generation via Ctrl+C, so users are never trapped waiting for a runaway response.

By the end of this chapter, you will have a fully functional agent that can read and write files, execute shell commands, look up weather, manage multiple sessions, require confirmation for dangerous operations, and be interrupted at any time.

## Architecture Overview

The agent is organized into four modules, each with a clear responsibility:

```
index.ts      -- Main entry, REPL loop, Ctrl+C handling
runtime.ts    -- AgentRuntime class (session lifecycle, DeltaBatcher, confirmation)
tools.ts      -- Custom tool definitions
commands.ts   -- REPL command parser (/sessions, /new, /open, etc.)
```

### How the Pieces Fit Together

Here is how the major components interact at runtime:

```
┌─────────────────────────────────────────────────────────────┐
│                        index.ts                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  readline    │  │  SIGINT      │  │  handleCommand()  │  │
│  │  REPL loop   │  │  handler     │  │  (commands.ts)    │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                 │                    │             │
│         ▼                 ▼                    ▼             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   AgentRuntime                          ││
│  │  (runtime.ts)                                           ││
│  │                                                         ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ ││
│  │  │ AgentSession  │  │ DeltaBatcher │  │ Confirmation │ ││
│  │  │ (pi-agent)    │  │ (32ms batch) │  │ Waiter       │ ││
│  │  └───────┬───────┘  └──────┬───────┘  └──────┬───────┘ ││
│  │          │                 │                   │        ││
│  │          │    subscribe    │                   │        ││
│  │          ├─────────────────▶ push(delta)       │        ││
│  │          │                 │                   │        ││
│  │          │                 ├──► stdout.write()  │        ││
│  │          │                 │                   │        ││
│  │          │  tool execute   │                   │        ││
│  │          ├─────────────────┼───────────────────▶ await  ││
│  │          │                 │                   │        ││
│  └──────────┼─────────────────┼───────────────────┼────────┘│
│             │                 │                   │         │
│             ▼                 │                   │         │
│  ┌──────────────────┐         │                   │         │
│  │  tools.ts         │         │                   │         │
│  │  weather, time,   │─────────┘                   │         │
│  │  dangerous_op     │─────────────────────────────┘         │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

The data flow follows a clean pipeline:

1. **User input** enters via the readline REPL in `index.ts`
2. **Slash commands** (like `/sessions`, `/new`) are intercepted by `handleCommand()` in `commands.ts` and handled without involving the LLM
3. **Regular prompts** are forwarded to `AgentRuntime.prompt()`, which sends them to the underlying `AgentSession`
4. **Streaming responses** flow back through the event subscription, through the `DeltaBatcher`, and into `stdout`
5. **Tool calls** are dispatched to tool definitions in `tools.ts`, some of which require confirmation via the `ConfirmationWaiter`
6. **Ctrl+C** triggers the SIGINT handler, which calls `runtime.abort()` to cancel any in-progress generation

## Features

| Feature | Source Chapter | What It Adds |
|---------|---------------|--------------|
| Model creation from env | Ch 01 | Flexible provider switching via env vars |
| Streaming with DeltaBatcher | Ch 02 | Smooth, batched terminal output |
| Custom tools (weather, time) | Ch 03 | Domain-specific capabilities |
| Session persistence (JSONL) | Ch 04 | Conversation continuity across restarts |
| Tool confirmation pattern | Ch 05 | Safety gating for dangerous operations |
| System prompt + Skills | Ch 06 | Agent personality and domain knowledge |
| Multi-session management | Ch 07 | Independent conversation threads |
| Coding tools (read, write, edit, bash) | New | File system and shell access |
| Abort with Ctrl+C | New | Graceful cancellation of generation |

## Commands

| Command | Description |
|---------|-------------|
| `/sessions` | List all saved sessions |
| `/new` | Start a new session |
| `/open <n>` | Open session N from list |
| `/continue` | Resume most recent session |
| `/abort` | Abort current streaming |
| `/help` | Show all commands |
| `/quit` | Exit |

## Deep Dive: DeltaBatcher

### The Problem

When an LLM streams a response, it emits text in tiny fragments -- often just one or two characters at a time. If you write each fragment directly to the terminal with `process.stdout.write()`, you get visible character-by-character stuttering:

```
H...e...l...l...o...,...... ...h...o...w...
```

This is distracting and makes the agent feel slow, even though the total time to complete the response is the same. The issue is purely perceptual: humans read in chunks, not characters.

### The Solution

`DeltaBatcher` is a small utility that collects incoming text fragments and flushes them in batches on a fixed interval. Instead of writing "H", "e", "l", "l", "o" as five separate operations, it waits a short period and writes "Hello" as a single operation.

The result is smooth, fluid text output that feels like a human typing at a natural pace.

```typescript
class DeltaBatcher {
  private pendingText = ''
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly onFlush: (text: string) => void,
    private readonly intervalMs = 32
  ) {}

  push(delta: string): void {
    this.pendingText += delta
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null
        const text = this.pendingText
        this.pendingText = ''
        if (text) this.onFlush(text)
      }, this.intervalMs)
    }
  }

  flush(): void {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null }
    const text = this.pendingText
    this.pendingText = ''
    if (text) this.onFlush(text)
  }
}
```

### Why 32 Milliseconds?

The default batch interval is 32ms, and this number is not arbitrary. Here is the reasoning:

- **16ms** is one frame at 60fps -- the threshold below which humans cannot perceive individual updates. This would be smooth but produces very small batches (often still just 1-2 characters).
- **32ms** (two frames at 60fps) is the sweet spot. It collects enough characters per batch to produce readable chunks (typically 3-10 characters depending on model speed), while still being fast enough that the output feels real-time.
- **100ms+** would produce noticeably chunky output -- the text would appear in bursts rather than flowing.

The 32ms interval also has a practical benefit: it roughly aligns with the typical token generation interval of fast LLM providers. Most models emit tokens every 20-50ms, so a 32ms batch interval usually collects one full token per flush -- exactly the right granularity for readable output.

:::tip
The batch interval is configurable via the constructor. If you are building an agent for a slower connection or model, try increasing it to 50-100ms. For a local model that generates tokens very quickly, you might decrease it to 16ms. Tune it based on your use case.
:::

### How DeltaBatcher Integrates

In the `AgentRuntime`, the batcher sits between the event subscription and the terminal:

```typescript
// Without DeltaBatcher (stuttery):
session.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    process.stdout.write(event.assistantMessageEvent.delta)  // "H", "e", "l", "l", "o"
  }
})

// With DeltaBatcher (smooth):
const batcher = new DeltaBatcher((text) => process.stdout.write(text))
session.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    batcher.push(event.assistantMessageEvent.delta)  // Collects, then "Hello, how"
  }
})
```

The `flush()` method is called when the response completes, ensuring any remaining buffered text is written out immediately. Without this, the last few characters of a response might be stuck in the buffer.

## Deep Dive: The Abort Pattern

### Why Abort Matters

Sometimes the agent goes off the rails -- it starts writing a 2,000-word essay when you wanted a one-line answer, or it begins executing a sequence of shell commands you did not intend. The user needs an escape hatch.

In a CLI application, the universal escape hatch is **Ctrl+C** (SIGINT). When the user presses Ctrl+C, we want to:

1. **Stop the LLM from generating more text** -- cancel the API request
2. **Stop any in-progress tool execution** -- abort shell commands, file operations, etc.
3. **Return control to the REPL** -- so the user can type a new message or command
4. **Preserve the session** -- the conversation up to the abort point should be saved

### How It Works

```typescript
// In index.ts
process.on('SIGINT', () => {
  runtime.abort()
  console.log('\n🛑 Aborted.')
})
```

Inside `AgentRuntime`, `abort()` calls `session.abort()` on the underlying `AgentSession`. This triggers a cancellation cascade:

1. **The API request is cancelled** via an `AbortController` signal
2. **Tool execution receives the abort** through the `signal` parameter in `execute(toolCallId, params, signal, onUpdate)` -- well-behaved tools check `signal.aborted` periodically
3. **The session emits an abort event** that the event subscription can handle
4. **The DeltaBatcher is flushed** to write out any remaining buffered text

:::warning
Ctrl+C in Node.js sends SIGINT to the process, which by default terminates it. By registering a handler with `process.on('SIGINT', ...)`, we intercept the signal and perform a graceful abort instead. However, pressing Ctrl+C *twice* rapidly will usually force-kill the process (depending on the platform). This is intentional -- it gives the user a way out if the graceful abort hangs.
:::

### Abort and Tool Execution

For tools that perform long-running operations (like shell commands or API calls), the abort signal is propagated through the `signal` parameter:

```typescript
execute: async (_toolCallId, params, signal, onUpdate) => {
  // Pass the signal to fetch calls, child processes, etc.
  const response = await fetch(url, { signal })

  // Or check it periodically in loops
  for (const item of items) {
    if (signal?.aborted) return { content: [{ type: 'text', text: 'Aborted' }], details: {} }
    await processItem(item)
  }
}
```

## AgentRuntime

The `AgentRuntime` class is the central coordinator. It encapsulates all session lifecycle management, confirmation handling, and streaming into a single cohesive API:

```typescript
export class AgentRuntime {
  constructor(config: RuntimeConfig) { ... }

  // Confirmation pattern
  createConfirmationWaiter(): () => Promise<{ confirmed: boolean }>
  confirmTool(): void
  cancelTool(): void

  // Prompting
  async prompt(text: string): Promise<void>
  abort(): void

  // Session management
  newSession(): void
  openSession(sessionPath: string): void
  continueRecentSession(): void
  async listSessions(): Promise<SessionInfo[]>

  // Cleanup
  destroy(): void
}
```

### Why a Runtime Class?

You might wonder why we introduced a class instead of keeping everything as loose functions (like in the earlier chapters). The answer is **state management**. The runtime needs to track:

- The current `AgentSession` instance (which changes on session switch)
- The `DeltaBatcher` instance (which needs flushing on abort and session switch)
- The confirmation waiter (which is shared across tools)
- The `SessionManager` (which changes on session switch)
- Whether a prompt is currently in-progress (to prevent double-prompting)

A class encapsulates this mutable state behind a clean API, preventing the caller from accidentally corrupting it. The alternative -- a bag of global variables -- becomes unmaintainable as complexity grows.

### RuntimeConfig

```typescript
interface RuntimeConfig {
  model: Model<Api>
  cwd: string
  sessionDir: string
  skillsDir?: string
  systemPrompt: string
  customTools?: ToolDefinition[]
  includeCodingTools?: boolean
}
```

The `includeCodingTools` flag deserves special mention. When set to `true`, the runtime includes pi-coding-agent's built-in coding tools: `read`, `write`, `edit`, and `bash`. These tools give the agent the ability to read and modify files on disk and execute shell commands -- powerful capabilities that effectively turn the agent into a coding assistant.

:::warning
Enabling coding tools gives the agent filesystem and shell access. This is powerful but potentially dangerous. Always combine `includeCodingTools: true` with the confirmation pattern for destructive operations, and consider restricting the working directory.
:::

## Main Entry Point

```typescript
import { createModel } from '../../shared/model'
import { AgentRuntime } from './runtime'
import { weatherTool, createTimeTool, createDangerousTool } from './tools'
import { handleCommand } from './commands'

const model = createModel()

const runtime = new AgentRuntime({
  model,
  cwd: process.cwd(),
  sessionDir: SESSION_DIR,
  skillsDir: SKILLS_DIR,
  systemPrompt: 'You are a versatile CLI assistant...',
  customTools: [weatherTool, createTimeTool(), createDangerousTool(waiter)],
  includeCodingTools: true,
})

// Ctrl+C to abort
process.on('SIGINT', () => {
  runtime.abort()
  console.log('\n🛑 Aborted.')
})

// REPL loop
const ask = () => {
  rl.question('You: ', async (input) => {
    if (await handleCommand(input.trim(), runtime)) { ask(); return }
    await runtime.prompt(input.trim())
    ask()
  })
}
ask()
```

Notice how clean the entry point is. All the complexity of session management, streaming, confirmation, and abort handling is hidden inside `AgentRuntime`. The entry point only needs to:

1. Create the runtime with configuration
2. Set up the SIGINT handler
3. Run the REPL loop

This is the payoff of good encapsulation -- the top-level code reads like a description of what the application does, not how it does it.

## Command Handler

The command handler is extracted into a separate module for testability and separation of concerns. It takes user input and the runtime, and returns `true` if the input was a command (so the REPL knows not to send it to the LLM):

```typescript
export async function handleCommand(input: string, runtime: AgentRuntime): Promise<boolean> {
  if (!input.startsWith('/')) return false

  switch (input.split(' ')[0]) {
    case '/help':     printHelp(); return true
    case '/sessions': /* list sessions */; return true
    case '/new':      runtime.newSession(); return true
    case '/open':     /* open by index */; return true
    case '/continue': runtime.continueRecentSession(); return true
    case '/abort':    runtime.abort(); return true
    case '/quit':     runtime.destroy(); process.exit(0)
    default:          console.log('Unknown command'); return true
  }
}
```

:::tip
The `handleCommand()` function returns a boolean to support the "intercept" pattern: if the input is a command, handle it and return `true` so the caller skips the prompt step. If it is not a command, return `false` so the caller knows to send it to the LLM. This clean separation means neither the REPL loop nor the command handler need to know about each other's internals.
:::

## Run

```bash
bun run ch08
```

## Try It

```
You: What time is it?
🔧 get_current_time({})
✅ Done
Agent: It's 2025-06-15T14:30:00.000Z

You: Read the file package.json
🔧 read({"file_path":"package.json"})
✅ Done
Agent: Here's the contents of package.json: ...

You: /sessions
  1. [4 msgs, 6/15/2025] What time is it?

You: /new
📝 New session created
```

Try pressing **Ctrl+C** during a long response to see the abort in action. The agent stops immediately, and you can type a new message.

## Where to Go From Here

Congratulations -- you have built a production-quality CLI agent from scratch. Here are some ideas for extending it further:

### Extension Ideas

**Add more tools**: The agent's capabilities are limited only by the tools you provide. Consider adding tools for:
- Web browsing (fetch and summarize URLs)
- Database queries (read from SQLite, PostgreSQL)
- API integrations (GitHub, Jira, Slack)
- Image generation or analysis

**Implement conversation branching**: Allow users to "fork" a conversation at any point, creating a new session that starts from the current history. This is useful for exploring alternative approaches to a problem.

**Add a tool approval allowlist**: Instead of confirming every dangerous tool call, maintain a per-session allowlist of approved operations. Once a user approves "delete files in /tmp," auto-approve subsequent deletions in that directory.

**Build a web UI**: Replace the readline REPL with a web interface using React. The `AgentRuntime` class is already UI-agnostic -- you just need to swap the input/output layer.

**Add cost tracking**: Track token usage per session and display costs. This helps users stay within budget and identify prompts that are unexpectedly expensive.

**Implement context window management**: When conversations get long, older messages may need to be summarized or evicted to stay within the model's context window. Implement a strategy for this (e.g., summarize messages older than N turns).

**Add MCP (Model Context Protocol) support**: Connect your agent to external tool servers using the MCP protocol, giving it access to tools hosted by other applications.

### Architectural Lessons

As you extend the agent, keep these principles in mind:

1. **Separate concerns into modules**: The four-file architecture (index, runtime, tools, commands) scales well. Add new modules for new concerns (e.g., `cost.ts` for token tracking, `context.ts` for context management).

2. **Use dependency injection**: Tools receive their dependencies (like the confirmation waiter) as constructor arguments. This makes them testable and reusable across different agent configurations.

3. **Always clean up resources**: Every session switch needs `dispose()`, every SIGINT handler needs `abort()`, every stdin listener needs `cleanup()`. Resource leaks are the most common source of bugs in long-running agent applications.

4. **Buffer your output**: The DeltaBatcher pattern applies anywhere you stream text to a UI. Whether it is a terminal, a web page, or a mobile app, batching produces a better user experience than character-by-character rendering.

5. **Make abort a first-class citizen**: Users will Ctrl+C. Plan for it. Every long-running tool should accept and respect the abort signal.

## Key Takeaways

1. **Composition is the key skill**: Building a production agent is not about learning one new concept -- it is about composing all the concepts from previous chapters into a coherent whole. The `AgentRuntime` class is the glue that holds everything together.

2. **DeltaBatcher solves perceptual latency**: The 32ms batching interval transforms character-by-character stuttering into smooth, readable output. Small details like this make the difference between a prototype and a product.

3. **Abort handling is non-negotiable**: Users must always be able to interrupt a runaway agent. The SIGINT handler plus `session.abort()` provides this escape hatch.

4. **Good architecture enables extension**: The four-module structure (entry, runtime, tools, commands) makes it easy to add new features without touching existing code. Each module has a single responsibility and a clean interface.

5. **This is a foundation, not a ceiling**: The agent you built in this chapter is a starting point. The patterns you have learned -- streaming, tools, sessions, confirmation, skills, abort -- are the building blocks for any AI agent application, whether it is a CLI tool, a desktop app, or a cloud service.
