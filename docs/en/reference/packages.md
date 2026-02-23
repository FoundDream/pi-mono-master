# Packages

Pi packages bundle extensions, skills, prompt templates, and themes for distribution via npm or git.

## Installation

```bash
# npm packages
pi install npm:@foo/bar@1.0.0

# Git repositories
pi install git:github.com/user/repo@v1

# Raw URLs
pi install https://github.com/user/repo

# Local paths
pi install /absolute/path/to/package
```

By default, installs go to global settings. Use `-l` for project-level (`.pi/settings.json`).

**Temporary testing:**

```bash
pi -e npm:@foo/bar
```

**Management:**

```bash
pi remove npm:@foo/bar
pi list
pi update
```

## Package Sources

### npm

Format: `npm:@scope/pkg@1.2.3`. Versioned specs prevent updates. Global installs use `-g`, project installs go to `.pi/npm/`.

### Git

Formats: `git:github.com/user/repo@v1`, HTTPS, SSH, `git://`. Cloned to `~/.pi/agent/git/<host>/<path>` (global) or `.pi/git/<host>/<path>` (project).

### Local Paths

Reference disk files directly. No copying.

## Creating Packages

```json
{
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

Paths support glob patterns and `!exclusions`. Include `pi-package` keyword for gallery visibility.

Gallery metadata:

- `video`: MP4
- `image`: PNG, JPEG, GIF, WebP

## Auto-Discovery

Without explicit manifest:

- `extensions/` → `.ts` and `.js` files
- `skills/` → `SKILL.md` folders and top-level `.md` files
- `prompts/` → `.md` files
- `themes/` → `.json` files

## Dependencies

Runtime deps in `dependencies`. Core peer deps with `"*"` range, not bundled.

## Filtering

```json
{
  "source": "npm:my-package",
  "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
  "skills": [],
  "prompts": ["prompts/review.md"],
  "themes": ["+themes/legacy.json"]
}
```

- Omit keys → load all
- `[]` → load nothing
- `!pattern` → exclude
- `+path` → force-include
- `-path` → force-exclude

## Scope & Deduplication

Project settings take precedence over global. Identity matching by package name (npm), repo URL (git), or absolute path (local).

:::warning
Pi packages run with full system access. Extensions execute arbitrary code, and skills can instruct the model to perform any action.
:::
