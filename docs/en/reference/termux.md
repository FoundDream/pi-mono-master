# Termux (Android)

Pi can run on Android devices using Termux, a terminal emulator that provides a Linux environment without rooting.

## Prerequisites

Install both **Termux** and **Termux:API** from [GitHub Releases](https://github.com/termux/termux-app/releases) or [F-Droid](https://f-droid.org/packages/com.termux/).

:::warning
Do not install Termux from Google Play. The Google Play version is outdated and incompatible with Termux:API.
:::

## Installation

```bash
# Update packages
pkg update && pkg upgrade

# Install Node.js and dependencies
pkg install nodejs-lts git

# Install Termux:API bridge (required for clipboard)
pkg install termux-api

# Install Pi globally
npm install -g @anthropic-ai/pi

# Verify installation
pi --version
```

## Clipboard Support

Pi clipboard integration on Termux uses `termux-clipboard-get` and `termux-clipboard-set` from the Termux:API package.

- Text clipboard works normally
- Image clipboard is **not supported** on Termux

Ensure the Termux:API app is installed alongside the Termux terminal app for clipboard commands to function.

## Example AGENTS.md for Termux

Add this to your project's `AGENTS.md` to help Pi understand the Termux environment:

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

## Limitations

- **No image clipboard**: Termux:API only supports text clipboard operations. Image paste and screenshot features are unavailable.
- **No native binaries**: Pre-compiled x86/x64 Linux binaries do not work. Packages must be installed through `pkg` or compiled from source for the device architecture.
- **Storage access**: Android scoped storage restrictions apply. Run `termux-setup-storage` once to create `~/storage/shared` for access to device files.
- **Background execution**: Android may kill Termux processes in the background. Use `termux-wake-lock` to keep the process alive during long operations.

## Troubleshooting

### Clipboard not working

1. Confirm **Termux:API** app is installed (separate from the Termux terminal).
2. Run `termux-clipboard-get` manually to verify it returns clipboard content.
3. If you see a permission error, open Android Settings and grant Termux:API the required permissions.

### Permission denied errors

Run `termux-setup-storage` to grant Termux access to shared storage. This creates symlinks under `~/storage/`.

### Node.js issues

If `pkg install nodejs-lts` fails, update your package repositories first:

```bash
pkg update
pkg install nodejs-lts
```

If you encounter architecture-related build errors with native modules, use `pkg install build-essential` to install compilation tools.
