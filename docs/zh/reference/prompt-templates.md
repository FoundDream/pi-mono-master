# 提示模板

提示模板是 Markdown 文件，使用 `/name` 语法调用时会展开为完整的提示内容。

## 位置

| 位置 | 作用域 |
|------|--------|
| `~/.pi/agent/prompts/*.md` | 全局 |
| `.pi/prompts/*.md` | 项目级 |
| 包目录 | 依赖包 |
| `--prompt-template` CLI 参数 | 运行时 |

## 结构

文件名即为命令名称。例如 `review.md` 变为 `/review`。

```markdown
---
description: Review code for best practices
---
Review the following code for best practices and potential issues:

$@
```

## 参数语法

| 语法 | 说明 |
|------|------|
| `$1`, `$2` | 位置参数 |
| `$@` 或 `$ARGUMENTS` | 所有参数 |
| `${@:N}` | 从位置 N 开始的所有参数 |
| `${@:N:L}` | 从位置 N 开始的 L 个参数 |

## 发现规则

`prompts/` 目录中的模板发现是非递归的。如需包含子目录中的模板，请在设置文件或包清单中明确指定路径。
