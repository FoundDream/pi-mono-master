# Getting Started

Welcome to the **pi-coding-agent tutorial** -- a progressive, hands-on guide to building AI agents from scratch. By the end of these eight chapters, you will go from a single prompt-response script to a fully-featured CLI agent complete with streaming output, custom tools, session persistence, user confirmations, and multi-session management.

## Why pi-coding-agent?

Most AI tutorials stop at "call the API and print the response." Real-world agents, however, need much more: they stream responses in real time, invoke external tools, remember previous conversations, ask the user for permission before taking dangerous actions, and manage multiple concurrent sessions. **pi-coding-agent** is a framework that handles all of this plumbing so you can focus on the _behavior_ of your agent rather than the infrastructure.

Think of pi-coding-agent as the "web framework" for AI agents. Just as Express or Fastify gives you routing, middleware, and request handling so you don't rewrite HTTP parsing from scratch, pi-coding-agent gives you session management, tool execution, event streaming, and resource loading so you don't reinvent the agent lifecycle from scratch.

## What You'll Build

Across the eight chapters, you'll progressively construct a CLI agent that can:

1. **Talk** -- Send a prompt and receive a response (Chapter 01)
2. **Stream** -- Display responses in real time, typewriter-style (Chapter 02)
3. **Use tools** -- Call external functions like weather APIs and calculators (Chapter 03)
4. **Remember** -- Persist conversations to disk and resume them later (Chapter 04)
5. **Ask permission** -- Pause and ask the user before executing dangerous operations (Chapter 05)
6. **Customize personality** -- Load system prompts and skills dynamically (Chapter 06)
7. **Juggle conversations** -- Manage multiple sessions in parallel (Chapter 07)
8. **Put it all together** -- A production-quality CLI agent combining every technique (Chapter 08)

Here is a preview of the final Chapter 08 agent in action:

```
$ bun run ch08
> What's the weather in Tokyo?

[Tool: get_weather] {"city":"Tokyo"}
Result: {"city":"Tokyo","temp":"22°C","condition":"Sunny","humidity":"45%"}

The weather in Tokyo is 22°C and sunny with 45% humidity.

> /sessions
Active sessions: 3
  [1] session-abc123 (current)
  [2] session-def456
  [3] session-ghi789

> /quit
Goodbye! Your session has been saved.
```

Each chapter is self-contained and runnable on its own, so you can jump to any topic that interests you -- though working through them in order gives the best learning experience.

## Prerequisites

Before you begin, make sure you have:

- **[Bun](https://bun.sh) runtime** (v1.0 or later) -- This project uses Bun as its package manager and script runner. Bun is fast and supports TypeScript out of the box.
- **An API key** for at least one supported LLM provider: Anthropic, OpenAI, Google, or DeepSeek.

:::tip
If you don't have Bun installed, run `curl -fsSL https://bun.sh/install | bash` on macOS/Linux. On Windows, use `powershell -c "irm bun.sh/install.ps1 | iex"`.
:::

## Installation

Clone the repository and install dependencies:

```bash
# Clone the repository
git clone https://github.com/FoundDream/pi-mono-master.git
cd pi-mono-master

# Install dependencies
bun install
```

:::warning
You **must** use `bun install`, not `npm install` or `pnpm install`. The project's lockfile and scripts are configured for Bun. Using another package manager may result in dependency resolution errors or missing binaries.
:::

## Configuration

Copy the example environment file and fill in your API key:

```bash
cp .env.example .env
```

Edit `.env` to set your provider and key:

```bash
AI_PROVIDER=anthropic          # or: openai, google, deepseek
AI_MODEL=claude-sonnet-4-6        # or: gpt-5.2, gemini-2.5-flash
ANTHROPIC_API_KEY=sk-ant-xxx   # your API key
```

The `shared/model.ts` helper reads these environment variables at startup and constructs a `Model` object that every chapter uses. This means you configure your provider once and every chapter picks it up automatically.

### Supported Providers

| Provider  | `AI_PROVIDER` | API Key Env Var     | Example Model       |
| --------- | ------------- | ------------------- | ------------------- |
| Anthropic | `anthropic`   | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| OpenAI    | `openai`      | `OPENAI_API_KEY`    | `gpt-5.2`           |
| Google    | `google`      | `GOOGLE_API_KEY`    | `gemini-2.5-flash`  |
| DeepSeek  | `deepseek`    | `OPENAI_API_KEY`    | `deepseek-chat`     |

:::tip
DeepSeek uses the OpenAI-compatible API format, which is why it shares the `OPENAI_API_KEY` environment variable. If you want to use both OpenAI and DeepSeek, you'll need to switch the key when switching providers.
:::

## Run Any Chapter

Each chapter is independently runnable. You don't need to complete earlier chapters to run later ones:

```bash
bun run ch01   # Hello Agent
bun run ch02   # Streaming
bun run ch03   # Custom Tools
bun run ch04   # Session Persistence
bun run ch05   # Confirmation Pattern
bun run ch06   # System Prompt & Skills
bun run ch07   # Multi-Session
bun run ch08   # Full CLI Agent
```

Under the hood, each `bun run chXX` command invokes `tsx chapters/XX-name/index.ts`, which runs the TypeScript file directly without a separate compilation step.

## Project Structure

```
pi-mono-master/
├── shared/model.ts              # Shared model creation from env vars
├── chapters/
│   ├── 01-hello-agent/          # Minimal agent
│   ├── 02-streaming/            # Real-time output
│   ├── 03-custom-tools/         # Tool definitions
│   ├── 04-session-persistence/  # JSONL sessions
│   ├── 05-confirmation-pattern/ # User approval flow
│   ├── 06-system-prompt-and-skills/ # Prompts + skills
│   ├── 07-multi-session/        # Session management
│   └── 08-full-cli-agent/       # Everything combined
├── docs/                        # This documentation site (Rspress)
└── .env                         # Your API keys (git-ignored)
```

Each chapter directory contains an `index.ts` entry point and occasionally additional files (like `tools.ts` for tool definitions). The `shared/` directory holds utilities used across all chapters.

## Key Dependencies

| Package                         | Purpose                                                                    |
| ------------------------------- | -------------------------------------------------------------------------- |
| `@mariozechner/pi-coding-agent` | Agent framework -- sessions, tools, resource loading, event system         |
| `@mariozechner/pi-ai`           | Model abstraction layer -- unified interface for Anthropic, OpenAI, Google |
| `@sinclair/typebox`             | TypeBox schemas for defining tool parameters (used instead of Zod)         |
| `dotenv`                        | Environment variable loading from `.env` files                             |
| `tsx`                           | TypeScript execution without a build step                                  |

:::tip
You don't need to understand all of these packages before starting. Each chapter introduces the relevant packages as they become needed.
:::

## Troubleshooting

### "Missing ANTHROPIC_API_KEY" error

The `shared/model.ts` helper checks for the presence of your API key at startup. If you see this error:

1. Make sure you've created a `.env` file (not `.env.example`)
2. Verify the key name matches your provider -- e.g., `ANTHROPIC_API_KEY` for Anthropic, `OPENAI_API_KEY` for OpenAI
3. Ensure there are no extra spaces or quotes around the key value

### "Command not found: bun"

You need to install the Bun runtime. See [bun.sh](https://bun.sh) for installation instructions.

### "Cannot find module '@mariozechner/pi-coding-agent'"

Run `bun install` from the project root. If you previously used `npm install`, delete `node_modules/` first and re-run with Bun.

### Chapters run but produce no output

Make sure your API key is valid and has available credits. You can test connectivity by running `bun run ch01` first, which sends a single prompt and prints the response.

## Next Steps

Start with [Chapter 01: Hello Agent](/guide/01-hello-agent) to create your first agent. It takes less than 30 lines of code to go from zero to a working AI agent.
