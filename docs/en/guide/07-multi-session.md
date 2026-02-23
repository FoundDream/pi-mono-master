# 07 - Multi-Session

Manage multiple conversation sessions -- list, create, switch -- so your agent can maintain separate contexts for separate tasks.

## Why This Chapter Matters

In Chapter 04, you learned how to persist a single conversation and resume it later. But real-world usage rarely involves just one conversation. Consider how you use a chat application like Slack or iMessage: you have many separate threads, each with its own topic, context, and history. You switch between them freely.

AI agents need the same capability. Here is why:

**Context isolation**: When you are debugging a server issue and also planning a feature, those conversations should not bleed into each other. If both topics share a single session, the agent's context window fills with irrelevant messages, degrading response quality.

**Project separation**: A developer might use the same agent for multiple projects. Each project has its own codebase, conventions, and history. Separate sessions keep each project's context clean.

**Conversation archival**: Old conversations are valuable references. Rather than losing them when starting a new topic, multi-session management lets you archive and revisit past conversations.

**Token efficiency**: LLMs have finite context windows. By keeping sessions focused on a single topic, you maximize the useful information per token. A bloated single session with 50 different topics wastes tokens on irrelevant context.

Think of sessions like browser tabs: each one is an independent workspace, and you switch between them as your focus shifts.

## What You'll Learn

- `SessionManager.list()` -- enumerate all saved sessions
- `SessionManager.open()` -- open a specific session by path
- `SessionManager.create()` -- start a fresh session
- `session.dispose()` -- clean up before switching sessions
- Building a multi-session CLI experience with slash commands

## Commands

| Command     | Description                                 |
| ----------- | ------------------------------------------- |
| `/sessions` | List all saved sessions with message counts |
| `/new`      | Create a new session                        |
| `/open <n>` | Open session number N from the list         |
| `/quit`     | Exit                                        |

## Key Patterns

### Session Lifecycle

Every session goes through a predictable lifecycle:

```
Create/Open  ->  Active (prompting)  ->  Dispose  ->  Persisted on disk
```

Understanding this lifecycle is important because **sessions hold resources** -- event subscriptions, open file handles, cached context. If you switch sessions without disposing the old one, those resources leak.

### The Dispose Pattern

The `dispose()` method is the most important detail in multi-session management. It tells the current session to:

1. **Flush any pending writes** to the JSONL session file
2. **Unsubscribe all event listeners** to prevent the old session from receiving events
3. **Release cached context** to free memory

This is the same pattern used in many resource management systems (React's `useEffect` cleanup, database connection pools, event emitter teardown). The rule is simple: **always dispose before switching**.

:::warning
Forgetting to call `dispose()` before creating a new session is the most common source of bugs in multi-session applications. Symptoms include: duplicate event listeners (text appearing twice), stale context (the agent responds with old conversation history), and memory leaks (the Node.js process grows unbounded).
:::

### Listing Sessions

```typescript
const sessions = await SessionManager.list(process.cwd(), SESSION_DIR);

sessions.forEach((s, i) => {
  const name = s.name || s.firstMessage.slice(0, 50) || "(empty)";
  const date = s.modified.toLocaleDateString();
  console.log(`${i + 1}. [${s.messageCount} msgs, ${date}] ${name}`);
});
```

`SessionManager.list()` scans the session directory for JSONL files and returns metadata about each one. This is a read-only operation -- it does not load the full conversation history into memory. It reads just enough of each file to extract:

- The session ID and path
- Message count
- Creation and modification dates
- The first user message (used as a preview)

This design is intentional: listing 100 sessions should be fast, even if each session contains thousands of messages.

### Switching Sessions

Always `dispose()` the current session before switching:

```typescript
// Switch to a new session
session.dispose();
sessionManager = SessionManager.create(process.cwd(), SESSION_DIR);
session = await buildSession(sessionManager);

// Switch to an existing session
session.dispose();
sessionManager = SessionManager.open(target.path, SESSION_DIR);
session = await buildSession(sessionManager);
```

Notice the three-step pattern: **dispose, create/open, build**. The `buildSession()` helper (defined in the full code below) encapsulates the process of creating a new `AgentSession` with the correct resource loader and event subscriptions. This helper is essential because every time you switch sessions, you need a completely fresh `AgentSession` instance -- you cannot reuse the old one.

:::tip
Extract session creation into a helper function (like `buildSession()` above). This ensures consistent configuration across all sessions and avoids the common mistake of forgetting to set up event subscriptions on the new session.
:::

### SessionInfo Fields

```typescript
interface SessionInfo {
  path: string; // Full path to session file
  id: string; // Unique session ID
  name?: string; // User-defined name
  created: Date;
  modified: Date;
  messageCount: number;
  firstMessage: string; // Preview of first user message
}
```

The `firstMessage` field is particularly useful for building session lists. In most conversations, the first message captures the topic: "Help me debug the authentication issue" or "Write unit tests for the payment module." Showing this as a preview gives users enough context to identify which session they want without loading the full history.

## What's Happening Under the Hood

When you call `SessionManager.open(path, dir)`, here is what happens internally:

1. **The JSONL file is read** from disk. Each line is parsed as a JSON object representing a message.
2. **Messages are loaded into a context buffer** that will be sent to the LLM as conversation history on the next `prompt()` call.
3. **A new `SessionManager` instance is created** that will append new messages to the same JSONL file.

When you then call `createAgentSession()` with this session manager, the agent session:

1. **Calls `sessionManager.buildSessionContext()`** to get the existing messages
2. **Prepends the system prompt** and any loaded skills
3. **Sets up the event subscription pipeline** so new messages are written to the session file

The result is seamless continuity -- the agent sees the full conversation history and can pick up right where you left off.

## Tips for Session Organization

**Let sessions grow organically**: Do not create a new session for every question. A session should represent a _topic_ or _task_ -- "debugging the auth issue" might span 20 exchanges over several days.

**Use the first message wisely**: Since the first message becomes the session preview in `/sessions`, make it descriptive. "Fix the login bug on the settings page" is a better first message than "hey."

**Clean up old sessions periodically**: Sessions accumulate over time. Consider adding a `/delete <n>` command or an auto-archival policy for sessions older than 30 days.

**Consider session naming**: The `SessionInfo` interface includes an optional `name` field. In a production application, you might let users rename sessions for easier identification, similar to renaming chat threads in ChatGPT.

## Full Code

```typescript
import * as path from "node:path";
import * as readline from "node:readline";
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
  type AgentSession,
  type SessionInfo,
} from "@mariozechner/pi-coding-agent";
import { createModel } from "../../shared/model";

const SESSION_DIR = path.join(import.meta.dirname, ".sessions");
const model = createModel();

// --- Helpers ---

async function createResourceLoader() {
  const rl = new DefaultResourceLoader({
    systemPromptOverride: () => "You are a helpful assistant. Be concise.",
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
  });
  await rl.reload();
  return rl;
}

async function buildSession(sm: SessionManager): Promise<AgentSession> {
  const resourceLoader = await createResourceLoader();
  const { session } = await createAgentSession({
    model,
    tools: [],
    customTools: [],
    sessionManager: sm,
    resourceLoader,
  });
  session.subscribe((event) => {
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_delta"
    ) {
      process.stdout.write(event.assistantMessageEvent.delta);
    }
  });
  return session;
}

// --- State ---

let sessionManager = SessionManager.create(process.cwd(), SESSION_DIR);
let session = await buildSession(sessionManager);
let cachedSessions: SessionInfo[] = [];

// --- REPL with commands ---

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = () => {
  rl.question("You: ", async (input) => {
    const trimmed = input.trim();

    if (trimmed === "/sessions") {
      cachedSessions = await SessionManager.list(process.cwd(), SESSION_DIR);
      cachedSessions.forEach((s, i) => {
        const name = s.name || s.firstMessage.slice(0, 50) || "(empty)";
        console.log(`  ${i + 1}. [${s.messageCount} msgs] ${name}`);
      });
      ask();
      return;
    }

    if (trimmed === "/new") {
      session.dispose();
      sessionManager = SessionManager.create(process.cwd(), SESSION_DIR);
      session = await buildSession(sessionManager);
      console.log("📝 New session created\n");
      ask();
      return;
    }

    if (trimmed.startsWith("/open ")) {
      const idx = parseInt(trimmed.split(" ")[1]) - 1;
      if (cachedSessions[idx]) {
        session.dispose();
        sessionManager = SessionManager.open(
          cachedSessions[idx].path,
          SESSION_DIR,
        );
        session = await buildSession(sessionManager);
        console.log(`📂 Opened session ${idx + 1}\n`);
      }
      ask();
      return;
    }

    if (trimmed === "/quit") {
      rl.close();
      process.exit(0);
    }
    if (!trimmed) {
      ask();
      return;
    }

    process.stdout.write("\nAgent: ");
    await session.prompt(trimmed);
    console.log("\n");
    ask();
  });
};

ask();
```

### Code Walkthrough

**The `buildSession()` helper** is the most important function in this chapter. Every time you switch sessions (via `/new` or `/open`), you need a completely fresh `AgentSession` with its own event subscriptions. This helper ensures consistency -- every session gets the same resource loader configuration and the same event handling setup.

**The `cachedSessions` variable** stores the result of the most recent `/sessions` call. This is important because `/open <n>` references sessions by their index in this list. Without caching, you would need to call `SessionManager.list()` again on every `/open` command, which is wasteful.

**The `ask()` recursion pattern** is a standard Node.js REPL technique. After processing each input (whether it is a command or a prompt), `ask()` calls itself to prompt for the next input. This creates an infinite loop that only breaks on `/quit`.

## Common Mistakes and Gotchas

**Race condition on rapid switching**: If a user types `/new` while a prompt is still streaming, the old session might receive events after `dispose()`. In a production application, add a "is prompting" guard that blocks session switching during active generation.

**Session directory does not exist**: `SessionManager.create()` will fail if the session directory does not exist. Ensure the directory is created before first use (e.g., with `fs.mkdirSync(SESSION_DIR, { recursive: true })`).

**Stale session list**: The `cachedSessions` list can become stale if sessions are created between `/sessions` and `/open` calls. For a CLI, this is fine (the user just re-runs `/sessions`), but a GUI application should refresh the list automatically.

**Losing the last response**: If the user calls `/quit` immediately after a prompt, the last assistant response might not be fully flushed to disk. Calling `session.dispose()` before `process.exit()` ensures all pending writes complete.

## Run

```bash
bun run ch07
```

## Try It

1. Chat with the agent about something -- for example, "My favorite programming language is Rust"
2. Run `/new` to start a fresh session
3. Chat about something different -- "Tell me about quantum computing"
4. Run `/sessions` to see both sessions listed with previews
5. Run `/open 1` to switch back to the first session
6. Ask "What's my favorite programming language?" -- the agent remembers!

This demonstrates the core value of multi-session: each conversation maintains its own context, and you can seamlessly switch between them without losing any history.

## Key Takeaways

1. **Sessions provide context isolation**: Each session is an independent conversation with its own history. This prevents unrelated topics from polluting each other's context.

2. **Always dispose before switching**: The `dispose()` method flushes pending writes, clears event listeners, and releases memory. Skipping it causes resource leaks and ghost events.

3. **The three-step switch pattern**: Dispose the old session, create/open a session manager, build a new agent session. Extract this into a helper function for consistency.

4. **Session listing is lightweight**: `SessionManager.list()` reads metadata without loading full conversation histories, making it fast even with many sessions.

5. **First messages matter**: They become the session preview in list views, so encourage descriptive first messages or add a session naming feature.

## Next

[Chapter 08: Full CLI Agent](/guide/08-full-cli-agent) -- combine everything into a production-quality agent.
