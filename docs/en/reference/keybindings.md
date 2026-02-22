# Keybindings

Pi supports fully customizable keybindings. Configure them in your settings file under the `keybindings` key.

## Key Format

Keys are expressed as `modifier+key` strings. Multiple modifiers are joined with `+`:

| Modifier | Alias | Description |
|----------|-------|-------------|
| `ctrl` | `c` | Control key |
| `alt` | `a`, `meta`, `m` | Alt/Option/Meta key |
| `shift` | `s` | Shift key |

Examples: `ctrl+a`, `alt+d`, `ctrl+shift+k`, `alt+f`

Special key names: `enter`, `tab`, `escape`, `backspace`, `delete`, `up`, `down`, `left`, `right`, `home`, `end`, `pageup`, `pagedown`, `space`.

## All Actions

### Cursor Movement

| Action | Default | Description |
|--------|---------|-------------|
| `cursor.left` | `left` | Move cursor left one character |
| `cursor.right` | `right` | Move cursor right one character |
| `cursor.wordLeft` | `alt+left` | Move cursor left one word |
| `cursor.wordRight` | `alt+right` | Move cursor right one word |
| `cursor.home` | `home`, `ctrl+a` | Move cursor to start of line |
| `cursor.end` | `end`, `ctrl+e` | Move cursor to end of line |
| `cursor.up` | `up` | Move to previous line / previous history |
| `cursor.down` | `down` | Move to next line / next history |
| `cursor.pageUp` | `pageup` | Scroll up one page |
| `cursor.pageDown` | `pagedown` | Scroll down one page |
| `cursor.top` | `ctrl+home` | Scroll to top of output |
| `cursor.bottom` | `ctrl+end` | Scroll to bottom of output |

### Deletion

| Action | Default | Description |
|--------|---------|-------------|
| `delete.charLeft` | `backspace` | Delete character before cursor |
| `delete.charRight` | `delete` | Delete character after cursor |
| `delete.wordLeft` | `alt+backspace` | Delete word before cursor |
| `delete.wordRight` | `alt+d` | Delete word after cursor |
| `delete.toLineStart` | `ctrl+u` | Delete from cursor to start of line |
| `delete.toLineEnd` | `ctrl+k` | Delete from cursor to end of line |

### Text Input

| Action | Default | Description |
|--------|---------|-------------|
| `input.submit` | `enter` | Submit the current message |
| `input.newline` | `shift+enter` | Insert a newline |
| `input.tab` | `tab` | Insert or trigger autocomplete |

### Kill Ring

| Action | Default | Description |
|--------|---------|-------------|
| `killRing.yank` | `ctrl+y` | Paste from kill ring |
| `killRing.yankPop` | `alt+y` | Cycle through kill ring entries |
| `killRing.yankShift` | `alt+shift+y` | Cycle kill ring in reverse |

### Clipboard

| Action | Default | Description |
|--------|---------|-------------|
| `clipboard.copy` | `ctrl+c` | Copy selection (or interrupt if no selection) |
| `clipboard.paste` | `ctrl+v` | Paste from system clipboard |

### Application

| Action | Default | Description |
|--------|---------|-------------|
| `app.interrupt` | `ctrl+c` | Interrupt current generation |
| `app.quit` | `ctrl+d` | Quit the application |
| `app.escape` | `escape` | Cancel / close picker / escape context |
| `app.doubleEscape` | `escape,escape` | Trigger double-escape action (see settings) |
| `app.toggleHelp` | `ctrl+?` | Toggle help overlay |

### Session

| Action | Default | Description |
|--------|---------|-------------|
| `session.new` | `ctrl+n` | Start a new session |
| `session.picker` | `ctrl+t` | Open session picker |
| `session.fork` | `ctrl+shift+f` | Fork the current session |
| `session.undo` | `ctrl+z` | Undo last message |

### Models & Thinking

| Action | Default | Description |
|--------|---------|-------------|
| `model.cycle` | `ctrl+m` | Cycle through enabled models |
| `thinking.cycle` | `ctrl+shift+t` | Cycle through thinking levels |
| `thinking.toggle` | `ctrl+shift+e` | Toggle thinking on/off |

### Display

| Action | Default | Description |
|--------|---------|-------------|
| `display.toggleMarkdown` | `ctrl+shift+m` | Toggle rendered markdown |
| `display.toggleThinking` | `ctrl+shift+h` | Toggle thinking block visibility |

### Message Queue

| Action | Default | Description |
|--------|---------|-------------|
| `queue.clear` | `ctrl+shift+x` | Clear the message queue |
| `queue.toggle` | `ctrl+shift+q` | Pause/resume message queue |

### Selection

| Action | Default | Description |
|--------|---------|-------------|
| `selection.left` | `shift+left` | Extend selection left one character |
| `selection.right` | `shift+right` | Extend selection right one character |
| `selection.wordLeft` | `alt+shift+left` | Extend selection left one word |
| `selection.wordRight` | `alt+shift+right` | Extend selection right one word |
| `selection.home` | `shift+home` | Extend selection to start of line |
| `selection.end` | `shift+end` | Extend selection to end of line |

### Session Picker

These bindings are active when the session picker is open:

| Action | Default | Description |
|--------|---------|-------------|
| `picker.up` | `up` | Move selection up |
| `picker.down` | `down` | Move selection down |
| `picker.select` | `enter` | Open selected session |
| `picker.delete` | `ctrl+backspace` | Delete selected session |
| `picker.close` | `escape` | Close the picker |
| `picker.filter` | (any character) | Type to filter sessions |

## Custom Configuration

Add a `keybindings` object to your settings file. Each key is an action name and each value is a key string or array of key strings:

```json
{
  "keybindings": {
    "input.submit": "ctrl+enter",
    "input.newline": "enter",
    "cursor.home": ["home", "ctrl+a"],
    "cursor.end": ["end", "ctrl+e"],
    "app.quit": "ctrl+q",
    "session.new": "ctrl+shift+n"
  }
}
```

## Emacs Keybindings

An Emacs-inspired configuration:

```json
{
  "keybindings": {
    "cursor.left": "ctrl+b",
    "cursor.right": "ctrl+f",
    "cursor.wordLeft": "alt+b",
    "cursor.wordRight": "alt+f",
    "cursor.home": "ctrl+a",
    "cursor.end": "ctrl+e",
    "cursor.up": "ctrl+p",
    "cursor.down": "ctrl+n",
    "delete.charLeft": "backspace",
    "delete.charRight": "ctrl+d",
    "delete.wordLeft": "alt+backspace",
    "delete.wordRight": "alt+d",
    "delete.toLineStart": "ctrl+u",
    "delete.toLineEnd": "ctrl+k",
    "killRing.yank": "ctrl+y",
    "killRing.yankPop": "alt+y"
  }
}
```

## Vim Keybindings

A Vim-inspired configuration (for insert-mode-like behavior):

```json
{
  "keybindings": {
    "cursor.left": "left",
    "cursor.right": "right",
    "cursor.wordLeft": "ctrl+left",
    "cursor.wordRight": "ctrl+right",
    "cursor.home": "home",
    "cursor.end": "end",
    "cursor.up": "up",
    "cursor.down": "down",
    "delete.charLeft": "backspace",
    "delete.charRight": "delete",
    "delete.wordLeft": "ctrl+w",
    "delete.toLineEnd": "ctrl+k",
    "delete.toLineStart": "ctrl+u",
    "app.escape": "escape",
    "input.submit": "enter"
  }
}
```

:::tip
Custom keybindings completely replace the default for that action. If you want multiple keys for one action, use an array.
:::
