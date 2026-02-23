# 03 - Custom Tools

## What Is Tool Calling?

Large language models are remarkable at generating text, but they are fundamentally limited: they can only produce words. They cannot look up today's weather, query a database, execute code, or send an email. They are brains without hands.

**Tool calling** (sometimes called "function calling") bridges this gap. It's a protocol where the LLM can say: "I don't know the weather in Tokyo, but I know there's a `get_weather` tool that does. Let me call it with `city: 'Tokyo'`, wait for the result, and then incorporate that result into my response."

Here's the mental model: you give the LLM a **menu of tools** with descriptions of what each tool does and what parameters it accepts. The LLM reads this menu and, during its reasoning, decides when to "order" from the menu. When it does, your code executes the tool and feeds the result back to the model, which then continues generating its response.

```
User: "What's the weather in Tokyo?"
          │
          ▼
┌─────────────────────────────────────────────┐
│  LLM receives prompt + tool descriptions    │
│                                             │
│  "I should use get_weather(city: 'Tokyo')"  │
│                                             │
│  Emits: tool_call {name: "get_weather",     │
│          args: {city: "Tokyo"}}             │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Your code executes the tool                │
│  → Calls weather API                        │
│  → Returns {temp: "22°C", condition: "Sunny"}│
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  LLM receives tool result                   │
│                                             │
│  "The weather in Tokyo is 22°C and sunny."  │
└─────────────────────────────────────────────┘
```

This tool-calling loop is what transforms a language model from a text generator into an **agent** that can take actions in the real world. In this chapter, you'll define your own tools and wire them into a session.

## What You'll Learn

- How to define a `ToolDefinition` with name, label, description, parameters, and execute
- Using `@sinclair/typebox` (NOT Zod) for parameter schemas
- How `execute()` returns `{ content: [...], details: {} }`
- Tool execution events: `tool_execution_start`, `tool_execution_end`
- Passing custom tools via the `customTools` option
- How to write tool descriptions that LLMs understand well

## Why TypeBox Instead of Zod?

If you've worked with TypeScript validation libraries, you've likely used [Zod](https://zod.dev). It's the most popular choice in the ecosystem. So why does pi-coding-agent use [TypeBox](https://github.com/sinclairzx81/typebox) instead?

The reason is **JSON Schema compatibility**. When your tool definitions are sent to the LLM, the parameter schemas must be serialized as JSON Schema -- the format that OpenAI, Anthropic, and Google all use in their API specifications. TypeBox schemas _are_ JSON Schema by construction. Every `Type.String()`, `Type.Object()`, and `Type.Number()` call produces a plain JSON Schema object directly, with no conversion step needed.

Zod, by contrast, uses its own internal representation. Converting Zod schemas to JSON Schema requires a separate library (`zod-to-json-schema`), introduces edge cases, and adds a dependency. TypeBox eliminates this entire category of problems.

:::tip
If you're coming from Zod, the mapping is straightforward:

- `z.string()` becomes `Type.String()`
- `z.number()` becomes `Type.Number()`
- `z.object({...})` becomes `Type.Object({...})`
- `z.enum([...])` becomes `Type.Union([Type.Literal(...), ...])`
- Descriptions: `z.string().describe('...')` becomes `Type.String({ description: '...' })`
  :::

## Tool Anatomy

Every tool in pi-coding-agent is defined as a `ToolDefinition` object with five fields:

```typescript
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

const myTool: ToolDefinition = {
  name: "tool_name", // Used in LLM tool calls (snake_case)
  label: "Tool Name", // Human-readable label
  description: "...", // Description for the LLM
  parameters: Type.Object({
    // TypeBox schema
    param: Type.String({ description: "..." }),
  }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    const { param } = params as { param: string };
    return {
      content: [{ type: "text", text: "..." }],
      details: {},
    };
  },
};
```

Let's examine each field:

- **`name`** -- The identifier the LLM uses when calling this tool. Use `snake_case` (e.g., `get_weather`, `run_query`). This must be unique across all tools in a session.
- **`label`** -- A human-readable name shown in UIs and logs. Not sent to the LLM.
- **`description`** -- This is critically important. The LLM reads this description to decide _when_ and _how_ to use the tool. A vague description leads to the tool being used incorrectly or not at all. (More on this below.)
- **`parameters`** -- A TypeBox schema defining the inputs the tool accepts. The LLM generates arguments matching this schema. Each parameter should include a `description` to help the LLM fill it in correctly.
- **`execute`** -- The async function that runs when the LLM calls the tool. It receives the tool call ID, parsed parameters, an abort signal, and an update callback. It must return an object with `content` (array of result items) and `details` (metadata).

See the [ToolDefinition API reference](/api/tool-definition) for the full interface.

## The Tool Execution Lifecycle

Understanding the lifecycle helps you debug tool-related issues and build robust tools:

```
1. LLM generates a tool call
   └─ event: tool_execution_start {toolName, args}

2. pi-coding-agent validates args against TypeBox schema
   └─ If validation fails, an error result is returned to the LLM

3. Your execute() function is called
   └─ You perform your logic (API calls, computations, etc.)
   └─ You return {content: [...], details: {}}

4. Result is sent back to the LLM
   └─ event: tool_execution_end {toolName, result}

5. LLM incorporates the result into its response
   └─ It may call another tool or generate text
```

The key insight is that tool execution happens **inside the agent loop**. After your tool returns, the LLM sees the result and may decide to call another tool, ask a follow-up question, or produce its final response. A single `session.prompt()` call can trigger multiple tool executions in sequence.

## Example: Weather Tool

This tool simulates a weather API. In production, you'd replace the hardcoded data with a real HTTP call:

```typescript
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

export const weatherTool: ToolDefinition = {
  name: "get_weather",
  label: "Get Weather",
  description:
    "Get current weather for a city. Use this when the user asks about weather.",
  parameters: Type.Object({
    city: Type.String({ description: 'City name (e.g. "Tokyo", "London")' }),
  }),
  execute: async (_toolCallId, params) => {
    const { city } = params as { city: string };

    const weatherData: Record<
      string,
      { temp: string; condition: string; humidity: string }
    > = {
      tokyo: { temp: "22°C", condition: "Sunny", humidity: "45%" },
      london: { temp: "14°C", condition: "Cloudy", humidity: "78%" },
      "new york": { temp: "18°C", condition: "Partly cloudy", humidity: "55%" },
    };

    const key = city.toLowerCase();
    const weather = weatherData[key] || {
      temp: "20°C",
      condition: "Clear",
      humidity: "50%",
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ city, ...weather }),
        },
      ],
      details: {},
    };
  },
};
```

Notice that the tool returns **structured data as a JSON string**, not a natural language sentence. This is intentional -- the LLM is better at interpreting structured data and weaving it into a natural response than receiving a pre-formatted sentence. Let the model handle the presentation.

## Example: Calculator Tool

```typescript
export const calculatorTool: ToolDefinition = {
  name: "calculate",
  label: "Calculator",
  description:
    "Evaluate a mathematical expression. Use for any math calculations.",
  parameters: Type.Object({
    expression: Type.String({
      description: 'Math expression to evaluate (e.g. "2 + 3 * 4")',
    }),
  }),
  execute: async (_toolCallId, params) => {
    const { expression } = params as { expression: string };
    try {
      const result = Function(`"use strict"; return (${expression})`)();
      return {
        content: [{ type: "text" as const, text: String(result) }],
        details: {},
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${e instanceof Error ? e.message : String(e)}`,
          },
        ],
        details: {},
      };
    }
  },
};
```

This tool demonstrates **error handling within `execute()`**. When the expression is invalid, instead of throwing an exception, the tool returns an error message as its content. This lets the LLM see the error, understand what went wrong, and potentially retry with a corrected expression or explain the issue to the user.

:::warning
The `Function()` constructor used in this calculator tool is a simplified demo. In production, **never** evaluate arbitrary user-provided expressions this way -- it's equivalent to `eval()` and is a serious security risk. Use a proper math expression parser like [mathjs](https://mathjs.org/) instead.
:::

## Wiring Tools Into a Session

Pass tools via the `customTools` array:

```typescript
const { session } = await createAgentSession({
  model,
  tools: [], // No built-in coding tools
  customTools: [weatherTool, calculatorTool], // Our custom tools
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
});
```

The `tools` array is for pi-coding-agent's **built-in** coding tools (file read, file write, bash execution, etc.). The `customTools` array is for **your** tools. Keep them separate -- this makes it easy to enable or disable built-in coding capabilities independently of your custom tools.

## Observing Tool Events

Just like text streaming, tool execution is observable through the event system:

```typescript
session.subscribe((event) => {
  switch (event.type) {
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      break;

    case "tool_execution_start":
      console.log(
        `\n🔧 Tool call: ${event.toolName}(${JSON.stringify(event.args)})`,
      );
      break;

    case "tool_execution_end":
      console.log(`✅ Result: ${JSON.stringify(event.result)}\n`);
      break;
  }
});
```

The `tool_execution_start` event fires _before_ your `execute()` function runs, and `tool_execution_end` fires _after_ it returns. This lets you build UIs that show "Loading weather data..." while the tool is running, or log tool calls for debugging.

## Designing Effective Tools

The quality of your tool descriptions and parameter schemas directly affects how well the LLM uses them. Here are guidelines learned from production experience:

### Write descriptions from the LLM's perspective

Your `description` is the LLM's only guide for deciding when to use a tool. Write it as if you're explaining to a human assistant:

```typescript
// Bad -- too vague, the LLM doesn't know when to use it
description: "Weather tool";

// Good -- clear trigger condition and purpose
description: "Get current weather for a city. Use this when the user asks about weather, temperature, or climate conditions for a specific location.";
```

### Include examples in parameter descriptions

LLMs understand structured data better with examples:

```typescript
// Bad
city: Type.String({ description: "The city" });

// Good
city: Type.String({
  description: 'City name (e.g. "Tokyo", "London", "New York")',
});
```

### Keep tools focused

Each tool should do one thing well. Instead of a single `do_everything` tool with many optional parameters, create several focused tools. The LLM is better at choosing among specific tools than navigating complex parameter combinations.

### Return structured data, not natural language

Return JSON objects or structured text, not pre-formatted sentences. The LLM is excellent at presenting data in a human-friendly way, and it can adapt the presentation to the conversation context:

```typescript
// Bad -- the LLM will awkwardly quote or paraphrase this
return {
  content: [{ type: "text", text: "It is 22 degrees and sunny in Tokyo." }],
};

// Good -- the LLM can present this naturally
return {
  content: [
    {
      type: "text",
      text: JSON.stringify({ city: "Tokyo", temp: "22°C", condition: "Sunny" }),
    },
  ],
};
```

### Handle errors gracefully

Never throw exceptions from `execute()`. Always return an error as content so the LLM can reason about it:

```typescript
execute: async (_id, params) => {
  try {
    const result = await riskyOperation();
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      details: {},
    };
  } catch (e) {
    return {
      content: [{ type: "text", text: `Error: ${e.message}` }],
      details: {},
    };
  }
};
```

:::tip
When a tool returns an error, the LLM often handles it gracefully -- it might apologize, explain what went wrong, or try a different approach. This is much better than crashing the entire agent with an unhandled exception.
:::

## Common Mistakes

**Forgetting `as const` on the content type.** TypeScript needs `type: 'text' as const` to narrow the string literal type. Without `as const`, TypeScript infers `type: string`, which doesn't satisfy the `ToolResultContent` union type.

**Using Zod instead of TypeBox.** The `parameters` field must be a TypeBox schema (`Type.Object({...})`), not a Zod schema. pi-coding-agent uses TypeBox for direct JSON Schema compatibility.

**Tool names with hyphens or spaces.** Use `snake_case` for tool names (e.g., `get_weather`, not `get-weather` or `Get Weather`). Some LLM providers reject non-standard naming.

**Overly generic tool descriptions.** If the LLM can't tell when to use your tool, it won't. Be specific about the trigger conditions in the description.

## Run

```bash
bun run ch03

# Or with a custom question:
bun run ch03 "What's the weather in London?"
```

## Expected Output

```
You: What's the weather in Tokyo? Also, what is 42 * 17?

🔧 Tool call: get_weather({"city":"Tokyo"})
✅ Result: [{"type":"text","text":"{\"city\":\"Tokyo\",\"temp\":\"22°C\",...}"}]

🔧 Tool call: calculate({"expression":"42 * 17"})
✅ Result: [{"type":"text","text":"714"}]

The weather in Tokyo is 22°C and sunny. And 42 × 17 = 714.
```

Notice how the LLM correctly identifies that it needs _two_ tools and calls them both before composing its final response. This is the agent loop in action -- the model reasons about what tools to call, executes them, and then synthesizes the results into a coherent answer.

## Key Takeaways

- **Tool calling** lets LLMs interact with the outside world by requesting your code to execute functions on their behalf.
- Tools are defined with a `ToolDefinition` object containing a name, description, TypeBox parameter schema, and an `execute()` function.
- **TypeBox** is used instead of Zod because it generates JSON Schema natively, which is the format LLM APIs expect.
- The quality of your tool descriptions is critical -- the LLM reads them to decide _when_ and _how_ to use each tool.
- Tool execution happens inside the agent loop: the LLM can call multiple tools in sequence and reason about their results before producing a final response.
- Always handle errors inside `execute()` and return them as content rather than throwing exceptions.

## Next

[Chapter 04: Session Persistence](/guide/04-session-persistence) -- save and resume conversations so the agent remembers what you discussed yesterday.
