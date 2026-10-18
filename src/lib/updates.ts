import { invoke } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { create } from "zustand";
import { isMainWindow } from "./extraWindows";
import { saveSessionToDisk } from "./session";

/** Version the user closed with Later; startup checks stay quiet for it. */
const DISMISSED_KEY = "grimpad.update.dismissed";
const STARTUP_DELAY_MS = 4000;

export type UpdatePhase = "checking" | "available" | "none" | "downloading" | "error";

interface UpdateState {
  open: boolean;
  phase: UpdatePhase;
  version: string;
  notes: string;
  /** Installer copy can update in place; the portable exe gets a download link. */
  installed: boolean;
  /** 0..1, or null while the size is unknown. */
  progress: number | null;
  error: string;
}

export const useUpdateStore = create<UpdateState>(() => ({
  open: false,
  phase: "none",
  version: "",
  notes: "",
  installed: false,
  progress: null,
  error: "",
}));

let pending: Update | null = null;
let busy = false;

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

/** Ask GitHub for a newer release. Manual checks always report back; the startup check only speaks up for a new version. */
export async function checkForUpdates(manual: boolean): Promise<void> {
  if (busy) return;
  busy = true;
  if (manual) useUpdateStore.setState({ open: true, phase: "checking", error: "" });
  try {
    const update = await check();
    if (!update) {
      if (manual) useUpdateStore.setState({ phase: "none" });
      return;
    }
    if (!manual && readDismissed() === update.version) return;
    pending = update;
    const installed = await invoke<boolean>("is_installed_copy").catch(() => false);
    useUpdateStore.setState({
      open: true,
      phase: "available",
      version: update.version,
      notes: update.body?.trim() ?? "",
      installed,
      progress: null,
      error: "",
    });
  } catch (e) {
    console.warn("update check failed", e);
    if (manual) useUpdateStore.setState({ phase: "error", error: errorText(e) });
  } finally {
    busy = false;
  }
}

/** Download, then hand off to the installer. Windows exits the app and the installer reopens it. */
export async function installUpdate(): Promise<void> {
  const update = pending;
  if (!update || busy) return;
  busy = true;
  useUpdateStore.setState({ phase: "downloading", progress: null, error: "" });
  // Unsaved tabs in the main window come back through the session file.
  await saveSessionToDisk();
  let total = 0;
  let done = 0;
  try {
    await update.downloadAndInstall((ev) => {
      if (ev.event === "Started") {
        total = ev.data.contentLength ?? 0;
      } else if (ev.event === "Progress") {
        done += ev.data.chunkLength;
        if (total > 0) useUpdateStore.setState({ progress: Math.min(1, done / total) });
      }
    });
  } catch (e) {
    console.warn("update install failed", e);
    useUpdateStore.setState({ phase: "error", error: errorText(e) });
  } finally {
    busy = false;
  }
}

export function openDownloadPage(): void {
  void invoke("open_releases_page").catch((e) => console.warn("open_releases_page failed", e));
  closeUpdateDialog();
}

export function dismissUpdate(): void {
  const { phase, version } = useUpdateStore.getState();
  if (phase === "available" && version) {
    try {
      localStorage.setItem(DISMISSED_KEY, version);
    } catch {
      /* ignore */
    }
  }
  closeUpdateDialog();
}

export function closeUpdateDialog(): void {
  if (useUpdateStore.getState().phase === "downloading") return;
  useUpdateStore.setState({ open: false });
}

/** Quiet check shortly after launch, from the main window only. */
export function initUpdateCheck(): () => void {
  if (!isMainWindow() || import.meta.env.DEV) return () => {};
  const timer = window.setTimeout(() => void checkForUpdates(false), STARTUP_DELAY_MS);
  return () => window.clearTimeout(timer);
}
