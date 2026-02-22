# 包管理

Pi 包将扩展、技能、提示模板和主题捆绑在一起，通过 npm 或 git 进行分发。

## 安装

```bash
# npm 包
pi install npm:@foo/bar@1.0.0

# Git 仓库
pi install git:github.com/user/repo@v1

# 原始 URL
pi install https://github.com/user/repo

# 本地路径
pi install /absolute/path/to/package
```

默认情况下，安装到全局设置。使用 `-l` 安装到项目级（`.pi/settings.json`）。

**临时测试：**
```bash
pi -e npm:@foo/bar
```

**管理操作：**
```bash
pi remove npm:@foo/bar
pi list
pi update
```

## 包来源

### npm

格式：`npm:@scope/pkg@1.2.3`。带版本号的规格会阻止自动更新。全局安装使用 `-g`，项目级安装存放在 `.pi/npm/`。

### Git

格式：`git:github.com/user/repo@v1`、HTTPS、SSH、`git://`。克隆到 `~/.pi/agent/git/<host>/<path>`（全局）或 `.pi/git/<host>/<path>`（项目级）。

### 本地路径

直接引用磁盘上的文件，不进行复制。

## 创建包

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

路径支持 glob 模式和 `!exclusions` 排除。包含 `pi-package` 关键字可在应用商店中展示。

应用商店元数据：
- `video`：MP4 格式
- `image`：PNG、JPEG、GIF、WebP 格式

## 自动发现

如果没有显式清单配置，Pi 会自动发现以下目录结构：
- `extensions/` — `.ts` 和 `.js` 文件
- `skills/` — 包含 `SKILL.md` 的目录和顶层 `.md` 文件
- `prompts/` — `.md` 文件
- `themes/` — `.json` 文件

## 依赖管理

运行时依赖项放在 `dependencies` 中。核心对等依赖使用 `"*"` 版本范围，不进行打包。

## 过滤

```json
{
  "source": "npm:my-package",
  "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
  "skills": [],
  "prompts": ["prompts/review.md"],
  "themes": ["+themes/legacy.json"]
}
```

- 省略键 — 加载全部
- `[]` — 不加载任何内容
- `!pattern` — 排除匹配项
- `+path` — 强制包含
- `-path` — 强制排除

## 作用域与去重

项目设置优先于全局设置。通过以下方式进行身份匹配和去重：
- **npm 包**：按包名称
- **Git 仓库**：按仓库 URL
- **本地路径**：按绝对路径

:::warning
Pi 包以完整的系统权限运行。扩展可以执行任意代码，技能可以指导模型执行任何操作。
:::
