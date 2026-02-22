# Termux (Android)

Pi 可以在 Android 设备上通过 Termux 运行。Termux 是一个终端模拟器，无需 root 即可提供 Linux 环境。

## 前提条件

从 [GitHub Releases](https://github.com/termux/termux-app/releases) 或 [F-Droid](https://f-droid.org/packages/com.termux/) 安装 **Termux** 和 **Termux:API**。

:::warning
请勿从 Google Play 安装 Termux。Google Play 版本已过时，与 Termux:API 不兼容。
:::

## 安装步骤

```bash
# 更新包
pkg update && pkg upgrade

# 安装 Node.js 和依赖
pkg install nodejs-lts git

# 安装 Termux:API 桥接（剪贴板功能必需）
pkg install termux-api

# 全局安装 Pi
npm install -g @anthropic-ai/pi

# 验证安装
pi --version
```

## 剪贴板支持

Pi 在 Termux 上的剪贴板集成使用 Termux:API 包中的 `termux-clipboard-get` 和 `termux-clipboard-set`。

- 文本剪贴板正常工作
- **不支持**图片剪贴板

确保 Termux:API 应用与 Termux 终端应用同时安装，以使剪贴板命令正常工作。

## AGENTS.md 示例

在项目的 `AGENTS.md` 中添加以下内容，帮助 Pi 理解 Termux 环境：

```markdown
# Termux Environment

This project runs on Android via Termux. Keep the following in mind:

## Available Commands
- `termux-clipboard-get` - Read text from clipboard
- `termux-clipboard-set` - Write text to clipboard
- `termux-open` - Open a file or URL in an Android app
- `termux-open-url` - Open a URL in the default browser
- `termux-share` - Share text or files via Android share sheet
- `termux-toast` - Show an Android toast notification
- `termux-notification` - Display a system notification
- `termux-vibrate` - Vibrate the device
- `termux-battery-status` - Get battery information
- `termux-wifi-connectioninfo` - Get WiFi connection details
- `termux-download` - Download a file using Android DownloadManager
- `termux-storage-get` - Request a file from Android storage

## Notes
- Home directory is `~/` which maps to `/data/data/com.termux/files/home`
- Shared storage is at `~/storage/shared` (requires `termux-setup-storage`)
- No systemd or traditional init system
- Native ARM binaries from other Linux distros will not work
```

## 限制

- **无图片剪贴板**：Termux:API 仅支持文本剪贴板操作。图片粘贴和截图功能不可用。
- **无原生二进制文件**：预编译的 x86/x64 Linux 二进制文件无法运行。包必须通过 `pkg` 安装或从源码针对设备架构编译。
- **存储访问**：受 Android 作用域存储限制。运行 `termux-setup-storage` 一次以创建 `~/storage/shared`，访问设备文件。
- **后台执行**：Android 可能在后台杀死 Termux 进程。使用 `termux-wake-lock` 在长时间操作期间保持进程存活。

## 故障排除

### 剪贴板不工作
1. 确认已安装 **Termux:API** 应用（与 Termux 终端是独立的应用）。
2. 手动运行 `termux-clipboard-get` 验证是否能返回剪贴板内容。
3. 如果出现权限错误，在 Android 设置中为 Termux:API 授予所需权限。

### 权限被拒绝
运行 `termux-setup-storage` 授予 Termux 共享存储访问权限。这会在 `~/storage/` 下创建符号链接。

### Node.js 问题
如果 `pkg install nodejs-lts` 失败，先更新包仓库：

```bash
pkg update
pkg install nodejs-lts
```

如果遇到与架构相关的原生模块编译错误，使用 `pkg install build-essential` 安装编译工具。
