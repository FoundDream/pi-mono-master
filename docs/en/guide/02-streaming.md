# 02 - Streaming

## Why Streaming Matters

Imagine visiting a website where you click "Submit" and stare at a blank screen for 10 seconds before the entire response appears at once. Now imagine the same website, but text starts appearing within 200 milliseconds, flowing onto the screen word by word. The total wait time for the *complete* response is identical in both cases, but the second experience **feels** dramatically faster.

This is the power of streaming, and it's the single most impactful UX improvement you can make to any LLM-powered application.

There are two fundamental reasons streaming matters:

1. **Perceived latency** -- Users judge responsiveness by *time to first token*, not time to last token. A streaming response that starts in 200ms and takes 5 seconds to complete feels fast. A buffered response that arrives all at once after 5 seconds feels slow. Same total time, completely different user experience.

2. **Progressive consumption** -- Users can start reading (and making decisions) while the response is still being generated. In a coding agent, this means a developer can spot a mistake in the agent's approach early and abort, rather than waiting for a full incorrect response.

In this chapter, we upgrade from collecting the full response in a string (Chapter 01) to writing each text chunk directly to the terminal as it arrives -- creating the familiar "typewriter" effect.

## What You'll Learn

- How `session.subscribe()` delivers events in real time
- The `message_update` / `text_delta` event for streaming text
- Agent lifecycle events: `agent_start`, `agent_end`
- Using `process.stdout.write()` for streaming output (no newline per chunk)
- The difference between buffered and streaming response handling

## Buffered vs. Streaming: A Comparison

To understand what changes in this chapter, compare the two approaches side by side:

**Buffered (Chapter 01)** -- collect everything, print at the end:

```typescript
let response = ''
session.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    response += event.assistantMessageEvent.delta  // Accumulate
  }
})
await session.prompt('...')
console.log(response)  // Print all at once
```

**Streaming (Chapter 02)** -- print each chunk as it arrives:

```typescript
session.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    process.stdout.write(event.assistantMessageEvent.delta)  // Print immediately
  }
})
await session.prompt('...')
```

The difference is subtle in code but dramatic in user experience. Instead of `console.log()` at the end, we use `process.stdout.write()` inside the event handler to emit each chunk the instant it arrives.

:::tip
`process.stdout.write()` is used instead of `console.log()` because `console.log()` appends a newline after each call. Since text deltas are arbitrary chunks (sometimes a word, sometimes a partial word, sometimes punctuation), adding newlines between them would produce garbled output.
:::

## The Event System Architecture

pi-coding-agent uses a **publish-subscribe (pub/sub) event model**. The session is the publisher; your code is the subscriber. This architecture decouples the "what's happening" (events) from "what to do about it" (your handler logic).

Here's the flow of events during a single `session.prompt()` call:

```
session.prompt("Explain how a CPU works")
        │
        ▼
   ┌─────────────┐
   │ agent_start  │  ◄── Agent begins processing
   └──────┬──────┘
          │
          ▼
   ┌─────────────────────────────────┐
   │ message_update                   │
   │   └─ assistantMessageEvent:      │
   │        type: "text_delta"        │  ◄── "The "
   │        delta: "The "             │
   └──────┬──────────────────────────┘
          │
          ▼
   ┌─────────────────────────────────┐
   │ message_update                   │
   │   └─ assistantMessageEvent:      │
   │        type: "text_delta"        │  ◄── "CPU "
   │        delta: "CPU "             │
   └──────┬──────────────────────────┘
          │
         ...  (more text_delta events)
          │
          ▼
   ┌─────────────┐
   │  agent_end   │  ◄── Agent finished all processing
   └─────────────┘
          │
          ▼
   prompt() Promise resolves
```

### Key Event Types

| Event | When It Fires | What It Contains |
|-------|---------------|------------------|
| `agent_start` | Agent begins processing a prompt | No payload -- it's a lifecycle signal |
| `message_update` | A piece of response data is available | Nested `assistantMessageEvent` with the specific update type |
| `text_delta` | A chunk of text has been generated | `delta` -- the text string for this chunk |
| `agent_end` | Agent has finished all processing | No payload -- signals completion |

The `message_update` event is a wrapper. Inside it, the `assistantMessageEvent` field tells you *what kind* of update it is. In this chapter, we only encounter `text_delta`, but in later chapters you'll also see tool-related events nested inside `message_update`.

## Full Code

```typescript
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
} from '@mariozechner/pi-coding-agent'
import { createModel } from '../../shared/model'

const model = createModel()

const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => 'You are a helpful assistant. Respond in detail.',
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
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
})

// Subscribe to events — write deltas to stdout as they arrive (typewriter effect)
session.subscribe((event) => {
  if (event.type === 'message_update') {
    const { assistantMessageEvent } = event
    switch (assistantMessageEvent.type) {
      case 'text_delta':
        // Stream each text chunk directly to stdout (no newline)
        process.stdout.write(assistantMessageEvent.delta)
        break
    }
  }

  // You can also observe agent lifecycle events
  if (event.type === 'agent_start') {
    console.log('[Agent started thinking...]\n')
  }
  if (event.type === 'agent_end') {
    console.log('\n\n[Agent finished]')
  }
})

const question = process.argv[2] || 'Explain how a CPU executes instructions, step by step.'
console.log(`You: ${question}\n`)

await session.prompt(question)

console.log()
process.exit(0)
```

## How It Works

### The subscribe handler in detail

Let's walk through the event handler piece by piece.

The outer check `event.type === 'message_update'` filters for response content events. These are the most common events during a prompt -- they fire dozens or hundreds of times as the model generates tokens.

Inside the `message_update`, we switch on `assistantMessageEvent.type`. In this chapter, only `text_delta` is relevant. The `delta` field contains the actual text chunk -- typically a few characters to a few words.

```typescript
process.stdout.write(assistantMessageEvent.delta)
```

This line is the heart of streaming. Each delta is written to stdout immediately, creating the typewriter effect. The chunks appear in the terminal as fast as the LLM generates them.

### Lifecycle events

The `agent_start` and `agent_end` events are **lifecycle bookends**. They tell you when the agent begins and finishes processing, which is useful for:

- Showing a "thinking..." spinner in a UI
- Measuring total response time
- Cleaning up resources after the agent finishes

```typescript
if (event.type === 'agent_start') {
  console.log('[Agent started thinking...]\n')
}
if (event.type === 'agent_end') {
  console.log('\n\n[Agent finished]')
}
```

### Custom prompts from the command line

```typescript
const question = process.argv[2] || 'Explain how a CPU executes instructions, step by step.'
```

This line reads an optional command-line argument, so you can test with different prompts without modifying the code. If no argument is provided, it falls back to a default question.

## Handling Errors in Streams

What happens when something goes wrong during streaming? The model might hit a rate limit, the network might drop, or the API key might be invalid. pi-coding-agent surfaces these through events as well.

:::warning
Always consider error handling in production streaming code. If the LLM API returns an error mid-stream, the `prompt()` promise will reject. Make sure you wrap `await session.prompt()` in a try/catch:

```typescript
try {
  await session.prompt(question)
} catch (error) {
  console.error('\nStream interrupted:', error.message)
}
```

Without this, an unhandled promise rejection may crash your process or produce confusing output.
:::

## Common Mistakes

**Using `console.log()` instead of `process.stdout.write()` for deltas.** Each `console.log()` call appends a newline. Since deltas are arbitrary text fragments, this produces output like:

```
The
 CPU
 first
 fetches
```

Instead of the expected `The CPU first fetches`.

**Forgetting the final `console.log()` after `await session.prompt()`.** The streaming output doesn't end with a newline. Without a trailing `console.log()`, your terminal prompt will appear on the same line as the last chunk of text.

**Not handling the case where `delta` is an empty string.** In some edge cases, a delta event may carry an empty string. This is harmless (writing an empty string to stdout does nothing), but if you're doing processing like counting words, be aware of it.

## Run

```bash
bun run ch02

# Or with a custom question:
bun run ch02 "What is quantum computing?"
```

## Expected Behavior

Text appears character-by-character in the terminal, like a ChatGPT-style typing effect. You'll see `[Agent started thinking...]` before the text begins, and `[Agent finished]` after the last token.

The speed depends on your model and provider. Anthropic's Claude models typically stream at 50-100 tokens per second; OpenAI's GPT-4o streams even faster.

## Key Takeaways

- **Streaming dramatically improves perceived latency** -- users see the first token in milliseconds instead of waiting seconds for the full response.
- The event model uses **publish-subscribe**: the session emits events, your handler processes them.
- `text_delta` events carry chunks of the response; use `process.stdout.write()` (not `console.log()`) to print them without extra newlines.
- `agent_start` and `agent_end` are lifecycle bookends useful for UI indicators and timing.
- Always wrap `session.prompt()` in try/catch for production error handling.

## Next

[Chapter 03: Custom Tools](/guide/03-custom-tools) -- give your agent abilities beyond text generation by defining tools it can call to interact with the outside world.
