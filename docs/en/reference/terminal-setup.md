# Terminal Setup

Pi uses the Kitty keyboard protocol for reliable modifier key detection.

## Kitty, iTerm2

Work out of the box.

## Ghostty

Add to `~/.config/ghostty/config`:

```
keybind = alt+backspace=text:\x1b\x7f
keybind = shift+enter=text:\n
```

## WezTerm

Create `~/.wezterm.lua`:

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.enable_kitty_keyboard = true
return config
```

## VS Code (Integrated Terminal)

Add to `keybindings.json`:

```json
{
  "key": "shift+enter",
  "command": "workbench.action.terminal.sendSequence",
  "args": { "text": "\u001b[13;2u" },
  "when": "terminalFocus"
}
```

Locations:

- macOS: `~/Library/Application Support/Code/User/keybindings.json`
- Linux: `~/.config/Code/User/keybindings.json`
- Windows: `%APPDATA%\\Code\\User\\keybindings.json`

## Windows Terminal

Add to `settings.json` (Ctrl+Shift+,):

```json
{
  "actions": [
    {
      "command": { "action": "sendInput", "input": "\u001b[13;2u" },
      "keys": "shift+enter"
    }
  ]
}
```

## IntelliJ IDEA

The built-in terminal has limited escape sequence support. Consider using a dedicated terminal emulator.

Set `PI_HARDWARE_CURSOR=1` for hardware cursor visibility.
