# pi-mono-master

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/FoundDream/pi-mono-master)](https://github.com/FoundDream/pi-mono-master/stargazers)
[![Bun](https://img.shields.io/badge/runtime-Bun-f472b6?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

[English](./README.md) | 简体中文

> **🚧 施工中**：本项目正在持续开发和完善中。

> 从零开始，一步步学会构建 AI Agent — 从最小化的 "hello world" 到生产级 CLI Agent。

使用 [`@mariozechner/pi-coding-agent`](https://github.com/nicepkg/pi) 构建 AI Agent 的渐进式 8 章教程。每个章节可独立运行，涵盖流式输出、自定义工具、会话持久化、技能系统等核心模式。

## 文档站点

本项目包含一个基于 [Rspress](https://rspress.dev) 的完整文档站，支持中英双语。

```bash
# 启动文档开发服务器
bun run docs:dev

# 构建生产版本
bun run docs:build
```

站点包含三个板块：

| 板块                          | 说明                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| **Guide（教程）**             | 8 章渐进式教程，含代码详解                                      |
| **API Reference（API 参考）** | Model 和 ToolDefinition 接口文档                                |
| **Reference（参考文档）**     | pi-coding-agent 官方文档（SDK、Session、Extensions、Skills 等） |

> Reference 板块搬运自 [pi-coding-agent 官方文档](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs)，涵盖 SDK 使用、会话格式、上下文压缩、RPC 模式、扩展、技能、主题、平台配置等 22 个主题。

## 快速开始

```bash
# 安装依赖
bun install

# 复制并编辑 API 密钥
cp .env.example .env

# 运行任意章节
bun run ch01
```

## 章节目录

| #   | 章节                                                      | 核心概念                                                 |
| --- | --------------------------------------------------------- | -------------------------------------------------------- |
| 01  | [Hello Agent](chapters/01-hello-agent/)                   | `createAgentSession`、`session.prompt()`、最小化流程     |
| 02  | [流式输出](chapters/02-streaming/)                        | `subscribe()` 事件、`text_delta`、打字机效果             |
| 03  | [自定义工具](chapters/03-custom-tools/)                   | `ToolDefinition`、TypeBox Schema、工具执行事件           |
| 04  | [会话持久化](chapters/04-session-persistence/)            | `SessionManager`、JSONL 会话文件、对话恢复               |
| 05  | [确认模式](chapters/05-confirmation-pattern/)             | 阻塞式工具执行、用户确认流程                             |
| 06  | [系统提示词与技能](chapters/06-system-prompt-and-skills/) | `DefaultResourceLoader`、`loadSkillsFromDir`、提示词工程 |
| 07  | [多会话管理](chapters/07-multi-session/)                  | 会话列表、切换、创建、`SessionManager.list()`            |
| 08  | [完整 CLI Agent](chapters/08-full-cli-agent/)             | 所有模式整合，构建生产级 CLI Agent                       |

## 前置要求

- [Bun](https://bun.sh) 运行时
- Anthropic、OpenAI 或 Google 的 API 密钥

## 配置

在 `.env` 中设置 Provider 和 API 密钥：

```bash
AI_PROVIDER=anthropic          # 可选: openai, google, deepseek
AI_MODEL=claude-sonnet-4-6        # 可选: gpt-5.2, gemini-2.5-flash
ANTHROPIC_API_KEY=sk-ant-xxx   # 你的 API 密钥
```

## 项目结构

```
pi-mono-master/
├── docs/                   # Rspress 文档站
│   ├── en/                 # 英文文档
│   │   ├── guide/          #   教程章节
│   │   ├── api/            #   API 参考
│   │   └── reference/      #   pi-coding-agent 官方文档
│   ├── zh/                 # 中文文档（同结构）
│   └── public/             # 静态资源（Logo 等）
├── shared/model.ts         # 共享模型创建（读取环境变量）
├── chapters/
│   ├── 01-hello-agent/     # 最小化 Agent
│   ├── 02-streaming/       # 实时输出
│   ├── 03-custom-tools/    # 工具定义
│   ├── 04-session-persistence/  # JSONL 会话
│   ├── 05-confirmation-pattern/ # 用户确认流程
│   ├── 06-system-prompt-and-skills/ # 提示词 + 技能
│   ├── 07-multi-session/   # 会话管理
│   └── 08-full-cli-agent/  # 全部整合
├── theme/                  # 自定义 Rspress 主题
├── styles/                 # 自定义样式
└── .env                    # API 密钥（已 gitignore）
```

## 核心依赖

| 包名                            | 用途                                    |
| ------------------------------- | --------------------------------------- |
| `@mariozechner/pi-coding-agent` | Agent 框架（会话、工具、资源加载）      |
| `@mariozechner/pi-ai`           | 模型抽象层（Anthropic、OpenAI、Google） |
| `@sinclair/typebox`             | 工具参数的 TypeBox Schema               |
| `dotenv`                        | 环境变量加载                            |
| `tsx`                           | TypeScript 执行器                       |
| `@rspress/core`                 | 文档站框架                              |
