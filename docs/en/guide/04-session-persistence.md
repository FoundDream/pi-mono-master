# 04 - Session Persistence

## The Stateless Problem

Here's a fundamental truth about LLMs that surprises many newcomers: **language models have no memory**. Every API call is stateless. When you send a prompt to Claude or GPT-4, the model doesn't "remember" your previous conversation -- it processes the *entire* message history you send it from scratch each time.

This means that if you want an agent to "remember" that your name is Alice from five messages ago, you must include those five earlier messages in every subsequent API call. The model's "memory" is really just your code replaying the conversation transcript.

In Chapters 01-03, we used `SessionManager.inMemory()`, which stores the conversation in RAM. The moment the process exits, that conversation is gone forever. For a single-use script, that's fine. But for any real agent -- a CLI tool, a desktop assistant, a chatbot -- you need conversations that survive across program restarts.

This is what session persistence solves. In this chapter, we'll store conversations as **JSONL files** on disk and learn how to resume them later.

## What You'll Learn

- `SessionManager.create()` -- start a new persisted session
- `SessionManager.continueRecent()` -- resume the most recent session
- How sessions are stored as JSONL files in `.sessions/`
- Building a REPL loop with `readline`
- The agent remembers context across resumed sessions

## Why JSONL?

pi-coding-agent stores sessions in **JSONL** (JSON Lines) format -- one JSON object per line, each line representing a message or event in the conversation. Why this format over alternatives?

| Format | Pros | Cons |
|--------|------|------|
| **JSONL** | Append-only (fast writes), human-readable, streamable, crash-safe | Slightly larger than binary formats |
| **Single JSON file** | Easy to read as a whole | Must rewrite the entire file for each new message; corrupt if crash mid-write |
| **SQLite** | Queryable, transactional | Heavier dependency; overkill for sequential message logs |
| **Binary (protobuf, etc.)** | Compact, fast | Not human-readable; harder to debug |

JSONL is the sweet spot for conversation storage because conversations are **append-only** by nature. You add messages sequentially; you never edit the middle of a conversation. With JSONL, adding a new message means appending a single line to the file -- there's no need to parse and rewrite the entire file. And if the process crashes mid-write, only the last (incomplete) line is corrupted; all previous messages are safe.

A session file looks like this (simplified):

```jsonl
{"role":"system","content":"You are a helpful assistant."}
{"role":"user","content":"My name is Alice"}
{"role":"assistant","content":"Nice to meet you, Alice!"}
{"role":"user","content":"What's my name?"}
{"role":"assistant","content":"Your name is Alice."}
```

Each line is a self-contained JSON object. You can inspect session files with standard command-line tools (`cat`, `jq`, `wc -l`), which makes debugging straightforward.

## Session Lifecycle

Understanding the lifecycle helps you design robust session management:

```
┌───────────────────────────────────────────────────────┐
│                    Session Lifecycle                    │
│                                                        │
│  SessionManager.create(cwd, dir)                      │
│       │                                                │
│       ▼                                                │
│  [New JSONL file created in dir/]                      │
│       │                                                │
│       ▼                                                │
│  createAgentSession({sessionManager, ...})             │
│       │                                                │
│       ▼                                                │
│  session.prompt("Hello") ────► Messages appended       │
│       │                        to JSONL file           │
│  session.prompt("...") ──────► More messages appended  │
│       │                                                │
│       ▼                                                │
│  process.exit(0)  ← Session file stays on disk         │
│                                                        │
│  ─── Later, in a new process ───                       │
│                                                        │
│  SessionManager.continueRecent(cwd, dir)               │
│       │                                                │
│       ▼                                                │
│  [Finds most recent JSONL file, loads messages]        │
│       │                                                │
│       ▼                                                │
│  createAgentSession({sessionManager, ...})             │
│       │                                                │
│       ▼                                                │
│  session.prompt("What's my name?")                     │
│       │                                                │
│       ▼                                                │
│  Agent sees full history → "Your name is Alice."       │
└───────────────────────────────────────────────────────┘
```

The critical thing to understand is that when you resume a session, the `SessionManager` reads the JSONL file, reconstructs the message array, and feeds it to `createAgentSession()`. The LLM then receives the full conversation history as context, so it can "remember" everything from before.

## Key API Methods

| Method | Description |
|--------|-------------|
| `SessionManager.create(cwd, dir)` | Creates a new session with a fresh JSONL file in `dir/`. Returns a `SessionManager` instance. |
| `SessionManager.continueRecent(cwd, dir)` | Finds the most recently modified JSONL file in `dir/` and loads it. Returns a `SessionManager` instance pointing to that file. |
| `sessionManager.buildSessionContext()` | Returns `{ messages }` -- the array of all messages in the current session. Useful for checking conversation length. |
| `sessionManager.getSessionFile()` | Returns the absolute path to the JSONL file. Useful for logging or debugging. |

## Full Code

```typescript
import * as path from 'node:path'
import * as readline from 'node:readline'
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
} from '@mariozechner/pi-coding-agent'
import { createModel } from '../../shared/model'

const SESSION_DIR = path.join(import.meta.dirname, '.sessions')
const model = createModel()

// Determine session strategy from CLI argument
const arg = process.argv[2] // 'continue' or undefined

let sessionManager: SessionManager
if (arg === 'continue') {
  sessionManager = SessionManager.continueRecent(process.cwd(), SESSION_DIR)
  const ctx = sessionManager.buildSessionContext()
  console.log(`📂 Resumed session (${ctx.messages.length} previous messages)`)
  console.log(`   Session file: ${sessionManager.getSessionFile()}\n`)
} else {
  sessionManager = SessionManager.create(process.cwd(), SESSION_DIR)
  console.log('📝 New session created')
  console.log(`   Session file: ${sessionManager.getSessionFile()}\n`)
}

const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => 'You are a helpful assistant. Be concise. Remember our conversation context.',
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
})
await resourceLoader.reload()

const { session } = await createAgentSession({
  model,
  tools: [],
  customTools: [],
  sessionManager,
  resourceLoader,
})

// Stream output
session.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    process.stdout.write(event.assistantMessageEvent.delta)
  }
})

// REPL loop
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

console.log('Type your message (or /quit to exit):\n')

const ask = () => {
  rl.question('You: ', async (input) => {
    const trimmed = input.trim()
    if (trimmed === '/quit' || trimmed === '/exit') {
      console.log('\nGoodbye! Your session has been saved.')
      rl.close()
      process.exit(0)
    }
    if (!trimmed) {
      ask()
      return
    }

    process.stdout.write('\nAgent: ')
    await session.prompt(trimmed)
    console.log('\n')
    ask()
  })
}

ask()
```

## Step-by-Step Breakdown

### 1. Choose where to store sessions

```typescript
const SESSION_DIR = path.join(import.meta.dirname, '.sessions')
```

The `.sessions/` directory lives inside the chapter folder. pi-coding-agent creates it automatically if it doesn't exist. Each session gets a unique JSONL file with a generated name (e.g., `session-abc123.jsonl`).

:::tip
In production, you'd typically store sessions in a user-specific data directory (like `~/.config/myapp/sessions/` on Linux or `~/Library/Application Support/MyApp/sessions/` on macOS) rather than alongside your source code.
:::

### 2. Create or resume a session

```typescript
const arg = process.argv[2]

let sessionManager: SessionManager
if (arg === 'continue') {
  sessionManager = SessionManager.continueRecent(process.cwd(), SESSION_DIR)
  const ctx = sessionManager.buildSessionContext()
  console.log(`📂 Resumed session (${ctx.messages.length} previous messages)`)
} else {
  sessionManager = SessionManager.create(process.cwd(), SESSION_DIR)
  console.log('📝 New session created')
}
```

This is the fork point: `SessionManager.create()` starts fresh; `SessionManager.continueRecent()` picks up where you left off. The `continueRecent` method scans the session directory for the most recently modified JSONL file and loads it.

After resuming, `buildSessionContext()` lets you inspect the loaded conversation. The `messages` array contains every message from the previous session, which will be sent to the LLM on the next `prompt()` call.

### 3. Build a REPL loop

```typescript
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const ask = () => {
  rl.question('You: ', async (input) => {
    // ... handle input ...
    await session.prompt(trimmed)
    ask()  // Ask again (loop)
  })
}

ask()
```

The REPL (Read-Eval-Print Loop) is a classic interactive pattern. We use Node's built-in `readline` module to read user input, send it to the agent, display the response, and loop. The `/quit` command exits gracefully.

Notice that each call to `session.prompt()` automatically appends both the user message and the assistant's response to the JSONL file. You don't need to manually serialize anything -- the `SessionManager` handles persistence transparently.

### What's Happening Under the Hood

When you resume a session and send a new prompt, here's the full sequence:

1. `SessionManager.continueRecent()` reads the JSONL file and deserializes all the messages.
2. `createAgentSession()` receives these messages as the session's starting history.
3. When you call `session.prompt("What's my name?")`, the session constructs the API call with:
   - The system prompt (from `DefaultResourceLoader`)
   - All previous messages (from the JSONL file)
   - Your new user message
4. The LLM receives this full context and "remembers" the entire conversation.
5. The assistant's response is appended to the JSONL file along with your user message.

This is fundamentally how **all** LLM "memory" works -- by replaying the conversation transcript. The persistence layer just makes that transcript survive across process restarts.

## Session Storage on Disk

After a conversation, the `.sessions/` directory will contain files like:

```
chapters/04-session-persistence/.sessions/
├── session-abc123.jsonl
└── session-def456.jsonl
```

You can inspect these files directly:

```bash
# Count messages in a session
wc -l .sessions/session-abc123.jsonl

# Pretty-print the last message
tail -1 .sessions/session-abc123.jsonl | jq .

# View the full conversation
cat .sessions/session-abc123.jsonl | jq .
```

:::warning
**Do not manually edit session files** unless you understand the internal message format thoroughly. Corrupted JSONL files will cause `SessionManager.continueRecent()` to fail. If a session becomes corrupt, delete the file and start fresh.
:::

## Gotchas and Production Tips

### Context window limits

Every time you resume a session, the *entire* conversation history is sent to the LLM. Long conversations will eventually exceed the model's context window (e.g., 128K tokens for Claude, 128K for GPT-4o). At that point, the API call will fail.

In production, you need a strategy for this:
- **Truncation** -- Drop the oldest messages to stay within the token budget
- **Summarization** -- Periodically summarize older messages and replace them with a summary
- **Session rotation** -- Start a new session when the current one gets too long, carrying over a summary

### Concurrent access

JSONL files are not designed for concurrent writes. If two processes try to write to the same session file simultaneously, you'll get corrupted data. In production, ensure only one process writes to a session at a time, or use a database backend.

### Session directory cleanup

Over time, the `.sessions/` directory will accumulate files. Consider implementing automatic cleanup of sessions older than a certain age, or providing a manual cleanup command.

### Sensitive data

Session files contain the full text of every message, including anything the user typed. If your agent handles sensitive information (passwords, API keys, personal data), you need to consider encryption at rest or at least appropriate file permissions.

## Run

```bash
# Start a new session (interactive REPL)
bun run ch04

# Resume the previous session
bun run ch04 continue
```

## Try It

This is the best hands-on exercise in the tutorial so far. Follow these steps to see persistence in action:

1. Run `bun run ch04` and tell the agent: "My name is Alice"
2. Have a short conversation -- ask a question or two
3. Type `/quit` to exit
4. Run `bun run ch04 continue` and ask: "What's my name?"
5. The agent remembers! It will respond with "Alice" because the full conversation history was loaded from disk.

This may seem simple, but it's the foundation of every persistent AI assistant -- from ChatGPT's conversation history to Cursor's project context.

## Key Takeaways

- **LLMs are stateless.** They have no inherent memory between API calls. "Memory" is your code replaying the conversation history.
- **Session persistence** stores the conversation to disk (as JSONL) so it survives process restarts.
- **JSONL** is ideal for conversation storage: append-only, human-readable, and crash-safe.
- `SessionManager.create()` starts a new session; `SessionManager.continueRecent()` resumes the most recent one.
- The `SessionManager` handles serialization and deserialization transparently -- you just call `session.prompt()` and the messages are persisted automatically.
- In production, watch out for context window limits, concurrent access, and sensitive data in session files.

## Next

[Chapter 05: Confirmation Pattern](/guide/05-confirmation-pattern) -- require user approval before the agent takes dangerous actions, like deleting files or making API calls.
