# 终端设置

Pi 使用 Kitty 键盘协议实现可靠的修饰键检测。

## Kitty、iTerm2

开箱即用，无需额外配置。

## Ghostty

在 `~/.config/ghostty/config` 中添加：

```
keybind = alt+backspace=text:\x1b\x7f
keybind = shift+enter=text:\n
```

## WezTerm

创建 `~/.wezterm.lua`：

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.enable_kitty_keyboard = true
return config
```

## VS Code 集成终端

在 `keybindings.json` 中添加：

```json
{
  "key": "shift+enter",
  "command": "workbench.action.terminal.sendSequence",
  "args": { "text": "\u001b[13;2u" },
  "when": "terminalFocus"
}
```

文件位置：

- macOS：`~/Library/Application Support/Code/User/keybindings.json`
- Linux：`~/.config/Code/User/keybindings.json`
- Windows：`%APPDATA%\\Code\\User\\keybindings.json`

## Windows Terminal

在 `settings.json` 中添加（快捷键 Ctrl+Shift+,）：

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

内置终端对转义序列的支持有限，建议使用独立的终端模拟器。

设置 `PI_HARDWARE_CURSOR=1` 可开启硬件光标可见性。
