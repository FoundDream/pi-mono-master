# 键绑定

所有键盘快捷键都可以通过 `~/.pi/agent/keybindings.json` 自定义。每个操作可以绑定到一个或多个按键。

## 按键格式

`modifier+key`，其中修饰符为 `ctrl`、`shift`、`alt`（可组合），按键包括：

- **字母：** `a-z`
- **特殊键：** `escape`、`esc`、`enter`、`return`、`tab`、`space`、`backspace`、`delete`、`insert`、`clear`、`home`、`end`、`pageUp`、`pageDown`、`up`、`down`、`left`、`right`
- **功能键：** `f1`-`f12`
- **符号：** `` ` ``、`-`、`=`、`[`、`]`、`\`、`;`、`'`、`,`、`.`、`/`、`!`、`@`、`#`、`$`、`%`、`^`、`&`、`*`、`(`、`)`、`_`、`+`、`|`、`~`、`{`、`}`、`:`、`<`、`>`、`?`

修饰符组合：`ctrl+shift+x`、`alt+ctrl+x`、`ctrl+shift+alt+x` 等。

## 全部操作

### 光标移动

| 操作              | 默认按键                           | 说明           |
| ----------------- | ---------------------------------- | -------------- |
| `cursorUp`        | `up`                               | 向上移动光标   |
| `cursorDown`      | `down`                             | 向下移动光标   |
| `cursorLeft`      | `left`、`ctrl+b`                   | 向左移动光标   |
| `cursorRight`     | `right`、`ctrl+f`                  | 向右移动光标   |
| `cursorWordLeft`  | `alt+left`、`ctrl+left`、`alt+b`   | 按词向左移动   |
| `cursorWordRight` | `alt+right`、`ctrl+right`、`alt+f` | 按词向右移动   |
| `cursorLineStart` | `home`、`ctrl+a`                   | 移到行首       |
| `cursorLineEnd`   | `end`、`ctrl+e`                    | 移到行尾       |
| `jumpForward`     | `ctrl+]`                           | 向前跳转到字符 |
| `jumpBackward`    | `ctrl+alt+]`                       | 向后跳转到字符 |
| `pageUp`          | `pageUp`                           | 向上翻页       |
| `pageDown`        | `pageDown`                         | 向下翻页       |

### 删除

| 操作                 | 默认按键                  | 说明         |
| -------------------- | ------------------------- | ------------ |
| `deleteCharBackward` | `backspace`               | 向后删除字符 |
| `deleteCharForward`  | `delete`、`ctrl+d`        | 向前删除字符 |
| `deleteWordBackward` | `ctrl+w`、`alt+backspace` | 向后删除单词 |
| `deleteWordForward`  | `alt+d`、`alt+delete`     | 向前删除单词 |
| `deleteToLineStart`  | `ctrl+u`                  | 删除到行首   |
| `deleteToLineEnd`    | `ctrl+k`                  | 删除到行尾   |

### 文本输入

| 操作      | 默认按键      | 说明           |
| --------- | ------------- | -------------- |
| `newLine` | `shift+enter` | 插入换行       |
| `submit`  | `enter`       | 提交输入       |
| `tab`     | `tab`         | Tab / 自动补全 |

### Kill Ring

| 操作      | 默认按键 | 说明                       |
| --------- | -------- | -------------------------- |
| `yank`    | `ctrl+y` | 粘贴最近删除的文本         |
| `yankPop` | `alt+y`  | 在 yank 后循环已删除的文本 |
| `undo`    | `ctrl+-` | 撤销上次编辑               |

### 剪贴板

| 操作         | 默认按键 | 说明             |
| ------------ | -------- | ---------------- |
| `copy`       | `ctrl+c` | 复制选中内容     |
| `pasteImage` | `ctrl+v` | 从剪贴板粘贴图片 |

### 应用

| 操作             | 默认按键 | 说明                                         |
| ---------------- | -------- | -------------------------------------------- |
| `interrupt`      | `escape` | 取消 / 中止                                  |
| `clear`          | `ctrl+c` | 清空编辑器                                   |
| `exit`           | `ctrl+d` | 退出（编辑器为空时）                         |
| `suspend`        | `ctrl+z` | 挂起到后台                                   |
| `externalEditor` | `ctrl+g` | 在外部编辑器中打开（`$VISUAL` 或 `$EDITOR`） |

### 会话

| 操作         | 默认按键 | 说明                            |
| ------------ | -------- | ------------------------------- |
| `newSession` | _（无）_ | 开始新会话（`/new`）            |
| `tree`       | _（无）_ | 打开会话树导航器（`/tree`）     |
| `fork`       | _（无）_ | 分支当前会话（`/fork`）         |
| `resume`     | _（无）_ | 打开会话恢复选择器（`/resume`） |

### 模型与思考

| 操作                 | 默认按键       | 说明             |
| -------------------- | -------------- | ---------------- |
| `selectModel`        | `ctrl+l`       | 打开模型选择器   |
| `cycleModelForward`  | `ctrl+p`       | 循环到下一个模型 |
| `cycleModelBackward` | `shift+ctrl+p` | 循环到上一个模型 |
| `cycleThinkingLevel` | `shift+tab`    | 循环思考级别     |

### 显示

| 操作             | 默认按键 | 说明              |
| ---------------- | -------- | ----------------- |
| `expandTools`    | `ctrl+o` | 折叠/展开工具输出 |
| `toggleThinking` | `ctrl+t` | 折叠/展开思考块   |

### 消息队列

| 操作       | 默认按键    | 说明                     |
| ---------- | ----------- | ------------------------ |
| `followUp` | `alt+enter` | 排队后续消息             |
| `dequeue`  | `alt+up`    | 将排队的消息恢复到编辑器 |

### 选择（列表、选择器）

| 操作             | 默认按键           | 说明           |
| ---------------- | ------------------ | -------------- |
| `selectUp`       | `up`               | 向上移动选择   |
| `selectDown`     | `down`             | 向下移动选择   |
| `selectPageUp`   | `pageUp`           | 列表中向上翻页 |
| `selectPageDown` | `pageDown`         | 列表中向下翻页 |
| `selectConfirm`  | `enter`            | 确认选择       |
| `selectCancel`   | `escape`、`ctrl+c` | 取消选择       |

### 会话选择器

| 操作                       | 默认按键         | 说明                   |
| -------------------------- | ---------------- | ---------------------- |
| `toggleSessionPath`        | `ctrl+p`         | 切换路径显示           |
| `toggleSessionSort`        | `ctrl+s`         | 切换排序模式           |
| `toggleSessionNamedFilter` | `ctrl+n`         | 切换仅命名会话过滤     |
| `renameSession`            | `ctrl+r`         | 重命名会话             |
| `deleteSession`            | `ctrl+d`         | 删除会话               |
| `deleteSessionNoninvasive` | `ctrl+backspace` | 删除会话（查询为空时） |

## 自定义配置

创建 `~/.pi/agent/keybindings.json`：

```json
{
  "cursorUp": ["up", "ctrl+p"],
  "cursorDown": ["down", "ctrl+n"],
  "deleteWordBackward": ["ctrl+w", "alt+backspace"]
}
```

每个操作可以有单个按键或按键数组。用户配置覆盖默认值。

### Emacs 示例

```json
{
  "cursorUp": ["up", "ctrl+p"],
  "cursorDown": ["down", "ctrl+n"],
  "cursorLeft": ["left", "ctrl+b"],
  "cursorRight": ["right", "ctrl+f"],
  "cursorWordLeft": ["alt+left", "alt+b"],
  "cursorWordRight": ["alt+right", "alt+f"],
  "deleteCharForward": ["delete", "ctrl+d"],
  "deleteCharBackward": ["backspace", "ctrl+h"],
  "newLine": ["shift+enter", "ctrl+j"]
}
```

### Vim 示例

```json
{
  "cursorUp": ["up", "alt+k"],
  "cursorDown": ["down", "alt+j"],
  "cursorLeft": ["left", "alt+h"],
  "cursorRight": ["right", "alt+l"],
  "cursorWordLeft": ["alt+left", "alt+b"],
  "cursorWordRight": ["alt+right", "alt+w"]
}
```
