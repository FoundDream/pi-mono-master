# TUI Components

Pi's terminal user interface is built on a component-based rendering system. Extensions and tools can create custom UI elements that render directly in the terminal.

## Component Interface

Every TUI component implements the following interface:

```typescript
interface Component {
  render(rc: RenderContext): ReactNode;
  handleInput?(input: KeyInput): boolean;
  invalidate?(): void;
}
```

- **`render(rc)`** - Returns the visual output for the current frame. Called whenever the component needs to redraw.
- **`handleInput(input)`** - Processes keyboard input. Return `true` if the input was consumed, `false` to propagate it to parent components.
- **`invalidate()`** - Signals that the component's state has changed and it should re-render on the next frame.

### Line Width

All components receive the available terminal width through the render context. Components must respect this width and handle text wrapping or truncation accordingly. Overflowing content will be clipped.

### IME Support

Components that accept text input should implement the `Focusable` interface:

```typescript
interface Focusable {
  isFocused(): boolean;
  onFocus(): void;
  onBlur(): void;
  getCursorPosition(): { x: number; y: number } | null;
}
```

This enables proper input method editor (IME) support for CJK and other complex input methods. The cursor position is used to place the IME composition window.

## Built-in Components

### Text

Renders styled text with optional formatting.

```typescript
Text({ content: "Hello", bold: true, color: "green" });
```

### Box

A rectangular container with optional borders, padding, and background color.

```typescript
Box({ border: true, padding: 1, children: [...] })
```

### Container

A layout component that arranges children vertically or horizontally.

```typescript
Container({ direction: "horizontal", gap: 1, children: [...] })
```

### Spacer

Inserts empty space. Useful for layout alignment.

```typescript
Spacer({ height: 1 });
```

### Markdown

Renders Markdown content with syntax highlighting for code blocks, bold, italic, links, and lists.

```typescript
Markdown({ content: "# Title\n\nBody text with **bold**." });
```

### Image

Displays an image in the terminal using Kitty or iTerm2 image protocols.

```typescript
Image({ src: "/path/to/image.png", width: 40 });
```

Falls back to a placeholder on unsupported terminals.

### SelectList

An interactive list with keyboard navigation and selection.

```typescript
SelectList({
  items: [
    { label: "Option A", value: "a" },
    { label: "Option B", value: "b" },
  ],
  onSelect: (item) => {
    /* handle selection */
  },
});
```

### SettingsList

A specialized list for displaying and editing configuration key-value pairs.

```typescript
SettingsList({
  settings: [
    { key: "model", value: "opus", editable: true },
    { key: "theme", value: "dark", editable: true },
  ],
  onChange: (key, value) => {
    /* handle change */
  },
});
```

### BorderedLoader

A loading indicator with a bordered frame and optional message.

```typescript
BorderedLoader({ message: "Processing..." });
```

## Usage in Extensions

Extensions access the TUI through the context object:

```typescript
export default (ctx: ExtensionContext) => {
  ctx.ui.custom({
    render(rc) {
      return Box({
        border: true,
        children: [Text({ content: "Extension UI" })],
      });
    },
    handleInput(input) {
      if (matchesKey(input, Key.Escape)) {
        ctx.ui.close();
        return true;
      }
      return false;
    },
  });
};
```

## Usage in Tools

Tools access the TUI through the `pi` object:

```typescript
pi.ui.custom({
  render(rc) {
    return Container({
      children: [
        Text({ content: "Tool output", bold: true }),
        Spacer({ height: 1 }),
        Text({ content: "Details here" }),
      ],
    });
  },
});
```

## Overlay Components

Overlays render above the main content as floating panels.

### Sizing

```typescript
overlay({
  width: 60, // Fixed column width
  height: 20, // Fixed row height
  maxWidth: "80%", // Percentage of terminal width
  maxHeight: "50%", // Percentage of terminal height
});
```

### Positioning

```typescript
overlay({
  position: "center", // Center of screen
  position: "top", // Top edge, horizontally centered
  position: "bottom", // Bottom edge, horizontally centered
  anchor: { x: 10, y: 5 }, // Absolute position
});
```

### Responsive

Overlays automatically reflow when the terminal is resized. Use percentage-based sizing for layouts that should adapt to different terminal dimensions.

## Keyboard Handling

Use `matchesKey` for reliable cross-terminal key detection:

```typescript
import { matchesKey, Key } from "@anthropic-ai/pi/tui"

handleInput(input: KeyInput): boolean {
  if (matchesKey(input, Key.Enter)) {
    // Handle enter
    return true
  }
  if (matchesKey(input, Key.Escape)) {
    // Handle escape
    return true
  }
  if (matchesKey(input, Key.Tab)) {
    // Handle tab
    return true
  }
  if (matchesKey(input, Key.Up)) {
    // Navigate up
    return true
  }
  if (matchesKey(input, Key.Down)) {
    // Navigate down
    return true
  }
  return false
}
```

Available `Key.*` constants include: `Enter`, `Escape`, `Tab`, `Backspace`, `Delete`, `Up`, `Down`, `Left`, `Right`, `Home`, `End`, `PageUp`, `PageDown`, and modifier combinations like `Key.Ctrl_C`, `Key.Ctrl_D`.

## Performance and Theming

### Caching

Components should avoid expensive computations in `render()`. Pre-compute values and cache them as component state. The render function may be called multiple times per second.

### Invalidation

Call `invalidate()` when internal state changes to schedule a re-render. Do not call `render()` directly. The framework batches invalidation signals and renders at the optimal frame rate.

```typescript
class Counter implements Component {
  private count = 0;

  increment() {
    this.count++;
    this.invalidate?.();
  }

  render(rc: RenderContext) {
    return Text({ content: `Count: ${this.count}` });
  }
}
```

### Theming

Access theme colors through the render context callback rather than hardcoding ANSI codes:

```typescript
render(rc: RenderContext) {
  const { primary, secondary, border, text } = rc.theme
  return Box({
    borderColor: border,
    children: [
      Text({ content: "Title", color: primary }),
      Text({ content: "Body", color: text })
    ]
  })
}
```

This ensures components adapt to the user's selected theme.

## Common Patterns

### SelectList with filtering

```typescript
const filteredItems = items.filter((i) =>
  i.label.toLowerCase().includes(query.toLowerCase()),
);
SelectList({ items: filteredItems, onSelect: handleSelect });
```

### Async data loading

```typescript
class AsyncLoader implements Component {
  private data: string | null = null;
  private error: string | null = null;

  constructor() {
    this.loadData();
  }

  async loadData() {
    try {
      this.data = await fetchData();
    } catch (e) {
      this.error = e.message;
    }
    this.invalidate?.();
  }

  render(rc) {
    if (this.error) return Text({ content: this.error, color: "red" });
    if (!this.data) return BorderedLoader({ message: "Loading..." });
    return Text({ content: this.data });
  }
}
```

### Settings editor

```typescript
SettingsList({
  settings: Object.entries(config).map(([key, value]) => ({
    key,
    value: String(value),
    editable: true,
  })),
  onChange(key, newValue) {
    updateConfig(key, newValue);
  },
});
```

### Status indicator

```typescript
Container({
  direction: "horizontal",
  gap: 1,
  children: [
    Text({
      content: isConnected ? "+" : "x",
      color: isConnected ? "green" : "red",
    }),
    Text({ content: isConnected ? "Connected" : "Disconnected" }),
  ],
});
```

### Custom editor with keyboard handling

```typescript
class TextEditor implements Component, Focusable {
  private buffer = "";
  private cursor = 0;

  handleInput(input: KeyInput): boolean {
    if (matchesKey(input, Key.Backspace)) {
      this.buffer =
        this.buffer.slice(0, this.cursor - 1) + this.buffer.slice(this.cursor);
      this.cursor = Math.max(0, this.cursor - 1);
      this.invalidate?.();
      return true;
    }
    if (input.char) {
      this.buffer =
        this.buffer.slice(0, this.cursor) +
        input.char +
        this.buffer.slice(this.cursor);
      this.cursor++;
      this.invalidate?.();
      return true;
    }
    return false;
  }

  render(rc) {
    return Box({
      border: true,
      children: [Text({ content: this.buffer || "Type here..." })],
    });
  }

  isFocused() {
    return true;
  }
  onFocus() {}
  onBlur() {}
  getCursorPosition() {
    return { x: this.cursor, y: 0 };
  }
}
```

## Critical Rules

1. **Always respect terminal width.** Never render content wider than `rc.width`. Overflowing text causes visual corruption.

2. **Return `true` from `handleInput` only when you consume the event.** Returning `true` for unhandled keys prevents parent components and the framework from processing them.

3. **Never call `render()` directly.** Always use `invalidate()` to signal state changes. The framework controls when rendering happens.

4. **Keep `render()` pure and fast.** No side effects, no async operations, no heavy computation. Pre-compute everything and store it as state.

5. **Dispose resources on unmount.** If your component creates timers, listeners, or streams, clean them up when the component is removed to prevent memory leaks.
