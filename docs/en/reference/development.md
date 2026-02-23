# Development

This guide covers setting up the Pi development environment, building from source, and contributing.

## Clone and Setup

```bash
# Clone the repository
git clone https://github.com/anthropics/pi.git
cd pi

# Install dependencies
npm install

# Build all packages
npm run build

# Run from source
node packages/coding-agent/bin/pi.js
```

To iterate during development, use the watch mode:

```bash
npm run watch
```

This rebuilds packages on change, allowing you to test modifications without manual rebuild steps.

## Customization

If you are building a custom version or fork, update the following fields in `package.json`:

| Field       | Purpose                                  |
| ----------- | ---------------------------------------- |
| `name`      | Package name on npm                      |
| `configDir` | Settings directory name (default: `.pi`) |
| `bin`       | CLI command name                         |

These fields control where Pi stores configuration, how it registers the CLI binary, and the published package identity.

## Code Practices

- **Imports**: Always import shared constants and paths from `src/config.ts`. Do not use `__dirname` or hardcoded paths for locating project resources.
- **Types**: Keep type definitions co-located with the code that uses them. Shared types go in the shared types package.
- **Error handling**: Use structured error types. Avoid throwing raw strings.

## Debugging

### The `/debug` command

Inside a running Pi session, type `/debug` to display diagnostic information including:

- Current model and provider
- Active extensions and skills
- Session configuration
- Token usage statistics

### Log location

Pi writes debug logs to:

| Platform | Path                      |
| -------- | ------------------------- |
| macOS    | `~/Library/Logs/Pi/`      |
| Linux    | `~/.local/share/pi/logs/` |
| Windows  | `%APPDATA%\Pi\logs\`      |

Set the `PI_DEBUG=1` environment variable for verbose logging output.

## Testing

### Non-API tests (no credentials required)

```bash
npm test
```

Runs the full unit test suite without making any external API calls. These tests mock all network interactions.

### Full tests (requires API keys)

```bash
PI_API_KEY=sk-... npm run test:full
```

Runs the complete test suite including integration tests that call live APIs. Requires valid API credentials.

### Individual tests

```bash
# Run a specific test file
npm test -- --grep "pattern"

# Run tests for a specific package
npm test -w packages/agent
```

## Architecture

Pi is organized as a monorepo with four core packages:

### `packages/ai`

The AI abstraction layer. Handles model provider integration, message formatting, streaming, and token counting. This package wraps the Vercel AI SDK and adds Pi-specific features like tool management and prompt assembly.

### `packages/agent`

The core agent runtime. Manages conversation state, tool execution, permission checks, and the agent loop. This is the engine that drives a Pi session, coordinating between user input, model responses, and tool calls.

### `packages/tui`

The terminal user interface framework. Provides a component-based rendering system for building interactive terminal UIs. Includes layout primitives (Box, Text, Container), input handling, and overlay management. See [TUI Components](/reference/tui) for details.

### `packages/coding-agent`

The top-level application package. Assembles the other packages into the complete Pi CLI experience. Contains the CLI entry point, built-in tools, configuration loading, and the default prompt system. This is what gets published to npm as the `pi` command.

### Package dependency graph

```
coding-agent
├── agent
│   └── ai
└── tui
```

`coding-agent` depends on `agent` and `tui`. `agent` depends on `ai`. The `tui` package is independent and has no internal dependencies.
