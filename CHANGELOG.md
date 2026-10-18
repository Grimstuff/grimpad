# Changelog

## Unreleased

- Installed copies check GitHub for a new version shortly after launch and offer to install it. Grimpad closes, updates and reopens, keeping unsaved tabs from the main window. The portable exe offers a download link instead. Hamburger menu has Check for updates.
- Opening a file replaces a lone blank Untitled tab instead of adding a second tab. Works for the Open dialog, drag and drop, and Open with.
- Find, Replace and Go to line work from Formatted markdown. They switch to Raw and run once.
- Clicking Ln/Col in the status bar opens Go to line. Line numbers stay visible while it is open.
- Single session (on by default, toggle in the hamburger menu). Opening a file while Grimpad is running sends it to the open window.
- Drag a tab outside the window to move it into its own window.
- Theme follows Windows light/dark. The theme menu is gone.
- Saving to a protected location asks for administrator permission through Windows instead of failing.
- The installer registers Grimpad on Open with for more text and code file types.
- Code blocks in Formatted markdown have no language dropdown and use the app's background instead of a white panel.
- Fixed files opened through Explorer or a second launch failing to load when Windows handed over a `\\?\` path, including network (UNC) paths.

## 0.6

- Tab bar arrows snap so the rightmost tab's close button is fully visible, with a short ease. A barely visible tab at the far left is skipped.
- Mouse wheel scrolling follows the Windows "lines per notch" setting.
- When an open file is deleted on disk, choose Keep (as unsaved) or Close.
- Installer is NSIS only (no MSI).
- Hid the long Freemarker2 dialect names from the language picker.

## 0.5

- The packaged exe now highlights code the same way `tauri dev` does (ESM Monaco with inlined workers, CSP that allows editor styles).
- Confirm close applies to tabs with unsaved changes.
- Untitled and empty files detect their language automatically.
- README rewritten with a screenshot.

## 0.4

- Confirm close setting in the hamburger menu, remembered between launches.

## 0.3

- Open files from the command line, by dropping them on the exe, or with Open with on a cold start.
- No console window on Windows.
- New scroll app icon.
- File associations for common text types.

## 0.2

- First release candidate.
