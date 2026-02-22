# Settings

Pi uses JSON settings files with project settings overriding global settings.

| Location | Scope |
|----------|-------|
| `~/.pi/agent/settings.json` | Global (all projects) |
| `.pi/settings.json` | Project (current directory) |

Edit directly or use `/settings` for common options.

## All Settings

### Model & Thinking

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `defaultProvider` | string | - | Default provider (e.g., `"anthropic"`, `"openai"`) |
| `defaultModel` | string | - | Default model ID |
| `defaultThinkingLevel` | string | - | `"off"`, `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"` |
| `hideThinkingBlock` | boolean | `false` | Hide thinking blocks in output |
| `thinkingBudgets` | object | - | Custom token budgets per thinking level |

#### thinkingBudgets

```json
{
  "thinkingBudgets": {
    "minimal": 1024,
    "low": 4096,
    "medium": 10240,
    "high": 32768
  }
}
```

### UI & Display

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `theme` | string | `"dark"` | Theme name |
| `quietStartup` | boolean | `false` | Hide startup header |
| `collapseChangelog` | boolean | `false` | Condensed changelog after updates |
| `doubleEscapeAction` | string | `"tree"` | Double-escape: `"tree"`, `"fork"`, or `"none"` |
| `editorPaddingX` | number | `0` | Horizontal padding (0-3) |
| `autocompleteMaxVisible` | number | `5` | Max autocomplete items (3-20) |
| `showHardwareCursor` | boolean | `false` | Show terminal cursor |

### Compaction

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `compaction.enabled` | boolean | `true` | Enable auto-compaction |
| `compaction.reserveTokens` | number | `16384` | Tokens reserved for response |
| `compaction.keepRecentTokens` | number | `20000` | Recent tokens to keep |

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

### Branch Summary

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `branchSummary.reserveTokens` | number | `16384` | Tokens reserved for branch summarization |

### Retry

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `retry.enabled` | boolean | `true` | Enable automatic retry |
| `retry.maxRetries` | number | `3` | Max retry attempts |
| `retry.baseDelayMs` | number | `2000` | Base delay for exponential backoff |
| `retry.maxDelayMs` | number | `60000` | Max server-requested delay before failing |

```json
{
  "retry": {
    "enabled": true,
    "maxRetries": 3,
    "baseDelayMs": 2000,
    "maxDelayMs": 60000
  }
}
```

### Message Delivery

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `steeringMode` | string | `"one-at-a-time"` | How steering messages are sent |
| `followUpMode` | string | `"one-at-a-time"` | How follow-up messages are sent |
| `transport` | string | `"sse"` | Preferred transport: `"sse"`, `"websocket"`, or `"auto"` |

### Terminal & Images

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `terminal.showImages` | boolean | `true` | Show images in terminal |
| `terminal.clearOnShrink` | boolean | `false` | Clear empty rows on shrink |
| `images.autoResize` | boolean | `true` | Resize images to 2000x2000 max |
| `images.blockImages` | boolean | `false` | Block all images to LLM |

### Shell

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `shellPath` | string | - | Custom shell path |
| `shellCommandPrefix` | string | - | Prefix for every bash command |

### Model Cycling

```json
{
  "enabledModels": ["claude-*", "gpt-4o", "gemini-2*"]
}
```

### Resources

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `packages` | array | `[]` | npm/git packages to load |
| `extensions` | string[] | `[]` | Extension paths |
| `skills` | string[] | `[]` | Skill paths |
| `prompts` | string[] | `[]` | Prompt template paths |
| `themes` | string[] | `[]` | Theme paths |
| `enableSkillCommands` | boolean | `true` | Register skills as commands |

### Example

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "defaultThinkingLevel": "medium",
  "theme": "dark",
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  },
  "retry": {
    "enabled": true,
    "maxRetries": 3
  },
  "enabledModels": ["claude-*", "gpt-4o"],
  "packages": ["pi-skills"]
}
```

### Project Overrides

Project settings override global. Nested objects are merged:

```json
// ~/.pi/agent/settings.json (global)
{ "theme": "dark", "compaction": { "enabled": true, "reserveTokens": 16384 } }

// .pi/settings.json (project)
{ "compaction": { "reserveTokens": 8192 } }

// Result
{ "theme": "dark", "compaction": { "enabled": true, "reserveTokens": 8192 } }
```
