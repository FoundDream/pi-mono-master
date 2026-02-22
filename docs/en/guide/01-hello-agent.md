# 01 - Hello Agent

## What Is an "Agent" Anyway?

Before writing any code, it's worth pausing to understand what we mean by "agent" -- because the word gets thrown around a lot, and it means something very specific in this context.

A **plain API call** is like ordering food at a counter: you say what you want, you get a response, end of interaction. You call the Anthropic or OpenAI API with a prompt, you receive a completion, done.

An **agent**, on the other hand, is more like hiring an assistant. The assistant has:

- A **personality and instructions** (system prompt) that shape how they behave
- **Tools** they can use (look things up, do calculations, run code)
- **Memory** of your conversation so far
- The ability to **decide on their own** when to use which tool, when to ask for clarification, and when to give you a final answer

The key difference is **autonomy**. An API call does exactly one thing: text in, text out. An agent can *reason about what to do*, execute multi-step plans, invoke tools, and loop until the task is complete. In this chapter, we build the simplest possible agent -- one that just responds to a single prompt -- but the architecture we set up here is the same architecture that powers the full CLI agent in Chapter 08.

## The Agent Architecture

pi-coding-agent has four core building blocks that you will see in every chapter. Understanding how they fit together is essential:

```
┌─────────────────────────────────────────────────┐
│                 createAgentSession()             │
│                                                  │
│   ┌───────────┐    ┌──────────────────────┐     │
│   │   Model   │    │  DefaultResourceLoader│     │
│   │ (LLM API) │    │  (personality config) │     │
│   └─────┬─────┘    └──────────┬───────────┘     │
│         │                     │                  │
│         └──────────┬──────────┘                  │
│                    ▼                             │
│            ┌──────────────┐                      │
│            │   Session    │──── events ──► subscriber
│            └──────┬───────┘                      │
│                   │                              │
│          ┌────────┴────────┐                     │
│          ▼                 ▼                     │
│   SessionManager      Tools []                  │
│   (persistence)     (capabilities)              │
└─────────────────────────────────────────────────┘
```

Think of it this way:

- **Model** -- the brain. It's the LLM provider (Anthropic, OpenAI, Google) that does the actual thinking. Created from your `.env` configuration.
- **DefaultResourceLoader** -- the personality. It controls the system prompt, skills, extensions, and themes. Think of it as the agent's "job description" -- it tells the model *how* to behave.
- **SessionManager** -- the memory. It decides whether conversations are stored in memory (ephemeral) or on disk (persistent). This chapter uses in-memory, meaning the conversation is lost when the program exits.
- **Session** -- the runtime. It's the living, breathing conversation. You send prompts to it, subscribe to its events, and it coordinates the model, tools, and resource loader behind the scenes.

`createAgentSession()` is the factory function that wires all these pieces together and returns a ready-to-use session.

## What You'll Learn

- How to create a `Model` from environment variables
- How to configure `DefaultResourceLoader` with a custom system prompt
- How to create an agent session with `createAgentSession()`
- How to subscribe to events and collect the response
- How to send a prompt with `session.prompt()`

## Full Code

```typescript
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
} from '@mariozechner/pi-coding-agent'
import { createModel } from '../../shared/model'

const model = createModel()

// ResourceLoader controls system prompt, skills, extensions, etc.
// We disable everything and just set a simple system prompt.
const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => 'You are a helpful assistant. Be concise.',
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
})
await resourceLoader.reload()

// Create an in-memory session (no file persistence)
const { session } = await createAgentSession({
  model,
  tools: [],          // No coding tools (read, write, bash, edit)
  customTools: [],    // No custom tools
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
})

// Subscribe to events and collect the full response
let response = ''
session.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    response += event.assistantMessageEvent.delta
  }
})

// Send a single prompt and wait for completion
await session.prompt('What is the Fibonacci sequence? Explain in 2 sentences.')

console.log('Agent:', response)
process.exit(0)
```

## Step-by-Step Breakdown

### 1. Create the model

```typescript
const model = createModel()
```

`createModel()` reads `AI_PROVIDER` and `AI_MODEL` from your `.env` file and returns a `Model<Api>` object. This object describes *which* LLM to talk to and *how* -- including the API format, context window size, and token limits. See the [Model API reference](/api/model) for details.

The beauty of this abstraction is that you can swap providers by changing a single environment variable. Your agent code never needs to know whether it's talking to Claude, GPT-4, or Gemini.

### 2. Configure the resource loader

```typescript
const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => 'You are a helpful assistant. Be concise.',
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
})
await resourceLoader.reload()
```

`DefaultResourceLoader` is the central configuration point for agent behavior. In a full-featured agent, it loads system prompts from templates, enables skills (like web search or file editing), and applies themes. Here, we disable all optional features and provide a minimal system prompt.

Think of `DefaultResourceLoader` as the agent's **personality configuration file**. Just as a `.bashrc` customizes your shell environment, the resource loader customizes the agent's "mental environment" -- what it knows, what it can do, and how it should behave.

The `reload()` call is important: it compiles all the configuration into the internal format the session needs. You must call `reload()` before passing the resource loader to `createAgentSession()`.

:::warning
Forgetting to call `await resourceLoader.reload()` is a common mistake. The agent will still run, but the system prompt and other settings may not take effect as expected.
:::

### 3. Create the session

```typescript
const { session } = await createAgentSession({
  model,
  tools: [],
  customTools: [],
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
})
```

`createAgentSession()` wires everything together. This is where the agent comes to life. It takes the model (brain), resource loader (personality), tools (capabilities), and session manager (memory) and returns a `session` object you can interact with.

`SessionManager.inMemory()` means this session has no persistence -- it lives only in RAM and vanishes when the process exits. This is perfect for one-off scripts and testing. In Chapter 04, we'll switch to file-based persistence.

:::tip
`createAgentSession()` returns an object with more than just `session`. It also provides `sessionManager` and other utilities. We destructure only `{ session }` here because that's all we need.
:::

### 4. Subscribe to events

```typescript
let response = ''
session.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    response += event.assistantMessageEvent.delta
  }
})
```

This is the **event-driven architecture** at the heart of pi-coding-agent. Instead of getting the response as a return value from `prompt()`, you subscribe to a stream of events. The session emits events as things happen: the agent starts thinking, text chunks arrive, tools get called, the agent finishes.

Why events instead of a simple return value? Because agents do many things during a single prompt -- they might generate text, call a tool, generate more text based on the tool result, call another tool, and so on. Events let you observe and react to each step as it happens, rather than waiting for everything to finish.

In this chapter, we only care about one event type: `text_delta`, which carries a chunk of the assistant's response. We accumulate these chunks into the `response` string.

### 5. Send a prompt

```typescript
await session.prompt('What is the Fibonacci sequence? Explain in 2 sentences.')
```

`session.prompt()` sends the user message to the LLM and returns a Promise that resolves when the agent has **fully finished** processing. "Fully finished" means: all text has been generated, all tool calls have been executed, and any follow-up reasoning has completed. While the promise is pending, events are being emitted to your subscriber.

### What's Happening Under the Hood

When you call `session.prompt()`, here's the sequence of operations that pi-coding-agent performs internally:

1. **Message assembly** -- The session manager provides the conversation history (empty for a new session). The resource loader provides the system prompt. These are combined with your new user message into the full message array.
2. **API call** -- The message array is sent to your configured LLM provider (Anthropic, OpenAI, etc.) via the `Model` abstraction.
3. **Streaming** -- As tokens arrive from the API, the session emits `message_update` events with `text_delta` payloads. Your subscriber receives these in real time.
4. **Tool handling** -- If the model decides to call a tool (not applicable in this chapter since we have no tools), the session would execute the tool and feed the result back to the model for further processing.
5. **Completion** -- Once the model signals it's done (and no more tool calls are pending), the session emits an `agent_end` event and the `prompt()` promise resolves.

All of this complexity is hidden behind two simple calls: `subscribe()` and `prompt()`.

## Common Mistakes

**Calling `prompt()` without subscribing first.** The prompt will still work, but you won't capture the response. Always set up your subscriber before calling `prompt()`.

**Forgetting `await` on `session.prompt()`.** Without `await`, your code continues immediately and may exit before the agent finishes. The `response` variable would be empty or incomplete.

**Forgetting `process.exit(0)`.** The agent session keeps internal handles alive (timers, connections). Without an explicit `process.exit(0)`, the Node.js process may hang indefinitely after the prompt completes.

## Run

```bash
bun run ch01
```

## Expected Output

```
Agent: The Fibonacci sequence is a series of numbers where each number is the sum
of the two preceding ones, starting from 0 and 1: 0, 1, 1, 2, 3, 5, 8, 13, 21, ...
It appears frequently in mathematics and nature, from spiral patterns in shells to
the branching of trees.
```

The exact wording will vary depending on your model and provider, but the structure should be similar -- a concise, two-sentence explanation.

## Key Takeaways

- An **agent** is more than an API call -- it's an autonomous system with a personality, memory, tools, and reasoning.
- The four building blocks are **Model** (brain), **ResourceLoader** (personality), **SessionManager** (memory), and **Session** (runtime).
- pi-coding-agent uses an **event-driven architecture**: you subscribe to events rather than getting a direct return value.
- `createAgentSession()` is the factory that wires everything together.
- Even the simplest agent follows the same architecture as a complex one -- the only difference is what you enable.

## Next

[Chapter 02: Streaming](/guide/02-streaming) -- add real-time typewriter output so users can see the response as it's generated, rather than waiting for the full text.
