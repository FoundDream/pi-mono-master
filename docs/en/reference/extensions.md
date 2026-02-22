# Extensions

Extensions are TypeScript modules that modify Pi's behavior at runtime. They can register tools, intercept events, inject UI, and integrate custom providers.

## Security Note

Extensions run with full system permissions in the main process. Only install extensions from sources you trust. An extension has the same access as Pi itself -- it can read files, execute commands, and make network requests.

## Placement

Extensions are loaded from multiple locations:

| Location | Scope | Description |
|----------|-------|-------------|
| `~/.pi/agent/extensions/` | Global | Available in all projects |
| `.pi/extensions/` | Project | Project-specific extensions |
| Settings `extensions` array | Any | Paths specified in settings |
| Packages | Any | Extensions from installed packages |

Extensions support hot reload. When you modify an extension file, Pi reloads it automatically without restarting the session.

## Basic Structure

An extension exports a default function that receives the `ExtensionAPI` object:

```typescript
import type { ExtensionAPI } from "@anthropic/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Register tools, listen to events, etc.
  pi.registerTool({
    name: "my_tool",
    description: "Does something useful",
    parameters: Type.Object({
      input: Type.String({ description: "The input value" }),
    }),
    execute: async (params) => {
      return { result: `Processed: ${params.input}` };
    },
  });
}
```

## Event System

Extensions can listen to events throughout the agent lifecycle:

```typescript
export default function (pi: ExtensionAPI) {
  // Session events
  pi.on("session:start", (event) => {
    console.log("Session started:", event.sessionId);
  });

  pi.on("session:end", (event) => {
    console.log("Session ended:", event.sessionId);
  });

  // Message events
  pi.on("message:user", (event) => {
    console.log("User said:", event.content);
  });

  pi.on("message:assistant", (event) => {
    console.log("Assistant responded:", event.content);
  });

  // Tool events
  pi.on("tool:start", (event) => {
    console.log(`Tool ${event.name} called with:`, event.arguments);
  });

  pi.on("tool:end", (event) => {
    console.log(`Tool ${event.name} returned:`, event.result);
  });

  // Generation events
  pi.on("generation:start", () => {
    console.log("LLM generation started");
  });

  pi.on("generation:end", (event) => {
    console.log("Generation complete, tokens:", event.usage);
  });

  // Error events
  pi.on("error", (event) => {
    console.error("Error:", event.error);
  });
}
```

### Event Categories

| Category | Events | Description |
|----------|--------|-------------|
| Session | `session:start`, `session:end`, `session:fork` | Session lifecycle |
| Message | `message:user`, `message:assistant`, `message:system` | Message flow |
| Tool | `tool:start`, `tool:end`, `tool:error` | Tool execution |
| Generation | `generation:start`, `generation:end`, `generation:stream` | LLM generation |
| Error | `error` | Error handling |
| Compaction | `compaction:start`, `compaction:end` | Context compaction |

## Custom Tools

Register tools using `pi.registerTool()` with TypeBox schemas for parameter validation:

```typescript
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "fetch_weather",
    description: "Get current weather for a city",
    parameters: Type.Object({
      city: Type.String({ description: "City name" }),
      units: Type.Optional(
        Type.Union([Type.Literal("celsius"), Type.Literal("fahrenheit")], {
          description: "Temperature units",
          default: "celsius",
        })
      ),
    }),
    execute: async (params) => {
      const response = await fetch(
        `https://api.weather.example.com/current?city=${params.city}&units=${params.units || "celsius"}`
      );
      const data = await response.json();
      return {
        city: params.city,
        temperature: data.temp,
        condition: data.condition,
        humidity: data.humidity,
      };
    },
  });
}
```

Tools registered by extensions appear alongside built-in tools. The LLM can invoke them like any other tool.

## UI Integration

Extensions can interact with the UI through `ctx.ui`:

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "confirm_deploy",
    description: "Deploy to production with confirmation",
    parameters: Type.Object({
      environment: Type.String(),
      version: Type.String(),
    }),
    execute: async (params, ctx) => {
      // Show a confirmation dialog
      const confirmed = await ctx.ui.confirm(
        `Deploy ${params.version} to ${params.environment}?`
      );
      if (!confirmed) {
        return { status: "cancelled" };
      }

      // Show a notification
      ctx.ui.notify(`Deploying ${params.version}...`);

      // Update status bar
      ctx.ui.setStatus(`Deploying to ${params.environment}`);

      // Perform deployment
      const result = await deploy(params.environment, params.version);

      ctx.ui.notify(`Deployment complete!`);
      ctx.ui.clearStatus();

      return { status: "deployed", result };
    },
  });
}
```

### UI Methods

| Method | Description |
|--------|-------------|
| `ctx.ui.confirm(message)` | Show a yes/no confirmation dialog |
| `ctx.ui.notify(message)` | Display a notification |
| `ctx.ui.setStatus(message)` | Set status bar text |
| `ctx.ui.clearStatus()` | Clear status bar |

## State Management

Tools can attach additional details to their results for display:

```typescript
pi.registerTool({
  name: "search_docs",
  description: "Search documentation",
  parameters: Type.Object({
    query: Type.String(),
  }),
  execute: async (params, ctx) => {
    const results = await searchIndex(params.query);

    // Attach display details
    ctx.details = results.map((r) => ({
      title: r.title,
      path: r.path,
      snippet: r.snippet,
    }));

    return {
      count: results.length,
      results: results.map((r) => ({ title: r.title, path: r.path })),
    };
  },
});
```

## Message Injection

Extensions can send messages into the conversation:

```typescript
export default function (pi: ExtensionAPI) {
  // Send a message as the user
  pi.sendUserMessage("Please summarize the current codebase.");

  // Send a system/steering message
  pi.sendMessage({
    role: "system",
    content: "The user prefers concise responses.",
  });
}
```

## Session Control

In custom commands, extensions have access to session control methods:

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerCommand({
    name: "reset",
    description: "Start fresh",
    execute: async (args, ctx) => {
      // Start a new session
      await ctx.session.newSession();
    },
  });

  pi.registerCommand({
    name: "branch",
    description: "Fork the conversation",
    execute: async (args, ctx) => {
      // Fork the current session
      await ctx.session.fork();
    },
  });

  pi.registerCommand({
    name: "back",
    description: "Go back in conversation tree",
    execute: async (args, ctx) => {
      // Navigate the conversation tree
      await ctx.session.navigateTree("parent");
    },
  });

  pi.registerCommand({
    name: "refresh",
    description: "Reload configuration",
    execute: async (args, ctx) => {
      // Reload extensions, skills, and configuration
      await ctx.session.reload();
    },
  });
}
```

### Session Methods

| Method | Description |
|--------|-------------|
| `ctx.session.newSession()` | Start a new empty session |
| `ctx.session.fork()` | Fork the current session at this point |
| `ctx.session.navigateTree(direction)` | Navigate: `"parent"`, `"child"`, `"sibling"` |
| `ctx.session.reload()` | Reload all extensions and configuration |

## Provider Registration

Extensions can register custom LLM providers. See the [Custom Provider](/reference/custom-provider) reference for the full API:

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerProvider({
    name: "my-provider",
    baseUrl: "https://api.example.com/v1",
    api: "openai-completions",
    apiKey: process.env.MY_API_KEY,
    models: [{ id: "my-model", name: "My Model" }],
  });
}
```

## Error Handling

If an extension throws during loading, Pi logs the error and continues without the extension. If a tool's `execute` function throws, the error is reported to the LLM as a tool error result so it can recover gracefully.

```typescript
pi.registerTool({
  name: "risky_operation",
  description: "An operation that might fail",
  parameters: Type.Object({ input: Type.String() }),
  execute: async (params) => {
    // If this throws, the LLM sees the error message
    // and can decide how to proceed
    const result = await riskyOperation(params.input);
    return result;
  },
});
```

## Mode Compatibility

Extensions are loaded in all modes (interactive, non-interactive, and piped). If your extension is only relevant in interactive mode, check the mode before registering UI-dependent features:

```typescript
export default function (pi: ExtensionAPI) {
  // Always register tools (they work in all modes)
  pi.registerTool({ ... });

  // Only register UI features in interactive mode
  if (pi.mode === "interactive") {
    pi.registerCommand({ ... });
  }
}
```
