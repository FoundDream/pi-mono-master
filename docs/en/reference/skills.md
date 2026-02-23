# Skills

Skills are self-contained capability packages that extend Pi with domain-specific knowledge and instructions. Unlike extensions (which run code), skills are declarative Markdown files that provide context and instructions to the LLM.

## Overview

A skill teaches Pi how to perform a specific task or work with a specific technology. Skills are loaded on-demand -- their descriptions are always visible to the model, but full instructions are only injected when the skill is activated. This progressive disclosure keeps the context window efficient.

## Key Locations

Skills are discovered from multiple locations:

| Location                | Scope   | Description                          |
| ----------------------- | ------- | ------------------------------------ |
| `~/.pi/agent/skills/`   | Global  | Available in all projects            |
| `.pi/skills/`           | Project | Project-specific skills              |
| npm packages            | Any     | Skills from installed packages       |
| Settings `skills` array | Any     | Paths specified in settings          |
| CLI `--skill` flag      | Session | Load a skill for the current session |

## Progressive Disclosure

Skills use a two-tier loading strategy to conserve context:

1. **Description** (always loaded): A short summary from the SKILL.md frontmatter. This is included in every request so the model knows what skills are available.

2. **Full instructions** (loaded on demand): The complete Markdown body is injected only when the skill is activated. This keeps the base context small while making detailed instructions available when needed.

## SKILL.md Structure

Each skill is defined by a `SKILL.md` file with YAML frontmatter and a Markdown body:

```markdown
---
name: docker
description: Build, run, and manage Docker containers and Compose stacks
---

# Docker Skill

## When to Use

Use this skill when the user asks about Docker containers, images, Compose files, or container orchestration.

## Instructions

### Building Images

- Always use multi-stage builds for production images
- Pin base image versions (e.g., `node:20-slim`, not `node:latest`)
- Place frequently changing layers last for better caching
  ...

### Docker Compose

- Use `docker compose` (v2), not `docker-compose` (v1)
- Define health checks for all services
  ...

### Common Patterns

\`\`\`dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
\`\`\`
```

### Frontmatter Requirements

| Field         | Required | Description                                               |
| ------------- | -------- | --------------------------------------------------------- |
| `name`        | Yes      | Unique skill identifier (used in commands and references) |
| `description` | Yes      | Short description (1-2 sentences) shown in skill list     |

The `name` field must be unique across all loaded skills. The `description` is always present in the model's context as part of the available skills list.

## Access Methods

### Slash Command

Invoke a skill explicitly:

```
/skill:docker How do I set up a multi-stage build?
```

### Auto-Selection

The model can select skills automatically based on the conversation context. When the user's request matches a skill's description, the model activates it and loads the full instructions.

### CLI Flag

Load a skill for the entire session:

```bash
pi --skill docker
```

### Settings

Pre-load skills via settings:

```json
{
  "skills": ["~/.pi/agent/skills/docker", "./project-skills/api-guidelines"]
}
```

## Validation Standards

Skills should follow these guidelines:

- **Frontmatter is required**: Both `name` and `description` must be present
- **Description should be actionable**: Describe what the skill enables, not just what it is
- **Instructions should be specific**: Include concrete commands, patterns, and examples
- **Keep skills focused**: One skill per domain or technology. Split broad topics into multiple skills
- **Test instructions**: Verify that the instructions produce correct results when followed

## Security Note

Skills inject content into the LLM context. While skills cannot execute code directly, they influence the model's behavior. Only use skills from trusted sources, as a malicious skill could instruct the model to perform unwanted actions.

## Discovery Behavior

Pi discovers skills differently depending on directory structure:

- **Non-recursive for `.md` files**: Pi scans skill directories for `.md` files at the top level only. A file like `~/.pi/agent/skills/docker.md` is discovered, but `~/.pi/agent/skills/docker/tips.md` is not (unless it is a `SKILL.md`).

- **Recursive for `SKILL.md` directories**: Pi recursively scans directories for files named `SKILL.md`. A skill at `~/.pi/agent/skills/docker/SKILL.md` is discovered, as is `~/.pi/agent/skills/web/react/SKILL.md`.

This means you can organize skills in two ways:

```
# Flat structure (top-level .md files)
~/.pi/agent/skills/
  docker.md
  kubernetes.md
  react.md

# Directory structure (SKILL.md files)
~/.pi/agent/skills/
  docker/
    SKILL.md
    examples/
      Dockerfile.example
  kubernetes/
    SKILL.md
  react/
    SKILL.md
    patterns/
      hooks.md
```

Both structures work. The directory structure is useful when a skill needs supporting files (examples, templates) alongside its SKILL.md definition. Supporting files are not automatically loaded but can be referenced in the skill's instructions.
