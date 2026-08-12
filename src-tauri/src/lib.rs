// Grimpad Tauri backend — file I/O + plugins
use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Manager};

/// Soft cap so a multi‑GB open can't freeze the UI / exhaust RAM.
const MAX_FILE_BYTES: u64 = 32 * 1024 * 1024; // 32 MiB

fn assert_file_size_ok(path: &str) -> Result<(), String> {
    let meta = fs::metadata(path).map_err(|e| format!("Failed to stat {path}: {e}"))?;
    let len = meta.len();
    if len > MAX_FILE_BYTES {
        let mb = MAX_FILE_BYTES / (1024 * 1024);
        return Err(format!(
            "File is too large to open in Grimpad ({:.1} MB). Limit is {mb} MB.",
            len as f64 / (1024.0 * 1024.0)
        ));
    }
    Ok(())
}

#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
    assert_file_size_ok(&path)?;
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {path}: {e}"))
}

#[tauri::command]
fn write_file_content(path: String, content: String) -> Result<(), String> {
    let bytes = content.len() as u64;
    if bytes > MAX_FILE_BYTES {
        let mb = MAX_FILE_BYTES / (1024 * 1024);
        return Err(format!(
            "Content is too large to save in Grimpad ({:.1} MB). Limit is {mb} MB.",
            bytes as f64 / (1024.0 * 1024.0)
        ));
    }
    if let Some(parent) = PathBuf::from(&path).parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory {}: {e}", parent.display()))?;
        }
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write {path}: {e}"))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileMeta {
    /// Unix epoch milliseconds; null if unavailable
    mtime_ms: Option<u64>,
    size: u64,
}

/// Metadata for external-change detection. `None` if the path does not exist.
#[tauri::command]
fn get_file_meta(path: String) -> Result<Option<FileMeta>, String> {
    use std::time::UNIX_EPOCH;

    match fs::metadata(&path) {
        Ok(meta) => {
            let mtime_ms = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64);
            Ok(Some(FileMeta {
                mtime_ms,
                size: meta.len(),
            }))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("stat {path}: {e}")),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AccentColors {
    /// CSS hex background, e.g. "#c45c1a"
    background: String,
    /// Contrasting text color for the accent background
    foreground: String,
}

fn session_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir: {e}"))?;
    Ok(dir.join("session.json"))
}

/// Persist open tabs between launches (Notepad-style session).
/// Writes via a temp file then renames so a crash mid-write can't truncate session.json.
#[tauri::command]
fn save_session(app: AppHandle, data: String) -> Result<(), String> {
    let path = session_file(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create app data: {e}"))?;
    }
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, data).map_err(|e| format!("write session temp: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("commit session: {e}"))
}

#[tauri::command]
fn load_session(app: AppHandle) -> Result<Option<String>, String> {
    let path = session_file(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let data = fs::read_to_string(&path).map_err(|e| format!("read session: {e}"))?;
    Ok(Some(data))
}

/// Paths passed on the command line (drop file onto .exe, Open with, file association).
/// Skips flags and non-files. Canonicalizes so open/session path matching is consistent.
#[tauri::command]
fn get_launch_paths() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter_map(|arg| {
            if arg.starts_with('-') || arg.contains("://") {
                return None;
            }
            let path = PathBuf::from(&arg);
            if !path.is_file() {
                return None;
            }
            Some(normalize_path_display(&path))
        })
        .collect()
}

/// Strip Windows `\\?\` extended prefix after canonicalize.
fn normalize_path_display(path: &std::path::Path) -> String {
    let resolved = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let s = resolved.to_string_lossy();
    s.strip_prefix(r"\\?\")
        .or_else(|| s.strip_prefix("//?/"))
        .unwrap_or(&s)
        .replace('/', "\\")
}

/// Read the Windows personalization accent color (not CSS AccentColor, which WebView often mishandles).
#[tauri::command]
fn get_system_accent() -> Result<AccentColors, String> {
    #[cfg(windows)]
    {
        return read_windows_accent();
    }
    #[cfg(not(windows))]
    {
        Err("System accent is only implemented on Windows".into())
    }
}

#[cfg(windows)]
fn read_windows_accent() -> Result<AccentColors, String> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    // Preferred: DWM AccentColor (matches Settings → Colors accent for most users)
    // Stored as 0xAABBGGRR (Windows COLORREF-style)
    let from_dwm = (|| -> Option<(u8, u8, u8)> {
        let dwm = hkcu.open_subkey("Software\\Microsoft\\Windows\\DWM").ok()?;
        let color: u32 = dwm.get_value("AccentColor").ok()?;
        Some(abgr_to_rgb(color))
    })();

    // Fallback: Explorer AccentColorMenu
    let from_explorer = (|| -> Option<(u8, u8, u8)> {
        let accent = hkcu
            .open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent")
            .ok()?;
        let color: u32 = accent.get_value("AccentColorMenu").ok()?;
        Some(abgr_to_rgb(color))
    })();

    // Fallback: DWM ColorizationColor
    let from_colorization = (|| -> Option<(u8, u8, u8)> {
        let dwm = hkcu.open_subkey("Software\\Microsoft\\Windows\\DWM").ok()?;
        let color: u32 = dwm.get_value("ColorizationColor").ok()?;
        Some(abgr_to_rgb(color))
    })();

    let (r, g, b) = from_dwm
        .or(from_explorer)
        .or(from_colorization)
        .ok_or_else(|| "Could not read Windows accent color from registry".to_string())?;

    let background = format!("#{r:02x}{g:02x}{b:02x}");
    let foreground = if relative_luminance(r, g, b) > 0.55 {
        "#1a1a1a".to_string()
    } else {
        "#ffffff".to_string()
    };

    Ok(AccentColors {
        background,
        foreground,
    })
}

#[cfg(windows)]
fn abgr_to_rgb(color: u32) -> (u8, u8, u8) {
    // Windows registry accent is typically 0xAABBGGRR
    let r = (color & 0xFF) as u8;
    let g = ((color >> 8) & 0xFF) as u8;
    let b = ((color >> 16) & 0xFF) as u8;
    (r, g, b)
}

#[cfg(windows)]
fn relative_luminance(r: u8, g: u8, b: u8) -> f64 {
    fn lin(c: u8) -> f64 {
        let s = c as f64 / 255.0;
        if s <= 0.03928 {
            s / 12.92
        } else {
            ((s + 0.055) / 1.055).powf(2.4)
        }
    }
    0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // Restore size/position while hidden; we show from the frontend after first paint
        // so the default-size white flash never appears.
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED
                        | tauri_plugin_window_state::StateFlags::FULLSCREEN
                        | tauri_plugin_window_state::StateFlags::DECORATIONS,
                )
                .build(),
        )
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::Manager;
                use tauri::window::Color;
                if let Some(win) = app.get_webview_window("main") {
                    // Match app chrome so any brief show isn't a white void.
                    let _ = win.set_background_color(Some(Color(0x1e, 0x1e, 0x1e, 0xff)));
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file_content,
            write_file_content,
            get_file_meta,
            get_launch_paths,
            get_system_accent,
            save_session,
            load_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
