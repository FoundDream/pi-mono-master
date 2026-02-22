# TUI 组件

Pi 的终端用户界面 (TUI) 基于自定义组件系统构建，提供丰富的终端交互体验。

## Component 接口

所有 TUI 组件实现统一的 `Component` 接口：

```typescript
interface Component {
  /** 渲染组件，返回要显示的行 */
  render(width: number): Line[];

  /** 处理键盘输入事件 */
  handleInput?(input: InputEvent): InputResult;

  /** 通知组件需要重新渲染 */
  invalidate(): void;
}
```

### 方法说明

| 方法 | 说明 |
|------|------|
| `render(width)` | 接收可用宽度，返回渲染后的行数组 |
| `handleInput(input)` | 处理键盘事件，返回是否已消费该事件 |
| `invalidate()` | 标记组件为脏状态，触发下一帧重新渲染 |

## 行宽要求

`render()` 返回的每一行必须精确填充指定宽度。不满宽度的行需要用空格填充，超出宽度的行会导致渲染错误。

```typescript
render(width: number): Line[] {
  const text = "Hello";
  const padding = " ".repeat(width - text.length);
  return [{ text: text + padding }];
}
```

## IME 支持

Pi 的 TUI 支持输入法编辑器 (IME)，可以正确处理中文、日文、韩文等需要组合输入的语言：

- 在组合输入期间显示预编辑文本
- 正确处理组合窗口的定位
- 支持候选词选择

## 内置组件

Pi 提供以下内置 TUI 组件：

| 组件 | 说明 |
|------|------|
| `TextInput` | 单行文本输入，支持光标移动和编辑 |
| `TextArea` | 多行文本编辑器，支持滚动 |
| `Select` | 单选下拉菜单 |
| `MultiSelect` | 多选列表 |
| `Confirm` | 确认对话框（是/否） |
| `Spinner` | 加载动画指示器 |
| `Progress` | 进度条 |
| `Table` | 表格展示 |
| `Tree` | 树形结构展示 |
| `Markdown` | Markdown 渲染 |
| `Diff` | 差异对比展示 |
| `CodeBlock` | 代码块，支持语法高亮 |

## 在扩展和工具中使用

扩展和自定义工具可以使用内置 TUI 组件构建交互界面：

```typescript
import { TextInput, Select } from "@anthropic-ai/pi/tui";

ctx.registerTool({
  name: "interactive_config",
  description: "Interactively configure settings",
  input: Type.Object({}),
  async execute(args, { ui }) {
    const name = await ui.prompt(TextInput, {
      label: "Project name",
      placeholder: "my-project",
    });

    const framework = await ui.prompt(Select, {
      label: "Framework",
      options: ["React", "Vue", "Svelte"],
    });

    return {
      content: [
        { type: "text", text: `Created ${name} with ${framework}` },
      ],
    };
  },
});
```

## 覆盖组件

可以通过主题或扩展覆盖内置组件的渲染行为：

```typescript
export default (ctx: ExtensionContext) => {
  ctx.ui.override("Spinner", {
    render(width) {
      const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      const frame = frames[Date.now() % frames.length];
      const text = `${frame} Loading...`;
      const padding = " ".repeat(Math.max(0, width - text.length));
      return [{ text: text + padding }];
    },
  });
};
```

## 键盘处理

TUI 使用 Kitty 键盘协议进行精确的按键检测：

```typescript
handleInput(input: InputEvent): InputResult {
  switch (input.key) {
    case "Enter":
      this.submit();
      return { consumed: true };
    case "Escape":
      this.cancel();
      return { consumed: true };
    case "Tab":
      this.autocomplete();
      return { consumed: true };
    default:
      if (input.char) {
        this.insertChar(input.char);
        return { consumed: true };
      }
      return { consumed: false };
  }
}
```

### 修饰键

| 修饰键 | 属性 |
|--------|------|
| Shift | `input.shift` |
| Ctrl | `input.ctrl` |
| Alt/Option | `input.alt` |
| Meta/Cmd | `input.meta` |

## 性能

TUI 渲染遵循以下性能原则：

- **脏检测**：仅在 `invalidate()` 被调用后重新渲染
- **差异更新**：仅重绘发生变化的行
- **节流**：渲染频率限制为每秒 60 帧
- **懒加载**：不可见的组件不会被渲染

## 主题

TUI 组件通过主题系统支持样式自定义：

```json
{
  "colors": {
    "primary": "#6366f1",
    "secondary": "#a855f7",
    "success": "#22c55e",
    "warning": "#eab308",
    "error": "#ef4444",
    "text": "#e2e8f0",
    "textMuted": "#94a3b8",
    "background": "#0f172a",
    "border": "#334155"
  },
  "spinner": {
    "frames": ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    "interval": 80
  }
}
```

## 常见模式

### 带取消的长时间操作

```typescript
async execute(args, { ui, signal }) {
  const progress = ui.createProgress("Processing...");

  for (let i = 0; i < items.length; i++) {
    if (signal.aborted) {
      progress.cancel("Aborted by user");
      return { content: [{ type: "text", text: "Operation cancelled" }] };
    }
    await processItem(items[i]);
    progress.update((i + 1) / items.length * 100);
  }

  progress.complete("Done!");
  return { content: [{ type: "text", text: "All items processed" }] };
}
```

### 确认操作

```typescript
const confirmed = await ui.prompt(Confirm, {
  message: "Delete all files in /tmp?",
  default: false,
});

if (!confirmed) {
  return { content: [{ type: "text", text: "Operation cancelled" }] };
}
```

### 表格输出

```typescript
const table = ui.createTable({
  columns: [
    { header: "Name", width: 20 },
    { header: "Status", width: 10 },
    { header: "Size", width: 10, align: "right" },
  ],
});

for (const file of files) {
  table.addRow([file.name, file.status, formatSize(file.size)]);
}

return { content: [{ type: "text", text: table.render() }] };
```

## 关键规则

1. **行宽精确**：`render()` 返回的每一行必须精确匹配传入的 `width` 参数
2. **输入消费**：`handleInput()` 必须返回事件是否被消费，未消费的事件会冒泡到父组件
3. **不可直接写终端**：组件不应直接使用 `process.stdout.write()`，所有输出必须通过 `render()` 返回
4. **无状态渲染**：`render()` 应为纯函数，所有状态变更应在 `handleInput()` 或其他方法中完成
5. **无阻塞操作**：`render()` 和 `handleInput()` 不应执行 I/O 或其他阻塞操作
6. **资源清理**：组件被销毁时必须清理定时器、事件监听器等资源
