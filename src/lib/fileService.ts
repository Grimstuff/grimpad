import { invoke } from "@tauri-apps/api/core";
import { open, save, ask } from "@tauri-apps/plugin-dialog";
import { FILE_FILTERS } from "./languages";

export async function readFile(path: string): Promise<string> {
  return invoke<string>("read_file_content", { path });
}

export async function writeFile(path: string, content: string): Promise<void> {
  await invoke("write_file_content", { path, content });
}

export interface FileMeta {
  mtimeMs: number | null;
  size: number;
}

/** null if path does not exist */
export async function getFileMeta(path: string): Promise<FileMeta | null> {
  return invoke<FileMeta | null>("get_file_meta", { path });
}

/** External change: Reload = true, Keep = false */
export async function confirmExternalChange(
  title: string,
  isDirty: boolean,
): Promise<boolean> {
  const extra = isDirty
    ? "\n\nYou have unsaved changes in the editor. Reloading will discard them."
    : "";
  return ask(
    `"${title}" has been changed on disk.${extra}\n\nReload from disk?`,
    {
      title: "File changed",
      kind: "warning",
      okLabel: "Reload",
      cancelLabel: "Keep mine",
    },
  );
}

/** File deleted externally: Keep = true, Close = false */
export async function confirmExternalDelete(title: string): Promise<boolean> {
  return ask(
    `"${title}" was deleted or moved on disk.\n\nKeep the content open as unsaved, or close the tab?`,
    {
      title: "File missing",
      kind: "warning",
      okLabel: "Keep",
      cancelLabel: "Close",
    },
  );
}

/** Open one or more files via native dialog. Returns absolute paths. */
export async function openFilesDialog(): Promise<string[] | null> {
  const result = await open({
    multiple: true,
    filters: FILE_FILTERS,
  });
  if (result === null) return null;
  return Array.isArray(result) ? result : [result];
}

/** Save-as dialog; returns chosen path or null if cancelled. */
export async function saveFileDialog(defaultPath?: string | null): Promise<string | null> {
  const result = await save({
    defaultPath: defaultPath ?? undefined,
    filters: FILE_FILTERS,
  });
  return result;
}

/**
 * Dirty tab close. Native ask is binary (no third Cancel).
 * Save → save; Don't save → discard.
 */
export async function confirmCloseDirty(title: string): Promise<"save" | "discard" | "cancel"> {
  const saveIt = await ask(`"${title}" has unsaved changes. Save before closing?`, {
    title: "Unsaved changes",
    kind: "warning",
    okLabel: "Save",
    cancelLabel: "Don't save",
  });
  return saveIt ? "save" : "discard";
}
