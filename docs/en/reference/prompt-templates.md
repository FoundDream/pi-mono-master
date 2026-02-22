# Prompt Templates

Prompt templates are Markdown files that expand into complete prompts when invoked with `/name` syntax.

## Locations

| Location | Scope |
|----------|-------|
| `~/.pi/agent/prompts/*.md` | Global |
| `.pi/prompts/*.md` | Project |
| Package directories | Package |
| `--prompt-template` CLI flag | Runtime |

## Structure

The filename becomes the command name. `review.md` becomes `/review`.

```markdown
---
description: Review code for best practices
---
Review the following code for best practices and potential issues:

$@
```

## Arguments

| Syntax | Description |
|--------|-------------|
| `$1`, `$2` | Positional arguments |
| `$@` or `$ARGUMENTS` | All arguments |
| `${@:N}` | Arguments starting at position N |
| `${@:N:L}` | L arguments starting at position N |

## Discovery

Template discovery in `prompts/` is non-recursive. Use settings or package manifests for subdirectories.
