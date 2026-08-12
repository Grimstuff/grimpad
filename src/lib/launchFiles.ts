import { invoke } from "@tauri-apps/api/core";

/**
 * Absolute paths passed when the process was started
 * (drop onto .exe, "Open with", default app association).
 */
export async function getLaunchFilePaths(): Promise<string[]> {
  try {
    const paths = await invoke<string[]>("get_launch_paths");
    return Array.isArray(paths) ? paths.filter(Boolean) : [];
  } catch (e) {
    console.warn("get_launch_paths", e);
    return [];
  }
}
