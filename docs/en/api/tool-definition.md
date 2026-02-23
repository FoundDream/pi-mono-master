# ToolDefinition

The `ToolDefinition` interface from `@mariozechner/pi-coding-agent` defines a custom tool that an agent can invoke.

## Interface

```typescript
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
```

| Field         | Type       | Description                                                 |
| ------------- | ---------- | ----------------------------------------------------------- |
| `name`        | `string`   | Tool name used in LLM tool calls (use `snake_case`)         |
| `label`       | `string`   | Human-readable label                                        |
| `description` | `string`   | Description shown to the LLM to decide when to use the tool |
| `parameters`  | `TObject`  | TypeBox schema defining accepted parameters                 |
| `execute`     | `Function` | Async function called when the LLM invokes the tool         |

## Execute Signature

```typescript
execute: async (
  toolCallId: string, // Unique ID for this tool call
  params: Record<string, any>, // Parsed parameters matching the schema
  signal?: AbortSignal, // Abort signal for cancellation
  onUpdate?: Function, // Progress update callback
) => {
  return {
    content: [{ type: "text", text: "..." }],
    details: {},
  };
};
```

### Return Value

```typescript
{
  content: Array<{ type: 'text'; text: string } | { type: 'image'; ... }>
  details: Record<string, any>
}
```

## Parameter Schemas

Tools use `@sinclair/typebox` (NOT Zod) for parameter definitions:

```typescript
import { Type } from "@sinclair/typebox";

// String parameter
Type.String({ description: "City name" });

// Number parameter
Type.Number({ description: "Temperature in Celsius" });

// Enum parameter
Type.Union([Type.Literal("celsius"), Type.Literal("fahrenheit")], {
  description: "Temperature unit",
});

// Optional parameter
Type.Optional(Type.String({ description: "Optional note" }));

// Object with multiple fields
Type.Object({
  city: Type.String({ description: "City name" }),
  unit: Type.Optional(
    Type.String({ description: "Unit (celsius/fahrenheit)" }),
  ),
});
```

## Minimal Example

```typescript
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

const greetTool: ToolDefinition = {
  name: "greet",
  label: "Greet",
  description: "Greet a person by name.",
  parameters: Type.Object({
    name: Type.String({ description: "Person name" }),
  }),
  execute: async (_toolCallId, params) => {
    const { name } = params as { name: string };
    return {
      content: [{ type: "text" as const, text: `Hello, ${name}!` }],
      details: {},
    };
  },
};
```

## With Confirmation

For dangerous operations, accept a `waitForConfirmation` callback:

```typescript
function createDangerousTool(
  waitForConfirmation: () => Promise<{ confirmed: boolean }>,
): ToolDefinition {
  return {
    name: "dangerous_action",
    label: "Dangerous Action",
    description: "Requires user confirmation before executing.",
    parameters: Type.Object({
      action: Type.String({ description: "Action to perform" }),
    }),
    execute: async (_toolCallId, params) => {
      const { action } = params as { action: string };

      console.log(`⚠️  Confirm: ${action} [y/N]`);
      const { confirmed } = await waitForConfirmation();

      if (!confirmed) {
        return {
          content: [{ type: "text" as const, text: "Cancelled by user." }],
          details: {},
        };
      }

      return {
        content: [{ type: "text" as const, text: `Done: ${action}` }],
        details: {},
      };
    },
  };
}
```

See [Chapter 05: Confirmation Pattern](/guide/05-confirmation-pattern) for the full pattern.

## Registering Tools

Pass custom tools to `createAgentSession()`:

```typescript
const { session } = await createAgentSession({
  model,
  tools: [],                        // Built-in coding tools (empty = none)
  customTools: [greetTool, ...],    // Your custom tools
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
})
```

## Tool Events

When a tool executes, the session emits events you can observe:

```typescript
session.subscribe((event) => {
  if (event.type === "tool_execution_start") {
    console.log(`🔧 ${event.toolName}(${JSON.stringify(event.args)})`);
  }
  if (event.type === "tool_execution_end") {
    console.log(`✅ Result: ${JSON.stringify(event.result)}`);
  }
});
```

See [Chapter 03: Custom Tools](/guide/03-custom-tools) for a complete walkthrough.
