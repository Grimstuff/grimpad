# Grimpad

A lightweight, Fluent-inspired multi-tab notepad for Windows — simple like [Notepads](https://www.notepadsapp.com/), with **VS Code–class syntax highlighting** via the [Monaco Editor](https://microsoft.github.io/monaco-editor/) and **live markdown** via [MDXEditor](https://mdxeditor.dev/).

**Status:** beta / release candidate (`0.2.0`)  
**License:** [MIT](./LICENSE)

## Features

* **Tabs** — new, open, close, dirty indicator, middle-click close, overflow seek
* **Open / Save / Save As** — native dialogs, UTF-8 (max 32 MB per file)
* **Session restore** — open tabs (including unsaved buffers) survive restart
* **Quit prompts** — unsaved tabs prompt Save / Don’t save before exit
* **External change detection** — prompt Reload / Keep mine when a file changes on disk
* **Ghost files** — if a path no longer exists, buffer stays open dirty (no path) for re-save
* **Monaco editor** — Dark+/Light+–style themes, language from extension or status-bar override
* **Markdown** — Formatted (live) / Raw (source) toggle for `.md` / markdown languages
* **Find / Replace / Go to line** — Monaco built-ins (`Ctrl+F`, `Ctrl+H`, `Ctrl+G`)
* **Zoom** — status bar font control / `Ctrl+Plus` / `Ctrl+-` / `Ctrl+0` (persisted)
* **Word wrap** + theme mode persisted across launches
* **Light / dark / system** chrome theme; Windows accent color on chrome
* **Window size/position** remembered across launches
* **Drag-and-drop** files onto the window to open

## Stack

| Layer  | Tech                                                |
| ------ | --------------------------------------------------- |
| Shell  | [Tauri 2](https://tauri.app/) (WebView2 on Windows) |
| UI     | React + TypeScript + Vite                           |
| Editor | Monaco + MDXEditor (markdown formatted view)        |
| State  | Zustand                                             |

## Develop

Requirements: **Node.js 20+**, **Rust** (stable), Windows WebView2 (usually already installed).

```bash
cd Dev/grimpad
npm install
npm run tauri dev
```

`postinstall` copies Monaco’s AMD build into `public/monaco` (required for the editor; ~23 MB, regenerated on install, not committed).

## Build

```bash
npm run tauri build
```

Artifacts land under `src-tauri/target/release/` (and bundle installers if configured).

## Session data & privacy

Open-tab state is stored at:

`%AppData%\com.grimmers.grimpad\session.json`

This includes full buffer text for dirty/untitled tabs (and content snapshots). It is **local plaintext**, similar to Notepad++ / VS Code hot-exit — not encrypted. Anyone with access to your Windows user profile can read it. Treat secrets accordingly.

## Security notes

* File open/save goes through custom Tauri commands with a **32 MiB** size cap.
* WebView **CSP** is enabled (self + IPC; no remote scripts).
* Capabilities are limited to dialogs, window controls, and window-state — no shell opener, no broad FS plugin.

## Shortcuts

| Shortcut                      | Action                |
| ----------------------------- | --------------------- |
| `Ctrl+N` / `Ctrl+T`           | New tab               |
| `Ctrl+O`                      | Open file(s)          |
| `Ctrl+S`                      | Save                  |
| `Ctrl+Shift+S`                | Save as               |
| `Ctrl+W`                      | Close tab             |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next / previous tab   |
| `Ctrl+1`…`9`                  | Jump to tab           |
| `Ctrl+F` / `Ctrl+H`           | Find / replace        |
| `Ctrl+G`                      | Go to line            |
| `Ctrl+Plus` / `-` / `0`       | Zoom in / out / reset |

## Roadmap ideas

* Encoding picker (non–UTF-8)
* Minimap / read-only mode
* Optional leaner session mode (paths only)
* Optional LSP for deeper IntelliSense
* Installer branding polish

## License

MIT — see [LICENSE](./LICENSE). You own this project as the person who directed and published it (including AI-assisted development).
