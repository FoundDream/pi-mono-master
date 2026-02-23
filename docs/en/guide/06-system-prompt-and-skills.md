# 06 - System Prompt & Skills

Control agent behavior with system prompts and skill files -- the two mechanisms that shape _who_ your agent is and _what_ it knows.

## Why This Chapter Matters

So far, our agent has been a blank slate with a one-liner system prompt like "You are a helpful assistant." That works for demos, but real-world agents need a richer identity. Consider the difference between:

- "You are a helpful assistant." -- generic, no guardrails, no domain expertise
- A weather forecasting agent that always structures responses as weather reports, uses meteorological terminology, and cites data sources

The first is a chatbot. The second is a **specialist**. The difference is not in the model weights or the tools available -- it is in the _instructions_ the agent receives before it ever sees a user message.

This chapter introduces two complementary mechanisms for shaping agent behavior:

1. **System prompts** -- the foundational instructions that define the agent's personality, rules, and response format. Think of this as the agent's "job description."
2. **Skills** -- modular Markdown files that inject domain-specific knowledge and behavioral rules. Think of these as "training manuals" that the agent can reference.

Together, they form a layered architecture: the system prompt sets the baseline identity, and skills add specialized capabilities on top. This is analogous to how a new employee might receive a company handbook (system prompt) plus role-specific training materials (skills).

## What You'll Learn

- How `systemPromptOverride` injects a custom system prompt
- How `loadSkillsFromDir()` discovers `.md` files as skills
- How `skillsOverride` injects skills into the resource loader
- Skill frontmatter format (`name`, `description`, `disable-model-invocation`)
- Best practices for writing effective system prompts
- How skill composition works and why it matters

## The Role of System Prompts

A system prompt is the first message in any LLM conversation. It is sent before any user messages and establishes the "rules of engagement" for the entire session. The model treats it as high-priority instructions that should govern all subsequent responses.

### What Makes a Good System Prompt?

Effective system prompts share several characteristics:

**Identity and role**: Tell the agent who it is. "You are WeatherBot, a friendly weather assistant" is better than "You are an AI." A clear identity helps the model maintain consistent behavior.

**Behavioral rules**: Define what the agent should and should not do. "Always greet the user warmly" and "Never provide medical advice" are behavioral rules.

**Response format**: If you want structured responses, say so. "Always respond with bullet points" or "Structure weather reports with Temperature, Humidity, and Forecast sections."

**Tool usage guidance**: Tell the agent when to use its tools. "When asked about weather, use the get_weather tool first" prevents the model from hallucinating weather data.

:::tip
**The specificity principle**: vague instructions produce vague behavior. Instead of "Be helpful," try "When the user asks a question you can answer from your training data, answer directly. When the user asks about current weather, always use the get_weather tool rather than guessing." The more specific your instructions, the more predictable your agent.
:::

:::warning
System prompts are not security boundaries. A determined user can often coax the model into ignoring system prompt instructions through clever prompting. Do not put security-critical logic in the system prompt alone -- enforce it in code (like the confirmation pattern from Chapter 05).
:::

## Understanding Skills

### What Are Skills?

Skills are Markdown files that extend the agent's knowledge and behavior. If the system prompt is the agent's "job description," skills are its "reference library" -- each skill is a self-contained document that teaches the agent about a specific domain or task.

Skills serve a different purpose than system prompts:

| Aspect         | System Prompt                         | Skills                                   |
| -------------- | ------------------------------------- | ---------------------------------------- |
| **Scope**      | Global -- applies to all interactions | Domain-specific -- applies when relevant |
| **Format**     | Plain text string                     | Markdown with YAML frontmatter           |
| **Source**     | Hardcoded in your application         | Loaded dynamically from the filesystem   |
| **Quantity**   | One per session                       | Many can be loaded simultaneously        |
| **Mutability** | Fixed at session creation             | Can be changed between sessions          |

### Skills as a Plugin System

If you have worked with plugin architectures in web frameworks (Gatsby plugins, Webpack loaders, VSCode extensions), the skill system will feel familiar. Each skill is a self-contained unit that:

1. **Declares itself** via frontmatter (name, description)
2. **Provides content** as Markdown that gets injected into the agent's context
3. **Can be discovered** automatically from a directory structure
4. **Can be composed** -- multiple skills work together without conflicts

This design means you can build a library of reusable skills and mix-and-match them for different agent configurations. A "code reviewer" agent might load skills for TypeScript best practices, security auditing, and performance optimization. A "customer support" agent might load skills for product knowledge, refund policies, and escalation procedures.

## Skill File Format

Skills are Markdown files with YAML frontmatter:

```markdown
---
name: weather-expert
description: Provides weather forecasting expertise
---

When discussing weather, always structure your response as a brief weather report:

1. **Current conditions**: Temperature and sky condition
2. **Humidity**: Current humidity level
3. **Forecast**: Brief outlook for the next 24 hours
4. **Advisory**: Any relevant weather advisories or tips

Keep the tone professional but friendly, like a TV weather presenter.
```

### Frontmatter Fields

| Field                      | Required | Description                                                        |
| -------------------------- | -------- | ------------------------------------------------------------------ |
| `name`                     | Yes      | Unique identifier for the skill (kebab-case recommended)           |
| `description`              | Yes      | Short summary shown when listing skills                            |
| `disable-model-invocation` | No       | If `true`, prevents the model from dynamically invoking this skill |

### What's Happening Under the Hood

When skills are loaded, the pi-coding-agent framework:

1. **Discovers** Markdown files using the directory scan rules
2. **Parses** the YAML frontmatter to extract metadata
3. **Injects** the skill content into the agent's context window alongside the system prompt
4. **Labels** each skill so the model knows which domain knowledge is available

The skill content becomes part of the "system context" that the LLM sees. This means the model can reference skill instructions when formulating responses, just as it references the system prompt. The key difference is that skills are additive -- each skill extends the agent's knowledge without replacing anything.

### Discovery Rules

The `loadSkillsFromDir()` function looks for skills in two places:

- **Direct `.md` files** in the skills directory root (e.g., `skills/weather-expert.md`)
- **`SKILL.md` files** in subdirectories, searched recursively (e.g., `skills/weather/SKILL.md`)

The subdirectory pattern is useful for complex skills that include additional assets:

```
skills/
├── weather-expert.md              # Simple skill: single file
├── code-reviewer/                 # Complex skill: directory
│   ├── SKILL.md                   # Skill definition
│   ├── examples/                  # Supporting files
│   └── templates/
```

:::tip
Use the single-file format for simple behavioral rules (like response formatting) and the directory format for skills that need supporting materials or when you want to keep the skill organized with related assets.
:::

## Loading Skills

```typescript
import { loadSkillsFromDir } from "@mariozechner/pi-coding-agent";

const SKILLS_DIR = path.join(import.meta.dirname, "skills");
const { skills, diagnostics } = loadSkillsFromDir({
  dir: SKILLS_DIR,
  source: "tutorial",
});

console.log(`Loaded ${skills.length} skill(s):`);
skills.forEach((s) => console.log(`  - ${s.name}: ${s.description}`));
```

The `diagnostics` array contains any warnings or errors from skill parsing -- for example, a skill file with invalid frontmatter. Always check diagnostics in development to catch problems early.

The `source` parameter is a label that helps you track where skills came from when debugging. Use something descriptive like `'user-skills'`, `'bundled'`, or `'tutorial'`.

## Injecting Skills Into Resource Loader

```typescript
const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () =>
    [
      "You are WeatherBot, a friendly weather assistant.",
      "Always greet the user warmly.",
      "When asked about weather, use the get_weather tool first.",
    ].join("\n"),
  noExtensions: true,
  noPromptTemplates: true,
  noThemes: true,
  // Enable skills
  noSkills: skills.length === 0,
  ...(skills.length > 0 && {
    skillsOverride: () => ({ skills, diagnostics: [] }),
  }),
});
await resourceLoader.reload();
```

Let's break down the key configuration points:

**`systemPromptOverride`** takes a function (not a string) that returns a string. This is a function so it can be re-evaluated -- useful if your system prompt includes dynamic content like the current date or user preferences.

**`noSkills: skills.length === 0`** is a conditional toggle. If no skills were loaded from the directory, we disable the skill system entirely to avoid unnecessary processing. If skills were found, we set `noSkills` to `false` (implicitly, via the falsy evaluation) to enable skill loading.

**`skillsOverride`** is a function that returns the loaded skills and diagnostics. The spread operator `...(skills.length > 0 && { ... })` ensures we only set this option when skills exist.

**`await resourceLoader.reload()`** is essential -- the resource loader does not process its configuration until `reload()` is called. Forgetting this is a common source of "my system prompt isn't working" bugs.

:::warning
Always call `resourceLoader.reload()` after creating a `DefaultResourceLoader` and before passing it to `createAgentSession()`. Without this call, neither your system prompt nor your skills will be active.
:::

## Writing Effective Skills

Here are guidelines for writing skills that produce reliable, high-quality agent behavior:

### Be Explicit About Response Structure

Bad:

```markdown
Help users with weather questions.
```

Good:

```markdown
When discussing weather, structure your response as:

1. **Current conditions**: Temperature and sky condition
2. **Humidity**: Current humidity percentage
3. **Forecast**: Outlook for the next 24 hours
```

### Use Examples

Models learn well from examples. Include one or two sample interactions:

```markdown
Example response for a weather query:

> **Current conditions**: 22C, sunny with light breeze
> **Humidity**: 45% (comfortable)
> **Forecast**: Clear skies continuing through tomorrow, slight cooling trend
> **Advisory**: Great day for outdoor activities. UV index is moderate -- sunscreen recommended.
```

### Define Boundaries

Tell the skill what the agent should NOT do:

```markdown
Do NOT:

- Predict weather more than 3 days out (accuracy drops significantly)
- Provide severe weather warnings without data from the get_weather tool
- Guess temperatures -- always use the tool first
```

### Skill Composition

When multiple skills are loaded, their contents are all injected into the context. This means skills can complement each other:

- **Weather Expert** skill defines how to format weather responses
- **Friendly Assistant** skill defines the overall tone and greeting behavior
- **Safety Guidelines** skill defines what topics to avoid

The model synthesizes instructions from all loaded skills simultaneously. This is powerful but requires care -- conflicting instructions across skills can confuse the model.

:::tip
When designing a skill library, think in layers: **base skills** (tone, formatting, safety) that apply broadly, and **domain skills** (weather, coding, customer support) that apply to specific tasks. Avoid putting overlapping instructions in multiple skills.
:::

## Full Code

```typescript
import * as path from "node:path";
import { Type } from "@sinclair/typebox";
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
  loadSkillsFromDir,
  type ToolDefinition,
} from "@mariozechner/pi-coding-agent";
import { createModel } from "../../shared/model";

const model = createModel();

// Load skills from the skills/ directory
const SKILLS_DIR = path.join(import.meta.dirname, "skills");
const { skills, diagnostics } = loadSkillsFromDir({
  dir: SKILLS_DIR,
  source: "tutorial",
});

console.log(`📚 Loaded ${skills.length} skill(s):`);
skills.forEach((s) => console.log(`   - ${s.name}: ${s.description}`));

// Weather tool (same as ch03 but inline)
const weatherTool: ToolDefinition = {
  name: "get_weather",
  label: "Get Weather",
  description: "Get current weather for a city.",
  parameters: Type.Object({
    city: Type.String({ description: "City name" }),
  }),
  execute: async (_toolCallId, params) => {
    const { city } = params as { city: string };
    const data: Record<string, object> = {
      tokyo: {
        temp: "22°C",
        condition: "Sunny",
        humidity: "45%",
        forecast: "Clear skies",
      },
      london: {
        temp: "14°C",
        condition: "Overcast",
        humidity: "82%",
        forecast: "Rain expected",
      },
    };
    const weather = data[city.toLowerCase()] || {
      temp: "20°C",
      condition: "Clear",
      humidity: "50%",
    };
    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ city, ...weather }) },
      ],
      details: {},
    };
  },
};

// Resource loader with system prompt + skills
const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () =>
    [
      "You are WeatherBot, a friendly weather assistant.",
      "Always greet the user warmly.",
      "When asked about weather, use the get_weather tool first.",
    ].join("\n"),
  noExtensions: true,
  noPromptTemplates: true,
  noThemes: true,
  noSkills: skills.length === 0,
  ...(skills.length > 0 && {
    skillsOverride: () => ({ skills, diagnostics: [] }),
  }),
});
await resourceLoader.reload();

const { session } = await createAgentSession({
  model,
  tools: [],
  customTools: [weatherTool],
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
});

// Stream output with tool events
session.subscribe((event) => {
  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "text_delta"
  ) {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
  if (event.type === "tool_execution_start") {
    console.log(`\n🔧 ${event.toolName}(${JSON.stringify(event.args)})`);
  }
  if (event.type === "tool_execution_end") {
    console.log(`✅ Done\n`);
  }
});

const question = process.argv[2] || "What's the weather like in London today?";
console.log(`You: ${question}\n`);
process.stdout.write("Agent: ");

await session.prompt(question);

console.log();
process.exit(0);
```

## Run

```bash
bun run ch06

# Or with a custom question:
bun run ch06 "How's the weather in Tokyo?"
```

## Expected Behavior

The agent responds as "WeatherBot" -- notice the personality and response structure:

1. **Identity**: It greets the user warmly (from the system prompt)
2. **Tool usage**: It calls `get_weather` before responding (from the system prompt's tool guidance)
3. **Response format**: It structures the response with Temperature, Humidity, Forecast, and Advisory sections (from the weather-expert skill)

Without the skill, the agent would call the tool and give you a plain-text answer. With the skill, it formats the response like a professional weather report. This is the power of skill composition -- the system prompt defines _who_ the agent is, and the skill defines _how_ it presents domain-specific information.

## Common Mistakes and Gotchas

**Forgetting `resourceLoader.reload()`**: The most common source of "my prompt isn't working." The DefaultResourceLoader is lazy -- it does not process configuration until `reload()` is called.

**Conflicting instructions**: If your system prompt says "Be extremely brief" but a skill says "Always provide detailed explanations," the model will be confused. Review your system prompt and skills as a unified set of instructions.

**Overly long skills**: Skills consume context window tokens. A 5,000-word skill leaves less room for conversation history. Keep skills focused and concise -- if a skill is longer than a page, consider splitting it into multiple skills.

**Not testing skill discovery**: Use the `diagnostics` return value from `loadSkillsFromDir()` to check for parsing errors. A skill with malformed frontmatter will silently fail to load.

## Key Takeaways

1. **System prompts define identity**: They set the agent's personality, rules, and tool usage guidance. Think of them as the agent's job description.

2. **Skills add domain knowledge**: They are modular Markdown files that inject specialized instructions. Think of them as training manuals.

3. **The two work together**: System prompt for who the agent _is_, skills for what the agent _knows_. This separation keeps your configuration modular and maintainable.

4. **Skills are a plugin system**: You can build a library of reusable skills and compose them for different agent configurations, just like selecting plugins for a web framework.

5. **Be specific**: Vague instructions produce vague behavior. The more explicit and structured your prompts and skills, the more reliable your agent.

## Next

[Chapter 07: Multi-Session](/guide/07-multi-session) -- manage multiple conversation sessions.
