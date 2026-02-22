# Shell 别名

## 问题

Pi 以非交互模式运行 bash（`bash -c`），默认不会展开别名。这意味着你在 `~/.zshrc` 或 `~/.bashrc` 中定义的别名在 Pi 的 shell 命令中不可用。

## 解决方案

在 `~/.pi/agent/settings.json` 中添加 `shellCommandPrefix` 配置：

```json
{
  "shellCommandPrefix": "shopt -s expand_aliases\neval \"$(grep '^alias ' ~/.zshrc)\""
}
```

请根据你使用的 shell 调整路径（`~/.zshrc`、`~/.bashrc` 等）。
