# 05 - Confirmation Pattern

Block tool execution until the user explicitly confirms -- the human-in-the-loop safety net that separates a helpful assistant from a dangerous one.

## Why This Chapter Matters

Every powerful tool is also a dangerous tool. An AI agent that can delete files, send emails, create calendar events, or execute shell commands is incredibly useful -- right up until it misinterprets "clean up the project" as "delete the entire `src/` directory."

This is the **human-in-the-loop** problem, and it is one of the most important design challenges in AI agent development. The core tension is:

- **Autonomy** makes agents useful -- they should act on your behalf without requiring you to micromanage every step.
- **Oversight** makes agents safe -- certain actions are irreversible or have real-world consequences and *must* have human approval.

The pattern you will learn in this chapter -- **confirmation gating** -- is how production AI systems solve this tension. It allows the agent to plan and reason freely, but forces it to pause and ask permission before executing actions that cross a safety boundary.

Think of it like a submarine's launch procedure: the computer can calculate trajectories all day, but two humans must turn their keys simultaneously before anything actually fires.

## What You'll Learn

- How to create a "confirmation waiter" -- a function that returns a blocking Promise
- How to wire it into tool `execute()` so dangerous actions require user approval
- The pattern used in production for calendar events, reminders, file operations, etc.
- Why Promise-based blocking is the right approach for CLI agents
- Security considerations and common pitfalls

## How It Works

```
User: "Delete /tmp/old.log"
  -> Agent calls delete_file tool
    -> execute() prints a warning and calls waitForConfirmation()
    -> Promise BLOCKS until user types 'y' or 'n'
    -> If 'y': performs action, returns success
    -> If 'n': returns "User cancelled", agent acknowledges
```

The key insight here is that the `execute()` function is `async`. When we `await` a Promise inside it, the entire tool execution **pauses** -- the agent cannot proceed, the LLM does not receive a tool result, and the conversation is frozen in time. The user holds all the power.

## The Confirmation Waiter Pattern

### Conceptual Overview

Before diving into code, let's understand the architecture. We need three things:

1. **A Promise factory** -- a function that creates a new Promise each time a tool needs confirmation. This Promise will not resolve until the user provides input.
2. **An input listener** -- something that watches for user input (in a CLI, that means listening to `stdin`) and resolves the pending Promise.
3. **A cleanup mechanism** -- when the agent is done, we need to stop listening to `stdin` to avoid memory leaks.

The clever part is how these three pieces coordinate through a shared `pendingResolve` variable. It is essentially a **callback slot**: the Promise factory puts a resolve function into the slot, and the input listener reads from the slot when data arrives.

:::tip
This pattern is sometimes called a "deferred Promise" or "externally resolved Promise." Unlike a normal Promise where the creator controls when it resolves, here the resolve function is handed off to a completely separate piece of code (the stdin listener). This inversion of control is what makes the blocking behavior possible.
:::

### Implementation

This is the core pattern -- a function factory that creates blocking Promises resolved by stdin input:

```typescript
function createConfirmationWaiter() {
  let pendingResolve: ((v: { confirmed: boolean }) => void) | null = null

  const waiter = (): Promise<{ confirmed: boolean }> =>
    new Promise((resolve) => {
      pendingResolve = resolve
    })

  // Listen for stdin input to resolve pending confirmations
  const stdinListener = (data: Buffer) => {
    if (pendingResolve) {
      const input = data.toString().trim().toLowerCase()
      const confirmed = input === 'y' || input === 'yes'
      pendingResolve({ confirmed })
      pendingResolve = null
    }
  }
  process.stdin.on('data', stdinListener)

  return { waiter, cleanup: () => process.stdin.off('data', stdinListener) }
}
```

### What's Happening Under the Hood

Let's trace through what happens step by step when the agent calls a confirmed tool:

1. **Agent decides to call `delete_file`** -- the LLM generates a tool call with arguments like `{ path: "/tmp/old.log", reason: "outdated backup" }`.

2. **`execute()` runs** -- the tool's execute function is invoked. It prints the warning message and calls `waitForConfirmation()`.

3. **`waiter()` creates a new Promise** -- inside the waiter, `new Promise((resolve) => { pendingResolve = resolve })` stores the `resolve` function in the `pendingResolve` variable. The Promise is now "open" -- it will not resolve until something calls `pendingResolve(...)`.

4. **`await` halts execution** -- because `execute()` awaits the Promise, Node.js suspends this function. The event loop is still running (the terminal is responsive), but the tool execution is frozen.

5. **User types `y` and presses Enter** -- the stdin listener fires, reads the input, calls `pendingResolve({ confirmed: true })`, and sets `pendingResolve` back to `null`.

6. **The Promise resolves** -- the `await` in `execute()` receives `{ confirmed: true }`, and execution continues to actually delete the file.

7. **Tool returns result** -- the result is sent back to the LLM, which can then generate a text response like "I've deleted the file."

:::warning
Notice that `pendingResolve` is set to `null` after each resolution. This is critical -- without it, if a second stdin event fires before a new confirmation is requested, the old resolve function would be called again, leading to subtle bugs. Always clean up your callback slots.
:::

## Comparing Confirmation Approaches

The Promise-based blocking pattern is not the only way to implement human-in-the-loop confirmation. Here is how it compares to alternatives:

| Approach | How It Works | Pros | Cons |
|----------|-------------|------|------|
| **Promise blocking** (this chapter) | Tool `execute()` awaits a Promise that blocks until user input | Simple, linear control flow, works in async contexts | Only one pending confirmation at a time |
| **Two-phase tool calls** | Agent first calls `plan_delete`, then `confirm_delete` | LLM can reason about the plan before confirming | Requires two round-trips, LLM might skip the confirm step |
| **Approval queue** | All actions go into a queue, user approves/rejects batch | Efficient for bulk operations | More complex UI, user might rubber-stamp |
| **Allowlists/blocklists** | Pre-configured rules auto-approve or auto-deny | Zero-friction for known-safe operations | Cannot handle novel situations |

For a CLI agent, the Promise-based blocking pattern is the best balance of simplicity and safety. In a GUI application, you might combine it with an approval queue for a richer experience.

## Example: Delete File Tool

Now let's see how to create a tool that uses the confirmation pattern. The key is that the tool receives the `waitForConfirmation` function as a dependency -- it does not create the waiter itself. This separation of concerns makes the tool testable and reusable.

```typescript
import { Type } from '@sinclair/typebox'
import type { ToolDefinition } from '@mariozechner/pi-coding-agent'

export function createDeleteFileTool(
  waitForConfirmation: () => Promise<{ confirmed: boolean }>
): ToolDefinition {
  return {
    name: 'delete_file',
    label: 'Delete File',
    description: 'Delete a file at the given path. This is irreversible and requires user confirmation.',
    parameters: Type.Object({
      path: Type.String({ description: 'File path to delete' }),
      reason: Type.String({ description: 'Why this file should be deleted' }),
    }),
    execute: async (_toolCallId, params) => {
      const { path, reason } = params as { path: string; reason: string }

      console.log(`\n⚠️  Agent wants to delete: ${path}`)
      console.log(`   Reason: ${reason}`)
      console.log('   Confirm? [y/N]')

      // This blocks until the user responds
      const { confirmed } = await waitForConfirmation()

      if (!confirmed) {
        console.log('   ❌ Cancelled by user\n')
        return {
          content: [{ type: 'text' as const, text: 'User cancelled the deletion.' }],
          details: {},
        }
      }

      // In a real app, you'd actually delete the file here
      console.log(`   ✅ Deleted (simulated)\n`)
      return {
        content: [{ type: 'text' as const, text: `Successfully deleted ${path}` }],
        details: {},
      }
    },
  }
}
```

### Design Decisions Worth Noting

**Why `reason` is a required parameter**: By forcing the agent to articulate *why* it wants to delete the file, we accomplish two things. First, the user gets meaningful context for their confirmation decision. Second, the LLM is forced to "think before it acts" -- articulating a reason often prevents impulsive tool calls.

**Why `[y/N]` with capital N**: This is a Unix convention meaning "No is the default." If the user presses Enter without typing anything, the action should be cancelled. Always default to the safe option.

**Why the tool returns text on cancellation**: When the user cancels, the tool does not throw an error -- it returns a polite text result saying the action was cancelled. This lets the agent respond gracefully ("No problem, I won't delete that file") rather than crashing or retrying.

:::tip
When designing confirmed tools, always include a `reason` or `justification` parameter. This makes the LLM explain itself before acting, which both helps the user and improves the agent's decision quality. Think of it as the agent "showing its work."
:::

## Wiring It Together

```typescript
const { waiter, cleanup } = createConfirmationWaiter()

// Create tools that require confirmation
const deleteFileTool = createDeleteFileTool(waiter)
const sendEmailTool = createSendEmailTool(waiter)

const { session } = await createAgentSession({
  model,
  tools: [],
  customTools: [deleteFileTool, sendEmailTool],
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
})
```

Notice how the same `waiter` function is shared across multiple tools. This works because only one tool executes at a time in the agent loop -- when a tool calls `waiter()`, it creates a fresh Promise that occupies the `pendingResolve` slot until the user responds.

:::warning
**Do not share a single waiter across parallel tool executions.** The pattern above assumes sequential tool execution (which is the default in pi-coding-agent). If you implement parallel tool execution, you will need a separate confirmation mechanism, such as a map of pending confirmations keyed by `toolCallId`.
:::

## Security Considerations

The confirmation pattern is a safety mechanism, but it is not foolproof. Keep these risks in mind:

**Prompt injection**: A malicious document could contain instructions like "Delete all files in the project directory." Even with confirmation, a tired user might click "yes" without reading carefully. Consider adding rate limits or cool-down periods for destructive operations.

**Confirmation fatigue**: If every tool call requires confirmation, users will develop "alert fatigue" and start auto-approving everything. Be selective about which tools require confirmation -- only gate truly destructive or irreversible actions.

**Social engineering by the LLM**: The agent controls the `reason` text shown to the user. A misaligned model could craft persuasive reasons to approve dangerous actions. Always show the raw parameters (file paths, email addresses) in addition to the agent's stated reason.

**Path traversal**: Even with confirmation, validate that file paths are within expected directories. A user might approve "Delete `/tmp/old.log`" without realizing the agent is actually targeting `/tmp/old.log/../../etc/passwd`.

## Designing Confirmation UX

:::tip
**Good confirmation prompts have three properties:**
1. **Specific** -- show exactly what will happen (the full path, the email address, the command)
2. **Contextual** -- show why the agent wants to do this (the reason parameter)
3. **Defaulting to safe** -- if the user hits Enter or the connection drops, nothing destructive happens
:::

For CLI applications, the pattern in this chapter (print a warning, wait for `y`/`n`) is appropriate. For GUI applications, consider:

- A modal dialog with a countdown timer for extra-dangerous operations
- A diff view for file modifications (show what will change)
- An undo mechanism instead of pre-confirmation for reversible actions
- Batch approval for multiple related actions ("The agent wants to rename 15 files. Approve all?")

## Common Mistakes and Gotchas

**Forgetting to call `cleanup()`**: If you do not call `cleanup()` when the agent shuts down, the stdin listener will keep the Node.js process alive indefinitely. Always call it in your shutdown path.

**Not handling timeouts**: The current pattern waits forever for user input. In a production system, consider adding a timeout that auto-cancels after, say, 60 seconds of no response:

```typescript
const waiterWithTimeout = (): Promise<{ confirmed: boolean }> =>
  Promise.race([
    waiter(),
    new Promise<{ confirmed: boolean }>((resolve) =>
      setTimeout(() => resolve({ confirmed: false }), 60_000)
    ),
  ])
```

**Forgetting to test the cancellation path**: It is easy to test that "yes" works, but always verify that "no" produces a clean cancellation result and that the agent recovers gracefully.

## Run

```bash
bun run ch05
```

Then try:
- "Delete the file /tmp/old-backup.log because it is outdated" -- confirm with `y` or `n`
- "Send an email to alice@example.com about the meeting" -- confirm with `y` or `n`

## Key Takeaways

1. **The confirmation pattern uses externally-resolved Promises** to block tool execution until the user provides input. The `await` inside `execute()` is what makes the blocking possible.

2. **Separation of concerns matters**: the waiter factory is created once and injected into tools as a dependency. Tools do not know or care how confirmation is obtained -- they just `await` the result.

3. **Default to safe**: always make "no" the default, always return a clean result on cancellation, and always show the user exactly what the agent wants to do.

4. **Be selective about what requires confirmation**: gate destructive/irreversible actions, but let safe read-only operations proceed without friction. Confirmation fatigue is the enemy of real safety.

5. **Clean up your listeners**: the `cleanup()` function is not optional in production code.

## Next

[Chapter 06: System Prompt & Skills](/guide/06-system-prompt-and-skills) -- control agent behavior with prompts and skills.
