# Themes

Pi supports fully customizable color themes. Themes control every color in the terminal UI.

## Loading Locations

Themes are loaded from multiple locations, in order of precedence (later wins):

| Source | Location | Description |
|--------|----------|-------------|
| Built-in | Bundled with Pi | Default `dark` and `light` themes |
| Global | `~/.pi/agent/themes/` | User-wide custom themes |
| Project | `.pi/themes/` | Project-specific themes |
| Packages | `themes` field in package | Themes from installed packages |
| CLI | `--theme <path>` | Load a theme file from any path |

Set the active theme in settings:

```json
{
  "theme": "my-custom-theme"
}
```

## Theme Structure

A theme is a JSON file with a `name` and 51 required color tokens organized under `vars` and `colors`:

```json
{
  "name": "my-theme",
  "vars": {
    "primary": "#7c3aed",
    "secondary": "#a78bfa"
  },
  "colors": {
    "text": "#e4e4e7",
    "textMuted": "#a1a1aa",
    "border": "#3f3f46",
    "background": "#09090b",
    ...
  }
}
```

The `vars` object defines reusable color variables. The `colors` object maps color tokens to values.

## Color Token Categories

### Core UI (11 tokens)

| Token | Description |
|-------|-------------|
| `text` | Primary text color |
| `textMuted` | Secondary/dimmed text |
| `textInverse` | Text on inverted backgrounds |
| `border` | Default border color |
| `borderFocused` | Focused element border |
| `background` | Main background |
| `backgroundHover` | Hovered element background |
| `backgroundSelected` | Selected element background |
| `primary` | Primary accent color |
| `primaryHover` | Primary accent hover state |
| `error` | Error text and indicators |

### Backgrounds & Content (11 tokens)

| Token | Description |
|-------|-------------|
| `headerText` | Header text color |
| `headerBorder` | Header border color |
| `inputText` | Input field text |
| `inputPlaceholder` | Input placeholder text |
| `inputBorder` | Input field border |
| `inputBackground` | Input field background |
| `autocompleteText` | Autocomplete suggestion text |
| `autocompleteSelected` | Selected autocomplete item |
| `scrollbarThumb` | Scrollbar thumb color |
| `scrollbarTrack` | Scrollbar track color |
| `badge` | Badge/tag color |

### Markdown (10 tokens)

| Token | Description |
|-------|-------------|
| `markdownHeading` | Heading text |
| `markdownBold` | Bold text |
| `markdownItalic` | Italic text |
| `markdownCode` | Inline code |
| `markdownCodeBackground` | Code block background |
| `markdownLink` | Link text |
| `markdownLinkHover` | Link hover state |
| `markdownBlockquote` | Blockquote text |
| `markdownBlockquoteBorder` | Blockquote border |
| `markdownListMarker` | List bullet/number |

### Tool Diffs (3 tokens)

| Token | Description |
|-------|-------------|
| `diffAdded` | Added line background |
| `diffRemoved` | Removed line background |
| `diffContext` | Context line background |

### Syntax Highlighting (9 tokens)

| Token | Description |
|-------|-------------|
| `syntaxKeyword` | Keywords (`if`, `return`, `function`) |
| `syntaxString` | String literals |
| `syntaxNumber` | Number literals |
| `syntaxComment` | Comments |
| `syntaxFunction` | Function names |
| `syntaxVariable` | Variable names |
| `syntaxOperator` | Operators |
| `syntaxType` | Type names |
| `syntaxPunctuation` | Punctuation and brackets |

### Thinking Levels (6 tokens)

| Token | Description |
|-------|-------------|
| `thinkingOff` | Thinking off indicator |
| `thinkingMinimal` | Minimal thinking indicator |
| `thinkingLow` | Low thinking indicator |
| `thinkingMedium` | Medium thinking indicator |
| `thinkingHigh` | High thinking indicator |
| `thinkingXhigh` | Extra-high thinking indicator |

### Bash Mode (1 token)

| Token | Description |
|-------|-------------|
| `bashModeIndicator` | Bash mode active indicator |

## Color Formats

Color values support four formats:

| Format | Example | Description |
|--------|---------|-------------|
| Hex | `"#7c3aed"` | Standard hex color (3, 6, or 8 digits) |
| Xterm 256 | `"141"` | Xterm 256-color palette index (as string) |
| Variable reference | `"$primary"` | References a `vars` value |
| Empty string | `""` | Inherit / use terminal default |

Variable references allow you to define a color once in `vars` and reuse it across multiple tokens:

```json
{
  "vars": {
    "accent": "#7c3aed"
  },
  "colors": {
    "primary": "$accent",
    "markdownLink": "$accent",
    "borderFocused": "$accent"
  }
}
```

## Hot Reload

Theme files are watched for changes during a session. When you edit and save a theme file, the changes are applied immediately without restarting Pi. This makes it easy to iterate on colors in real time.

## Creating a Custom Theme

1. Create a theme file in your global themes directory:

```bash
mkdir -p ~/.pi/agent/themes
```

2. Start with the built-in dark theme as a base and save it as a new file:

```json
{
  "name": "my-theme",
  "vars": {
    "accent": "#f59e0b",
    "accentDim": "#b45309",
    "bg": "#1c1917",
    "bgLight": "#292524",
    "fg": "#e7e5e4",
    "fgDim": "#a8a29e",
    "border": "#44403c"
  },
  "colors": {
    "text": "$fg",
    "textMuted": "$fgDim",
    "textInverse": "$bg",
    "border": "$border",
    "borderFocused": "$accent",
    "background": "$bg",
    "backgroundHover": "$bgLight",
    "backgroundSelected": "$bgLight",
    "primary": "$accent",
    "primaryHover": "$accentDim",
    "error": "#ef4444",

    "headerText": "$fg",
    "headerBorder": "$border",
    "inputText": "$fg",
    "inputPlaceholder": "$fgDim",
    "inputBorder": "$border",
    "inputBackground": "$bgLight",
    "autocompleteText": "$fgDim",
    "autocompleteSelected": "$accent",
    "scrollbarThumb": "$border",
    "scrollbarTrack": "",
    "badge": "$accent",

    "markdownHeading": "$accent",
    "markdownBold": "$fg",
    "markdownItalic": "$fgDim",
    "markdownCode": "$accent",
    "markdownCodeBackground": "$bgLight",
    "markdownLink": "$accent",
    "markdownLinkHover": "$accentDim",
    "markdownBlockquote": "$fgDim",
    "markdownBlockquoteBorder": "$border",
    "markdownListMarker": "$accent",

    "diffAdded": "#22c55e",
    "diffRemoved": "#ef4444",
    "diffContext": "$bgLight",

    "syntaxKeyword": "#c084fc",
    "syntaxString": "#86efac",
    "syntaxNumber": "#fdba74",
    "syntaxComment": "$fgDim",
    "syntaxFunction": "#93c5fd",
    "syntaxVariable": "$fg",
    "syntaxOperator": "#fca5a5",
    "syntaxType": "#67e8f9",
    "syntaxPunctuation": "$fgDim",

    "thinkingOff": "$fgDim",
    "thinkingMinimal": "#94a3b8",
    "thinkingLow": "#60a5fa",
    "thinkingMedium": "#a78bfa",
    "thinkingHigh": "#f472b6",
    "thinkingXhigh": "#fb923c",

    "bashModeIndicator": "#f59e0b"
  }
}
```

3. Activate the theme in your settings:

```json
{
  "theme": "my-theme"
}
```

4. Adjust colors and save. Changes apply immediately via hot reload.

:::tip
Use `vars` to define your palette, then reference variables with `$name` in `colors`. This makes it easy to adjust a single accent color and have it propagate throughout the theme.
:::
