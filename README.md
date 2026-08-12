<p align="center">
  <img src="src-tauri/icons/128x128.png" width="96" alt="Grimpad">
</p>

<h1 align="center">Grimpad</h1>

<p align="center">
  A modern, lightweight notepad for Windows — tabs, syntax highlighting, and live markdown.
</p>

<p align="center">
  <a href="https://github.com/Grimstuff/grimpad/releases/latest"><img src="https://img.shields.io/github/v/release/Grimstuff/grimpad?style=flat-square&label=latest" alt="Latest release"></a>
  <a href="https://github.com/Grimstuff/grimpad/releases"><img src="https://img.shields.io/badge/platform-Windows-0078d4?style=flat-square" alt="Windows"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT"></a>
</p>

<p align="center">
  <img src="docs/screenshot.png" alt="Grimpad — tabs, Monaco highlighting, and About" width="880">
</p>

## What is Grimpad?

A Fluent-style notepad in the spirit of [Notepads](https://github.com/0x7c13/Notepads): fast to open, easy on the eyes, and good enough for notes *and* config files. Under the hood it uses the [Monaco Editor](https://microsoft.github.io/monaco-editor/) (the same engine as VS Code) plus [MDXEditor](https://mdxeditor.dev/) for live markdown.

It is a personal project, still in **beta** (`0.5.0`). MIT licensed.

## Features

* **Tabs** — new, open, close, dirty indicator, middle-click close
* **Monaco** — syntax highlighting, Find / Replace / Go to line
* **Markdown** — Formatted (live) and Raw (source)
* **Session restore** — tabs and unsaved buffers come back after quit
* **Confirm close** — optional Save / Don’t save prompt (app quit and dirty tabs)
* **External changes** — Reload or keep yours when a file changes on disk
* **Open how you want** — drag-and-drop, drop on the exe, or Open with
* **Theme** — light, dark, or system, plus Windows accent color
* **Word wrap** and **zoom** persist across launches

## Downloads

Get the latest Windows x64 build from **[Releases](https://github.com/Grimstuff/grimpad/releases/latest)**.

| File | What |
|------|------|
| `Grimpad-0.5.0-windows-x64.exe` | **Standalone** — double-click, no install |
| `Grimpad_0.5.0_x64-setup.exe` | NSIS installer |
| `Grimpad_0.5.0_x64_en-US.msi` | MSI installer |

Needs [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (already on most Windows 10/11 PCs).

The portable exe is unsigned. Microsoft Defender’s machine-learning heuristic (`Wacatac.B!ml`) sometimes flags brand-new unsigned builds. That is a reputation false positive, not a packed or obfuscated binary.

## Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` / `Ctrl+T` | New tab |
| `Ctrl+O` | Open |
| `Ctrl+S` / `Ctrl+Shift+S` | Save / Save as |
| `Ctrl+W` | Close tab |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next / previous tab |
| `Ctrl+1`…`9` | Jump to tab |
| `Ctrl+F` / `Ctrl+H` | Find / replace |
| `Ctrl+G` | Go to line |
| `Ctrl++` / `-` / `0` | Zoom in / out / reset |

## Privacy

Session state lives only on your machine:

`%AppData%\com.grimmers.grimpad\session.json`

It can include full buffer text for unsaved tabs (plaintext, like Notepad / VS Code hot-exit). Grimpad does not phone home.

## Build from source

Requires **Node.js 20+**, **Rust** (stable), and [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
git clone https://github.com/Grimstuff/grimpad.git
cd grimpad
npm install
npm run tauri dev     # development
npm run tauri build   # release exe + installers
```

## License

MIT — see [LICENSE](./LICENSE).
