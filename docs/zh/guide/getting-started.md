# 快速开始

欢迎来到 **pi-coding-agent** 教程系列！无论你是刚开始接触 AI Agent 开发，还是已经有一定经验的开发者，这个教程都将带你从零到一，系统地构建一个功能完整的 AI Agent。

在当今的 AI 应用开发中，"Agent" 已经成为最热门的范式之一。与简单的"聊天机器人"不同，Agent 能够**自主决策、使用工具、记住上下文**，并完成复杂的多步骤任务。`pi-coding-agent` 正是为此而生的框架 —— 它提供了构建生产级 Agent 所需的全部基础设施：会话管理、工具系统、流式输出、持久化存储等。

本教程采用**渐进式学习**的方式，每一章聚焦一个核心概念，逐步叠加功能，最终在第 08 章将所有内容整合成一个完整的 CLI Agent。

## 你将构建什么

通过这 8 个章节，你将从一个只会"问一答一"的最简 Agent 出发，逐步构建出一个拥有以下能力的完整 AI Agent：

| 章节                  | 核心能力 | 你将实现的效果                         |
| --------------------- | -------- | -------------------------------------- |
| 01 - Hello Agent      | 基础对话 | 发送一条消息，收到一个完整回复         |
| 02 - 流式输出         | 实时响应 | ChatGPT 风格的打字机效果               |
| 03 - 自定义工具       | 工具调用 | Agent 能查天气、做计算                 |
| 04 - 会话持久化       | 记忆能力 | 关闭程序后重新打开，Agent 还记得你是谁 |
| 05 - 确认模式         | 安全控制 | 执行危险操作前先征得用户同意           |
| 06 - 系统提示词与技能 | 人格定制 | 自定义 Agent 的行为风格和技能包        |
| 07 - 多会话管理       | 并行对话 | 同时管理多个独立的对话上下文           |
| 08 - 完整 CLI Agent   | 全部整合 | 一个功能完整、可投入使用的命令行 Agent |

每个章节都是**独立可运行**的，你可以按顺序学习，也可以跳到感兴趣的章节。但我们建议你按顺序来，因为每一章都建立在前一章的基础概念之上。

## 前置条件

- [Bun](https://bun.sh) 运行时
- Anthropic、OpenAI 或 Google 的 API Key

:::tip 为什么用 Bun？
本项目使用 [Bun](https://bun.sh) 而不是 Node.js 作为运行时，主要原因是 Bun 内置了 TypeScript 支持（无需额外的编译步骤）、更快的包安装速度，以及原生的 `.env` 文件支持。如果你还没有安装 Bun，只需一行命令：`curl -fsSL https://bun.sh/install | bash`。
:::

## 安装

```bash
# 克隆仓库
git clone https://github.com/FoundDream/pi-mono-master.git
cd pi-mono-master

# 安装依赖
bun install
```

安装完成后，你应该能在 `node_modules/` 中看到 `@mariozechner/pi-coding-agent` 和 `@mariozechner/pi-ai` 这两个核心包。

## 配置

复制示例环境变量文件并填入你的 API Key：

```bash
cp .env.example .env
```

编辑 `.env` 设置你的提供商和密钥：

```bash
AI_PROVIDER=anthropic          # 或: openai
AI_MODEL=claude-sonnet-4-6        # 或: gpt-5.2
ANTHROPIC_API_KEY=sk-ant-xxx   # 你的 API Key
```

:::warning 注意
**永远不要**把你的 `.env` 文件提交到 Git 仓库！本项目已经在 `.gitignore` 中排除了 `.env` 文件，但请务必确认这一点。API Key 泄露可能导致严重的安全问题和意外费用。
:::

### 支持的提供商

| 提供商    | `AI_PROVIDER` | API Key 环境变量    | 示例模型            |
| --------- | ------------- | ------------------- | ------------------- |
| Anthropic | `anthropic`   | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| OpenAI    | `openai`      | `OPENAI_API_KEY`    | `gpt-5.2`           |
| Google    | `google`      | `GOOGLE_API_KEY`    | `gemini-2.5-flash`  |
| DeepSeek  | `deepseek`    | `OPENAI_API_KEY`    | `deepseek-chat`     |

:::tip 提示
不确定选哪个模型？如果你刚开始学习，推荐使用 **Anthropic Claude Sonnet** —— 它在工具调用和指令遵循方面表现优秀，非常适合 Agent 开发。DeepSeek 是性价比较高的选择，适合快速实验。
:::

### 底层原理：模型是如何加载的？

当你在 `.env` 中配置好提供商和模型后，`shared/model.ts` 中的 `createModel()` 函数会读取这些环境变量，构建一个标准化的 `Model<Api>` 对象。这个对象描述了模型的 ID、所属提供商、API 类型、上下文窗口大小等元信息。`pi-coding-agent` 框架通过这个统一的模型描述来适配不同的 AI 提供商，让你可以**一行代码切换模型**，而不需要修改任何业务逻辑。

## 运行任意章节

每个章节都可以独立运行：

```bash
bun run ch01   # Hello Agent
bun run ch02   # 流式输出
bun run ch03   # 自定义工具
bun run ch04   # 会话持久化
bun run ch05   # 确认模式
bun run ch06   # 系统提示词与技能
bun run ch07   # 多会话管理
bun run ch08   # 完整 CLI Agent
```

:::tip 提示
每个 `bun run chXX` 命令实际上运行的是对应章节目录下的 `index.ts` 文件。你可以直接用 `bun run chapters/01-hello-agent/index.ts` 来运行，效果完全一样。
:::

## 项目结构

```
pi-mono-master/
├── shared/model.ts              # 从环境变量创建模型的共享模块
├── chapters/
│   ├── 01-hello-agent/          # 最简 Agent
│   ├── 02-streaming/            # 实时输出
│   ├── 03-custom-tools/         # 工具定义
│   ├── 04-session-persistence/  # JSONL 会话
│   ├── 05-confirmation-pattern/ # 用户审批流程
│   ├── 06-system-prompt-and-skills/ # 提示词 + 技能
│   ├── 07-multi-session/        # 会话管理
│   └── 08-full-cli-agent/       # 全部整合
└── .env                         # 你的 API Key（已 git-ignore）
```

每个章节目录都是自包含的，包含一个 `index.ts` 入口文件和一个 `README.md` 说明文件。部分章节还包含额外的模块文件（如工具定义、配置文件等）。

## 核心依赖

| 包名                            | 用途                                    |
| ------------------------------- | --------------------------------------- |
| `@mariozechner/pi-coding-agent` | Agent 框架（会话、工具、资源）          |
| `@mariozechner/pi-ai`           | 模型抽象层（Anthropic、OpenAI、Google） |
| `@sinclair/typebox`             | 工具参数的 TypeBox Schema               |
| `dotenv`                        | 环境变量加载                            |
| `tsx`                           | TypeScript 执行                         |

这些依赖各司其职：`pi-coding-agent` 是 Agent 的"大脑"，负责协调会话、工具调用和事件系统；`pi-ai` 是"翻译官"，将不同 AI 提供商的 API 统一成一致的接口；`typebox` 用于定义工具的参数类型，确保 LLM 传入的参数是类型安全的。

## 常见问题排查

### `Missing ANTHROPIC_API_KEY` 错误

确保你已经正确创建了 `.env` 文件并填入了 API Key。常见原因：

1. 忘记执行 `cp .env.example .env`
2. `.env` 文件中 API Key 前后有多余的空格或引号
3. `AI_PROVIDER` 设置的提供商与你提供的 API Key 不匹配

### `bun: command not found`

你还没有安装 Bun。运行以下命令安装：

```bash
curl -fsSL https://bun.sh/install | bash
```

安装后重新打开终端，或执行 `source ~/.bashrc`（或 `~/.zshrc`）。

### 网络超时或连接失败

如果你在中国大陆使用，部分 AI 提供商的 API 可能需要代理才能访问。确保你的网络环境可以正常访问对应提供商的 API 端点。DeepSeek 是一个不需要代理的替代选择。

## 下一步

一切准备就绪！从 [第 01 章：Hello Agent](/zh/guide/01-hello-agent) 开始创建你的第一个 Agent。

在开始之前，确保你能成功运行以下命令：

```bash
bun run ch01
```

如果看到 Agent 的回复输出，说明你的环境已经配置正确，可以正式开始学习了！
