<p align="center">
  <img src="src-tauri/icons/128x128.png" width="96" alt="Grimpad">
</p>
<h1 align="center">Grimpad</h1>

<p align="center">
  <img src="docs/screenshot.png" alt="Grimpad — tabs, Monaco highlighting, and About" width="880">
</p>

## What is Grimpad?

A modern, minimalist Fluent-style notepad for Windows with tabs, syntax highlighting, and live markdown. Good for notes *and* viewing scripts.

Under the hood it uses the [Monaco Editor](https://microsoft.github.io/monaco-editor/) (the same engine as VS Code) plus [MDXEditor](https://mdxeditor.dev/) for live markdown.

It is a personal project, still in **beta** (`0.6`).

## Features

* **Tabs**
* **Syntax Highlighting**
* **Markdown Formatting**
* **Session Restoring**
* **Dark Theme**

## Downloads

Get the latest Windows x64 build from **[Releases](https://github.com/Grimstuff/grimpad/releases/latest)**.

| File | What |
|------|------|
| `Grimpad-0.6-windows-x64.exe` | **Standalone** — double-click, no install |
| `Grimpad_0.6.0_x64-setup.exe` | Installer |

Windows may complain the exe is unsigned. **More info** lets you bypass.

Needs [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (already on most Windows 10/11 PCs).

## Build from source

Requires **Node.js 20+**, **Rust** (stable), and [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
git clone https://github.com/Grimstuff/grimpad.git
cd grimpad
npm install
npm run tauri dev     # development
npm run tauri build   # release exe + installer
```

## License

MIT — see [LICENSE](./LICENSE).

Coded with use of AI.
