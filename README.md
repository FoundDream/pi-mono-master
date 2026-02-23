# pi-mono-master

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/FoundDream/pi-mono-master)](https://github.com/FoundDream/pi-mono-master/stargazers)
[![Bun](https://img.shields.io/badge/runtime-Bun-f472b6?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

English | [简体中文](./README.zh-CN.md)

> **🚧 WIP**: This project is under active development and being continuously improved.

> Learn to build AI agents step by step — from a minimal "hello world" to a production-ready CLI agent.

A progressive 8-chapter tutorial for building AI agents from scratch with [`@mariozechner/pi-coding-agent`](https://github.com/nicepkg/pi). Each chapter is independently runnable and builds on the previous one, covering streaming, custom tools, session persistence, skills, and more.

## Documentation Site

This project includes a full documentation site built with [Rspress](https://rspress.dev), with bilingual support (English / Chinese).

```bash
# Start the docs dev server
bun run docs:dev

# Build for production
bun run docs:build
```

The site contains three sections:

| Section | Description |
|---------|-------------|
| **Guide** | 8-chapter progressive tutorial with code walkthroughs |
| **API Reference** | Model and ToolDefinition API reference |
| **Reference** | Official pi-coding-agent documentation (SDK, Session, Extensions, Skills, etc.) |

> The Reference section is ported from the [official pi-coding-agent docs](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs), covering 22 topics including SDK usage, session format, compaction, RPC mode, extensions, skills, themes, and platform setup.

## Quick Start

```bash
# Install dependencies
bun install

# Copy and edit your API keys
cp .env.example .env

# Run any chapter
bun run ch01
```

## Chapters

| # | Chapter | Key Concepts |
|---|---------|-------------|
| 01 | [Hello Agent](chapters/01-hello-agent/) | `createAgentSession`, `session.prompt()`, minimal pipeline |
| 02 | [Streaming](chapters/02-streaming/) | `subscribe()` events, `text_delta`, typewriter output |
| 03 | [Custom Tools](chapters/03-custom-tools/) | `ToolDefinition`, TypeBox schemas, tool execution events |
| 04 | [Session Persistence](chapters/04-session-persistence/) | `SessionManager`, JSONL sessions, conversation resumption |
| 05 | [Confirmation Pattern](chapters/05-confirmation-pattern/) | Blocking tool execution, user confirmation flow |
| 06 | [System Prompt & Skills](chapters/06-system-prompt-and-skills/) | `DefaultResourceLoader`, `loadSkillsFromDir`, prompt engineering |
| 07 | [Multi-Session](chapters/07-multi-session/) | Session listing, switching, creating, `SessionManager.list()` |
| 08 | [Full CLI Agent](chapters/08-full-cli-agent/) | All patterns combined into a production-quality CLI agent |

## Prerequisites

- [Bun](https://bun.sh) runtime
- An API key for Anthropic, OpenAI, or Google

## Configuration

Set your provider and API key in `.env`:

```bash
AI_PROVIDER=anthropic          # or: openai, google, deepseek
AI_MODEL=claude-sonnet-4-6        # or: gpt-5.2, gemini-2.5-flash
ANTHROPIC_API_KEY=sk-ant-xxx   # your API key
```

## Architecture

```
pi-mono-master/
├── docs/                   # Rspress documentation site
│   ├── en/                 # English docs
│   │   ├── guide/          #   Tutorial chapters
│   │   ├── api/            #   API reference
│   │   └── reference/      #   Official pi-coding-agent docs
│   ├── zh/                 # Chinese docs (same structure)
│   └── public/             # Static assets (logo, etc.)
├── shared/model.ts         # Shared model creation from env vars
├── chapters/
│   ├── 01-hello-agent/     # Minimal agent
│   ├── 02-streaming/       # Real-time output
│   ├── 03-custom-tools/    # Tool definitions
│   ├── 04-session-persistence/  # JSONL sessions
│   ├── 05-confirmation-pattern/ # User approval flow
│   ├── 06-system-prompt-and-skills/ # Prompts + skills
│   ├── 07-multi-session/   # Session management
│   └── 08-full-cli-agent/  # Everything combined
├── theme/                  # Custom Rspress theme
├── styles/                 # Custom CSS
└── .env                    # Your API keys (git-ignored)
```

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@mariozechner/pi-coding-agent` | Agent framework (sessions, tools, resources) |
| `@mariozechner/pi-ai` | Model abstraction (Anthropic, OpenAI, Google) |
| `@sinclair/typebox` | TypeBox schemas for tool parameters |
| `dotenv` | Environment variable loading |
| `tsx` | TypeScript execution |
| `@rspress/core` | Documentation site framework |
