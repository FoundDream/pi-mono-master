# 技能

技能是自包含的能力包，通过 Markdown 文件为 Pi 提供专业领域知识和操作指南。

## 概述

技能是结构化的 Markdown 文档，包含上下文信息和操作指引，让 Pi 能够在特定领域中执行专业任务。与扩展不同，技能不执行代码，而是通过注入提示内容来增强模型的能力。

## 加载位置

| 位置 | 作用域 | 说明 |
|------|--------|------|
| `~/.pi/agent/skills/` | 全局 | 所有项目可用 |
| `.pi/skills/` | 项目级 | 仅当前项目可用 |
| 包中的技能 | 依赖包 | 通过 `pi install` 安装的包 |

## 渐进式披露

技能采用渐进式披露机制，避免一次性加载所有内容到上下文中：

1. **发现阶段**：Pi 启动时扫描所有可用技能，仅加载技能名称和简要描述
2. **激活阶段**：当用户通过 `/skill-name` 调用技能或模型判断需要使用某技能时，完整内容被加载到上下文中
3. **使用阶段**：技能内容作为系统提示的一部分参与对话

这种机制确保只有相关的技能内容占用上下文窗口。

## SKILL.md 结构

每个技能是一个包含 `SKILL.md` 文件的目录，或者一个独立的 `.md` 文件。

### 目录结构

```
my-skill/
├── SKILL.md          # 技能主文件（必需）
└── resources/        # 可选的附加资源
    ├── examples.md
    └── templates/
```

### Frontmatter

`SKILL.md` 使用 YAML frontmatter 定义元数据：

```markdown
---
name: code-review
description: Comprehensive code review with best practices
triggers:
  - review
  - code review
  - pr review
---

# Code Review Skill

When asked to review code, follow these guidelines:

## Checklist

1. Check for security vulnerabilities
2. Verify error handling
3. Review naming conventions
4. Assess test coverage
...
```

### Frontmatter 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | 否 | 技能名称（默认使用文件名或目录名） |
| `description` | string | 是 | 技能的简要描述，用于发现阶段 |
| `triggers` | string[] | 否 | 触发词列表，帮助 Pi 判断何时激活该技能 |

## 访问方式

用户可以通过以下方式使用技能：

```bash
# 使用斜杠命令直接调用
/code-review

# 带参数调用
/code-review src/main.ts

# 在对话中提及触发词，Pi 会自动判断是否激活
```

如果 `enableSkillCommands` 设置为 `true`（默认值），技能会被注册为可用的斜杠命令。

## 验证标准

一个良好的技能应满足以下标准：

- **明确范围**：专注于单一领域或任务类型
- **可操作性**：包含具体的步骤和指南，而非泛泛的建议
- **自包含**：不依赖外部未说明的上下文
- **简洁性**：保持内容精炼，避免不必要的冗余
- **示例驱动**：包含实际示例以帮助模型理解预期行为

:::warning
技能可以指导模型执行任意操作。只加载你信任的技能，特别是来自第三方包的技能。
:::
